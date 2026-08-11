import type {
  GroupedPackage,
  MemberPackage,
  PackageDisplay,
  StandalonePackage,
} from '@/types/package';
import {
  getActiveMemberPackagesByType,
  getAggregatePackageStatus,
  getMemberVoucherTotals,
} from './memberStatusPresentation';

function createMemberPackage(
  packageType: MemberPackage['packageType'],
  overrides: Partial<MemberPackage> = {},
): StandalonePackage {
  return {
    isGroup: false,
    packageId: `${packageType}-${overrides.status ?? 'ACTIVE'}`,
    packageCode: packageType,
    packageType,
    totalSessions: 10,
    usedSessions: 0,
    remainingSessions: 10,
    finalPrice: 0,
    status: 'ACTIVE',
    assignedBy: 'test-user',
    createdAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

function createGroup(overrides: Partial<GroupedPackage> = {}): GroupedPackage {
  return {
    isGroup: true,
    purchaseGroupId: 'group-1',
    status: 'ACTIVE',
    createdAt: '2026-07-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('memberStatusPresentation', () => {
  it('keeps a bundle active while at least one package is still active', () => {
    const packages = [
      createMemberPackage('BASIC', { status: 'EXPIRED', usedSessions: 1, remainingSessions: 0 }),
      createMemberPackage('BASIC', { status: 'ACTIVE', usedSessions: 0, remainingSessions: 1 }),
    ];

    expect(getAggregatePackageStatus(packages)).toBe('ACTIVE');
  });

  it('expires a bundle after all packages are expired', () => {
    const packages = [
      createMemberPackage('BASIC', { status: 'EXPIRED', remainingSessions: 0 }),
      createMemberPackage('BASIC', { status: 'EXPIRED', remainingSessions: 0 }),
    ];

    expect(getAggregatePackageStatus(packages)).toBe('EXPIRED');
  });

  it('totals active standalone basic and booster vouchers', () => {
    const packages: PackageDisplay[] = [
      createMemberPackage('BASIC', { remainingSessions: 7 }),
      createMemberPackage('BOOSTER', { remainingSessions: 3 }),
      createMemberPackage('BASIC', { status: 'EXPIRED', remainingSessions: 5 }),
    ];

    expect(getMemberVoucherTotals(packages)).toEqual({ basic: 7, booster: 3 });
  });

  it('totals active packages from grouped package arrays', () => {
    const packages: PackageDisplay[] = [
      createGroup({
        basics: [
          createMemberPackage('BASIC', { remainingSessions: 4 }),
          createMemberPackage('BASIC', { status: 'CANCELLED', remainingSessions: 8 }),
        ],
        boosters: [
          createMemberPackage('BOOSTER', { remainingSessions: 2 }),
          createMemberPackage('BOOSTER', { remainingSessions: 1 }),
        ],
      }),
    ];

    expect(getMemberVoucherTotals(packages)).toEqual({ basic: 4, booster: 3 });
  });

  it('uses the singular grouped package as a fallback for empty arrays', () => {
    const packages: PackageDisplay[] = [
      createGroup({
        basic: createMemberPackage('BASIC', { remainingSessions: 6 }),
        booster: createMemberPackage('BOOSTER', { remainingSessions: 9 }),
        basics: [],
      }),
    ];

    expect(getMemberVoucherTotals(packages)).toEqual({ basic: 6, booster: 9 });
  });

  it('prefers grouped arrays over singular fallback packages', () => {
    const packages: PackageDisplay[] = [
      createGroup({
        basic: createMemberPackage('BASIC', { remainingSessions: 20 }),
        basics: [createMemberPackage('BASIC', { remainingSessions: 5 })],
      }),
    ];

    expect(getMemberVoucherTotals(packages)).toEqual({ basic: 5, booster: 0 });
  });

  it('returns every active BASIC package exactly once for voucher editing', () => {
    const activeBasic = createMemberPackage('BASIC', { packageId: 'basic-active' });
    const packages: PackageDisplay[] = [
      createGroup({
        basic: activeBasic,
        basics: [
          activeBasic,
          createMemberPackage('BASIC', { packageId: 'basic-second' }),
          createMemberPackage('BASIC', { packageId: 'basic-expired', status: 'EXPIRED' }),
        ],
        boosters: [createMemberPackage('BOOSTER', { packageId: 'booster-active' })],
      }),
    ];

    expect(getActiveMemberPackagesByType(packages, 'BASIC').map((item) => item.packageId))
      .toEqual(['basic-active', 'basic-second']);
  });
});
