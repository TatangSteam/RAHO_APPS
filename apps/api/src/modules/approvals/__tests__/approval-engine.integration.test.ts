import { randomUUID } from 'crypto';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { decideApprovalInTransaction, submitApprovalInTransaction } from '../approval.service';

const describeDatabase = process.env.RUN_INVENTORY_DB_TESTS === 'true' ? describe : describe.skip;

describeDatabase('Sprint 9 approval engine', () => {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 14);
  const branchId = `apr_branch_${suffix}`;
  const makerId = `apr_maker_${suffix}`;
  const managerId = `apr_manager_${suffix}`;
  const superAdminId = `apr_super_${suffix}`;
  const subjectType = `SPRINT9_${suffix}`.toUpperCase();
  const subjectId = `subject_${suffix}`;

  beforeAll(async () => {
    await prisma.branch.create({ data: { id: branchId, branchCode: `AP${suffix.slice(0, 7)}`, name: `Approval ${suffix}` } });
    await prisma.user.createMany({ data: [
      { id: makerId, email: `apr-maker-${suffix}@test.local`, password: 'test', role: Role.ADMIN_LOGISTIK },
      { id: managerId, email: `apr-manager-${suffix}@test.local`, password: 'test', role: Role.ADMIN_MANAGER },
      { id: superAdminId, email: `apr-super-${suffix}@test.local`, password: 'test', role: Role.SUPER_ADMIN },
    ] });
    await prisma.managerBranch.create({ data: { userId: managerId, branchId } });
    await prisma.staffBranch.create({ data: { userId: makerId, branchId } });
    await prisma.approvalRule.create({ data: {
      ruleCode: `APR-${suffix}`,
      name: `Sprint 9 approval ${suffix}`,
      module: subjectType,
      transactionType: 'ADJUSTMENT',
      branchScopeKey: branchId,
      minAmount: 0,
      priority: 999,
      createdBy: superAdminId,
      steps: { create: [
        { stepNo: 1, name: 'Manager approval', permissionCode: 'INVENTORY.ADJUSTMENT.APPROVE' },
        { stepNo: 2, name: 'Final approval', permissionCode: 'INVENTORY.ADJUSTMENT.APPROVE' },
      ] },
    } });
  });

  afterAll(async () => {
    // Approval audit records are intentionally append-only, including in DB tests.
    await prisma.$disconnect();
  });

  it('enforces maker-checker and completes a role-based two-step approval', async () => {
    const submitted = await prisma.$transaction((tx) => submitApprovalInTransaction(tx, {
      subjectType, subjectId, branchId, makerId,
      amount: new Prisma.Decimal(200), transactionType: 'ADJUSTMENT', category: 'OTHER',
    }));
    expect(submitted.currentStep).toBe(1);
    expect((submitted.ruleSnapshot as { steps: unknown[] }).steps).toHaveLength(2);

    await expect(prisma.$transaction((tx) => decideApprovalInTransaction(tx, {
      subjectType, subjectId, actorUserId: makerId, decision: 'APPROVE', note: 'Self approval',
    }))).rejects.toMatchObject({ status: 403 });

    const first = await prisma.$transaction((tx) => decideApprovalInTransaction(tx, {
      subjectType, subjectId, actorUserId: managerId, decision: 'APPROVE', note: 'Manager approved',
    }));
    expect(first.status).toBe('PENDING');
    expect(first.currentStep).toBe(2);

    const final = await prisma.$transaction((tx) => decideApprovalInTransaction(tx, {
      subjectType, subjectId, actorUserId: superAdminId, decision: 'APPROVE', note: 'Final approval',
    }));
    expect(final.status).toBe('APPROVED');
    expect(await prisma.approvalDecision.count({ where: { approvalInstanceId: final.id } })).toBe(2);
    expect(await prisma.approvalAuditLog.count({ where: { approvalInstanceId: final.id } })).toBe(3);
  });
});
