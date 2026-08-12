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

export function evaluateInventoryMutationChain(
  currentStock: Prisma.Decimal.Value,
  mutations: Array<{
    id: string;
    quantity: Prisma.Decimal.Value;
    stockBefore: Prisma.Decimal.Value;
    stockAfter: Prisma.Decimal.Value;
    referenceType?: string | null;
  }>,
) {
  const issues: Array<{ mutationId?: string; reason: string }> = [];

  if (mutations.length === 0) {
    if (!D(currentStock).isZero()) issues.push({ reason: 'NON_ZERO_STOCK_WITHOUT_MUTATION' });
    return { valid: issues.length === 0, issues };
  }

  // The inventory-ledger migration materialized the then-current legacy stock
  // as an explicit opening checkpoint. Mutations before that checkpoint belong
  // to the old direct-stock model and must not be chained into the new ledger.
  let checkpointIndex = -1;
  for (let index = mutations.length - 1; index >= 0; index -= 1) {
    if (mutations[index].referenceType === 'LEGACY_MIGRATION') {
      checkpointIndex = index;
      break;
    }
  }
  const auditableMutations = checkpointIndex >= 0
    ? mutations.slice(checkpointIndex)
    : mutations;

  auditableMutations.forEach((mutation, index) => {
    const before = D(mutation.stockBefore);
    const after = D(mutation.stockAfter);
    if (!after.sub(before).abs().equals(D(mutation.quantity))) {
      issues.push({ mutationId: mutation.id, reason: 'QUANTITY_DOES_NOT_MATCH_STOCK_DELTA' });
    }
    if (index > 0 && !D(auditableMutations[index - 1].stockAfter).equals(before)) {
      issues.push({ mutationId: mutation.id, reason: 'MUTATION_CHAIN_DISCONTINUITY' });
    }
  });

  if (!D(auditableMutations[auditableMutations.length - 1].stockAfter).equals(currentStock)) {
    issues.push({ mutationId: auditableMutations[auditableMutations.length - 1].id, reason: 'LATEST_MUTATION_DOES_NOT_MATCH_STOCK' });
  }
  return { valid: issues.length === 0, issues };
}

export function evaluateInventoryValue(
  layerValue: Prisma.Decimal.Value,
  inTransitValue: Prisma.Decimal.Value,
  ledgerValue: Prisma.Decimal.Value,
) {
  const subledgerValue = D(layerValue).add(inTransitValue).toDecimalPlaces(2);
  const normalizedLedgerValue = D(ledgerValue).toDecimalPlaces(2);
  return {
    layerValue: D(layerValue),
    inTransitValue: D(inTransitValue),
    subledgerValue,
    ledgerValue: normalizedLedgerValue,
    difference: subledgerValue.sub(normalizedLedgerValue),
    matches: subledgerValue.equals(normalizedLedgerValue),
  };
}

export function summarizeGate(checks: GateCheck[]) {
  const blockers = checks.filter((check) => check.status === 'FAIL' && check.severity === 'BLOCKER');
  const warnings = checks.filter((check) => check.status === 'FAIL' && check.severity === 'WARNING');
  return { status: blockers.length ? 'BLOCKED' as const : 'READY' as const, passed: checks.filter((check) => check.status === 'PASS').length, failed: checks.filter((check) => check.status === 'FAIL').length, blockers: blockers.length, warnings: warnings.length };
}
