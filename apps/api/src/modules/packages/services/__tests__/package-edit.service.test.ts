import { PackageStatus, InvoiceStatus, PackageType } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { logAudit } from '../../../../utils/auditLog';
import { PackageEditService } from '../package-edit.service';

jest.mock('../../../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
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
      updateMany: jest.fn(),
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
    mockPrisma.$transaction.mockImplementation((callback: (transaction: unknown) => unknown) =>
      callback(mockPrisma),
    );
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
    mockPrisma.memberAddOn.updateMany.mockResolvedValue({ count: 0 });
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

  it('blocks an admin layanan from editing a package in another branch', async () => {
    const service = new PackageEditService();
    mockPrisma.memberPackage.findUnique.mockResolvedValue({
      id: 'pkg-other-branch',
      memberId: 'member-1',
      branchId: 'branch-other',
      purchaseGroupId: null,
      status: PackageStatus.PENDING_PAYMENT,
      member: {
        memberNo: 'MBR-001',
        user: { profile: { fullName: 'Member Cabang Lain' } },
      },
      branch: { id: 'branch-other' },
    });

    await expect(
      service.editPackage(
        'pkg-other-branch',
        { packages: [{ pricingId: 'pricing-1', quantity: 1 }] },
        'admin-layanan-1',
        'branch-1',
        'ADMIN_LAYANAN',
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: 'PACKAGE_BRANCH_FORBIDDEN',
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates a legacy pending package in place without deleting its stable id', async () => {
    const service = new PackageEditService();
    const legacyPackage = {
      id: 'pkg-legacy',
      packageCode: 'PKG-LEGACY-001',
      memberId: 'member-1',
      branchId: 'branch-1',
      purchaseGroupId: null,
      packagePricingId: null,
      packageType: PackageType.BASIC,
      productCode: null,
      boosterType: null,
      serviceType: null,
      totalSessions: 7,
      usedSessions: 0,
      finalPrice: 12500000,
      status: PackageStatus.PENDING_PAYMENT,
      paymentPlanType: 'FULL_PAYMENT',
      installmentTotal: null,
      installmentSchedule: null,
      totalVerifiedPaid: 0,
      paymentPlanStatus: null,
      paidAt: null,
      verifiedBy: null,
      verifiedAt: null,
      activatedAt: null,
      paymentProofUrl: null,
      paymentProofFileName: null,
      paymentProofFileSize: null,
      paymentProofMimeType: null,
      revenueFlowVersion: 1,
      member: {
        memberNo: 'MBR-LEGACY',
        user: { profile: { fullName: 'Member Lama' } },
      },
      branch: { id: 'branch-1' },
    };
    const currentPricing = {
      id: 'pricing-basic-15',
      packageType: PackageType.BASIC,
      boosterType: null,
      serviceType: 'PS',
      productCode: 'TNB-P15-PS',
      totalSessions: 15,
      price: 22500000,
    };
    const updatedPackage = {
      ...legacyPackage,
      packagePricingId: currentPricing.id,
      productCode: currentPricing.productCode,
      serviceType: currentPricing.serviceType,
      totalSessions: currentPricing.totalSessions,
      finalPrice: currentPricing.price,
    };

    mockPrisma.memberPackage.findUnique.mockResolvedValue(legacyPackage);
    mockPrisma.memberPackage.findMany
      .mockResolvedValueOnce([
        {
          id: legacyPackage.id,
          packageCode: legacyPackage.packageCode,
          usedSessions: 0,
        },
      ])
      .mockResolvedValueOnce([legacyPackage]);
    mockPrisma.packagePricing.findMany.mockResolvedValue([currentPricing]);
    mockPrisma.memberPackage.update.mockResolvedValue(updatedPackage);
    mockPrisma.memberAddOn.findMany.mockResolvedValue([]);
    mockPrisma.memberAddOn.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.memberPackage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    (logAudit as jest.Mock).mockResolvedValue(undefined);

    const result = await service.editPackage(
      legacyPackage.id,
      {
        packages: [{ pricingId: currentPricing.id, quantity: 1, serviceType: 'PS' }],
      },
      'admin-layanan-1',
      'branch-1',
      'ADMIN_LAYANAN',
    );

    expect(mockPrisma.memberPackage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: legacyPackage.id },
        data: expect.objectContaining({
          packagePricingId: currentPricing.id,
          totalSessions: 15,
        }),
      }),
    );
    expect(mockPrisma.memberPackage.update.mock.calls[0][0].data).not.toHaveProperty('status');
    expect(mockPrisma.memberPackage.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.memberPackage.create).not.toHaveBeenCalled();
    expect(result.packages).toEqual([updatedPackage]);
  });

  it('soft-cancels a removed legacy bundle row instead of deleting historical data', async () => {
    const service = new PackageEditService();
    const primaryPackage = {
      id: 'pkg-keep',
      packageCode: 'PKG-KEEP',
      memberId: 'member-1',
      branchId: 'branch-1',
      purchaseGroupId: 'group-legacy',
      packagePricingId: 'pricing-keep',
      packageType: PackageType.BASIC,
      productCode: 'TNB-P7-PS',
      boosterType: null,
      serviceType: 'PS',
      totalSessions: 7,
      usedSessions: 0,
      finalPrice: 12500000,
      status: PackageStatus.PENDING_PAYMENT,
      paymentPlanType: 'FULL_PAYMENT',
      installmentTotal: null,
      installmentSchedule: null,
      totalVerifiedPaid: 0,
      paymentPlanStatus: null,
      paidAt: null,
      verifiedBy: null,
      verifiedAt: null,
      activatedAt: null,
      paymentProofUrl: null,
      paymentProofFileName: null,
      paymentProofFileSize: null,
      paymentProofMimeType: null,
      revenueFlowVersion: 1,
      member: {
        memberNo: 'MBR-LEGACY',
        user: { profile: { fullName: 'Member Lama' } },
      },
      branch: { id: 'branch-1' },
    };
    const removedPackage = {
      ...primaryPackage,
      id: 'pkg-remove',
      packageCode: 'PKG-REMOVE',
      packagePricingId: 'pricing-remove',
      packageType: PackageType.BOOSTER,
      productCode: 'BST-NO-P1-PS',
    };
    const pricing = {
      id: 'pricing-keep',
      packageType: PackageType.BASIC,
      boosterType: null,
      serviceType: 'PS',
      productCode: 'TNB-P7-PS',
      totalSessions: 7,
      price: 12500000,
    };

    mockPrisma.memberPackage.findUnique.mockResolvedValue(primaryPackage);
    mockPrisma.memberPackage.findMany
      .mockResolvedValueOnce([
        { id: primaryPackage.id, packageCode: primaryPackage.packageCode, usedSessions: 0 },
        { id: removedPackage.id, packageCode: removedPackage.packageCode, usedSessions: 0 },
      ])
      .mockResolvedValueOnce([primaryPackage, removedPackage]);
    mockPrisma.packagePricing.findMany.mockResolvedValue([pricing]);
    mockPrisma.memberPackage.update.mockResolvedValue(primaryPackage);
    mockPrisma.memberPackage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.memberAddOn.findMany.mockResolvedValue([]);
    mockPrisma.memberAddOn.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    await service.editPackage(
      primaryPackage.purchaseGroupId,
      { packages: [{ pricingId: pricing.id, quantity: 1, serviceType: 'PS' }] },
      'admin-layanan-1',
      'branch-1',
      'ADMIN_LAYANAN',
    );

    expect(mockPrisma.memberPackage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [removedPackage.id] } },
      data: { status: PackageStatus.CANCELLED },
    });
    expect(mockPrisma.memberPackage.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.memberAddOn.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a stale pricing reference before mutating legacy package data', async () => {
    const service = new PackageEditService();
    const legacyPackage = {
      id: 'pkg-legacy',
      packageCode: 'PKG-LEGACY-001',
      memberId: 'member-1',
      branchId: 'branch-1',
      purchaseGroupId: null,
      packagePricingId: null,
      packageType: PackageType.BASIC,
      totalSessions: 7,
      usedSessions: 0,
      finalPrice: 12500000,
      status: PackageStatus.PENDING_PAYMENT,
      member: {
        memberNo: 'MBR-LEGACY',
        user: { profile: { fullName: 'Member Lama' } },
      },
      branch: { id: 'branch-1' },
    };

    mockPrisma.memberPackage.findUnique.mockResolvedValue(legacyPackage);
    mockPrisma.memberPackage.findMany
      .mockResolvedValueOnce([
        {
          id: legacyPackage.id,
          packageCode: legacyPackage.packageCode,
          usedSessions: 0,
        },
      ])
      .mockResolvedValueOnce([legacyPackage]);
    mockPrisma.packagePricing.findMany.mockResolvedValue([]);

    await expect(
      service.editPackage(
        legacyPackage.id,
        {
          packages: [{ pricingId: 'pricing-deleted', quantity: 1 }],
        },
        'admin-layanan-1',
        'branch-1',
        'ADMIN_LAYANAN',
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'PACKAGE_PRICING_NOT_FOUND',
    });

    expect(mockPrisma.memberPackage.update).not.toHaveBeenCalled();
    expect(mockPrisma.memberPackage.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.memberAddOn.deleteMany).not.toHaveBeenCalled();
  });
});
