import { prisma } from '@lib/prisma';
import { PackagePricingService } from '../package-pricing.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    packagePricing: { findMany: jest.fn() },
    masterServiceType: { findMany: jest.fn() },
  },
}));

jest.mock('@utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

jest.mock('@modules/zoho/zoho.master.service', () => ({
  enqueueMasterSafely: jest.fn(),
}));

describe('PackagePricingService assignment catalog scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.packagePricing.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('queries only pricing assigned to the requested branch in branch-only mode', async () => {
    const service = new PackagePricingService();

    await service.getPackagePricings('branch-pus', { includeGlobalFallback: false });

    expect(prisma.packagePricing.findMany).toHaveBeenCalledWith({
      where: { branchId: 'branch-pus' },
      orderBy: [{ packageType: 'asc' }, { totalSessions: 'asc' }],
    });
  });

  it('keeps global fallback for existing consumers by default', async () => {
    const service = new PackagePricingService();

    await service.getPackagePricings('branch-pus');

    expect(prisma.packagePricing.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ branchId: 'branch-pus' }, { branchId: null }],
      },
      orderBy: [{ packageType: 'asc' }, { totalSessions: 'asc' }],
    });
  });
});
