import { prisma } from '@lib/prisma';
import { getAccessibleBranchIds } from '@modules/iam/authorization.service';
import { PackageAssignmentService } from '../package-assignment.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    member: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    packagePricing: { findMany: jest.fn() },
  },
}));

jest.mock('@modules/iam/authorization.service', () => ({
  getAccessibleBranchIds: jest.fn(),
}));

const assignment = {
  packages: [{ pricingId: 'pricing-1', quantity: 1 }],
  addOns: [],
};

describe('PackageAssignmentService branch access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.member.findUnique as jest.Mock).mockResolvedValue({
      id: 'member-1',
      registrationBranchId: 'branch-member',
      registrationBranch: { id: 'branch-member' },
      branchAccesses: [],
    });
    // Stop after access validation. Reaching this lookup proves that the
    // assignment was not rejected as MEMBER_ACCESS_DENIED.
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('allows an actor with global branch access to reach any member', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(null);
    const service = new PackageAssignmentService();

    await expect(service.assignPackage(
      'member-1',
      assignment,
      'branch-member',
      'super-admin-1',
    )).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });

    expect(prisma.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 'branch-member' },
    });
  });

  it('keeps rejecting scoped staff outside the member branch', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(['branch-other']);
    const service = new PackageAssignmentService();

    await expect(service.assignPackage(
      'member-1',
      assignment,
      'branch-other',
      'staff-1',
    )).rejects.toMatchObject({ code: 'MEMBER_ACCESS_DENIED' });

    expect(prisma.branch.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a pricing row from another branch', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(null);
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 'branch-member', branchCode: 'PUS' });
    (prisma.packagePricing.findMany as jest.Mock).mockResolvedValue([{
      id: 'pricing-1',
      branchId: 'branch-other',
      isActive: true,
      productCode: 'TNB-P1-PM',
    }]);
    const service = new PackageAssignmentService();

    await expect(service.assignPackage(
      'member-1',
      assignment,
      'branch-member',
      'super-admin-1',
    )).rejects.toMatchObject({ code: 'PACKAGE_PRICING_SCOPE_MISMATCH' });
  });

  it('allows Program Sosial pricing to be assigned directly', async () => {
    (getAccessibleBranchIds as jest.Mock).mockResolvedValue(null);
    (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
      id: 'branch-member',
      branchCode: 'PUS',
    });
    (prisma.packagePricing.findMany as jest.Mock).mockResolvedValue([{
      id: 'pricing-1',
      branchId: 'branch-member',
      packageType: 'BASIC',
      boosterType: null,
      serviceType: 'PS',
      productCode: 'SRV-TNB-TRP-PS-001',
      name: 'Terapi Nano Bubble 1X (Program Sosial)',
      totalSessions: 1,
      price: 500_000,
      isActive: true,
    }]);

    const service = new PackageAssignmentService();
    const internals = service as unknown as {
      getNextSequences: (branchCode: string, branchId: string) => Promise<{
        basicSequence: number;
        boosterSequence: number;
      }>;
      createPackagesTransaction: (...args: unknown[]) => Promise<{
        createdPackages: [];
        createdAddOns: [];
        totalBasicSessions: number;
      }>;
    };
    jest.spyOn(internals, 'getNextSequences').mockResolvedValue({
      basicSequence: 1,
      boosterSequence: 1,
    });
    const createPackagesTransaction = jest
      .spyOn(internals, 'createPackagesTransaction')
      .mockResolvedValue({
        createdPackages: [],
        createdAddOns: [],
        totalBasicSessions: 0,
      });

    await expect(service.assignPackage(
      'member-1',
      assignment,
      'branch-member',
      'super-admin-1',
    )).resolves.toMatchObject({ message: '0 item berhasil diassign' });

    expect(createPackagesTransaction).toHaveBeenCalled();
  });
});
