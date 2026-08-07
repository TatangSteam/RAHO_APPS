import { Prisma } from '@prisma/client';
import { env } from '@config/env';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { normalizeZohoError } from './zoho.error';
import { logZohoErrorThrottled } from './zoho.logging';

type RemoteRow = Record<string, unknown>;
type ResourceConfig = {
  zohoEntityType: string;
  mappingEntityTypes?: string[];
  path: string;
  collectionKey: string;
  idKeys: string[];
  referenceKeys: string[];
  amountKeys: string[];
};

const RESOURCES: ResourceConfig[] = [
  {
    zohoEntityType: 'CONTACT',
    mappingEntityTypes: ['CONTACT_CUSTOMER', 'CONTACT_VENDOR', 'PARTNERSHIP_BRANCH_CUSTOMER'],
    path: '/books/v3/contacts',
    collectionKey: 'contacts',
    idKeys: ['contact_id'],
    referenceKeys: [],
    amountKeys: [],
  },
  { zohoEntityType: 'ITEM', path: '/books/v3/items', collectionKey: 'items', idKeys: ['item_id'], referenceKeys: [], amountKeys: ['rate'] },
  { zohoEntityType: 'LOCATION', path: '/books/v3/locations', collectionKey: 'locations', idKeys: ['location_id'], referenceKeys: [], amountKeys: [] },
  { zohoEntityType: 'INVOICE', path: '/books/v3/invoices', collectionKey: 'invoices', idKeys: ['invoice_id'], referenceKeys: ['reference_number', 'invoice_number'], amountKeys: ['total'] },
  { zohoEntityType: 'CUSTOMER_PAYMENT', path: '/books/v3/customerpayments', collectionKey: 'customerpayments', idKeys: ['payment_id'], referenceKeys: ['reference_number'], amountKeys: ['amount'] },
  { zohoEntityType: 'RETAINER_INVOICE', path: '/books/v3/retainerinvoices', collectionKey: 'retainerinvoices', idKeys: ['retainerinvoice_id'], referenceKeys: ['reference_number', 'retainerinvoice_number'], amountKeys: ['total'] },
  { zohoEntityType: 'JOURNAL', path: '/books/v3/journals', collectionKey: 'journals', idKeys: ['journal_id'], referenceKeys: ['reference_number', 'journal_number'], amountKeys: ['total'] },
  { zohoEntityType: 'EXPENSE', path: '/books/v3/expenses', collectionKey: 'expenses', idKeys: ['expense_id'], referenceKeys: ['reference_number'], amountKeys: ['total'] },
  { zohoEntityType: 'PURCHASE_ORDER', path: '/books/v3/purchaseorders', collectionKey: 'purchaseorders', idKeys: ['purchaseorder_id'], referenceKeys: ['reference_number', 'purchaseorder_number'], amountKeys: ['total'] },
  { zohoEntityType: 'BILL', path: '/books/v3/bills', collectionKey: 'bills', idKeys: ['bill_id'], referenceKeys: ['reference_number', 'bill_number'], amountKeys: ['total'] },
  { zohoEntityType: 'VENDOR_PAYMENT', path: '/books/v3/vendorpayments', collectionKey: 'vendorpayments', idKeys: ['payment_id'], referenceKeys: ['reference_number'], amountKeys: ['amount'] },
];

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const value = (row: RemoteRow, keys: string[]): unknown => {
  for (const key of keys) if (row[key] != null) return row[key];
  return undefined;
};
const stringValue = (row: RemoteRow, keys: string[]): string | null => {
  const found = value(row, keys);
  return found == null ? null : String(found);
};
const numberValue = (row: RemoteRow, keys: string[]): number | null => {
  const found = Number(value(row, keys));
  return Number.isFinite(found) ? found : null;
};

function expectedAmount(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const record = metadata as Record<string, unknown>;
  for (const key of ['amount', 'amountApplied', 'totalAmount', 'recognizedRevenue', 'totalPostedValue']) {
    const candidate = Number(record[key]);
    if (Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function remoteStatus(row: RemoteRow): string | null {
  return stringValue(row, ['status', 'payment_status', 'invoice_status']);
}

function differencesFor(
  mapping: { externalKey: string | null; metadata: unknown; status: string },
  remote: RemoteRow,
  config: ResourceConfig,
  duplicateCount: number,
): string[] {
  const differences: string[] = [];
  const reference = stringValue(remote, config.referenceKeys);
  if (mapping.externalKey && reference && mapping.externalKey !== reference) {
    differences.push('EXTERNAL_REFERENCE_MISMATCH');
  }
  if (duplicateCount > 1) differences.push('DUPLICATE_EXTERNAL_REFERENCE');
  const expected = expectedAmount(mapping.metadata);
  const actual = numberValue(remote, config.amountKeys);
  if (expected != null && actual != null && Math.abs(expected - actual) >= 0.01) {
    differences.push('AMOUNT_MISMATCH');
  }
  const status = remoteStatus(remote);
  if (mapping.status === 'ACTIVE' && status && /void|deleted|inactive|cancelled/i.test(status)) {
    differences.push('STATUS_MISMATCH');
  }
  return differences;
}

async function closedPeriodDifference(localEntityId: string, differences: string[]) {
  if (!differences.length) return false;
  const event = await prisma.integrationEvent.findFirst({
    where: { aggregateId: localEntityId },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true, branchId: true },
  });
  if (!event) return false;
  return Boolean(await prisma.accountingPeriod.findFirst({
    where: {
      status: { in: ['CLOSED', 'LOCKED'] },
      startDate: { lte: event.occurredAt },
      endDate: { gte: event.occurredAt },
      OR: [{ branchId: event.branchId }, { branchId: null }],
    },
    select: { id: true },
  }));
}

async function createResult(input: {
  runId: string;
  entityType: string;
  localEntityId?: string | null;
  zohoEntityId?: string | null;
  externalReference?: string | null;
  status: string;
  severity: string;
  differences?: string[];
  evidence?: unknown;
  actionRequired?: string | null;
}) {
  return prisma.zohoReconciliationResult.create({
    data: {
      runId: input.runId,
      entityType: input.entityType,
      localEntityId: input.localEntityId,
      zohoEntityId: input.zohoEntityId,
      externalReference: input.externalReference,
      status: input.status,
      severity: input.severity,
      differences: json(input.differences || []),
      evidence: input.evidence == null ? undefined : json(input.evidence),
      actionRequired: input.actionRequired,
    },
  });
}

async function reconcileResource(
  client: ZohoClient,
  runId: string,
  config: ResourceConfig,
): Promise<{ checked: number; matched: number; exceptions: number }> {
  const [remoteRows, mappings] = await Promise.all([
    client.listAll<RemoteRow>(config.path, config.collectionKey),
    prisma.zohoEntityMapping.findMany({
      where: {
        zohoConnectionId: client.connection.id,
        zohoEntityType: config.mappingEntityTypes
          ? { in: config.mappingEntityTypes }
          : config.zohoEntityType,
      },
    }),
  ]);
  const remoteById = new Map(remoteRows.map((row) => [
    stringValue(row, config.idKeys),
    row,
  ]).filter((entry): entry is [string, RemoteRow] => Boolean(entry[0])));
  const referenceCounts = new Map<string, number>();
  for (const remote of remoteRows) {
    const reference = stringValue(remote, config.referenceKeys);
    if (reference) referenceCounts.set(reference, (referenceCounts.get(reference) || 0) + 1);
  }
  let checked = 0;
  let matched = 0;
  let exceptions = 0;
  for (const mapping of mappings) {
    checked += 1;
    const remote = remoteById.get(mapping.zohoEntityId);
    if (!remote) {
      exceptions += 1;
      await createResult({
        runId,
        entityType: mapping.entityType,
        localEntityId: mapping.localEntityId,
        zohoEntityId: mapping.zohoEntityId,
        externalReference: mapping.externalKey,
        status: 'MISSING_IN_ZOHO',
        severity: 'HIGH',
        differences: ['MISSING_IN_ZOHO'],
        actionRequired: 'Periksa penghapusan di Zoho atau lakukan retry/adopt mapping.',
      });
      continue;
    }
    const reference = stringValue(remote, config.referenceKeys);
    const differences = differencesFor(
      mapping,
      remote,
      config,
      reference ? referenceCounts.get(reference) || 0 : 0,
    );
    if (await closedPeriodDifference(mapping.localEntityId, differences)) {
      differences.push('CLOSED_PERIOD_CHANGE');
    }
    if (differences.length) exceptions += 1;
    else matched += 1;
    await createResult({
      runId,
      entityType: mapping.entityType,
      localEntityId: mapping.localEntityId,
      zohoEntityId: mapping.zohoEntityId,
      externalReference: reference || mapping.externalKey,
      status: differences.length ? 'MISMATCH' : 'MATCHED',
      severity: differences.length ? 'HIGH' : 'INFO',
      differences,
      evidence: {
        remoteStatus: remoteStatus(remote),
        remoteAmount: numberValue(remote, config.amountKeys),
      },
      actionRequired: differences.length ? 'Review drift dan tentukan koreksi RAHO atau Zoho.' : null,
    });
  }

  const mappedIds = new Set(mappings.map((mapping) => mapping.zohoEntityId));
  for (const remote of remoteRows) {
    const remoteId = stringValue(remote, config.idKeys);
    const reference = stringValue(remote, config.referenceKeys);
    if (!remoteId || mappedIds.has(remoteId) || !reference?.toUpperCase().startsWith('RAHO')) continue;
    checked += 1;
    exceptions += 1;
    await createResult({
      runId,
      entityType: config.zohoEntityType,
      zohoEntityId: remoteId,
      externalReference: reference,
      status: 'MISSING_IN_RAHO',
      severity: 'HIGH',
      differences: ['MISSING_IN_RAHO'],
      actionRequired: 'Adopt mapping jika dokumen valid, atau investigasi dokumen manual di Zoho.',
    });
  }
  return { checked, matched, exceptions };
}

async function reconcilePartnershipInvariants(runId: string, connectionId: string) {
  const treatmentMappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      entityType: { in: ['TREATMENT_REVENUE_INVOICE', 'TREATMENT_REVENUE_JOURNAL'] },
    },
  });
  const sessions = await prisma.treatmentSession.findMany({
    where: { id: { in: treatmentMappings.map((mapping) => mapping.localEntityId) } },
    include: { branch: { select: { type: true, branchCode: true } } },
  });
  let exceptions = 0;
  let treatmentExceptions = 0;
  for (const session of sessions) {
    if (session.branch.type !== 'PARTNERSHIP') continue;
    exceptions += 1;
    treatmentExceptions += 1;
    const mapping = treatmentMappings.find((entry) => entry.localEntityId === session.id)!;
    await createResult({
      runId,
      entityType: mapping.entityType,
      localEntityId: session.id,
      zohoEntityId: mapping.zohoEntityId,
      status: 'PARTNERSHIP_TREATMENT_VIOLATION',
      severity: 'CRITICAL',
      differences: ['PARTNERSHIP_TREATMENT_REVENUE_FOUND'],
      evidence: { branchCode: session.branch.branchCode },
      actionRequired: 'Reverse dokumen Zoho setelah approval Finance; jangan ubah treatment lokal.',
    });
  }
  const partnershipShipments = await prisma.shipment.findMany({
    where: { toBranch: { type: 'PARTNERSHIP' }, shippedAt: { not: null } },
    include: {
      toBranch: { select: { branchCode: true } },
      internalTransfer: { select: { id: true } },
    },
  });
  const shipmentEvents = await prisma.integrationEvent.findMany({
    where: {
      eventType: 'PARTNERSHIP_GOODS_SHIPPED',
      aggregateId: { in: partnershipShipments.map((shipment) => shipment.id) },
    },
    select: { aggregateId: true },
  });
  const shipmentEventIds = new Set(shipmentEvents.map((event) => event.aggregateId));
  let shipmentMatched = 0;
  for (const shipment of partnershipShipments) {
    const differences = [
      ...(shipment.internalTransfer ? ['PARTNERSHIP_MISCLASSIFIED_AS_INTERNAL_TRANSFER'] : []),
      ...(!shipmentEventIds.has(shipment.id) ? ['PARTNERSHIP_SALE_EVENT_MISSING'] : []),
    ];
    if (!differences.length) {
      shipmentMatched += 1;
      continue;
    }
    exceptions += 1;
    await createResult({
      runId,
      entityType: 'PARTNERSHIP_SHIPMENT_ROUTING',
      localEntityId: shipment.id,
      externalReference: shipment.shipmentCode,
      status: 'PARTNERSHIP_ROUTING_VIOLATION',
      severity: 'CRITICAL',
      differences,
      evidence: { destinationBranchCode: shipment.toBranch.branchCode },
      actionRequired: 'Perbaiki klasifikasi integration event tanpa membatalkan shipment lokal.',
    });
  }
  const totalChecked = treatmentMappings.length + partnershipShipments.length;
  return {
    checked: totalChecked,
    matched: treatmentMappings.length - treatmentExceptions + shipmentMatched,
    exceptions,
  };
}

export async function executeReconciliationRun(runId: string) {
  const run = await prisma.zohoReconciliationRun.findUnique({ where: { id: runId } });
  if (!run) throw new AppError(404, 'ZOHO_RECONCILIATION_NOT_FOUND', 'Reconciliation run tidak ditemukan.');
  const client = await getActiveZohoClient(true);
  const cursor = run.cursor && typeof run.cursor === 'object'
    ? run.cursor as { resourceIndex?: number }
    : {};
  let checked = run.totalChecked;
  let matched = run.matchedCount;
  let exceptions = run.exceptionCount;
  await prisma.zohoReconciliationRun.update({
    where: { id: run.id },
    data: { status: 'RUNNING', startedAt: run.startedAt || new Date(), lastError: null },
  });
  try {
    for (let index = cursor.resourceIndex || 0; index < RESOURCES.length; index += 1) {
      const result = await reconcileResource(client, run.id, RESOURCES[index]);
      checked += result.checked;
      matched += result.matched;
      exceptions += result.exceptions;
      await prisma.zohoReconciliationRun.update({
        where: { id: run.id },
        data: {
          cursor: json({ resourceIndex: index + 1 }),
          totalChecked: checked,
          matchedCount: matched,
          exceptionCount: exceptions,
        },
      });
    }
    const policy = await reconcilePartnershipInvariants(run.id, client.connection.id);
    checked += policy.checked;
    matched += policy.matched;
    exceptions += policy.exceptions;
    return prisma.zohoReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        cursor: json({ resourceIndex: RESOURCES.length, complete: true }),
        totalChecked: checked,
        matchedCount: matched,
        exceptionCount: exceptions,
        finishedAt: new Date(),
      },
      include: { results: { where: { status: { not: 'MATCHED' } }, orderBy: { createdAt: 'desc' } } },
    });
  } catch (error) {
    const normalized = normalizeZohoError(error);
    const paused = normalized.retryable || normalized.httpStatus === 429;
    await prisma.zohoReconciliationRun.update({
      where: { id: run.id },
      data: {
        status: paused ? 'PAUSED' : 'FAILED',
        errorCount: { increment: 1 },
        lastError: `${normalized.code}: ${normalized.message}`.slice(0, 1000),
        finishedAt: paused ? null : new Date(),
      },
    });
    if (!paused) throw error;
    return prisma.zohoReconciliationRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { results: { where: { status: { not: 'MATCHED' } } } },
    });
  }
}

export async function startReconciliationRun(input: {
  actorUserId?: string;
  triggerSource: 'MANUAL' | 'SCHEDULED';
  scheduledKey?: string;
}) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) {
    return {
      skipped: true,
      reason: 'ZOHO_NOT_CONNECTED',
      message: 'ERP lokal tetap berjalan; reconciliation Zoho dilewati.',
    };
  }
  if (input.scheduledKey) {
    const existing = await prisma.zohoReconciliationRun.findUnique({
      where: { scheduledKey: input.scheduledKey },
    });
    if (existing) return existing.status === 'PAUSED'
      ? executeReconciliationRun(existing.id)
      : existing;
  }
  const paused = await prisma.zohoReconciliationRun.findFirst({
    where: { zohoConnectionId: connection.id, runType: 'FULL', status: 'PAUSED' },
    orderBy: { createdAt: 'asc' },
  });
  if (paused) return executeReconciliationRun(paused.id);
  const run = await prisma.zohoReconciliationRun.create({
    data: {
      zohoConnectionId: connection.id,
      runType: 'FULL',
      status: 'PENDING',
      triggerSource: input.triggerSource,
      scheduledKey: input.scheduledKey,
      requestedById: input.actorUserId,
      cursor: json({ resourceIndex: 0 }),
    },
  });
  return executeReconciliationRun(run.id);
}

export async function listReconciliationRuns(input: {
  page: number;
  limit: number;
  status?: string;
}) {
  const where: Prisma.ZohoReconciliationRunWhereInput = input.status ? { status: input.status } : {};
  const [items, total] = await prisma.$transaction([
    prisma.zohoReconciliationRun.findMany({
      where,
      include: {
        results: {
          where: { status: { not: 'MATCHED' }, resolvedAt: null },
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
          take: 100,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.zohoReconciliationRun.count({ where }),
  ]);
  return { items, pagination: { ...input, total, totalPages: Math.ceil(total / input.limit) } };
}

export async function resolveReconciliationResult(
  id: string,
  actorUserId: string,
  note: string,
) {
  const result = await prisma.zohoReconciliationResult.findUnique({ where: { id } });
  if (!result) throw new AppError(404, 'ZOHO_RECONCILIATION_RESULT_NOT_FOUND', 'Exception tidak ditemukan.');
  return prisma.zohoReconciliationResult.update({
    where: { id },
    data: { resolvedAt: new Date(), resolvedById: actorUserId, resolutionNote: note },
  });
}

let timer: NodeJS.Timeout | null = null;
let scheduledRunning = false;

export function startZohoReconciliationScheduler(): void {
  if (!env.ZOHO_RECONCILIATION_ENABLED || timer) return;
  const tick = async () => {
    if (scheduledRunning) return;
    scheduledRunning = true;
    try {
      const bucket = new Date().toISOString().slice(0, 13);
      await startReconciliationRun({
        triggerSource: 'SCHEDULED',
        scheduledKey: `ZOHO-FULL:${bucket}`,
      });
    } catch (error) {
      logZohoErrorThrottled(
        'reconciliation-scheduler',
        'Zoho scheduled reconciliation failed',
        error,
      );
    } finally {
      scheduledRunning = false;
    }
  };
  void tick();
  timer = setInterval(() => void tick(), env.ZOHO_RECONCILIATION_INTERVAL_MS);
}

export function stopZohoReconciliationScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
