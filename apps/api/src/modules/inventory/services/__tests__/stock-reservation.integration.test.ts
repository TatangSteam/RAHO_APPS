import { randomUUID } from 'crypto';
import { Prisma, ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { issueInventory, postOpeningInventory } from '../inventory-ledger.service';
import { approveAndReserveStockRequest, releaseStockRequestReservations } from '../stock-reservation.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('opening stock and stock request reservations', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 16);
  const actorId = `reserve_user_${runId}`;
  const sourceBranchId = `reserve_source_${runId}`;
  const destinationBranchId = `reserve_dest_${runId}`;
  const warehouseId = `reserve_wh_${runId}`;
  const locationId = `reserve_loc_${runId}`;
  const uomId = `reserve_uom_${runId}`;
  const productId = `reserve_product_${runId}`;
  const inventoryItemId = `reserve_item_${runId}`;

  const assetValue = async () => {
    const layers = await prisma.inventoryCostLayer.findMany({
      where: { inventoryBalance: { branchId: sourceBranchId }, isVoided: false },
    });
    return layers.reduce(
      (total, layer) => total.add(layer.remainingQty.mul(layer.unitCost ?? 0)),
      new Prisma.Decimal(0),
    );
  };

  const createRequest = async (suffix: string, requestedQty: string) => prisma.stockRequest.create({
    data: {
      requestCode: `REQ-RSV-${runId}-${suffix}`,
      branchId: destinationBranchId,
      requestedBy: actorId,
      items: { create: { masterProductId: productId, requestedQty } },
    },
    include: { items: true },
  });

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: actorId,
        email: `reserve-${runId}@example.test`,
        password: 'not-used-in-test',
        role: Role.SUPER_ADMIN,
      },
    });
    await prisma.branch.createMany({
      data: [
        { id: sourceBranchId, branchCode: `RS${runId.slice(0, 7)}`, name: `Reservation Source ${runId}` },
        { id: destinationBranchId, branchCode: `RD${runId.slice(0, 7)}`, name: `Reservation Destination ${runId}` },
      ],
    });
    await prisma.unitOfMeasure.create({ data: { id: uomId, code: `RU${runId.slice(0, 8)}`, name: `Unit ${runId}` } });
    await prisma.masterProduct.create({
      data: {
        id: productId,
        sku: `RSV-${runId}`,
        name: `Reservation Product ${runId}`,
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
      data: { id: warehouseId, branchId: sourceBranchId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
    });
    await prisma.stockLocation.create({
      data: { id: locationId, warehouseId, code: 'MAIN', name: 'Main', isDefault: true, createdBy: actorId },
    });
    await prisma.inventoryItem.create({
      data: {
        id: inventoryItemId,
        masterProductId: productId,
        branchId: sourceBranchId,
        warehouseId,
        stockLocationId: locationId,
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId: { in: [sourceBranchId, destinationBranchId] } }] } });
    await prisma.stockReservation.deleteMany({ where: { stockRequest: { requestedBy: actorId } } });
    await prisma.shipmentItem.deleteMany({ where: { shipment: { stockRequest: { requestedBy: actorId } } } });
    await prisma.shipment.deleteMany({ where: { stockRequest: { requestedBy: actorId } } });
    await prisma.stockRequest.deleteMany({ where: { requestedBy: actorId } });
    await prisma.inventoryCostAllocation.deleteMany({ where: { posting: { branchId: sourceBranchId } } });
    await prisma.stockMutation.deleteMany({ where: { inventoryItemId } });
    await prisma.inventoryCostLayer.deleteMany({ where: { inventoryBalance: { branchId: sourceBranchId } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId: sourceBranchId } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId: sourceBranchId } });
    await prisma.inventoryItem.deleteMany({ where: { id: inventoryItemId } });
    await prisma.stockLocation.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.branch.deleteMany({ where: { id: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 30_000);

  it('posts valued opening stock and creates its cost layer atomically', async () => {
    const result = await postOpeningInventory(actorId, {
      idempotencyKey: `OPENING-${runId}`,
      branchId: sourceBranchId,
      inventoryItemId,
      stockLocationId: locationId,
      quantity: '10',
      unitCost: '125',
      currency: 'IDR',
      sourceId: `OPENING-DOC-${runId}`,
      sourceNumber: `OB-${runId}`,
      occurredAt: new Date(),
    });

    expect(result.type).toBe('OPENING');
    expect(result.totalCost.toFixed(4)).toBe('1250.0000');
    const layer = await prisma.inventoryCostLayer.findFirstOrThrow({ where: { sourceId: `OPENING-DOC-${runId}` } });
    expect(layer.originalQty.toFixed(4)).toBe('10.0000');
    expect(layer.remainingQty.toFixed(4)).toBe('10.0000');
    expect(layer.unitCost?.toFixed(4)).toBe('125.0000');
    expect((await assetValue()).toFixed(4)).toBe('1250.0000');
  });

  it('supports partial approval and release without changing inventory asset value', async () => {
    const request = await createRequest('PARTIAL', '8');
    const beforeValue = await assetValue();
    const beforePostingCount = await prisma.inventoryPosting.count({ where: { branchId: sourceBranchId } });
    const beforeMutationCount = await prisma.stockMutation.count({ where: { inventoryItemId } });

    const approvalInput = {
      idempotencyKey: `RESERVE-PARTIAL-${runId}`,
      sourceBranchId,
      reviewNotes: 'Partial sesuai stock plan',
      lines: [{ stockRequestItemId: request.items[0].id, approvedQty: '6', stockLocationId: locationId }],
    };
    const approved = await approveAndReserveStockRequest(actorId, request.id, approvalInput);
    const duplicate = await approveAndReserveStockRequest(actorId, request.id, approvalInput);

    expect(approved.status).toBe('PARTIALLY_APPROVED');
    expect(duplicate.reservations[0].id).toBe(approved.reservations[0].id);
    expect(approved.items[0].approvedQty?.toFixed(2)).toBe('6.00');
    const reservedBalance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(reservedBalance.onHandQty.toFixed(4)).toBe('10.0000');
    expect(reservedBalance.reservedQty.toFixed(4)).toBe('6.0000');
    expect((await assetValue()).equals(beforeValue)).toBe(true);
    expect(await prisma.inventoryPosting.count({ where: { branchId: sourceBranchId } })).toBe(beforePostingCount);
    expect(await prisma.stockMutation.count({ where: { inventoryItemId } })).toBe(beforeMutationCount);

    const releaseInput = { idempotencyKey: `RELEASE-PARTIAL-${runId}`, reason: 'Prioritas permintaan berubah' };
    await releaseStockRequestReservations(actorId, request.id, releaseInput);
    await releaseStockRequestReservations(actorId, request.id, releaseInput);
    const releasedBalance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(releasedBalance.onHandQty.toFixed(4)).toBe('10.0000');
    expect(releasedBalance.reservedQty.toFixed(4)).toBe('0.0000');
    expect((await assetValue()).equals(beforeValue)).toBe(true);
  }, 30_000);

  it('supports full approval and prevents concurrent over-reservation', async () => {
    const fullRequest = await createRequest('FULL', '3');
    const full = await approveAndReserveStockRequest(actorId, fullRequest.id, {
      idempotencyKey: `RESERVE-FULL-${runId}`,
      sourceBranchId,
      lines: [{ stockRequestItemId: fullRequest.items[0].id, approvedQty: '3', stockLocationId: locationId }],
    });
    expect(full.status).toBe('APPROVED');
    await releaseStockRequestReservations(actorId, fullRequest.id, {
      idempotencyKey: `RELEASE-FULL-${runId}`,
      reason: 'Setup concurrency test',
    });

    const [requestA, requestB] = await Promise.all([createRequest('RACE-A', '7'), createRequest('RACE-B', '7')]);
    const competing = await Promise.allSettled([
      approveAndReserveStockRequest(actorId, requestA.id, {
        idempotencyKey: `RESERVE-RACE-A-${runId}`,
        sourceBranchId,
        lines: [{ stockRequestItemId: requestA.items[0].id, approvedQty: '7', stockLocationId: locationId }],
      }),
      approveAndReserveStockRequest(actorId, requestB.id, {
        idempotencyKey: `RESERVE-RACE-B-${runId}`,
        sourceBranchId,
        lines: [{ stockRequestItemId: requestB.items[0].id, approvedQty: '7', stockLocationId: locationId }],
      }),
    ]);

    expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const balance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(balance.onHandQty.toFixed(4)).toBe('10.0000');
    expect(balance.reservedQty.toFixed(4)).toBe('7.0000');
    expect((await assetValue()).toFixed(4)).toBe('1250.0000');

    await expect(issueInventory(actorId, {
      idempotencyKey: `ISSUE-BLOCKED-${runId}`,
      branchId: sourceBranchId,
      sourceType: 'RESERVATION_TEST',
      sourceId: `BLOCKED-${runId}`,
      reasonCode: 'RESERVATION_GUARD',
      occurredAt: new Date(),
      lines: [{ inventoryItemId, stockLocationId: locationId, quantity: '4' }],
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_AVAILABLE_STOCK' });

    await issueInventory(actorId, {
      idempotencyKey: `ISSUE-AVAILABLE-${runId}`,
      branchId: sourceBranchId,
      sourceType: 'RESERVATION_TEST',
      sourceId: `AVAILABLE-${runId}`,
      reasonCode: 'RESERVATION_GUARD',
      occurredAt: new Date(),
      lines: [{ inventoryItemId, stockLocationId: locationId, quantity: '3' }],
    });
    const afterIssue = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(afterIssue.onHandQty.toFixed(4)).toBe('7.0000');
    expect(afterIssue.reservedQty.toFixed(4)).toBe('7.0000');
  }, 60_000);
});
