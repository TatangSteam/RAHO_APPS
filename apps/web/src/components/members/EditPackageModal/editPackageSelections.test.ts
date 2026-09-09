import { buildEditPackageSelections } from './editPackageSelections';
import type { MemberPackage, PackagePricing } from '@/types/package';

function memberPackage(overrides: Partial<MemberPackage>): MemberPackage {
  return {
    packageId: 'package-id',
    packageCode: 'PKG-001',
    packageType: 'BOOSTER',
    totalSessions: 1,
    usedSessions: 0,
    remainingSessions: 1,
    finalPrice: 1_000_000,
    status: 'ACTIVE',
    assignedBy: 'Admin',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function pricing(overrides: Partial<PackagePricing>): PackagePricing {
  return {
    id: 'pricing-id',
    branchId: 'branch-id',
    packageType: 'BOOSTER',
    name: 'Booster GT',
    totalSessions: 1,
    price: 1_000_000,
    isActive: true,
    boosterType: 'GT',
    serviceType: 'PM',
    productCode: 'BST-GT-P1-PM',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildEditPackageSelections', () => {
  it('combines used history and active balance of the same booster into one row', () => {
    const selections = buildEditPackageSelections([
      memberPackage({
        packageId: 'used-history',
        packagePricingId: 'pricing-old',
        productCode: 'BST-GT-P1-PM-OLD',
        totalSessions: 7,
        usedSessions: 7,
        remainingSessions: 0,
        purchaseQuantity: 7,
        status: 'EXPIRED',
      }),
      memberPackage({
        packageId: 'active-balance',
        packagePricingId: 'pricing-current',
        productCode: 'BST-GT-P1-PM',
        totalSessions: 10,
        remainingSessions: 10,
        purchaseQuantity: 10,
      }),
    ], [
      pricing({ id: 'pricing-old', productCode: 'BST-GT-P1-PM-OLD' }),
      pricing({ id: 'pricing-current' }),
    ]);

    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({
      boosterType: 'GT',
      serviceType: 'PM',
      quantity: 17,
    });
  });

  it('keeps different basic products as separate edit rows', () => {
    const selections = buildEditPackageSelections([
      memberPackage({ packageId: 'free', packageType: 'BASIC', packagePricingId: 'basic-free', productCode: 'TNB-P1-PM', baseSessions: 1 }),
      memberPackage({ packageId: 'regular', packageType: 'BASIC', packagePricingId: 'basic-15', productCode: 'TNB-P15-PM', baseSessions: 15, totalSessions: 15 }),
    ], [
      pricing({ id: 'basic-free', packageType: 'BASIC', boosterType: null, name: 'FREE 1X', productCode: 'TNB-P1-PM' }),
      pricing({ id: 'basic-15', packageType: 'BASIC', boosterType: null, name: 'Nano Bubble 15X', totalSessions: 15, productCode: 'TNB-P15-PM' }),
    ]);

    expect(selections).toHaveLength(2);
  });
});
