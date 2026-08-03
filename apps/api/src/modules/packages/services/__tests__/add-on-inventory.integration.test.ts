import { randomUUID } from 'crypto';
import { AddOnType, PackageStatus, ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { receiveInventory } from '@modules/inventory/services/inventory-ledger.service';
import {
  consumeAddOnStockInTransaction,
  reserveAddOnStockInTransaction,
  returnAddOnStockInTransaction,
} from '../add-on-inventory.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('physical add-on inventory lifecycle', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `addon_actor_${runId}`;
  const memberUserId = `addon_member_user_${runId}`;
  const memberId = `addon_member_${runId}`;
  const branchId = `addon_branch_${runId}`;
  const warehouseId = `addon_wh_${runId}`;
  const locationId = `addon_loc_${runId}`;
  const uomId = `addon_uom_${runId}`;
  const productId = `addon_product_${runId}`;
  const inventoryItemId = `addon_item_${runId}`;
  const addOnId = `addon_sale_${runId}`;
  const sku = `PRD-ADD-${runId}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: actorId, email: `${actorId}@example.test`, password: 'test-only', role: Role.SUPER_ADMIN },
    });
    await prisma.branch.create({
      data: { id: branchId, branchCode: `AO${runId.slice(0, 6)}`, name: `Add-on ${runId}` },
    });
    await prisma.user.create({
      data: {
        id: memberUserId,
        email: `${memberUserId}@example.test`,
        password: 'test-only',
        role: Role.MEMBER,
        branchId,
      },
    });
    await prisma.member.create({
      data: { id: memberId, userId: memberUserId, memberNo: `AO${runId}`, registrationBranchId: branchId },
    });
    await prisma.accountingPeriod.create({
      data: {
        id: `addon_period_${runId}`,
        name: `Add-on Period ${runId}`,
        fiscalYear: 2026,
        periodNo: 1,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.999Z'),
        branchId,
        scopeKey: branchId,
        createdBy: actorId,
      },
    });
    await prisma.unitOfMeasure.create({
      data: { id: uomId, code: `AO${runId.slice(0, 8)}`, name: `Add-on unit ${runId}` },
    });
    await prisma.masterProduct.create({
      data: {
        id: productId,
        sku,
        name: `Add-on Product ${runId}`,
        category: ProductCategory.CONSUMABLE,
        unit: 'Botol',
        baseUnit: 'Botol',
        usageUnit: 'Botol',
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
      idempotencyKey: `ADDON-RECEIPT-${runId}`,
      branchId,
      inventoryItemId,
      stockLocationId: locationId,
      quantity: '30',
      unitCost: '100',
      currency: 'IDR',
      sourceType: 'ADDON_TEST_SETUP',
      sourceId: runId,
      reasonCode: 'TEST_SETUP',
      occurredAt: new Date('2026-08-03T03:00:00.000Z'),
    });
    const addOn = await prisma.memberAddOn.create({
      data: {
        id: addOnId,
        addOnCode: `ADO-${runId}`,
        memberId,
        branchId,
        addOnType: AddOnType.AIR_NANO,
        quantity: 1,
        pricePerUnit: '360000',
        totalPrice: '360000',
        status: PackageStatus.PENDING_PAYMENT,
        productCode: `${sku}-DUS`,
        inventorySku: sku,
        stockQuantity: '24',
        assignedBy: actorId,
      },
    });
    await prisma.$transaction((tx) => reserveAddOnStockInTransaction(addOn, actorId, tx));
  }, 30_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId }] } });
    await prisma.journalSourceLink.deleteMany({ where: { journalEntry: { branchId } } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { branchId } } });
    await prisma.journalEntry.deleteMany({ where: { branchId } });
    await prisma.addOnStockReservation.deleteMany({ where: { memberAddOnId: addOnId } });
    await prisma.memberAddOn.deleteMany({ where: { id: addOnId } });
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
    await prisma.accountingPeriod.deleteMany({ where: { branchId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.user.deleteMany({ where: { id: memberUserId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 30_000);

  it('reserves, issues once with FIFO HPP, and returns stock with matching reversals', async () => {
    const reserved = await prisma.inventoryBalance.findFirstOrThrow({
      where: { inventoryItemId },
    });
    expect(reserved.onHandQty.toFixed(4)).toBe('30.0000');
    expect(reserved.reservedQty.toFixed(4)).toBe('24.0000');

    const occurredAt = new Date('2026-08-03T04:00:00.000Z');
    const postingId = await prisma.$transaction((tx) => (
      consumeAddOnStockInTransaction(addOnId, actorId, occurredAt, tx)
    ));
    expect(postingId).toBeTruthy();
    const replayPostingId = await prisma.$transaction((tx) => (
      consumeAddOnStockInTransaction(addOnId, actorId, occurredAt, tx)
    ));
    expect(replayPostingId).toBe(postingId);

    const issuedItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
    const issuedBalance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(issuedItem.stock.toFixed(4)).toBe('6.0000');
    expect(issuedBalance.onHandQty.toFixed(4)).toBe('6.0000');
    expect(issuedBalance.reservedQty.toFixed(4)).toBe('0.0000');
    const hpp = await prisma.journalEntry.findUniqueOrThrow({
      where: { postingKey: `ADDON_COGS:${addOnId}` },
    });
    expect(hpp.totalDebit.toFixed(2)).toBe('2400.00');
    expect(await prisma.inventoryPosting.count({ where: { sourceType: 'MEMBER_ADD_ON', sourceId: addOnId } })).toBe(1);

    await prisma.$transaction((tx) => returnAddOnStockInTransaction(
      addOnId,
      actorId,
      'Barang diterima kembali',
      new Date('2026-08-03T05:00:00.000Z'),
      tx,
    ));
    const returnedItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
    const returnedBalance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(returnedItem.stock.toFixed(4)).toBe('30.0000');
    expect(returnedBalance.onHandQty.toFixed(4)).toBe('30.0000');
    expect((await prisma.inventoryPosting.findUniqueOrThrow({ where: { id: postingId! } })).status).toBe('REVERSED');
    expect((await prisma.journalEntry.findUniqueOrThrow({ where: { id: hpp.id } })).status).toBe('REVERSED');
  }, 30_000);
});
