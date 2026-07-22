import { randomUUID } from 'crypto';
import {
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
import { receiveInventory } from '@modules/inventory/services/inventory-ledger.service';
import { SessionCompletionService } from '../session-completion.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('treatment completion FIFO integration', () => {
  const runId = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `treat_actor_${runId}`;
  const memberUserId = `treat_member_user_${runId}`;
  const memberId = `treat_member_${runId}`;
  const branchId = `treat_branch_${runId}`;
  const warehouseId = `treat_wh_${runId}`;
  const locationId = `treat_loc_${runId}`;
  const uomId = `treat_uom_${runId}`;
  const productId = `treat_product_${runId}`;
  const inventoryItemId = `treat_item_${runId}`;
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
  const periodId = `treat_period_${runId}`;
  const service = new SessionCompletionService();

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: actorId, email: `treatment-${runId}@example.test`, password: 'test-only', role: Role.SUPER_ADMIN },
    });
    await prisma.branch.create({
      data: { id: branchId, branchCode: `TC${runId.slice(0, 6)}`, name: `Treatment Completion ${runId}` },
    });
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
      idempotencyKey: `TC-RECEIPT-OLD-${runId}`,
      branchId,
      inventoryItemId,
      stockLocationId: locationId,
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
      branchId,
      inventoryItemId,
      stockLocationId: locationId,
      quantity: '2',
      unitCost: '200',
      currency: 'IDR',
      sourceType: 'TEST_SETUP',
      sourceId: `NEW-${runId}`,
      reasonCode: 'TEST_SETUP',
      occurredAt: new Date('2026-07-02T00:00:00.000Z'),
    });
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
        finalPrice: '1000000',
        status: PackageStatus.ACTIVE,
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
        deferredRevenueAccountCode: '2200',
        revenueAccountCode: '4100',
        allocationSnapshot: { testRun: runId },
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
    await prisma.accountingPeriod.create({
      data: {
        id: periodId,
        name: `July 2026 ${runId}`,
        fiscalYear: 2026,
        periodNo: 7,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-31T23:59:59.999Z'),
        branchId,
        scopeKey: branchId,
        createdBy: actorId,
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
  }, 45_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId }] } });
    await prisma.integrationEvent.deleteMany({ where: { aggregateId: sessionId } });
    await prisma.deferredRevenueMovement.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.revenueRecognition.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.domainEvent.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.materialUsage.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.doctorEvaluation.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.vitalSign.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.infusionExecution.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.therapyPlan.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.treatmentSession.deleteMany({ where: { id: sessionId } });
    await prisma.journalSourceLink.deleteMany({ where: { journalEntry: { branchId } } });
    await prisma.journalLine.deleteMany({ where: { journalEntry: { branchId } } });
    await prisma.journalEntry.deleteMany({ where: { branchId } });
    await prisma.journalSequence.deleteMany({ where: { scopeKey: branchId } });
    await prisma.accountingPeriod.deleteMany({ where: { id: periodId } });
    await prisma.encounter.deleteMany({ where: { id: encounterId } });
    await prisma.treatmentBomItem.deleteMany({ where: { treatmentBomId: bomId } });
    await prisma.treatmentBom.deleteMany({ where: { id: bomId } });
    await prisma.packageRevenueContract.deleteMany({ where: { id: contractId } });
    await prisma.packageBenefitValuation.deleteMany({ where: { id: valuationId } });
    await prisma.memberPackage.deleteMany({ where: { id: memberPackageId } });
    await prisma.packagePricing.deleteMany({ where: { id: pricingId } });
    await prisma.inventoryCostAllocation.deleteMany({ where: { posting: { branchId } } });
    await prisma.stockMutation.deleteMany({ where: { inventoryItemId } });
    await prisma.inventoryCostLayer.deleteMany({ where: { inventoryBalance: { branchId } } });
    await prisma.inventoryBalance.deleteMany({ where: { branchId } });
    await prisma.inventoryPosting.deleteMany({ where: { branchId } });
    await prisma.inventoryItem.deleteMany({ where: { id: inventoryItemId } });
    await prisma.stockLocation.deleteMany({ where: { id: locationId } });
    await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.unitOfMeasure.deleteMany({ where: { id: uomId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, actorId] } } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.$disconnect();
  }, 45_000);

  it('consumes FIFO and posts revenue/HPP once under concurrent completion', async () => {
    const journalCountBefore = await prisma.journalEntry.count({ where: { branchId } });
    const results = await Promise.all([
      service.completeSession(sessionId, actorId),
      service.completeSession(sessionId, actorId),
    ]);

    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    expect(await prisma.inventoryPosting.count({ where: { sourceType: 'TREATMENT_SESSION', sourceId: sessionId } })).toBe(1);
    expect(await prisma.integrationEvent.count({ where: { eventType: 'TREATMENT_COMPLETED', aggregateId: sessionId } })).toBe(1);
    expect(await prisma.domainEvent.count({ where: { eventKey: `TREATMENT_COMPLETED:${sessionId}` } })).toBe(1);

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

    const balance = await prisma.inventoryBalance.findFirstOrThrow({ where: { inventoryItemId } });
    expect(balance.onHandQty.toFixed(4)).toBe('1.5000');
    const event = await prisma.integrationEvent.findUniqueOrThrow({
      where: { eventType_aggregateId: { eventType: 'TREATMENT_COMPLETED', aggregateId: sessionId } },
    });
    expect(event.status).toBe('PROCESSED');
    expect((event.payload as any).finance).toEqual({
      revenueRecognitionStatus: 'POSTED',
      recognizedRevenue: '1000000.00',
      hppAmount: '200.00',
      grossProfit: '999800.00',
      journalEntryId: expect.any(String),
    });
    expect(await prisma.journalEntry.count({ where: { branchId } })).toBe(journalCountBefore + 1);
    const completed = await prisma.treatmentSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(completed.recognizedRevenue?.toFixed(2)).toBe('1000000.00');
    expect(completed.hppAmount?.toFixed(2)).toBe('200.00');
    expect(completed.grossProfit?.toFixed(2)).toBe('999800.00');
    expect(await prisma.revenueRecognition.count({ where: { treatmentSessionId: sessionId, status: 'POSTED' } })).toBe(1);
  }, 60_000);
});
