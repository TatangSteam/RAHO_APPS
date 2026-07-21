import {
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
  UpdateAccountingPeriodStatusInput,
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

async function findPostingPeriod(tx: DbClient, branchId: string, transactionDate: Date) {
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
    ? transitLine.debit.isPositive() && inventoryLine.credit.equals(transitLine.debit) && transitLine.credit.isZero() && inventoryLine.debit.isZero()
    : inventoryLine.debit.isPositive() && transitLine.credit.equals(inventoryLine.debit) && inventoryLine.credit.isZero() && transitLine.debit.isZero();
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
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`accounting-period:${scopeKey}`}))`);
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
