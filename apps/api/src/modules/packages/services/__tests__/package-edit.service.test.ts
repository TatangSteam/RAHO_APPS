import { PackageStatus, InvoiceStatus, PackageType } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { logAudit } from '../../../../utils/auditLog';
import { PackageEditService } from '../package-edit.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    memberPackage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    memberAddOn: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    packagePricing: {
      findMany: jest.fn(),
    },
    referralIncentiveRecord: {
      deleteMany: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    invoiceItem: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../../../utils/auditLog', () => ({
  logAudit: jest.fn(),
}));

const mockPrisma = prisma as any;

describe('PackageEditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates an active used package in place for privileged roles', async () => {
    const service = new PackageEditService();
    const activePackage = {
      id: 'pkg-1',
      packageCode: 'PKG-PUS-BSC-2607-0004',
      memberId: 'member-1',
      branchId: 'branch-1',
      purchaseGroupId: null,
      packagePricingId: 'pricing-old',
      packageType: PackageType.BASIC,
      productCode: 'OLD-CODE',
      boosterType: null,
      serviceType: 'PM',
      totalSessions: 1,
      usedSessions: 1,
      finalPrice: 100000,
      status: PackageStatus.ACTIVE,
      paymentPlanType: 'FULL_PAYMENT',
      installmentTotal: null,
      installmentSchedule: null,
      totalVerifiedPaid: 100000,
      paymentPlanStatus: null,
      paidAt: new Date('2026-07-01T00:00:00.000Z'),
      verifiedBy: 'manager-1',
      verifiedAt: new Date('2026-07-01T01:00:00.000Z'),
      activatedAt: new Date('2026-07-01T01:00:00.000Z'),
      paymentProofUrl: 'proof.jpg',
      paymentProofFileName: 'proof.jpg',
      paymentProofFileSize: 100,
      paymentProofMimeType: 'image/jpeg',
      member: {
        memberNo: 'MBR-001',
        user: {
          profile: {
            fullName: 'Test Member',
          },
        },
      },
      branch: {
        id: 'branch-1',
      },
    };
    const updatedPackage = {
      ...activePackage,
      packagePricingId: 'pricing-new',
      productCode: 'NEW-CODE',
      totalSessions: 3,
      finalPrice: 300000,
    };

    mockPrisma.memberPackage.findUnique.mockResolvedValue(activePackage);
    mockPrisma.memberPackage.findMany
      .mockResolvedValueOnce([
        {
          id: activePackage.id,
          packageCode: activePackage.packageCode,
          usedSessions: activePackage.usedSessions,
        },
      ])
      .mockResolvedValueOnce([activePackage]);
    mockPrisma.packagePricing.findMany.mockResolvedValue([
      {
        id: 'pricing-new',
        packageType: PackageType.BASIC,
        boosterType: null,
        serviceType: 'PM',
        productCode: 'NEW-CODE',
        totalSessions: 3,
        price: 300000,
      },
    ]);
    mockPrisma.memberPackage.update.mockResolvedValue(updatedPackage);
    mockPrisma.memberAddOn.findMany.mockResolvedValue([]);
    mockPrisma.memberAddOn.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.memberPackage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'invoice-1',
      invoiceNumber: 'INV-001',
      status: InvoiceStatus.PAID,
      actualPaidAmount: 100000,
    });
    mockPrisma.invoiceItem.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoiceItem.create.mockResolvedValue({});
    mockPrisma.invoice.update.mockResolvedValue({});
    (logAudit as jest.Mock).mockResolvedValue(undefined);

    const result = await service.editPackage(
      activePackage.id,
      {
        packages: [
          {
            pricingId: 'pricing-new',
            quantity: 1,
            serviceType: 'PM',
          },
        ],
      },
      'super-admin-1',
      null,
      'SUPER_ADMIN'
    );

    expect(mockPrisma.memberPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: activePackage.id },
        data: expect.objectContaining({
          packagePricingId: 'pricing-new',
          totalSessions: 3,
          finalPrice: 300000,
        }),
      })
    );
    expect(mockPrisma.memberPackage.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.memberPackage.create).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({
          totalAmount: 300000,
          actualPaidAmount: 300000,
        }),
      })
    );
    expect(result.packages).toEqual([updatedPackage]);
  });
});
