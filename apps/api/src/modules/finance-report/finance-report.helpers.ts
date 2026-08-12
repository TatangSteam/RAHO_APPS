import { AccountType, NormalBalance, Prisma } from '@prisma/client';

export interface LedgerAmount {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  debit: Prisma.Decimal.Value;
  credit: Prisma.Decimal.Value;
}

const D = (value: Prisma.Decimal.Value = 0) => new Prisma.Decimal(value);
const money = (value: Prisma.Decimal.Value) => D(value).toDecimalPlaces(2).toFixed(2);

export function aggregateLedger(lines: LedgerAmount[]) {
  const byAccount = new Map<string, LedgerAmount & { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
  for (const line of lines) {
    const current = byAccount.get(line.accountId) || { ...line, debit: D(0), credit: D(0) };
    current.debit = current.debit.add(line.debit);
    current.credit = current.credit.add(line.credit);
    byAccount.set(line.accountId, current);
  }
  return [...byAccount.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function naturalBalance(row: Pick<LedgerAmount, 'normalBalance' | 'debit' | 'credit'>) {
  return row.normalBalance === NormalBalance.DEBIT
    ? D(row.debit).sub(row.credit)
    : D(row.credit).sub(row.debit);
}

export function buildProfitLoss(lines: LedgerAmount[]) {
  const accounts = aggregateLedger(lines)
    .filter((row) => row.type === AccountType.REVENUE || row.type === AccountType.EXPENSE)
    .map((row) => ({
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      type: row.type,
      amount: money(row.type === AccountType.REVENUE ? row.credit.sub(row.debit) : row.debit.sub(row.credit)),
    }));
  const totalRevenue = accounts.filter((row) => row.type === AccountType.REVENUE).reduce((sum, row) => sum.add(row.amount), D(0));
  const totalExpense = accounts.filter((row) => row.type === AccountType.EXPENSE).reduce((sum, row) => sum.add(row.amount), D(0));
  return { accounts, totalRevenue: money(totalRevenue), totalExpense: money(totalExpense), netProfit: money(totalRevenue.sub(totalExpense)) };
}

export function buildTrialBalance(openingLines: LedgerAmount[], movementLines: LedgerAmount[]) {
  const opening = new Map(aggregateLedger(openingLines).map((row) => [row.accountId, row]));
  const movement = new Map(aggregateLedger(movementLines).map((row) => [row.accountId, row]));
  const ids = [...new Set([...opening.keys(), ...movement.keys()])];
  const accounts = ids.map((id) => {
    const base = opening.get(id) || movement.get(id)!;
    const open = opening.get(id);
    const move = movement.get(id);
    const openingBalance = open ? naturalBalance(open) : D(0);
    const movementBalance = move ? naturalBalance(move) : D(0);
    const ending = openingBalance.add(movementBalance);
    return {
      accountId: id, code: base.code, name: base.name, type: base.type, normalBalance: base.normalBalance,
      openingBalance: money(openingBalance), debit: money(move?.debit || 0), credit: money(move?.credit || 0), endingBalance: money(ending),
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = accounts.reduce((sum, row) => sum.add(row.debit), D(0));
  const totalCredit = accounts.reduce((sum, row) => sum.add(row.credit), D(0));
  return { accounts, totalDebit: money(totalDebit), totalCredit: money(totalCredit), difference: money(totalDebit.sub(totalCredit)), balanced: totalDebit.equals(totalCredit) };
}

function accountBalances(lines: LedgerAmount[], types: AccountType[]) {
  return aggregateLedger(lines)
    .filter((row) => types.includes(row.type))
    .map((row) => ({
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      type: row.type,
      amount: money(naturalBalance(row)),
    }));
}

function profit(lines: LedgerAmount[]) {
  return aggregateLedger(lines).reduce((sum, row) => {
    if (row.type === AccountType.REVENUE) return sum.add(row.credit.sub(row.debit));
    if (row.type === AccountType.EXPENSE) return sum.sub(row.debit.sub(row.credit));
    return sum;
  }, D(0));
}

export function buildFinancialPosition(lines: LedgerAmount[]) {
  const assets = accountBalances(lines, [AccountType.ASSET]);
  const liabilities = accountBalances(lines, [AccountType.LIABILITY]);
  const equityAccounts = accountBalances(lines, [AccountType.EQUITY]);
  const unclosedEarnings = profit(lines);
  const totalAssets = assets.reduce((sum, row) => sum.add(row.amount), D(0));
  const totalLiabilities = liabilities.reduce((sum, row) => sum.add(row.amount), D(0));
  const postedEquity = equityAccounts.reduce((sum, row) => sum.add(row.amount), D(0));
  const totalEquity = postedEquity.add(unclosedEarnings);
  const difference = totalAssets.sub(totalLiabilities).sub(totalEquity);
  return {
    assets,
    liabilities,
    equityAccounts,
    unclosedEarnings: money(unclosedEarnings),
    totalAssets: money(totalAssets),
    totalLiabilities: money(totalLiabilities),
    postedEquity: money(postedEquity),
    totalEquity: money(totalEquity),
    totalLiabilitiesAndEquity: money(totalLiabilities.add(totalEquity)),
    difference: money(difference),
    balanced: difference.equals(0),
  };
}

export function buildChangesInEquity(openingLines: LedgerAmount[], movementLines: LedgerAmount[]) {
  const openingAccounts = accountBalances(openingLines, [AccountType.EQUITY]);
  const movementAccounts = accountBalances(movementLines, [AccountType.EQUITY]);
  const openingPostedEquity = openingAccounts.reduce((sum, row) => sum.add(row.amount), D(0));
  const openingUnclosedEarnings = profit(openingLines);
  const directEquityMovement = movementAccounts.reduce((sum, row) => sum.add(row.amount), D(0));
  const periodProfit = profit(movementLines);
  const openingTotalEquity = openingPostedEquity.add(openingUnclosedEarnings);
  const endingTotalEquity = openingTotalEquity.add(directEquityMovement).add(periodProfit);
  return {
    openingAccounts,
    movementAccounts,
    openingPostedEquity: money(openingPostedEquity),
    openingUnclosedEarnings: money(openingUnclosedEarnings),
    openingTotalEquity: money(openingTotalEquity),
    directEquityMovement: money(directEquityMovement),
    periodProfit: money(periodProfit),
    endingTotalEquity: money(endingTotalEquity),
  };
}

export type AgingBucket = 'CURRENT' | 'DAYS_1_30' | 'DAYS_31_60' | 'DAYS_61_90' | 'OVER_90';

function jakartaDayOrdinal(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === 'year')!.value);
  const month = Number(parts.find((part) => part.type === 'month')!.value);
  const day = Number(parts.find((part) => part.type === 'day')!.value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function agingClassification(dueDate: Date | null, asOf: Date) {
  const daysPastDue = dueDate ? Math.max(0, jakartaDayOrdinal(asOf) - jakartaDayOrdinal(dueDate)) : 0;
  const bucket: AgingBucket = daysPastDue === 0 ? 'CURRENT'
    : daysPastDue <= 30 ? 'DAYS_1_30'
      : daysPastDue <= 60 ? 'DAYS_31_60'
        : daysPastDue <= 90 ? 'DAYS_61_90'
          : 'OVER_90';
  return { daysPastDue, bucket };
}

export function summarizeAging(rows: Array<{ balance: Prisma.Decimal.Value; bucket: AgingBucket }>) {
  const buckets: Record<AgingBucket, Prisma.Decimal> = {
    CURRENT: D(0), DAYS_1_30: D(0), DAYS_31_60: D(0), DAYS_61_90: D(0), OVER_90: D(0),
  };
  for (const row of rows) buckets[row.bucket] = buckets[row.bucket].add(row.balance);
  return {
    buckets: Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, money(value)])) as Record<AgingBucket, string>,
    totalOutstanding: money(Object.values(buckets).reduce((sum, value) => sum.add(value), D(0))),
  };
}

export function reconciliationResult(ledger: Prisma.Decimal.Value, subledger: Prisma.Decimal.Value) {
  const difference = D(ledger).sub(subledger);
  return { ledgerBalance: money(ledger), subledgerBalance: money(subledger), difference: money(difference), reconciled: difference.equals(0) };
}

export { money };
