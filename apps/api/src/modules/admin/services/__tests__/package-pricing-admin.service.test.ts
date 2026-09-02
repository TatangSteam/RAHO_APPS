import { prisma } from '@lib/prisma';
import { PackagePricingAdminService } from '../package-pricing-admin.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    packagePricing: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    masterServiceType: { findUnique: jest.fn() },
  },
}));

jest.mock('@modules/zoho/zoho.master.service', () => ({
  enqueueMasterSafely: jest.fn(),
}));

const legacyPricing = {
  id: 'pricing-legacy-hc',
  branchId: 'branch-1',
  packageType: 'BOOSTER',
  boosterType: 'NO',
  serviceType: 'HC',
  productCode: 'BST-NO-P1-HC',
  name: 'Legacy HC',
  totalSessions: 1,
  price: 750_000,
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

describe('PackagePricingAdminService legacy service compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.packagePricing.findUnique as jest.Mock).mockResolvedValue(legacyPricing);
    (prisma.packagePricing.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.packagePricing.update as jest.Mock).mockResolvedValue({
      ...legacyPricing,
      name: 'Legacy HC Updated',
      branch: null,
    });
  });

  it('keeps an existing legacy service code editable without a master row', async () => {
    const service = new PackagePricingAdminService();

    await expect(service.updatePackagePricing(legacyPricing.id, {
      name: 'Legacy HC Updated',
      serviceType: 'HC',
    })).resolves.toMatchObject({ serviceType: 'HC', name: 'Legacy HC Updated' });

    expect(prisma.masterServiceType.findUnique).not.toHaveBeenCalled();
  });

  it('still requires a new service code to exist in the active master', async () => {
    (prisma.masterServiceType.findUnique as jest.Mock).mockResolvedValue(null);
    const service = new PackagePricingAdminService();

    await expect(service.updatePackagePricing(legacyPricing.id, {
      serviceType: 'NEW_SERVICE',
    })).rejects.toMatchObject({ code: 'SERVICE_TYPE_INVALID' });
  });
});
