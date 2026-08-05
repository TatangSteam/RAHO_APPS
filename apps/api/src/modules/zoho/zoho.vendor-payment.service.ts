import {
  IntegrationEvent,
  IntegrationEventStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  getAccessibleBranchIds,
} from '@modules/iam/authorization.service';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import { assertErpManaged, assertRemoteErpOrigin } from './zoho.origin';
import { getPaymentConfig } from './zoho.payment.service';
import { reconcileBills } from './zoho.bill.service';
import { stablePayloadHash } from './zoho.sanitizer';
import {
  AP_PAYMENT_POSTED_EVENT,
  AP_PAYMENT_REFUNDED_EVENT,
  buildZohoVendorPaymentPayload,
  buildZohoVendorPaymentRefundPayload,
  reconcileVendorPayment,
  validateVendorPaymentSnapshot,
  vendorPaymentMethodMappingKey,
  ZohoVendorPaymentDependencies,
  ZohoVendorPaymentRemote,
  ZohoVendorPaymentRefundSnapshot,
  ZohoVendorPaymentSnapshot,
} from './zoho.vendor-payment.policy';

type Tx = Prisma.TransactionClient;
type SupplierPaymentSource = Prisma.SupplierPaymentGetPayload<{
  include: {
    cashBankAccount: true;
    supplierInvoice: {
      include: {
        supplier: true;
        branch: true;
      };
    };
  };
}>;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildSupplierPaymentSnapshot(
  payment: SupplierPaymentSource,
  outstandingBefore: Prisma.Decimal.Value,
  outstandingAfter: Prisma.Decimal.Value,
): ZohoVendorPaymentSnapshot {
  const eligible = payment.supplierInvoice.branch.type !== 'PARTNERSHIP';
  return {
    localEntityId: payment.id,
    externalKey: `RAHO:SUPPLIER_PAYMENT:${payment.id}`,
    referenceNumber: payment.paymentNumber,
    paymentNumber: payment.paymentNumber,
    supplierInvoiceId: payment.supplierInvoiceId,
    invoiceNumber: payment.supplierInvoice.invoiceNumber,
    supplierInvoiceNumber: payment.supplierInvoice.supplierInvoiceNumber,
    supplierId: payment.supplierInvoice.supplierId,
    branchId: payment.branchId,
    branchType: payment.supplierInvoice.branch.type,
    cashBankAccountId: payment.cashBankAccountId,
    paymentMethod: payment.cashBankAccount.type === 'CASH' ? 'CASH' : 'TRANSFER',
    paymentDate: day(payment.paymentDate),
    paymentReference: payment.paymentReference,
    amount: payment.amount.toFixed(2),
    outstandingBefore: new Prisma.Decimal(outstandingBefore).toFixed(2),
    outstandingAfter: new Prisma.Decimal(outstandingAfter).toFixed(2),
    eligible,
    excludedReason: eligible
      ? null
      : 'Pembayaran supplier cabang Partnership tidak dicatat sebagai AP internal di Zoho.',
  };
}

export function enqueueSupplierPaymentPostedTx(
  tx: Tx,
  snapshot: ZohoVendorPaymentSnapshot,
  occurredAt: Date,
) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: AP_PAYMENT_POSTED_EVENT,
        aggregateId: snapshot.localEntityId,
      },
    },
    create: {
      eventType: AP_PAYMENT_POSTED_EVENT,
      eventVersion: 1,
      aggregateType: 'SupplierPayment',
      aggregateId: snapshot.localEntityId,
      branchId: snapshot.branchId,
      payload: json(snapshot),
      payloadHash: stablePayloadHash(snapshot),
      status: IntegrationEventStatus.PENDING,
      occurredAt,
    },
    update: {
      branchId: snapshot.branchId,
      payload: json(snapshot),
      payloadHash: stablePayloadHash(snapshot),
      status: IntegrationEventStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      ignoredAt: null,
      ignoredById: null,
      ignoreReason: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt,
    },
  });
}

export function enqueueSupplierPaymentRefundedTx(
  tx: Tx,
  snapshot: ZohoVendorPaymentRefundSnapshot,
  occurredAt: Date,
) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: AP_PAYMENT_REFUNDED_EVENT,
        aggregateId: snapshot.localEntityId,
      },
    },
    create: {
      eventType: AP_PAYMENT_REFUNDED_EVENT,
      eventVersion: 1,
      aggregateType: 'SupplierPaymentRefund',
      aggregateId: snapshot.localEntityId,
      branchId: snapshot.branchId,
      payload: json(snapshot),
      payloadHash: stablePayloadHash(snapshot),
      status: IntegrationEventStatus.PENDING,
      occurredAt,
    },
    update: {
      branchId: snapshot.branchId,
      payload: json(snapshot),
      payloadHash: stablePayloadHash(snapshot),
      status: IntegrationEventStatus.PENDING,
      attempts: 0,
      availableAt: new Date(),
      processedAt: null,
      deadLetteredAt: null,
      ignoredAt: null,
      ignoredById: null,
      ignoreReason: null,
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt,
    },
  });
}

export function buildSupplierPaymentRefundSnapshot(input: {
  refund: {
    id: string;
    refundNumber: string;
    supplierPaymentId: string;
    supplierInvoiceId: string;
    cashBankAccountId: string;
    branchId: string;
    refundDate: Date;
    amount: Prisma.Decimal;
    reason: string;
  };
  payment: SupplierPaymentSource;
  remainingAppliedAmountAfterRefund: Prisma.Decimal;
}): ZohoVendorPaymentRefundSnapshot {
  const eligible = input.payment.supplierInvoice.branch.type !== 'PARTNERSHIP';
  return {
    localEntityId: input.refund.id,
    externalKey: `RAHO:SUPPLIER_PAYMENT_REFUND:${input.refund.id}`,
    referenceNumber: input.refund.refundNumber,
    originalSupplierPaymentId: input.refund.supplierPaymentId,
    supplierInvoiceId: input.refund.supplierInvoiceId,
    invoiceNumber: input.payment.supplierInvoice.invoiceNumber,
    branchId: input.refund.branchId,
    branchType: input.payment.supplierInvoice.branch.type,
    cashBankAccountId: input.refund.cashBankAccountId,
    paymentMethod: input.payment.cashBankAccount.type === 'CASH' ? 'CASH' : 'TRANSFER',
    refundDate: day(input.refund.refundDate),
    amount: input.refund.amount.toFixed(2),
    reason: input.refund.reason,
    originalPaymentAmount: input.payment.amount.toFixed(2),
    remainingAppliedAmountAfterRefund:
      input.remainingAppliedAmountAfterRefund.toFixed(2),
    eligible,
    excludedReason: eligible
      ? null
      : 'Refund pembayaran supplier Partnership tidak dicatat sebagai AP internal di Zoho.',
  };
}

async function dependencies(
  connectionId: string,
  snapshot: ZohoVendorPaymentSnapshot,
): Promise<Partial<ZohoVendorPaymentDependencies>> {
  const lookups = [
    { entityType: 'SUPPLIER', localEntityId: snapshot.supplierId },
    { entityType: 'SUPPLIER_INVOICE', localEntityId: snapshot.supplierInvoiceId },
    { entityType: 'CASH_BANK_ACCOUNT', localEntityId: snapshot.cashBankAccountId },
    {
      entityType: 'PAYMENT_METHOD',
      localEntityId: vendorPaymentMethodMappingKey(snapshot.paymentMethod),
    },
  ];
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: lookups,
    },
  });
  const find = (entityType: string, localEntityId: string) =>
    mappings.find((entry) =>
      entry.entityType === entityType && entry.localEntityId === localEntityId)?.zohoEntityId;
  return {
    vendorId: find('SUPPLIER', snapshot.supplierId),
    billId: find('SUPPLIER_INVOICE', snapshot.supplierInvoiceId),
    paidThroughAccountId: find('CASH_BANK_ACCOUNT', snapshot.cashBankAccountId),
    paymentMode: find(
      'PAYMENT_METHOD',
      vendorPaymentMethodMappingKey(snapshot.paymentMethod),
    ),
  };
}

async function findExisting(
  client: ZohoClient,
  referenceNumber: string,
): Promise<ZohoVendorPaymentRemote[]> {
  const rows = await client.listAll<ZohoVendorPaymentRemote>(
    '/books/v3/vendorpayments',
    'vendorpayments',
    { reference_number: referenceNumber },
  );
  return rows.filter((row) => row.reference_number === referenceNumber);
}

async function saveMapping(input: {
  connectionId: string;
  snapshot: ZohoVendorPaymentSnapshot;
  remote: ZohoVendorPaymentRemote;
  operation: string;
}) {
  const zohoId = String(input.remote.payment_id);
  const application = input.remote.bills?.find(Boolean);
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: input.connectionId,
        entityType: 'SUPPLIER_PAYMENT',
        localEntityId: input.snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: input.connectionId,
      entityType: 'SUPPLIER_PAYMENT',
      localEntityId: input.snapshot.localEntityId,
      zohoEntityType: 'VENDOR_PAYMENT',
      zohoEntityId: zohoId,
      externalKey: input.snapshot.externalKey,
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        referenceNumber: input.snapshot.referenceNumber,
        supplierInvoiceId: input.snapshot.supplierInvoiceId,
        zohoBillPaymentId: application?.bill_payment_id == null
          ? null
          : String(application.bill_payment_id),
        amountApplied: input.snapshot.amount,
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: zohoId,
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: json({
        operation: input.operation,
        referenceNumber: input.snapshot.referenceNumber,
        supplierInvoiceId: input.snapshot.supplierInvoiceId,
        zohoBillPaymentId: application?.bill_payment_id == null
          ? null
          : String(application.bill_payment_id),
        amountApplied: input.snapshot.amount,
      }),
      lastSyncedAt: new Date(),
    },
  });
}

export async function handleSupplierPaymentPosted(event: IntegrationEvent) {
  if (
    event.eventType !== AP_PAYMENT_POSTED_EVENT
    || event.eventVersion !== 1
    || event.aggregateType !== 'SupplierPayment'
  ) {
    throw new ZohoApiError(
      'Kontrak event vendor payment tidak didukung.',
      'ZOHO_VENDOR_PAYMENT_EVENT_UNSUPPORTED',
      422,
      false,
    );
  }
  const snapshot = event.payload as unknown as ZohoVendorPaymentSnapshot;
  if (!snapshot.eligible) {
    return { operation: 'SKIP_POLICY', reason: snapshot.excludedReason };
  }
  const client = await getActiveZohoClient(true);
  const existingMapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'SUPPLIER_PAYMENT',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (existingMapping) {
    assertErpManaged(existingMapping, 'Vendor Payment Zoho');
    return { operation: 'ALREADY_MAPPED', zohoPaymentId: existingMapping.zohoEntityId };
  }
  const resolved = await dependencies(client.connection.id, snapshot);
  const issues = validateVendorPaymentSnapshot(snapshot, resolved);
  if (issues.length) {
    const billWaiting = !resolved.billId && await prisma.integrationEvent.findFirst({
      where: {
        aggregateId: snapshot.supplierInvoiceId,
        eventType: 'SUPPLIER_INVOICE_POSTED',
        status: { in: [IntegrationEventStatus.PENDING, IntegrationEventStatus.PROCESSING] },
      },
    });
    throw new ZohoApiError(
      issues.join(' '),
      billWaiting ? 'ZOHO_VENDOR_PAYMENT_WAITING_BILL' : 'ZOHO_VENDOR_PAYMENT_NEEDS_ACTION',
      422,
      Boolean(billWaiting),
      billWaiting ? 5_000 : undefined,
    );
  }
  const matches = await findExisting(client, snapshot.referenceNumber);
  if (matches.length > 1) {
    throw new ZohoApiError(
      `Referensi vendor payment ${snapshot.referenceNumber} ditemukan lebih dari sekali di Zoho.`,
      'ZOHO_VENDOR_PAYMENT_AMBIGUOUS',
      409,
      false,
    );
  }
  let remote = matches[0];
  const operation = remote ? 'RECOVER_EXISTING' : 'CREATE';
  if (remote?.payment_id != null) {
    const detail = await client.request<{ vendorpayment?: ZohoVendorPaymentRemote }>(
      `/books/v3/vendorpayments/${remote.payment_id}`,
    );
    remote = { ...remote, ...detail.vendorpayment };
    assertRemoteErpOrigin(remote, snapshot.externalKey, 'Vendor Payment');
  }
  if (!remote) {
    const response = await client.request<{ vendorpayment?: ZohoVendorPaymentRemote }>(
      '/books/v3/vendorpayments',
      {
        method: 'POST',
        data: buildZohoVendorPaymentPayload(
          snapshot,
          resolved as ZohoVendorPaymentDependencies,
        ),
      },
    );
    remote = response.vendorpayment;
  }
  if (remote?.payment_id == null) {
    throw new ZohoApiError(
      'Zoho tidak mengembalikan payment_id vendor payment.',
      'ZOHO_VENDOR_PAYMENT_ID_MISSING',
      502,
      true,
    );
  }
  if (!remote.bills?.length) {
    const detail = await client.request<{ vendorpayment?: ZohoVendorPaymentRemote }>(
      `/books/v3/vendorpayments/${remote.payment_id}`,
    );
    remote = { ...remote, ...detail.vendorpayment };
  }
  await saveMapping({
    connectionId: client.connection.id,
    snapshot,
    remote,
    operation,
  });
  return {
    operation,
    zohoPaymentId: String(remote.payment_id),
    billId: (resolved as ZohoVendorPaymentDependencies).billId,
    amount: snapshot.amount,
  };
}

type ZohoVendorPaymentRefundRemote = {
  vendorpayment_refund_id?: string | number;
  vendorpayment_id?: string | number;
  reference_number?: string;
  amount?: number;
  amount_fcy?: number;
};

function firstRefund(value?: ZohoVendorPaymentRefundRemote | ZohoVendorPaymentRefundRemote[]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function handleSupplierPaymentRefunded(event: IntegrationEvent) {
  if (
    event.eventType !== AP_PAYMENT_REFUNDED_EVENT
    || event.eventVersion !== 1
    || event.aggregateType !== 'SupplierPaymentRefund'
  ) {
    throw new ZohoApiError(
      'Kontrak event refund vendor payment tidak didukung.',
      'ZOHO_VENDOR_PAYMENT_REFUND_EVENT_UNSUPPORTED',
      422,
      false,
    );
  }
  const snapshot = event.payload as unknown as ZohoVendorPaymentRefundSnapshot;
  if (!snapshot.eligible) {
    return { operation: 'SKIP_POLICY', reason: snapshot.excludedReason };
  }
  const client = await getActiveZohoClient(true);
  const mappedRefund = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'SUPPLIER_PAYMENT_REFUND',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  if (mappedRefund) {
    assertErpManaged(mappedRefund, 'Refund Vendor Payment Zoho');
    return { operation: 'ALREADY_MAPPED', zohoRefundId: mappedRefund.zohoEntityId };
  }
  const [paymentMapping, originalEvent, accountMapping, methodMapping] = await Promise.all([
    prisma.zohoEntityMapping.findUnique({
      where: {
        zohoConnectionId_entityType_localEntityId: {
          zohoConnectionId: client.connection.id,
          entityType: 'SUPPLIER_PAYMENT',
          localEntityId: snapshot.originalSupplierPaymentId,
        },
      },
    }),
    prisma.integrationEvent.findUnique({
      where: {
        eventType_aggregateId: {
          eventType: AP_PAYMENT_POSTED_EVENT,
          aggregateId: snapshot.originalSupplierPaymentId,
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
          localEntityId: vendorPaymentMethodMappingKey(snapshot.paymentMethod),
        },
      },
    }),
  ]);
  if (!paymentMapping || !originalEvent || !accountMapping || !methodMapping) {
    throw new ZohoApiError(
      'Mapping payment asli, rekening, metode, atau snapshot asli belum lengkap.',
      'ZOHO_VENDOR_PAYMENT_REFUND_NEEDS_ACTION',
      422,
      false,
    );
  }
  assertErpManaged(paymentMapping, 'Vendor Payment Zoho');
  const original = originalEvent.payload as unknown as ZohoVendorPaymentSnapshot;
  const resolved = await dependencies(client.connection.id, original);
  const issues = validateVendorPaymentSnapshot(original, resolved);
  if (issues.length) {
    throw new ZohoApiError(
      issues.join(' '),
      'ZOHO_VENDOR_PAYMENT_REFUND_NEEDS_ACTION',
      422,
      false,
    );
  }
  const paymentId = paymentMapping.zohoEntityId;
  const refunds = await client.listAll<ZohoVendorPaymentRefundRemote>(
    `/books/v3/vendorpayments/${paymentId}/refunds`,
    'vendorpayment_refunds',
  );
  let refund = refunds.find((row) => row.reference_number === snapshot.externalKey);
  if (refund) assertRemoteErpOrigin(refund, snapshot.externalKey, 'Refund Vendor Payment');
  const operation = refund ? 'RECOVER_EXISTING' : 'REFUND';
  if (!refund) {
    const updatePayload = buildZohoVendorPaymentPayload(
      original,
      resolved as ZohoVendorPaymentDependencies,
    );
    updatePayload.bills[0].amount_applied =
      Number(snapshot.remainingAppliedAmountAfterRefund);
    await client.request(`/books/v3/vendorpayments/${paymentId}`, {
      method: 'PUT',
      data: updatePayload,
    });
    const response = await client.request<{
      vendorpayment_refund?:
        ZohoVendorPaymentRefundRemote | ZohoVendorPaymentRefundRemote[];
    }>(`/books/v3/vendorpayments/${paymentId}/refunds`, {
      method: 'POST',
      data: buildZohoVendorPaymentRefundPayload(
        snapshot,
        accountMapping.zohoEntityId,
        methodMapping.zohoEntityId,
      ),
    });
    refund = firstRefund(response.vendorpayment_refund);
  }
  if (refund?.vendorpayment_refund_id == null) {
    throw new ZohoApiError(
      'Zoho tidak mengembalikan vendorpayment_refund_id.',
      'ZOHO_VENDOR_PAYMENT_REFUND_ID_MISSING',
      502,
      true,
    );
  }
  await prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'SUPPLIER_PAYMENT_REFUND',
        localEntityId: snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: client.connection.id,
      entityType: 'SUPPLIER_PAYMENT_REFUND',
      localEntityId: snapshot.localEntityId,
      zohoEntityType: 'VENDOR_PAYMENT_REFUND',
      zohoEntityId: String(refund.vendorpayment_refund_id),
      externalKey: snapshot.externalKey,
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: json({
        operation,
        originalSupplierPaymentId: snapshot.originalSupplierPaymentId,
        zohoVendorPaymentId: paymentId,
        referenceNumber: snapshot.referenceNumber,
        amount: snapshot.amount,
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId: String(refund.vendorpayment_refund_id),
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: json({
        operation,
        originalSupplierPaymentId: snapshot.originalSupplierPaymentId,
        zohoVendorPaymentId: paymentId,
        referenceNumber: snapshot.referenceNumber,
        amount: snapshot.amount,
      }),
      lastSyncedAt: new Date(),
    },
  });
  return {
    operation,
    zohoRefundId: String(refund.vendorpayment_refund_id),
    zohoPaymentId: paymentId,
  };
}

async function localPayment(id: string): Promise<SupplierPaymentSource> {
  const row = await prisma.supplierPayment.findUnique({
    where: { id },
    include: {
      cashBankAccount: true,
      supplierInvoice: { include: { supplier: true, branch: true } },
    },
  });
  if (!row) throw new AppError(404, 'SUPPLIER_PAYMENT_NOT_FOUND', 'Pembayaran supplier tidak ditemukan.');
  return row;
}

async function snapshotForPayment(id: string) {
  const event = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: AP_PAYMENT_POSTED_EVENT,
        aggregateId: id,
      },
    },
  });
  if (event) {
    return {
      snapshot: event.payload as unknown as ZohoVendorPaymentSnapshot,
      occurredAt: event.occurredAt,
    };
  }
  const payment = await localPayment(id);
  const ordered = await prisma.supplierPayment.findMany({
    where: { supplierInvoiceId: payment.supplierInvoiceId },
    orderBy: [{ postedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, amount: true },
  });
  const prior = ordered
    .slice(0, ordered.findIndex((row) => row.id === payment.id))
    .reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
  const before = payment.supplierInvoice.amount.sub(prior);
  return {
    snapshot: buildSupplierPaymentSnapshot(payment, before, before.sub(payment.amount)),
    occurredAt: payment.postedAt,
  };
}

export async function previewVendorPayment(actorUserId: string, id: string) {
  const payment = await localPayment(id);
  await assertBranchAccess(actorUserId, payment.branchId);
  const { snapshot } = await snapshotForPayment(id);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  let resolved: Partial<ZohoVendorPaymentDependencies> = {};
  let connectionIssue: string | null = null;
  if (connection && snapshot.eligible) {
    try {
      resolved = await dependencies(connection.id, snapshot);
    } catch (error) {
      connectionIssue = error instanceof Error ? error.message : 'Dependency Zoho gagal diperiksa.';
    }
  }
  const issues = connection
    ? [
      ...validateVendorPaymentSnapshot(snapshot, resolved),
      ...(connectionIssue ? [connectionIssue] : []),
    ]
    : ['Zoho Books belum terhubung.'];
  return {
    snapshot,
    dependencies: resolved,
    payload: connection && snapshot.eligible && !issues.length
      ? buildZohoVendorPaymentPayload(
        snapshot,
        resolved as ZohoVendorPaymentDependencies,
      )
      : null,
    issues,
    liveReady: Boolean(connection) && snapshot.eligible && issues.length === 0,
    invariant: 'Satu SupplierPayment diterapkan tepat ke satu Zoho Bill dengan nominal yang sama.',
  };
}

export async function enqueueVendorPayment(actorUserId: string, id: string) {
  const payment = await localPayment(id);
  await assertBranchAccess(actorUserId, payment.branchId);
  const current = await prisma.integrationEvent.findUnique({
    where: {
      eventType_aggregateId: {
        eventType: AP_PAYMENT_POSTED_EVENT,
        aggregateId: id,
      },
    },
  });
  if (current?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_EVENT_PROCESSING', 'Vendor payment sedang diproses.');
  }
  const { snapshot, occurredAt } = await snapshotForPayment(id);
  return prisma.$transaction((tx) =>
    enqueueSupplierPaymentPostedTx(tx, snapshot, occurredAt));
}

export async function listVendorPayments(
  actorUserId: string,
  input: { page: number; limit: number; search?: string },
) {
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.SupplierPaymentWhereInput = {
    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    ...(input.search ? {
      OR: [
        { paymentNumber: { contains: input.search, mode: 'insensitive' } },
        { paymentReference: { contains: input.search, mode: 'insensitive' } },
        { supplierInvoice: { invoiceNumber: { contains: input.search, mode: 'insensitive' } } },
        { supplierInvoice: { supplier: { name: { contains: input.search, mode: 'insensitive' } } } },
      ],
    } : {}),
  };
  const [rows, total, connection] = await Promise.all([
    prisma.supplierPayment.findMany({
      where,
      include: {
        cashBankAccount: true,
        supplierInvoice: { include: { supplier: true, branch: true } },
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.supplierPayment.count({ where }),
    prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true } }),
  ]);
  const ids = rows.map((row) => row.id);
  const [mappings, events] = await Promise.all([
    connection
      ? prisma.zohoEntityMapping.findMany({
        where: {
          zohoConnectionId: connection.id,
          entityType: 'SUPPLIER_PAYMENT',
          localEntityId: { in: ids },
        },
      })
      : Promise.resolve([]),
    prisma.integrationEvent.findMany({
      where: { eventType: AP_PAYMENT_POSTED_EVENT, aggregateId: { in: ids } },
    }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      paymentNumber: row.paymentNumber,
      paymentReference: row.paymentReference,
      paymentDate: row.paymentDate,
      amount: row.amount.toFixed(2),
      paymentMethod: row.cashBankAccount.type === 'CASH' ? 'CASH' : 'TRANSFER',
      cashBankAccount: {
        id: row.cashBankAccount.id,
        code: row.cashBankAccount.code,
        name: row.cashBankAccount.name,
      },
      supplierInvoice: {
        id: row.supplierInvoice.id,
        invoiceNumber: row.supplierInvoice.invoiceNumber,
        supplierInvoiceNumber: row.supplierInvoice.supplierInvoiceNumber,
        balanceAmount: row.supplierInvoice.balanceAmount.toFixed(2),
      },
      supplier: {
        id: row.supplierInvoice.supplier.id,
        code: row.supplierInvoice.supplier.code,
        name: row.supplierInvoice.supplier.name,
      },
      branch: {
        id: row.supplierInvoice.branch.id,
        code: row.supplierInvoice.branch.branchCode,
        name: row.supplierInvoice.branch.name,
        type: row.supplierInvoice.branch.type,
      },
      eligible: row.supplierInvoice.branch.type !== 'PARTNERSHIP',
      mapping: mappings.find((entry) => entry.localEntityId === row.id) || null,
      event: events.find((entry) => entry.aggregateId === row.id) || null,
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}

export function getVendorPaymentConfig(actorUserId: string) {
  return getPaymentConfig(actorUserId);
}

export async function reconcileVendorPayments(actorUserId: string) {
  const client = await getActiveZohoClient(true);
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const events = await prisma.integrationEvent.findMany({
    where: {
      eventType: AP_PAYMENT_POSTED_EVENT,
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    },
    orderBy: { occurredAt: 'desc' },
    take: 100,
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: 'SUPPLIER_PAYMENT',
      localEntityId: { in: events.map((event) => event.aggregateId) },
    },
  });
  const rows = await Promise.all(events.map(async (event) => {
    const snapshot = event.payload as unknown as ZohoVendorPaymentSnapshot;
    if (!snapshot.eligible) {
      return {
        supplierPaymentId: event.aggregateId,
        paymentNumber: snapshot.paymentNumber,
        result: { status: 'MATCHED' as const, differences: [] },
      };
    }
    const mapping = mappings.find((entry) => entry.localEntityId === event.aggregateId);
    const resolved = await dependencies(client.connection.id, snapshot);
    if (!mapping || !resolved.billId || !resolved.paidThroughAccountId) {
      return {
        supplierPaymentId: event.aggregateId,
        paymentNumber: snapshot.paymentNumber,
        result: reconcileVendorPayment(snapshot, {
          billId: resolved.billId || '',
          paidThroughAccountId: resolved.paidThroughAccountId || '',
        }),
      };
    }
    const response = await client.request<{ vendorpayment?: ZohoVendorPaymentRemote }>(
      `/books/v3/vendorpayments/${mapping.zohoEntityId}`,
    );
    return {
      supplierPaymentId: event.aggregateId,
      paymentNumber: snapshot.paymentNumber,
      result: reconcileVendorPayment(snapshot, {
        billId: resolved.billId,
        paidThroughAccountId: resolved.paidThroughAccountId,
      }, response.vendorpayment),
    };
  }));
  const ap = await reconcileBills(actorUserId);
  return {
    checked: rows.length,
    matched: rows.filter((row) => row.result.status === 'MATCHED').length,
    missing: rows.filter((row) => row.result.status === 'MISSING_IN_ZOHO').length,
    mismatched: rows.filter((row) => row.result.status === 'AMOUNT_MISMATCH').length,
    rows,
    ap,
  };
}
