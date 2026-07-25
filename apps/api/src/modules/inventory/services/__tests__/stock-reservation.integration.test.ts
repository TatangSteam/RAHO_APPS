import { randomUUID } from 'crypto';
import { AccountingPeriodStatus, Prisma, ProductCategory, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { issueInventory, listInventoryPostings, postOpeningInventory } from '../inventory-ledger.service';
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
  const unlinkedProductId = `reserve_unlinked_product_${runId}`;
  const inventoryItemId = `reserve_item_${runId}`;
  const periodId = `reserve_period_${runId}`;
  const openingOccurredAt = new Date('2026-07-24T03:00:00.000Z');

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
    await prisma.accountingPeriod.create({
      data: {
        id: periodId,
        name: `UAT Opening ${runId}`,
        fiscalYear: 2026,
        periodNo: 1,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.999Z'),
        branchId: sourceBranchId,
        scopeKey: sourceBranchId,
        status: AccountingPeriodStatus.OPEN,
        createdBy: actorId,
      },
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
        tracksBatch: true,
        tracksExpiry: true,
      },
    });
    await prisma.masterProduct.create({
      data: {
        id: unlinkedProductId,
        sku: `UNLINKED-${runId}`,
        name: `Unlinked Opening Product ${runId}`,
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
    await prisma.stockMutation.deleteMany({ where: { inventoryItem: { branchId: sourceBranchId } } });
    await prisma.inventoryCostLayer.deleteMany({ where: { inventoryBalance: { branchId: sourceBranchId } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId: sourceBranchId } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId: sourceBranchId } });
    await prisma.inventoryItem.deleteMany({ where: { branchId: sourceBranchId } });
    await prisma.inventoryBatch.deleteMany({ where: { masterProductId: { in: [productId, unlinkedProductId] } } });
    await prisma.stockLocation.deleteMany({ where: { warehouseId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.masterProduct.deleteMany({ where: { id: { in: [productId, unlinkedProductId] } } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.accountingPeriod.deleteMany({ where: { id: periodId } });
    await prisma.branch.deleteMany({ where: { id: { in: [sourceBranchId, destinationBranchId] } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  }, 30_000);

  it('posts valued opening stock and creates its cost layer atomically', async () => {
    const idempotencyKey = `OPENING-${runId}`;
    const sourceId = `OPENING-DOC-${runId}`;
    const input = {
      idempotencyKey,
      branchId: sourceBranchId,
      inventoryItemId,
      stockLocationId: locationId,
      quantity: '10',
      unitCost: '100',
      currency: 'IDR',
      sourceId,
      sourceNumber: `OB-${runId}`,
      batch: {
        batchNumber: 'BAT-OLD',
        expiryDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    } as const;
    const beforeCounts = {
      postings: await prisma.inventoryPosting.count({ where: { branchId: sourceBranchId } }),
      mutations: await prisma.stockMutation.count({ where: { inventoryItemId } }),
      layers: await prisma.inventoryCostLayer.count({ where: { inventoryBalance: { branchId: sourceBranchId } } }),
    };

    const result = await postOpeningInventory(actorId, input);
    const replay = await postOpeningInventory(actorId, input);

    expect(result.type).toBe('OPENING');
    expect(result.sourceType).toBe('OPENING_STOCK');
    expect(result.sourceId).toBe(sourceId);
    expect(result.totalCost.toFixed(4)).toBe('1000.0000');
    expect(replay.id).toBe(result.id);
    expect(result.costLayers).toHaveLength(1);

    const balance = await prisma.inventoryBalance.findFirstOrThrow({
      where: { inventoryItemId, batch: { batchNumber: 'BAT-OLD' } },
    });
    expect(balance.onHandQty.toFixed(4)).toBe('10.0000');
    expect(balance.reservedQty.toFixed(4)).toBe('0.0000');
    expect(balance.quarantineQty.toFixed(4)).toBe('0.0000');

    const mutation = await prisma.stockMutation.findFirstOrThrow({ where: { inventoryPostingId: result.id } });
    expect(mutation.type).toBe('RECEIVED');
    expect(mutation.stockBefore.toFixed(4)).toBe('0.0000');
    expect(mutation.stockAfter.toFixed(4)).toBe('10.0000');

    const layer = await prisma.inventoryCostLayer.findFirstOrThrow({ where: { sourceId } });
    expect(layer.originalQty.toFixed(4)).toBe('10.0000');
    expect(layer.remainingQty.toFixed(4)).toBe('10.0000');
    expect(layer.unitCost?.toFixed(4)).toBe('100.0000');
    expect((await assetValue()).toFixed(4)).toBe('1000.0000');
    const listed = await listInventoryPostings(actorId, {
      branchId: sourceBranchId,
      page: 1,
      limit: 25,
    });
    expect(listed.find((posting) => posting.id === result.id)?.costLayers).toHaveLength(1);

    expect(await prisma.inventoryPosting.count({ where: { branchId: sourceBranchId } })).toBe(beforeCounts.postings + 1);
    expect(await prisma.stockMutation.count({ where: { inventoryItemId } })).toBe(beforeCounts.mutations + 1);
    expect(await prisma.inventoryCostLayer.count({ where: { inventoryBalance: { branchId: sourceBranchId } } })).toBe(beforeCounts.layers + 1);

    await expect(postOpeningInventory(actorId, { ...input, quantity: '11' }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects a new opening posting outside an OPEN accounting period', async () => {
    await prisma.accountingPeriod.update({
      where: { id: periodId },
      data: { status: AccountingPeriodStatus.CLOSED },
    });
    const beforePostingCount = await prisma.inventoryPosting.count({ where: { branchId: sourceBranchId } });

    try {
      await expect(postOpeningInventory(actorId, {
        idempotencyKey: `OPENING-CLOSED-${runId}`,
        branchId: sourceBranchId,
        inventoryItemId,
        stockLocationId: locationId,
        quantity: '1',
        unitCost: '100',
        currency: 'IDR',
        sourceId: `OPENING-CLOSED-DOC-${runId}`,
        occurredAt: openingOccurredAt,
        batch: {
          batchNumber: 'BAT-CLOSED',
          expiryDate: new Date('2027-12-31T00:00:00.000Z'),
        },
      })).rejects.toMatchObject({ code: 'ACCOUNTING_PERIOD_CLOSED' });
      expect(await prisma.inventoryPosting.count({ where: { branchId: sourceBranchId } })).toBe(beforePostingCount);
    } finally {
      await prisma.accountingPeriod.update({
        where: { id: periodId },
        data: { status: AccountingPeriodStatus.OPEN },
      });
    }
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
    expect((await assetValue()).toFixed(4)).toBe('1000.0000');

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

  it('automatically links a master product to the branch during opening stock', async () => {
    expect(await prisma.inventoryItem.findUnique({
      where: {
        masterProductId_branchId: {
          masterProductId: unlinkedProductId,
          branchId: sourceBranchId,
        },
      },
    })).toBeNull();

    const result = await postOpeningInventory(actorId, {
      idempotencyKey: `OPENING-AUTO-LINK-${runId}`,
      branchId: sourceBranchId,
      masterProductId: unlinkedProductId,
      quantity: '2',
      unitCost: '50',
      currency: 'IDR',
      sourceId: `OPENING-AUTO-LINK-DOC-${runId}`,
      occurredAt: openingOccurredAt,
      batch: {
        batchNumber: 'BAT-AUTO-LINK',
        expiryDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });

    const item = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        masterProductId_branchId: {
          masterProductId: unlinkedProductId,
          branchId: sourceBranchId,
        },
      },
    });
    expect(item.warehouseId).toBe(warehouseId);
    expect(item.stockLocationId).toBe(locationId);
    expect(item.stock.toFixed(4)).toBe('2.0000');
    expect(result.stockMutations[0]?.inventoryItemId).toBe(item.id);
    expect(result.costLayers).toHaveLength(1);
  });
});
