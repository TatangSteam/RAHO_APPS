import { Prisma } from '@prisma/client';

export type GateStatus = 'PASS' | 'FAIL';
export interface GateCheck {
  id: string;
  name: string;
  status: GateStatus;
  severity: 'BLOCKER' | 'WARNING';
  summary: string;
  details?: unknown;
}

const D = (value: Prisma.Decimal.Value = 0) => new Prisma.Decimal(value);

export function gate(id: string, name: string, passed: boolean, summary: string, details?: unknown, severity: GateCheck['severity'] = 'BLOCKER'): GateCheck {
  return { id, name, status: passed ? 'PASS' : 'FAIL', severity, summary, ...(details === undefined ? {} : { details }) };
}

export function evaluateJournal(entry: {
  totalDebit: Prisma.Decimal.Value;
  totalCredit: Prisma.Decimal.Value;
  lines: Array<{ debit: Prisma.Decimal.Value; credit: Prisma.Decimal.Value }>;
}) {
  const lineDebit = entry.lines.reduce((sum, line) => sum.add(line.debit), D(0));
  const lineCredit = entry.lines.reduce((sum, line) => sum.add(line.credit), D(0));
  return D(entry.totalDebit).equals(entry.totalCredit)
    && lineDebit.equals(lineCredit)
    && lineDebit.equals(entry.totalDebit)
    && lineCredit.equals(entry.totalCredit);
}

export function evaluateOpening(opening: {
  status: string;
  totalDebit: Prisma.Decimal.Value;
  totalCredit: Prisma.Decimal.Value;
  createdBy: string;
  reviewedBy: string | null;
  journalEntryId: string | null;
  lines: Array<{ type: string; inventoryPostingId: string | null; cashBankTransactionId: string | null }>;
}) {
  const balanced = D(opening.totalDebit).equals(opening.totalCredit);
  const postedLinksValid = opening.status !== 'POSTED' || Boolean(opening.journalEntryId)
    && opening.lines.every((line) => line.type !== 'INVENTORY' || Boolean(line.inventoryPostingId))
    && opening.lines.every((line) => line.type !== 'CASH_BANK' || Boolean(line.cashBankTransactionId));
  const makerCheckerValid = !opening.reviewedBy || opening.reviewedBy !== opening.createdBy;
  return { balanced, postedLinksValid, makerCheckerValid, ready: opening.status === 'POSTED' && balanced && postedLinksValid && makerCheckerValid };
}

export function summarizeGate(checks: GateCheck[]) {
  const blockers = checks.filter((check) => check.status === 'FAIL' && check.severity === 'BLOCKER');
  const warnings = checks.filter((check) => check.status === 'FAIL' && check.severity === 'WARNING');
  return { status: blockers.length ? 'BLOCKED' as const : 'READY' as const, passed: checks.filter((check) => check.status === 'PASS').length, failed: checks.filter((check) => check.status === 'FAIL').length, blockers: blockers.length, warnings: warnings.length };
}
