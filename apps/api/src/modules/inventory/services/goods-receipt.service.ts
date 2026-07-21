import { createHash, randomUUID } from 'crypto';
import {
  GoodsReceiptCondition,
  InventoryPostingStatus,
  InventoryPostingType,
  InventoryValuationStatus,
  Prisma,
  PurchaseOrderStatus,
  StockMutationType,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { errors } from '@middleware/errorHandler';
import {
  assertBranchAccess,
  assertPermission,
  getAccessibleBranchIds,
} from '@modules/iam/authorization.service';
import { PERMISSIONS } from '@modules/iam/permission-catalog';
import type {
  GoodsReceiptListQuery,
  PostGoodsReceiptInput,
  PurchaseOrderListQuery,
} from '../goods-receipt.schema';

type Tx = Prisma.TransactionClient;

type LockedInventoryItem = {
  id: string;
  masterProductId: string;
  branchId: string;
  stock: Prisma.Decimal;
};

const MAX_TRANSACTION_ATTEMPTS = 3;

function hashPayload(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function receiptNumber(branchCode: string) {
  return `GR-${branchCode}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function postingNumber() {
  return `INV-GR-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function isRetryableTransactionError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' || code === 'P2034' || /40001|40P01|serialization|deadlock/i.test(message);
}

async function withTransactionRetry<T>(operation: () => Promise<T>) {
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

function normalizedPayload(purchaseOrderId: string, input: PostGoodsReceiptInput) {
  return {
    purchaseOrderId,
    receivedAt: input.receivedAt.toISOString(),
    supplierDeliveryNumber: input.supplierDeliveryNumber ?? null,
    notes: input.notes ?? null,
    lines: [...input.lines]
      .map((line) => ({
        purchaseOrderItemId: line.purchaseOrderItemId,
        quantity: line.quantity,
        stockLocationId: line.stockLocationId,
        condition: line.condition,
        batch: line.batch ? {
          batchNumber: line.batch.batchNumber,
          manufactureDate: line.batch.manufactureDate?.toISOString() ?? null,
          expiryDate: line.batch.expiryDate?.toISOString() ?? null,
        } : null,
        notes: line.notes ?? null,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

function datesEqual(left: Date | null, right?: Date) {
  return !left || !right || left.getTime() === right.getTime();
}

async function loadGoodsReceipt(id: string) {
  return prisma.goodsReceipt.findUniqueOrThrow({
    where: { id },
    include: {
      purchaseOrder: { include: { supplier: true } },
      branch: { select: { id: true, branchCode: true, name: true } },
      inventoryPosting: { select: { id: true, postingNumber: true, totalCost: true } },
      items: {
        include: {
          purchaseOrderItem: { include: { masterProduct: true, uom: true } },
          stockLocation: { include: { warehouse: true } },
          batch: true,
          costLayer: true,
          stockMutation: true,
        },
        orderBy: [{ purchaseOrderItem: { lineNumber: 'asc' } }, { id: 'asc' }],
      },
    },
  });
}

export async function listReceivablePurchaseOrders(actorUserId: string, query: PurchaseOrderListQuery) {
  await assertPermission(actorUserId, PERMISSIONS.PURCHASING_PO_READ, query.branchId);
  const accessibleBranchIds = await getAccessibleBranchIds(actorUserId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.branchId
      ? { branchId: query.branchId }
      : accessibleBranchIds === null ? {} : { branchId: { in: accessibleBranchIds } }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? {
      OR: [
        { poNumber: { contains: query.search, mode: 'insensitive' } },
        { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
      ],
    } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        branch: { select: { id: true, branchCode: true, name: true } },
        items: {
          include: {
            masterProduct: true,
            uom: true,
            destinationStockLocation: { include: { warehouse: true } },
          },
          orderBy: { lineNumber: 'asc' },
        },
        _count: { select: { receipts: true } },
      },
      orderBy: [{ orderDate: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({
      ...row,
      items: row.items.map((item) => ({
        ...item,
        remainingQty: item.orderedQty.sub(item.receivedQty),
      })),
    })),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function listGoodsReceipts(actorUserId: string, query: GoodsReceiptListQuery) {
  await assertPermission(actorUserId, PERMISSIONS.PURCHASING_GOODS_RECEIPT_READ, query.branchId);
  const accessibleBranchIds = await getAccessibleBranchIds(actorUserId);
  if (query.branchId) await assertBranchAccess(actorUserId, query.branchId);
  const where: Prisma.GoodsReceiptWhereInput = {
    ...(query.branchId
      ? { branchId: query.branchId }
      : accessibleBranchIds === null ? {} : { branchId: { in: accessibleBranchIds } }),
    ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      include: {
        purchaseOrder: { include: { supplier: true } },
        branch: { select: { id: true, branchCode: true, name: true } },
        inventoryPosting: { select: { postingNumber: true } },
        items: { include: { purchaseOrderItem: { include: { masterProduct: true } }, batch: true } },
      },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.goodsReceipt.count({ where }),
  ]);
  return {
    data: rows,
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getGoodsReceipt(actorUserId: string, id: string) {
  const scope = await prisma.goodsReceipt.findUnique({ where: { id }, select: { branchId: true } });
  if (!scope) throw errors.notFound('Goods Receipt tidak ditemukan.');
  await assertBranchAccess(actorUserId, scope.branchId);
  await assertPermission(actorUserId, PERMISSIONS.PURCHASING_GOODS_RECEIPT_READ, scope.branchId);
  return loadGoodsReceipt(id);
}

export async function postGoodsReceipt(
  actorUserId: string,
  purchaseOrderId: string,
  input: PostGoodsReceiptInput,
) {
  const scope = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { branchId: true },
  });
  if (!scope) throw errors.notFound('Purchase Order tidak ditemukan.');
  await assertBranchAccess(actorUserId, scope.branchId);
  await assertPermission(actorUserId, PERMISSIONS.PURCHASING_GOODS_RECEIPT_POST, scope.branchId);

  const payloadHash = hashPayload(normalizedPayload(purchaseOrderId, input));
  const result = await withTransactionRetry(() => prisma.$transaction(async (tx) => {
    const replay = await tx.goodsReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      if (replay.purchaseOrderId !== purchaseOrderId || replay.payloadHash !== payloadHash) {
        throw errors.conflict('IDEMPOTENCY_CONFLICT', 'Idempotency key Goods Receipt digunakan dengan payload berbeda.');
      }
      return { receiptId: replay.id, created: false };
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "purchase_orders" WHERE "id" = ${purchaseOrderId} FOR UPDATE`);
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: true,
        branch: true,
        items: { include: { masterProduct: true }, orderBy: { lineNumber: 'asc' } },
      },
    });
    if (!purchaseOrder) throw errors.notFound('Purchase Order tidak ditemukan.');
    if (
      purchaseOrder.status !== PurchaseOrderStatus.APPROVED
      && purchaseOrder.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw errors.conflict('PURCHASE_ORDER_NOT_RECEIVABLE', `PO berstatus ${purchaseOrder.status} dan tidak dapat diterima.`);
    }
    if (!purchaseOrder.supplier.isActive) {
      throw errors.unprocessable('SUPPLIER_INACTIVE', 'Supplier PO sudah tidak aktif.');
    }
    if (input.receivedAt < purchaseOrder.orderDate) {
      throw errors.badRequest('RECEIPT_DATE_INVALID', 'Tanggal Goods Receipt tidak boleh sebelum tanggal PO.');
    }

    const requestedItemIds = [...new Set(input.lines.map((line) => line.purchaseOrderItemId))].sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "purchase_order_items"
      WHERE "id" IN (${Prisma.join(requestedItemIds)})
      ORDER BY "id" FOR UPDATE
    `);
    const orderItemById = new Map(purchaseOrder.items.map((item) => [item.id, item]));
    if (requestedItemIds.some((id) => !orderItemById.has(id))) {
      throw errors.badRequest('PURCHASE_ORDER_ITEM_INVALID', 'Satu atau lebih item bukan milik Purchase Order ini.');
    }

    const quantityByOrderItem = new Map<string, Prisma.Decimal>();
    for (const line of input.lines) {
      quantityByOrderItem.set(
        line.purchaseOrderItemId,
        (quantityByOrderItem.get(line.purchaseOrderItemId) ?? new Prisma.Decimal(0)).add(line.quantity),
      );
    }
    for (const [itemId, quantity] of quantityByOrderItem) {
      const item = orderItemById.get(itemId)!;
      const remaining = item.orderedQty.sub(item.receivedQty);
      if (quantity.greaterThan(remaining)) {
        throw errors.unprocessable(
          'GOODS_RECEIPT_EXCEEDS_PO',
          `Penerimaan ${item.masterProduct.name} melebihi sisa PO ${remaining.toFixed(4)}.`,
        );
      }
      if (!item.masterProduct.isActive) {
        throw errors.unprocessable('PRODUCT_INACTIVE', `Product ${item.masterProduct.name} sudah tidak aktif.`);
      }
    }

    const locationIds = [...new Set(input.lines.map((line) => line.stockLocationId))].sort();
    const locations = await tx.stockLocation.findMany({
      where: { id: { in: locationIds } },
      include: { warehouse: true },
    });
    const locationById = new Map(locations.map((location) => [location.id, location]));
    if (locations.length !== locationIds.length || locations.some(
      (location) => !location.isActive || !location.warehouse.isActive || location.warehouse.branchId !== purchaseOrder.branchId,
    )) {
      throw errors.badRequest('STOCK_LOCATION_INVALID', 'Stock location tidak aktif atau tidak berada pada branch PO.');
    }

    const batchByLineKey = new Map<string, { id: string; batchNumber: string }>();
    for (const line of input.lines) {
      const item = orderItemById.get(line.purchaseOrderItemId)!;
      const product = item.masterProduct;
      if (!product.tracksBatch && line.batch) {
        throw errors.badRequest('BATCH_NOT_ENABLED', `${product.name} tidak menggunakan batch tracking.`);
      }
      if (product.tracksBatch && !line.batch) {
        throw errors.badRequest('BATCH_REQUIRED', `Batch wajib untuk ${product.name}.`);
      }
      if (!line.batch) continue;
      if (product.tracksExpiry && !line.batch.expiryDate) {
        throw errors.badRequest('EXPIRY_REQUIRED', `Expiry wajib untuk ${product.name}.`);
      }
      if (line.batch.manufactureDate && line.batch.expiryDate && line.batch.expiryDate <= line.batch.manufactureDate) {
        throw errors.badRequest('BATCH_DATE_INVALID', 'Expiry harus setelah manufacture date.');
      }
      const expiredAtReceipt = Boolean(line.batch.expiryDate && line.batch.expiryDate <= input.receivedAt);
      if (line.condition === GoodsReceiptCondition.GOOD && expiredAtReceipt) {
        throw errors.unprocessable('EXPIRED_STOCK_MUST_QUARANTINE', 'Batch expired tidak dapat diterima dengan kondisi GOOD.');
      }
      if (line.condition === GoodsReceiptCondition.EXPIRED && !expiredAtReceipt) {
        throw errors.badRequest('EXPIRY_CONDITION_INVALID', 'Kondisi EXPIRED memerlukan expiry date yang sudah lewat.');
      }
      const existingBatch = await tx.inventoryBatch.findUnique({
        where: { masterProductId_batchNumber: { masterProductId: product.id, batchNumber: line.batch.batchNumber } },
      });
      if (existingBatch && (
        !datesEqual(existingBatch.manufactureDate, line.batch.manufactureDate)
        || !datesEqual(existingBatch.expiryDate, line.batch.expiryDate)
      )) {
        throw errors.conflict('BATCH_METADATA_CONFLICT', `Tanggal batch ${line.batch.batchNumber} berbeda dari master batch.`);
      }
      const batch = existingBatch
        ? await tx.inventoryBatch.update({
          where: { id: existingBatch.id },
          data: {
            manufactureDate: existingBatch.manufactureDate ?? line.batch.manufactureDate,
            expiryDate: existingBatch.expiryDate ?? line.batch.expiryDate,
          },
        })
        : await tx.inventoryBatch.create({
          data: {
            masterProductId: product.id,
            batchNumber: line.batch.batchNumber,
            manufactureDate: line.batch.manufactureDate,
            expiryDate: line.batch.expiryDate,
          },
        });
      if (batch.isBlocked) throw errors.unprocessable('BATCH_BLOCKED', `Batch ${batch.batchNumber} sedang diblokir.`);
      batchByLineKey.set(`${line.purchaseOrderItemId}:${line.batch.batchNumber}`, batch);
    }

    const firstLocationByProduct = new Map<string, typeof locations[number]>();
    for (const line of input.lines) {
      const productId = orderItemById.get(line.purchaseOrderItemId)!.masterProductId;
      if (!firstLocationByProduct.has(productId)) firstLocationByProduct.set(productId, locationById.get(line.stockLocationId)!);
    }
    const inventoryItems: Array<{ id: string; masterProductId: string }> = [];
    for (const [masterProductId, location] of [...firstLocationByProduct.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      inventoryItems.push(await tx.inventoryItem.upsert({
        where: { masterProductId_branchId: { masterProductId, branchId: purchaseOrder.branchId } },
        create: {
          masterProductId,
          branchId: purchaseOrder.branchId,
          stock: 0,
          minThreshold: 0,
          warehouseId: location.warehouseId,
          stockLocationId: location.id,
        },
        update: {},
      }));
    }
    const inventoryItemIds = inventoryItems.map((item) => item.id).sort();
    const lockedItems = await tx.$queryRaw<LockedInventoryItem[]>(Prisma.sql`
      SELECT "id", "masterProductId", "branchId", "stock"
      FROM "inventory_items"
      WHERE "id" IN (${Prisma.join(inventoryItemIds)})
      ORDER BY "id" FOR UPDATE
    `);
    const inventoryItemByProduct = new Map(lockedItems.map((item) => [item.masterProductId, item]));

    const receiptId = randomUUID();
    const totalQuantity = input.lines.reduce((sum, line) => sum.add(line.quantity), new Prisma.Decimal(0));
    const quarantinedQuantity = input.lines.reduce(
      (sum, line) => line.condition === GoodsReceiptCondition.GOOD ? sum : sum.add(line.quantity),
      new Prisma.Decimal(0),
    );
    const totalCost = input.lines.reduce((sum, line) => {
      const orderItem = orderItemById.get(line.purchaseOrderItemId)!;
      return sum.add(new Prisma.Decimal(line.quantity).mul(orderItem.unitCost));
    }, new Prisma.Decimal(0));
    const posting = await tx.inventoryPosting.create({
      data: {
        postingNumber: postingNumber(),
        idempotencyKey: `GOODS_RECEIPT:${input.idempotencyKey}`,
        payloadHash,
        type: InventoryPostingType.RECEIPT,
        status: InventoryPostingStatus.POSTED,
        reasonCode: 'PURCHASE_GOODS_RECEIPT',
        sourceType: 'GOODS_RECEIPT',
        sourceId: receiptId,
        sourceNumber: purchaseOrder.poNumber,
        branchId: purchaseOrder.branchId,
        occurredAt: input.receivedAt,
        totalCost,
        postedBy: actorUserId,
      },
    });
    const receipt = await tx.goodsReceipt.create({
      data: {
        id: receiptId,
        receiptNumber: receiptNumber(purchaseOrder.branch.branchCode),
        purchaseOrderId,
        branchId: purchaseOrder.branchId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        inventoryPostingId: posting.id,
        supplierDeliveryNumber: input.supplierDeliveryNumber,
        totalQuantity,
        quarantinedQuantity,
        totalCost,
        notes: input.notes,
        receivedBy: actorUserId,
        receivedAt: input.receivedAt,
      },
    });

    const currentStockByItem = new Map(lockedItems.map((item) => [item.id, item.stock]));
    for (const line of [...input.lines].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
      const orderItem = orderItemById.get(line.purchaseOrderItemId)!;
      const inventoryItem = inventoryItemByProduct.get(orderItem.masterProductId)!;
      const location = locationById.get(line.stockLocationId)!;
      const batch = line.batch ? batchByLineKey.get(`${line.purchaseOrderItemId}:${line.batch.batchNumber}`)! : null;
      const batchKey = batch?.id ?? 'NO_BATCH';
      const quantity = new Prisma.Decimal(line.quantity);
      const quarantineQty = line.condition === GoodsReceiptCondition.GOOD ? new Prisma.Decimal(0) : quantity;
      const lineCost = quantity.mul(orderItem.unitCost);
      const balance = await tx.inventoryBalance.upsert({
        where: {
          inventoryItemId_stockLocationId_batchKey: {
            inventoryItemId: inventoryItem.id,
            stockLocationId: location.id,
            batchKey,
          },
        },
        create: {
          inventoryItemId: inventoryItem.id,
          stockLocationId: location.id,
          masterProductId: orderItem.masterProductId,
          branchId: purchaseOrder.branchId,
          batchId: batch?.id,
          batchKey,
        },
        update: {},
      });
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "inventory_balances" WHERE "id" = ${balance.id} FOR UPDATE`);
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          onHandQty: { increment: quantity },
          quarantineQty: { increment: quarantineQty },
          version: { increment: 1 },
        },
      });
      const stockBefore = currentStockByItem.get(inventoryItem.id)!;
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: { increment: quantity } },
      });
      currentStockByItem.set(inventoryItem.id, stockBefore.add(quantity));
      const mutation = await tx.stockMutation.create({
        data: {
          inventoryItemId: inventoryItem.id,
          type: StockMutationType.RECEIVED,
          quantity,
          stockBefore,
          stockAfter: stockBefore.add(quantity),
          referenceType: 'GOODS_RECEIPT',
          referenceId: receipt.id,
          notes: `${receipt.receiptNumber} / ${line.condition}`,
          createdBy: actorUserId,
          inventoryPostingId: posting.id,
          inventoryBalanceId: balance.id,
          batchId: batch?.id,
          actualCost: lineCost,
        },
      });
      const costLayer = await tx.inventoryCostLayer.create({
        data: {
          inventoryBalanceId: balance.id,
          batchId: batch?.id,
          sourceType: 'GOODS_RECEIPT',
          sourceId: receipt.id,
          originalQty: quantity,
          remainingQty: quantity,
          unitCost: orderItem.unitCost,
          currency: purchaseOrder.currency,
          valuationStatus: InventoryValuationStatus.VALUED,
          receivedAt: input.receivedAt,
        },
      });
      await tx.goodsReceiptItem.create({
        data: {
          goodsReceiptId: receipt.id,
          purchaseOrderItemId: orderItem.id,
          inventoryItemId: inventoryItem.id,
          inventoryBalanceId: balance.id,
          stockLocationId: location.id,
          batchId: batch?.id,
          batchKey,
          stockMutationId: mutation.id,
          costLayerId: costLayer.id,
          condition: line.condition,
          quantity,
          quarantineQty,
          unitCost: orderItem.unitCost,
          totalCost: lineCost,
          notes: line.notes,
        },
      });
    }

    for (const [itemId, quantity] of quantityByOrderItem) {
      const updated = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        UPDATE "purchase_order_items"
        SET "receivedQty" = "receivedQty" + ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${itemId}
          AND "receivedQty" + ${quantity} <= "orderedQty"
        RETURNING "id"
      `);
      if (updated.length !== 1) {
        throw errors.conflict('PURCHASE_ORDER_QUANTITY_CHANGED', 'Quantity PO berubah saat Goods Receipt diposting.');
      }
    }
    const [remaining] = await tx.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "purchase_order_items"
      WHERE "purchaseOrderId" = ${purchaseOrderId} AND "receivedQty" < "orderedQty"
    `);
    const nextStatus = remaining.count === 0 ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED;
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: nextStatus } });
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        branchId: purchaseOrder.branchId,
        action: 'CREATE',
        module: 'PURCHASING',
        resource: 'GoodsReceipt',
        resourceId: receipt.id,
        entityType: 'GoodsReceipt',
        entityId: receipt.id,
        entityCode: receipt.receiptNumber,
        afterData: {
          purchaseOrderId,
          poNumber: purchaseOrder.poNumber,
          inventoryPostingId: posting.id,
          totalQuantity: totalQuantity.toFixed(4),
          quarantinedQuantity: quarantinedQuantity.toFixed(4),
          totalCost: totalCost.toFixed(4),
          purchaseOrderStatus: nextStatus,
        },
        description: `Goods Receipt ${receipt.receiptNumber} diposting untuk ${purchaseOrder.poNumber}.`,
      },
    });
    return { receiptId: receipt.id, created: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));

  return { receipt: await loadGoodsReceipt(result.receiptId), idempotentReplay: !result.created };
}
