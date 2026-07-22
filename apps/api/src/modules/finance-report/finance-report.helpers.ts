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

export function reconciliationResult(ledger: Prisma.Decimal.Value, subledger: Prisma.Decimal.Value) {
  const difference = D(ledger).sub(subledger);
  return { ledgerBalance: money(ledger), subledgerBalance: money(subledger), difference: money(difference), reconciled: difference.equals(0) };
}

export { money };
