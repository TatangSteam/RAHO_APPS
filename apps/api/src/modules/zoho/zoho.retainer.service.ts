import { IntegrationEvent, Prisma, ZohoMappingStatus } from '@prisma/client';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import { paymentMethodMappingKey } from './zoho.payment.policy';
import {
  buildRetainerApplicationPayload,
  buildRetainerInvoicePayload,
  buildRetainerPaymentPayload,
  buildTreatmentInvoicePayload,
  buildTreatmentJournalPayload,
  TreatmentRecognitionSnapshot,
} from './zoho.retainer.policy';
import type { TreatmentCompletedEventPayload } from '@modules/sessions/events/treatment-completed.event';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const day = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

type ZohoRetainer = {
  retainerinvoice_id?: string | number;
  reference_number?: string;
  status?: ZohoMappingStatus;
};
type ZohoPayment = { payment_id?: string | number; reference_number?: string };
type ZohoInvoice = { invoice_id?: string | number; reference_number?: string; status?: string };
type ZohoJournal = { journal_id?: string | number; reference_number?: string; status?: string };

async function mapping(
  connectionId: string,
  entityType: string,
  localEntityId: string,
) {
  return prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connectionId,
        entityType,
        localEntityId,
      },
    },
  });
}

async function saveMapping(input: {
  connectionId: string;
  entityType: string;
  localEntityId: string;
  zohoEntityType: string;
  zohoEntityId: string;
  externalKey: string;
  metadata: Record<string, unknown>;
  status?: ZohoMappingStatus;
}) {
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: input.connectionId,
        entityType: input.entityType,
        localEntityId: input.localEntityId,
      },
    },
    create: {
      zohoConnectionId: input.connectionId,
      entityType: input.entityType,
      localEntityId: input.localEntityId,
      zohoEntityType: input.zohoEntityType,
      zohoEntityId: input.zohoEntityId,
      externalKey: input.externalKey,
      status: input.status || ZohoMappingStatus.ACTIVE,
      metadata: json(input.metadata),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: input.zohoEntityId,
      status: input.status || ZohoMappingStatus.ACTIVE,
      metadata: json(input.metadata),
      lastSyncedAt: new Date(),
    },
  });
}

function requireId(
  value: string | undefined,
  message: string,
  code = 'ZOHO_RETAINER_NEEDS_ACTION',
): string {
  if (!value) throw new ZohoApiError(message, code, 422, false);
  return value;
}

async function findOne<T>(
  client: ZohoClient,
  path: string,
  key: string,
  referenceNumber: string,
) {
  const rows = await client.listAll<T & { reference_number?: string }>(path, key, {
    reference_number: referenceNumber,
  });
  const matches = rows.filter((row) => row.reference_number === referenceNumber);
  if (matches.length > 1) {
    throw new ZohoApiError(
      `Referensi ${referenceNumber} ditemukan lebih dari sekali di Zoho.`,
      'ZOHO_RETAINER_AMBIGUOUS',
      409,
      false,
    );
  }
  return matches[0];
}

export async function handleRetainerFundingPayment(paymentId: string) {
  const client = await getActiveZohoClient(true);
  const payment = await prisma.invoicePayment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { include: { branch: true } },
      deferredRevenueMovements: {
        where: { type: 'FUNDING' },
        include: {
          contract: true,
          memberPackage: { include: { packagePricing: true } },
        },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!payment || payment.verificationStatus !== 'VERIFIED' || !payment.verifiedAt) {
    throw new ZohoApiError('Pembayaran paket belum terverifikasi.', 'ZOHO_RETAINER_PAYMENT_INVALID', 422, false);
  }
  if (payment.invoice.branch.type === 'PARTNERSHIP') {
    return { operation: 'SKIP_PARTNERSHIP', reason: 'Omzet Partnership berasal dari shipment barang.' };
  }
  if (!payment.deferredRevenueMovements.length) {
    throw new ZohoApiError(
      'Deferred revenue movement pembayaran paket tidak ditemukan.',
      'ZOHO_RETAINER_MOVEMENT_MISSING',
      422,
      false,
    );
  }

  const [customer, location, bank, method] = await Promise.all([
    mapping(client.connection.id, 'MEMBER', payment.invoice.memberId),
    mapping(client.connection.id, 'BRANCH_LOCATION', payment.invoice.branchId),
    mapping(client.connection.id, 'CASH_BANK_ACCOUNT', payment.cashBankAccountId!),
    mapping(client.connection.id, 'PAYMENT_METHOD', paymentMethodMappingKey(payment.paymentMethod)),
  ]);
  const customerId = requireId(customer?.zohoEntityId, 'Mapping member Zoho untuk retainer belum tersedia.');
  const accountId = requireId(bank?.zohoEntityId, 'Mapping rekening kas/bank Zoho untuk retainer belum tersedia.');
  const paymentMode = requireId(method?.zohoEntityId, 'Mapping metode pembayaran Zoho untuk retainer belum tersedia.');
  const results = [];

  for (const movement of payment.deferredRevenueMovements) {
    const contract = movement.contract;
    const packageCode = movement.memberPackage.productCode
      || movement.memberPackage.packagePricing?.name
      || movement.memberPackage.packageCode;
    const retainerReference = `RAHO-RET:${contract.id}`;
    let retainerMap = await mapping(client.connection.id, 'RETAINER_INVOICE', contract.id);
    let retainerId = retainerMap?.zohoEntityId;
    let retainerOperation = 'ALREADY_MAPPED';
    if (!retainerId) {
      let candidate = await findOne<ZohoRetainer>(
        client,
        '/books/v3/retainerinvoices',
        'retainerinvoices',
        retainerReference,
      );
      retainerOperation = candidate ? 'RECOVER_EXISTING' : 'CREATE';
      if (!candidate) {
        const response = await client.request<{ retainerinvoice?: ZohoRetainer }>(
          '/books/v3/retainerinvoices',
          {
            method: 'POST',
            data: buildRetainerInvoicePayload({
              customerId,
              locationId: location?.zohoEntityId,
              referenceNumber: retainerReference,
              date: day(payment.verifiedAt),
              packageCode,
              totalConsideration: contract.totalConsideration.toFixed(2),
            }),
          },
        );
        candidate = response.retainerinvoice;
      }
      retainerId = candidate?.retainerinvoice_id == null
        ? undefined
        : String(candidate.retainerinvoice_id);
      if (!retainerId) {
        throw new ZohoApiError('Zoho tidak mengembalikan Retainer Invoice ID.', 'ZOHO_RETAINER_ID_MISSING', 502, true);
      }
      if (!candidate?.status || candidate.status.toLowerCase() === 'draft') {
        await client.request(`/books/v3/retainerinvoices/${retainerId}/status/sent`, { method: 'POST' });
      }
      retainerMap = await saveMapping({
        connectionId: client.connection.id,
        entityType: 'RETAINER_INVOICE',
        localEntityId: contract.id,
        zohoEntityType: 'RETAINER_INVOICE',
        zohoEntityId: retainerId,
        externalKey: retainerReference,
        metadata: {
          operation: retainerOperation,
          memberPackageId: movement.memberPackageId,
          packageCode,
          totalConsideration: contract.totalConsideration.toFixed(2),
        },
      });
    }

    const paymentReference = `RAHO-RETPAY:${movement.id}`;
    let retainerPaymentMap = await mapping(client.connection.id, 'RETAINER_PAYMENT', movement.id);
    let paymentOperation = 'ALREADY_MAPPED';
    if (!retainerPaymentMap) {
      let candidate = await findOne<ZohoPayment>(
        client,
        '/books/v3/customerpayments',
        'customerpayments',
        paymentReference,
      );
      paymentOperation = candidate ? 'RECOVER_EXISTING' : 'CREATE';
      if (!candidate) {
        const response = await client.request<{ payment?: ZohoPayment }>(
          '/books/v3/customerpayments',
          {
            method: 'POST',
            data: buildRetainerPaymentPayload({
              customerId,
              retainerInvoiceId: retainerId,
              accountId,
              locationId: location?.zohoEntityId,
              paymentMode,
              amount: movement.amount.toFixed(2),
              date: day(payment.verifiedAt),
              referenceNumber: paymentReference,
            }),
          },
        );
        candidate = response.payment;
      }
      const zohoPaymentId = candidate?.payment_id == null ? undefined : String(candidate.payment_id);
      if (!zohoPaymentId) {
        throw new ZohoApiError('Zoho tidak mengembalikan Retainer Payment ID.', 'ZOHO_RETAINER_PAYMENT_ID_MISSING', 502, true);
      }
      retainerPaymentMap = await saveMapping({
        connectionId: client.connection.id,
        entityType: 'RETAINER_PAYMENT',
        localEntityId: movement.id,
        zohoEntityType: 'CUSTOMER_PAYMENT',
        zohoEntityId: zohoPaymentId,
        externalKey: paymentReference,
        metadata: {
          operation: paymentOperation,
          retainerInvoiceId: retainerId,
          invoicePaymentId: payment.id,
          amount: movement.amount.toFixed(2),
        },
      });
    }
    results.push({
      contractId: contract.id,
      retainerInvoiceId: retainerMap.zohoEntityId,
      retainerPaymentId: retainerPaymentMap.zohoEntityId,
      retainerOperation,
      paymentOperation,
    });
  }
  return { operation: 'RETAINER_FUNDED', results };
}

async function treatmentDependencies(
  connectionId: string,
  payload: TreatmentCompletedEventPayload,
  recognition: TreatmentRecognitionSnapshot,
) {
  const [customer, location, item, contract] = await Promise.all([
    mapping(connectionId, 'MEMBER', payload.session.memberId),
    mapping(connectionId, 'BRANCH_LOCATION', payload.session.branchId),
    recognition.packagePricingId
      ? mapping(connectionId, 'PACKAGE_PRICING', recognition.packagePricingId)
      : null,
    prisma.packageRevenueContract.findUnique({
      where: { memberPackageId: recognition.memberPackageId },
    }),
  ]);
  const retainer = contract
    ? await mapping(connectionId, 'RETAINER_INVOICE', contract.id)
    : null;
  return { customer, location, item, contract, retainer };
}

async function handleDocumentRecognition(
  client: ZohoClient,
  payload: TreatmentCompletedEventPayload,
  recognition: TreatmentRecognitionSnapshot,
) {
  const deps = await treatmentDependencies(client.connection.id, payload, recognition);
  const customerId = requireId(deps.customer?.zohoEntityId, 'Mapping member Zoho belum tersedia.');
  const itemId = requireId(
    deps.item?.zohoEntityId,
    `Mapping item Zoho paket ${recognition.productCode || recognition.memberPackageId} belum tersedia.`,
  );
  const retainerId = requireId(
    deps.retainer?.zohoEntityId,
    'Retainer Invoice paket belum tersinkron. Proses ulang pembayaran paket terlebih dahulu.',
    'ZOHO_TREATMENT_WAITING_RETAINER',
  );
  const referenceNumber = `RAHO-SESSION:${payload.session.id}`;
  let invoiceMap = await mapping(client.connection.id, 'TREATMENT_REVENUE_INVOICE', payload.session.id);
  let invoiceId = invoiceMap?.zohoEntityId;
  let operation = 'ALREADY_MAPPED';
  if (!invoiceId) {
    let candidate = await findOne<ZohoInvoice>(client, '/books/v3/invoices', 'invoices', referenceNumber);
    operation = candidate ? 'RECOVER_EXISTING' : 'CREATE';
    if (!candidate) {
      const response = await client.request<{ invoice?: ZohoInvoice }>('/books/v3/invoices', {
        method: 'POST',
        data: buildTreatmentInvoicePayload({
          customerId,
          itemId,
          locationId: deps.location?.zohoEntityId,
          referenceNumber,
          date: day(payload.session.completedAt),
          sessionCode: payload.session.sessionCode,
          recognition,
        }),
      });
      candidate = response.invoice;
    }
    invoiceId = candidate?.invoice_id == null ? undefined : String(candidate.invoice_id);
    if (!invoiceId) {
      throw new ZohoApiError('Zoho tidak mengembalikan invoice terapi ID.', 'ZOHO_TREATMENT_INVOICE_ID_MISSING', 502, true);
    }
    if (!candidate?.status || candidate.status.toLowerCase() === 'draft') {
      await client.request(`/books/v3/invoices/${invoiceId}/status/sent`, { method: 'POST' });
    }
    invoiceMap = await saveMapping({
      connectionId: client.connection.id,
      entityType: 'TREATMENT_REVENUE_INVOICE',
      localEntityId: payload.session.id,
      zohoEntityType: 'INVOICE',
      zohoEntityId: invoiceId,
      externalKey: referenceNumber,
      metadata: {
        operation,
        recognitionId: recognition.recognitionId,
        memberPackageId: recognition.memberPackageId,
        sourceType: recognition.sourceType,
        amount: recognition.amount,
        retainerInvoiceId: retainerId,
      },
    });
  }

  const application = await mapping(client.connection.id, 'RETAINER_APPLICATION', recognition.recognitionId);
  if (!application) {
    await client.request(`/books/v3/retainerinvoices/${retainerId}/invoices`, {
      method: 'POST',
      data: buildRetainerApplicationPayload(invoiceId, recognition.amount, day(payload.session.completedAt)),
    });
    await saveMapping({
      connectionId: client.connection.id,
      entityType: 'RETAINER_APPLICATION',
      localEntityId: recognition.recognitionId,
      zohoEntityType: 'RETAINER_APPLICATION',
      zohoEntityId: `${retainerId}:${invoiceId}`,
      externalKey: `RAHO-RETAPP:${recognition.recognitionId}`,
      metadata: {
        retainerInvoiceId: retainerId,
        invoiceId,
        amount: recognition.amount,
        appliedAt: payload.session.completedAt,
      },
    });
  }
  return { operation, invoiceId: invoiceMap.zohoEntityId, retainerId };
}

async function handleJournalRecognition(
  client: ZohoClient,
  payload: TreatmentCompletedEventPayload,
  recognition: TreatmentRecognitionSnapshot,
) {
  const [customer, location, deferredAccount, revenueAccount] = await Promise.all([
    mapping(client.connection.id, 'MEMBER', payload.session.memberId),
    mapping(client.connection.id, 'BRANCH_LOCATION', payload.session.branchId),
    mapping(client.connection.id, 'GL_ACCOUNT', recognition.deferredRevenueAccountCode),
    mapping(client.connection.id, 'GL_ACCOUNT', recognition.revenueAccountCode),
  ]);
  const referenceNumber = `RAHO-SESSION:${payload.session.id}`;
  let journalMap = await mapping(client.connection.id, 'TREATMENT_REVENUE_JOURNAL', payload.session.id);
  if (journalMap) return { operation: 'ALREADY_MAPPED', journalId: journalMap.zohoEntityId };
  let candidate = await findOne<ZohoJournal>(client, '/books/v3/journals', 'journals', referenceNumber);
  const operation = candidate ? 'RECOVER_EXISTING' : 'CREATE';
  if (!candidate) {
    const response = await client.request<{ journal?: ZohoJournal }>('/books/v3/journals', {
      method: 'POST',
      data: buildTreatmentJournalPayload({
        referenceNumber,
        date: day(payload.session.completedAt),
        locationId: location?.zohoEntityId,
        deferredAccountId: requireId(deferredAccount?.zohoEntityId, `Mapping akun ${recognition.deferredRevenueAccountCode} belum tersedia.`),
        revenueAccountId: requireId(revenueAccount?.zohoEntityId, `Mapping akun ${recognition.revenueAccountCode} belum tersedia.`),
        customerId: customer?.zohoEntityId,
        sessionCode: payload.session.sessionCode,
        amount: recognition.amount,
      }),
    });
    candidate = response.journal;
  }
  const journalId = candidate?.journal_id == null ? undefined : String(candidate.journal_id);
  if (!journalId) throw new ZohoApiError('Zoho tidak mengembalikan journal ID.', 'ZOHO_TREATMENT_JOURNAL_ID_MISSING', 502, true);
  await saveMapping({
    connectionId: client.connection.id,
    entityType: 'TREATMENT_REVENUE_JOURNAL',
    localEntityId: payload.session.id,
    zohoEntityType: 'JOURNAL',
    zohoEntityId: journalId,
    externalKey: referenceNumber,
    metadata: { operation, recognitionId: recognition.recognitionId, amount: recognition.amount },
  });
  return { operation, journalId };
}

export async function handleTreatmentCompleted(event: IntegrationEvent) {
  const payload = event.payload as unknown as TreatmentCompletedEventPayload;
  const branch = await prisma.branch.findUnique({ where: { id: payload.session.branchId }, select: { type: true } });
  if (branch?.type === 'PARTNERSHIP') {
    return { operation: 'SKIP_PARTNERSHIP', reason: 'Partnership tidak mengakui omzet per infus.' };
  }
  if (payload.eventVersion !== 3) {
    throw new ZohoApiError('Event treatment harus versi 3.', 'ZOHO_TREATMENT_EVENT_VERSION_INVALID', 422, false);
  }
  if (payload.finance.recognitions.length === 0) {
    return { operation: 'SKIP_ZERO_REVENUE', reason: 'Sesi tidak memiliki revenue berbayar.' };
  }
  if (payload.finance.recognitions.length !== 1) {
    throw new ZohoApiError(
      'Satu sesi harus memiliki tepat satu recognition Basic atau Booster.',
      'ZOHO_TREATMENT_RECOGNITION_NOT_EXCLUSIVE',
      422,
      false,
    );
  }
  const recognition = payload.finance.recognitions[0];
  if (
    recognition.memberPackageId !== payload.session.revenuePackageId
    || recognition.sourceType !== payload.session.revenueSourceType
  ) {
    throw new ZohoApiError(
      'Recognition tidak cocok dengan sumber omzet sesi.',
      'ZOHO_TREATMENT_RECOGNITION_SOURCE_MISMATCH',
      422,
      false,
    );
  }
  const client = await getActiveZohoClient(true);
  return env.ZOHO_TREATMENT_REVENUE_MODE === 'JOURNAL'
    ? handleJournalRecognition(client, payload, recognition)
    : handleDocumentRecognition(client, payload, recognition);
}

export async function handleTreatmentCancellation(event: IntegrationEvent) {
  const payload = event.payload as {
    sessionId: string;
    branchId?: string;
  };
  const client = await getActiveZohoClient(true);
  const session = await prisma.treatmentSession.findUnique({
    where: { id: payload.sessionId || event.aggregateId },
    include: { branch: true },
  });
  if (!session) throw new ZohoApiError('Sesi pembatalan tidak ditemukan.', 'ZOHO_TREATMENT_SESSION_MISSING', 422, false);
  if (session.branch.type === 'PARTNERSHIP') return { operation: 'SKIP_PARTNERSHIP' };

  if (env.ZOHO_TREATMENT_REVENUE_MODE === 'JOURNAL') {
    const journalMap = await mapping(client.connection.id, 'TREATMENT_REVENUE_JOURNAL', session.id);
    const journalMetadata = (journalMap?.metadata || {}) as Record<string, unknown>;
    if (!journalMap || journalMetadata.reversedByEventId) return { operation: 'ALREADY_REVERSED' };
    await client.request(`/books/v3/journals/${journalMap.zohoEntityId}/reverse`, { method: 'POST' });
    await saveMapping({
      connectionId: client.connection.id,
      entityType: journalMap.entityType,
      localEntityId: journalMap.localEntityId,
      zohoEntityType: journalMap.zohoEntityType,
      zohoEntityId: journalMap.zohoEntityId,
      externalKey: journalMap.externalKey,
      metadata: { ...(journalMap.metadata as Record<string, unknown> || {}), reversedByEventId: event.id },
      status: ZohoMappingStatus.INACTIVE,
    });
    return { operation: 'REVERSE_JOURNAL', journalId: journalMap.zohoEntityId };
  }

  const invoiceMap = await mapping(client.connection.id, 'TREATMENT_REVENUE_INVOICE', session.id);
  if (!invoiceMap || ((invoiceMap.metadata || {}) as Record<string, unknown>).reversedByEventId) {
    return { operation: 'ALREADY_REVERSED' };
  }
  const metadata = (invoiceMap.metadata || {}) as Record<string, unknown>;
  const retainerId = String(metadata.retainerInvoiceId || '');
  if (!retainerId) {
    throw new ZohoApiError('Trace Retainer Invoice tidak ditemukan.', 'ZOHO_RETAINER_REVERSAL_TRACE_MISSING', 422, false);
  }
  await client.request(`/books/v3/retainerinvoices/${retainerId}/invoices/${invoiceMap.zohoEntityId}`, {
    method: 'DELETE',
  });
  await client.request(`/books/v3/invoices/${invoiceMap.zohoEntityId}/status/void`, { method: 'POST' });
  await saveMapping({
    connectionId: client.connection.id,
    entityType: invoiceMap.entityType,
    localEntityId: invoiceMap.localEntityId,
    zohoEntityType: invoiceMap.zohoEntityType,
    zohoEntityId: invoiceMap.zohoEntityId,
    externalKey: invoiceMap.externalKey,
    metadata: { ...metadata, reversedByEventId: event.id },
    status: ZohoMappingStatus.INACTIVE,
  });
  await prisma.zohoEntityMapping.updateMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: 'RETAINER_APPLICATION',
      metadata: { path: ['invoiceId'], equals: invoiceMap.zohoEntityId },
    },
    data: { status: ZohoMappingStatus.INACTIVE, lastSyncedAt: new Date() },
  });
  return { operation: 'UNAPPLY_AND_VOID', invoiceId: invoiceMap.zohoEntityId, retainerId };
}

export async function listRetainerRevenue(
  actorUserId: string,
  input: { page: number; limit: number; search?: string },
) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.PackageRevenueContractWhereInput = {
    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    ...(input.search ? {
      memberPackage: {
        OR: [
          { packageCode: { contains: input.search, mode: 'insensitive' } },
          { productCode: { contains: input.search, mode: 'insensitive' } },
          { member: { memberNo: { contains: input.search, mode: 'insensitive' } } },
        ],
      },
    } : {}),
  };
  const skip = (input.page - 1) * input.limit;
  const [contracts, total] = await prisma.$transaction([
    prisma.packageRevenueContract.findMany({
      where,
      include: {
        memberPackage: {
          include: {
            member: { include: { user: { include: { profile: true } } } },
            branch: true,
            packagePricing: true,
          },
        },
        recognitions: {
          orderBy: { recognizedAt: 'desc' },
          take: 10,
          include: { treatmentSession: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: input.limit,
    }),
    prisma.packageRevenueContract.count({ where }),
  ]);
  const contractIds = contracts.map((row) => row.id);
  const sessionIds = contracts.flatMap((row) => row.recognitions.map((recognition) => recognition.treatmentSessionId));
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connection.id,
      OR: [
        { entityType: 'RETAINER_INVOICE', localEntityId: { in: contractIds } },
        { entityType: { in: ['TREATMENT_REVENUE_INVOICE', 'TREATMENT_REVENUE_JOURNAL'] }, localEntityId: { in: sessionIds } },
      ],
    },
  });
  return {
    mode: env.ZOHO_TREATMENT_REVENUE_MODE,
    items: contracts.map((contract) => ({
      id: contract.id,
      packageCode: contract.memberPackage.packageCode,
      productCode: contract.memberPackage.productCode,
      packageType: contract.memberPackage.packageType,
      memberNo: contract.memberPackage.member.memberNo,
      memberName: contract.memberPackage.member.user.profile?.fullName
        || contract.memberPackage.member.user.email,
      branchCode: contract.memberPackage.branch.branchCode,
      totalConsideration: contract.totalConsideration.toFixed(2),
      fundedDeferredAmount: contract.fundedDeferredAmount.toFixed(2),
      recognizedAmount: contract.recognizedAmount.toFixed(2),
      remainingDeferredAmount: contract.remainingDeferredAmount.toFixed(2),
      status: contract.status,
      retainerMapping: mappings.find((entry) =>
        entry.entityType === 'RETAINER_INVOICE' && entry.localEntityId === contract.id) || null,
      recognitions: contract.recognitions.map((recognition) => ({
        id: recognition.id,
        sessionId: recognition.treatmentSessionId,
        sessionCode: recognition.treatmentSession.sessionCode,
        amount: recognition.amount.toFixed(2),
        status: recognition.status,
        recognizedAt: recognition.recognizedAt,
        zohoMapping: mappings.find((entry) => entry.localEntityId === recognition.treatmentSessionId
          && ['TREATMENT_REVENUE_INVOICE', 'TREATMENT_REVENUE_JOURNAL'].includes(entry.entityType)) || null,
      })),
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export async function reconcileRetainerRevenue(actorUserId: string) {
  const client = await getActiveZohoClient(true);
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const contracts = await prisma.packageRevenueContract.findMany({
    where: {
      memberPackage: { branch: { type: { not: 'PARTNERSHIP' } } },
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    },
    include: { memberPackage: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: 'RETAINER_INVOICE',
      localEntityId: { in: contracts.map((contract) => contract.id) },
      status: 'ACTIVE',
    },
  });
  const rows = await Promise.all(contracts.map(async (contract) => {
    const retainerMap = mappings.find((entry) => entry.localEntityId === contract.id);
    if (!retainerMap) {
      return {
        contractId: contract.id,
        packageCode: contract.memberPackage.packageCode,
        status: 'MISSING' as const,
        reasons: ['Mapping Retainer Invoice belum tersedia.'],
      };
    }
    const response = await client.request<{
      retainerinvoice?: { payment_made?: number; payment_drawn?: number; balance?: number; status?: string };
    }>(`/books/v3/retainerinvoices/${retainerMap.zohoEntityId}`);
    const retainer = response.retainerinvoice;
    const localFunded = contract.fundedDeferredAmount.toDecimalPlaces(2);
    const localRecognized = contract.recognizedAmount.toDecimalPlaces(2);
    const zohoFunded = new Prisma.Decimal(retainer?.payment_made || 0).toDecimalPlaces(2);
    const zohoDrawn = new Prisma.Decimal(retainer?.payment_drawn || 0).toDecimalPlaces(2);
    const reasons = [];
    if (!localFunded.equals(zohoFunded)) {
      reasons.push(`Pembayaran ERP ${localFunded.toFixed(2)} != Zoho ${zohoFunded.toFixed(2)}.`);
    }
    if (!localRecognized.equals(zohoDrawn)) {
      reasons.push(`Omzet ERP ${localRecognized.toFixed(2)} != retainer terpakai Zoho ${zohoDrawn.toFixed(2)}.`);
    }
    return {
      contractId: contract.id,
      packageCode: contract.memberPackage.packageCode,
      status: reasons.length ? 'MISMATCH' as const : 'MATCHED' as const,
      reasons,
      localFunded: localFunded.toFixed(2),
      localRecognized: localRecognized.toFixed(2),
      localRemaining: contract.remainingDeferredAmount.toFixed(2),
      zohoPaymentMade: zohoFunded.toFixed(2),
      zohoPaymentDrawn: zohoDrawn.toFixed(2),
      zohoBalance: retainer?.balance ?? null,
      zohoStatus: retainer?.status ?? null,
    };
  }));
  return {
    checked: rows.length,
    matched: rows.filter((row) => row.status === 'MATCHED').length,
    mismatched: rows.filter((row) => row.status === 'MISMATCH').length,
    missing: rows.filter((row) => row.status === 'MISSING').length,
    rows,
  };
}

export async function getRetainerConfig() {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const valuations = await prisma.packageBenefitValuation.findMany({
    select: { deferredRevenueAccountCode: true, revenueAccountCode: true },
  });
  const codes = [...new Set(valuations.flatMap((row) => [
    row.deferredRevenueAccountCode,
    row.revenueAccountCode,
  ]))].sort();
  const [accounts, mappings] = await Promise.all([
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'ACCOUNT', isActive: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    }),
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: 'GL_ACCOUNT', localEntityId: { in: codes } },
    }),
  ]);
  return {
    mode: env.ZOHO_TREATMENT_REVENUE_MODE,
    accounts: codes.map((code) => ({
      code,
      mapping: mappings.find((entry) => entry.localEntityId === code) || null,
    })),
    zohoAccounts: accounts,
  };
}

export async function saveGlAccountMapping(accountCode: string, zohoAccountId: string) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const [localAccount, discovered] = await Promise.all([
    prisma.account.findUnique({ where: { code: accountCode.toUpperCase() } }),
    prisma.zohoDiscoveryCache.findFirst({
      where: {
        zohoConnectionId: connection.id,
        resourceType: 'ACCOUNT',
        zohoId: zohoAccountId,
        isActive: true,
      },
    }),
  ]);
  if (!localAccount?.isActive || !localAccount.allowPosting) {
    throw new AppError(422, 'GL_ACCOUNT_INVALID', 'Akun ERP tidak aktif atau tidak dapat diposting.');
  }
  if (!discovered) throw new AppError(422, 'ZOHO_ACCOUNT_INVALID', 'Akun Zoho tidak ditemukan pada discovery aktif.');
  return saveMapping({
    connectionId: connection.id,
    entityType: 'GL_ACCOUNT',
    localEntityId: localAccount.code,
    zohoEntityType: 'ACCOUNT',
    zohoEntityId: discovered.zohoId,
    externalKey: `RAHO:GL:${localAccount.code}`,
    metadata: { name: discovered.name, code: discovered.code },
  });
}
