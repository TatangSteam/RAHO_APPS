import { createHash, randomUUID } from 'crypto';
import {
  InventoryCostAllocationType,
  InventoryPostingStatus,
  InventoryPostingType,
  InventoryValuationStatus,
  Prisma,
  StockMutationType,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import { assertBranchAccess, assertPermission, getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import { logAudit } from '@utils/auditLog';
import type {
  InventoryLedgerQuery,
  IssueInventoryInput,
  OpeningInventoryInput,
  ReceiveInventoryInput,
  ReverseInventoryPostingInput,
} from '../inventory-ledger.schema';
import { allocateFifo, FifoLayerInput, sumAllocationCost } from './fifo-allocation.service';
import { calculateInventoryAssetValue } from './inventory-valuation.helpers';

type Tx = Prisma.TransactionClient;

type LockedInventoryItem = {
  id: string;
  masterProductId: string;
  branchId: string;
  stock: Prisma.Decimal;
  stockLocationId: string | null;
};

type LockedBalance = {
  id: string;
  inventoryItemId: string;
  stockLocationId: string;
  batchId: string | null;
  onHandQty: Prisma.Decimal;
  reservedQty: Prisma.Decimal;
  quarantineQty: Prisma.Decimal;
};

type LockedLayer = FifoLayerInput;

const MAX_TRANSACTION_ATTEMPTS = 3;

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function postingNumber(prefix: 'OPN' | 'RCV' | 'ISS' | 'REV'): string {
  return `INV-${prefix}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' || code === 'P2034' || /40001|40P01|serialization|deadlock/i.test(message);
}

async function withTransactionRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.floor(Math.random() * 15)));
    }
  }
  throw lastError;
}

async function findIdempotentPosting(tx: Tx, idempotencyKey: string, payloadHash: string) {
  const existing = await tx.inventoryPosting.findUnique({
    where: { idempotencyKey },
    include: { stockMutations: true, costAllocations: true },
  });
  if (!existing) return null;
  if (existing.payloadHash !== payloadHash) {
    throw errors.conflict('IDEMPOTENCY_CONFLICT', 'Idempotency key sudah digunakan dengan payload berbeda.');
  }
  return existing;
}

async function assertLocationForItem(tx: Tx, item: LockedInventoryItem, requestedLocationId?: string) {
  const stockLocationId = requestedLocationId ?? item.stockLocationId;
  if (!stockLocationId) throw errors.badRequest('STOCK_LOCATION_REQUIRED', 'Inventory item belum memiliki stock location.');
  const location = await tx.stockLocation.findUnique({
    where: { id: stockLocationId },
    include: { warehouse: true },
  });
  if (!location?.isActive || !location.warehouse.isActive || location.warehouse.branchId !== item.branchId) {
    throw errors.badRequest('INVALID_STOCK_LOCATION', 'Stock location tidak aktif atau tidak sesuai branch.');
  }
  return location;
}

async function lockInventoryItems(tx: Tx, ids: string[]): Promise<LockedInventoryItem[]> {
  const orderedIds = [...new Set(ids)].sort();
  if (orderedIds.length === 0) return [];
  return tx.$queryRaw<LockedInventoryItem[]>(Prisma.sql`
    SELECT "id", "masterProductId", "branchId", "stock", "stockLocationId"
    FROM "inventory_items"
    WHERE "id" IN (${Prisma.join(orderedIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
}

async function lockBalances(
  tx: Tx,
  inventoryItemId: string,
  stockLocationId: string,
  batchId?: string,
): Promise<LockedBalance[]> {
  const batchFilter = batchId
    ? Prisma.sql`AND b."batchId" = ${batchId}`
    : Prisma.empty;
  return tx.$queryRaw<LockedBalance[]>(Prisma.sql`
    SELECT b."id", b."inventoryItemId", b."stockLocationId", b."batchId",
           b."onHandQty", b."reservedQty", b."quarantineQty"
    FROM "inventory_balances" b
    WHERE b."inventoryItemId" = ${inventoryItemId}
      AND b."stockLocationId" = ${stockLocationId}
      ${batchFilter}
    ORDER BY b."id"
    FOR UPDATE
  `);
}

async function lockValidLayers(
  tx: Tx,
  inventoryItemId: string,
  stockLocationId: string,
  occurredAt: Date,
  batchId?: string,
): Promise<LockedLayer[]> {
  const batchFilter = batchId
    ? Prisma.sql`AND l."batchId" = ${batchId}`
    : Prisma.empty;
  return tx.$queryRaw<LockedLayer[]>(Prisma.sql`
    SELECT l."id", l."inventoryBalanceId", l."batchId", l."receivedAt", l."remainingQty", l."unitCost"
    FROM "inventory_cost_layers" l
    JOIN "inventory_balances" b ON b."id" = l."inventoryBalanceId"
    LEFT JOIN "inventory_batches" batch ON batch."id" = l."batchId"
    WHERE b."inventoryItemId" = ${inventoryItemId}
      AND b."stockLocationId" = ${stockLocationId}
      AND l."remainingQty" > 0
      AND l."unitCost" IS NOT NULL
      AND l."valuationStatus" = 'VALUED'
      AND l."isVoided" = false
      AND l."receivedAt" <= ${occurredAt}
      AND (batch."id" IS NULL OR (batch."isBlocked" = false AND (batch."expiryDate" IS NULL OR batch."expiryDate" > ${occurredAt})))
      ${batchFilter}
    ORDER BY l."receivedAt" ASC, l."id" ASC
    FOR UPDATE OF l
  `);
}

function capLayersToAvailableBalances(layers: LockedLayer[], balances: LockedBalance[]): LockedLayer[] {
  const availableByBalance = new Map(balances.map((balance) => [
    balance.id,
    balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty),
  ]));
  return layers.flatMap((layer) => {
    const balanceAvailable = availableByBalance.get(layer.inventoryBalanceId) ?? new Prisma.Decimal(0);
    if (balanceAvailable.lessThanOrEqualTo(0)) return [];
    const allocatableQty = Prisma.Decimal.min(layer.remainingQty, balanceAvailable);
    availableByBalance.set(layer.inventoryBalanceId, balanceAvailable.sub(allocatableQty));
    return allocatableQty.greaterThan(0) ? [{ ...layer, remainingQty: allocatableQty }] : [];
  });
}

async function loadPostingResult(postingId: string) {
  return prisma.inventoryPosting.findUniqueOrThrow({
    where: { id: postingId },
    include: {
      stockMutations: { include: { inventoryItem: { include: { masterProduct: true } }, batch: true } },
      costAllocations: { include: { costLayer: true } },
    },
  });
}

async function postInboundInventory(
  actorUserId: string,
  input: ReceiveInventoryInput,
  type: InventoryPostingType,
) {
  await assertBranchAccess(actorUserId, input.branchId);
  await assertPermission(
    actorUserId,
    type === InventoryPostingType.OPENING ? PERMISSIONS.INVENTORY_OPENING_POST : PERMISSIONS.INVENTORY_POST,
    input.branchId,
  );
  const payloadHash = hashPayload({ type, ...input });

  const postingId = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    const existing = await findIdempotentPosting(tx, input.idempotencyKey, payloadHash);
    if (existing) return existing.id;

    const [item] = await lockInventoryItems(tx, [input.inventoryItemId]);
    if (!item || item.branchId !== input.branchId) throw errors.notFound('Inventory item tidak ditemukan dalam branch.');
    const product = await tx.masterProduct.findUnique({ where: { id: item.masterProductId } });
    if (!product?.isActive) throw errors.badRequest('INVALID_PRODUCT', 'Product tidak aktif atau tidak ditemukan.');
    const location = await assertLocationForItem(tx, item, input.stockLocationId);

    let batchId: string | null = null;
    if (product.tracksBatch) {
      if (!input.batch) throw errors.badRequest('BATCH_REQUIRED', 'Batch wajib untuk product ini.');
      if (product.tracksExpiry && !input.batch.expiryDate) throw errors.badRequest('EXPIRY_REQUIRED', 'Expiry date wajib untuk product ini.');
      if (input.batch.manufactureDate && input.batch.expiryDate && input.batch.expiryDate <= input.batch.manufactureDate) {
        throw errors.badRequest('INVALID_BATCH_DATES', 'Expiry date harus setelah manufacture date.');
      }
      const batch = await tx.inventoryBatch.upsert({
        where: { masterProductId_batchNumber: { masterProductId: product.id, batchNumber: input.batch.batchNumber } },
        create: {
          masterProductId: product.id,
          batchNumber: input.batch.batchNumber,
          manufactureDate: input.batch.manufactureDate,
          expiryDate: input.batch.expiryDate,
        },
        update: {},
      });
      if (batch.isBlocked) throw errors.unprocessable('BATCH_BLOCKED', 'Batch sedang diblokir.');
      batchId = batch.id;
    } else if (input.batch) {
      throw errors.badRequest('BATCH_NOT_ENABLED', 'Product ini tidak menggunakan batch tracking.');
    }

    const batchKey = batchId ?? 'NO_BATCH';
    const balance = await tx.inventoryBalance.upsert({
      where: { inventoryItemId_stockLocationId_batchKey: { inventoryItemId: item.id, stockLocationId: location.id, batchKey } },
      create: {
        inventoryItemId: item.id, stockLocationId: location.id, masterProductId: product.id,
        branchId: item.branchId, batchId, batchKey,
      },
      update: {},
    });
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_balances" WHERE "id" = ${balance.id} FOR UPDATE`);

    const quantity = new Prisma.Decimal(input.quantity);
    const unitCost = new Prisma.Decimal(input.unitCost);
    const totalCost = quantity.mul(unitCost);
    const posting = await tx.inventoryPosting.create({
      data: {
        postingNumber: postingNumber(type === InventoryPostingType.OPENING ? 'OPN' : 'RCV'), idempotencyKey: input.idempotencyKey, payloadHash,
        type, reasonCode: input.reasonCode, sourceType: input.sourceType,
        sourceId: input.sourceId, sourceNumber: input.sourceNumber, branchId: input.branchId,
        costCenterCode: input.costCenterCode, occurredAt: input.occurredAt, totalCost, postedBy: actorUserId,
      },
    });
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { onHandQty: { increment: quantity }, version: { increment: 1 } } });
    await tx.inventoryItem.update({ where: { id: item.id }, data: { stock: { increment: quantity }, warehouseId: location.warehouseId, stockLocationId: location.id } });
    const mutation = await tx.stockMutation.create({
      data: {
        inventoryItemId: item.id, type: StockMutationType.RECEIVED, quantity,
        stockBefore: item.stock, stockAfter: item.stock.add(quantity), referenceType: input.sourceType,
        referenceId: input.sourceId, notes: input.reasonCode, createdBy: actorUserId,
        inventoryPostingId: posting.id, inventoryBalanceId: balance.id, batchId, actualCost: totalCost,
      },
    });
    await tx.inventoryCostLayer.create({
      data: {
        inventoryBalanceId: balance.id, batchId, sourceType: input.sourceType, sourceId: input.sourceId,
        originalQty: quantity, remainingQty: quantity, unitCost, currency: input.currency,
        valuationStatus: InventoryValuationStatus.VALUED, receivedAt: input.occurredAt,
      },
    });
    return mutation.inventoryPostingId!;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  const result = await loadPostingResult(postingId);
  await logAudit({ userId: actorUserId, branchId: input.branchId, action: 'CREATE', resource: 'InventoryPosting', resourceId: postingId, afterData: { type, sourceType: input.sourceType, sourceId: input.sourceId, quantity: input.quantity } });
  return result;
}

export async function receiveInventory(actorUserId: string, input: ReceiveInventoryInput) {
  return postInboundInventory(actorUserId, input, InventoryPostingType.RECEIPT);
}

export async function postOpeningInventory(actorUserId: string, input: OpeningInventoryInput) {
  return postInboundInventory(actorUserId, {
    ...input,
    sourceType: 'OPENING_STOCK',
    reasonCode: 'OPENING_STOCK',
  }, InventoryPostingType.OPENING);
}

/**
 * Opening-stock integration point. The caller owns the surrounding database
 * transaction so inventory cost layer and finance journal commit together.
 */
async function receiveInboundInventoryInTransaction(
  actorUserId: string,
  input: ReceiveInventoryInput,
  tx: Tx,
  postingType: InventoryPostingType,
) {
  await assertBranchAccess(actorUserId, input.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_POST, input.branchId);
  const payloadHash = hashPayload({ ...input, postingType });
  const existing = await findIdempotentPosting(tx, input.idempotencyKey, payloadHash);
  if (existing) return existing;

  const [item] = await lockInventoryItems(tx, [input.inventoryItemId]);
  if (!item || item.branchId !== input.branchId) throw errors.notFound('Inventory item penerimaan tidak ditemukan dalam branch.');
  const product = await tx.masterProduct.findUnique({ where: { id: item.masterProductId } });
  if (!product?.isActive) throw errors.badRequest('INVALID_PRODUCT', 'Product tidak aktif atau tidak ditemukan.');
  const location = await assertLocationForItem(tx, item, input.stockLocationId);

  let batchId: string | null = null;
  if (product.tracksBatch) {
    if (!input.batch) throw errors.badRequest('BATCH_REQUIRED', 'Batch wajib untuk penerimaan product ini.');
    if (product.tracksExpiry && !input.batch.expiryDate) throw errors.badRequest('EXPIRY_REQUIRED', 'Expiry date wajib untuk product ini.');
    if (input.batch.manufactureDate && input.batch.expiryDate && input.batch.expiryDate <= input.batch.manufactureDate) {
      throw errors.badRequest('INVALID_BATCH_DATES', 'Expiry date harus setelah manufacture date.');
    }
    const batch = await tx.inventoryBatch.upsert({
      where: { masterProductId_batchNumber: { masterProductId: product.id, batchNumber: input.batch.batchNumber } },
      create: {
        masterProductId: product.id,
        batchNumber: input.batch.batchNumber,
        manufactureDate: input.batch.manufactureDate,
        expiryDate: input.batch.expiryDate,
      },
      update: {},
    });
    if (batch.isBlocked) throw errors.unprocessable('BATCH_BLOCKED', 'Batch penerimaan sedang diblokir.');
    batchId = batch.id;
  } else if (input.batch) {
    throw errors.badRequest('BATCH_NOT_ENABLED', 'Product ini tidak menggunakan batch tracking.');
  }

  const batchKey = batchId ?? 'NO_BATCH';
  const balance = await tx.inventoryBalance.upsert({
    where: { inventoryItemId_stockLocationId_batchKey: { inventoryItemId: item.id, stockLocationId: location.id, batchKey } },
    create: {
      inventoryItemId: item.id,
      stockLocationId: location.id,
      masterProductId: product.id,
      branchId: item.branchId,
      batchId,
      batchKey,
    },
    update: {},
  });
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_balances" WHERE "id" = ${balance.id} FOR UPDATE`);

  const quantity = new Prisma.Decimal(input.quantity);
  const unitCost = new Prisma.Decimal(input.unitCost);
  const totalCost = quantity.mul(unitCost);
  const posting = await tx.inventoryPosting.create({
    data: {
      postingNumber: postingNumber(postingType === InventoryPostingType.OPENING ? 'OPN' : 'RCV'),
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      type: postingType,
      reasonCode: input.reasonCode,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceNumber: input.sourceNumber,
      branchId: input.branchId,
      costCenterCode: input.costCenterCode,
      occurredAt: input.occurredAt,
      totalCost,
      postedBy: actorUserId,
    },
  });
  await tx.inventoryBalance.update({ where: { id: balance.id }, data: { onHandQty: { increment: quantity }, version: { increment: 1 } } });
  await tx.inventoryItem.update({ where: { id: item.id }, data: { stock: { increment: quantity }, warehouseId: location.warehouseId, stockLocationId: location.id } });
  const mutation = await tx.stockMutation.create({
    data: {
      inventoryItemId: item.id,
      type: StockMutationType.RECEIVED,
      quantity,
      stockBefore: item.stock,
      stockAfter: item.stock.add(quantity),
      referenceType: input.sourceType,
      referenceId: input.sourceId,
      notes: input.reasonCode,
      createdBy: actorUserId,
      inventoryPostingId: posting.id,
      inventoryBalanceId: balance.id,
      batchId,
      actualCost: totalCost,
    },
  });
  const costLayer = await tx.inventoryCostLayer.create({
    data: {
      inventoryBalanceId: balance.id,
      batchId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      originalQty: quantity,
      remainingQty: quantity,
      unitCost,
      currency: input.currency,
      valuationStatus: InventoryValuationStatus.VALUED,
      receivedAt: input.occurredAt,
    },
  });
  return { ...posting, stockMutationId: mutation.id, costLayerId: costLayer.id };
}

export function receiveOpeningInventoryInTransaction(actorUserId: string, input: ReceiveInventoryInput, tx: Tx) {
  return receiveInboundInventoryInTransaction(actorUserId, input, tx, InventoryPostingType.OPENING);
}

/** Purchasing integration point: receipt, FIFO layer, and journal share one DB transaction. */
export function receivePurchasedInventoryInTransaction(actorUserId: string, input: ReceiveInventoryInput, tx: Tx) {
  return receiveInboundInventoryInTransaction(actorUserId, input, tx, InventoryPostingType.RECEIPT);
}

function ensureUniqueIssueLines(input: IssueInventoryInput) {
  const keys = input.lines.map((line) => `${line.inventoryItemId}:${line.stockLocationId ?? ''}:${line.batchId ?? ''}`);
  if (new Set(keys).size !== keys.length) throw errors.badRequest('DUPLICATE_ISSUE_LINE', 'Inventory item/location/batch tidak boleh duplikat dalam satu posting.');
}

export async function issueInventoryInTransaction(
  actorUserId: string,
  input: IssueInventoryInput,
  tx: Tx,
): Promise<string> {
  ensureUniqueIssueLines(input);
  const normalizedLines = [...input.lines].sort((a, b) => `${a.inventoryItemId}:${a.batchId ?? ''}`.localeCompare(`${b.inventoryItemId}:${b.batchId ?? ''}`));
  const payloadHash = hashPayload({ ...input, lines: normalizedLines });
  const existing = await findIdempotentPosting(tx, input.idempotencyKey, payloadHash);
  if (existing) return existing.id;

  const items = await lockInventoryItems(tx, normalizedLines.map((line) => line.inventoryItemId));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  if (items.length !== new Set(normalizedLines.map((line) => line.inventoryItemId)).size || items.some((item) => item.branchId !== input.branchId)) {
    throw errors.notFound('Satu atau lebih inventory item tidak ditemukan dalam branch.');
  }

  const posting = await tx.inventoryPosting.create({
    data: {
      postingNumber: postingNumber('ISS'), idempotencyKey: input.idempotencyKey, payloadHash,
      type: InventoryPostingType.ISSUE, reasonCode: input.reasonCode, sourceType: input.sourceType,
      sourceId: input.sourceId, sourceNumber: input.sourceNumber, branchId: input.branchId,
      costCenterCode: input.costCenterCode, occurredAt: input.occurredAt, postedBy: actorUserId,
    },
  });

  let postingCost = new Prisma.Decimal(0);
  for (const line of normalizedLines) {
    const item = itemMap.get(line.inventoryItemId)!;
    const location = await assertLocationForItem(tx, item, line.stockLocationId);
    const quantity = new Prisma.Decimal(line.quantity);
    const balances = await lockBalances(tx, item.id, location.id, line.batchId);
    const available = balances.reduce(
      (sum, balance) => sum.add(balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty)),
      new Prisma.Decimal(0),
    );
    if (available.lessThan(quantity)) {
      throw errors.unprocessable('INSUFFICIENT_AVAILABLE_STOCK', `Stok tersedia hanya ${available.toFixed(4)} unit.`);
    }

    const layers = await lockValidLayers(tx, item.id, location.id, input.occurredAt, line.batchId);
    const allocations = allocateFifo(quantity, capLayersToAvailableBalances(layers, balances));
    const lineCost = sumAllocationCost(allocations);
    postingCost = postingCost.add(lineCost);

    const mirrorUpdate = await tx.inventoryItem.updateMany({
      where: { id: item.id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (mirrorUpdate.count !== 1) throw errors.unprocessable('INSUFFICIENT_AVAILABLE_STOCK', 'Compatibility stock tidak mencukupi.');

    const stockBefore = item.stock;
    const mutation = await tx.stockMutation.create({
      data: {
        inventoryItemId: item.id, type: StockMutationType.USED, quantity,
        stockBefore, stockAfter: stockBefore.sub(quantity), referenceType: input.sourceType,
        referenceId: input.sourceId, notes: input.reasonCode, createdBy: actorUserId,
        inventoryPostingId: posting.id,
        inventoryBalanceId: allocations.length === 1 ? allocations[0].inventoryBalanceId : null,
        batchId: line.batchId ?? (new Set(allocations.map((allocation) => allocation.batchId)).size === 1 ? allocations[0].batchId : null),
        actualCost: lineCost,
      },
    });

    const quantityByBalance = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations) {
      quantityByBalance.set(
        allocation.inventoryBalanceId,
        (quantityByBalance.get(allocation.inventoryBalanceId) ?? new Prisma.Decimal(0)).add(allocation.quantity),
      );
      const layerUpdate = await tx.inventoryCostLayer.updateMany({
        where: { id: allocation.layerId, remainingQty: { gte: allocation.quantity }, isVoided: false },
        data: { remainingQty: { decrement: allocation.quantity } },
      });
      if (layerUpdate.count !== 1) throw errors.conflict('INVENTORY_CONCURRENCY_CONFLICT', 'Cost layer berubah saat diproses.');
      await tx.inventoryCostAllocation.create({
        data: {
          postingId: posting.id, stockMutationId: mutation.id, costLayerId: allocation.layerId,
          type: InventoryCostAllocationType.CONSUMPTION, quantity: allocation.quantity,
          unitCost: allocation.unitCost, totalCost: allocation.totalCost,
        },
      });
    }

    for (const [balanceId, allocatedQuantity] of quantityByBalance) {
      const lockedBalance = balances.find((balance) => balance.id === balanceId);
      if (!lockedBalance) throw errors.conflict('INVENTORY_BALANCE_MISSING', 'Inventory balance allocation tidak ditemukan.');
      const minimumOnHand = allocatedQuantity.add(lockedBalance.reservedQty).add(lockedBalance.quarantineQty);
      const balanceUpdate = await tx.inventoryBalance.updateMany({
        where: { id: balanceId, onHandQty: { gte: minimumOnHand } },
        data: { onHandQty: { decrement: allocatedQuantity }, version: { increment: 1 } },
      });
      if (balanceUpdate.count !== 1) throw errors.conflict('INVENTORY_CONCURRENCY_CONFLICT', 'Inventory balance berubah saat diproses.');
    }
    item.stock = item.stock.sub(quantity);
  }

  await tx.inventoryPosting.update({ where: { id: posting.id }, data: { totalCost: postingCost } });
  return posting.id;
}

export async function issueInventory(actorUserId: string, input: IssueInventoryInput) {
  ensureUniqueIssueLines(input);
  await assertBranchAccess(actorUserId, input.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_POST, input.branchId);
  const postingId = await withTransactionRetry(() => prisma.$transaction(
    (tx) => issueInventoryInTransaction(actorUserId, input, tx),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ));

  const result = await loadPostingResult(postingId);
  await logAudit({ userId: actorUserId, branchId: input.branchId, action: 'CREATE', resource: 'InventoryPosting', resourceId: postingId, afterData: { type: 'ISSUE', sourceType: input.sourceType, sourceId: input.sourceId, totalCost: result.totalCost } });
  return result;
}

export async function reverseInventoryPostingInTransaction(
  actorUserId: string,
  postingId: string,
  input: ReverseInventoryPostingInput,
  tx: Tx,
) {
  const payloadHash = hashPayload({ postingId, ...input });
  const existing = await findIdempotentPosting(tx, input.idempotencyKey, payloadHash);
  if (existing) return existing.id;
  const [lockedOriginal] = await tx.$queryRaw<Array<{ id: string; status: InventoryPostingStatus }>>(Prisma.sql`
    SELECT "id", "status" FROM "inventory_postings" WHERE "id" = ${postingId} FOR UPDATE
  `);
  if (!lockedOriginal) throw errors.notFound('Inventory posting tidak ditemukan.');
  if (lockedOriginal.status === InventoryPostingStatus.REVERSED) {
    throw errors.conflict('POSTING_ALREADY_REVERSED', 'Posting sudah dibalik.');
  }
  const original = await tx.inventoryPosting.findUniqueOrThrow({ where: { id: postingId } });
  if (original.type !== InventoryPostingType.ISSUE) {
    throw errors.badRequest('REVERSAL_NOT_SUPPORTED', 'Reversal hanya didukung untuk posting ISSUE.');
  }

  const mutations = await tx.stockMutation.findMany({
    where: { inventoryPostingId: postingId },
    include: { costAllocations: { where: { type: InventoryCostAllocationType.CONSUMPTION } } },
    orderBy: { id: 'asc' },
  });
  if (mutations.length === 0 || mutations.some((mutation) => mutation.costAllocations.length === 0)) {
    throw errors.conflict('ALLOCATION_TRACE_MISSING', 'Allocation posting asal tidak lengkap.');
  }
  await lockInventoryItems(tx, mutations.map((mutation) => mutation.inventoryItemId));
  const layerIds = [...new Set(
    mutations.flatMap((mutation) => mutation.costAllocations.map((allocation) => allocation.costLayerId)),
  )].sort();
  if (layerIds.length > 0) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "inventory_cost_layers"
      WHERE "id" IN (${Prisma.join(layerIds)}) ORDER BY "id" FOR UPDATE
    `);
  }

  const reversal = await tx.inventoryPosting.create({
    data: {
      postingNumber: postingNumber('REV'),
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      type: InventoryPostingType.REVERSAL,
      reasonCode: input.reasonCode,
      sourceType: 'INVENTORY_POSTING',
      sourceId: postingId,
      branchId: original.branchId,
      occurredAt: input.occurredAt,
      totalCost: original.totalCost.neg(),
      postedBy: actorUserId,
      reversalOfId: postingId,
    },
  });

  for (const mutation of mutations) {
    const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: mutation.inventoryItemId } });
    await tx.inventoryItem.update({ where: { id: item.id }, data: { stock: { increment: mutation.quantity } } });
    const reversalMutation = await tx.stockMutation.create({
      data: {
        inventoryItemId: item.id,
        type: StockMutationType.ADJUSTMENT,
        quantity: mutation.quantity,
        stockBefore: item.stock,
        stockAfter: item.stock.add(mutation.quantity),
        referenceType: 'INVENTORY_POSTING',
        referenceId: postingId,
        notes: input.reasonCode,
        createdBy: actorUserId,
        inventoryPostingId: reversal.id,
        inventoryBalanceId: mutation.inventoryBalanceId,
        batchId: mutation.batchId,
        actualCost: mutation.actualCost?.neg(),
      },
    });

    const balanceQuantities = new Map<string, Prisma.Decimal>();
    for (const allocation of mutation.costAllocations) {
      const layer = await tx.inventoryCostLayer.findUniqueOrThrow({ where: { id: allocation.costLayerId } });
      await tx.inventoryCostLayer.update({
        where: { id: layer.id },
        data: { remainingQty: { increment: allocation.quantity } },
      });
      balanceQuantities.set(
        layer.inventoryBalanceId,
        (balanceQuantities.get(layer.inventoryBalanceId) ?? new Prisma.Decimal(0)).add(allocation.quantity),
      );
      await tx.inventoryCostAllocation.create({
        data: {
          postingId: reversal.id,
          stockMutationId: reversalMutation.id,
          costLayerId: layer.id,
          type: InventoryCostAllocationType.REVERSAL,
          quantity: allocation.quantity,
          unitCost: allocation.unitCost,
          totalCost: allocation.totalCost,
          reversalOfId: allocation.id,
        },
      });
    }
    for (const [balanceId, quantity] of balanceQuantities) {
      await tx.inventoryBalance.update({
        where: { id: balanceId },
        data: { onHandQty: { increment: quantity }, version: { increment: 1 } },
      });
    }
  }

  await tx.inventoryPosting.update({
    where: { id: postingId },
    data: { status: InventoryPostingStatus.REVERSED, reversedAt: input.occurredAt },
  });
  return reversal.id;
}

export async function reverseInventoryPosting(actorUserId: string, postingId: string, input: ReverseInventoryPostingInput) {
  const original = await prisma.inventoryPosting.findUnique({ where: { id: postingId } });
  if (!original) throw errors.notFound('Inventory posting tidak ditemukan.');
  await assertBranchAccess(actorUserId, original.branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_REVERSE, original.branchId);
  const reversalId = await withTransactionRetry(() => prisma.$transaction(
    (tx) => reverseInventoryPostingInTransaction(actorUserId, postingId, input, tx),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ));

  const result = await loadPostingResult(reversalId);
  await logAudit({ userId: actorUserId, branchId: original.branchId, action: 'UPDATE', resource: 'InventoryPosting', resourceId: reversalId, beforeData: { postingId, status: original.status }, afterData: { reversalId, status: 'REVERSED' } });
  return result;
}

export async function listInventoryBalances(actorUserId: string, query: InventoryLedgerQuery) {
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_READ, query.branchId);
  const accessible = await getAccessibleBranchIds(actorUserId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const where: Prisma.InventoryBalanceWhereInput = {
    ...(query.branchId ? { branchId: query.branchId } : accessible === null ? {} : { branchId: { in: accessible } }),
    ...(query.masterProductId ? { masterProductId: query.masterProductId } : {}),
    ...(query.inventoryItemId ? { inventoryItemId: query.inventoryItemId } : {}),
    ...(query.stockLocationId ? { stockLocationId: query.stockLocationId } : {}),
    ...(query.batchId ? { batchId: query.batchId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.inventoryBalance.findMany({
      where,
      include: { masterProduct: true, branch: true, stockLocation: { include: { warehouse: true } }, batch: true },
      orderBy: [{ branchId: 'asc' }, { masterProductId: 'asc' }, { batchKey: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inventoryBalance.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({
      ...row,
      availableQty: row.onHandQty.sub(row.reservedQty).sub(row.quarantineQty),
    })),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function listInventoryPostings(actorUserId: string, query: InventoryLedgerQuery) {
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_READ, query.branchId);
  const accessible = await getAccessibleBranchIds(actorUserId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const where: Prisma.InventoryPostingWhereInput = query.branchId
    ? { branchId: query.branchId }
    : accessible === null ? {} : { branchId: { in: accessible } };
  return prisma.inventoryPosting.findMany({
    where,
    include: { stockMutations: { include: { inventoryItem: { include: { masterProduct: true } }, batch: true } }, costAllocations: true },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });
}

export async function reconcileInventory(actorUserId: string, branchId: string) {
  await assertBranchAccess(actorUserId, branchId);
  await assertPermission(actorUserId, PERMISSIONS.INVENTORY_RECONCILE, branchId);
  const [items, openTransfers] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { branchId },
      include: { balances: { include: { costLayers: true } }, masterProduct: true },
    }),
    prisma.internalTransferLedger.findMany({ where: { fromBranchId: branchId, status: { in: ['IN_TRANSIT', 'DISCREPANCY'] } } }),
  ]);
  const results = items.map((item) => {
    const balanceQty = item.balances.reduce((sum, balance) => sum.add(balance.onHandQty), new Prisma.Decimal(0));
    const valuedLayerQty = item.balances.reduce(
      (sum, balance) => sum.add(balance.costLayers
        .filter((layer) => layer.valuationStatus === InventoryValuationStatus.VALUED && !layer.isVoided)
        .reduce((layerSum, layer) => layerSum.add(layer.remainingQty), new Prisma.Decimal(0))),
      new Prisma.Decimal(0),
    );
    const pendingValuationQty = item.balances.reduce(
      (sum, balance) => sum.add(balance.costLayers
        .filter((layer) => layer.valuationStatus === InventoryValuationStatus.PENDING_VALUATION && !layer.isVoided)
        .reduce((layerSum, layer) => layerSum.add(layer.remainingQty), new Prisma.Decimal(0))),
      new Prisma.Decimal(0),
    );
    return {
      inventoryItemId: item.id,
      productName: item.masterProduct.name,
      mirrorStock: item.stock,
      balanceQty,
      valuedLayerQty,
      pendingValuationQty,
      assetValue: calculateInventoryAssetValue(item.balances.flatMap((balance) => balance.costLayers)),
      balanceMatchesMirror: balanceQty.equals(item.stock),
      layerMatchesBalance: valuedLayerQty.add(pendingValuationQty).equals(balanceQty),
    };
  });
  const mismatches = results.filter((result) => !result.balanceMatchesMirror || !result.layerMatchesBalance);
  const layerValue = results.reduce((sum, result) => sum.add(result.assetValue), new Prisma.Decimal(0));
  const inTransitValue = openTransfers.reduce((sum, transfer) => sum.add(transfer.totalValue.sub(transfer.receivedValue)), new Prisma.Decimal(0));
  const totalInventoryValue = layerValue.add(inTransitValue);
  await logAudit({ userId: actorUserId, branchId, action: 'VERIFY', resource: 'Inventory', resourceId: branchId, afterData: { checked: results.length, mismatches: mismatches.length } });
  return { checked: results.length, mismatchCount: mismatches.length, layerValue, inTransitValue, totalInventoryValue, mismatches, results };
}
