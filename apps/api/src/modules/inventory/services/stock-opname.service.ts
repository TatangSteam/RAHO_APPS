import { createHash, randomUUID } from 'crypto';
import { ApprovalDecisionType, Prisma, StockOpnameStatus } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { postStockOpnameJournal } from '@modules/accounting/accounting.service';
import { decideApprovalInTransaction, startApprovalInTransaction } from '@modules/workflow/approval.service';
import type { CreateStockOpnameInput, StockOpnameListInput } from '../stock-opname.schema';
import { issueAdjustmentInventoryInTransaction, receiveAdjustmentInventoryInTransaction } from './inventory-ledger.service';
import { logAudit } from '@utils/auditLog';
import { createInventorySyncEventInTransaction } from '@modules/zoho/zoho.inventory-outbox';
import { STOCK_OPNAME_POSTED_EVENT } from '@modules/zoho/zoho.inventory-adjustment.policy';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const includeOpname = { lines: { orderBy: { lineNo: 'asc' as const } }, journalEntry: { select: { id: true, journalNumber: true } } };

export function buildStockOpnameJournalLines(increaseInput: Prisma.Decimal.Value, decreaseInput: Prisma.Decimal.Value) {
  const increaseValue = new Prisma.Decimal(increaseInput).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const decreaseValue = new Prisma.Decimal(decreaseInput).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return [
    ...(increaseValue.greaterThan(0) ? [
      { accountCode: '1300', debit: increaseValue, metadata: { opnameRole: 'INVENTORY_INCREASE' } },
      { accountCode: '4300', credit: increaseValue, metadata: { opnameRole: 'ADJUSTMENT_GAIN' } },
    ] : []),
    ...(decreaseValue.greaterThan(0) ? [
      { accountCode: '5300', debit: decreaseValue, metadata: { opnameRole: 'ADJUSTMENT_LOSS' } },
      { accountCode: '1300', credit: decreaseValue, metadata: { opnameRole: 'INVENTORY_DECREASE' } },
    ] : []),
  ];
}

function normalize(input: CreateStockOpnameInput) {
  return { ...input, countedAt: input.countedAt.toISOString(), lines: [...input.lines].sort((a, b) => `${a.inventoryItemId}:${a.stockLocationId}:${a.batchId || ''}`.localeCompare(`${b.inventoryItemId}:${b.stockLocationId}:${b.batchId || ''}`)) };
}

export async function createStockOpname(actorUserId: string, input: CreateStockOpnameInput) {
  await assertBranchAccess(actorUserId, input.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_OPNAME_CREATE, input.branchId);
  const payloadHash = hash(normalize(input));
  const replay = await prisma.stockOpname.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: includeOpname });
  if (replay) {
    if (replay.payloadHash !== payloadHash) throw errors.conflict('STOCK_OPNAME_KEY_REUSED', 'Idempotency key opname digunakan untuk payload berbeda.');
    return { stockOpname: replay, idempotentReplay: true };
  }
  const keys = input.lines.map((line) => `${line.inventoryItemId}:${line.stockLocationId}:${line.batchId || 'NO_BATCH'}`);
  if (new Set(keys).size !== keys.length) throw errors.badRequest('STOCK_OPNAME_LINE_DUPLICATE', 'Item/location/batch opname tidak boleh duplikat.');
  const result = await prisma.$transaction(async (tx) => {
    const items = await tx.inventoryItem.findMany({ where: { id: { in: input.lines.map((line) => line.inventoryItemId) }, branchId: input.branchId }, include: { masterProduct: true } });
    if (items.length !== new Set(input.lines.map((line) => line.inventoryItemId)).size) throw errors.badRequest('STOCK_OPNAME_ITEM_INVALID', 'Salah satu inventory item tidak berada pada branch opname.');
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const lines = [];
    let estimatedValue = new Prisma.Decimal(0);
    for (const [index, line] of input.lines.entries()) {
      const item = itemMap.get(line.inventoryItemId)!;
      if (item.masterProduct.tracksBatch !== Boolean(line.batchId)) throw errors.badRequest('STOCK_OPNAME_BATCH_INVALID', `Batch ${item.masterProduct.name} tidak sesuai konfigurasi produk.`);
      const location = await tx.stockLocation.findUnique({ where: { id: line.stockLocationId }, include: { warehouse: true } });
      if (!location?.isActive || location.warehouse.branchId !== input.branchId) throw errors.badRequest('STOCK_OPNAME_LOCATION_INVALID', 'Stock location tidak berada pada branch opname.');
      const batchKey = line.batchId || 'NO_BATCH';
      const balance = await tx.inventoryBalance.findUnique({ where: { inventoryItemId_stockLocationId_batchKey: { inventoryItemId: line.inventoryItemId, stockLocationId: line.stockLocationId, batchKey } } });
      const systemQty = balance?.onHandQty || new Prisma.Decimal(0);
      const physicalQty = new Prisma.Decimal(line.physicalQty);
      const differenceQty = physicalQty.sub(systemQty);
      const positiveUnitCost = line.positiveUnitCost ? new Prisma.Decimal(line.positiveUnitCost) : null;
      if (differenceQty.greaterThan(0) && (!positiveUnitCost || !positiveUnitCost.greaterThan(0))) throw errors.unprocessable('STOCK_OPNAME_UNIT_COST_REQUIRED', `Unit cost selisih lebih ${item.masterProduct.name} wajib diisi.`);
      let estimate = new Prisma.Decimal(0);
      if (differenceQty.greaterThan(0)) estimate = differenceQty.mul(positiveUnitCost!);
      if (differenceQty.lessThan(0) && balance) {
        const aggregate = await tx.inventoryCostLayer.aggregate({ where: { inventoryBalanceId: balance.id, remainingQty: { gt: 0 }, isVoided: false }, _sum: { remainingQty: true } });
        const layers = await tx.inventoryCostLayer.findMany({ where: { inventoryBalanceId: balance.id, remainingQty: { gt: 0 }, isVoided: false }, select: { remainingQty: true, unitCost: true } });
        const qty = aggregate._sum.remainingQty || new Prisma.Decimal(0);
        const value = layers.reduce((sum, layer) => sum.add(layer.remainingQty.mul(layer.unitCost || 0)), new Prisma.Decimal(0));
        if (qty.greaterThan(0)) estimate = differenceQty.abs().mul(value.div(qty));
      }
      estimatedValue = estimatedValue.add(estimate);
      lines.push({ lineNo: index + 1, inventoryItemId: line.inventoryItemId, stockLocationId: line.stockLocationId, batchId: line.batchId, batchKey, systemQty, physicalQty, differenceQty, positiveUnitCost, notes: line.notes });
    }
    const opname = await tx.stockOpname.create({ data: {
      opnameNumber: `SOP/${input.countedAt.getUTCFullYear()}/${randomUUID().slice(0, 8).toUpperCase()}`,
      idempotencyKey: input.idempotencyKey, payloadHash, branchId: input.branchId,
      reasonCode: input.reasonCode, notes: input.notes, countedAt: input.countedAt,
      createdBy: actorUserId, totalAdjustmentValue: estimatedValue.toDecimalPlaces(2), lines: { create: lines },
    }, include: includeOpname });
    return opname;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await logAudit({ userId: actorUserId, branchId: input.branchId, action: 'CREATE', resource: 'StockOpname', resourceId: result.id, entityCode: result.opnameNumber, afterData: { status: result.status, reasonCode: result.reasonCode, totalAdjustmentValue: result.totalAdjustmentValue, lineCount: result.lines.length } });
  return { stockOpname: result, idempotentReplay: false };
}

export async function submitStockOpname(actorUserId: string, id: string) {
  const candidate = await prisma.stockOpname.findUnique({ where: { id }, include: { lines: true } });
  if (!candidate) throw errors.notFound('Stock opname tidak ditemukan.');
  await assertBranchAccess(actorUserId, candidate.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_OPNAME_CREATE, candidate.branchId);
  if (candidate.createdBy !== actorUserId) throw errors.forbidden('Hanya maker yang dapat submit stock opname.');
  if (candidate.status !== StockOpnameStatus.DRAFT && candidate.status !== StockOpnameStatus.REJECTED) throw errors.conflict('STOCK_OPNAME_STATUS_INVALID', 'Stock opname tidak dapat disubmit dari status ini.');
  return prisma.$transaction(async (tx) => {
    const submittedAt = new Date();
    const approval = await startApprovalInTransaction({
      module: 'STOCK_OPNAME', entityType: 'StockOpname', entityId: candidate.id, entityNumber: candidate.opnameNumber,
      branchId: candidate.branchId, makerUserId: candidate.createdBy, amount: candidate.totalAdjustmentValue,
      category: candidate.reasonCode, transactionType: 'STOCK_OPNAME',
      payload: { id: candidate.id, payloadHash: candidate.payloadHash, totalAdjustmentValue: candidate.totalAdjustmentValue.toFixed(2) },
    }, tx);
    return tx.stockOpname.update({ where: { id }, data: { status: StockOpnameStatus.SUBMITTED, submittedAt, rejectionReason: null, approvalInstanceId: approval.instance.id }, include: includeOpname });
  });
}

export async function decideStockOpname(actorUserId: string, id: string, decisionType: ApprovalDecisionType, note?: string) {
  const candidate = await prisma.stockOpname.findUnique({ where: { id } });
  if (!candidate) throw errors.notFound('Stock opname tidak ditemukan.');
  await assertBranchAccess(actorUserId, candidate.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_ADJUSTMENT_APPROVE, candidate.branchId);
  if (!candidate.approvalInstanceId || candidate.status !== StockOpnameStatus.SUBMITTED) throw errors.conflict('STOCK_OPNAME_NOT_SUBMITTED', 'Stock opname belum disubmit.');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "stock_opnames" WHERE "id" = ${id} FOR UPDATE`);
    const opname = await tx.stockOpname.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { lineNo: 'asc' } } } });
    const decision = await decideApprovalInTransaction({ instanceId: opname.approvalInstanceId!, actorUserId, decision: decisionType, note }, tx);
    if (decisionType === ApprovalDecisionType.REJECT) return tx.stockOpname.update({ where: { id }, data: { status: StockOpnameStatus.REJECTED, reviewedBy: actorUserId, reviewedAt: new Date(), rejectionReason: note } });
    if (!decision.approved) return { ...opname, approvalStatus: decision.instance.status, approvalStep: decision.instance.currentStep };
    await assertPermission(actorUserId, PERMISSIONS.INVENTORY_ADJUSTMENT_POST, opname.branchId);
    let increaseValue = new Prisma.Decimal(0);
    let decreaseValue = new Prisma.Decimal(0);
    for (const line of opname.lines) {
      const balance = await tx.inventoryBalance.findUnique({ where: { inventoryItemId_stockLocationId_batchKey: { inventoryItemId: line.inventoryItemId, stockLocationId: line.stockLocationId, batchKey: line.batchKey } } });
      const currentQty = balance?.onHandQty || new Prisma.Decimal(0);
      if (!currentQty.equals(line.systemQty)) throw errors.conflict('STOCK_OPNAME_SNAPSHOT_STALE', `Saldo stok berubah setelah snapshot pada baris ${line.lineNo}; lakukan opname ulang.`);
      if (line.differenceQty.isZero()) continue;
      if (line.differenceQty.greaterThan(0)) {
        const batch = line.batchId ? await tx.inventoryBatch.findUniqueOrThrow({ where: { id: line.batchId } }) : null;
        const posting = await receiveAdjustmentInventoryInTransaction(actorUserId, {
          idempotencyKey: `STOCK-OPNAME-IN:${opname.id}:${line.lineNo}`, branchId: opname.branchId,
          inventoryItemId: line.inventoryItemId, stockLocationId: line.stockLocationId,
          quantity: line.differenceQty.toFixed(4), unitCost: line.positiveUnitCost!.toFixed(4), currency: 'IDR',
          sourceType: 'STOCK_OPNAME', sourceId: opname.id, sourceNumber: opname.opnameNumber,
          reasonCode: opname.reasonCode, occurredAt: opname.countedAt, costCenterCode: opname.branchId,
          batch: batch ? { batchNumber: batch.batchNumber, manufactureDate: batch.manufactureDate || undefined, expiryDate: batch.expiryDate || undefined } : undefined,
        }, tx);
        increaseValue = increaseValue.add(posting.totalCost);
        const mutation = await tx.stockMutation.findFirstOrThrow({ where: { inventoryPostingId: posting.id, inventoryItemId: line.inventoryItemId } });
        await tx.stockOpnameLine.update({ where: { id: line.id }, data: { inventoryPostingId: posting.id, stockMutationId: mutation.id, actualCost: posting.totalCost } });
      } else {
        const postingId = await issueAdjustmentInventoryInTransaction(actorUserId, {
          idempotencyKey: `STOCK-OPNAME-OUT:${opname.id}:${line.lineNo}`, branchId: opname.branchId,
          sourceType: 'STOCK_OPNAME', sourceId: opname.id, sourceNumber: opname.opnameNumber,
          reasonCode: opname.reasonCode, occurredAt: opname.countedAt, costCenterCode: opname.branchId,
          lines: [{ inventoryItemId: line.inventoryItemId, stockLocationId: line.stockLocationId, batchId: line.batchId || undefined, quantity: line.differenceQty.abs().toFixed(4) }],
        }, tx);
        const posting = await tx.inventoryPosting.findUniqueOrThrow({ where: { id: postingId }, include: { stockMutations: true } });
        decreaseValue = decreaseValue.add(posting.totalCost);
        await tx.stockOpnameLine.update({ where: { id: line.id }, data: { inventoryPostingId: posting.id, stockMutationId: posting.stockMutations[0]?.id, actualCost: posting.totalCost } });
      }
    }
    const lines = buildStockOpnameJournalLines(increaseValue, decreaseValue);
    if (!lines.length) throw errors.unprocessable('STOCK_OPNAME_NO_DIFFERENCE', 'Stock opname tidak memiliki selisih untuk diposting.');
    const journal = await postStockOpnameJournal({
      postingKey: `STOCK_OPNAME:${opname.id}`, transactionDate: opname.countedAt, branchId: opname.branchId,
      actorUserId, description: `Stock opname ${opname.opnameNumber}`, costCenterCode: opname.branchId, lines,
      sourceLinks: [{ sourceType: 'STOCK_OPNAME', sourceId: opname.id, sourceNumber: opname.opnameNumber }],
      metadata: { approvalInstanceId: opname.approvalInstanceId, reasonCode: opname.reasonCode, increaseValue: increaseValue.toFixed(4), decreaseValue: decreaseValue.toFixed(4) },
    }, tx);
    const postedAt = new Date();
    const posted = await tx.stockOpname.update({ where: { id }, data: { status: StockOpnameStatus.POSTED, reviewedBy: actorUserId, reviewedAt: postedAt, postedAt, journalEntryId: journal.journal.id, totalAdjustmentValue: increaseValue.add(decreaseValue).toDecimalPlaces(2) }, include: includeOpname });
    await createInventorySyncEventInTransaction(tx, {
      eventType: STOCK_OPNAME_POSTED_EVENT,
      aggregateType: 'StockOpnameInventory',
      aggregateId: opname.id,
      occurredAt: postedAt,
      snapshot: {
        sourceType: 'STOCK_OPNAME',
        localEntityId: opname.id,
        externalKey: `RAHO-OPNAME-${opname.opnameNumber}`,
        branchId: opname.branchId,
        occurredAt: postedAt.toISOString(),
        postingReference: opname.opnameNumber,
        reason: opname.reasonCode,
        lines: posted.lines
          .filter((line) => !line.differenceQty.isZero())
          .map((line) => ({
            inventoryItemId: line.inventoryItemId,
            sku: null,
            stockLocationId: line.stockLocationId,
            quantityAdjusted: line.differenceQty.toFixed(4),
            unitRate: line.actualCost && !line.differenceQty.isZero()
              ? line.actualCost.div(line.differenceQty.abs()).toFixed(4)
              : null,
            value: line.actualCost
              ? line.actualCost.mul(line.differenceQty.isNegative() ? -1 : 1).toFixed(4)
              : null,
          })),
      },
    });
    return posted;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listStockOpnames(actorUserId: string, query: StockOpnameListInput) {
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_OPNAME_READ, query.branchId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const branches = await getAccessibleBranchIds(actorUserId);
  const where: Prisma.StockOpnameWhereInput = { ...(query.branchId ? { branchId: query.branchId } : branches === null ? {} : { branchId: { in: branches } }), ...(query.status ? { status: query.status } : {}) };
  const [data, total] = await Promise.all([prisma.stockOpname.findMany({ where, include: includeOpname, orderBy: { countedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), prisma.stockOpname.count({ where })]);
  return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}
