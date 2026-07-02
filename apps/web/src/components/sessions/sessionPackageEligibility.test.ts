import type { MemberPackage } from '@/types/member';
import {
  DEBT_SESSION_LIMIT,
  getDebtRemainingSessions,
  isDebtEligiblePackage,
  isDebtPackageStatus,
  isPackageUsableForSession,
} from './sessionPackageEligibility';

function createPackage(overrides: Partial<MemberPackage> = {}): MemberPackage {
  return {
    id: 'member-package-1',
    packageId: 'package-1',
    packageCode: 'BASIC-10',
    packageType: 'BASIC',
    totalSessions: 10,
    usedSessions: 0,
    remainingSessions: 10,
    status: 'ACTIVE',
    activatedAt: null,
    branchName: 'Jakarta',
    ...overrides,
  };
}

describe('session package eligibility', () => {
  it('recognizes package statuses that count as debt', () => {
    expect(isDebtPackageStatus('PENDING_PAYMENT')).toBe(true);
    expect(isDebtPackageStatus('WAITING_VERIFICATION')).toBe(true);
    expect(isDebtPackageStatus('ACTIVE')).toBe(false);
    expect(isDebtPackageStatus('EXPIRED')).toBe(false);
  });

  it('limits debt sessions by package balance and the global debt quota', () => {
    const memberPackage = createPackage({ status: 'PENDING_PAYMENT', remainingSessions: 5 });

    expect(DEBT_SESSION_LIMIT).toBe(2);
    expect(getDebtRemainingSessions(memberPackage, 0)).toBe(2);
    expect(getDebtRemainingSessions(memberPackage, 1)).toBe(1);
    expect(getDebtRemainingSessions(memberPackage, 2)).toBe(0);
    expect(getDebtRemainingSessions(createPackage({ remainingSessions: 1 }), 0)).toBe(1);
  });

  it('allows only basic debt packages while quota remains', () => {
    const pendingBasic = createPackage({ status: 'PENDING_PAYMENT' });

    expect(isDebtEligiblePackage(pendingBasic, 1)).toBe(true);
    expect(isDebtEligiblePackage(pendingBasic, 2)).toBe(false);
    expect(
      isDebtEligiblePackage(
        createPackage({ packageType: 'BOOSTER', status: 'PENDING_PAYMENT' }),
        0,
      ),
    ).toBe(false);
    expect(isDebtEligiblePackage(createPackage({ status: 'ACTIVE' }), 0)).toBe(false);
  });

  it('allows active basic and booster packages with remaining sessions', () => {
    expect(isPackageUsableForSession(createPackage(), 2)).toBe(true);
    expect(
      isPackageUsableForSession(createPackage({ packageType: 'BOOSTER', status: 'ACTIVE' }), 2),
    ).toBe(true);
    expect(isPackageUsableForSession(createPackage({ remainingSessions: 0 }), 0)).toBe(false);
    expect(
      isPackageUsableForSession(
        createPackage({ packageType: 'BOOSTER', status: 'ACTIVE', remainingSessions: 0 }),
        0,
      ),
    ).toBe(false);
  });

  it('allows eligible basic debt packages but never unpaid boosters', () => {
    expect(
      isPackageUsableForSession(createPackage({ status: 'WAITING_VERIFICATION' }), 0),
    ).toBe(true);
    expect(
      isPackageUsableForSession(
        createPackage({ packageType: 'BOOSTER', status: 'WAITING_VERIFICATION' }),
        0,
      ),
    ).toBe(false);
  });
});
