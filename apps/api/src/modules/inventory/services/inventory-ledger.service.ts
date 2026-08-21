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
import { findPostingPeriod } from '@modules/accounting/accounting.service';
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
type InboundInventoryInput = ReceiveInventoryInput | (OpeningInventoryInput & {
  sourceType: string;
  reasonCode: string;
});
type AdjustmentInboundInventoryInput = Omit<ReceiveInventoryInput, 'unitCost'> & {
  unitCost?: string;
};

const MAX_TRANSACTION_ATTEMPTS = 3;

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function postingNumber(prefix: 'OPN' | 'RCV' | 'ISS' | 'REV' | 'ADJ'): string {
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

async function assertLocationNotUnderOpname(tx: Tx, stockLocationId: string, bypassOpnameId?: string) {
  const active = await tx.stockOpname.findFirst({
    where: {
      stockLocationId,
      status: { in: ['COUNTING', 'PENDING_APPROVAL', 'APPROVED'] },
      ...(bypassOpnameId ? { id: { not: bypassOpnameId } } : {}),
    },
    select: { opnameNumber: true },
  });
  if (active) {
    throw errors.conflict('STOCK_LOCATION_OPNAME_LOCKED', `Stock location dikunci oleh opname ${active.opnameNumber}.`);
  }
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

async function resolveInboundInventoryItem(
  tx: Tx,
  input: InboundInventoryInput,
  type: InventoryPostingType,
): Promise<LockedInventoryItem> {
  if (input.inventoryItemId) {
    const [item] = await lockInventoryItems(tx, [input.inventoryItemId]);
    if (!item || item.branchId !== input.branchId) {
      throw errors.notFound('Inventory item tidak ditemukan dalam branch.');
    }
    return item;
  }

  const masterProductId = 'masterProductId' in input ? input.masterProductId : undefined;
  if (type !== InventoryPostingType.OPENING || !masterProductId) {
    throw errors.badRequest('INVENTORY_ITEM_REQUIRED', 'Inventory item wajib dipilih.');
  }

  const product = await tx.masterProduct.findUnique({
    where: { id: masterProductId },
    select: { id: true, isActive: true },
  });
  if (!product?.isActive) {
    throw errors.badRequest('INVALID_PRODUCT', 'Product tidak aktif atau tidak ditemukan.');
  }

  const warehouse = await tx.warehouse.findFirst({
    where: { branchId: input.branchId, isActive: true },
    include: {
      locations: {
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        take: 1,
      },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  const location = warehouse?.locations[0];
  if (!warehouse || !location) {
    throw errors.badRequest('WAREHOUSE_REQUIRED', 'Buat warehouse cabang terlebih dahulu sebelum opening stock.');
  }

  let inventoryItem = await tx.inventoryItem.findUnique({
    where: { masterProductId_branchId: { masterProductId, branchId: input.branchId } },
    select: { id: true, stockLocationId: true },
  });
  if (!inventoryItem) {
    inventoryItem = await tx.inventoryItem.create({
      data: {
        masterProductId,
        branchId: input.branchId,
        warehouseId: warehouse.id,
        stockLocationId: location.id,
      },
      select: { id: true, stockLocationId: true },
    });
  } else if (!inventoryItem.stockLocationId) {
    inventoryItem = await tx.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { warehouseId: warehouse.id, stockLocationId: location.id },
      select: { id: true, stockLocationId: true },
    });
  }

  const [lockedItem] = await lockInventoryItems(tx, [inventoryItem.id]);
  if (!lockedItem) throw errors.notFound('Inventory item gagal disiapkan untuk branch.');
  return lockedItem;
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
  allowUnvaluedQuantity = false,
): Promise<LockedLayer[]> {
  const batchFilter = batchId
    ? Prisma.sql`AND l."batchId" = ${batchId}`
    : Prisma.empty;
  const valuationFilter = allowUnvaluedQuantity
    ? Prisma.empty
    : Prisma.sql`AND l."unitCost" IS NOT NULL AND l."valuationStatus" = 'VALUED'`;
  return tx.$queryRaw<LockedLayer[]>(Prisma.sql`
    SELECT l."id", l."inventoryBalanceId", l."batchId", l."receivedAt", l."remainingQty",
           COALESCE(l."unitCost", 0) AS "unitCost"
    FROM "inventory_cost_layers" l
    JOIN "inventory_balances" b ON b."id" = l."inventoryBalanceId"
    LEFT JOIN "inventory_batches" batch ON batch."id" = l."batchId"
    WHERE b."inventoryItemId" = ${inventoryItemId}
      AND b."stockLocationId" = ${stockLocationId}
      AND l."remainingQty" > 0
      ${valuationFilter}
      AND l."isVoided" = false
      AND l."receivedAt" <= ${occurredAt}
      AND (batch."id" IS NULL OR (batch."isBlocked" = false AND (batch."expiryDate" IS NULL OR batch."expiryDate" > ${occurredAt})))
      ${batchFilter}
    ORDER BY l."receivedAt" ASC, l."id" ASC
    FOR UPDATE OF l
  `);
}

async function ensureQuantityTraceLayers(
  tx: Tx,
  balances: LockedBalance[],
  postingId: string,
  occurredAt: Date,
): Promise<void> {
  for (const balance of balances) {
    const physicalAvailable = balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty);
    if (physicalAvailable.lessThanOrEqualTo(0)) continue;
    const existing = await tx.inventoryCostLayer.aggregate({
      where: {
        inventoryBalanceId: balance.id,
        remainingQty: { gt: 0 },
        isVoided: false,
        receivedAt: { lte: occurredAt },
      },
      _sum: { remainingQty: true },
    });
    const tracedQuantity = existing._sum.remainingQty ?? new Prisma.Decimal(0);
    const missingTrace = physicalAvailable.sub(tracedQuantity);
    if (missingTrace.lessThanOrEqualTo(0)) continue;
    await tx.inventoryCostLayer.create({
      data: {
        inventoryBalanceId: balance.id,
        batchId: balance.batchId,
        sourceType: 'TREATMENT_QUANTITY_ONLY',
        sourceId: `${postingId}:${balance.id}`,
        originalQty: missingTrace,
        remainingQty: missingTrace,
        unitCost: null,
        valuationStatus: InventoryValuationStatus.PENDING_VALUATION,
        receivedAt: occurredAt,
      },
    });
  }
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

async function attachSourceCostLayers<T extends { branchId: string; sourceType: string; sourceId: string }>(postings: T[]) {
  if (postings.length === 0) return [];
  const sourcePairs = Array.from(new Map(postings.map((posting) => [
    JSON.stringify([posting.branchId, posting.sourceType, posting.sourceId]),
    {
      sourceType: posting.sourceType,
      sourceId: posting.sourceId,
      inventoryBalance: { branchId: posting.branchId },
    },
  ])).values());
  const layers = await prisma.inventoryCostLayer.findMany({
    where: { OR: sourcePairs },
    include: { batch: true, inventoryBalance: { select: { branchId: true } } },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
  });
  const bySource = new Map<string, typeof layers>();
  for (const layer of layers) {
    const scopedKey = JSON.stringify([layer.inventoryBalance.branchId, layer.sourceType, layer.sourceId]);
    bySource.set(scopedKey, [...(bySource.get(scopedKey) ?? []), layer]);
  }
  return postings.map((posting) => ({
    ...posting,
    costLayers: bySource.get(JSON.stringify([posting.branchId, posting.sourceType, posting.sourceId])) ?? [],
  }));
}

async function loadPostingResult(postingId: string) {
  const posting = await prisma.inventoryPosting.findUniqueOrThrow({
    where: { id: postingId },
    include: {
      stockMutations: { include: { inventoryItem: { include: { masterProduct: true } }, batch: true } },
      costAllocations: { include: { costLayer: true } },
    },
  });
  const [result] = await attachSourceCostLayers([posting]);
  return result;
}

async function postInboundInventory(
  actorUserId: string,
  input: InboundInventoryInput,
  type: InventoryPostingType,
) {
  await assertBranchAccess(actorUserId, input.branchId);
  await assertPermission(
    actorUserId,
    type === InventoryPostingType.OPENING ? PERMISSIONS.INVENTORY_OPENING_POST : PERMISSIONS.INVENTORY_POST,
    input.branchId,
  );
  const occurredAt = input.occurredAt ?? new Date();
  const payloadHash = hashPayload({
    type,
    ...input,
    occurredAt: input.occurredAt?.toISOString() ?? null,
  });

  const postingId = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    const existing = await findIdempotentPosting(tx, input.idempotencyKey, payloadHash);
    if (existing) return existing.id;
    if (type === InventoryPostingType.OPENING) {
      await findPostingPeriod(tx, input.branchId, occurredAt);
    }

    const item = await resolveInboundInventoryItem(tx, input, type);
    const product = await tx.masterProduct.findUnique({ where: { id: item.masterProductId } });
    if (!product?.isActive) throw errors.badRequest('INVALID_PRODUCT', 'Product tidak aktif atau tidak ditemukan.');
    const location = await assertLocationForItem(tx, item, input.stockLocationId);
    await assertLocationNotUnderOpname(tx, location.id);

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
        costCenterCode: input.costCenterCode, occurredAt, totalCost, postedBy: actorUserId,
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
        valuationStatus: InventoryValuationStatus.VALUED, receivedAt: occurredAt,
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
  input: ReceiveInventoryInput | AdjustmentInboundInventoryInput,
  tx: Tx,
  postingType: InventoryPostingType,
  stockOpnameBypassId?: string,
) {
  await assertBranchAccess(actorUserId, input.branchId);
  await assertPermission(
    actorUserId,
    postingType === InventoryPostingType.ADJUSTMENT_IN
      ? PERMISSIONS.INVENTORY_ADJUSTMENT_POST
      : PERMISSIONS.INVENTORY_POST,
    input.branchId,
  );
  const occurredAt = input.occurredAt ?? new Date();
  const payloadHash = hashPayload({
    ...input,
    postingType,
    occurredAt: input.occurredAt?.toISOString() ?? null,
  });
  const existing = await findIdempotentPosting(tx, input.idempotencyKey, payloadHash);
  if (existing) return existing;
  if (postingType === InventoryPostingType.OPENING) {
    await findPostingPeriod(tx, input.branchId, occurredAt);
  }

  const [item] = await lockInventoryItems(tx, [input.inventoryItemId]);
  if (!item || item.branchId !== input.branchId) throw errors.notFound('Inventory item penerimaan tidak ditemukan dalam branch.');
  const product = await tx.masterProduct.findUnique({ where: { id: item.masterProductId } });
  if (!product?.isActive) throw errors.badRequest('INVALID_PRODUCT', 'Product tidak aktif atau tidak ditemukan.');
  const location = await assertLocationForItem(tx, item, input.stockLocationId);
  await assertLocationNotUnderOpname(tx, location.id, stockOpnameBypassId);

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
  const unitCost = input.unitCost === undefined ? null : new Prisma.Decimal(input.unitCost);
  const totalCost = unitCost ? quantity.mul(unitCost) : new Prisma.Decimal(0);
  const posting = await tx.inventoryPosting.create({
    data: {
      postingNumber: postingNumber(postingType === InventoryPostingType.OPENING ? 'OPN' : postingType === InventoryPostingType.ADJUSTMENT_IN ? 'ADJ' : 'RCV'),
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      type: postingType,
      reasonCode: input.reasonCode,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceNumber: input.sourceNumber,
      branchId: input.branchId,
      costCenterCode: input.costCenterCode,
      occurredAt,
      totalCost,
      postedBy: actorUserId,
    },
  });
  await tx.inventoryBalance.update({ where: { id: balance.id }, data: { onHandQty: { increment: quantity }, version: { increment: 1 } } });
  await tx.inventoryItem.update({ where: { id: item.id }, data: { stock: { increment: quantity }, warehouseId: location.warehouseId, stockLocationId: location.id } });
  const mutation = await tx.stockMutation.create({
    data: {
      inventoryItemId: item.id,
      type: postingType === InventoryPostingType.ADJUSTMENT_IN ? StockMutationType.ADJUSTMENT : StockMutationType.RECEIVED,
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
      actualCost: unitCost ? totalCost : null,
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
      valuationStatus: unitCost
        ? InventoryValuationStatus.VALUED
        : InventoryValuationStatus.PENDING_VALUATION,
      receivedAt: occurredAt,
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

export function receiveAdjustmentInventoryInTransaction(
  actorUserId: string,
  input: AdjustmentInboundInventoryInput,
  tx: Tx,
  stockOpnameBypassId?: string,
) {
  return receiveInboundInventoryInTransaction(
    actorUserId,
    input,
    tx,
    InventoryPostingType.ADJUSTMENT_IN,
    stockOpnameBypassId,
  );
}

function ensureUniqueIssueLines(input: IssueInventoryInput) {
  const keys = input.lines.map((line) => `${line.inventoryItemId}:${line.stockLocationId ?? ''}:${line.batchId ?? ''}`);
  if (new Set(keys).size !== keys.length) throw errors.badRequest('DUPLICATE_ISSUE_LINE', 'Inventory item/location/batch tidak boleh duplikat dalam satu posting.');
}

export async function issueInventoryInTransaction(
  actorUserId: string,
  input: IssueInventoryInput,
  tx: Tx,
  options: {
    postingType?: InventoryPostingType;
    mutationType?: StockMutationType;
    stockOpnameBypassId?: string;
    allowUnvaluedQuantity?: boolean;
    preserveCompatibilityStock?: boolean;
  } = {},
): Promise<string> {
  ensureUniqueIssueLines(input);
  const normalizedLines = [...input.lines].sort((a, b) => `${a.inventoryItemId}:${a.batchId ?? ''}`.localeCompare(`${b.inventoryItemId}:${b.batchId ?? ''}`));
  const postingType = options.postingType || InventoryPostingType.ISSUE;
  const mutationType = options.mutationType || StockMutationType.USED;
  const basePayload = postingType === InventoryPostingType.ISSUE && mutationType === StockMutationType.USED
    ? { ...input, lines: normalizedLines }
    : { ...input, lines: normalizedLines, postingType, mutationType };
  const payloadHash = hashPayload({
    ...basePayload,
    ...(options.allowUnvaluedQuantity ? { valuationMode: 'QUANTITY_ONLY' } : {}),
    ...(options.preserveCompatibilityStock ? { compatibilityStockMode: 'PRESERVE' } : {}),
  });
  const existing = await findIdempotentPosting(tx, input.idempotencyKey, payloadHash);
  if (existing) return existing.id;

  const items = await lockInventoryItems(tx, normalizedLines.map((line) => line.inventoryItemId));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  if (items.length !== new Set(normalizedLines.map((line) => line.inventoryItemId)).size || items.some((item) => item.branchId !== input.branchId)) {
    throw errors.notFound('Satu atau lebih inventory item tidak ditemukan dalam branch.');
  }

  const posting = await tx.inventoryPosting.create({
    data: {
      postingNumber: postingNumber(postingType === InventoryPostingType.ADJUSTMENT_OUT ? 'ADJ' : 'ISS'), idempotencyKey: input.idempotencyKey, payloadHash,
      type: postingType, reasonCode: input.reasonCode, sourceType: input.sourceType,
      sourceId: input.sourceId, sourceNumber: input.sourceNumber, branchId: input.branchId,
      costCenterCode: input.costCenterCode, occurredAt: input.occurredAt, postedBy: actorUserId,
    },
  });

  let postingCost = new Prisma.Decimal(0);
  for (const line of normalizedLines) {
    const item = itemMap.get(line.inventoryItemId)!;
    const location = await assertLocationForItem(tx, item, line.stockLocationId);
    await assertLocationNotUnderOpname(tx, location.id, options.stockOpnameBypassId);
    const quantity = new Prisma.Decimal(line.quantity);
    const balances = await lockBalances(tx, item.id, location.id, line.batchId);
    const available = balances.reduce(
      (sum, balance) => sum.add(balance.onHandQty.sub(balance.reservedQty).sub(balance.quarantineQty)),
      new Prisma.Decimal(0),
    );
    if (available.lessThan(quantity)) {
      throw errors.unprocessable('INSUFFICIENT_AVAILABLE_STOCK', `Stok tersedia hanya ${available.toFixed(4)} unit.`);
    }

    if (options.allowUnvaluedQuantity) {
      await ensureQuantityTraceLayers(tx, balances, posting.id, input.occurredAt);
    }
    const layers = await lockValidLayers(
      tx,
      item.id,
      location.id,
      input.occurredAt,
      line.batchId,
      options.allowUnvaluedQuantity,
    );
    const allocations = allocateFifo(quantity, capLayersToAvailableBalances(layers, balances));
    const lineCost = sumAllocationCost(allocations);
    postingCost = postingCost.add(lineCost);

    if (!options.preserveCompatibilityStock) {
      const mirrorUpdate = await tx.inventoryItem.updateMany({
        where: { id: item.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (mirrorUpdate.count !== 1) throw errors.unprocessable('INSUFFICIENT_AVAILABLE_STOCK', 'Compatibility stock tidak mencukupi.');
    }

    const stockBefore = item.stock;
    const stockAfter = options.preserveCompatibilityStock ? stockBefore : stockBefore.sub(quantity);
    const mutation = await tx.stockMutation.create({
      data: {
        inventoryItemId: item.id, type: mutationType, quantity,
        stockBefore, stockAfter, referenceType: input.sourceType,
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
    item.stock = stockAfter;
  }

  await tx.inventoryPosting.update({ where: { id: posting.id }, data: { totalCost: postingCost } });
  return posting.id;
}

export function issueAdjustmentInventoryInTransaction(
  actorUserId: string,
  input: IssueInventoryInput,
  tx: Tx,
  stockOpnameBypassId?: string,
  allowUnvaluedQuantity = false,
) {
  return issueInventoryInTransaction(actorUserId, input, tx, {
    postingType: InventoryPostingType.ADJUSTMENT_OUT,
    mutationType: StockMutationType.ADJUSTMENT,
    stockOpnameBypassId,
    allowUnvaluedQuantity,
  });
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
  const preserveCompatibilityStock = original.sourceType === 'TREATMENT_TEAM_INVENTORY';

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
    if (!preserveCompatibilityStock) {
      await tx.inventoryItem.update({ where: { id: item.id }, data: { stock: { increment: mutation.quantity } } });
    }
    const reversalMutation = await tx.stockMutation.create({
      data: {
        inventoryItemId: item.id,
        type: StockMutationType.ADJUSTMENT,
        quantity: mutation.quantity,
        stockBefore: item.stock,
        stockAfter: preserveCompatibilityStock ? item.stock : item.stock.add(mutation.quantity),
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
  const [rows, total, totals] = await Promise.all([
    prisma.inventoryBalance.findMany({
      where,
      include: { masterProduct: true, branch: true, stockLocation: { include: { warehouse: true } }, batch: true },
      orderBy: [{ branchId: 'asc' }, { masterProductId: 'asc' }, { batchKey: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inventoryBalance.count({ where }),
    prisma.inventoryBalance.aggregate({
      where,
      _sum: {
        onHandQty: true,
        reservedQty: true,
        quarantineQty: true,
        inTransitQty: true,
      },
    }),
  ]);
  const onHandQty = totals._sum.onHandQty ?? new Prisma.Decimal(0);
  const reservedQty = totals._sum.reservedQty ?? new Prisma.Decimal(0);
  const quarantineQty = totals._sum.quarantineQty ?? new Prisma.Decimal(0);
  const inTransitQty = totals._sum.inTransitQty ?? new Prisma.Decimal(0);
  return {
    data: rows.map((row) => ({
      ...row,
      availableQty: row.onHandQty.sub(row.reservedQty).sub(row.quarantineQty),
    })),
    summary: {
      onHandQty,
      availableQty: onHandQty.sub(reservedQty).sub(quarantineQty),
      reservedQty,
      quarantineQty,
      inTransitQty,
    },
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
  const postings = await prisma.inventoryPosting.findMany({
    where,
    include: { stockMutations: { include: { inventoryItem: { include: { masterProduct: true } }, batch: true } }, costAllocations: true },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });
  return attachSourceCostLayers(postings);
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
  const valuedLayerQty = results.reduce((sum, result) => sum.add(result.valuedLayerQty), new Prisma.Decimal(0));
  const pendingValuationQty = results.reduce((sum, result) => sum.add(result.pendingValuationQty), new Prisma.Decimal(0));
  const layerValue = results.reduce((sum, result) => sum.add(result.assetValue), new Prisma.Decimal(0));
  const inTransitValue = openTransfers.reduce((sum, transfer) => sum.add(transfer.totalValue.sub(transfer.receivedValue)), new Prisma.Decimal(0));
  const totalInventoryValue = layerValue.add(inTransitValue);
  await logAudit({ userId: actorUserId, branchId, action: 'VERIFY', resource: 'Inventory', resourceId: branchId, afterData: { checked: results.length, mismatches: mismatches.length } });
  return {
    checked: results.length,
    mismatchCount: mismatches.length,
    quantityMismatchCount: mismatches.length,
    valuedLayerQty,
    pendingValuationQty,
    pendingValuationItemCount: results.filter((result) => result.pendingValuationQty.greaterThan(0)).length,
    valuationComplete: pendingValuationQty.equals(0) && mismatches.length === 0,
    valuationStatus: pendingValuationQty.greaterThan(0)
      ? 'PENDING_VALUATION'
      : mismatches.length > 0 ? 'QUANTITY_MISMATCH' : 'VALUED',
    layerValue,
    inTransitValue,
    totalInventoryValue,
    mismatches,
    results,
  };
}
