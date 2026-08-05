import { IntegrationEvent, IntegrationEventStatus, Prisma } from '@prisma/client';
import { downloadFile, extractKeyFromUrl } from '@config/minio';
import { prisma } from '@lib/prisma';
import { AppError } from '@middleware/errorHandler';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { getActiveZohoClient, ZohoClient } from './zoho.client';
import { ZohoApiError } from './zoho.error';
import { assertErpManaged, assertRemoteErpOrigin } from './zoho.origin';
import {
  buildZohoExpensePayload,
  reconcileExpense,
  validateExpenseSnapshot,
  ZOHO_EXPENSE_RECEIPT_MAX_BYTES,
  ZohoExpenseDependencies,
  ZohoExpenseRemote,
  ZohoExpenseSnapshot,
} from './zoho.expense.policy';
import { saveCashBankMapping } from './zoho.payment.service';
import { saveGlAccountMapping } from './zoho.retainer.service';
import { stablePayloadHash } from './zoho.sanitizer';

export const EXPENSE_PAID_EVENT = 'EXPENSE_PAID';
type Tx = Prisma.TransactionClient;

type ExpenseSnapshotSource = {
  id: string;
  expenseNumber: string;
  branchId: string;
  expenseDate: Date;
  paidAt: Date | null;
  amount: Prisma.Decimal;
  category: string;
  description: string;
  cashBankAccountId: string;
  evidenceFileName: string | null;
  evidenceFileSize: number | null;
  evidenceMimeType: string | null;
  evidenceChecksum: string | null;
  expenseAccount: { code: string };
};

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function metadata(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function buildExpensePaidSnapshot(expense: ExpenseSnapshotSource, paidAt: Date): ZohoExpenseSnapshot {
  const hasEvidence = Boolean(
    expense.evidenceFileName
    && expense.evidenceFileSize
    && expense.evidenceMimeType
    && expense.evidenceChecksum,
  );
  return {
    localEntityId: expense.id,
    externalKey: `RAHO:EXPENSE:${expense.id}`,
    referenceNumber: expense.expenseNumber,
    expenseNumber: expense.expenseNumber,
    branchId: expense.branchId,
    expenseDate: day(expense.expenseDate),
    paidAt: paidAt.toISOString(),
    amount: expense.amount.toFixed(2),
    category: expense.category,
    description: expense.description,
    expenseAccountCode: expense.expenseAccount.code,
    cashBankAccountId: expense.cashBankAccountId,
    evidence: hasEvidence ? {
      fileName: expense.evidenceFileName!,
      fileSize: expense.evidenceFileSize!,
      mimeType: expense.evidenceMimeType!,
      checksum: expense.evidenceChecksum!,
    } : null,
  };
}

export function enqueueExpensePaidTx(tx: Tx, snapshot: ZohoExpenseSnapshot) {
  return tx.integrationEvent.upsert({
    where: {
      eventType_aggregateId: {
        eventType: EXPENSE_PAID_EVENT,
        aggregateId: snapshot.localEntityId,
      },
    },
    create: {
      eventType: EXPENSE_PAID_EVENT,
      eventVersion: 1,
      aggregateType: 'Expense',
      aggregateId: snapshot.localEntityId,
      branchId: snapshot.branchId,
      payload: json(snapshot),
      payloadHash: stablePayloadHash(snapshot),
      status: IntegrationEventStatus.PENDING,
      occurredAt: new Date(snapshot.paidAt),
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
      lockedBy: null,
      leaseUntil: null,
      lastError: null,
      occurredAt: new Date(snapshot.paidAt),
    },
  });
}

async function dependencies(
  connectionId: string,
  snapshot: ZohoExpenseSnapshot,
): Promise<Partial<ZohoExpenseDependencies>> {
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: connectionId,
      status: 'ACTIVE',
      OR: [
        { entityType: 'GL_ACCOUNT', localEntityId: snapshot.expenseAccountCode },
        { entityType: 'CASH_BANK_ACCOUNT', localEntityId: snapshot.cashBankAccountId },
        { entityType: 'BRANCH_LOCATION', localEntityId: snapshot.branchId },
      ],
    },
  });
  const find = (entityType: string, localEntityId: string) =>
    mappings.find((entry) =>
      entry.entityType === entityType && entry.localEntityId === localEntityId)?.zohoEntityId;
  return {
    expenseAccountId: find('GL_ACCOUNT', snapshot.expenseAccountCode),
    paidThroughAccountId: find('CASH_BANK_ACCOUNT', snapshot.cashBankAccountId),
    locationId: find('BRANCH_LOCATION', snapshot.branchId),
  };
}

async function findExistingExpense(client: ZohoClient, referenceNumber: string) {
  const rows = await client.listAll<ZohoExpenseRemote>(
    '/books/v3/expenses',
    'expenses',
    { reference_number: referenceNumber },
  );
  return rows.filter((row) => row.reference_number === referenceNumber);
}

async function saveExpenseMapping(
  connectionId: string,
  snapshot: ZohoExpenseSnapshot,
  remote: ZohoExpenseRemote,
  operation: string,
) {
  if (remote.expense_id == null) {
    throw new ZohoApiError('Zoho tidak mengembalikan expense_id.', 'ZOHO_EXPENSE_ID_MISSING', 502, true);
  }
  const zohoEntityId = String(remote.expense_id);
  return prisma.zohoEntityMapping.upsert({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: connectionId,
        entityType: 'EXPENSE',
        localEntityId: snapshot.localEntityId,
      },
    },
    create: {
      zohoConnectionId: connectionId,
      entityType: 'EXPENSE',
      localEntityId: snapshot.localEntityId,
      zohoEntityType: 'EXPENSE',
      zohoEntityId,
      externalKey: snapshot.externalKey,
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: json({
        operation,
        referenceNumber: snapshot.referenceNumber,
        amount: snapshot.amount,
        receiptStatus: snapshot.evidence ? 'PENDING' : 'NOT_PROVIDED',
      }),
      lastSyncedAt: new Date(),
    },
    update: {
      zohoEntityId,
      dataOrigin: 'ERP',
      managementMode: 'ERP_MANAGED',
      originVerifiedAt: new Date(),
      status: 'ACTIVE',
      metadata: json({
        ...metadata((await prisma.zohoEntityMapping.findUnique({
          where: {
            zohoConnectionId_entityType_localEntityId: {
              zohoConnectionId: connectionId,
              entityType: 'EXPENSE',
              localEntityId: snapshot.localEntityId,
            },
          },
          select: { metadata: true },
        }))?.metadata || null),
        operation,
        referenceNumber: snapshot.referenceNumber,
        amount: snapshot.amount,
      }),
      lastSyncedAt: new Date(),
    },
  });
}

async function uploadReceiptIfNeeded(
  client: ZohoClient,
  snapshot: ZohoExpenseSnapshot,
  mapping: { id: string; zohoEntityId: string; metadata: Prisma.JsonValue | null },
) {
  if (!snapshot.evidence) return { status: 'NOT_PROVIDED' as const };
  const currentMetadata = metadata(mapping.metadata);
  if (
    currentMetadata.receiptStatus === 'UPLOADED'
    && currentMetadata.receiptChecksum === snapshot.evidence.checksum
  ) {
    return { status: 'ALREADY_UPLOADED' as const };
  }
  const expense = await prisma.expense.findUnique({
    where: { id: snapshot.localEntityId },
    select: {
      status: true,
      evidenceFileUrl: true,
      evidenceFileName: true,
      evidenceFileSize: true,
      evidenceMimeType: true,
      evidenceChecksum: true,
    },
  });
  if (!expense || expense.status !== 'PAID' || !expense.evidenceFileUrl) {
    throw new ZohoApiError('Receipt expense PAID tidak ditemukan.', 'ZOHO_EXPENSE_RECEIPT_MISSING', 422, false);
  }
  if (
    expense.evidenceChecksum !== snapshot.evidence.checksum
    || expense.evidenceFileSize !== snapshot.evidence.fileSize
    || expense.evidenceMimeType !== snapshot.evidence.mimeType
  ) {
    throw new ZohoApiError(
      'Snapshot receipt tidak cocok dengan file expense. Periksa audit dan enqueue ulang.',
      'ZOHO_EXPENSE_RECEIPT_SNAPSHOT_MISMATCH',
      409,
      false,
    );
  }
  const file = await downloadFile(
    extractKeyFromUrl(expense.evidenceFileUrl),
    ZOHO_EXPENSE_RECEIPT_MAX_BYTES,
  );
  await client.uploadFile(
    `/books/v3/expenses/${mapping.zohoEntityId}/receipt`,
    'receipt',
    {
      buffer: file,
      fileName: expense.evidenceFileName || snapshot.evidence.fileName,
      mimeType: expense.evidenceMimeType || snapshot.evidence.mimeType,
    },
  );
  await prisma.zohoEntityMapping.update({
    where: { id: mapping.id },
    data: {
      metadata: json({
        ...currentMetadata,
        receiptStatus: 'UPLOADED',
        receiptChecksum: snapshot.evidence.checksum,
        receiptFileName: snapshot.evidence.fileName,
        receiptUploadedAt: new Date().toISOString(),
      }),
      lastSyncedAt: new Date(),
    },
  });
  return { status: 'UPLOADED' as const };
}

export async function handleExpensePaid(event: IntegrationEvent) {
  const snapshot = event.payload as unknown as ZohoExpenseSnapshot;
  const client = await getActiveZohoClient(true);
  const resolved = await dependencies(client.connection.id, snapshot);
  const issues = validateExpenseSnapshot(snapshot, resolved);
  if (issues.length) {
    throw new ZohoApiError(issues.join(' '), 'ZOHO_EXPENSE_NEEDS_ACTION', 422, false);
  }
  const payload = buildZohoExpensePayload(snapshot, resolved as ZohoExpenseDependencies);
  let mapping = await prisma.zohoEntityMapping.findUnique({
    where: {
      zohoConnectionId_entityType_localEntityId: {
        zohoConnectionId: client.connection.id,
        entityType: 'EXPENSE',
        localEntityId: snapshot.localEntityId,
      },
    },
  });
  let operation = 'MAPPING_REUSED';
  if (mapping) assertErpManaged(mapping, 'Expense Zoho');
  if (!mapping) {
    const matches = await findExistingExpense(client, snapshot.referenceNumber);
    if (matches.length > 1) {
      throw new ZohoApiError(
        'Lebih dari satu expense Zoho memakai reference yang sama.',
        'ZOHO_EXPENSE_DUPLICATE_REFERENCE',
        409,
        false,
      );
    }
    let remote = matches[0];
    operation = remote ? 'MATCHED_BY_REFERENCE' : 'CREATED';
    if (remote?.expense_id != null) {
      const detail = await client.request<{ expense?: ZohoExpenseRemote }>(
        `/books/v3/expenses/${remote.expense_id}`,
      );
      remote = { ...remote, ...detail.expense };
      assertRemoteErpOrigin(remote, snapshot.externalKey, 'Expense');
    }
    if (!remote) {
      const response = await client.request<{ expense?: ZohoExpenseRemote }>(
        '/books/v3/expenses',
        { method: 'POST', data: payload },
      );
      remote = response.expense;
    }
    if (!remote) throw new ZohoApiError('Respons create expense kosong.', 'ZOHO_EXPENSE_EMPTY_RESPONSE', 502, true);
    mapping = await saveExpenseMapping(client.connection.id, snapshot, remote, operation);
  }
  const receipt = await uploadReceiptIfNeeded(client, snapshot, mapping);
  return {
    operation,
    zohoExpenseId: mapping.zohoEntityId,
    receiptStatus: receipt.status,
    referenceNumber: snapshot.referenceNumber,
  };
}

async function snapshotForExpense(id: string) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { expenseAccount: { select: { code: true } } },
  });
  if (!expense) throw new AppError(404, 'EXPENSE_NOT_FOUND', 'Expense tidak ditemukan.');
  if (expense.status !== 'PAID' || !expense.paidAt) {
    throw new AppError(409, 'EXPENSE_NOT_PAID', 'Hanya expense PAID yang dapat dikirim ke Zoho.');
  }
  return buildExpensePaidSnapshot(expense, expense.paidAt);
}

export async function previewExpense(id: string) {
  const snapshot = await snapshotForExpense(id);
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  const resolved = connection ? await dependencies(connection.id, snapshot) : {};
  const issues = validateExpenseSnapshot(snapshot, resolved);
  return {
    snapshot,
    payload: issues.length ? null : buildZohoExpensePayload(snapshot, resolved as ZohoExpenseDependencies),
    issues,
    liveReady: Boolean(connection) && issues.length === 0,
    excludedFields: ['evidenceFileUrl', 'internal URL', 'token', 'medical data'],
    reversalPolicy: 'Expense Zoho tidak dihapus otomatis; reversal harus berupa compensating action yang diaudit.',
  };
}

export async function enqueueExpense(id: string) {
  const snapshot = await snapshotForExpense(id);
  const current = await prisma.integrationEvent.findUnique({
    where: { eventType_aggregateId: { eventType: EXPENSE_PAID_EVENT, aggregateId: id } },
  });
  if (current?.status === IntegrationEventStatus.PROCESSING) {
    throw new AppError(409, 'ZOHO_EVENT_PROCESSING', 'Event expense sedang diproses.');
  }
  return prisma.$transaction((tx) => enqueueExpensePaidTx(tx, snapshot));
}

export async function listExpenseMappings(
  actorUserId: string,
  input: { page: number; limit: number; search?: string },
) {
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.ExpenseWhereInput = {
    ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    ...(input.search ? {
      OR: [
        { expenseNumber: { contains: input.search, mode: 'insensitive' } },
        { description: { contains: input.search, mode: 'insensitive' } },
        { category: { contains: input.search, mode: 'insensitive' } },
      ],
    } : {}),
  };
  const [rows, total, connection] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        branch: { select: { branchCode: true, name: true } },
        expenseAccount: { select: { code: true, name: true } },
        cashBankAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.expense.count({ where }),
    prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true } }),
  ]);
  const ids = rows.map((row) => row.id);
  const [mappings, events] = connection ? await Promise.all([
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: 'EXPENSE', localEntityId: { in: ids } },
    }),
    prisma.integrationEvent.findMany({
      where: { eventType: EXPENSE_PAID_EVENT, aggregateId: { in: ids } },
    }),
  ]) : [[], []];
  return {
    items: rows.map((row) => ({
      id: row.id,
      expenseNumber: row.expenseNumber,
      branch: row.branch,
      expenseDate: row.expenseDate,
      paidAt: row.paidAt,
      status: row.status,
      category: row.category,
      description: row.description,
      amount: row.amount.toFixed(2),
      expenseAccount: row.expenseAccount,
      cashBankAccount: row.cashBankAccount,
      hasEvidence: Boolean(row.evidenceFileUrl),
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

export async function getExpenseConfig(actorUserId: string) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const [expenseAccounts, cashBankAccounts, zohoAccounts, zohoBankAccounts, mappings] = await Promise.all([
    prisma.account.findMany({
      where: { type: 'EXPENSE', isActive: true, allowPosting: true },
      orderBy: { code: 'asc' },
    }),
    prisma.cashBankAccount.findMany({
      where: { isActive: true, ...(branchIds === null ? {} : { branchId: { in: branchIds } }) },
      include: { branch: { select: { branchCode: true, name: true } } },
      orderBy: { code: 'asc' },
    }),
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'ACCOUNT', isActive: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    }),
    prisma.zohoDiscoveryCache.findMany({
      where: { zohoConnectionId: connection.id, resourceType: 'BANK_ACCOUNT', isActive: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    }),
    prisma.zohoEntityMapping.findMany({
      where: { zohoConnectionId: connection.id, entityType: { in: ['GL_ACCOUNT', 'CASH_BANK_ACCOUNT'] } },
    }),
  ]);
  return {
    expenseAccounts: expenseAccounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      mapping: mappings.find((entry) =>
        entry.entityType === 'GL_ACCOUNT' && entry.localEntityId === account.code) || null,
    })),
    cashBankAccounts: cashBankAccounts.map((account) => ({
      ...account,
      mapping: mappings.find((entry) =>
        entry.entityType === 'CASH_BANK_ACCOUNT' && entry.localEntityId === account.id) || null,
    })),
    zohoAccounts: zohoAccounts.filter((account) => {
      const payload = metadata(account.payload);
      const accountType = String(payload.account_type || '').toLowerCase();
      return !accountType || ['expense', 'other_expense', 'cost_of_goods_sold'].includes(accountType);
    }),
    zohoBankAccounts,
  };
}

export async function saveExpenseAccountMapping(accountCode: string, zohoAccountId: string) {
  const connection = await prisma.zohoConnection.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!connection) throw new AppError(404, 'ZOHO_NOT_CONNECTED', 'Zoho Books belum terhubung.');
  const account = await prisma.zohoDiscoveryCache.findFirst({
    where: {
      zohoConnectionId: connection.id,
      resourceType: 'ACCOUNT',
      zohoId: zohoAccountId,
      isActive: true,
    },
  });
  if (!account) throw new AppError(422, 'ZOHO_EXPENSE_ACCOUNT_INVALID', 'Akun Zoho tidak tersedia pada discovery aktif.');
  const accountType = String(metadata(account.payload).account_type || '').toLowerCase();
  if (accountType && !['expense', 'other_expense', 'cost_of_goods_sold'].includes(accountType)) {
    throw new AppError(422, 'ZOHO_EXPENSE_ACCOUNT_TYPE_INVALID', 'Paid expense harus dipetakan ke akun beban Zoho.');
  }
  return saveGlAccountMapping(accountCode, zohoAccountId);
}

export function saveExpensePaidThroughMapping(
  actorUserId: string,
  cashBankAccountId: string,
  zohoAccountId: string,
) {
  return saveCashBankMapping(actorUserId, cashBankAccountId, zohoAccountId);
}

export async function reconcileExpenses(actorUserId: string) {
  const client = await getActiveZohoClient(true);
  const branchIds = await getAccessibleBranchIds(actorUserId);
  const expenses = await prisma.expense.findMany({
    where: {
      status: 'PAID',
      ...(branchIds === null ? {} : { branchId: { in: branchIds } }),
    },
    include: { expenseAccount: { select: { code: true } } },
    orderBy: { paidAt: 'desc' },
    take: 100,
  });
  const mappings = await prisma.zohoEntityMapping.findMany({
    where: {
      zohoConnectionId: client.connection.id,
      entityType: 'EXPENSE',
      localEntityId: { in: expenses.map((entry) => entry.id) },
      status: 'ACTIVE',
    },
  });
  const rows = await Promise.all(expenses.map(async (expense) => {
    const snapshot = buildExpensePaidSnapshot(expense, expense.paidAt!);
    const mapping = mappings.find((entry) => entry.localEntityId === expense.id);
    if (!mapping) {
      return {
        expenseId: expense.id,
        expenseNumber: expense.expenseNumber,
        result: reconcileExpense(snapshot),
      };
    }
    const response = await client.request<{ expense?: ZohoExpenseRemote }>(
      `/books/v3/expenses/${mapping.zohoEntityId}`,
    );
    return {
      expenseId: expense.id,
      expenseNumber: expense.expenseNumber,
      result: reconcileExpense(snapshot, response.expense),
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
