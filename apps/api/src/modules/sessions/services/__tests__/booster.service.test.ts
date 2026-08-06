import { PackageStatus, PackageType } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { BoosterService } from '../booster.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    memberPackage: {
      findUnique: jest.fn(),
    },
    treatmentSession: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const mockPrisma = prisma as any;

describe('BoosterService.updateSessionBoosterPackage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('moves booster usage from the old package to the new package', async () => {
    const oldPackage = {
      id: 'old-booster',
      memberId: 'member-1',
      branchId: 'branch-1',
      packageType: PackageType.BOOSTER,
      status: PackageStatus.ACTIVE,
      totalSessions: 2,
      usedSessions: 1,
    };
    const newPackage = {
      id: 'new-booster',
      memberId: 'member-1',
      branchId: 'branch-1',
      packageType: PackageType.BOOSTER,
      status: PackageStatus.ACTIVE,
      totalSessions: 1,
      usedSessions: 0,
    };

    mockPrisma.treatmentSession.findUnique.mockResolvedValue({
      id: 'session-1',
      branchId: 'branch-1',
      boosterPackageId: oldPackage.id,
      boosterType: null,
      boosterPackage: oldPackage,
      encounter: { memberId: 'member-1' },
    });
    mockPrisma.memberPackage.findUnique.mockResolvedValue(newPackage);

    const tx = {
      memberPackage: {
        update: jest.fn(),
      },
      treatmentSession: {
        update: jest.fn().mockResolvedValue({ id: 'session-1', boosterPackageId: newPackage.id }),
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
      },
      member: {
        update: jest.fn(),
      },
    };
    mockPrisma.$transaction.mockImplementation((callback) => callback(tx));

    await new BoosterService().updateSessionBoosterPackage(
      'session-1',
      { useBooster: true, boosterPackageId: newPackage.id },
      'admin-1',
      'branch-1',
    );

    expect(tx.memberPackage.update).toHaveBeenNthCalledWith(1, {
      where: { id: oldPackage.id },
      data: { usedSessions: 0, status: PackageStatus.ACTIVE },
    });
    expect(tx.memberPackage.update).toHaveBeenNthCalledWith(2, {
      where: { id: newPackage.id },
      data: { usedSessions: 1, status: PackageStatus.EXPIRED },
    });
    expect(tx.treatmentSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: { boosterPackageId: newPackage.id, boosterType: null },
      }),
    );
    expect(tx.member.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { voucherCount: 2 },
    });
  });
});
