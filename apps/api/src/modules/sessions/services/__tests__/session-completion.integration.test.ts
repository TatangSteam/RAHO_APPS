import { randomUUID } from 'crypto';
import {
  BranchType,
  MaterialUsageStatus,
  PackageStatus,
  PackageType,
  ProductCategory,
  Role,
  SessionType,
  TreatmentBomStatus,
  VitalTiming,
  VitalType,
} from '@prisma/client';
import { prisma } from '@lib/prisma';
import { LogisticsService } from '@modules/inventory/logistics.service';
import { receiveInventory } from '@modules/inventory/services/inventory-ledger.service';
import { SessionCompletionService } from '../session-completion.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('AC-002/004/006 logistics-to-treatment PostgreSQL E2E', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `treat_actor_${runId}`;
  const memberUserId = `treat_member_user_${runId}`;
  const memberId = `treat_member_${runId}`;
  const sourceBranchId = `treat_source_branch_${runId}`;
  const branchId = `treat_branch_${runId}`;
  const sourceWarehouseId = `treat_source_wh_${runId}`;
  const warehouseId = `treat_wh_${runId}`;
  const sourceLocationId = `treat_source_loc_${runId}`;
  const locationId = `treat_loc_${runId}`;
  const uomId = `treat_uom_${runId}`;
  const productId = `treat_product_${runId}`;
  const sourceInventoryItemId = `treat_source_item_${runId}`;
  let inventoryItemId = '';
  const stockRequestId = `treat_request_${runId}`;
  const stockRequestItemId = `treat_request_item_${runId}`;
  const shipmentId = `treat_shipment_${runId}`;
  const shipmentItemId = `treat_shipment_item_${runId}`;
  const pricingId = `treat_price_${runId}`;
  const memberPackageId = `treat_package_${runId}`;
  const encounterId = `treat_encounter_${runId}`;
  const sessionId = `treat_session_${runId}`;
  const therapyPlanId = `treat_plan_${runId}`;
  const bomId = `treat_bom_${runId}`;
  const bomItemId = `treat_bom_item_${runId}`;
  const materialUsageId = `treat_usage_${runId}`;
  const valuationId = `treat_valuation_${runId}`;
  const contractId = `treat_contract_${runId}`;
  const sourceAccountingPeriodId = `treat_source_period_${runId}`;
  const accountingPeriodId = `treat_period_${runId}`;
  const service = new SessionCompletionService();
  const logistics = new LogisticsService();
  const logisticsActor = { userId: actorId, role: Role.SUPER_ADMIN, branchId: null };

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: actorId, email: `treatment-${runId}@example.test`, password: 'test-only', role: Role.SUPER_ADMIN },
    });
    await prisma.branch.createMany({ data: [
      { id: sourceBranchId, branchCode: `TS${runId.slice(0, 6)}`, name: `Treatment Source ${runId}`, type: BranchType.PUSAT },
      { id: branchId, branchCode: `TC${runId.slice(0, 6)}`, name: `Treatment Completion ${runId}`, type: BranchType.PREMIER },
    ] });
    await prisma.accountingPeriod.createMany({ data: [
      {
        id: sourceAccountingPeriodId,
        name: `Source July 2026 ${runId}`,
        fiscalYear: 2026,
        periodNo: 7,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-31T23:59:59.999Z'),
        branchId: sourceBranchId,
        scopeKey: sourceBranchId,
        createdBy: actorId,
      },
      {
        id: accountingPeriodId,
        name: `Destination July 2026 ${runId}`,
        fiscalYear: 2026,
        periodNo: 7,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-31T23:59:59.999Z'),
        branchId,
        scopeKey: branchId,
        createdBy: actorId,
      },
    ] });
    await prisma.user.create({
      data: {
        id: memberUserId,
        email: `treatment-member-${runId}@example.test`,
        password: 'test-only',
        role: Role.MEMBER,
        branchId,
      },
    });
    await prisma.member.create({
      data: { id: memberId, userId: memberUserId, memberNo: `TM${runId}`, registrationBranchId: branchId },
    });
    await prisma.unitOfMeasure.create({
      data: { id: uomId, code: `TCU${runId.slice(0, 6)}`, name: `Treatment Unit ${runId}` },
    });
    await prisma.masterProduct.create({
      data: {
        id: productId,
        sku: `TC-${runId}`,
        name: `Treatment Material ${runId}`,
        category: ProductCategory.CONSUMABLE,
        unit: 'unit',
        baseUnit: 'unit',
        usageUnit: 'unit',
        baseUomId: uomId,
        usageUomId: uomId,
        conversionFactor: '1',
      },
    });
    await prisma.warehouse.createMany({ data: [
      { id: sourceWarehouseId, branchId: sourceBranchId, code: 'MAIN', name: 'Source Main', isDefault: true, createdBy: actorId },
      { id: warehouseId, branchId, code: 'MAIN', name: 'Treatment Main', isDefault: true, createdBy: actorId },
    ] });
    await prisma.stockLocation.createMany({ data: [
      { id: sourceLocationId, warehouseId: sourceWarehouseId, code: 'MAIN', name: 'Source Main', isDefault: true, createdBy: actorId },
      { id: locationId, warehouseId, code: 'MAIN', name: 'Treatment Main', isDefault: true, createdBy: actorId },
    ] });
    await prisma.inventoryItem.create({
      data: {
        id: sourceInventoryItemId,
        masterProductId: productId,
        branchId: sourceBranchId,
        warehouseId: sourceWarehouseId,
        stockLocationId: sourceLocationId,
        stock: 0,
      },
    });
    await receiveInventory(actorId, {
      idempotencyKey: `TC-RECEIPT-OLD-${runId}`,
      branchId: sourceBranchId,
      inventoryItemId: sourceInventoryItemId,
      stockLocationId: sourceLocationId,
      quantity: '1',
      unitCost: '100',
      currency: 'IDR',
      sourceType: 'TEST_SETUP',
      sourceId: `OLD-${runId}`,
      reasonCode: 'TEST_SETUP',
      occurredAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    await receiveInventory(actorId, {
      idempotencyKey: `TC-RECEIPT-NEW-${runId}`,
      branchId: sourceBranchId,
      inventoryItemId: sourceInventoryItemId,
      stockLocationId: sourceLocationId,
      quantity: '2',
      unitCost: '200',
      currency: 'IDR',
      sourceType: 'TEST_SETUP',
      sourceId: `NEW-${runId}`,
      reasonCode: 'TEST_SETUP',
      occurredAt: new Date('2026-07-02T00:00:00.000Z'),
    });
    await prisma.stockRequest.create({
      data: {
        id: stockRequestId,
        requestCode: `TC-REQ-${runId}`,
        branchId,
        sourceBranchId,
        requestedBy: actorId,
        status: 'APPROVED',
        items: {
          create: {
            id: stockRequestItemId,
            masterProductId: productId,
            inventoryItemId: sourceInventoryItemId,
            requestedQty: '3',
            approvedQty: '3',
            finalQty: '3',
          },
        },
      },
    });
    await prisma.shipment.create({
      data: {
        id: shipmentId,
        shipmentCode: `TC-SHP-${runId}`,
        stockRequestId,
        fromBranchId: sourceBranchId,
        toBranchId: branchId,
        status: 'PREPARING',
        items: { create: { id: shipmentItemId, masterProductId: productId, sentQty: '3', requestedQty: '3' } },
      },
    });
    const dispatches = await Promise.all([
      logistics.shipBranchShipment(logisticsActor, shipmentId, { notes: 'Sprint 11 E2E dispatch' }),
      logistics.shipBranchShipment(logisticsActor, shipmentId, { notes: 'Sprint 11 E2E dispatch' }),
    ]);
    expect(dispatches).toHaveLength(2);
    const receipts = await Promise.all([
      logistics.receiveBranchShipment(logisticsActor, shipmentId, { notes: 'Sprint 11 E2E receipt', receivedItems: [{ masterProductId: productId, receivedQty: 3 }] }),
      logistics.receiveBranchShipment(logisticsActor, shipmentId, { notes: 'Sprint 11 E2E receipt', receivedItems: [{ masterProductId: productId, receivedQty: 3 }] }),
    ]);
    expect(receipts).toHaveLength(2);
    inventoryItemId = (await prisma.inventoryItem.findUniqueOrThrow({
      where: { masterProductId_branchId: { masterProductId: productId, branchId } },
    })).id;
    expect(await prisma.inventoryPosting.count({ where: { sourceId: shipmentId } })).toBe(2);
    expect((await prisma.internalTransferLedger.findUniqueOrThrow({ where: { shipmentId } })).totalValue.toFixed(4)).toBe('500.0000');
    await prisma.packagePricing.create({
      data: {
        id: pricingId,
        branchId,
        packageType: PackageType.BASIC,
        productCode: `PKG-${runId}`,
        name: `Treatment Package ${runId}`,
        totalSessions: 1,
        price: '1000000',
      },
    });
    await prisma.memberPackage.create({
      data: {
        id: memberPackageId,
        packageCode: `MP-${runId}`,
        memberId,
        branchId,
        packagePricingId: pricingId,
        packageType: PackageType.BASIC,
        productCode: `PKG-${runId}`,
        totalSessions: 1,
        usedSessions: 1,
        finalPrice: '1000000',
        totalVerifiedPaid: '1000000',
        status: PackageStatus.EXPIRED,
        assignedBy: actorId,
      },
    });
    await prisma.packageBenefitValuation.create({
      data: {
        id: valuationId,
        memberPackageId,
        standaloneBenefitValue: '1000000',
        allocatedConsideration: '1000000',
        totalSessions: 1,
        regularSessionRevenue: '1000000',
        finalSessionRevenue: '1000000',
        allocationSnapshot: { source: 'SPRINT_8_INTEGRATION_TEST' },
      },
    });
    await prisma.packageRevenueContract.create({
      data: {
        id: contractId,
        memberPackageId,
        valuationId,
        branchId,
        totalConsideration: '1000000',
        fundedDeferredAmount: '1000000',
        remainingDeferredAmount: '1000000',
        status: 'ACTIVE',
      },
    });
    await prisma.deferredRevenueMovement.create({
      data: {
        movementKey: `TEST_FUNDING:${runId}`,
        contractId,
        memberPackageId,
        type: 'FUNDING',
        amount: '1000000',
        occurredAt: new Date('2026-07-10T00:00:00.000Z'),
      },
    });
    await prisma.encounter.create({
      data: {
        id: encounterId,
        encounterCode: `ENC-${runId}`,
        memberId,
        branchId,
        memberPackageId,
        adminLayananId: actorId,
        doctorId: actorId,
        nurseId: actorId,
      },
    });
    await prisma.treatmentSession.create({
      data: {
        id: sessionId,
        sessionCode: `SES-${runId}`,
        encounterId,
        branchId,
        infusKe: 1,
        branchInfusKe: 1,
        pelaksanaan: SessionType.ON_SITE,
        treatmentDate: new Date('2026-07-20T00:00:00.000Z'),
        adminLayananId: actorId,
        doctorId: actorId,
        nurseId: actorId,
      },
    });
    await prisma.therapyPlan.create({
      data: {
        id: therapyPlanId,
        planCode: `PLAN-${runId}`,
        memberId,
        treatmentSessionId: sessionId,
        ifa250: '1',
      },
    });
    await prisma.vitalSign.createMany({ data: [
      {
        treatmentSessionId: sessionId,
        pencatatan: VitalType.SISTOL,
        waktuCatat: VitalTiming.SEBELUM,
        value: '120',
        unit: 'mmHg',
        recordedBy: actorId,
      },
      {
        treatmentSessionId: sessionId,
        pencatatan: VitalType.SISTOL,
        waktuCatat: VitalTiming.SESUDAH,
        value: '118',
        unit: 'mmHg',
        recordedBy: actorId,
      },
    ] });
    await prisma.infusionExecution.create({
      data: { treatmentSessionId: sessionId, therapyPlanId, ifa250: '1' },
    });
    await prisma.doctorEvaluation.create({
      data: {
        evaluationCode: `EVAL-${runId}`,
        treatmentSessionId: sessionId,
        assessment: 'Stable after treatment',
        writtenBy: actorId,
      },
    });
    await prisma.treatmentBom.create({
      data: {
        id: bomId,
        bomCode: `BOM-${runId}-V1`,
        packagePricingId: pricingId,
        branchId,
        branchScopeKey: branchId,
        version: 1,
        status: TreatmentBomStatus.ACTIVE,
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        createdBy: actorId,
        activatedBy: actorId,
        activatedAt: new Date('2026-07-01T00:00:00.000Z'),
        items: {
          create: {
            id: bomItemId,
            masterProductId: productId,
            recommendedQuantity: '1.5',
            unitSnapshot: 'unit',
            tolerancePercent: '0',
            isRequired: true,
            sortOrder: 0,
          },
        },
      },
    });
    await prisma.materialUsage.create({
      data: {
        id: materialUsageId,
        usageKey: `${sessionId}:${inventoryItemId}`,
        treatmentSessionId: sessionId,
        inventoryItemId,
        treatmentBomItemId: bomItemId,
        quantity: '1.5',
        unit: 'unit',
        baseQuantity: '1.5',
        recommendedQuantity: '1.5',
        status: MaterialUsageStatus.DRAFT,
        recordedBy: actorId,
      },
    });
  }, 60_000);

  afterAll(async () => {
    const testBranchIds = [sourceBranchId, branchId];
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId: { in: testBranchIds } }] } });
    await prisma.integrationEvent.deleteMany({ where: { aggregateId: sessionId } });
    await prisma.deferredRevenueMovement.deleteMany({ where: { memberPackageId } });
    await prisma.revenueRecognition.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.domainEvent.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.materialUsage.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.doctorEvaluation.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.vitalSign.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.infusionExecution.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.therapyPlan.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.treatmentSession.deleteMany({ where: { id: sessionId } });
    await prisma.encounter.deleteMany({ where: { id: encounterId } });
    await prisma.treatmentBomItem.deleteMany({ where: { treatmentBomId: bomId } });
    await prisma.treatmentBom.deleteMany({ where: { id: bomId } });
    await prisma.packageRevenueContract.deleteMany({ where: { id: contractId } });
    await prisma.packageBenefitValuation.deleteMany({ where: { id: valuationId } });
    await prisma.memberPackage.deleteMany({ where: { id: memberPackageId } });
    await prisma.packagePricing.deleteMany({ where: { id: pricingId } });
    await prisma.logisticStockTransactionItem.deleteMany({ where: { transaction: { referenceId: shipmentId } } });
    await prisma.logisticStockTransaction.deleteMany({ where: { referenceId: shipmentId } });
    await prisma.internalTransferLedger.deleteMany({ where: { shipmentId } });
    await prisma.inventoryCostAllocation.deleteMany({ where: { posting: { branchId: { in: testBranchIds } } } });
    await prisma.stockMutation.deleteMany({ where: { inventoryItem: { branchId: { in: testBranchIds } } } });
    await prisma.shipmentTransferLayer.deleteMany({ where: { shipmentItem: { shipmentId } } });
    await prisma.inventoryCostLayer.deleteMany({ where: { inventoryBalance: { branchId: { in: testBranchIds } } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId: { in: testBranchIds } } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId: { in: testBranchIds } } });
    await prisma.shipment.deleteMany({ where: { id: shipmentId } });
    await prisma.stockRequestItem.deleteMany({ where: { id: stockRequestItemId } });
    await prisma.stockRequest.deleteMany({ where: { id: stockRequestId } });
    const journalIds = (await prisma.journalEntry.findMany({ where: { branchId: { in: testBranchIds } }, select: { id: true } })).map((row) => row.id);
    await prisma.journalSourceLink.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    await prisma.journalSequence.deleteMany({ where: { scopeKey: { in: testBranchIds } } });
    await prisma.accountingPeriod.deleteMany({ where: { id: { in: [sourceAccountingPeriodId, accountingPeriodId] } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: [sourceInventoryItemId, inventoryItemId] } } });
    await prisma.stockLocation.deleteMany({ where: { id: { in: [sourceLocationId, locationId] } } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [sourceWarehouseId, warehouseId] } } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, actorId] } } });
    await prisma.branch.deleteMany({ where: { id: { in: testBranchIds } } });
    await prisma.$disconnect();
  }, 45_000);

  it('rolls back on journal failure, then posts and reverses the atomic completion exactly once', async () => {
    const journalCountBefore = await prisma.journalEntry.count({ where: { branchId } });
    await prisma.packageRevenueContract.update({
      where: { id: contractId },
      data: { fundedDeferredAmount: '999999.99', remainingDeferredAmount: '999999.99' },
    });
    await expect(service.completeSession(sessionId, actorId)).rejects.toMatchObject({
      code: 'TREATMENT_DEFERRED_REVENUE_INSUFFICIENT',
    });
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } })).stock.toFixed(4)).toBe('3.0000');
    expect(await prisma.inventoryPosting.count({ where: { sourceType: 'TREATMENT_SESSION', sourceId: sessionId } })).toBe(0);
    await prisma.packageRevenueContract.update({
      where: { id: contractId },
      data: { fundedDeferredAmount: '1000000', remainingDeferredAmount: '1000000' },
    });

    await prisma.accountingPeriod.update({ where: { id: accountingPeriodId }, data: { status: 'CLOSED' } });
    await expect(service.completeSession(sessionId, actorId)).rejects.toMatchObject({
      code: 'ACCOUNTING_PERIOD_CLOSED',
    });
    expect((await prisma.treatmentSession.findUniqueOrThrow({ where: { id: sessionId } })).isCompleted).toBe(false);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } })).stock.toFixed(4)).toBe('3.0000');
    expect(await prisma.inventoryPosting.count({ where: { sourceType: 'TREATMENT_SESSION', sourceId: sessionId } })).toBe(0);
    expect(await prisma.domainEvent.count({ where: { eventKey: `TREATMENT_COMPLETED:${sessionId}` } })).toBe(0);
    expect(await prisma.revenueRecognition.count({ where: { treatmentSessionId: sessionId } })).toBe(0);
    expect(await prisma.journalEntry.count({ where: { branchId } })).toBe(journalCountBefore);
    await prisma.accountingPeriod.update({ where: { id: accountingPeriodId }, data: { status: 'OPEN' } });

    const results = await Promise.all([
      service.completeSession(sessionId, actorId),
      service.completeSession(sessionId, actorId),
    ]);

    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(await prisma.inventoryPosting.count({ where: { sourceType: 'TREATMENT_SESSION', sourceId: sessionId } })).toBe(1);
    expect(await prisma.integrationEvent.count({ where: { eventType: 'TREATMENT_COMPLETED', aggregateId: sessionId } })).toBe(1);
    expect(await prisma.domainEvent.count({ where: { eventKey: `TREATMENT_COMPLETED:${sessionId}` } })).toBe(1);
    expect(await prisma.revenueRecognition.count({ where: { treatmentSessionId: sessionId, status: 'POSTED' } })).toBe(1);

    const usage = await prisma.materialUsage.findUniqueOrThrow({ where: { id: materialUsageId } });
    expect(usage.status).toBe(MaterialUsageStatus.CONSUMED);
    expect(usage.totalActualCost?.toFixed(4)).toBe('200.0000');
    expect(usage.actualUnitCost?.toFixed(4)).toBe('133.3333');

    const allocations = await prisma.inventoryCostAllocation.findMany({
      where: { postingId: usage.inventoryPostingId! },
      include: { costLayer: true },
      orderBy: { costLayer: { receivedAt: 'asc' } },
    });
    expect(allocations.map((allocation) => ({
      quantity: allocation.quantity.toFixed(4),
      unitCost: allocation.unitCost.toFixed(4),
    }))).toEqual([
      { quantity: '1.0000', unitCost: '100.0000' },
      { quantity: '0.5000', unitCost: '200.0000' },
    ]);
    const activeLayerValue = (await prisma.inventoryCostLayer.findMany({
      where: { inventoryBalance: { branchId: { in: [sourceBranchId, branchId] } }, isVoided: false },
    })).reduce((sum, layer) => sum.add(layer.remainingQty.mul(layer.unitCost || 0)), usage.totalActualCost!.mul(0));
    expect(activeLayerValue.toFixed(4)).toBe('300.0000');
    expect(await prisma.journalLine.count({
      where: { journalEntry: { postingKey: { contains: shipmentId } }, account: { type: { not: 'ASSET' } } },
    })).toBe(0);

    const balance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(balance.onHandQty.toFixed(4)).toBe('1.5000');
    const event = await prisma.integrationEvent.findUniqueOrThrow({
      where: { eventType_aggregateId: { eventType: 'TREATMENT_COMPLETED', aggregateId: sessionId } },
    });
    expect(event.status).toBe('PENDING');
    expect((event.payload as any).eventVersion).toBe(3);
    expect((event.payload as any).session).toMatchObject({
      revenueSourceType: 'BASIC',
      revenuePackageId: memberPackageId,
    });
    expect((event.payload as any).finance).toEqual({
      revenueRecognitionStatus: 'POSTED',
      recognizedRevenue: '1000000.00',
      materialCost: '200.00',
      hppAmount: '200.00',
      grossProfit: '999800.00',
      journalEntryId: results[0].journalEntryId,
      recognitions: [expect.objectContaining({
        memberPackageId,
        sourceType: 'BASIC',
        amount: '1000000.00',
        sessionOrdinal: 1,
        deferredRevenueAccountCode: '2200',
        revenueAccountCode: '4100',
      })],
    });
    expect(await prisma.journalEntry.count({ where: { branchId } })).toBe(journalCountBefore + 1);
    const completionJournal = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: results[0].journalEntryId! },
      include: { lines: { include: { account: true } } },
    });
    expect(completionJournal.totalDebit.toFixed(2)).toBe('1000200.00');
    expect(completionJournal.totalCredit.toFixed(2)).toBe('1000200.00');
    expect(Object.fromEntries(completionJournal.lines.map((line) => [line.account.code, {
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
    }]))).toEqual({
      '2200': { debit: '1000000.00', credit: '0.00' },
      '4100': { debit: '0.00', credit: '1000000.00' },
      '5100': { debit: '200.00', credit: '0.00' },
      '1300': { debit: '0.00', credit: '200.00' },
    });
    const recognizedContract = await prisma.packageRevenueContract.findUniqueOrThrow({ where: { id: contractId } });
    expect(recognizedContract.status).toBe('FULLY_RECOGNIZED');
    expect(recognizedContract.remainingDeferredAmount.toFixed(2)).toBe('0.00');

    const cancellationKey = `cancel-${runId}`;
    const cancellations = await Promise.all([
      service.cancelCompletion(sessionId, actorId, { idempotencyKey: cancellationKey, reason: 'Treatment completion entered in error' }),
      service.cancelCompletion(sessionId, actorId, { idempotencyKey: cancellationKey, reason: 'Treatment completion entered in error' }),
    ]);
    expect(cancellations.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(await prisma.inventoryPosting.count({ where: { reversalOfId: usage.inventoryPostingId! } })).toBe(1);
    expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } })).stock.toFixed(4)).toBe('3.0000');
    expect((await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } })).onHandQty.toFixed(4)).toBe('3.0000');
    const restoredLayers = await prisma.inventoryCostLayer.findMany({
      where: { inventoryBalance: { inventoryItemId } },
      orderBy: { receivedAt: 'asc' },
    });
    expect(restoredLayers.map((layer) => layer.remainingQty.toFixed(4))).toEqual(['1.0000', '2.0000']);
    const restoredAssetValue = (await prisma.inventoryCostLayer.findMany({
      where: { inventoryBalance: { branchId: { in: [sourceBranchId, branchId] } }, isVoided: false },
    })).reduce((sum, layer) => sum.add(layer.remainingQty.mul(layer.unitCost || 0)), restoredLayers[0].remainingQty.mul(0));
    expect(restoredAssetValue.toFixed(4)).toBe('500.0000');
    expect((await prisma.materialUsage.findUniqueOrThrow({ where: { id: materialUsageId } })).status).toBe('REVERSED');
    expect((await prisma.revenueRecognition.findFirstOrThrow({ where: { treatmentSessionId: sessionId } })).status).toBe('REVERSED');
    const releasedContract = await prisma.packageRevenueContract.findUniqueOrThrow({ where: { id: contractId } });
    expect(releasedContract.status).toBe('ACTIVE');
    expect(releasedContract.recognizedAmount.toFixed(2)).toBe('0.00');
    expect(releasedContract.remainingDeferredAmount.toFixed(2)).toBe('1000000.00');
    const cancelledSession = await prisma.treatmentSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(cancelledSession.completionStatus).toBe('CANCELLED');
    expect(cancelledSession.cancellationJournalEntryId).toBeTruthy();
    expect(await prisma.journalEntry.count({ where: { branchId } })).toBe(journalCountBefore + 2);
    expect((await prisma.journalEntry.findUniqueOrThrow({ where: { id: completionJournal.id } })).status).toBe('REVERSED');
    expect(await prisma.memberPackage.findUniqueOrThrow({ where: { id: memberPackageId } })).toMatchObject({
      usedSessions: 0,
      status: 'ACTIVE',
    });
    expect(await prisma.integrationEvent.count({
      where: { eventType: 'TREATMENT_COMPLETION_CANCELLED', aggregateId: sessionId },
    })).toBe(1);
  }, 60_000);
});
