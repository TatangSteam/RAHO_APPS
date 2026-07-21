import { createHash, randomUUID } from 'crypto';
import { AccountType, ExpenseStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds, hasPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postJournal } from '@modules/accounting/accounting.service';
import { extractKeyFromUrl, getPresignedUrl } from '@config/minio';
import { logAudit } from '@utils/auditLog';
import type { CreateExpenseInput, ListExpensesQuery } from './expense.schema';

interface ExpenseEvidence {
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  checksum?: string;
}

const includeExpense = {
  branch: { select: { id: true, branchCode: true, name: true } },
  expenseAccount: { select: { code: true, name: true } },
  cashBankAccount: { select: { code: true, name: true, type: true, coaAccount: { select: { code: true, name: true } } } },
  creator: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  reviewer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  payer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  journalEntry: { select: { id: true, journalNumber: true } },
  cashBankTransaction: { select: { id: true, transactionNumber: true } },
} satisfies Prisma.ExpenseInclude;

function hashPayload(input: CreateExpenseInput, evidence: ExpenseEvidence) {
  return createHash('sha256').update(JSON.stringify({ ...input, expenseDate: input.expenseDate.toISOString(), evidenceChecksum: evidence.checksum || null })).digest('hex');
}

function formatExpense(row: any) {
  return {
    ...row,
    amount: row.amount.toFixed(2),
    evidenceFileUrl: row.evidenceFileUrl ? `/expenses/${row.id}/evidence` : undefined,
  };
}

async function readableBranches(userId: string) {
  const accessible = await getAccessibleBranchIds(userId);
  const candidates = accessible === null
    ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((branch) => branch.id)
    : accessible;
  return (await Promise.all(candidates.map(async (branchId) =>
    (await hasPermission(userId, PERMISSIONS.EXPENSE_READ, branchId)) ? branchId : null
  ))).filter((id): id is string => Boolean(id));
}

export async function createExpense(userId: string, input: CreateExpenseInput, evidence: ExpenseEvidence) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.EXPENSE_CREATE, input.branchId);
  const hash = hashPayload(input, evidence);
  const replay = await prisma.expense.findUnique({ where: { postingKey: input.postingKey }, include: includeExpense });
  if (replay) {
    if (replay.payloadHash !== hash) throw errors.conflict('EXPENSE_KEY_REUSED', 'Posting key expense digunakan untuk payload berbeda.');
    return { expense: formatExpense(replay), idempotentReplay: true };
  }
  const [account, cashBank, branch] = await Promise.all([
    prisma.account.findUnique({ where: { code: input.expenseAccountCode.toUpperCase() } }),
    prisma.cashBankAccount.findUnique({ where: { id: input.cashBankAccountId } }),
    prisma.branch.findUnique({ where: { id: input.branchId }, select: { branchCode: true } }),
  ]);
  if (!account?.isActive || !account.allowPosting || account.type !== AccountType.EXPENSE) {
    throw errors.badRequest('EXPENSE_ACCOUNT_INVALID', 'Expense account harus berupa akun beban aktif yang menerima posting.');
  }
  if (!cashBank?.isActive || cashBank.branchId !== input.branchId) {
    throw errors.badRequest('EXPENSE_CASH_BANK_INVALID', 'Akun kas/bank tidak aktif atau bukan milik cabang expense.');
  }
  if (!branch) throw errors.notFound('Branch tidak ditemukan.');
  const amount = new Prisma.Decimal(input.amount);
  const expense = await prisma.expense.create({
    data: {
      expenseNumber: `EXP/${branch.branchCode}/${input.expenseDate.getUTCFullYear()}/${randomUUID().slice(0, 8).toUpperCase()}`,
      postingKey: input.postingKey,
      payloadHash: hash,
      branchId: input.branchId,
      expenseDate: input.expenseDate,
      category: input.category,
      description: input.description,
      amount,
      expenseAccountId: account.id,
      cashBankAccountId: cashBank.id,
      evidenceFileUrl: evidence.fileUrl || null,
      evidenceFileName: evidence.fileName || null,
      evidenceFileSize: evidence.fileSize || null,
      evidenceMimeType: evidence.mimeType || null,
      evidenceChecksum: evidence.checksum || null,
      createdBy: userId,
    },
    include: includeExpense,
  });
  await logAudit({ userId, branchId: expense.branchId, action: 'CREATE', resource: 'Expense', resourceId: expense.id, entityCode: expense.expenseNumber, afterData: { status: expense.status, amount: expense.amount, category: expense.category } });
  return { expense: formatExpense(expense), idempotentReplay: false };
}

export async function submitExpense(userId: string, id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw errors.notFound('Expense tidak ditemukan.');
  await assertBranchAccess(userId, expense.branchId);
  await assertPermission(userId, PERMISSIONS.EXPENSE_CREATE, expense.branchId);
  if (expense.createdBy !== userId) throw errors.forbidden('Hanya maker yang dapat mengajukan expense.');
  if (expense.status !== ExpenseStatus.DRAFT && expense.status !== ExpenseStatus.REJECTED) throw errors.conflict('EXPENSE_STATUS_INVALID', 'Expense tidak dapat diajukan dari status ini.');
  if (!expense.evidenceFileUrl) throw errors.unprocessable('EXPENSE_EVIDENCE_REQUIRED', 'Evidence expense wajib sebelum diajukan.');
  const updated = await prisma.expense.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null } });
  await logAudit({ userId, branchId: expense.branchId, action: 'UPDATE', resource: 'Expense', resourceId: id, entityCode: expense.expenseNumber, beforeData: { status: expense.status }, afterData: { status: updated.status } });
  return updated;
}

export async function approveExpense(userId: string, id: string, note?: string) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw errors.notFound('Expense tidak ditemukan.');
  await assertBranchAccess(userId, expense.branchId);
  await assertPermission(userId, PERMISSIONS.EXPENSE_APPROVE, expense.branchId);
  if (expense.createdBy === userId) throw errors.forbidden('Maker tidak boleh menyetujui expense sendiri.');
  if (expense.status !== ExpenseStatus.SUBMITTED) throw errors.conflict('EXPENSE_NOT_SUBMITTED', 'Expense belum diajukan.');
  const updated = await prisma.expense.update({ where: { id }, data: { status: 'APPROVED', approvalNote: note || null, reviewedBy: userId, reviewedAt: new Date() } });
  await logAudit({ userId, branchId: expense.branchId, action: 'STATUS_CHANGE', resource: 'Expense', resourceId: id, entityCode: expense.expenseNumber, beforeData: { status: expense.status }, afterData: { status: updated.status, approvalNote: note || null } });
  return updated;
}

export async function rejectExpense(userId: string, id: string, reason: string) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw errors.notFound('Expense tidak ditemukan.');
  await assertBranchAccess(userId, expense.branchId);
  await assertPermission(userId, PERMISSIONS.EXPENSE_APPROVE, expense.branchId);
  if (expense.createdBy === userId) throw errors.forbidden('Maker tidak boleh menolak expense sendiri.');
  if (expense.status !== ExpenseStatus.SUBMITTED) throw errors.conflict('EXPENSE_NOT_SUBMITTED', 'Expense belum diajukan.');
  const updated = await prisma.expense.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason, reviewedBy: userId, reviewedAt: new Date() } });
  await logAudit({ userId, branchId: expense.branchId, action: 'STATUS_CHANGE', resource: 'Expense', resourceId: id, entityCode: expense.expenseNumber, beforeData: { status: expense.status }, afterData: { status: updated.status, rejectionReason: reason } });
  return updated;
}

export async function payExpense(userId: string, id: string) {
  const candidate = await prisma.expense.findUnique({ where: { id }, select: { branchId: true } });
  if (!candidate) throw errors.notFound('Expense tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.EXPENSE_PAY, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.JOURNAL_POST, candidate.branchId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "expenses" WHERE "id" = ${id} FOR UPDATE`);
    const expense = await tx.expense.findUnique({
      where: { id },
      include: { expenseAccount: true, cashBankAccount: { include: { coaAccount: true } }, cashBankTransaction: true },
    });
    if (!expense) throw errors.notFound('Expense tidak ditemukan.');
    if (expense.status === ExpenseStatus.PAID) return { expense: formatExpense(await tx.expense.findUniqueOrThrow({ where: { id }, include: includeExpense })), idempotentReplay: true };
    if (expense.status !== ExpenseStatus.APPROVED) throw errors.conflict('EXPENSE_NOT_APPROVED', 'Expense belum disetujui.');
    if (!expense.cashBankAccount.isActive || !expense.cashBankAccount.coaAccount.allowPosting) throw errors.unprocessable('EXPENSE_CASH_BANK_NOT_POSTABLE', 'Akun kas/bank expense tidak dapat diposting.');

    const posted = await postJournal({
      postingKey: `EXPENSE:${expense.id}`,
      transactionDate: expense.expenseDate,
      branchId: expense.branchId,
      actorUserId: userId,
      description: expense.description,
      lines: [
        { accountCode: expense.expenseAccount.code, debit: expense.amount },
        { accountCode: expense.cashBankAccount.coaAccount.code, credit: expense.amount },
      ],
      sourceLinks: [{ sourceType: 'EXPENSE', sourceId: expense.id, sourceNumber: expense.expenseNumber }],
      metadata: { category: expense.category, cashBankAccountId: expense.cashBankAccountId },
    }, tx);
    const paidAt = new Date();
    const cashTransaction = await tx.cashBankTransaction.create({
      data: {
        transactionNumber: `CBP/${expense.id}`,
        postingKey: `EXPENSE:${expense.id}`,
        cashBankAccountId: expense.cashBankAccountId,
        branchId: expense.branchId,
        transactionDate: expense.expenseDate,
        type: 'PAYMENT',
        amount: expense.amount,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        sourceNumber: expense.expenseNumber,
        journalEntryId: posted.journal.id,
        description: expense.description,
        createdBy: userId,
      },
    });
    await tx.expense.update({ where: { id }, data: { status: 'PAID', paidBy: userId, paidAt, journalEntryId: posted.journal.id, cashBankTransactionId: cashTransaction.id } });
    await tx.auditLog.create({
      data: {
        userId,
        branchId: expense.branchId,
        action: 'STATUS_CHANGE',
        module: 'EXPENSE',
        resource: 'Expense',
        resourceId: expense.id,
        entityType: 'Expense',
        entityId: expense.id,
        entityCode: expense.expenseNumber,
        afterData: { status: 'PAID', journalEntryId: posted.journal.id, cashBankTransactionId: cashTransaction.id } as Prisma.InputJsonValue,
        description: `Expense ${expense.expenseNumber} dibayar dan diposting.`,
      },
    });
    return { expense: formatExpense(await tx.expense.findUniqueOrThrow({ where: { id }, include: includeExpense })), journal: posted.journal, idempotentReplay: false };
  });
}

export async function listExpenses(userId: string, query: ListExpensesQuery) {
  const branches = await readableBranches(userId);
  if (query.branchId && !branches.includes(query.branchId)) throw errors.forbidden('Tidak memiliki akses expense cabang ini.');
  const rows = await prisma.expense.findMany({
    where: { branchId: query.branchId || { in: branches }, ...(query.status ? { status: query.status } : {}) },
    include: includeExpense,
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(formatExpense);
}

export async function getExpenseEvidence(userId: string, id: string) {
  const expense = await prisma.expense.findUnique({ where: { id }, select: { branchId: true, evidenceFileUrl: true } });
  if (!expense?.evidenceFileUrl) throw errors.notFound('Evidence expense tidak ditemukan.');
  await assertBranchAccess(userId, expense.branchId);
  await assertPermission(userId, PERMISSIONS.EXPENSE_READ, expense.branchId);
  return { url: await getPresignedUrl(extractKeyFromUrl(expense.evidenceFileUrl), 300), expiresIn: 300 };
}
