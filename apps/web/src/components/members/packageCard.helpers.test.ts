import type { MemberPackage } from '@/types/package';
import { groupMemberPackagesForDisplay } from './packageCard.helpers';

function memberPackage(overrides: Partial<MemberPackage>): MemberPackage {
  return {
    packageId: 'package-1',
    packageCode: 'PKG-1',
    packageType: 'BASIC',
    totalSessions: 1,
    usedSessions: 0,
    remainingSessions: 1,
    finalPrice: 0,
    status: 'ACTIVE',
    assignedBy: 'Admin',
    createdAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('groupMemberPackagesForDisplay', () => {
  it('keeps different BASIC pricings in separate display rows', () => {
    const groups = groupMemberPackagesForDisplay([
      memberPackage({
        packageId: 'free',
        packagePricingId: 'pricing-free',
        packageName: 'FREE Terapi Nano Bubble 1X Premier',
        purchaseQuantity: 2,
        totalSessions: 2,
        remainingSessions: 2,
      }),
      memberPackage({
        packageId: 'nb15',
        packagePricingId: 'pricing-nb15',
        packageName: 'Terapi Nano Bubble 15X',
        purchaseQuantity: 1,
        totalSessions: 15,
        remainingSessions: 15,
        finalPrice: 22_500_000,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => ({
      name: group.representative.packageName,
      quantity: group.quantity,
      sessions: group.totalSessions,
    }))).toEqual([
      { name: 'FREE Terapi Nano Bubble 1X Premier', quantity: 2, sessions: 2 },
      { name: 'Terapi Nano Bubble 15X', quantity: 1, sessions: 15 },
    ]);
  });

  it('merges duplicate rows only when they reference the same pricing', () => {
    const groups = groupMemberPackagesForDisplay([
      memberPackage({ packageId: 'free-1', packageCode: 'FREE-1', packagePricingId: 'pricing-free' }),
      memberPackage({ packageId: 'free-2', packageCode: 'FREE-2', packagePricingId: 'pricing-free' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      quantity: 2,
      totalSessions: 2,
      remainingSessions: 2,
      packageCodes: ['FREE-1', 'FREE-2'],
    });
  });
});
