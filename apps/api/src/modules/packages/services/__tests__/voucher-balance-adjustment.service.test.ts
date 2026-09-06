import { AdminManagerAccessScope, PackageStatus, PackageType, Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { assertBranchAccess, assertPermission } from '@modules/iam/authorization.service';
import { logAudit } from '@utils/auditLog';
import { VoucherBalanceAdjustmentService } from '../voucher-balance-adjustment.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    memberPackage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    packageBenefitValuation: {
      update: jest.fn(),
    },
    managerBranch: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  assertBranchAccess: jest.fn(),
  assertPermission: jest.fn(),
}));

jest.mock('@utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

type MockPrisma = {
  $transaction: jest.Mock;
  memberPackage: { findUnique: jest.Mock; update: jest.Mock };
  packageBenefitValuation: { update: jest.Mock };
  managerBranch: { findUnique: jest.Mock };
};

const mockPrisma = prisma as unknown as MockPrisma;

const basePackage = {
  id: 'package-1',
  packageCode: 'PKG-BASIC-001',
  branchId: 'branch-1',
  packageType: PackageType.BASIC,
  status: PackageStatus.ACTIVE,
  totalSessions: 10,
  usedSessions: 2,
  benefitValuation: null,
};

describe('VoucherBalanceAdjustmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: (transaction: MockPrisma) => unknown) =>
      callback(mockPrisma),
    );
    mockPrisma.memberPackage.findUnique
      .mockResolvedValueOnce({ branchId: 'branch-1' })
      .mockResolvedValueOnce(basePackage);
    mockPrisma.memberPackage.update.mockResolvedValue({
      ...basePackage,
      totalSessions: 7,
    });
  });

  it('preserves used sessions and replaces only the remaining BASIC balance', async () => {
    const service = new VoucherBalanceAdjustmentService();

    const result = await service.adjustVoucherBalance(
      'package-1',
      { remainingSessions: 5, reason: 'Koreksi saldo voucher' },
      'admin-1',
      'SUPER_ADMIN',
    );

    expect(assertBranchAccess).toHaveBeenCalledWith('admin-1', 'branch-1');
    expect(assertPermission).toHaveBeenCalledWith('admin-1', 'INVOICE.UPDATE', 'branch-1');
    expect(mockPrisma.memberPackage.update).toHaveBeenCalledWith({
      where: { id: 'package-1' },
      data: { totalSessions: 7 },
    });
    expect(result).toMatchObject({ usedSessions: 2, remainingSessions: 5, totalSessions: 7 });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'MemberPackage',
      resourceId: 'package-1',
      meta: expect.objectContaining({ reason: 'Koreksi saldo voucher' }),
    }));
  });

  it('recalculates future revenue using the unrecognized balance', async () => {
    const valuation = {
      id: 'valuation-1',
      allocatedConsideration: new Prisma.Decimal(1200),
      contract: {
        recognizedSessions: 1,
        remainingDeferredAmount: new Prisma.Decimal(900),
      },
    };
    mockPrisma.memberPackage.findUnique
      .mockReset()
      .mockResolvedValueOnce({ branchId: 'branch-1' })
      .mockResolvedValueOnce({ ...basePackage, benefitValuation: valuation });
    mockPrisma.memberPackage.update.mockResolvedValue({ ...basePackage, totalSessions: 4 });
    const service = new VoucherBalanceAdjustmentService();

    await service.adjustVoucherBalance(
      'package-1',
      { remainingSessions: 2, reason: 'Koreksi saldo voucher' },
      'admin-1',
      'ADMIN_MANAGER',
    );

    expect(mockPrisma.packageBenefitValuation.update).toHaveBeenCalledWith({
      where: { id: 'valuation-1' },
      data: {
        totalSessions: 4,
        regularSessionRevenue: new Prisma.Decimal(300),
        finalSessionRevenue: new Prisma.Decimal(300),
      },
    });
  });

  it('rejects roles outside Super Admin and Admin Manager', async () => {
    const service = new VoucherBalanceAdjustmentService();

    await expect(service.adjustVoucherBalance(
      'package-1',
      { remainingSessions: 5, reason: 'Koreksi saldo voucher' },
      'staff-1',
      'ADMIN_CABANG',
    )).rejects.toMatchObject({ status: 403 });

    expect(mockPrisma.memberPackage.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a branch-specific read-only Admin Manager assignment', async () => {
    mockPrisma.managerBranch.findUnique.mockResolvedValue({
      accessScope: AdminManagerAccessScope.MEMBER_VIEW_ONLY,
    });
    const service = new VoucherBalanceAdjustmentService();

    await expect(service.adjustVoucherBalance(
      'package-1',
      { remainingSessions: 5, reason: 'Koreksi saldo voucher' },
      'manager-1',
      'ADMIN_MANAGER',
    )).rejects.toMatchObject({ status: 403 });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('preserves used sessions and replaces only the remaining BOOSTER balance', async () => {
    const boosterPackage = {
      ...basePackage,
      id: 'booster-1',
      packageCode: 'PKG-BOOSTER-001',
      packageType: PackageType.BOOSTER,
      totalSessions: 17,
      usedSessions: 7,
    };
    mockPrisma.memberPackage.findUnique
      .mockReset()
      .mockResolvedValueOnce({ branchId: 'branch-1' })
      .mockResolvedValueOnce(boosterPackage);
    mockPrisma.memberPackage.update.mockResolvedValue({
      ...boosterPackage,
      totalSessions: 19,
    });
    const service = new VoucherBalanceAdjustmentService();

    const result = await service.adjustVoucherBalance(
      'booster-1',
      { remainingSessions: 12, reason: 'Koreksi saldo booster' },
      'admin-1',
      'SUPER_ADMIN',
    );

    expect(mockPrisma.memberPackage.update).toHaveBeenCalledWith({
      where: { id: 'booster-1' },
      data: { totalSessions: 19 },
    });
    expect(result).toMatchObject({ usedSessions: 7, remainingSessions: 12, totalSessions: 19 });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Menyesuaikan sisa voucher BOOSTER menjadi 12 sesi',
      meta: expect.objectContaining({ action: 'ADJUST_BOOSTER_VOUCHER_BALANCE' }),
    }));
  });
});
