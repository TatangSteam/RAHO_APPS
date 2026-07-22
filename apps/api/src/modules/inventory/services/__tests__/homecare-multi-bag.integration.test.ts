import { randomUUID } from 'crypto';
import { PackageStatus, PackageType, ProductCategory, Role, SessionType } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { completeMultiBagUsage } from '../inventory-discrepancy-homecare.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Sprint 9 homecare multi-bag completion', () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 14);
  const actorId = `hmb_actor_${suffix}`;
  const memberUserId = `hmb_member_user_${suffix}`;
  const memberId = `hmb_member_${suffix}`;
  const branchId = `hmb_branch_${suffix}`;
  const productId = `hmb_product_${suffix}`;
  const packageId = `hmb_package_${suffix}`;
  const encounterId = `hmb_encounter_${suffix}`;
  const sessionId = `hmb_session_${suffix}`;
  const teamId = `hmb_team_${suffix}`;
  const bagIds = [`hmb_bag_a_${suffix}`, `hmb_bag_b_${suffix}`];

  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: actorId, email: `hmb-actor-${suffix}@test.local`, password: 'test', role: Role.SUPER_ADMIN },
      { id: memberUserId, email: `hmb-member-${suffix}@test.local`, password: 'test', role: Role.MEMBER },
    ] });
    await prisma.branch.create({ data: { id: branchId, branchCode: `HM${suffix.slice(0, 7)}`, name: `Homecare ${suffix}` } });
    await prisma.member.create({ data: {
      id: memberId, userId: memberUserId, memberNo: `HMB-${suffix}`, registrationBranchId: branchId,
    } });
    await prisma.memberPackage.create({ data: {
      id: packageId, packageCode: `HMB-PKG-${suffix}`, memberId, branchId,
      packageType: PackageType.BASIC, totalSessions: 1, finalPrice: 0,
      status: PackageStatus.ACTIVE, assignedBy: actorId,
    } });
    await prisma.encounter.create({ data: {
      id: encounterId, encounterCode: `HMB-ENC-${suffix}`, memberId, branchId,
      memberPackageId: packageId, adminLayananId: actorId, doctorId: actorId, nurseId: actorId,
    } });
    await prisma.treatmentSession.create({ data: {
      id: sessionId, sessionCode: `HMB-SES-${suffix}`, encounterId, branchId,
      infusKe: 1, branchInfusKe: 1, pelaksanaan: SessionType.HOME_CARE,
      treatmentDate: new Date('2026-07-22T08:00:00.000Z'),
      adminLayananId: actorId, doctorId: actorId, nurseId: actorId,
    } });
    await prisma.masterProduct.create({ data: {
      id: productId, sku: `HMB-${suffix}`, name: `Homecare Material ${suffix}`,
      category: ProductCategory.CONSUMABLE, unit: 'unit', baseUnit: 'unit', usageUnit: 'unit', conversionFactor: '1',
    } });
    await prisma.homecareTeam.create({ data: {
      id: teamId, teamCode: `HMB-T-${suffix}`, name: `Homecare Team ${suffix}`, branchId, createdBy: actorId,
    } });
    await prisma.homecareBag.createMany({ data: bagIds.map((id, index) => ({
      id, bagCode: `HMB-B${index + 1}-${suffix}`, name: `Bag ${index + 1}`, teamId, branchId, createdBy: actorId,
    })) });
    await prisma.homecareBagStock.createMany({ data: [
      { bagId: bagIds[0], masterProductId: productId, stock: '5' },
      { bagId: bagIds[1], masterProductId: productId, stock: '7' },
    ] });
  }, 30_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: actorId }, { branchId }] } });
    await prisma.logisticStockMutation.deleteMany({ where: { referenceType: 'HOMECARE_MULTI_BAG_USAGE', createdBy: actorId } });
    await prisma.homecareBagUsageItem.deleteMany({ where: { usage: { treatmentSessionId: sessionId } } });
    await prisma.homecareBagUsage.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.homecareMultiBagUsage.deleteMany({ where: { treatmentSessionId: sessionId } });
    await prisma.homecareBagStock.deleteMany({ where: { bagId: { in: bagIds } } });
    await prisma.homecareBag.deleteMany({ where: { id: { in: bagIds } } });
    await prisma.homecareTeam.deleteMany({ where: { id: teamId } });
    await prisma.treatmentSession.deleteMany({ where: { id: sessionId } });
    await prisma.encounter.deleteMany({ where: { id: encounterId } });
    await prisma.memberPackage.deleteMany({ where: { id: packageId } });
    await prisma.member.deleteMany({ where: { id: memberId } });
    await prisma.masterProduct.deleteMany({ where: { id: productId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, memberUserId] } } });
    await prisma.$disconnect();
  }, 30_000);

  it('deducts multiple bags once under concurrent duplicate completion without posting revenue', async () => {
    const input = {
      idempotencyKey: `HMB-COMPLETE-${suffix}`,
      treatmentSessionId: sessionId,
      teamId,
      branchId,
      usageDate: new Date('2026-07-22T09:00:00.000Z'),
      notes: 'Pemakaian aktual dua tas homecare',
      bags: [
        { bagId: bagIds[0], items: [{ masterProductId: productId, quantity: '2', unit: 'unit' }] },
        { bagId: bagIds[1], items: [{ masterProductId: productId, quantity: '3', unit: 'unit' }] },
      ],
    };
    const results = await Promise.all([
      completeMultiBagUsage(actorId, input),
      completeMultiBagUsage(actorId, input),
    ]);

    expect(results[0].completion.id).toBe(results[1].completion.id);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(1);
    const [stocks, usages, mutations, revenues] = await Promise.all([
      prisma.homecareBagStock.findMany({ where: { bagId: { in: bagIds } }, orderBy: { bagId: 'asc' } }),
      prisma.homecareBagUsage.findMany({ where: { treatmentSessionId: sessionId } }),
      prisma.logisticStockMutation.findMany({ where: { referenceType: 'HOMECARE_MULTI_BAG_USAGE', referenceId: results[0].completion.id } }),
      prisma.revenueRecognition.count({ where: { treatmentSessionId: sessionId } }),
    ]);
    expect(stocks.map((stock) => stock.stock.toFixed(4)).sort()).toEqual(['3.0000', '4.0000']);
    expect(usages).toHaveLength(2);
    expect(mutations).toHaveLength(2);
    expect(revenues).toBe(0);

    await expect(completeMultiBagUsage(actorId, { ...input, idempotencyKey: `HMB-OTHER-${suffix}` }))
      .rejects.toMatchObject({ code: 'HOMECARE_SESSION_ALREADY_COMPLETED' });
  }, 60_000);
});
