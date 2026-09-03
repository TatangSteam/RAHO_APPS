import type { MemberPackage } from '@/types/package';
import {
  findActiveInstallmentTarget,
  findPendingPaymentTarget,
  groupMemberPackagesForDisplay,
} from './packageCard.helpers';

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

describe('payment verification target', () => {
  it('selects the pending row instead of the first row in a mixed bundle', () => {
    const firstActive = memberPackage({ packageId: 'already-active' });
    const waiting = memberPackage({
      packageId: 'waiting-proof',
      status: 'WAITING_VERIFICATION',
    });

    expect(findPendingPaymentTarget([firstActive, waiting])).toBe(waiting);
  });

  it('selects the row that actually owns the active installment', () => {
    const staleFirstRow = memberPackage({
      packageId: 'stale-first-row',
      paymentPlanType: 'FULL_PAYMENT',
    });
    const activeInstallment = memberPackage({
      packageId: 'installment-owner',
      paymentPlanType: 'INSTALLMENT',
      paymentPlanStatus: 'ACTIVE_INSTALLMENT',
    });

    expect(findActiveInstallmentTarget([staleFirstRow, activeInstallment])).toBe(activeInstallment);
  });

  it('prefers a package target so bundle verification updates the whole purchase group', () => {
    const pendingAddOn = {
      isGroup: false as const,
      isAddOn: true as const,
      id: 'addon-1',
      addOnId: 'addon-1',
      addOnCode: 'ADDON-1',
      addOnType: 'AIR_NANO',
      quantity: 1,
      pricePerUnit: 15_000,
      totalPrice: 15_000,
      status: 'WAITING_VERIFICATION' as const,
      branchName: 'Cabang',
      assignedBy: 'Admin',
      createdAt: '2026-09-03T00:00:00.000Z',
    };
    const pendingPackage = memberPackage({
      packageId: 'group-package',
      status: 'PENDING_PAYMENT',
    });

    expect(findPendingPaymentTarget([pendingAddOn, pendingPackage])).toBe(pendingPackage);
  });
});
