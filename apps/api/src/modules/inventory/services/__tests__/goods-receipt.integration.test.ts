import { randomUUID } from 'crypto';
import {
  GoodsReceiptCondition,
  ProductCategory,
  PurchaseOrderStatus,
  Role,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { postGoodsReceipt } from '../goods-receipt.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('purchase Goods Receipt ledger', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `gr_user_${runId}`;
  const branchId = `gr_branch_${runId}`;
  const warehouseId = `gr_wh_${runId}`;
  const locationId = `gr_loc_${runId}`;
  const uomId = `gr_uom_${runId}`;
  const productId = `gr_product_${runId}`;
  const supplierId = `gr_supplier_${runId}`;
  const purchaseOrderId = `gr_po_${runId}`;
  const purchaseOrderItemId = `gr_poi_${runId}`;
  const batchNumber = `LOT-${runId}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: actorId,
        email: `goods-receipt-${runId}@example.test`,
        password: 'test-only',
        role: Role.SUPER_ADMIN,
      },
    });
    await prisma.branch.create({
      data: { id: branchId, branchCode: `GR${runId.slice(0, 6)}`, name: `Goods Receipt ${runId}` },
    });
    await prisma.warehouse.create({
      data: { id: warehouseId, branchId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
    });
    await prisma.stockLocation.create({
      data: { id: locationId, warehouseId, code: 'RECEIVING', name: 'Receiving', isDefault: true, createdBy: actorId },
    });
    await prisma.unitOfMeasure.create({
      data: { id: uomId, code: `GU${runId.slice(0, 7)}`, name: `Goods Unit ${runId}` },
    });
    await prisma.masterProduct.create({
      data: {
        id: productId,
        sku: `GR-${runId}`,
        name: `Goods Receipt Product ${runId}`,
        category: ProductCategory.CONSUMABLE,
        unit: 'unit',
        baseUnit: 'unit',
        usageUnit: 'unit',
        baseUomId: uomId,
        usageUomId: uomId,
        conversionFactor: '1',
        tracksBatch: true,
        tracksExpiry: true,
      },
    });
    await prisma.supplier.create({
      data: { id: supplierId, supplierCode: `SUP-${runId}`, name: `Supplier ${runId}`, createdBy: actorId },
    });
    await prisma.purchaseOrder.create({
      data: {
        id: purchaseOrderId,
        poNumber: `PO-${runId}`,
        supplierId,
        branchId,
        status: PurchaseOrderStatus.APPROVED,
        currency: 'IDR',
        orderDate: new Date('2026-07-01T00:00:00.000Z'),
        approvedBy: actorId,
        approvedAt: new Date('2026-07-01T01:00:00.000Z'),
        totalAmount: '1255',
        createdBy: actorId,
        items: {
          create: {
            id: purchaseOrderItemId,
            lineNumber: 1,
            masterProductId: productId,
            uomId,
            destinationStockLocationId: locationId,
            orderedQty: '10',
            unitCost: '125.5',
          },
        },
      },
    });
  }, 30_000);

  afterAll(async () => {
    const receiptIds = (await prisma.goodsReceipt.findMany({
      where: { purchaseOrderId },
      select: { id: true },
    })).map((row) => row.id);
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId }] } });
    await prisma.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: { in: receiptIds } } });
    await prisma.goodsReceipt.deleteMany({ where: { id: { in: receiptIds } } });
    await prisma.stockMutation.deleteMany({ where: { referenceId: { in: receiptIds } } });
    await prisma.inventoryCostLayer.deleteMany({ where: { sourceId: { in: receiptIds } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId } });
    await prisma.inventoryPosting.deleteMany({ where: { sourceId: { in: receiptIds } } });
    await prisma.inventoryItem.deleteMany({ where: { branchId } });
    await prisma.inventoryBatch.deleteMany({ where: { masterProductId: productId } });
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId } });
    await prisma.purchaseOrder.deleteMany({ where: { id: purchaseOrderId } });
    await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.stockLocation.deleteMany({ where: { id: locationId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 30_000);

  it('posts one idempotent partial receipt with batch, condition, quarantine, and purchase cost', async () => {
    const input = {
      idempotencyKey: `GR-PARTIAL-${runId}`,
      receivedAt: new Date('2026-07-15T08:00:00.000Z'),
      supplierDeliveryNumber: `DO-${runId}`,
      lines: [
        {
          purchaseOrderItemId,
          quantity: '3',
          stockLocationId: locationId,
          condition: GoodsReceiptCondition.GOOD,
          batch: { batchNumber, expiryDate: new Date('2027-07-15T00:00:00.000Z') },
        },
        {
          purchaseOrderItemId,
          quantity: '1',
          stockLocationId: locationId,
          condition: GoodsReceiptCondition.DAMAGED,
          batch: { batchNumber, expiryDate: new Date('2027-07-15T00:00:00.000Z') },
          notes: 'Kemasan rusak saat bongkar.',
        },
      ],
    };
    const results = await Promise.all([
      postGoodsReceipt(actorId, purchaseOrderId, input),
      postGoodsReceipt(actorId, purchaseOrderId, input),
    ]);

    expect(results[0].receipt.id).toBe(results[1].receipt.id);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(await prisma.goodsReceipt.count({ where: { purchaseOrderId } })).toBe(1);
    expect(await prisma.inventoryPosting.count({ where: { sourceType: 'GOODS_RECEIPT', sourceId: results[0].receipt.id } })).toBe(1);
    const order = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: { items: true } });
    expect(order.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
    expect(order.items[0].receivedQty.toFixed(4)).toBe('4.0000');
    const balance = await prisma.inventoryBalance.findFirstOrThrow({ where: { branchId, masterProductId: productId } });
    expect(balance.onHandQty.toFixed(4)).toBe('4.0000');
    expect(balance.quarantineQty.toFixed(4)).toBe('1.0000');
    const layers = await prisma.inventoryCostLayer.findMany({ where: { sourceId: results[0].receipt.id } });
    expect(layers).toHaveLength(2);
    expect(layers.every((layer) => layer.unitCost?.toFixed(4) === '125.5000')).toBe(true);
    expect(layers.reduce((sum, layer) => sum.add(layer.originalQty.mul(layer.unitCost || 0)), layers[0].originalQty.mul(0)).toFixed(4)).toBe('502.0000');
  }, 60_000);

  it('serializes competing final receipts and preserves PO quantity and inventory value', async () => {
    const input = (suffix: string) => ({
      idempotencyKey: `GR-FINAL-${runId}-${suffix}`,
      receivedAt: new Date('2026-07-16T08:00:00.000Z'),
      lines: [{
        purchaseOrderItemId,
        quantity: '6',
        stockLocationId: locationId,
        condition: GoodsReceiptCondition.GOOD,
        batch: { batchNumber, expiryDate: new Date('2027-07-15T00:00:00.000Z') },
      }],
    });
    const results = await Promise.allSettled([
      postGoodsReceipt(actorId, purchaseOrderId, input('A')),
      postGoodsReceipt(actorId, purchaseOrderId, input('B')),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const order = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId }, include: { items: true } });
    expect(order.status).toBe(PurchaseOrderStatus.RECEIVED);
    expect(order.items[0].receivedQty.toFixed(4)).toBe('10.0000');
    const [inventoryItem, balance, layers] = await Promise.all([
      prisma.inventoryItem.findUniqueOrThrow({ where: { masterProductId_branchId: { masterProductId: productId, branchId } } }),
      prisma.inventoryBalance.findFirstOrThrow({ where: { branchId, masterProductId: productId } }),
      prisma.inventoryCostLayer.findMany({ where: { sourceType: 'GOODS_RECEIPT', inventoryBalance: { branchId } } }),
    ]);
    expect(inventoryItem.stock.toFixed(4)).toBe('10.0000');
    expect(balance.onHandQty.toFixed(4)).toBe('10.0000');
    expect(balance.quarantineQty.toFixed(4)).toBe('1.0000');
    expect(layers.reduce((sum, layer) => sum.add(layer.remainingQty.mul(layer.unitCost || 0)), layers[0].remainingQty.mul(0)).toFixed(4)).toBe('1255.0000');
    expect(await prisma.goodsReceipt.count({ where: { purchaseOrderId } })).toBe(2);
  }, 60_000);
});
