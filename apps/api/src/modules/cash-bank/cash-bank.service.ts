import { AccountType, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds, hasPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { logAudit } from '@utils/auditLog';
import type { CreateCashBankAccountInput, ListCashBankAccountsQuery, ListCashBankTransactionsQuery } from './cash-bank.schema';

async function readableBranches(userId: string) {
  const accessible = await getAccessibleBranchIds(userId);
  const candidates = accessible === null
    ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((branch) => branch.id)
    : accessible;
  return (await Promise.all(candidates.map(async (branchId) =>
    (await hasPermission(userId, PERMISSIONS.CASH_BANK_READ, branchId)) ? branchId : null
  ))).filter((id): id is string => Boolean(id));
}

export async function createCashBankAccount(userId: string, input: CreateCashBankAccountInput) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.CASH_BANK_MANAGE, input.branchId);
  const account = await prisma.account.findUnique({ where: { code: input.coaAccountCode.toUpperCase() } });
  if (!account || !account.isActive || !account.allowPosting || account.type !== AccountType.ASSET) {
    throw errors.badRequest('CASH_BANK_COA_INVALID', 'COA kas/bank harus berupa akun aset aktif yang menerima posting.');
  }
  const created = await prisma.cashBankAccount.create({
    data: {
      code: input.code.toUpperCase(),
      name: input.name,
      type: input.type,
      branchId: input.branchId,
      coaAccountId: account.id,
      currency: input.currency.toUpperCase(),
      bankName: input.bankName,
      accountNumber: input.accountNumber,
      accountHolderName: input.accountHolderName,
      requiresReference: input.requiresReference,
      createdBy: userId,
    },
    include: { branch: true, coaAccount: { select: { code: true, name: true } } },
  });
  await logAudit({ userId, branchId: input.branchId, action: 'CREATE', module: 'CASH_BANK', resource: 'CashBankAccount', resourceId: created.id, entityCode: created.code, afterData: created, description: `Akun kas/bank ${created.code} dibuat.` });
  return created;
}

export async function listCashBankAccounts(userId: string, query: ListCashBankAccountsQuery) {
  const branchIds = await readableBranches(userId);
  if (query.branchId && !branchIds.includes(query.branchId)) throw errors.forbidden('Tidak memiliki akses akun kas/bank cabang ini.');
  return prisma.cashBankAccount.findMany({
    where: {
      branchId: query.branchId || { in: branchIds },
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
    },
    include: { branch: { select: { id: true, branchCode: true, name: true } }, coaAccount: { select: { code: true, name: true } } },
    orderBy: [{ branch: { branchCode: 'asc' } }, { code: 'asc' }],
  });
}

export async function listCashBankTransactions(userId: string, query: ListCashBankTransactionsQuery) {
  const branchIds = await readableBranches(userId);
  if (query.branchId && !branchIds.includes(query.branchId)) throw errors.forbidden('Tidak memiliki akses ledger kas/bank cabang ini.');
  const where: Prisma.CashBankTransactionWhereInput = {
    branchId: query.branchId || { in: branchIds },
    ...(query.cashBankAccountId ? { cashBankAccountId: query.cashBankAccountId } : {}),
    ...(query.startDate || query.endDate ? { transactionDate: {
      ...(query.startDate ? { gte: query.startDate } : {}),
      ...(query.endDate ? { lte: query.endDate } : {}),
    } } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [total, rows] = await Promise.all([
    prisma.cashBankTransaction.count({ where }),
    prisma.cashBankTransaction.findMany({
      where,
      include: {
        cashBankAccount: { select: { code: true, name: true, type: true } },
        branch: { select: { branchCode: true, name: true } },
        journalEntry: { select: { id: true, journalNumber: true } },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return {
    data: rows.map((row) => ({ ...row, amount: row.amount.toFixed(2) })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}
