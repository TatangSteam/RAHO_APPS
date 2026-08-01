import { randomUUID } from 'crypto';
import { ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { issueInventory, receiveInventory } from '../inventory-ledger.service';
import {
  countStockOpname,
  createAdjustment,
  decideStockOpname,
  postAdjustment,
  postStockOpname,
  startStockOpname,
  submitStockOpname,
} from '../inventory-control.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Sprint 9 stock opname atomic posting', () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 14);
  const makerId = `s9_maker_${suffix}`;
  const approverId = `s9_approver_${suffix}`;
  const branchId = `s9_branch_${suffix}`;
  const warehouseId = `s9_wh_${suffix}`;
  const locationId = `s9_loc_${suffix}`;
  const productId = `s9_product_${suffix}`;
  const itemId = `s9_item_${suffix}`;
  const automaticReasonCode = `S9_AUTO_${suffix}`.toUpperCase();
  let opnameId: string;

  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: makerId, email: `s9-maker-${suffix}@test.local`, password: 'test', role: Role.ADMIN_LOGISTIK },
      { id: approverId, email: `s9-approver-${suffix}@test.local`, password: 'test', role: Role.ADMIN_MANAGER },
    ] });
    await prisma.branch.create({ data: { id: branchId, branchCode: `S9${suffix.slice(0, 6)}`, name: `Sprint 9 ${suffix}` } });
    await prisma.managerBranch.create({ data: { userId: approverId, branchId } });
    await prisma.staffBranch.create({ data: { userId: makerId, branchId } });
    await prisma.accountingPeriod.create({ data: {
      name: `Sprint 9 Year 2026 ${suffix}`, fiscalYear: 2026, periodNo: 1,
      startDate: new Date('2026-01-01T00:00:00.000Z'), endDate: new Date('2026-12-31T23:59:59.999Z'),
      branchId, scopeKey: branchId, status: 'OPEN', createdBy: approverId,
    } });
    await prisma.masterProduct.create({ data: {
      id: productId, sku: `S9-${suffix}`, name: `Opname Product ${suffix}`,
      category: ProductCategory.CONSUMABLE, unit: 'unit', baseUnit: 'unit', usageUnit: 'unit', conversionFactor: '1',
    } });
    await prisma.warehouse.create({ data: { id: warehouseId, branchId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: makerId } });
    await prisma.stockLocation.create({ data: { id: locationId, warehouseId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: makerId } });
    await prisma.inventoryItem.create({ data: { id: itemId, masterProductId: productId, branchId, warehouseId, stockLocationId: locationId } });
    await receiveInventory(makerId, {
      idempotencyKey: `S9-OPEN-${suffix}`, branchId, inventoryItemId: itemId, stockLocationId: locationId,
      quantity: '10', unitCost: '100', currency: 'IDR', sourceType: 'TEST_SETUP', sourceId: suffix,
      reasonCode: 'TEST_SETUP', occurredAt: new Date(Date.now() - 60_000),
    });
  }, 30_000);

  afterAll(async () => {
    // The dedicated integration database is reset between runs; approval audit is immutable.
    await prisma.$disconnect();
  }, 30_000);

  it('locks the location, posts variance mutation and journal exactly once', async () => {
    const opname = await startStockOpname(makerId, { branchId, stockLocationId: locationId, notes: 'Monthly count' });
    opnameId = opname.id;

    await expect(issueInventory(makerId, {
      idempotencyKey: `S9-LOCK-${suffix}`, branchId, sourceType: 'LOCK_TEST', sourceId: suffix,
      reasonCode: 'LOCK_TEST', occurredAt: new Date('2026-07-22T09:00:00.000Z'),
      lines: [{ inventoryItemId: itemId, stockLocationId: locationId, quantity: '1' }],
    })).rejects.toMatchObject({ code: 'STOCK_LOCATION_OPNAME_LOCKED' });

    await countStockOpname(makerId, opname.id, { lines: [{
      lineId: opname.lines[0].id, physicalQty: '8', resolution: 'ADJUST', resolutionNote: 'Selisih fisik terverifikasi',
    }] });
    await submitStockOpname(makerId, opname.id);
    await decideStockOpname(approverId, opname.id, { decision: 'APPROVE', note: 'Selisih disetujui' });

    const concurrent = await Promise.all([
      postStockOpname(approverId, opname.id),
      postStockOpname(approverId, opname.id),
    ]);
    expect(concurrent.every((row) => row.status === 'POSTED')).toBe(true);

    const [item, adjustment, journals] = await Promise.all([
      prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }),
      prisma.inventoryAdjustment.findFirstOrThrow({ where: { stockOpnameId: opname.id } }),
      prisma.journalEntry.findMany({ where: { sourceLinks: { some: { sourceType: 'STOCK_OPNAME', sourceId: opname.id } } }, include: { lines: { include: { account: true } } } }),
    ]);
    expect(item.stock.toFixed(4)).toBe('8.0000');
    expect(adjustment.status).toBe('POSTED');
    expect(journals).toHaveLength(1);
    expect(journals[0].totalDebit.toFixed(2)).toBe('200.00');
    expect(await prisma.inventoryPosting.count({ where: { sourceType: 'STOCK_OPNAME', sourceId: adjustment.id } })).toBe(1);
    expect(await prisma.stockMutation.count({ where: { referenceType: 'STOCK_OPNAME', referenceId: adjustment.id } })).toBe(1);
  }, 60_000);

  it('reuses the rejected adjustment when a corrected count is submitted again', async () => {
    const opname = await startStockOpname(makerId, { branchId, stockLocationId: locationId, notes: 'Recount flow' });
    await countStockOpname(makerId, opname.id, { lines: [{
      lineId: opname.lines[0].id, physicalQty: '7', resolution: 'ADJUST', resolutionNote: 'Hitung pertama',
    }] });
    const firstSubmission = await submitStockOpname(makerId, opname.id);
    await decideStockOpname(approverId, opname.id, { decision: 'REJECT', note: 'Mohon hitung ulang' });

    await countStockOpname(makerId, opname.id, { lines: [{
      lineId: opname.lines[0].id, physicalQty: '6', resolution: 'ADJUST', resolutionNote: 'Hasil hitung ulang',
    }] });
    const secondSubmission = await submitStockOpname(makerId, opname.id);

    expect(secondSubmission.adjustmentId).toBe(firstSubmission.adjustmentId);
    const adjustment = await prisma.inventoryAdjustment.findUniqueOrThrow({
      where: { id: secondSubmission.adjustmentId! },
      include: { lines: true },
    });
    expect(adjustment.status).toBe('PENDING_APPROVAL');
    expect(adjustment.lines).toHaveLength(1);
    expect(adjustment.lines[0].quantity.toFixed(4)).toBe('2.0000');

    await decideStockOpname(approverId, opname.id, { decision: 'APPROVE', note: 'Recount disetujui' });
    await postStockOpname(approverId, opname.id);
  }, 60_000);

  it('honors reason-code approval thresholds and posts an auto-approved adjustment atomically', async () => {
    await prisma.inventoryAdjustmentReasonCode.create({ data: {
      code: automaticReasonCode,
      name: 'Automatic test adjustment',
      direction: 'IN',
      requiresApproval: false,
      approvalThreshold: 0,
    } });
    const stockBefore = (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).stock;
    const created = await createAdjustment(makerId, {
      idempotencyKey: `S9-AUTO-ADJUSTMENT-${suffix}`,
      branchId,
      stockLocationId: locationId,
      reasonCode: automaticReasonCode,
      description: 'Auto-approved adjustment test',
      submit: true,
      lines: [{ inventoryItemId: itemId, direction: 'IN', quantity: '1', unitCost: '50' }],
    });
    expect(created.adjustment.status).toBe('APPROVED');
    expect(created.adjustment.approvalInstanceId).toBeNull();

    const posted = await postAdjustment(approverId, created.adjustment.id);
    const stockAfter = (await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).stock;
    expect(posted.status).toBe('POSTED');
    expect(stockAfter.sub(stockBefore).toFixed(4)).toBe('1.0000');
    expect(await prisma.journalEntry.count({ where: { postingKey: `INVENTORY_ADJUSTMENT:${created.adjustment.id}` } })).toBe(1);
  }, 60_000);
});
