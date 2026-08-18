import { Prisma } from '@prisma/client';
import { errors } from '@middleware/errorHandler';
import { resolveBranchInventoryScope } from './inventory-scope.service';

type Tx = Prisma.TransactionClient;

interface ReconcileCompatibilityStockInput {
  inventoryItemId: string;
  targetStock?: Prisma.Decimal.Value;
  actorUserId: string;
  sourceType: string;
  sourceId: string;
  rejectDecrease?: boolean;
}

interface PostCompatibilityStockReceiptInput {
  inventoryItemId: string;
  quantity: Prisma.Decimal.Value;
  actorUserId: string;
  sourceType: string;
  sourceId: string;
}

/**
 * Bridges legacy/direct-edit stock into the authoritative location ledger.
 * The compatibility `inventory_items.stock` column can contain valid quantity
 * that predates `inventory_balances`. We materialize only the untracked delta
 * as a pending-valuation layer, without inventing a financial cost.
 */
export async function reconcileCompatibilityStockInTransaction(
  tx: Tx,
  input: ReconcileCompatibilityStockInput,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "inventory_items" WHERE "id" = ${input.inventoryItemId} FOR UPDATE
  `);
  const item = await tx.inventoryItem.findUnique({
    where: { id: input.inventoryItemId },
    select: {
      id: true,
      branchId: true,
      masterProductId: true,
      stock: true,
      warehouseId: true,
      stockLocationId: true,
      balances: { select: { onHandQty: true } },
    },
  });
  if (!item) throw errors.notFound('Item inventory tidak ditemukan.');

  const targetStock = new Prisma.Decimal(input.targetStock ?? item.stock);
  const ledgerOnHand = item.balances.reduce(
    (sum, balance) => sum.add(balance.onHandQty),
    new Prisma.Decimal(0),
  );
  if (input.rejectDecrease && targetStock.lessThan(ledgerOnHand)) {
    throw errors.unprocessable(
      'DIRECT_STOCK_DECREASE_USE_ADJUSTMENT',
      'Pengurangan stok harus melalui Inventory Adjustment agar saldo lokasi, FIFO, dan jurnal tetap konsisten.',
    );
  }

  const missingQuantity = targetStock.sub(ledgerOnHand);
  if (missingQuantity.lessThanOrEqualTo(0)) {
    return { reconciledQuantity: new Prisma.Decimal(0), ledgerOnHand, targetStock };
  }

  let stockLocationId = item.stockLocationId;
  let warehouseId = item.warehouseId;
  if (!stockLocationId || !warehouseId) {
    const scope = await resolveBranchInventoryScope(tx, item.branchId, input.actorUserId);
    stockLocationId = scope.location.id;
    warehouseId = scope.warehouse.id;
  }

  const balance = await tx.inventoryBalance.upsert({
    where: {
      inventoryItemId_stockLocationId_batchKey: {
        inventoryItemId: item.id,
        stockLocationId,
        batchKey: 'NO_BATCH',
      },
    },
    create: {
      inventoryItemId: item.id,
      stockLocationId,
      masterProductId: item.masterProductId,
      branchId: item.branchId,
      batchKey: 'NO_BATCH',
    },
    update: {},
  });
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "inventory_balances" WHERE "id" = ${balance.id} FOR UPDATE
  `);
  await tx.inventoryBalance.update({
    where: { id: balance.id },
    data: { onHandQty: { increment: missingQuantity }, version: { increment: 1 } },
  });
  await tx.inventoryCostLayer.create({
    data: {
      inventoryBalanceId: balance.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      originalQty: missingQuantity,
      remainingQty: missingQuantity,
      unitCost: null,
      valuationStatus: 'PENDING_VALUATION',
      receivedAt: new Date(),
    },
  });
  if (item.stockLocationId !== stockLocationId || item.warehouseId !== warehouseId) {
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { stockLocationId, warehouseId },
    });
  }

  return { reconciledQuantity: missingQuantity, ledgerOnHand, targetStock };
}

/**
 * Posts a receipt originating from a legacy shipment that has no valued FIFO
 * transfer layer. The greater of mirror stock and ledger stock becomes the
 * baseline so neither representation can silently lose historical quantity.
 * The newly received quantity is always added, even when the two old totals
 * were already inconsistent.
 */
export async function postCompatibilityStockReceiptInTransaction(
  tx: Tx,
  input: PostCompatibilityStockReceiptInput,
) {
  const receivedQuantity = new Prisma.Decimal(input.quantity);
  if (receivedQuantity.isNegative()) {
    throw errors.badRequest('INVALID_RECEIPT_QUANTITY', 'Jumlah barang diterima tidak boleh negatif.');
  }

  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "inventory_items" WHERE "id" = ${input.inventoryItemId} FOR UPDATE
  `);
  const item = await tx.inventoryItem.findUnique({
    where: { id: input.inventoryItemId },
    select: {
      id: true,
      branchId: true,
      masterProductId: true,
      stock: true,
      warehouseId: true,
      stockLocationId: true,
      balances: { select: { onHandQty: true } },
    },
  });
  if (!item) throw errors.notFound('Item inventory tidak ditemukan.');

  const mirrorStock = new Prisma.Decimal(item.stock);
  const ledgerOnHand = item.balances.reduce(
    (sum, balance) => sum.add(balance.onHandQty),
    new Prisma.Decimal(0),
  );
  const stockBefore = Prisma.Decimal.max(mirrorStock, ledgerOnHand);
  const stockAfter = stockBefore.add(receivedQuantity);
  const ledgerIncrement = stockAfter.sub(ledgerOnHand);

  let stockLocationId = item.stockLocationId;
  let warehouseId = item.warehouseId;
  if (!stockLocationId || !warehouseId) {
    const scope = await resolveBranchInventoryScope(tx, item.branchId, input.actorUserId);
    stockLocationId = scope.location.id;
    warehouseId = scope.warehouse.id;
  }

  if (ledgerIncrement.greaterThan(0)) {
    const balance = await tx.inventoryBalance.upsert({
      where: {
        inventoryItemId_stockLocationId_batchKey: {
          inventoryItemId: item.id,
          stockLocationId,
          batchKey: 'NO_BATCH',
        },
      },
      create: {
        inventoryItemId: item.id,
        stockLocationId,
        masterProductId: item.masterProductId,
        branchId: item.branchId,
        batchKey: 'NO_BATCH',
      },
      update: {},
    });
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "inventory_balances" WHERE "id" = ${balance.id} FOR UPDATE
    `);
    await tx.inventoryBalance.update({
      where: { id: balance.id },
      data: { onHandQty: { increment: ledgerIncrement }, version: { increment: 1 } },
    });
    await tx.inventoryCostLayer.create({
      data: {
        inventoryBalanceId: balance.id,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        originalQty: ledgerIncrement,
        remainingQty: ledgerIncrement,
        unitCost: null,
        valuationStatus: 'PENDING_VALUATION',
        receivedAt: new Date(),
      },
    });
  }

  await tx.inventoryItem.update({
    where: { id: item.id },
    data: { stock: stockAfter, stockLocationId, warehouseId },
  });

  return { receivedQuantity, ledgerIncrement, ledgerOnHand, mirrorStock, stockBefore, stockAfter };
}
