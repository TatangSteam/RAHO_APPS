import { CashBankTransactionType, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import type { FinanceReportQuery, GeneralLedgerQuery } from './finance-report.schema';
import { agingClassification, aggregateLedger, buildChangesInEquity, buildFinancialPosition, buildProfitLoss, buildTrialBalance, money, naturalBalance, reconciliationResult, summarizeAging } from './finance-report.helpers';

const D = (value: Prisma.Decimal.Value = 0) => new Prisma.Decimal(value);

function range(query: FinanceReportQuery) {
  const now = new Date();
  const jakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = jakarta.find((part) => part.type === 'year')!.value;
  const month = jakarta.find((part) => part.type === 'month')!.value;
  const start = query.startDate || new Date(`${year}-${month}-01T00:00:00.000+07:00`);
  const end = query.endDate || now;
  return { start, end };
}

async function scope(actorUserId: string, query: FinanceReportQuery) {
  await assertPermission(actorUserId, PERMISSIONS.JOURNAL_READ, query.branchId);
  if (query.branchId) {
    await assertBranchAccess(actorUserId, query.branchId);
    return [query.branchId];
  }
  return getAccessibleBranchIds(actorUserId);
}

function branchWhere(branchIds: string[] | null): Prisma.JournalLineWhereInput {
  return branchIds === null ? {} : { branchId: { in: branchIds } };
}

async function ledgerLines(
  branchIds: string[] | null,
  from: Date | undefined,
  to: Date,
  accountCode?: string | string[],
) {
  const accountWhere: Prisma.JournalLineWhereInput = accountCode === undefined
    ? {}
    : Array.isArray(accountCode)
      ? { account: { code: { in: accountCode } } }
      : { account: { code: accountCode } };
  const rows = await prisma.journalLine.findMany({
    where: {
      ...branchWhere(branchIds),
      ...accountWhere,
      // A reversed journal remains part of the immutable ledger. Its separate
      // reversal entry neutralizes it; excluding the original would invert the
      // balance instead of producing a net-zero correction.
      journalEntry: { status: { in: ['POSTED', 'REVERSED'] }, transactionDate: { ...(from ? { gte: from } : {}), lte: to } },
    },
    select: { branchId: true, accountId: true, debit: true, credit: true, account: { select: { code: true, name: true, type: true, normalBalance: true } } },
  });
  return rows.map((row) => ({ branchId: row.branchId, accountId: row.accountId, ...row.account, debit: row.debit, credit: row.credit }));
}

export async function profitLoss(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  const { start, end } = range(query);
  return { period: { startDate: start, endDate: end }, source: 'POSTED_JOURNAL_LINES', ...buildProfitLoss(await ledgerLines(branches, start, end)) };
}

export async function trialBalance(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  const { start, end } = range(query);
  const [opening, movement] = await Promise.all([ledgerLines(branches, undefined, new Date(start.getTime() - 1)), ledgerLines(branches, start, end)]);
  return { period: { startDate: start, endDate: end }, source: 'POSTED_JOURNAL_LINES', ...buildTrialBalance(opening, movement) };
}

export async function generalLedger(actorUserId: string, query: GeneralLedgerQuery) {
  const branches = await scope(actorUserId, query);
  const { start, end } = range(query);
  const where: Prisma.JournalLineWhereInput = {
    ...branchWhere(branches),
    ...(query.accountCode ? { account: { code: query.accountCode } } : {}),
    journalEntry: { status: { in: ['POSTED', 'REVERSED'] }, transactionDate: { gte: start, lte: end } },
  };
  const skip = (query.page - 1) * query.limit;
  const [openingRows, previousRows, rows, total] = await Promise.all([
    ledgerLines(branches, undefined, new Date(start.getTime() - 1), query.accountCode),
    skip ? prisma.journalLine.findMany({ where, select: { accountId: true, debit: true, credit: true, account: { select: { code: true, name: true, type: true, normalBalance: true } } }, orderBy: [{ journalEntry: { transactionDate: 'asc' } }, { journalEntryId: 'asc' }, { lineNo: 'asc' }], take: skip }) : Promise.resolve([]),
    prisma.journalLine.findMany({ where, include: { account: true, branch: { select: { id: true, branchCode: true, name: true } }, journalEntry: { include: { sourceLinks: true } } }, orderBy: [{ journalEntry: { transactionDate: 'asc' } }, { journalEntryId: 'asc' }, { lineNo: 'asc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.journalLine.count({ where }),
  ]);
  const openingByAccount = new Map(aggregateLedger(openingRows).map((row) => [row.accountId, naturalBalance(row)]));
  const running = new Map(openingByAccount);
  for (const row of previousRows) {
    const before = running.get(row.accountId) || D(0);
    const movement = row.account.normalBalance === 'DEBIT' ? row.debit.sub(row.credit) : row.credit.sub(row.debit);
    running.set(row.accountId, before.add(movement));
  }
  const entries = rows.map((row) => {
    const before = running.get(row.accountId) || D(0);
    const movement = row.account.normalBalance === 'DEBIT' ? row.debit.sub(row.credit) : row.credit.sub(row.debit);
    const balance = before.add(movement);
    running.set(row.accountId, balance);
    return { id: row.id, date: row.journalEntry.transactionDate, journalNumber: row.journalEntry.journalNumber, description: row.description || row.journalEntry.description, account: { code: row.account.code, name: row.account.name, normalBalance: row.account.normalBalance }, branch: row.branch, debit: money(row.debit), credit: money(row.credit), runningBalance: money(balance), sources: row.journalEntry.sourceLinks };
  });
  return { period: { startDate: start, endDate: end }, source: 'POSTED_JOURNAL_LINES', openingBalances: Object.fromEntries([...openingByAccount].map(([id, value]) => [id, money(value)])), data: entries, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}

export async function cashBankReport(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  await assertPermission(actorUserId, PERMISSIONS.CASH_BANK_READ, query.branchId);
  const { end } = range(query);
  const accounts = await prisma.cashBankAccount.findMany({ where: branches === null ? {} : { branchId: { in: branches } }, include: { coaAccount: true, branch: { select: { id: true, branchCode: true, name: true } } }, orderBy: { code: 'asc' } });
  if (!accounts.length) return { asOf: end, source: 'POSTED_JOURNAL_LINES', accounts: [], reconciled: true };

  const [gl, transactions] = await Promise.all([
    ledgerLines(branches, undefined, end, [...new Set(accounts.map((account) => account.coaAccount.code))]),
    prisma.cashBankTransaction.findMany({
      where: {
        cashBankAccountId: { in: accounts.map((account) => account.id) },
        status: 'POSTED',
        transactionDate: { lte: end },
      },
      select: { cashBankAccountId: true, type: true, amount: true },
    }),
  ]);
  const ledgerByBranchAccount = new Map<string, Prisma.Decimal>();
  for (const row of gl) {
    const key = `${row.branchId}:${row.accountId}`;
    ledgerByBranchAccount.set(key, (ledgerByBranchAccount.get(key) || D(0)).add(naturalBalance(row)));
  }
  const subledgerByCashAccount = new Map<string, Prisma.Decimal>();
  for (const transaction of transactions) {
    const movement = transaction.type === CashBankTransactionType.PAYMENT
      ? transaction.amount.negated()
      : transaction.amount;
    subledgerByCashAccount.set(
      transaction.cashBankAccountId,
      (subledgerByCashAccount.get(transaction.cashBankAccountId) || D(0)).add(movement),
    );
  }
  const results = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    branch: account.branch,
    coaAccountCode: account.coaAccount.code,
    ...reconciliationResult(
      ledgerByBranchAccount.get(`${account.branchId}:${account.coaAccountId}`) || D(0),
      subledgerByCashAccount.get(account.id) || D(0),
    ),
  }));
  return { asOf: end, source: 'POSTED_JOURNAL_LINES', accounts: results, reconciled: results.every((row) => row.reconciled) };
}

export async function financialPosition(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  const { end } = range(query);
  const [lines, postedOpeningBalances, pendingInventoryValuations] = await Promise.all([
    ledgerLines(branches, undefined, end),
    prisma.openingBalance.count({
      where: { status: 'POSTED', ...(branches === null ? {} : { branchId: { in: branches } }) },
    }),
    prisma.inventoryCostLayer.count({
      where: {
        isVoided: false,
        remainingQty: { gt: 0 },
        OR: [{ valuationStatus: 'PENDING_VALUATION' }, { unitCost: null }],
        ...(branches === null ? {} : { inventoryBalance: { branchId: { in: branches } } }),
      },
    }),
  ]);
  const limitations = [
    ...(postedOpeningBalances > 0 ? [] : ['OPENING_BALANCE_MISSING']),
    ...(pendingInventoryValuations > 0 ? ['INVENTORY_VALUATION_INCOMPLETE'] : []),
  ];
  return {
    asOf: end,
    source: 'POSTED_JOURNAL_LINES',
    dataQuality: { complete: limitations.length === 0, postedOpeningBalances, pendingInventoryValuations, limitations },
    ...buildFinancialPosition(lines),
  };
}

export async function changesInEquity(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  const { start, end } = range(query);
  const [opening, movement] = await Promise.all([
    ledgerLines(branches, undefined, new Date(start.getTime() - 1)),
    ledgerLines(branches, start, end),
  ]);
  return { period: { startDate: start, endDate: end }, source: 'POSTED_JOURNAL_LINES', ...buildChangesInEquity(opening, movement) };
}

export async function receivableAging(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  await assertPermission(actorUserId, PERMISSIONS.INVOICE_READ, query.branchId);
  const { end: asOf } = range(query);
  const invoices = await prisma.invoice.findMany({
    where: {
      ...(branches === null ? {} : { branchId: { in: branches } }),
      status: { in: ['PENDING_PAYMENT', 'DEBT', 'OVERDUE'] },
    },
    select: {
      id: true, invoiceNumber: true, totalAmount: true, actualPaidAmount: true, dueDate: true,
      branch: { select: { id: true, branchCode: true, name: true } },
      member: { select: { memberNo: true, user: { select: { email: true, profile: { select: { fullName: true } } } } } },
    },
    orderBy: [{ dueDate: 'asc' }, { invoiceNumber: 'asc' }],
  });
  const rows = invoices.flatMap((invoice) => {
    const balance = invoice.totalAmount.sub(invoice.actualPaidAmount || 0);
    if (!balance.greaterThan(0)) return [];
    return [{
      id: invoice.id,
      documentNumber: invoice.invoiceNumber,
      counterpartyCode: invoice.member.memberNo,
      counterpartyName: invoice.member.user.profile?.fullName || invoice.member.user.email,
      branch: invoice.branch,
      dueDate: invoice.dueDate,
      balance: money(balance),
      ...agingClassification(invoice.dueDate, asOf),
    }];
  });
  return { asOf, balanceSnapshotAt: new Date(), source: 'CURRENT_OPERATIONAL_SUBLEDGER', rows, ...summarizeAging(rows) };
}

export async function payableAging(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  await assertPermission(actorUserId, PERMISSIONS.AP_READ, query.branchId);
  const { end: asOf } = range(query);
  const invoices = await prisma.supplierInvoice.findMany({
    where: {
      ...(branches === null ? {} : { branchId: { in: branches } }),
      balanceAmount: { gt: 0 },
      status: { in: ['POSTED', 'PARTIALLY_PAID'] },
    },
    select: {
      id: true, invoiceNumber: true, supplierInvoiceNumber: true, dueDate: true, balanceAmount: true,
      branch: { select: { id: true, branchCode: true, name: true } },
      supplier: { select: { code: true, name: true } },
    },
    orderBy: [{ dueDate: 'asc' }, { invoiceNumber: 'asc' }],
  });
  const rows = invoices.map((invoice) => ({
    id: invoice.id,
    documentNumber: invoice.invoiceNumber,
    externalDocumentNumber: invoice.supplierInvoiceNumber,
    counterpartyCode: invoice.supplier.code,
    counterpartyName: invoice.supplier.name,
    branch: invoice.branch,
    dueDate: invoice.dueDate,
    balance: money(invoice.balanceAmount),
    ...agingClassification(invoice.dueDate, asOf),
  }));
  return { asOf, balanceSnapshotAt: new Date(), source: 'CURRENT_OPERATIONAL_SUBLEDGER', rows, ...summarizeAging(rows) };
}

export async function deferredRevenueReport(actorUserId: string, query: FinanceReportQuery) {
  const branches = await scope(actorUserId, query);
  await assertPermission(actorUserId, PERMISSIONS.DEFERRED_REVENUE_READ, query.branchId);
  const { end } = range(query);
  const [movements, policies, valuations] = await Promise.all([
    prisma.deferredRevenueMovement.findMany({ where: { occurredAt: { lte: end }, contract: branches === null ? {} : { branchId: { in: branches } } }, include: { contract: { include: { valuation: true } } } }),
    prisma.packageRevenuePolicy.findMany({ select: { deferredRevenueAccount: { select: { code: true } } } }),
    prisma.packageBenefitValuation.findMany({ select: { deferredRevenueAccountCode: true }, distinct: ['deferredRevenueAccountCode'] }),
  ]);
  const codes = [...new Set([
    ...movements.map((row) => row.contract.valuation.deferredRevenueAccountCode),
    ...policies.map((row) => row.deferredRevenueAccount.code),
    ...valuations.map((row) => row.deferredRevenueAccountCode),
  ])];
  if (!codes.length) return { asOf: end, source: 'POSTED_JOURNAL_LINES', accounts: [], totalDeferredRevenue: money(0), reconciled: true };
  const gl = await ledgerLines(branches, undefined, end, codes);
  const ledgerByCode = new Map<string, Prisma.Decimal>();
  for (const row of gl) {
    ledgerByCode.set(row.code, (ledgerByCode.get(row.code) || D(0)).add(naturalBalance(row)));
  }
  const subledgerByCode = new Map<string, Prisma.Decimal>();
  const movementCountByCode = new Map<string, number>();
  for (const movement of movements) {
    const code = movement.contract.valuation.deferredRevenueAccountCode;
    // Recognition releases the liability; a cancellation reversal restores it.
    const amount = movement.type === 'RECOGNITION' ? movement.amount.negated() : movement.amount;
    subledgerByCode.set(code, (subledgerByCode.get(code) || D(0)).add(amount));
    movementCountByCode.set(code, (movementCountByCode.get(code) || 0) + 1);
  }
  const byCode = codes.map((code) => ({
    accountCode: code,
    movementCount: movementCountByCode.get(code) || 0,
    ...reconciliationResult(ledgerByCode.get(code) || D(0), subledgerByCode.get(code) || D(0)),
  }));
  return { asOf: end, source: 'POSTED_JOURNAL_LINES', accounts: byCode, totalDeferredRevenue: money(byCode.reduce((sum, row) => sum.add(row.ledgerBalance), D(0))), reconciled: byCode.every((row) => row.reconciled) };
}

export async function reconciliation(actorUserId: string, query: FinanceReportQuery) {
  const [trial, cashBank, deferredRevenue] = await Promise.all([trialBalance(actorUserId, query), cashBankReport(actorUserId, query), deferredRevenueReport(actorUserId, query)]);
  return { journalBalanced: trial.balanced, cashBank: cashBank.reconciled, deferredRevenue: deferredRevenue.reconciled, reconciled: trial.balanced && cashBank.reconciled && deferredRevenue.reconciled, checkedAt: new Date(), source: 'POSTED_JOURNAL_LINES' };
}

export async function financeDashboard(actorUserId: string, query: FinanceReportQuery) {
  const [pl, trial, cashBank, deferredRevenue] = await Promise.all([profitLoss(actorUserId, query), trialBalance(actorUserId, query), cashBankReport(actorUserId, query), deferredRevenueReport(actorUserId, query)]);
  const cashBalance = cashBank.accounts.reduce((sum, row) => sum.add(row.ledgerBalance), D(0));
  const status = { journalBalanced: trial.balanced, cashBank: cashBank.reconciled, deferredRevenue: deferredRevenue.reconciled };
  return { period: pl.period, source: 'POSTED_JOURNAL_LINES', summary: { revenue: pl.totalRevenue, expense: pl.totalExpense, netProfit: pl.netProfit, cashBank: money(cashBalance), deferredRevenue: deferredRevenue.totalDeferredRevenue }, reconciliation: { ...status, reconciled: Object.values(status).every(Boolean), checkedAt: new Date() } };
}
