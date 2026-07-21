import { randomUUID } from 'crypto';
import { Prisma, ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { postOpeningInventory } from '../inventory-ledger.service';
import { approveAndReserveStockRequest } from '../stock-reservation.service';
import { dispatchReservedShipment, receiveReservedShipment } from '../shipment-ledger.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('shipment transfer ledger', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `ship_user_${runId}`;
  const sourceBranchId = `ship_source_${runId}`;
  const destinationBranchId = `ship_dest_${runId}`;
  const sourceWarehouseId = `ship_swh_${runId}`;
  const destinationWarehouseId = `ship_dwh_${runId}`;
  const sourceLocationId = `ship_sloc_${runId}`;
  const destinationLocationId = `ship_dloc_${runId}`;
  const sourcePeriodId = `ship_speriod_${runId}`;
  const destinationPeriodId = `ship_dperiod_${runId}`;
  const uomId = `ship_uom_${runId}`;
  const productId = `ship_product_${runId}`;
  const sourceItemId = `ship_sitem_${runId}`;
  const destinationItemId = `ship_ditem_${runId}`;
  let requestId = '';
  let shipmentId = '';

  const inventoryAssetValue = async () => {
    const [layers, transfers] = await Promise.all([
      prisma.inventoryCostLayer.findMany({
        where: { inventoryBalance: { branchId: { in: [sourceBranchId, destinationBranchId] } }, isVoided: false },
      }),
      prisma.shipmentTransferLayer.findMany({
        where: { shipmentItem: { shipmentId } },
      }),
    ]);
    const onHand = layers.reduce(
      (total, layer) => total.add(layer.remainingQty.mul(layer.unitCost ?? 0)),
      new Prisma.Decimal(0),
    );
    return transfers.reduce(
      (total, layer) => total.add(layer.shippedQty.sub(layer.receivedQty).mul(layer.unitCost)),
      onHand,
    );
  };

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: actorId,
        email: `shipment-${runId}@example.test`,
        password: 'not-used-in-test',
        role: Role.SUPER_ADMIN,
      },
    });
    await prisma.branch.createMany({
      data: [
        { id: sourceBranchId, branchCode: `SS${runId.slice(0, 7)}`, name: `Shipment Source ${runId}` },
        { id: destinationBranchId, branchCode: `SD${runId.slice(0, 7)}`, name: `Shipment Destination ${runId}` },
      ],
    });
    await prisma.accountingPeriod.createMany({
      data: [
        {
          id: sourcePeriodId,
          name: `Shipment Source 2026 ${runId}`,
          fiscalYear: 2026,
          periodNo: 1,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
          branchId: sourceBranchId,
          scopeKey: sourceBranchId,
          createdBy: actorId,
        },
        {
          id: destinationPeriodId,
          name: `Shipment Destination 2026 ${runId}`,
          fiscalYear: 2026,
          periodNo: 1,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
          branchId: destinationBranchId,
          scopeKey: destinationBranchId,
          createdBy: actorId,
        },
      ],
    });
    await prisma.unitOfMeasure.create({ data: { id: uomId, code: `SU${runId.slice(0, 8)}`, name: `Unit ${runId}` } });
    await prisma.masterProduct.create({
      data: {
        id: productId,
        sku: `SHP-${runId}`,
        name: `Shipment Product ${runId}`,
        category: ProductCategory.CONSUMABLE,
        unit: 'unit',
        baseUnit: 'unit',
        usageUnit: 'unit',
        baseUomId: uomId,
        usageUomId: uomId,
        conversionFactor: '1',
      },
    });
    await prisma.warehouse.createMany({
      data: [
        { id: sourceWarehouseId, branchId: sourceBranchId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
        { id: destinationWarehouseId, branchId: destinationBranchId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
      ],
    });
    await prisma.stockLocation.createMany({
      data: [
        { id: sourceLocationId, warehouseId: sourceWarehouseId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
        { id: destinationLocationId, warehouseId: destinationWarehouseId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
      ],
    });
    await prisma.inventoryItem.createMany({
      data: [
        { id: sourceItemId, masterProductId: productId, branchId: sourceBranchId, warehouseId: sourceWarehouseId, stockLocationId: sourceLocationId },
        { id: destinationItemId, masterProductId: productId, branchId: destinationBranchId, warehouseId: destinationWarehouseId, stockLocationId: destinationLocationId },
      ],
    });
    await postOpeningInventory(actorId, {
      idempotencyKey: `SHIP-OPENING-A-${runId}`,
      branchId: sourceBranchId,
      inventoryItemId: sourceItemId,
      stockLocationId: sourceLocationId,
      quantity: '4',
      unitCost: '100',
      currency: 'IDR',
      sourceId: `SHIP-OPENING-A-${runId}`,
      occurredAt: new Date('2026-07-01T08:00:00.000Z'),
    });
    await postOpeningInventory(actorId, {
      idempotencyKey: `SHIP-OPENING-B-${runId}`,
      branchId: sourceBranchId,
      inventoryItemId: sourceItemId,
      stockLocationId: sourceLocationId,
      quantity: '6',
      unitCost: '150',
      currency: 'IDR',
      sourceId: `SHIP-OPENING-B-${runId}`,
      occurredAt: new Date('2026-07-02T08:00:00.000Z'),
    });
    const request = await prisma.stockRequest.create({
      data: {
        requestCode: `REQ-SHIP-${runId}`,
        branchId: destinationBranchId,
        requestedBy: actorId,
        items: { create: { masterProductId: productId, requestedQty: '8' } },
      },
      include: { items: true },
    });
    requestId = request.id;
    const approved = await approveAndReserveStockRequest(actorId, request.id, {
      idempotencyKey: `SHIP-RESERVE-${runId}`,
      sourceBranchId,
      lines: [{ stockRequestItemId: request.items[0].id, approvedQty: '8', stockLocationId: sourceLocationId }],
    });
    shipmentId = approved.shipment!.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId: { in: [sourceBranchId, destinationBranchId] } }] } });
    await prisma.shipmentDiscrepancy.deleteMany({ where: { shipmentId } });
    await prisma.shipmentReceiptItem.deleteMany({ where: { shipmentReceipt: { shipmentId } } });
    await prisma.shipmentReceipt.deleteMany({ where: { shipmentId } });
    await prisma.shipmentTransferLayer.deleteMany({ where: { shipmentItem: { shipmentId } } });
    await prisma.internalTransferLedger.deleteMany({ where: { shipmentId } });
    const journalIds = (await prisma.journalEntry.findMany({
      where: { sourceLinks: { some: { sourceId: shipmentId } } },
      select: { id: true },
    })).map((journal) => journal.id);
    await prisma.journalSourceLink.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    await prisma.stockReservation.deleteMany({ where: { stockRequestId: requestId } });
    await prisma.shipmentItem.deleteMany({ where: { shipmentId } });
    await prisma.shipment.deleteMany({ where: { id: shipmentId } });
    await prisma.stockRequest.deleteMany({ where: { id: requestId } });
    await prisma.stockMutation.deleteMany({ where: { inventoryItemId: { in: [sourceItemId, destinationItemId] } } });
    await prisma.inventoryCostLayer.deleteMany({ where: { inventoryBalance: { branchId: { in: [sourceBranchId, destinationBranchId] } } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.accountingPeriod.deleteMany({ where: { id: { in: [sourcePeriodId, destinationPeriodId] } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: [sourceItemId, destinationItemId] } } });
    await prisma.stockLocation.deleteMany({ where: { id: { in: [sourceLocationId, destinationLocationId] } } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [sourceWarehouseId, destinationWarehouseId] } } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.branch.deleteMany({ where: { id: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 60_000);

  it('dispatches FIFO exactly once and preserves value in transit', async () => {
    const input = {
      idempotencyKey: `SHIP-DISPATCH-${runId}`,
      occurredAt: new Date('2026-07-10T08:00:00.000Z'),
      items: [{ masterProductId: productId, sentQty: '8' }],
    };
    const results = await Promise.all([
      dispatchReservedShipment(actorId, shipmentId, input),
      dispatchReservedShipment(actorId, shipmentId, input),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(await prisma.inventoryPosting.count({ where: { sourceId: shipmentId, type: 'TRANSFER_OUT' } })).toBe(1);
    const transferLedger = await prisma.internalTransferLedger.findUniqueOrThrow({ where: { shipmentId } });
    expect(transferLedger.totalValue.toFixed(4)).toBe('1000.0000');
    expect(transferLedger.receivedValue.toFixed(4)).toBe('0.0000');
    expect(await prisma.journalEntry.count({
      where: { postingKey: `INTERNAL_TRANSFER:DISPATCH:${shipmentId}` },
    })).toBe(1);
    expect(await prisma.auditLog.count({
      where: { resource: 'Shipment', resourceId: shipmentId, action: 'SHIPMENT' },
    })).toBe(1);
    const sourceBalance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId: sourceItemId } });
    expect(sourceBalance.onHandQty.toFixed(4)).toBe('2.0000');
    expect(sourceBalance.reservedQty.toFixed(4)).toBe('0.0000');
    expect(sourceBalance.inTransitQty.toFixed(4)).toBe('8.0000');
    const transferLayers = await prisma.shipmentTransferLayer.findMany({ where: { shipmentItem: { shipmentId } }, orderBy: { unitCost: 'asc' } });
    expect(transferLayers.map(layer => [layer.shippedQty.toFixed(4), layer.unitCost.toFixed(4)])).toEqual([
      ['4.0000', '100.0000'],
      ['4.0000', '150.0000'],
    ]);
    expect((await inventoryAssetValue()).toFixed(4)).toBe('1300.0000');
  }, 60_000);

  it('receives partially with quarantine and remains idempotent', async () => {
    const input = {
      idempotencyKey: `SHIP-RECEIPT-PARTIAL-${runId}`,
      isFinal: false,
      occurredAt: new Date('2026-07-11T08:00:00.000Z'),
      notes: 'Penerimaan parsial pertama',
      receivedItems: [{ masterProductId: productId, receivedQty: '3', quarantineQty: '1', stockLocationId: destinationLocationId }],
      discrepancies: [{ masterProductId: productId, discrepancyType: 'DAMAGE' as const, notes: 'Satu unit rusak saat diterima' }],
    };
    const evidence = {
      url: `/api/v1/files/tests/${runId}.pdf`,
      fileName: `${runId}.pdf`,
      fileSize: 128,
      mimeType: 'application/pdf',
      checksum: `checksum-${runId}`,
    };
    const results = await Promise.all([
      receiveReservedShipment(actorId, shipmentId, input, { evidence }),
      receiveReservedShipment(actorId, shipmentId, input, { evidence }),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(await prisma.shipmentReceipt.count({ where: { shipmentId } })).toBe(1);
    expect(await prisma.auditLog.count({
      where: { userId: actorId, resource: 'ShipmentReceipt', action: 'RECEIVE_SHIPMENT' },
    })).toBe(1);
    const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { items: true } });
    expect(shipment.status).toBe('PARTIALLY_RECEIVED');
    expect(shipment.items[0].receivedQty?.toFixed(4)).toBe('3.0000');
    expect(shipment.items[0].quarantineQty.toFixed(4)).toBe('1.0000');
    const [sourceBalance, destinationBalance] = await Promise.all([
      prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId: sourceItemId } }),
      prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId: destinationItemId } }),
    ]);
    expect(sourceBalance.inTransitQty.toFixed(4)).toBe('5.0000');
    expect(destinationBalance.onHandQty.toFixed(4)).toBe('3.0000');
    expect(destinationBalance.quarantineQty.toFixed(4)).toBe('1.0000');
    expect(destinationBalance.onHandQty.sub(destinationBalance.quarantineQty).toFixed(4)).toBe('2.0000');
    const partialLedger = await prisma.internalTransferLedger.findUniqueOrThrow({ where: { shipmentId } });
    expect(partialLedger.status).toBe('DISCREPANCY');
    expect(partialLedger.receivedValue.toFixed(4)).toBe('300.0000');
    expect((await inventoryAssetValue()).toFixed(4)).toBe('1300.0000');
  }, 60_000);

  it('serializes competing final receipts and prevents duplicate stock', async () => {
    const evidence = (suffix: string) => ({
      url: `/api/v1/files/tests/${runId}-${suffix}.pdf`,
      fileName: `${runId}-${suffix}.pdf`,
      fileSize: 128,
      mimeType: 'application/pdf',
      checksum: `checksum-${runId}-${suffix}`,
    });
    const finalInput = (suffix: string) => ({
      idempotencyKey: `SHIP-RECEIPT-FINAL-${runId}-${suffix}`,
      isFinal: true,
      occurredAt: new Date('2026-07-12T08:00:00.000Z'),
      receivedItems: [{ masterProductId: productId, receivedQty: '5', quarantineQty: '0', stockLocationId: destinationLocationId }],
      discrepancies: [],
    });
    const results = await Promise.allSettled([
      receiveReservedShipment(actorId, shipmentId, finalInput('A'), { evidence: evidence('A') }),
      receiveReservedShipment(actorId, shipmentId, finalInput('B'), { evidence: evidence('B') }),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await prisma.shipmentReceipt.count({ where: { shipmentId } })).toBe(2);
    expect(await prisma.auditLog.count({
      where: { userId: actorId, resource: 'ShipmentReceipt', action: 'RECEIVE_SHIPMENT' },
    })).toBe(2);
    const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { items: true } });
    expect(shipment.status).toBe('RECEIVED_WITH_ISSUE');
    expect(shipment.items[0].receivedQty?.toFixed(4)).toBe('8.0000');
    const [sourceBalance, destinationBalance, destinationItem] = await Promise.all([
      prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId: sourceItemId } }),
      prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId: destinationItemId } }),
      prisma.inventoryItem.findUniqueOrThrow({ where: { id: destinationItemId } }),
    ]);
    expect(sourceBalance.inTransitQty.toFixed(4)).toBe('0.0000');
    expect(destinationBalance.onHandQty.toFixed(4)).toBe('8.0000');
    expect(destinationBalance.quarantineQty.toFixed(4)).toBe('1.0000');
    expect(destinationItem.stock.toFixed(4)).toBe('8.0000');
    const finalLedger = await prisma.internalTransferLedger.findUniqueOrThrow({ where: { shipmentId } });
    expect(finalLedger.status).toBe('DISCREPANCY');
    expect(finalLedger.receivedValue.toFixed(4)).toBe('1000.0000');
    expect(await prisma.journalEntry.count({ where: { postingKey: { contains: shipmentId } } })).toBe(3);
    expect((await inventoryAssetValue()).toFixed(4)).toBe('1300.0000');
  }, 60_000);
});
