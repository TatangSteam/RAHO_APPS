import { createHash, randomUUID } from 'crypto';
import { OpeningBalanceStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds, hasPermission } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postJournal } from '@modules/accounting/accounting.service';
import { receiveOpeningInventoryInTransaction } from '@modules/inventory/services/inventory-ledger.service';
import { resolveBranchInventoryScope } from '@modules/inventory/services/inventory-scope.service';
import { logAudit } from '@utils/auditLog';
import type { CreateOpeningBalanceInput, ListOpeningBalancesQuery, UpdateOpeningBalanceInput } from './opening-balance.schema';
import { calculateOpeningTotals, hasExactCurrencyPrecision, openingInventoryValue } from './opening-balance.helpers';

const includeOpening = {
  branch: { select: { id: true, branchCode: true, name: true } },
  creator: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  reviewer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
  journalEntry: { select: { id: true, journalNumber: true } },
  lines: {
    include: {
      account: { select: { code: true, name: true, type: true } },
      cashBankAccount: { select: { code: true, name: true, type: true } },
      inventoryItem: { include: { masterProduct: { select: { sku: true, name: true } } } },
      inventoryPosting: { select: { id: true, postingNumber: true, totalCost: true } },
      cashBankTransaction: { select: { id: true, transactionNumber: true } },
    },
    orderBy: { lineNo: 'asc' as const },
  },
} satisfies Prisma.OpeningBalanceInclude;

function payloadHash(input: CreateOpeningBalanceInput) {
  return createHash('sha256').update(JSON.stringify(input, (_key, value) => value instanceof Date ? value.toISOString() : value)).digest('hex');
}

type OpeningBalanceWithDetails = Prisma.OpeningBalanceGetPayload<{ include: typeof includeOpening }>;

function formatOpening(row: OpeningBalanceWithDetails) {
  return {
    ...row,
    totalDebit: row.totalDebit.toFixed(2),
    totalCredit: row.totalCredit.toFixed(2),
    lines: row.lines.map((line) => ({
      ...line,
      accountCode: line.account.code,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
      quantity: line.quantity?.toFixed(4),
      unitCost: line.unitCost?.toFixed(4),
      inventoryPosting: line.inventoryPosting ? { ...line.inventoryPosting, totalCost: line.inventoryPosting.totalCost.toFixed(4) } : null,
    })),
  };
}

async function readableBranches(userId: string) {
  const accessible = await getAccessibleBranchIds(userId);
  const candidates = accessible === null
    ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((branch) => branch.id)
    : accessible;
  return (await Promise.all(candidates.map(async (branchId) =>
    (await hasPermission(userId, PERMISSIONS.OPENING_BALANCE_READ, branchId)) ? branchId : null
  ))).filter((id): id is string => Boolean(id));
}

export async function createOpeningBalance(userId: string, input: CreateOpeningBalanceInput) {
  await assertBranchAccess(userId, input.branchId);
  await assertPermission(userId, PERMISSIONS.OPENING_BALANCE_MANAGE, input.branchId);
  const hash = payloadHash(input);
  const replay = await prisma.openingBalance.findUnique({ where: { postingKey: input.postingKey }, include: includeOpening });
  if (replay) {
    if (replay.payloadHash !== hash) throw errors.conflict('OPENING_KEY_REUSED', 'Posting key opening balance digunakan untuk payload berbeda.');
    return { openingBalance: formatOpening(replay), idempotentReplay: true };
  }

  const accountCodes = [...new Set(input.lines.map((line) => line.accountCode.toUpperCase()))];
  const accounts = await prisma.account.findMany({ where: { code: { in: accountCodes }, isActive: true, allowPosting: true } });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const missing = accountCodes.filter((code) => !accountByCode.has(code));
  if (missing.length) throw errors.badRequest('OPENING_ACCOUNT_INVALID', `Account tidak aktif/postable: ${missing.join(', ')}.`);

  const { debit: totalDebit, credit: totalCredit } = calculateOpeningTotals(input.lines);
  const inventoryScope = input.lines.some((line) => line.type === 'INVENTORY')
    ? await prisma.$transaction((tx) => resolveBranchInventoryScope(tx, input.branchId, userId))
    : null;
  const normalized: Prisma.OpeningBalanceLineUncheckedCreateWithoutOpeningBalanceInput[] = [];
  for (const [index, line] of input.lines.entries()) {
    const debit = new Prisma.Decimal(line.debit);
    const credit = new Prisma.Decimal(line.credit);
    const account = accountByCode.get(line.accountCode.toUpperCase())!;

    if (line.type === 'CASH_BANK') {
      const cash = await prisma.cashBankAccount.findUnique({ where: { id: line.cashBankAccountId! } });
      if (!cash?.isActive || cash.branchId !== input.branchId || cash.coaAccountId !== account.id || !credit.isZero()) {
        throw errors.badRequest('OPENING_CASH_INVALID', `Line ${index + 1}: akun kas/bank, COA, branch, atau sisi debit tidak valid.`);
      }
    }
    if (line.type === 'INVENTORY') {
      const item = await prisma.inventoryItem.findUnique({ where: { id: line.inventoryItemId! } });
      const quantity = new Prisma.Decimal(line.quantity!);
      const unitCost = new Prisma.Decimal(line.unitCost!);
      if (!item || item.branchId !== input.branchId || !inventoryScope || !credit.isZero()) {
        throw errors.badRequest('OPENING_INVENTORY_INVALID', `Line ${index + 1}: item, cabang, atau sisi debit tidak valid.`);
      }
      const inventoryValue = openingInventoryValue(quantity, unitCost);
      if (!hasExactCurrencyPrecision(inventoryValue) || !inventoryValue.equals(debit)) {
        throw errors.unprocessable('OPENING_INVENTORY_VALUE_MISMATCH', `Line ${index + 1}: quantity × unit cost harus tepat dua desimal dan sama dengan debit.`);
      }
    }
    normalized.push({
      lineNo: index + 1,
      type: line.type,
      accountId: account.id,
      description: line.description,
      debit,
      credit,
      counterpartyRef: line.counterpartyRef,
      cashBankAccountId: line.cashBankAccountId,
      inventoryItemId: line.inventoryItemId,
      stockLocationId: line.type === 'INVENTORY' ? inventoryScope!.location.id : undefined,
      quantity: line.quantity ? new Prisma.Decimal(line.quantity) : null,
      unitCost: line.unitCost ? new Prisma.Decimal(line.unitCost) : null,
      batchNumber: line.batchNumber,
      manufactureDate: line.manufactureDate,
      expiryDate: line.expiryDate,
    });
  }
  if (!totalDebit.equals(totalCredit) || totalDebit.lessThanOrEqualTo(0)) {
    throw errors.unprocessable('OPENING_NOT_BALANCED', `Opening balance tidak seimbang: debit ${totalDebit.toFixed(2)}, kredit ${totalCredit.toFixed(2)}.`);
  }
  const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { branchCode: true } });
  if (!branch) throw errors.notFound('Branch tidak ditemukan.');
  const documentNumber = `OB/${branch.branchCode}/${input.balanceDate.getUTCFullYear()}/${randomUUID().slice(0, 8).toUpperCase()}`;
  const created = await prisma.openingBalance.create({
    data: {
      documentNumber,
      postingKey: input.postingKey,
      payloadHash: hash,
      branchId: input.branchId,
      balanceDate: input.balanceDate,
      description: input.description,
      totalDebit,
      totalCredit,
      createdBy: userId,
      lines: { create: normalized },
    },
    include: includeOpening,
  });
  await logAudit({ userId, branchId: created.branchId, action: 'CREATE', resource: 'OpeningBalance', resourceId: created.id, entityCode: created.documentNumber, afterData: { status: created.status, totalDebit: created.totalDebit, totalCredit: created.totalCredit } });
  return { openingBalance: formatOpening(created), idempotentReplay: false };
}

export async function submitOpeningBalance(userId: string, id: string) {
  const opening = await prisma.openingBalance.findUnique({ where: { id } });
  if (!opening) throw errors.notFound('Opening balance tidak ditemukan.');
  await assertBranchAccess(userId, opening.branchId);
  await assertPermission(userId, PERMISSIONS.OPENING_BALANCE_MANAGE, opening.branchId);
  if (opening.createdBy !== userId) throw errors.forbidden('Hanya maker yang dapat mengajukan opening balance.');
  if (opening.status !== OpeningBalanceStatus.DRAFT && opening.status !== OpeningBalanceStatus.REJECTED) {
    throw errors.conflict('OPENING_STATUS_INVALID', 'Hanya opening balance DRAFT/REJECTED yang dapat diajukan.');
  }
  const updated = await prisma.openingBalance.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  await logAudit({ userId, branchId: opening.branchId, action: 'UPDATE', resource: 'OpeningBalance', resourceId: id, entityCode: opening.documentNumber, beforeData: { status: opening.status }, afterData: { status: updated.status } });
  return updated;
}

export async function updateOpeningBalance(userId: string, id: string, input: UpdateOpeningBalanceInput) {
  const opening = await prisma.openingBalance.findUnique({ where: { id } });
  if (!opening) throw errors.notFound('Opening balance tidak ditemukan.');
  await assertBranchAccess(userId, opening.branchId);
  await assertPermission(userId, PERMISSIONS.OPENING_BALANCE_MANAGE, opening.branchId);
  if (opening.createdBy !== userId) throw errors.forbidden('Hanya maker yang dapat mengubah opening balance.');
  if (opening.status !== OpeningBalanceStatus.DRAFT && opening.status !== OpeningBalanceStatus.REJECTED) {
    throw errors.conflict('OPENING_EDIT_STATUS_INVALID', 'Hanya opening balance DRAFT/REJECTED yang dapat diubah.');
  }

  const accountCodes = [...new Set(input.lines.map((line) => line.accountCode.toUpperCase()))];
  const accounts = await prisma.account.findMany({ where: { code: { in: accountCodes }, isActive: true, allowPosting: true } });
  const accountByCode = new Map(accounts.map((account) => [account.code, account]));
  const missing = accountCodes.filter((code) => !accountByCode.has(code));
  if (missing.length) throw errors.badRequest('OPENING_ACCOUNT_INVALID', `Account tidak aktif/postable: ${missing.join(', ')}.`);

  const { debit: totalDebit, credit: totalCredit } = calculateOpeningTotals(input.lines);
  if (!totalDebit.equals(totalCredit) || totalDebit.lessThanOrEqualTo(0)) {
    throw errors.unprocessable('OPENING_NOT_BALANCED', `Opening balance tidak seimbang: debit ${totalDebit.toFixed(2)}, kredit ${totalCredit.toFixed(2)}.`);
  }

  const inventoryScope = input.lines.some((line) => line.type === 'INVENTORY')
    ? await prisma.$transaction((tx) => resolveBranchInventoryScope(tx, opening.branchId, userId))
    : null;
  const normalized: Prisma.OpeningBalanceLineUncheckedCreateWithoutOpeningBalanceInput[] = [];
  for (const [index, line] of input.lines.entries()) {
    const debit = new Prisma.Decimal(line.debit);
    const credit = new Prisma.Decimal(line.credit);
    const account = accountByCode.get(line.accountCode.toUpperCase())!;
    if (line.type === 'CASH_BANK') {
      const cash = await prisma.cashBankAccount.findUnique({ where: { id: line.cashBankAccountId! } });
      if (!cash?.isActive || cash.branchId !== opening.branchId || cash.coaAccountId !== account.id || !credit.isZero()) {
        throw errors.badRequest('OPENING_CASH_INVALID', `Line ${index + 1}: akun kas/bank, COA, branch, atau sisi debit tidak valid.`);
      }
    }
    if (line.type === 'INVENTORY') {
      const item = await prisma.inventoryItem.findUnique({ where: { id: line.inventoryItemId! } });
      const quantity = new Prisma.Decimal(line.quantity!);
      const unitCost = new Prisma.Decimal(line.unitCost!);
      if (!item || item.branchId !== opening.branchId || !inventoryScope || !credit.isZero()) {
        throw errors.badRequest('OPENING_INVENTORY_INVALID', `Line ${index + 1}: item, cabang, atau sisi debit tidak valid.`);
      }
      const inventoryValue = openingInventoryValue(quantity, unitCost);
      if (!hasExactCurrencyPrecision(inventoryValue) || !inventoryValue.equals(debit)) {
        throw errors.unprocessable('OPENING_INVENTORY_VALUE_MISMATCH', `Line ${index + 1}: quantity × unit cost harus tepat dua desimal dan sama dengan debit.`);
      }
    }
    normalized.push({
      lineNo: index + 1,
      type: line.type,
      accountId: account.id,
      description: line.description,
      debit,
      credit,
      counterpartyRef: line.counterpartyRef,
      cashBankAccountId: line.cashBankAccountId,
      inventoryItemId: line.inventoryItemId,
      stockLocationId: line.type === 'INVENTORY' ? inventoryScope!.location.id : undefined,
      quantity: line.quantity ? new Prisma.Decimal(line.quantity) : null,
      unitCost: line.unitCost ? new Prisma.Decimal(line.unitCost) : null,
      batchNumber: line.batchNumber,
      manufactureDate: line.manufactureDate,
      expiryDate: line.expiryDate,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "opening_balances" WHERE "id" = ${id} FOR UPDATE`);
    const locked = await tx.openingBalance.findUniqueOrThrow({ where: { id } });
    if (locked.status !== OpeningBalanceStatus.DRAFT && locked.status !== OpeningBalanceStatus.REJECTED) {
      throw errors.conflict('OPENING_EDIT_STATUS_INVALID', 'Status berubah; opening balance tidak dapat diedit.');
    }
    await tx.openingBalanceLine.deleteMany({ where: { openingBalanceId: id } });
    await tx.openingBalanceLine.createMany({
      data: normalized.map((line) => ({ ...line, openingBalanceId: id })),
    });
    await tx.openingBalance.update({
      where: { id },
      data: { description: input.description, totalDebit, totalCredit },
    });
    await tx.auditLog.create({
      data: {
        userId,
        branchId: opening.branchId,
        action: 'UPDATE',
        module: 'ACCOUNTING',
        resource: 'OpeningBalance',
        resourceId: id,
        entityType: 'OpeningBalance',
        entityId: id,
        entityCode: opening.documentNumber,
        beforeData: { status: opening.status, totalDebit: opening.totalDebit.toFixed(2), totalCredit: opening.totalCredit.toFixed(2) },
        afterData: { status: opening.status, totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2) },
        description: `Opening balance ${opening.documentNumber} dikoreksi.`,
      },
    });
    return tx.openingBalance.findUniqueOrThrow({ where: { id }, include: includeOpening });
  });
  return formatOpening(updated);
}

export async function postOpeningBalance(userId: string, id: string) {
  const candidate = await prisma.openingBalance.findUnique({ where: { id }, select: { branchId: true } });
  if (!candidate) throw errors.notFound('Opening balance tidak ditemukan.');
  await assertBranchAccess(userId, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.OPENING_BALANCE_POST, candidate.branchId);
  await assertPermission(userId, PERMISSIONS.JOURNAL_POST, candidate.branchId);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "opening_balances" WHERE "id" = ${id} FOR UPDATE`);
    const opening = await tx.openingBalance.findUnique({
      where: { id },
      include: { lines: { include: { account: true, cashBankAccount: true }, orderBy: { lineNo: 'asc' } } },
    });
    if (!opening) throw errors.notFound('Opening balance tidak ditemukan.');
    if (opening.status === OpeningBalanceStatus.POSTED) {
      const replay = await tx.openingBalance.findUniqueOrThrow({ where: { id }, include: includeOpening });
      return { openingBalance: formatOpening(replay), idempotentReplay: true };
    }
    if (opening.status !== OpeningBalanceStatus.SUBMITTED) throw errors.conflict('OPENING_NOT_SUBMITTED', 'Opening balance belum diajukan.');
    if (opening.createdBy === userId) {
      throw errors.forbidden('Maker tidak boleh mem-posting opening balance sendiri.');
    }

    const posted = await postJournal({
      postingKey: `OPENING_BALANCE:${opening.id}`,
      transactionDate: opening.balanceDate,
      branchId: opening.branchId,
      actorUserId: userId,
      description: opening.description,
      lines: opening.lines.map((line) => ({
        accountCode: line.account.code,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        metadata: { openingBalanceLineId: line.id, type: line.type },
      })),
      sourceLinks: [{ sourceType: 'OPENING_BALANCE', sourceId: opening.id, sourceNumber: opening.documentNumber }],
    }, tx);

    for (const line of opening.lines) {
      if (line.type === 'INVENTORY') {
        const inventoryPosting = await receiveOpeningInventoryInTransaction(userId, {
          idempotencyKey: `OPENING_STOCK:${line.id}`,
          branchId: opening.branchId,
          inventoryItemId: line.inventoryItemId!,
          stockLocationId: line.stockLocationId!,
          quantity: line.quantity!.toFixed(4),
          unitCost: line.unitCost!.toFixed(4),
          currency: 'IDR',
          batch: line.batchNumber ? {
            batchNumber: line.batchNumber,
            manufactureDate: line.manufactureDate || undefined,
            expiryDate: line.expiryDate || undefined,
          } : undefined,
          sourceType: 'OPENING_BALANCE',
          sourceId: opening.id,
          sourceNumber: opening.documentNumber,
          reasonCode: 'OPENING_BALANCE',
          occurredAt: opening.balanceDate,
        }, tx);
        await tx.openingBalanceLine.update({ where: { id: line.id }, data: { inventoryPostingId: inventoryPosting.id } });
      }
      if (line.type === 'CASH_BANK') {
        const transaction = await tx.cashBankTransaction.create({
          data: {
            transactionNumber: `CBO/${line.id}`,
            postingKey: `OPENING_CASH:${line.id}`,
            cashBankAccountId: line.cashBankAccountId!,
            branchId: opening.branchId,
            transactionDate: opening.balanceDate,
            type: 'OPENING_BALANCE',
            amount: line.debit,
            sourceType: 'OPENING_BALANCE',
            sourceId: opening.id,
            sourceNumber: opening.documentNumber,
            journalEntryId: posted.journal.id,
            description: line.description,
            createdBy: userId,
          },
        });
        await tx.openingBalanceLine.update({ where: { id: line.id }, data: { cashBankTransactionId: transaction.id } });
      }
    }

    await tx.openingBalance.update({
      where: { id },
      data: { status: 'POSTED', reviewedBy: userId, reviewedAt: new Date(), postedAt: new Date(), journalEntryId: posted.journal.id },
    });
    await tx.auditLog.create({
      data: {
        userId,
        branchId: opening.branchId,
        action: 'STATUS_CHANGE',
        module: 'ACCOUNTING',
        resource: 'OpeningBalance',
        resourceId: opening.id,
        entityType: 'OpeningBalance',
        entityId: opening.id,
        entityCode: opening.documentNumber,
        afterData: { status: 'POSTED', journalEntryId: posted.journal.id } as Prisma.InputJsonValue,
        description: `Opening balance ${opening.documentNumber} diposting.`,
      },
    });
    const result = await tx.openingBalance.findUniqueOrThrow({ where: { id }, include: includeOpening });
    return { openingBalance: formatOpening(result), idempotentReplay: false };
  });
}

export async function rejectOpeningBalance(userId: string, id: string, reason: string) {
  const opening = await prisma.openingBalance.findUnique({ where: { id } });
  if (!opening) throw errors.notFound('Opening balance tidak ditemukan.');
  await assertBranchAccess(userId, opening.branchId);
  await assertPermission(userId, PERMISSIONS.OPENING_BALANCE_POST, opening.branchId);
  if (opening.createdBy === userId) {
    throw errors.forbidden('Maker tidak boleh menolak opening balance sendiri.');
  }
  if (opening.status !== OpeningBalanceStatus.SUBMITTED) throw errors.conflict('OPENING_NOT_SUBMITTED', 'Opening balance belum diajukan.');
  const updated = await prisma.openingBalance.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: reason, reviewedBy: userId, reviewedAt: new Date() } });
  await logAudit({ userId, branchId: opening.branchId, action: 'STATUS_CHANGE', resource: 'OpeningBalance', resourceId: id, entityCode: opening.documentNumber, beforeData: { status: opening.status }, afterData: { status: updated.status, rejectionReason: reason } });
  return updated;
}

export async function listOpeningBalances(userId: string, query: ListOpeningBalancesQuery) {
  const branches = await readableBranches(userId);
  if (query.branchId && !branches.includes(query.branchId)) throw errors.forbidden('Tidak memiliki akses opening balance cabang ini.');
  const rows = await prisma.openingBalance.findMany({
    where: { branchId: query.branchId || { in: branches }, ...(query.status ? { status: query.status } : {}) },
    include: includeOpening,
    orderBy: [{ balanceDate: 'desc' }, { createdAt: 'desc' }],
  });
  const historyRows = rows.length === 0 ? [] : await prisma.auditLog.findMany({
    where: { resource: 'OpeningBalance', resourceId: { in: rows.map((row) => row.id) } },
    select: {
      id: true,
      resourceId: true,
      action: true,
      beforeData: true,
      afterData: true,
      description: true,
      createdAt: true,
      user: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const historyByOpening = new Map<string, typeof historyRows>();
  for (const history of historyRows) {
    const bucket = historyByOpening.get(history.resourceId) || [];
    bucket.push(history);
    historyByOpening.set(history.resourceId, bucket);
  }
  return rows.map((row) => ({ ...formatOpening(row), history: historyByOpening.get(row.id) || [] }));
}
