import { randomUUID } from 'crypto';
import { ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { issueInventory, receiveInventory, reverseInventoryPosting } from '../inventory-ledger.service';

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

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId }] } });
    await prisma.inventoryCostAllocation.deleteMany({ where: { posting: { branchId } } });
    await prisma.stockMutation.deleteMany({ where: { inventoryItemId } });
    await prisma.inventoryCostLayer.deleteMany({ where: { inventoryBalance: { branchId } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId } });
    await prisma.inventoryItem.deleteMany({ where: { id: inventoryItemId } });
    await prisma.stockLocation.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
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
});
