import { IntegrationEvent, IntegrationEventStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import {
  buildZohoCustomerPaymentPayload,
  buildZohoRefundPayload,
  paymentMethodMappingKey,
  reconcileReceivable,
  validatePaymentSnapshot,
  ZohoPaymentDependencies,
  ZohoPaymentRefundSnapshot,
  ZohoPaymentSnapshot,
} from './zoho.payment.policy';
import { handleRetainerFundingPayment } from './zoho.retainer.service';

export const PAYMENT_VERIFIED_EVENT = 'PAYMENT_VERIFIED';
export const PAYMENT_REFUNDED_EVENT = 'PAYMENT_REFUNDED';
type Tx = Prisma.TransactionClient;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

type PaymentForSnapshot = Prisma.InvoicePaymentGetPayload<{
  include: {
    invoice: {
      include: {
        branch: true;
        items: true;
      };
    };
  };
}>;

export function buildVerifiedPaymentSnapshot(
  payment: PaymentForSnapshot,
  previousVerifiedTotal: Prisma.Decimal,
  verifiedAt: Date,
): ZohoPaymentSnapshot {
  const classification = payment.invoice.items.some((line) => line.itemType === 'PACKAGE')
    ? 'THERAPY_ADVANCE'
    : 'NORMAL_SALE';
  const partnership = payment.invoice.branch.type === 'PARTNERSHIP';
  const eligible = !partnership && classification === 'NORMAL_SALE';
  const outstandingBefore = payment.invoice.totalAmount.minus(previousVerifiedTotal);
  return {
    localEntityId: payment.id,
    externalKey: `RAHO:PAYMENT:${payment.id}`,
    referenceNumber: `RAHO-PAY:${payment.id}`,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice.invoiceNumber,
    memberId: payment.invoice.memberId,
    branchId: payment.invoice.branchId,
    branchType: payment.invoice.branch.type,
    classification,
    eligible,
    excludedReason: partnership
      ? 'Pembayaran member cabang Partnership tidak dicatat sebagai omzet terapi di Zoho.'
      : classification === 'THERAPY_ADVANCE'
        ? 'Pembayaran paket adalah uang muka/deferred revenue dan diproses oleh flow retainer Sprint 7.'
        : null,
    amount: payment.amount.toFixed(2),
    paymentDate: day(verifiedAt),
    paymentMethod: payment.paymentMethod,
    cashBankAccountId: payment.cashBankAccountId!,
    paymentReference: payment.paymentReference,
    invoiceTotal: payment.invoice.totalAmount.toFixed(2),
    outstandingBefore: outstandingBefore.toFixed(2),
    outstandingAfter: outstandingBefore.minus(payment.amount).toFixed(2),
  };
}

export function buildPaymentRefundSnapshot(input: {
  refundId: string;
  refundNumber: string;
  payment: PaymentForSnapshot;
  amount: Prisma.Decimal;
  refundDate: Date;
  reason: string;
  cashBankAccountId: string;
  remainingAppliedAmountAfterRefund: Prisma.Decimal;
}): ZohoPaymentRefundSnapshot {
  const base = buildVerifiedPaymentSnapshot(input.payment, new Prisma.Decimal(0), input.refundDate);
  return {
    localEntityId: input.refundId,
    externalKey: `RAHO:PAYMENT_REFUND:${input.refundId}`,
    referenceNumber: input.refundNumber,
    originalPaymentId: input.payment.id,
    invoiceId: input.payment.invoiceId,
    invoiceNumber: input.payment.invoice.invoiceNumber,
    branchId: input.payment.invoice.branchId,
    branchType: input.payment.invoice.branch.type,
    classification: base.classification,
    eligible: base.eligible,
    excludedReason: base.excludedReason,
    amount: input.amount.toFixed(2),
    refundDate: day(input.refundDate),
    reason: input.reason,
    cashBankAccountId: input.cashBankAccountId,
    paymentMethod: input.payment.paymentMethod,
    remainingAppliedAmountAfterRefund: input.remainingAppliedAmountAfterRefund.toFixed(2),
  };
}

async function enqueueTx(
  tx: Tx,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  branchId: string,
  payload: unknown,
) {
  return tx.integrationEvent.upsert({
    where: { eventType_aggregateId: { eventType, aggregateId } },
    create: {
      eventType,
      eventVersion: 1,
      aggregateType,
      aggregateId,
      branchId,
      payload: json(payload),
      status: 'PENDING',
      occurredAt: new Date(),
    },
    update: {
      branchId,
      payload: json(payload),
      status: 'PENDING',
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt: new Date(),
    },
  });
}

export function enqueueVerifiedPaymentTx(tx: Tx, snapshot: ZohoPaymentSnapshot) {
  return enqueueTx(tx, PAYMENT_VERIFIED_EVENT, 'InvoicePayment', snapshot.localEntityId, snapshot.branchId, snapshot);
}

export function enqueuePaymentRefundTx(tx: Tx, snapshot: ZohoPaymentRefundSnapshot) {
  return enqueueTx(tx, PAYMENT_REFUNDED_EVENT, 'InvoicePaymentRefund', snapshot.localEntityId, snapshot.branchId, snapshot);
}

async function paymentDependencies(
  connectionId: string,
  snapshot: ZohoPaymentSnapshot,
): Promise<Partial<ZohoPaymentDependencies>> {
  const lookups = [
    { entityType: 'MEMBER', localEntityId: snapshot.memberId },
    { entityType: 'INVOICE', localEntityId: snapshot.invoiceId },
    { entityType: 'BRANCH_LOCATION', localEntityId: snapshot.branchId },
    { entityType: 'CASH_BANK_ACCOUNT', localEntityId: snapshot.cashBankAccountId },
    { entityType: 'PAYMENT_METHOD', localEntityId: paymentMethodMappingKey(snapshot.paymentMethod) },
  ];
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: { zohoConnectionId: connectionId, status: 'ACTIVE', OR: lookups },
  });
  const find = (entityType: string, localEntityId: string) =>
    mappings.find((mapping) =>
      mapping.entityType === entityType && mapping.localEntityId === localEntityId)?.zohoEntityId;
  return {
    customerId: find('MEMBER', snapshot.memberId),
    invoiceId: find('INVOICE', snapshot.invoiceId),
    locationId: find('BRANCH_LOCATION', snapshot.branchId),
    accountId: find('CASH_BANK_ACCOUNT', snapshot.cashBankAccountId),
    paymentMode: find('PAYMENT_METHOD', paymentMethodMappingKey(snapshot.paymentMethod)),
  };
}

type ZohoCustomerPayment = {
  payment_id?: string | number;
  reference_number?: string;
  amount?: number;
  invoices?: Array<{
    invoice_id?: string | number;
    invoice_payment_id?: string | number;
    amount_applied?: number;
    balance_amount?: number;
  }>;
};

async function findExistingPayment(client: ZohoClient, referenceNumber: string) {
  const rows = await client.listAll<ZohoCustomerPayment>(
    '/books/v3/customerpayments',
    'customerpayments',
    { reference_number: referenceNumber },
  );
  return rows.filter((row) => row.reference_number === referenceNumber);
}

async function savePaymentMapping(
  connectionId: string,
  snapshot: ZohoPaymentSnapshot,
  payment: ZohoCustomerPayment,
  operation: string,
) {
  const zohoId = String(payment.payment_id);
  const application = payment.invoices?.find(Boolean);
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connectionId,
        entityType: 'PAYMENT',
        localEntityId: snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: connectionId,
      entityType: 'PAYMENT',
      localEntityId: snapshot.localEntityId,
      zohoEntityType: 'CUSTOMER_PAYMENT',
      zohoEntityId: zohoId,
      externalKey: snapshot.externalKey,
      status: 'ACTIVE',
      metadata: json({
        operation,
        referenceNumber: snapshot.referenceNumber,
        invoiceId: snapshot.invoiceId,
        zohoInvoicePaymentId: application?.invoice_payment_id == null
          ? null
          : String(application.invoice_payment_id),
        amountApplied: snapshot.amount,
        balanceAmount: application?.balance_amount ?? snapshot.outstandingAfter,
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: zohoId,
      status: 'ACTIVE',
      metadata: json({
        operation,
        referenceNumber: snapshot.referenceNumber,
        invoiceId: snapshot.invoiceId,
        zohoInvoicePaymentId: application?.invoice_payment_id == null
          ? null
          : String(application.invoice_payment_id),
        amountApplied: snapshot.amount,
        balanceAmount: application?.balance_amount ?? snapshot.outstandingAfter,
      }),
      lastSyncedAt: new Date(),
    },
  });
}

async function handleVerifiedPayment(event: IntegrationEvent) {
  const snapshot = event.payload as unknown as ZohoPaymentSnapshot;
  if (snapshot.classification === 'THERAPY_ADVANCE' && snapshot.branchType !== 'PARTNERSHIP') {
    return handleRetainerFundingPayment(snapshot.localEntityId);
  }
  if (!snapshot.eligible) {
    return { operation: 'SKIP_POLICY', classification: snapshot.classification, reason: snapshot.excludedReason };
  }
  const client = await getActiveZohoClient(true);
  const mapped = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'PAYMENT',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (mapped) return { operation: 'ALREADY_MAPPED', zohoId: mapped.zohoEntityId };

  const resolved = await paymentDependencies(client.connection.id, snapshot);
  const issues = validatePaymentSnapshot(snapshot, resolved);
  if (issues.length) {
    const invoiceWaiting = !resolved.invoiceId && await prisma.integrationEvent.findFirst({
      where: {
        aggregateId: snapshot.invoiceId,
        eventType: 'INVOICE_FINALIZED',
        status: { in: [IntegrationEventStatus.PENDING, IntegrationEventStatus.PROCESSING] },
      },
    });
    throw new ZohoApiError(
      issues.join(' '),
      invoiceWaiting ? 'ZOHO_PAYMENT_WAITING_INVOICE' : 'ZOHO_PAYMENT_NEEDS_ACTION',
      422,
      Boolean(invoiceWaiting),
      invoiceWaiting ? 5_000 : undefined,
    );
  }
  const matches = await findExistingPayment(client, snapshot.referenceNumber);
  if (matches.length > 1) {
    throw new ZohoApiError('Referensi pembayaran ditemukan lebih dari sekali di Zoho.', 'ZOHO_PAYMENT_AMBIGUOUS', 409, false);
  }
  let payment = matches[0];
  let operation = 'RECOVER_EXISTING';
  if (!payment) {
    const response = await client.request<{ payment?: ZohoCustomerPayment }>(
      '/books/v3/customerpayments',
      {
        method: 'POST',
        data: buildZohoCustomerPaymentPayload(snapshot, resolved as ZohoPaymentDependencies),
      },
    );
    payment = response.payment;
    operation = 'CREATE';
  }
  if (payment?.payment_id == null) {
    throw new ZohoApiError('Zoho tidak mengembalikan customer payment ID.', 'ZOHO_PAYMENT_ID_MISSING', 502, true);
  }
  if (!payment.invoices?.length) {
    const detail = await client.request<{ payment?: ZohoCustomerPayment }>(
      `/books/v3/customerpayments/${payment.payment_id}`,
    );
    payment = { ...payment, ...detail.payment };
  }
  await savePaymentMapping(client.connection.id, snapshot, payment, operation);
  return { operation, zohoId: String(payment.payment_id) };
}

type RefundCandidate = { refund_id?: string | number; reference_number?: string; amount?: number };

function mappingMetadata(mapping: { metadata: Prisma.JsonValue | null }) {
  return (mapping.metadata || {}) as Record<string, unknown>;
}

async function handlePaymentRefund(event: IntegrationEvent) {
  const snapshot = event.payload as unknown as ZohoPaymentRefundSnapshot;
  if (!snapshot.eligible) return { operation: 'SKIP_POLICY', reason: snapshot.excludedReason };
  const client = await getActiveZohoClient(true);
  const existingMapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'PAYMENT_REFUND',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (existingMapping) return { operation: 'ALREADY_MAPPED', zohoId: existingMapping.zohoEntityId };

  const [paymentMapping, invoiceMapping, bankMapping, methodMapping] = await Promise.all([
    prisma.zohoEntityMapping.findUnique({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: client.connection.id,
          entityType: 'PAYMENT',
          localEntityId: snapshot.originalPaymentId,
        },
      },
    }),
    prisma.zohoEntityMapping.findUnique({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: client.connection.id,
          entityType: 'INVOICE',
          localEntityId: snapshot.invoiceId,
        },
      },
    }),
    prisma.zohoEntityMapping.findUnique({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: client.connection.id,
          entityType: 'CASH_BANK_ACCOUNT',
          localEntityId: snapshot.cashBankAccountId,
        },
      },
    }),
    prisma.zohoEntityMapping.findUnique({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: client.connection.id,
          entityType: 'PAYMENT_METHOD',
          localEntityId: paymentMethodMappingKey(snapshot.paymentMethod),
        },
      },
    }),
  ]);
  if (!paymentMapping || !invoiceMapping || !bankMapping || !methodMapping) {
    throw new ZohoApiError(
      'Mapping pembayaran asli, invoice, rekening, atau metode refund belum lengkap.',
      'ZOHO_REFUND_NEEDS_ACTION',
      422,
      false,
    );
  }

  const paymentId = paymentMapping.zohoEntityId;
  const refunds = await client.listAll<RefundCandidate>(
    `/books/v3/customerpayments/${paymentId}/refunds`,
    'refunds',
  );
  let refund = refunds.find((row) => row.reference_number === snapshot.referenceNumber);
  const operation = refund ? 'RECOVER_EXISTING' : 'REFUND';
  const paymentDetail = await client.request<{ payment?: ZohoCustomerPayment }>(
    `/books/v3/customerpayments/${paymentId}`,
  );
  const applied = paymentDetail.payment?.invoices?.find(
    (entry) => String(entry.invoice_id) === invoiceMapping.zohoEntityId,
  );
  const currentApplied = new Prisma.Decimal(applied?.amount_applied || 0);
  const targetApplied = new Prisma.Decimal(snapshot.remainingAppliedAmountAfterRefund);

  if (!refund) {
    const invoicePaymentId = applied?.invoice_payment_id
      ?? mappingMetadata(paymentMapping).zohoInvoicePaymentId;
    if (currentApplied.greaterThan(0)) {
      if (!invoicePaymentId) {
        throw new ZohoApiError('ID aplikasi pembayaran invoice Zoho tidak ditemukan.', 'ZOHO_REFUND_APPLICATION_MISSING', 422, false);
      }
      await client.request(
        `/books/v3/invoices/${invoiceMapping.zohoEntityId}/payments/${invoicePaymentId}`,
        { method: 'DELETE' },
      );
    }
    const response = await client.request<{ refund?: RefundCandidate }>(
      `/books/v3/customerpayments/${paymentId}/refunds`,
      {
        method: 'POST',
        data: buildZohoRefundPayload(snapshot, bankMapping.zohoEntityId, methodMapping.zohoEntityId),
      },
    );
    refund = response.refund;
  }
  if (refund?.refund_id == null) {
    throw new ZohoApiError('Zoho tidak mengembalikan refund ID.', 'ZOHO_REFUND_ID_MISSING', 502, true);
  }

  const refreshed = await client.request<{ payment?: ZohoCustomerPayment }>(
    `/books/v3/customerpayments/${paymentId}`,
  );
  const refreshedApplied = new Prisma.Decimal(
    refreshed.payment?.invoices?.find(
      (entry) => String(entry.invoice_id) === invoiceMapping.zohoEntityId,
    )?.amount_applied || 0,
  );
  if (targetApplied.greaterThan(0) && refreshedApplied.equals(0)) {
    await client.request(`/books/v3/invoices/${invoiceMapping.zohoEntityId}/credits`, {
      method: 'POST',
      data: {
        invoice_payments: [{ payment_id: paymentId, amount_applied: Number(targetApplied.toFixed(2)) }],
        apply_creditnotes: [],
      },
    });
  } else if (!refreshedApplied.equals(targetApplied)) {
    throw new ZohoApiError(
      `Aplikasi pembayaran Zoho ${refreshedApplied.toFixed(2)} tidak sama dengan target ERP ${targetApplied.toFixed(2)}.`,
      'ZOHO_REFUND_APPLICATION_MISMATCH',
      409,
      false,
    );
  }

  await prisma.zohoEntityMapping.create({
    data: {
      zohoConnectionId: client.connection.id,
      entityType: 'PAYMENT_REFUND',
      localEntityId: snapshot.localEntityId,
      zohoEntityType: 'CUSTOMER_PAYMENT_REFUND',
      zohoEntityId: String(refund.refund_id),
      externalKey: snapshot.externalKey,
      status: 'ACTIVE',
      metadata: json({
        operation,
        originalPaymentId: snapshot.originalPaymentId,
        amount: snapshot.amount,
        remainingAppliedAmount: snapshot.remainingAppliedAmountAfterRefund,
      }),
      lastSyncedAt: new Date(),
    },
  });
  return { operation, zohoId: String(refund.refund_id) };
}

export async function handlePaymentEvent(event: IntegrationEvent) {
  return event.eventType === PAYMENT_REFUNDED_EVENT
    ? handlePaymentRefund(event)
    : handleVerifiedPayment(event);
}

async function persistedPaymentSnapshot(paymentId: string): Promise<ZohoPaymentSnapshot> {
  const event = await prisma.integrationEvent.findUnique({
    where: { eventType_aggregateId: { eventType: PAYMENT_VERIFIED_EVENT, aggregateId: paymentId } },
  });
  if (event) return event.payload as unknown as ZohoPaymentSnapshot;
  const payment = await prisma.invoicePayment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { branch: true, items: true } } },
  });
  if (!payment || payment.verificationStatus !== 'VERIFIED' || !payment.verifiedAt) {
    throw new AppError(422, 'PAYMENT_NOT_VERIFIED', 'Hanya pembayaran terverifikasi yang dapat disinkronkan.');
  }
  const previous = await prisma.invoicePayment.aggregate({
    where: {
      invoiceId: payment.invoiceId,
      verificationStatus: 'VERIFIED',
      verifiedAt: { lt: payment.verifiedAt },
    },
    _sum: { amount: true },
  });
  return buildVerifiedPaymentSnapshot(payment, previous._sum.amount || new Prisma.Decimal(0), payment.verifiedAt);
}

export async function previewPayment(paymentId: string) {
  const snapshot = await persistedPaymentSnapshot(paymentId);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  const resolved = connection ? await paymentDependencies(connection.id, snapshot) : {};
  const issues = validatePaymentSnapshot(snapshot, resolved);
  return {
    snapshot,
    issues,
    payload: snapshot.eligible && !issues.length
      ? buildZohoCustomerPaymentPayload(snapshot, resolved as ZohoPaymentDependencies)
      : null,
    liveReady: snapshot.eligible && !issues.length,
  };
}

export async function enqueuePayment(paymentId: string) {
  const snapshot = await persistedPaymentSnapshot(paymentId);
  const current = await prisma.integrationEvent.findUnique({
    where: { eventType_aggregateId: { eventType: PAYMENT_VERIFIED_EVENT, aggregateId: paymentId } },
  });
  if (current?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_PAYMENT_SYNC_IN_PROGRESS', 'Pembayaran sedang diproses worker.');
  }
  return prisma.$transaction((tx) => enqueueVerifiedPaymentTx(tx, snapshot));
}

export async function listPaymentMappings(
  actorUserId: string,
  input: { page: number; limit: number; search?: string },
) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.InvoicePaymentWhereInput = {
    verificationStatus: 'VERIFIED',
    ...(branchIds === null ? {} : { invoice: { branchId: { in: branchIds } } }),
    ...(input.search ? {
      OR: [
        { paymentReference: { contains: input.search, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: input.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const skip = (input.page - 1) * input.limit;
  const [rows, total] = await prisma.$transaction([
    prisma.invoicePayment.findMany({
      where,
      include: {
        invoice: { include: { branch: true, items: true } },
        cashBankAccount: true,
        refunds: true,
      },
      orderBy: { verifiedAt: 'desc' },
      skip,
      take: input.limit,
    }),
    prisma.invoicePayment.count({ where }),
  ]);
  const ids = rows.map((row) => row.id);
  const refundIds = rows.flatMap((row) => row.refunds.map((refund) => refund.id));
  const [mappings, events] = await Promise.all([
    prisma.zohoEntityMapping.findMany({
      where: {
        zohoConnectionId: connection.id,
        OR: [
          { entityType: 'PAYMENT', localEntityId: { in: ids } },
          { entityType: 'PAYMENT_REFUND', localEntityId: { in: refundIds } },
        ],
      },
    }),
    prisma.integrationEvent.findMany({
      where: {
        OR: [
          { eventType: PAYMENT_VERIFIED_EVENT, aggregateId: { in: ids } },
          { eventType: PAYMENT_REFUNDED_EVENT, aggregateId: { in: refundIds } },
        ],
      },
    }),
  ]);
  return {
    items: rows.map((row) => {
      const classification = row.invoice.items.some((line) => line.itemType === 'PACKAGE')
        ? 'THERAPY_ADVANCE'
        : 'NORMAL_SALE';
      return {
        id: row.id,
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoice.invoiceNumber,
        branchCode: row.invoice.branch.branchCode,
        branchType: row.invoice.branch.type,
        classification,
        eligible: row.invoice.branch.type !== 'PARTNERSHIP' && classification === 'NORMAL_SALE',
        amount: row.amount.toFixed(2),
        paymentMethod: row.paymentMethod,
        accountName: row.cashBankAccount?.name || null,
        verifiedAt: row.verifiedAt,
        mapping: mappings.find((entry) => entry.entityType === 'PAYMENT' && entry.localEntityId === row.id) || null,
        event: events.find((entry) => entry.eventType === PAYMENT_VERIFIED_EVENT && entry.aggregateId === row.id) || null,
        refunds: row.refunds.map((refund) => ({
          ...refund,
          amount: refund.amount.toFixed(2),
          mapping: mappings.find((entry) => entry.entityType === 'PAYMENT_REFUND' && entry.localEntityId === refund.id) || null,
          event: events.find((entry) => entry.eventType === PAYMENT_REFUNDED_EVENT && entry.aggregateId === refund.id) || null,
        })),
      };
    }),
    pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
  };
}

export async function getPaymentConfig(actorUserId: string) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const [accounts, zohoAccounts, modes, mappings] = await Promise.all([
    prisma.cashBankAccount.findMany({
      where: { isActive: true, ...(branchIds === null ? {} : { branchId: { in: branchIds } }) },
      include: { branch: { select: { branchCode: true, name: true } } },
      orderBy: { code: 'asc' },
    }),
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'BANK_ACCOUNT', isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'PAYMENT_MODE', isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: { in: ['CASH_BANK_ACCOUNT', 'PAYMENT_METHOD'] } },
    }),
  ]);
  return {
    cashBankAccounts: accounts.map((account) => ({
      ...account,
      mapping: mappings.find((entry) =>
        entry.entityType === 'CASH_BANK_ACCOUNT' && entry.localEntityId === account.id) || null,
    })),
    paymentMethods: ['CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER'].map((method) => ({
      method,
      mapping: mappings.find((entry) =>
        entry.entityType === 'PAYMENT_METHOD' && entry.localEntityId === paymentMethodMappingKey(method)) || null,
    })),
    zohoAccounts,
    modes,
  };
}

async function saveConfigMapping(
  actorUserId: string,
  entityType: 'CASH_BANK_ACCOUNT' | 'PAYMENT_METHOD',
  localEntityId: string,
  resourceType: 'BANK_ACCOUNT' | 'PAYMENT_MODE',
  zohoId: string,
) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  if (entityType === 'CASH_BANK_ACCOUNT') {
    const account = await prisma.cashBankAccount.findUnique({ where: { id: localEntityId } });
    if (!account?.isActive) throw new AppError(422, 'CASH_BANK_ACCOUNT_INVALID', 'Rekening ERP tidak aktif.');
    const branches = await getAccessibleBranchIds(actorUserId);
    if (branches !== null && !branches.includes(account.branchId)) {
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Rekening berada di luar akses cabang Anda.');
    }
  }
  const discovered = await prisma.zohoDiscoveryCache.findFirst({
    where: { zohoConnectionId: connection.id, resourceType, zohoId, isActive: true },
  });
  if (!discovered) throw new AppError(422, 'ZOHO_CONFIG_INVALID', 'Data konfigurasi Zoho tidak ditemukan pada discovery aktif.');
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connection.id,
        entityType,
        localEntityId,
      },
    },
    create: {
      zohoConnectionId: connection.id,
      entityType,
      localEntityId,
      zohoEntityType: resourceType,
      zohoEntityId: zohoId,
      externalKey: localEntityId,
      status: 'ACTIVE',
      metadata: { name: discovered.name, code: discovered.code },
    },
    update: {
      zohoEntityType: resourceType,
      zohoEntityId: zohoId,
      status: 'ACTIVE',
      metadata: { name: discovered.name, code: discovered.code },
    },
  });
}

export function saveCashBankMapping(actorUserId: string, accountId: string, zohoAccountId: string) {
  return saveConfigMapping(actorUserId, 'CASH_BANK_ACCOUNT', accountId, 'BANK_ACCOUNT', zohoAccountId);
}

export function savePaymentMethodMapping(actorUserId: string, method: string, zohoMode: string) {
  const allowed = ['CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER'];
  if (!allowed.includes(method)) throw new AppError(400, 'PAYMENT_METHOD_INVALID', 'Metode pembayaran ERP tidak valid.');
  return saveConfigMapping(
    actorUserId,
    'PAYMENT_METHOD',
    paymentMethodMappingKey(method),
    'PAYMENT_MODE',
    zohoMode,
  );
}

export async function reconcilePayments(actorUserId: string) {
  const client = await getActiveZohoClient(true);
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { not: 'DRAFT' },
      branch: { type: { not: 'PARTNERSHIP' } },
      items: { none: { itemType: 'PACKAGE' } },
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    },
    include: {
      payments: { where: { verificationStatus: 'VERIFIED' }, include: { refunds: { where: { status: 'POSTED' } } } },
    },
    orderBy: { finalizedAt: 'desc' },
    take: 100,
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: 'INVOICE',
      localEntityId: { in: invoices.map((invoice) => invoice.id) },
      status: 'ACTIVE',
    },
  });
  const rows = await Promise.all(invoices.map(async (invoice) => {
    const mapping = mappings.find((entry) => entry.localEntityId === invoice.id);
    if (!mapping) {
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        result: { status: 'MISSING' as const, reasons: ['Mapping invoice Zoho belum tersedia.'] },
      };
    }
    const response = await client.request<{
      invoice?: { total?: number; balance?: number; status?: string };
    }>(`/books/v3/invoices/${mapping.zohoEntityId}`);
    const netPaid = invoice.payments.reduce(
      (sum, payment) => sum.plus(payment.amount).minus(
        payment.refunds.reduce((refundSum, refund) => refundSum.plus(refund.amount), new Prisma.Decimal(0)),
      ),
      new Prisma.Decimal(0),
    );
    const localBalance = Prisma.Decimal.max(new Prisma.Decimal(0), invoice.totalAmount.minus(netPaid));
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      localTotal: invoice.totalAmount.toFixed(2),
      localBalance: localBalance.toFixed(2),
      zohoTotal: response.invoice?.total ?? null,
      zohoBalance: response.invoice?.balance ?? null,
      zohoStatus: response.invoice?.status ?? null,
      result: reconcileReceivable({
        localTotal: invoice.totalAmount.toFixed(2),
        localBalance: localBalance.toFixed(2),
        localStatus: invoice.status,
        zohoTotal: response.invoice?.total,
        zohoBalance: response.invoice?.balance,
        zohoStatus: response.invoice?.status,
      }),
    };
  }));
  return {
    checked: rows.length,
    matched: rows.filter((row) => row.result.status === 'MATCHED').length,
    mismatched: rows.filter((row) => row.result.status === 'MISMATCH').length,
    missing: rows.filter((row) => row.result.status === 'MISSING').length,
    rows,
  };
}
