import { AccountingPeriodStatus, InventoryValuationStatus, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import {
  evaluateInventoryMutationChain,
  evaluateInventoryValue,
  evaluateJournal,
  evaluateOpening,
  gate,
  summarizeGate,
  type GateCheck,
} from './go-live-audit.helpers';

const D = (value: Prisma.Decimal.Value = 0) => new Prisma.Decimal(value);

export async function runGoLiveAudit(cutoverAt = new Date()) {
  const checks: GateCheck[] = [];

  const journals = await prisma.journalEntry.findMany({ where: { status: 'POSTED' }, select: { id: true, journalNumber: true, totalDebit: true, totalCredit: true, lines: { select: { debit: true, credit: true } } } });
  const invalidJournals = journals.filter((journal) => !evaluateJournal(journal)).map((journal) => journal.journalNumber);
  checks.push(gate('FIN-001', 'Posted journal balanced dan cocok dengan journal lines', invalidJournals.length === 0, `${journals.length} jurnal diperiksa; ${invalidJournals.length} mismatch.`, invalidJournals));

  const cashAccounts = await prisma.cashBankAccount.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, branchId: true, coaAccountId: true, transactions: { where: { status: 'POSTED' }, select: { type: true, amount: true } } } });
  const cashGroups = new Map<string, typeof cashAccounts>();
  for (const account of cashAccounts) {
    const key = `${account.branchId}:${account.coaAccountId}`;
    cashGroups.set(key, [...(cashGroups.get(key) || []), account]);
  }
  const cashMismatch = [] as Array<{ accounts: string[]; ledger: string; subledger: string; difference: string }>;
  for (const accounts of cashGroups.values()) {
    const ledger = await prisma.journalLine.aggregate({ where: { accountId: accounts[0].coaAccountId, branchId: accounts[0].branchId, journalEntry: { status: 'POSTED' } }, _sum: { debit: true, credit: true } });
    const ledgerBalance = D(ledger._sum.debit || 0).sub(ledger._sum.credit || 0);
    const subledgerBalance = accounts.flatMap((account) => account.transactions).reduce((sum, transaction) => sum.add(transaction.type === 'PAYMENT' ? transaction.amount.negated() : transaction.amount), D(0));
    if (!ledgerBalance.equals(subledgerBalance)) cashMismatch.push({ accounts: accounts.map((account) => account.code), ledger: ledgerBalance.toFixed(2), subledger: subledgerBalance.toFixed(2), difference: ledgerBalance.sub(subledgerBalance).toFixed(2) });
  }
  checks.push(gate('FIN-002', 'Kas/bank ledger cocok dengan subledger', cashMismatch.length === 0, `${cashGroups.size} akun kontrol diperiksa; ${cashMismatch.length} mismatch.`, cashMismatch));

  const [deferredMovements, deferredPolicies, deferredValuations] = await Promise.all([
    prisma.deferredRevenueMovement.findMany({ include: { contract: { include: { valuation: true } } } }),
    prisma.packageRevenuePolicy.findMany({ select: { deferredRevenueAccount: { select: { id: true, code: true } } } }),
    prisma.packageBenefitValuation.findMany({ select: { deferredRevenueAccountCode: true }, distinct: ['deferredRevenueAccountCode'] }),
  ]);
  const deferredCodes = [...new Set([...deferredPolicies.map((row) => row.deferredRevenueAccount.code), ...deferredValuations.map((row) => row.deferredRevenueAccountCode)])];
  const deferredMismatch = [] as Array<{ accountCode: string; ledger: string; subledger: string; difference: string }>;
  for (const accountCode of deferredCodes) {
    const ledger = await prisma.journalLine.aggregate({ where: { account: { code: accountCode }, journalEntry: { status: 'POSTED' } }, _sum: { debit: true, credit: true } });
    const ledgerBalance = D(ledger._sum.credit || 0).sub(ledger._sum.debit || 0);
    const subledgerBalance = deferredMovements
      .filter((movement) => movement.contract.valuation.deferredRevenueAccountCode === accountCode)
      .reduce((sum, movement) => sum.add(movement.type === 'RECOGNITION' ? movement.amount.negated() : movement.amount), D(0));
    if (!ledgerBalance.equals(subledgerBalance)) deferredMismatch.push({ accountCode, ledger: ledgerBalance.toFixed(2), subledger: subledgerBalance.toFixed(2), difference: ledgerBalance.sub(subledgerBalance).toFixed(2) });
  }
  checks.push(gate('FIN-003', 'Deferred revenue ledger cocok dengan subledger', deferredMismatch.length === 0, `${deferredCodes.length} akun kontrol diperiksa; ${deferredMismatch.length} mismatch.`, deferredMismatch));

  const openings = await prisma.openingBalance.findMany({ where: { status: { not: 'REJECTED' } }, select: { id: true, documentNumber: true, status: true, totalDebit: true, totalCredit: true, createdBy: true, reviewedBy: true, journalEntryId: true, lines: { select: { type: true, inventoryPostingId: true, cashBankTransactionId: true } } } });
  const openingResults = openings.map((opening) => ({ documentNumber: opening.documentNumber, status: opening.status, ...evaluateOpening(opening) }));
  const invalidOpenings = openingResults.filter((opening) => !opening.ready);
  checks.push(gate('OPEN-001', 'Opening balance rehearsal', openings.length > 0 && invalidOpenings.length === 0, `${openings.length} dokumen diperiksa; ${invalidOpenings.length} belum siap.`, invalidOpenings));

  const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true, branchCode: true, name: true } });
  const periods = await prisma.accountingPeriod.findMany({ where: { startDate: { lte: cutoverAt }, endDate: { gte: cutoverAt } }, select: { branchId: true, scopeKey: true, status: true } });
  const globalOpen = periods.some((period) => period.scopeKey === 'GLOBAL' && period.status === AccountingPeriodStatus.OPEN);
  const branchesWithoutOpenPeriod = branches.filter((branch) => !globalOpen && !periods.some((period) => period.branchId === branch.id && period.status === AccountingPeriodStatus.OPEN));
  checks.push(gate('PERIOD-001', 'Periode posting tersedia saat cutover', branchesWithoutOpenPeriod.length === 0, `${branches.length - branchesWithoutOpenPeriod.length}/${branches.length} cabang memiliki periode OPEN.`, branchesWithoutOpenPeriod));

  const lockedWithoutAudit = await prisma.accountingPeriod.findMany({ where: { status: 'LOCKED', OR: [{ closedAt: null }, { closedBy: null }] }, select: { id: true, name: true, scopeKey: true } });
  checks.push(gate('PERIOD-002', 'Period lock memiliki actor dan timestamp', lockedWithoutAudit.length === 0, `${lockedWithoutAudit.length} periode LOCKED kehilangan metadata.`, lockedWithoutAudit));

  const inventoryItems = await prisma.inventoryItem.findMany({
    select: {
      id: true,
      stock: true,
      masterProduct: { select: { sku: true, name: true } },
      balances: { include: { costLayers: true } },
      stockMutations: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, quantity: true, stockBefore: true, stockAfter: true },
      },
    },
  });
  const inventoryMismatch = inventoryItems.flatMap((item) => {
    const onHand = item.balances.reduce((sum, balance) => sum.add(balance.onHandQty), D(0));
    const layerQty = item.balances.reduce((sum, balance) => sum.add(balance.costLayers.filter((layer) => !layer.isVoided).reduce((subtotal, layer) => subtotal.add(layer.remainingQty), D(0))), D(0));
    return onHand.equals(item.stock) && layerQty.equals(onHand) ? [] : [{ inventoryItemId: item.id, sku: item.masterProduct.sku, mirror: item.stock.toFixed(4), balance: onHand.toFixed(4), layer: layerQty.toFixed(4) }];
  });
  checks.push(gate('INV-001', 'Quantity inventory cocok dengan balance dan cost layer', inventoryMismatch.length === 0, `${inventoryItems.length} item diperiksa; ${inventoryMismatch.length} mismatch.`, inventoryMismatch));

  const negativeBalances = await prisma.inventoryBalance.findMany({ where: { OR: [{ onHandQty: { lt: 0 } }, { reservedQty: { lt: 0 } }, { quarantineQty: { lt: 0 } }, { inTransitQty: { lt: 0 } }] }, select: { id: true, branchId: true, inventoryItemId: true, onHandQty: true, reservedQty: true, quarantineQty: true, inTransitQty: true } });
  checks.push(gate('INV-002', 'Tidak ada quantity bucket negatif', negativeBalances.length === 0, `${negativeBalances.length} balance negatif.`, negativeBalances));

  const pendingValuations = await prisma.inventoryCostLayer.findMany({ where: { isVoided: false, remainingQty: { gt: 0 }, OR: [{ valuationStatus: InventoryValuationStatus.PENDING_VALUATION }, { unitCost: null }] }, select: { id: true, sourceType: true, sourceId: true, remainingQty: true } });
  checks.push(gate('INV-003', 'Seluruh stok aktif memiliki valuation', pendingValuations.length === 0, `${pendingValuations.length} cost layer masih pending valuation.`, pendingValuations));

  const mutationMismatch = inventoryItems.flatMap((item) => {
    const result = evaluateInventoryMutationChain(item.stock, item.stockMutations);
    return result.valid ? [] : [{ inventoryItemId: item.id, sku: item.masterProduct.sku, issues: result.issues }];
  });
  checks.push(gate('INV-004', 'Mutation chain cocok dengan compatibility stock', mutationMismatch.length === 0, `${inventoryItems.length} item diperiksa; ${mutationMismatch.length} mutation chain tidak konsisten.`, mutationMismatch));

  const [openTransfers, inventoryLedger] = await Promise.all([
    prisma.internalTransferLedger.findMany({
      where: { status: { in: ['IN_TRANSIT', 'DISCREPANCY'] } },
      select: { id: true, shipmentId: true, totalValue: true, receivedValue: true },
    }),
    prisma.journalLine.aggregate({
      where: { account: { code: { in: ['1300', '1310'] } }, journalEntry: { status: 'POSTED' } },
      _sum: { debit: true, credit: true },
    }),
  ]);
  const layerValue = inventoryItems.reduce(
    (sum, item) => sum.add(item.balances.flatMap((balance) => balance.costLayers)
      .filter((layer) => !layer.isVoided && layer.unitCost !== null)
      .reduce((layerSum, layer) => layerSum.add(layer.remainingQty.mul(layer.unitCost!)), D(0))),
    D(0),
  );
  const inTransitValue = openTransfers.reduce((sum, transfer) => sum.add(transfer.totalValue.sub(transfer.receivedValue)), D(0));
  const ledgerValue = D(inventoryLedger._sum.debit || 0).sub(inventoryLedger._sum.credit || 0);
  const valuation = evaluateInventoryValue(layerValue, inTransitValue, ledgerValue);
  checks.push(gate(
    'INV-005',
    'FIFO valuation dan in-transit cocok dengan inventory control ledger',
    valuation.matches,
    `Subledger ${valuation.subledgerValue.toFixed(2)}; ledger ${valuation.ledgerValue.toFixed(2)}; selisih ${valuation.difference.toFixed(2)}.`,
    {
      layerValue: valuation.layerValue.toFixed(2),
      inTransitValue: valuation.inTransitValue.toFixed(2),
      openTransferCount: openTransfers.length,
      accountCodes: ['1300', '1310'],
    },
  ));

  const [permissions, templates, activeStaff] = await Promise.all([
    prisma.permission.findMany({ where: { isActive: true }, select: { code: true } }),
    prisma.roleTemplate.findMany({ where: { isActive: true, baseRole: { not: null } }, select: { baseRole: true, permissions: { select: { permission: { select: { code: true } } } } } }),
    prisma.user.count({ where: { isActive: true, role: { not: 'MEMBER' } } }),
  ]);
  const configured = new Set(permissions.map((permission) => permission.code));
  const missingPermissions = Object.values(PERMISSIONS).filter((permission) => !configured.has(permission));
  checks.push(gate('SEC-001', 'Permission catalog terdaftar lengkap', missingPermissions.length === 0, `${configured.size} permission aktif; ${missingPermissions.length} hilang.`, missingPermissions));
  checks.push(gate('SEC-002', 'Role template aktif tersedia untuk staff', activeStaff === 0 || templates.length > 0, `${templates.length} template untuk ${activeStaff} staff aktif.`, templates.map((template) => ({ role: template.baseRole, permissionCount: template.permissions.length }))));

  const failedEvents = await prisma.domainEvent.findMany({ where: { status: 'FAILED' }, select: { eventKey: true, eventType: true, aggregateId: true, failureReason: true } });
  checks.push(gate('OPS-001', 'Tidak ada domain event gagal', failedEvents.length === 0, `${failedEvents.length} event FAILED.`, failedEvents));

  const summary = summarizeGate(checks);
  return { generatedAt: new Date().toISOString(), cutoverAt: cutoverAt.toISOString(), summary, checks };
}
