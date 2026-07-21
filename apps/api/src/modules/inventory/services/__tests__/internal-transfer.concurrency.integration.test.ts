import { randomUUID } from 'crypto';
import { BranchType, ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { receiveInventory } from '../inventory-ledger.service';
import { LogisticsService } from '../../logistics.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('AC-004/AC-006 PostgreSQL internal transfer', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `trf_user_${runId}`;
  const sourceBranchId = `trf_src_${runId}`;
  const destinationBranchId = `trf_dst_${runId}`;
  const sourceWarehouseId = `trf_swh_${runId}`;
  const destinationWarehouseId = `trf_dwh_${runId}`;
  const sourceLocationId = `trf_sloc_${runId}`;
  const destinationLocationId = `trf_dloc_${runId}`;
  const uomId = `trf_uom_${runId}`;
  const productId = `trf_product_${runId}`;
  const sourceItemId = `trf_item_${runId}`;
  const requestId = `trf_req_${runId}`;
  const requestItemId = `trf_ri_${runId}`;
  const shipmentId = `trf_ship_${runId}`;
  const shipmentItemId = `trf_si_${runId}`;
  const service = new LogisticsService();
  const actor = { userId: actorId, role: Role.SUPER_ADMIN, branchId: null };

  beforeAll(async () => {
    await prisma.user.create({ data: { id: actorId, email: `transfer-${runId}@example.test`, password: 'test-only', role: Role.SUPER_ADMIN } });
    await prisma.branch.createMany({ data: [
      { id: sourceBranchId, branchCode: `TS${runId.slice(0, 6)}`, name: `Transfer Source ${runId}`, type: BranchType.PUSAT },
      { id: destinationBranchId, branchCode: `TD${runId.slice(0, 6)}`, name: `Transfer Destination ${runId}`, type: BranchType.PREMIER },
    ] });
    const year = new Date().getUTCFullYear();
    await prisma.accountingPeriod.createMany({ data: [
      { id: `trf_ps_${runId}`, name: `Transfer Source ${year}`, fiscalYear: year, periodNo: 1, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), branchId: sourceBranchId, scopeKey: sourceBranchId, createdBy: actorId },
      { id: `trf_pd_${runId}`, name: `Transfer Destination ${year}`, fiscalYear: year, periodNo: 1, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), branchId: destinationBranchId, scopeKey: destinationBranchId, createdBy: actorId },
    ] });
    await prisma.unitOfMeasure.create({ data: { id: uomId, code: `TU${runId.slice(0, 6)}`, name: `Transfer Unit ${runId}` } });
    await prisma.masterProduct.create({ data: { id: productId, sku: `TRF-${runId}`, name: `Transfer Product ${runId}`, category: ProductCategory.CONSUMABLE, unit: 'unit', baseUnit: 'unit', usageUnit: 'unit', baseUomId: uomId, usageUomId: uomId, conversionFactor: '1' } });
    await prisma.warehouse.createMany({ data: [
      { id: sourceWarehouseId, branchId: sourceBranchId, code: 'MAIN', name: 'Source Main', isDefault: true, createdBy: actorId },
      { id: destinationWarehouseId, branchId: destinationBranchId, code: 'MAIN', name: 'Destination Main', isDefault: true, createdBy: actorId },
    ] });
    await prisma.stockLocation.createMany({ data: [
      { id: sourceLocationId, warehouseId: sourceWarehouseId, code: 'MAIN', name: 'Source Main', isDefault: true, createdBy: actorId },
      { id: destinationLocationId, warehouseId: destinationWarehouseId, code: 'MAIN', name: 'Destination Main', isDefault: true, createdBy: actorId },
    ] });
    await prisma.inventoryItem.create({ data: { id: sourceItemId, masterProductId: productId, branchId: sourceBranchId, warehouseId: sourceWarehouseId, stockLocationId: sourceLocationId, stock: 0 } });
    await receiveInventory(actorId, { idempotencyKey: `TRF-SETUP-${runId}`, branchId: sourceBranchId, inventoryItemId: sourceItemId, stockLocationId: sourceLocationId, quantity: '10', unitCost: '100', currency: 'IDR', sourceType: 'TEST_SETUP', sourceId: runId, reasonCode: 'TEST_SETUP', occurredAt: new Date() });
    await prisma.stockRequest.create({ data: { id: requestId, requestCode: `REQ-${runId}`, branchId: destinationBranchId, sourceBranchId, requestedBy: actorId, status: 'APPROVED', items: { create: { id: requestItemId, masterProductId: productId, inventoryItemId: sourceItemId, requestedQty: 4, approvedQty: 4 } } } });
    await prisma.shipment.create({ data: { id: shipmentId, shipmentCode: `SHP-${runId}`, stockRequestId: requestId, fromBranchId: sourceBranchId, toBranchId: destinationBranchId, items: { create: { id: shipmentItemId, masterProductId: productId, sentQty: 4, requestedQty: 4 } } } });
  }, 30_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId: { in: [sourceBranchId, destinationBranchId] } }] } });
    await prisma.logisticStockTransactionItem.deleteMany({ where: { transaction: { referenceId: shipmentId } } });
    await prisma.logisticStockTransaction.deleteMany({ where: { referenceId: shipmentId } });
    await prisma.internalTransferLedger.deleteMany({ where: { shipmentId } });
    await prisma.inventoryCostAllocation.deleteMany({ where: { posting: { sourceId: shipmentId } } });
    await prisma.stockMutation.deleteMany({ where: { inventoryItem: { branchId: { in: [sourceBranchId, destinationBranchId] } } } });
    await prisma.inventoryCostLayer.deleteMany({ where: { OR: [{ sourceId: shipmentId }, { inventoryBalance: { branchId: { in: [sourceBranchId, destinationBranchId] } } }] } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.shipment.deleteMany({ where: { id: shipmentId } });
    await prisma.stockRequestItem.deleteMany({ where: { id: requestItemId } });
    await prisma.stockRequest.deleteMany({ where: { id: requestId } });
    await prisma.journalSourceLink.deleteMany({ where: { sourceId: shipmentId } });
    const journalIds = (await prisma.journalEntry.findMany({ where: { postingKey: { contains: shipmentId } }, select: { id: true } })).map((row) => row.id);
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    await prisma.accountingPeriod.deleteMany({ where: { scopeKey: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.inventoryItem.deleteMany({ where: { branchId: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.stockLocation.deleteMany({ where: { warehouseId: { in: [sourceWarehouseId, destinationWarehouseId] } } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [sourceWarehouseId, destinationWarehouseId] } } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.branch.deleteMany({ where: { id: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 30_000);

  it('posts one dispatch and one receipt under concurrent retry while preserving total value', async () => {
    const dispatches = await Promise.all([
      service.shipBranchShipment(actor, shipmentId, { notes: 'Concurrency dispatch' }),
      service.shipBranchShipment(actor, shipmentId, { notes: 'Concurrency dispatch' }),
    ]);
    expect(dispatches).toHaveLength(2);
    expect(await prisma.internalTransferLedger.count({ where: { shipmentId } })).toBe(1);
    expect(await prisma.inventoryPosting.count({ where: { idempotencyKey: `TRANSFER_DISPATCH:${shipmentId}` } })).toBe(1);

    const receipts = await Promise.all([
      service.receiveBranchShipment(actor, shipmentId, { notes: 'Concurrency receipt', receivedItems: [{ masterProductId: productId, receivedQty: 4 }] }),
      service.receiveBranchShipment(actor, shipmentId, { notes: 'Concurrency receipt', receivedItems: [{ masterProductId: productId, receivedQty: 4 }] }),
    ]);
    expect(receipts).toHaveLength(2);
    expect(await prisma.inventoryPosting.count({ where: { idempotencyKey: `TRANSFER_RECEIPT:${shipmentId}` } })).toBe(1);

    const ledger = await prisma.internalTransferLedger.findUniqueOrThrow({ where: { shipmentId } });
    expect(ledger.status).toBe('RECEIVED');
    expect(ledger.totalValue.toFixed(4)).toBe('400.0000');
    expect(ledger.receivedValue.toFixed(4)).toBe('400.0000');
    const layerValue = await prisma.inventoryCostLayer.findMany({ where: { inventoryBalance: { branchId: { in: [sourceBranchId, destinationBranchId] } }, isVoided: false } });
    const totalValue = layerValue.reduce((sum, layer) => sum.add(layer.remainingQty.mul(layer.unitCost || 0)), ledger.totalValue.mul(0));
    expect(totalValue.toFixed(4)).toBe('1000.0000');
    expect(await prisma.journalEntry.count({ where: { postingKey: { in: [`INTERNAL_TRANSFER:DISPATCH:${shipmentId}`, `INTERNAL_TRANSFER:RECEIPT:${shipmentId}`] } } })).toBe(2);
    const nonAssetLines = await prisma.journalLine.count({ where: { journalEntry: { postingKey: { contains: shipmentId } }, account: { type: { not: 'ASSET' } } } });
    expect(nonAssetLines).toBe(0);
  }, 60_000);
});
