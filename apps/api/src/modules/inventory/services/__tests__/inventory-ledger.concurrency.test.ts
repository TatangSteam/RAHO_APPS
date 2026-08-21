import { randomUUID } from 'crypto';
import { InventoryValuationStatus, ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import {
  issueInventory,
  issueInventoryInTransaction,
  listInventoryBalances,
  reconcileInventory,
  receiveInventory,
  reverseInventoryPosting,
  reverseInventoryPostingInTransaction,
} from '../inventory-ledger.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('inventory ledger PostgreSQL concurrency', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 16);
  const actorId = `fifo_user_${runId}`;
  const branchId = `fifo_branch_${runId}`;
  const warehouseId = `fifo_wh_${runId}`;
  const locationId = `fifo_loc_${runId}`;
  const uomId = `fifo_uom_${runId}`;
  const productId = `fifo_product_${runId}`;
  const inventoryItemId = `fifo_item_${runId}`;
  const quantityOnlyProductId = `qty_product_${runId}`;
  const quantityOnlyItemId = `qty_item_${runId}`;
  const quantityOnlyBalanceId = `qty_balance_${runId}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: actorId,
        email: `fifo-${runId}@example.test`,
        password: 'not-used-in-test',
        role: Role.SUPER_ADMIN,
      },
    });
    await prisma.branch.create({
      data: { id: branchId, branchCode: `F${runId.slice(0, 8)}`, name: `FIFO Test ${runId}` },
    });
    await prisma.unitOfMeasure.create({
      data: { id: uomId, code: `FU${runId.slice(0, 8)}`, name: `Unit ${runId}` },
    });
    await prisma.masterProduct.create({
      data: {
        id: productId,
        sku: `FIFO-${runId}`,
        name: `FIFO Product ${runId}`,
        category: ProductCategory.CONSUMABLE,
        unit: 'unit',
        baseUnit: 'unit',
        usageUnit: 'unit',
        baseUomId: uomId,
        usageUomId: uomId,
        conversionFactor: '1',
      },
    });
    await prisma.warehouse.create({
      data: { id: warehouseId, branchId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
    });
    await prisma.stockLocation.create({
      data: { id: locationId, warehouseId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
    });
    await prisma.inventoryItem.create({
      data: {
        id: inventoryItemId,
        masterProductId: productId,
        branchId,
        warehouseId,
        stockLocationId: locationId,
        stock: 0,
      },
    });
    await prisma.masterProduct.create({
      data: {
        id: quantityOnlyProductId,
        sku: `QTY-${runId}`,
        name: `Quantity-only Product ${runId}`,
        category: ProductCategory.CONSUMABLE,
        unit: 'unit',
        baseUnit: 'unit',
        usageUnit: 'unit',
        baseUomId: uomId,
        usageUomId: uomId,
        conversionFactor: '1',
      },
    });
    await prisma.inventoryItem.create({
      data: {
        id: quantityOnlyItemId,
        masterProductId: quantityOnlyProductId,
        branchId,
        warehouseId,
        stockLocationId: locationId,
        stock: 5,
      },
    });
    await prisma.inventoryBalance.create({
      data: {
        id: quantityOnlyBalanceId,
        inventoryItemId: quantityOnlyItemId,
        stockLocationId: locationId,
        masterProductId: quantityOnlyProductId,
        branchId,
        onHandQty: 5,
      },
    });
    await prisma.inventoryCostLayer.create({
      data: {
        inventoryBalanceId: quantityOnlyBalanceId,
        sourceType: 'LEGACY_MIGRATION',
        sourceId: quantityOnlyItemId,
        originalQty: 5,
        remainingQty: 5,
        unitCost: null,
        valuationStatus: InventoryValuationStatus.PENDING_VALUATION,
        receivedAt: new Date(Date.now() - 60_000),
      },
    });
    await receiveInventory(actorId, {
      idempotencyKey: `FIFO-RECEIPT-${runId}`,
      branchId,
      inventoryItemId,
      stockLocationId: locationId,
      quantity: '10',
      unitCost: '100',
      currency: 'IDR',
      sourceType: 'TEST_SETUP',
      sourceId: runId,
      reasonCode: 'TEST_SETUP',
      occurredAt: new Date(),
    });
  }, 30_000);

  it('returns branch-wide balance totals and distinguishes pending valuation from quantity mismatch', async () => {
    const balances = await listInventoryBalances(actorId, {
      branchId,
      page: 1,
      limit: 1,
    });

    expect(balances.data).toHaveLength(1);
    expect(balances.meta.total).toBe(2);
    expect(balances.summary.onHandQty.toFixed(4)).toBe('15.0000');
    expect(balances.summary.availableQty.toFixed(4)).toBe('15.0000');

    const reconciliation = await reconcileInventory(actorId, branchId);
    expect(reconciliation.quantityMismatchCount).toBe(0);
    expect(reconciliation.mismatchCount).toBe(0);
    expect(reconciliation.valuedLayerQty.toFixed(4)).toBe('10.0000');
    expect(reconciliation.pendingValuationQty.toFixed(4)).toBe('5.0000');
    expect(reconciliation.pendingValuationItemCount).toBe(1);
    expect(reconciliation.valuationComplete).toBe(false);
    expect(reconciliation.valuationStatus).toBe('PENDING_VALUATION');
    expect(reconciliation.layerValue.toFixed(4)).toBe('1000.0000');
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId }] } });
    await prisma.inventoryCostAllocation.deleteMany({ where: { posting: { branchId } } });
    await prisma.stockMutation.deleteMany({ where: { inventoryItem: { branchId } } });
    await prisma.inventoryCostLayer.deleteMany({ where: { inventoryBalance: { branchId } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: [inventoryItemId, quantityOnlyItemId] } } });
    await prisma.stockLocation.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.masterProduct.deleteMany({ where: { id: { in: [productId, quantityOnlyProductId] } } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 30_000);

  it('prevents over-consumption, deduplicates concurrent retry, and reverses once', async () => {
    const competing = await Promise.allSettled([
      issueInventory(actorId, {
        idempotencyKey: `FIFO-ISSUE-A-${runId}`,
        branchId,
        sourceType: 'CONCURRENCY_TEST',
        sourceId: `A-${runId}`,
        reasonCode: 'TEST_ISSUE',
        occurredAt: new Date(),
        lines: [{ inventoryItemId, stockLocationId: locationId, quantity: '7' }],
      }),
      issueInventory(actorId, {
        idempotencyKey: `FIFO-ISSUE-B-${runId}`,
        branchId,
        sourceType: 'CONCURRENCY_TEST',
        sourceId: `B-${runId}`,
        reasonCode: 'TEST_ISSUE',
        occurredAt: new Date(),
        lines: [{ inventoryItemId, stockLocationId: locationId, quantity: '7' }],
      }),
    ]);

    const successes = competing.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled');
    expect(successes).toHaveLength(1);
    const issuedPosting = successes[0].value;

    const afterCompetition = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
    expect(afterCompetition.stock.toFixed(4)).toBe('3.0000');
    const layersAfterCompetition = await prisma.inventoryCostLayer.aggregate({
      where: { inventoryBalance: { inventoryItemId } },
      _sum: { remainingQty: true },
    });
    expect(layersAfterCompetition._sum.remainingQty?.toFixed(4)).toBe('3.0000');

    const duplicateKey = `FIFO-DUPLICATE-${runId}`;
    const duplicatePayload = {
      idempotencyKey: duplicateKey,
      branchId,
      sourceType: 'CONCURRENCY_TEST',
      sourceId: `DUP-${runId}`,
      reasonCode: 'TEST_ISSUE',
      occurredAt: new Date(),
      lines: [{ inventoryItemId, stockLocationId: locationId, quantity: '1' }],
    };
    const duplicates = await Promise.all([
      issueInventory(actorId, duplicatePayload),
      issueInventory(actorId, duplicatePayload),
    ]);
    expect(duplicates[0].id).toBe(duplicates[1].id);
    expect(await prisma.inventoryPosting.count({ where: { idempotencyKey: duplicateKey } })).toBe(1);

    const reversals = await Promise.allSettled([
      reverseInventoryPosting(actorId, issuedPosting.id, {
        idempotencyKey: `FIFO-REV-A-${runId}`,
        reasonCode: 'TEST_REVERSAL',
        occurredAt: new Date(),
      }),
      reverseInventoryPosting(actorId, issuedPosting.id, {
        idempotencyKey: `FIFO-REV-B-${runId}`,
        reasonCode: 'TEST_REVERSAL',
        occurredAt: new Date(),
      }),
    ]);
    expect(reversals.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.inventoryPosting.count({ where: { reversalOfId: issuedPosting.id } })).toBe(1);

    const finalItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
    expect(finalItem.stock.toFixed(4)).toBe('9.0000');
    const negativeBalances = await prisma.inventoryBalance.count({ where: { branchId, onHandQty: { lt: 0 } } });
    const negativeLayers = await prisma.inventoryCostLayer.count({ where: { inventoryBalance: { branchId }, remainingQty: { lt: 0 } } });
    expect(negativeBalances).toBe(0);
    expect(negativeLayers).toBe(0);
    expect(await prisma.auditLog.count({ where: { branchId, resource: 'InventoryPosting' } })).toBeGreaterThan(0);
  }, 60_000);

  it('allows treatment quantity consumption and reversal without unit cost', async () => {
    const occurredAt = new Date();
    const postingId = await prisma.$transaction((tx) => issueInventoryInTransaction(actorId, {
      idempotencyKey: `TREATMENT-QTY-${runId}`,
      branchId,
      sourceType: 'TREATMENT_SESSION',
      sourceId: `SESSION-${runId}`,
      sourceNumber: `SESSION-${runId}`,
      reasonCode: 'TREATMENT_MATERIAL_USAGE',
      occurredAt,
      lines: [{ inventoryItemId: quantityOnlyItemId, stockLocationId: locationId, quantity: '2' }],
    }, tx, { allowUnvaluedQuantity: true }));

    const [itemAfterIssue, layerAfterIssue, mutation] = await Promise.all([
      prisma.inventoryItem.findUniqueOrThrow({ where: { id: quantityOnlyItemId } }),
      prisma.inventoryCostLayer.findFirstOrThrow({ where: { inventoryBalanceId: quantityOnlyBalanceId } }),
      prisma.stockMutation.findFirstOrThrow({ where: { inventoryPostingId: postingId } }),
    ]);
    expect(itemAfterIssue.stock.toFixed(4)).toBe('3.0000');
    expect(layerAfterIssue.remainingQty.toFixed(4)).toBe('3.0000');
    expect(mutation.actualCost?.toFixed(4)).toBe('0.0000');

    await prisma.$transaction((tx) => reverseInventoryPostingInTransaction(actorId, postingId, {
      idempotencyKey: `TREATMENT-QTY-REV-${runId}`,
      reasonCode: 'TREATMENT_CANCELLED',
      occurredAt: new Date(),
    }, tx));
    const [itemAfterReversal, layerAfterReversal] = await Promise.all([
      prisma.inventoryItem.findUniqueOrThrow({ where: { id: quantityOnlyItemId } }),
      prisma.inventoryCostLayer.findFirstOrThrow({ where: { inventoryBalanceId: quantityOnlyBalanceId } }),
    ]);
    expect(itemAfterReversal.stock.toFixed(4)).toBe('5.0000');
    expect(layerAfterReversal.remainingQty.toFixed(4)).toBe('5.0000');
  }, 30_000);
});
