import {
  AccountType,
  AccountingPeriodStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { logAudit } from '@utils/auditLog';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
  hasPermission,
} from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import type {
  CreateAccountInput,
  CreateAccountingPeriodInput,
  ListAccountingPeriodsQuery,
  ListAccountsQuery,
  ListJournalsQuery,
  UpdateAccountInput,
  UpdateAccountingPeriodInput,
  UpdateAccountingPeriodStatusInput,
  ReverseManualJournalInput,
} from './accounting.schema';
import {
  PostJournalInput,
  ValidatedPosting,
  validateAndNormalizePosting,
} from './posting.contract';
import { createHash } from 'crypto';

type DbClient = Prisma.TransactionClient;

const journalInclude = {
  branch: { select: { id: true, branchCode: true, name: true } },
  accountingPeriod: { select: { id: true, name: true, fiscalYear: true, periodNo: true, status: true } },
  creator: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  lines: {
    include: { account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } } },
    orderBy: { lineNo: 'asc' as const },
  },
  sourceLinks: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.JournalEntryInclude;

function jsonValue(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

function formatJournal(entry: any) {
  return {
    ...entry,
    totalDebit: entry.totalDebit.toFixed(2),
    totalCredit: entry.totalCredit.toFixed(2),
    lines: entry.lines.map((line: any) => ({
      ...line,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
    })),
  };
}

function postingPayloadHash(posting: ValidatedPosting) {
  const payload = {
    transactionDate: posting.transactionDate.toISOString(),
    branchId: posting.branchId,
    description: posting.description,
    lines: posting.lines.map((line) => ({
      accountCode: line.accountCode,
      branchId: line.branchId,
      costCenterCode: line.costCenterCode || null,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
      description: line.description || null,
    })),
    sourceLinks: posting.sourceLinks.map((source) => ({
      sourceType: source.sourceType.trim().toUpperCase(),
      sourceId: source.sourceId,
      sourceNumber: source.sourceNumber || null,
      relationType: source.relationType?.trim().toUpperCase() || 'PRIMARY',
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function findPostingPeriod(tx: DbClient, branchId: string, transactionDate: Date) {
  const dateWhere = { startDate: { lte: transactionDate }, endDate: { gte: transactionDate } };
  const branchPeriod = await tx.accountingPeriod.findFirst({
    where: { scopeKey: branchId, ...dateWhere },
    orderBy: { periodNo: 'desc' },
  });
  const period = branchPeriod || await tx.accountingPeriod.findFirst({
    where: { scopeKey: 'GLOBAL', ...dateWhere },
    orderBy: { periodNo: 'desc' },
  });
  if (!period) {
    throw errors.unprocessable('ACCOUNTING_PERIOD_NOT_FOUND', 'Tidak ada periode akuntansi untuk tanggal transaksi.');
  }
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "accounting_periods" WHERE "id" = ${period.id} FOR SHARE`);
  const lockedPeriod = await tx.accountingPeriod.findUnique({ where: { id: period.id } });
  if (!lockedPeriod || lockedPeriod.status !== AccountingPeriodStatus.OPEN) {
    throw errors.unprocessable('ACCOUNTING_PERIOD_CLOSED', `Periode ${period.name} tidak lagi OPEN.`);
  }
  return lockedPeriod;
}

async function getPostingAccounts(tx: DbClient, accountCodes: string[]) {
  const initial = await tx.account.findMany({
    where: { code: { in: accountCodes }, isActive: true },
    select: { id: true },
  });
  if (initial.length) {
    const ids = initial.map((account) => account.id);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "accounts" WHERE "id" IN (${Prisma.join(ids)}) FOR SHARE`);
  }
  return tx.account.findMany({
    where: { code: { in: accountCodes }, isActive: true },
    select: { id: true, code: true, allowPosting: true },
  });
}

async function nextJournalNumber(tx: DbClient, branchId: string, transactionDate: Date) {
  const fiscalYear = transactionDate.getUTCFullYear();
  const [branch, sequence] = await Promise.all([
    tx.branch.findUnique({ where: { id: branchId }, select: { branchCode: true, isActive: true } }),
    tx.journalSequence.upsert({
      where: { scopeKey_fiscalYear: { scopeKey: branchId, fiscalYear } },
      create: { scopeKey: branchId, fiscalYear, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    }),
  ]);
  if (!branch?.isActive) throw errors.badRequest('BRANCH_NOT_FOUND', 'Cabang tidak ditemukan atau tidak aktif.');
  return `JE/${branch.branchCode}/${fiscalYear}/${String(sequence.lastNumber).padStart(6, '0')}`;
}

async function postWithinTransaction(tx: DbClient, posting: ValidatedPosting) {
  const payloadHash = postingPayloadHash(posting);
  const replay = await tx.journalEntry.findUnique({
    where: { postingKey: posting.postingKey },
    include: journalInclude,
  });
  if (replay) {
    if (replay.payloadHash !== payloadHash) {
      throw errors.conflict('POSTING_KEY_REUSED', 'Posting key sudah digunakan untuk payload jurnal yang berbeda.');
    }
    return { journal: formatJournal(replay), idempotentReplay: true };
  }

  const accountCodes = Array.from(new Set(posting.lines.map((line) => line.accountCode)));
  // Deterministic lock order: accounts -> period -> sequence.
  const accounts = await getPostingAccounts(tx, accountCodes);
  const period = await findPostingPeriod(tx, posting.branchId, posting.transactionDate);
  const journalNumber = await nextJournalNumber(tx, posting.branchId, posting.transactionDate);
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const missing = accountCodes.filter((code) => !accountByCode.has(code));
  if (missing.length) {
    throw errors.badRequest('ACCOUNT_NOT_FOUND', `Akun aktif tidak ditemukan: ${missing.join(', ')}.`);
  }
  const blocked = accounts.filter((account) => !account.allowPosting).map((account) => account.code);
  if (blocked.length) {
    throw errors.unprocessable('ACCOUNT_NOT_POSTABLE', `Akun tidak menerima posting: ${blocked.join(', ')}.`);
  }

  const journal = await tx.journalEntry.create({
    data: {
      journalNumber,
      postingKey: posting.postingKey,
      payloadHash,
      transactionDate: posting.transactionDate,
      description: posting.description,
      branchId: posting.branchId,
      accountingPeriodId: period.id,
      totalDebit: posting.totalDebit,
      totalCredit: posting.totalCredit,
      metadata: jsonValue(posting.metadata),
      createdBy: posting.actorUserId,
      postedBy: posting.actorUserId,
      lines: {
        create: posting.lines.map((line, index) => ({
          lineNo: index + 1,
          accountId: accountByCode.get(line.accountCode)!.id,
          branchId: line.branchId,
          costCenterCode: line.costCenterCode,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
          metadata: jsonValue(line.metadata),
        })),
      },
      sourceLinks: {
        create: posting.sourceLinks.map((source) => ({
          sourceType: source.sourceType.trim().toUpperCase(),
          sourceId: source.sourceId,
          sourceNumber: source.sourceNumber,
          relationType: source.relationType?.trim().toUpperCase() || 'PRIMARY',
          metadata: jsonValue(source.metadata),
        })),
      },
    },
    include: journalInclude,
  });

  await tx.auditLog.create({
    data: {
      userId: posting.actorUserId,
      branchId: posting.branchId,
      action: 'CREATE',
      module: 'ACCOUNTING',
      resource: 'JournalEntry',
      resourceId: journal.id,
      entityType: 'JournalEntry',
      entityId: journal.id,
      entityCode: journal.journalNumber,
      description: `Jurnal ${journal.journalNumber} diposting.`,
      afterData: jsonValue({
        postingKey: posting.postingKey,
        totalDebit: posting.totalDebit.toFixed(2),
        totalCredit: posting.totalCredit.toFixed(2),
        sourceLinks: posting.sourceLinks,
      }),
    },
  });
  return { journal: formatJournal(journal), idempotentReplay: false };
}

/**
 * Shared posting contract. Pass an existing Prisma transaction client when the
 * source event (for example inventory mutation) must commit atomically with finance.
 */
export async function postJournal(input: PostJournalInput, tx?: DbClient) {
  const posting = validateAndNormalizePosting(input);
  const scopedBranches = Array.from(new Set(posting.lines.map((line) => line.branchId)));
  for (const branchId of scopedBranches) {
    await assertBranchAccess(posting.actorUserId, branchId);
    await assertPermission(posting.actorUserId, PERMISSIONS.JOURNAL_POST, branchId);
  }
  if (tx) return postWithinTransaction(tx, posting);

  try {
    return await prisma.$transaction(
      (transaction) => postWithinTransaction(transaction, posting),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await prisma.journalEntry.findUnique({
        where: { postingKey: posting.postingKey },
        include: journalInclude,
      });
      if (replay) {
        if (replay.payloadHash !== postingPayloadHash(posting)) {
          throw errors.conflict('POSTING_KEY_REUSED', 'Posting key sudah digunakan untuk payload jurnal yang berbeda.');
        }
        return { journal: formatJournal(replay), idempotentReplay: true };
      }
    }
    throw error;
  }
}

export async function reverseManualJournalService(
  actorUserId: string,
  journalId: string,
  input: ReverseManualJournalInput,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "journal_entries" WHERE "id" = ${journalId} FOR UPDATE`);
    const original = await tx.journalEntry.findUnique({
      where: { id: journalId },
      include: journalInclude,
    });
    if (!original) throw errors.notFound('Jurnal tidak ditemukan.');
    await assertBranchAccess(actorUserId, original.branchId);
    await assertPermission(actorUserId, PERMISSIONS.JOURNAL_POST, original.branchId);
    if (original.status === 'REVERSED') {
      throw errors.conflict('JOURNAL_ALREADY_REVERSED', 'Jurnal ini sudah dibalik.');
    }
    const primarySource = original.sourceLinks.find((source) => source.relationType === 'PRIMARY');
    if (primarySource?.sourceType !== 'MANUAL_JOURNAL') {
      throw errors.conflict('SYSTEM_JOURNAL_REVERSAL_FORBIDDEN', 'Jurnal otomatis harus dikoreksi dari dokumen sumbernya.');
    }
    const posting = validateAndNormalizePosting({
      postingKey: `MANUAL_JOURNAL_REVERSAL:${input.requestId}`,
      transactionDate: input.transactionDate,
      branchId: original.branchId,
      actorUserId,
      description: `Reversal ${original.journalNumber}: ${input.reason}`,
      lines: original.lines.map((line) => ({
        accountCode: line.account.code,
        debit: line.credit,
        credit: line.debit,
        branchId: original.branchId,
        description: `Reversal: ${line.description || original.description}`,
      })),
      sourceLinks: [{
        sourceType: 'MANUAL_JOURNAL',
        sourceId: original.id,
        sourceNumber: original.journalNumber,
        relationType: 'REVERSAL',
      }],
      metadata: { originalJournalEntryId: original.id, reason: input.reason },
    });
    const reversed = await postWithinTransaction(tx, posting);
    await tx.journalEntry.update({
      where: { id: original.id },
      data: {
        status: 'REVERSED',
        reversedAt: input.transactionDate,
        reversedByEntryId: reversed.journal.id,
      },
    });
    return reversed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Posting jurnal turunan inventory. Endpoint jurnal umum tidak menggunakan jalur
 * ini; otorisasi mengikuti business event INVENTORY.POST dan source document wajib.
 */
export async function postInventoryDerivedJournal(input: PostJournalInput, tx: DbClient) {
  const posting = validateAndNormalizePosting(input, { allowCrossBranch: true });
  if (posting.sourceLinks.some((source) => source.sourceType.trim().toUpperCase() !== 'INTERNAL_TRANSFER')) {
    throw errors.badRequest('DERIVED_JOURNAL_SOURCE_INVALID', 'Jurnal turunan inventory wajib memakai source INTERNAL_TRANSFER.');
  }
  if (posting.sourceLinks.length !== 1 || posting.lines.length !== 2) {
    throw errors.badRequest('TRANSFER_JOURNAL_SHAPE_INVALID', 'Jurnal internal transfer wajib memiliki satu source dan dua baris.');
  }
  const relation = posting.sourceLinks[0].relationType?.trim().toUpperCase();
  if (relation !== 'DISPATCH' && relation !== 'RECEIPT') {
    throw errors.badRequest('TRANSFER_JOURNAL_RELATION_INVALID', 'Relation jurnal internal transfer harus DISPATCH atau RECEIPT.');
  }
  const lineByAccount = new Map(posting.lines.map((line) => [line.accountCode, line]));
  const inventoryLine = lineByAccount.get('1300');
  const transitLine = lineByAccount.get('1310');
  if (lineByAccount.size !== 2 || !inventoryLine || !transitLine) {
    throw errors.badRequest('TRANSFER_JOURNAL_ACCOUNT_INVALID', 'Jurnal internal transfer hanya boleh memakai account aset 1300 dan 1310.');
  }
  const directionValid = relation === 'DISPATCH'
    ? transitLine.debit.greaterThan(0) && inventoryLine.credit.equals(transitLine.debit) && transitLine.credit.isZero() && inventoryLine.debit.isZero()
    : inventoryLine.debit.greaterThan(0) && transitLine.credit.equals(inventoryLine.debit) && inventoryLine.credit.isZero() && transitLine.debit.isZero();
  if (!directionValid) {
    throw errors.badRequest('TRANSFER_JOURNAL_DIRECTION_INVALID', 'Arah debit/kredit jurnal internal transfer tidak sesuai posting policy.');
  }
  await assertBranchAccess(posting.actorUserId, posting.branchId);
  await assertPermission(posting.actorUserId, PERMISSIONS.INVENTORY_POST, posting.branchId);
  const derivedBranches = Array.from(new Set(posting.lines.map((line) => line.branchId))).filter((branchId) => branchId !== posting.branchId);
  for (const branchId of derivedBranches) {
    // The counter-branch line is system-derived from the immutable shipment,
    // but its accounting period must still be open.
    await findPostingPeriod(tx, branchId, posting.transactionDate);
  }
  return postWithinTransaction(tx, posting);
}

/** Strict posting path for approved inventory adjustment and stock opname. */
export async function postInventoryAdjustmentDerivedJournal(input: PostJournalInput, tx: DbClient) {
  const posting = validateAndNormalizePosting(input);
  if (posting.sourceLinks.length !== 1) {
    throw errors.badRequest('ADJUSTMENT_JOURNAL_SOURCE_INVALID', 'Jurnal adjustment wajib memiliki satu source document.');
  }
  const sourceType = posting.sourceLinks[0].sourceType.trim().toUpperCase();
  if (!['INVENTORY_ADJUSTMENT', 'STOCK_OPNAME', 'SHIPMENT_DISCREPANCY'].includes(sourceType)) {
    throw errors.badRequest('ADJUSTMENT_JOURNAL_SOURCE_INVALID', 'Source jurnal adjustment tidak didukung.');
  }
  const allowedRoles = new Set(['INVENTORY_IN', 'INVENTORY_OUT', 'GAIN', 'LOSS']);
  if (posting.lines.some((line) => !allowedRoles.has(String(line.metadata?.adjustmentRole)))) {
    throw errors.badRequest('ADJUSTMENT_JOURNAL_ROLE_INVALID', 'Role baris jurnal adjustment tidak valid.');
  }
  const sum = (role: string, side: 'debit' | 'credit') => posting.lines
    .filter((line) => line.metadata?.adjustmentRole === role)
    .reduce((total, line) => total.add(line[side]), new Prisma.Decimal(0));
  const inventoryDebit = sum('INVENTORY_IN', 'debit');
  const inventoryCredit = sum('INVENTORY_OUT', 'credit');
  const gainCredit = sum('GAIN', 'credit');
  const lossDebit = sum('LOSS', 'debit');
  const invalidDirection = posting.lines.some((line) => (
    (line.metadata?.adjustmentRole === 'GAIN' && (!line.debit.isZero() || !line.credit.greaterThan(0)))
    || (line.metadata?.adjustmentRole === 'LOSS' && (!line.credit.isZero() || !line.debit.greaterThan(0)))
    || (line.metadata?.adjustmentRole === 'INVENTORY_IN' && (line.accountCode !== '1300' || !line.debit.greaterThan(0) || !line.credit.isZero()))
    || (line.metadata?.adjustmentRole === 'INVENTORY_OUT' && (line.accountCode !== '1300' || !line.credit.greaterThan(0) || !line.debit.isZero()))
  ));
  if (invalidDirection || !inventoryDebit.equals(gainCredit) || !inventoryCredit.equals(lossDebit)
    || (!inventoryDebit.greaterThan(0) && !inventoryCredit.greaterThan(0))) {
    throw errors.badRequest(
      'ADJUSTMENT_JOURNAL_POLICY_INVALID',
      'Adjustment masuk harus debit inventory/kredit gain dan adjustment keluar harus debit loss/kredit inventory.',
    );
  }
  const accountCodes = [...new Set(posting.lines.map((line) => line.accountCode))];
  const accounts = await tx.account.findMany({ where: { code: { in: accountCodes }, isActive: true, allowPosting: true }, select: { code: true, type: true } });
  const accountTypes = new Map(accounts.map((account) => [account.code, account.type]));
  if (posting.lines.some((line) => {
    const role = String(line.metadata?.adjustmentRole);
    const expected = role.startsWith('INVENTORY_') ? AccountType.ASSET : role === 'GAIN' ? AccountType.REVENUE : AccountType.EXPENSE;
    return accountTypes.get(line.accountCode) !== expected;
  })) {
    throw errors.badRequest('ADJUSTMENT_JOURNAL_ACCOUNT_INVALID', 'Tipe akun jurnal adjustment tidak sesuai mapping reason code.');
  }
  await assertBranchAccess(posting.actorUserId, posting.branchId);
  await assertPermission(
    posting.actorUserId,
    sourceType === 'SHIPMENT_DISCREPANCY' ? PERMISSIONS.INVENTORY_DISCREPANCY_RESOLVE : PERMISSIONS.INVENTORY_ADJUSTMENT_POST,
    posting.branchId,
  );
  return postWithinTransaction(tx, posting);
}

/** Strict system-derived posting path for purchasing/AP source documents. */
export async function postPurchasingDerivedJournal(input: PostJournalInput, tx: DbClient) {
  const posting = validateAndNormalizePosting(input);
  if (posting.sourceLinks.length !== 1 || posting.lines.length !== 2) {
    throw errors.badRequest('PURCHASING_JOURNAL_SHAPE_INVALID', 'Jurnal purchasing wajib memiliki satu source dan dua baris.');
  }
  const sourceType = posting.sourceLinks[0].sourceType.trim().toUpperCase();
  const policy = {
    GOODS_RECEIPT: { debit: '1300', credit: '2110', permission: PERMISSIONS.GOODS_RECEIPT_POST },
    SUPPLIER_INVOICE: { debit: '2110', credit: '2100', permission: PERMISSIONS.AP_INVOICE_POST },
  }[sourceType];
  await assertBranchAccess(posting.actorUserId, posting.branchId);

  if (policy) {
    await assertPermission(posting.actorUserId, policy.permission, posting.branchId);
    const debit = posting.lines.find((line) => line.accountCode === policy.debit);
    const credit = posting.lines.find((line) => line.accountCode === policy.credit);
    if (!debit || !credit || !debit.debit.greaterThan(0) || !credit.credit.equals(debit.debit)
      || !debit.credit.isZero() || !credit.debit.isZero()) {
      throw errors.badRequest('PURCHASING_JOURNAL_POLICY_INVALID', `Posting ${sourceType} harus debit ${policy.debit} dan kredit ${policy.credit}.`);
    }
  } else if (sourceType === 'SUPPLIER_PAYMENT') {
    await assertPermission(posting.actorUserId, PERMISSIONS.AP_PAY, posting.branchId);
    const ap = posting.lines.find((line) => line.accountCode === '2100');
    const cashLine = posting.lines.find((line) => line.accountCode !== '2100');
    if (!ap || !cashLine || !ap.debit.greaterThan(0) || !cashLine.credit.equals(ap.debit)
      || !ap.credit.isZero() || !cashLine.debit.isZero()) {
      throw errors.badRequest('AP_PAYMENT_JOURNAL_POLICY_INVALID', 'Pembayaran supplier harus debit AP 2100 dan kredit akun kas/bank.');
    }
    const cashAccount = await tx.account.findUnique({ where: { code: cashLine.accountCode } });
    if (!cashAccount?.isActive || !cashAccount.allowPosting || cashAccount.type !== AccountType.ASSET) {
      throw errors.badRequest('AP_PAYMENT_CASH_ACCOUNT_INVALID', 'Akun kredit pembayaran supplier harus akun aset kas/bank aktif.');
    }
  } else {
    throw errors.badRequest('DERIVED_JOURNAL_SOURCE_INVALID', 'Source jurnal purchasing tidak didukung.');
  }
  return postWithinTransaction(tx, posting);
}

/** Strict system-derived posting path for an atomic treatment completion. */
export async function postTreatmentCompletionDerivedJournal(input: PostJournalInput, tx: DbClient) {
  const posting = validateAndNormalizePosting(input);
  const treatmentSources = posting.sourceLinks.filter(
    (source) => source.sourceType.trim().toUpperCase() === 'TREATMENT_SESSION',
  );
  const allowedSources = new Set(['TREATMENT_SESSION', 'INVENTORY_POSTING', 'DOMAIN_EVENT']);
  if (treatmentSources.length !== 1 || posting.sourceLinks.some(
    (source) => !allowedSources.has(source.sourceType.trim().toUpperCase()),
  )) {
    throw errors.badRequest(
      'TREATMENT_JOURNAL_SOURCE_INVALID',
      'Jurnal completion wajib memiliki satu source TREATMENT_SESSION dan hanya boleh menautkan posting inventory atau domain event terkait.',
    );
  }

  const roles = posting.lines.map((line) => String(line.metadata?.treatmentRole || ''));
  const allowedRoles = new Set(['DEFERRED_RELEASE', 'REVENUE', 'HPP', 'INVENTORY']);
  if (roles.some((role) => !allowedRoles.has(role))) {
    throw errors.badRequest(
      'TREATMENT_JOURNAL_ROLE_INVALID',
      'Setiap baris jurnal completion wajib memiliki treatment role yang valid.',
    );
  }
  const sum = (role: string, side: 'debit' | 'credit') => posting.lines
    .filter((line) => line.metadata?.treatmentRole === role)
    .reduce((total, line) => total.add(line[side]), new Prisma.Decimal(0));
  const deferredDebit = sum('DEFERRED_RELEASE', 'debit');
  const revenueCredit = sum('REVENUE', 'credit');
  const hppDebit = sum('HPP', 'debit');
  const inventoryCredit = sum('INVENTORY', 'credit');
  if (!deferredDebit.equals(revenueCredit) || !hppDebit.equals(inventoryCredit)
    || (!deferredDebit.greaterThan(0) && !hppDebit.greaterThan(0))) {
    throw errors.badRequest(
      'TREATMENT_JOURNAL_POLICY_INVALID',
      'Deferred release/revenue dan HPP/inventory harus berpasangan dan balanced.',
    );
  }
  if (posting.lines.some((line) => {
    const role = String(line.metadata?.treatmentRole);
    if (role === 'DEFERRED_RELEASE' || role === 'HPP') {
      return !line.debit.greaterThan(0) || !line.credit.isZero();
    }
    return !line.credit.greaterThan(0) || !line.debit.isZero();
  })) {
    throw errors.badRequest(
      'TREATMENT_JOURNAL_DIRECTION_INVALID',
      'Arah debit dan kredit jurnal treatment tidak valid.',
    );
  }
  const accountCodes = Array.from(new Set(posting.lines.map((line) => line.accountCode)));
  const accounts = await tx.account.findMany({
    where: { code: { in: accountCodes }, isActive: true, allowPosting: true },
    select: { code: true, type: true },
  });
  const accountByCode = new Map(accounts.map((account) => [account.code, account.type]));
  const typeForRole: Record<string, AccountType> = {
    DEFERRED_RELEASE: AccountType.LIABILITY,
    REVENUE: AccountType.REVENUE,
    HPP: AccountType.EXPENSE,
    INVENTORY: AccountType.ASSET,
  };
  if (posting.lines.some((line) => (
    accountByCode.get(line.accountCode) !== typeForRole[String(line.metadata?.treatmentRole)]
  ))) {
    throw errors.badRequest(
      'TREATMENT_JOURNAL_ACCOUNT_TYPE_INVALID',
      'Tipe akun jurnal treatment tidak sesuai posting policy.',
    );
  }
  if (posting.lines.some((line) => {
    const role = String(line.metadata?.treatmentRole);
    if (role === 'HPP') return line.accountCode !== '5100';
    if (role === 'INVENTORY') return line.accountCode !== '1300';
    return false;
  })) {
    throw errors.badRequest(
      'TREATMENT_HPP_ACCOUNT_INVALID',
      'Posting HPP harus debit 5100 dan kredit inventory 1300.',
    );
  }

  await assertBranchAccess(posting.actorUserId, posting.branchId);
  await assertPermission(posting.actorUserId, PERMISSIONS.TREATMENT_MATERIAL_CONSUME, posting.branchId);
  return postWithinTransaction(tx, posting);
}

/** Reverses the immutable completion journal inside the caller's transaction. */
export async function reverseTreatmentCompletionJournalInTransaction(input: {
  originalJournalEntryId: string;
  postingKey: string;
  transactionDate: Date;
  branchId: string;
  actorUserId: string;
  sessionId: string;
  sessionCode: string;
  reason: string;
}, tx: DbClient) {
  await assertBranchAccess(input.actorUserId, input.branchId);
  await assertPermission(input.actorUserId, PERMISSIONS.TREATMENT_COMPLETION_REVERSE, input.branchId);
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "journal_entries" WHERE "id" = ${input.originalJournalEntryId} FOR UPDATE
  `);
  const original = await tx.journalEntry.findUnique({
    where: { id: input.originalJournalEntryId },
    include: {
      ...journalInclude,
      lines: {
        include: { account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } } },
        orderBy: { lineNo: 'asc' },
      },
    },
  });
  if (!original || original.branchId !== input.branchId) {
    throw errors.notFound('Jurnal completion treatment tidak ditemukan.');
  }
  if (original.status === 'REVERSED') {
    if (!original.reversedByEntryId) {
      throw errors.conflict('JOURNAL_REVERSAL_TRACE_MISSING', 'Jurnal sudah dibalik tetapi referensi jurnal reversal tidak tersedia.');
    }
    const replay = await tx.journalEntry.findUnique({
      where: { id: original.reversedByEntryId },
      include: journalInclude,
    });
    if (!replay) throw errors.conflict('JOURNAL_REVERSAL_MISSING', 'Jurnal reversal tidak ditemukan.');
    return { journal: formatJournal(replay), idempotentReplay: true };
  }

  const reversalPosting = validateAndNormalizePosting({
    postingKey: input.postingKey,
    transactionDate: input.transactionDate,
    branchId: input.branchId,
    actorUserId: input.actorUserId,
    description: `Reversal ${original.journalNumber}: ${input.reason}`,
    lines: original.lines.map((line) => ({
      accountCode: line.account.code,
      debit: line.credit,
      credit: line.debit,
      branchId: line.branchId,
      costCenterCode: line.costCenterCode || undefined,
      description: `Reversal: ${line.description || original.description}`,
    })),
    sourceLinks: [{
      sourceType: 'TREATMENT_SESSION',
      sourceId: input.sessionId,
      sourceNumber: input.sessionCode,
      relationType: 'REVERSAL',
    }],
    metadata: {
      originalJournalEntryId: original.id,
      originalJournalNumber: original.journalNumber,
      reason: input.reason,
    },
  });
  const posted = await postWithinTransaction(tx, reversalPosting);
  await tx.journalEntry.update({
    where: { id: original.id },
    data: {
      status: 'REVERSED',
      reversedAt: input.transactionDate,
      reversedByEntryId: posted.journal.id,
    },
  });
  return posted;
}

/** Strict system-derived journal for an approved stock opname adjustment. */
export async function postStockOpnameJournal(input: PostJournalInput, tx: DbClient) {
  const posting = validateAndNormalizePosting(input);
  const source = posting.sourceLinks[0];
  if (posting.sourceLinks.length !== 1 || source.sourceType.trim().toUpperCase() !== 'STOCK_OPNAME') {
    throw errors.badRequest('STOCK_OPNAME_JOURNAL_SOURCE_INVALID', 'Jurnal opname wajib memakai satu source STOCK_OPNAME.');
  }
  const byRole = (role: string) => posting.lines.filter((line) => line.metadata?.opnameRole === role);
  const total = (role: string, side: 'debit' | 'credit') => byRole(role)
    .reduce((sum, line) => sum.add(line[side]), new Prisma.Decimal(0));
  const increase = total('INVENTORY_INCREASE', 'debit');
  const gain = total('ADJUSTMENT_GAIN', 'credit');
  const loss = total('ADJUSTMENT_LOSS', 'debit');
  const decrease = total('INVENTORY_DECREASE', 'credit');
  if (!increase.equals(gain) || !loss.equals(decrease) || (!increase.greaterThan(0) && !loss.greaterThan(0))) {
    throw errors.badRequest('STOCK_OPNAME_JOURNAL_POLICY_INVALID', 'Nilai adjustment masuk/keluar tidak balanced terhadap gain/loss.');
  }
  const accountPolicy: Record<string, { code: string; type: AccountType; side: 'debit' | 'credit' }> = {
    INVENTORY_INCREASE: { code: '1300', type: AccountType.ASSET, side: 'debit' },
    ADJUSTMENT_GAIN: { code: '4300', type: AccountType.REVENUE, side: 'credit' },
    ADJUSTMENT_LOSS: { code: '5300', type: AccountType.EXPENSE, side: 'debit' },
    INVENTORY_DECREASE: { code: '1300', type: AccountType.ASSET, side: 'credit' },
  };
  const accounts = await tx.account.findMany({
    where: { code: { in: ['1300', '4300', '5300'] }, isActive: true, allowPosting: true },
    select: { code: true, type: true },
  });
  const accountTypes = new Map(accounts.map((account) => [account.code, account.type]));
  if (posting.lines.some((line) => {
    const policy = accountPolicy[String(line.metadata?.opnameRole)];
    return !policy || line.accountCode !== policy.code || accountTypes.get(line.accountCode) !== policy.type
      || !line[policy.side].greaterThan(0) || !line[policy.side === 'debit' ? 'credit' : 'debit'].isZero();
  })) {
    throw errors.badRequest('STOCK_OPNAME_JOURNAL_ACCOUNT_INVALID', 'Akun atau arah posting stock opname tidak sesuai policy.');
  }
  await assertBranchAccess(posting.actorUserId, posting.branchId);
  await assertPermission(posting.actorUserId, PERMISSIONS.INVENTORY_ADJUSTMENT_POST, posting.branchId);
  return postWithinTransaction(tx, posting);
}

export async function listAccountsService(query: ListAccountsQuery) {
  return prisma.account.findMany({
    where: {
      ...(query.search ? { OR: [
        { code: { contains: query.search, mode: 'insensitive' as const } },
        { name: { contains: query.search, mode: 'insensitive' as const } },
      ] } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
      ...(query.allowPosting ? { allowPosting: query.allowPosting === 'true' } : {}),
    },
    include: { parent: { select: { id: true, code: true, name: true } }, _count: { select: { children: true, lines: true } } },
    orderBy: { code: 'asc' },
  });
}

export async function createAccountService(actorUserId: string, input: CreateAccountInput) {
  await assertPermission(actorUserId, PERMISSIONS.ACCOUNT_MANAGE);
  const parent = input.parentId
    ? await prisma.account.findUnique({ where: { id: input.parentId } })
    : null;
  if (input.parentId && !parent) throw errors.badRequest('ACCOUNT_PARENT_NOT_FOUND', 'Parent account tidak ditemukan.');
  if (parent && parent.type !== input.type) throw errors.badRequest('ACCOUNT_PARENT_TYPE_INVALID', 'Tipe parent account harus sama.');
  if (parent?.allowPosting) throw errors.unprocessable('ACCOUNT_PARENT_POSTABLE', 'Parent account harus dinonaktifkan untuk posting terlebih dahulu.');
  const account = await prisma.account.create({
    data: {
      code: input.code.toUpperCase(),
      name: input.name,
      type: input.type,
      normalBalance: input.normalBalance,
      parentId: input.parentId || null,
      level: parent ? parent.level + 1 : 1,
      allowPosting: input.allowPosting,
      isControl: input.isControl,
      description: input.description,
    } as Prisma.AccountUncheckedCreateInput,
  });
  await logAudit({ userId: actorUserId, action: 'CREATE', module: 'ACCOUNTING', resource: 'Account', resourceId: account.id, entityCode: account.code, afterData: account, description: `Akun ${account.code} dibuat.` });
  return account;
}

export async function updateAccountService(actorUserId: string, id: string, input: UpdateAccountInput) {
  await assertPermission(actorUserId, PERMISSIONS.ACCOUNT_MANAGE);
  const before = await prisma.account.findUnique({ where: { id }, include: { _count: { select: { children: true, lines: true } } } });
  if (!before) throw errors.notFound('Account tidak ditemukan.');
  if (input.allowPosting && before._count.children > 0) throw errors.unprocessable('ACCOUNT_HAS_CHILDREN', 'Account dengan child tidak boleh menerima posting.');
  const updated = await prisma.account.update({ where: { id }, data: input });
  await logAudit({ userId: actorUserId, action: 'UPDATE', module: 'ACCOUNTING', resource: 'Account', resourceId: id, entityCode: updated.code, beforeData: before, afterData: updated, description: `Akun ${updated.code} diperbarui.` });
  return updated;
}

export async function deleteAccountService(actorUserId: string, id: string) {
  await assertPermission(actorUserId, PERMISSIONS.ACCOUNT_MANAGE);
  const before = await prisma.account.findUnique({
    where: { id },
    include: { _count: { select: { children: true, lines: true } } },
  });
  if (!before) throw errors.notFound('Account tidak ditemukan.');
  if (before._count.children > 0) {
    throw errors.conflict('ACCOUNT_HAS_CHILDREN', 'Account masih memiliki child dan tidak dapat dihapus.');
  }
  if (before._count.lines > 0) {
    throw errors.conflict('ACCOUNT_ALREADY_POSTED', 'Account sudah digunakan dalam jurnal. Nonaktifkan account, jangan menghapusnya.');
  }
  try {
    await prisma.account.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw errors.conflict('ACCOUNT_IN_USE', 'Account sudah dipakai oleh modul lain. Nonaktifkan account, jangan menghapusnya.');
    }
    throw error;
  }
  await logAudit({ userId: actorUserId, action: 'DELETE', module: 'ACCOUNTING', resource: 'Account', resourceId: id, entityCode: before.code, beforeData: before, description: `Akun ${before.code} dihapus.` });
  return { id, deleted: true };
}

function normalizePeriodDates(startDate: Date, endDate: Date) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export async function createAccountingPeriodService(actorUserId: string, input: CreateAccountingPeriodInput) {
  if (input.branchId) {
    await assertBranchAccess(actorUserId, input.branchId);
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE, input.branchId);
  } else {
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE);
  }
  const { start, end } = normalizePeriodDates(input.startDate, input.endDate);
  const scopeKey = input.branchId || 'GLOBAL';
  const period = await prisma.$transaction(async (tx) => {
    // Prevent two concurrent requests in the same scope from both passing the
    // overlap check before either period is committed.
    // PostgreSQL returns `void` from pg_advisory_xact_lock. Cast it so Prisma
    // can deserialize the query result while the transaction-scoped lock is held.
    await tx.$queryRaw<{ lockResult: string | null }[]>(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`accounting-period:${scopeKey}`}))::text AS "lockResult"`,
    );
    const overlap = await tx.accountingPeriod.findFirst({
      where: { scopeKey, startDate: { lte: end }, endDate: { gte: start } },
    });
    if (overlap) throw errors.conflict('ACCOUNTING_PERIOD_OVERLAP', `Periode bertumpang tindih dengan ${overlap.name}.`);
    return tx.accountingPeriod.create({
      data: {
        name: input.name,
        fiscalYear: input.fiscalYear,
        periodNo: input.periodNo,
        startDate: start,
        endDate: end,
        branchId: input.branchId || null,
        scopeKey,
        createdBy: actorUserId,
      } as Prisma.AccountingPeriodUncheckedCreateInput,
      include: { branch: { select: { id: true, branchCode: true, name: true } } },
    });
  });
  await logAudit({ userId: actorUserId, branchId: input.branchId, action: 'CREATE', module: 'ACCOUNTING', resource: 'AccountingPeriod', resourceId: period.id, entityCode: `${period.fiscalYear}-${period.periodNo}`, afterData: period, description: `Periode ${period.name} dibuat.` });
  return period;
}

export async function updateAccountingPeriodService(actorUserId: string, id: string, input: UpdateAccountingPeriodInput) {
  const before = await prisma.accountingPeriod.findUnique({
    where: { id },
    include: { _count: { select: { journalEntries: true } } },
  });
  if (!before) throw errors.notFound('Periode akuntansi tidak ditemukan.');
  if (before.branchId) {
    await assertBranchAccess(actorUserId, before.branchId);
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE, before.branchId);
  } else {
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE);
  }
  if (before.status !== AccountingPeriodStatus.OPEN) {
    throw errors.conflict('ACCOUNTING_PERIOD_NOT_EDITABLE', 'Hanya periode OPEN yang dapat diedit.');
  }
  if (before._count.journalEntries > 0) {
    throw errors.conflict('ACCOUNTING_PERIOD_IN_USE', 'Periode sudah memiliki jurnal dan tidak dapat mengubah identitas atau tanggal.');
  }
  const start = input.startDate ? normalizePeriodDates(input.startDate, input.endDate || before.endDate).start : before.startDate;
  const end = input.endDate ? normalizePeriodDates(input.startDate || before.startDate, input.endDate).end : before.endDate;
  if (end < start) throw errors.badRequest('ACCOUNTING_PERIOD_DATE_INVALID', 'Tanggal akhir harus sama atau setelah tanggal mulai.');
  const fiscalYear = input.fiscalYear ?? before.fiscalYear;
  const periodNo = input.periodNo ?? before.periodNo;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<{ lockResult: string | null }[]>(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`accounting-period:${before.scopeKey}`}))::text AS "lockResult"`,
    );
    const overlap = await tx.accountingPeriod.findFirst({
      where: { id: { not: id }, scopeKey: before.scopeKey, startDate: { lte: end }, endDate: { gte: start } },
    });
    if (overlap) throw errors.conflict('ACCOUNTING_PERIOD_OVERLAP', `Periode bertumpang tindih dengan ${overlap.name}.`);
    return tx.accountingPeriod.update({
      where: { id },
      data: { name: input.name, fiscalYear, periodNo, startDate: start, endDate: end },
      include: { branch: { select: { id: true, branchCode: true, name: true } } },
    });
  });
  await logAudit({ userId: actorUserId, branchId: before.branchId, action: 'UPDATE', module: 'ACCOUNTING', resource: 'AccountingPeriod', resourceId: id, entityCode: `${updated.fiscalYear}-${updated.periodNo}`, beforeData: before, afterData: updated, description: `Periode ${before.name} diperbarui.` });
  return updated;
}

export async function deleteAccountingPeriodService(actorUserId: string, id: string) {
  const before = await prisma.accountingPeriod.findUnique({
    where: { id },
    include: { _count: { select: { journalEntries: true } } },
  });
  if (!before) throw errors.notFound('Periode akuntansi tidak ditemukan.');
  if (before.branchId) {
    await assertBranchAccess(actorUserId, before.branchId);
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE, before.branchId);
  } else {
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE);
  }
  if (before.status === AccountingPeriodStatus.LOCKED || before._count.journalEntries > 0) {
    throw errors.conflict('ACCOUNTING_PERIOD_IN_USE', 'Periode LOCKED atau yang sudah memiliki jurnal tidak dapat dihapus.');
  }
  await prisma.accountingPeriod.delete({ where: { id } });
  await logAudit({ userId: actorUserId, branchId: before.branchId, action: 'DELETE', module: 'ACCOUNTING', resource: 'AccountingPeriod', resourceId: id, entityCode: `${before.fiscalYear}-${before.periodNo}`, beforeData: before, description: `Periode ${before.name} dihapus.` });
  return { id, deleted: true };
}

export async function updateAccountingPeriodStatusService(actorUserId: string, id: string, input: UpdateAccountingPeriodStatusInput) {
  const before = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!before) throw errors.notFound('Periode akuntansi tidak ditemukan.');
  if (before.branchId) {
    await assertBranchAccess(actorUserId, before.branchId);
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE, before.branchId);
  } else {
    await assertPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_MANAGE);
  }
  if (before.status === AccountingPeriodStatus.LOCKED && input.status !== AccountingPeriodStatus.LOCKED) {
    throw errors.unprocessable('ACCOUNTING_PERIOD_LOCKED', 'Periode LOCKED tidak dapat dibuka kembali melalui API umum.');
  }
  const updated = await prisma.accountingPeriod.update({
    where: { id },
    data: {
      status: input.status,
      closedAt: input.status === AccountingPeriodStatus.OPEN ? null : new Date(),
      closedBy: input.status === AccountingPeriodStatus.OPEN ? null : actorUserId,
    },
  });
  await logAudit({ userId: actorUserId, branchId: before.branchId, action: 'UPDATE', module: 'ACCOUNTING', resource: 'AccountingPeriod', resourceId: id, entityCode: `${before.fiscalYear}-${before.periodNo}`, beforeData: before, afterData: { ...updated, reason: input.reason }, description: `Status periode ${before.name} menjadi ${input.status}.` });
  return updated;
}

export async function listAccountingPeriodsService(actorUserId: string, query: ListAccountingPeriodsQuery) {
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const accessible = await getAccessibleBranchIds(actorUserId);
  const candidates = accessible === null
    ? (await prisma.branch.findMany({ select: { id: true } })).map((branch) => branch.id)
    : accessible;
  const permittedBranches = (await Promise.all(candidates.map(async (branchId) =>
    (await hasPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_READ, branchId)) ? branchId : null
  ))).filter((branchId): branchId is string => Boolean(branchId));
  const globalAllowed = await hasPermission(actorUserId, PERMISSIONS.ACCOUNTING_PERIOD_READ);
  if (query.branchId && !permittedBranches.includes(query.branchId)) {
    throw errors.forbidden('Anda tidak memiliki akses periode cabang ini.');
  }
  const scopeFilter: Prisma.AccountingPeriodWhereInput = query.branchId
    ? { OR: [
        { branchId: query.branchId },
        ...(globalAllowed ? [{ branchId: null }] : []),
      ] }
    : { OR: [
        { branchId: { in: permittedBranches } },
        ...(globalAllowed ? [{ branchId: null }] : []),
      ] };
  return prisma.accountingPeriod.findMany({
    where: {
      ...(query.fiscalYear ? { fiscalYear: query.fiscalYear } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...scopeFilter,
    },
    include: { branch: { select: { id: true, branchCode: true, name: true } } },
    orderBy: [{ fiscalYear: 'desc' }, { periodNo: 'desc' }, { scopeKey: 'asc' }],
  });
}

async function getReadableJournalBranchIds(userId: string) {
  const accessible = await getAccessibleBranchIds(userId);
  const candidates = accessible === null
    ? (await prisma.branch.findMany({ select: { id: true } })).map((branch) => branch.id)
    : accessible;
  return (await Promise.all(candidates.map(async (branchId) =>
    (await hasPermission(userId, PERMISSIONS.JOURNAL_READ, branchId)) ? branchId : null
  ))).filter((branchId): branchId is string => Boolean(branchId));
}

export async function listJournalsService(actorUserId: string, query: ListJournalsQuery) {
  const branchIds = await getReadableJournalBranchIds(actorUserId);
  if (query.branchId && !branchIds.includes(query.branchId)) throw errors.forbidden('Anda tidak memiliki akses jurnal cabang ini.');
  const where: Prisma.JournalEntryWhereInput = {
    branchId: query.branchId || { in: branchIds },
    ...(query.accountCode ? { lines: { some: { account: { code: query.accountCode } } } } : {}),
    ...(query.sourceType || query.sourceId ? { sourceLinks: { some: {
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
    } } } : {}),
    ...(query.startDate || query.endDate ? { transactionDate: {
      ...(query.startDate ? { gte: query.startDate } : {}),
      ...(query.endDate ? { lte: query.endDate } : {}),
    } } : {}),
    ...(query.search ? { OR: [
      { journalNumber: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { sourceLinks: { some: { sourceNumber: { contains: query.search, mode: 'insensitive' } } } },
    ] } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [total, rows] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({ where, include: journalInclude, orderBy: [{ transactionDate: 'desc' }, { journalNumber: 'desc' }], skip, take: query.limit }),
  ]);
  return { data: rows.map(formatJournal), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function getJournalService(actorUserId: string, id: string) {
  const journal = await prisma.journalEntry.findUnique({ where: { id }, include: journalInclude });
  if (!journal) throw errors.notFound('Jurnal tidak ditemukan.');
  await assertBranchAccess(actorUserId, journal.branchId);
  await assertPermission(actorUserId, PERMISSIONS.JOURNAL_READ, journal.branchId);
  return formatJournal(journal);
}

export async function getJournalsBySourceService(actorUserId: string, sourceType: string, sourceId: string) {
  const branchIds = await getReadableJournalBranchIds(actorUserId);
  const rows = await prisma.journalEntry.findMany({
    where: { branchId: { in: branchIds }, sourceLinks: { some: { sourceType: sourceType.toUpperCase(), sourceId } } },
    include: journalInclude,
    orderBy: { postedAt: 'asc' },
  });
  return rows.map(formatJournal);
}
