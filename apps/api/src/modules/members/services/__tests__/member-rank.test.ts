import {
  buildMemberRankMap,
  calculateMemberRank,
  getRankFromDiscount,
  type MemberRankSource,
} from '../member-rank';

function packageRow(
  overrides: Partial<MemberRankSource> = {},
): MemberRankSource {
  return {
    id: 'package-1',
    memberId: 'member-1',
    purchaseGroupId: null,
    finalPrice: 100,
    discountAmount: 0,
    discountPercent: 0,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('member rank', () => {
  it.each([
    [0, 'A'],
    [20, 'A'],
    [20.01, 'B'],
    [21, 'B'],
    [50, 'B'],
    [50.01, 'C'],
    [51, 'C'],
    [100, 'C'],
  ])('maps %s percent to rank %s', (discountPercent, expectedRank) => {
    expect(getRankFromDiscount(discountPercent)).toBe(expectedRank);
  });

  it('uses the latest non-cancelled purchase', () => {
    const result = calculateMemberRank([
      packageRow({
        id: 'older',
        discountPercent: 75,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      packageRow({
        id: 'cancelled-latest',
        discountPercent: 90,
        status: 'CANCELLED',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
      packageRow({
        id: 'latest-valid',
        discountPercent: 10,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ]);

    expect(result).toEqual({
      memberRank: 'A',
      lastPurchaseDiscountPercent: 10,
      lastPackagePurchaseAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('calculates the effective discount across the latest bundle', () => {
    const result = calculateMemberRank([
      packageRow({
        id: 'bundle-1',
        purchaseGroupId: 'group-latest',
        finalPrice: 40,
        discountAmount: 60,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      }),
      packageRow({
        id: 'bundle-2',
        purchaseGroupId: 'group-latest',
        finalPrice: 40,
        discountAmount: 60,
        createdAt: new Date('2026-04-01T00:00:01.000Z'),
      }),
    ]);

    expect(result.memberRank).toBe('C');
    expect(result.lastPurchaseDiscountPercent).toBe(60);
  });

  it('keeps legacy percentage-only package data compatible', () => {
    const result = calculateMemberRank([
      packageRow({
        finalPrice: 100,
        discountAmount: null,
        discountPercent: 35,
      }),
    ]);

    expect(result.memberRank).toBe('B');
    expect(result.lastPurchaseDiscountPercent).toBe(35);
  });

  it('returns no rank when a member has no valid package purchase', () => {
    expect(
      calculateMemberRank([
        packageRow({ status: 'CANCELLED' }),
      ]),
    ).toEqual({
      memberRank: null,
      lastPurchaseDiscountPercent: null,
      lastPackagePurchaseAt: null,
    });
  });

  it('builds independent ranks for multiple members', () => {
    const result = buildMemberRankMap([
      packageRow({ memberId: 'member-a', discountPercent: 5 }),
      packageRow({ id: 'package-b', memberId: 'member-b', discountPercent: 55 }),
    ]);

    expect(result.get('member-a')?.memberRank).toBe('A');
    expect(result.get('member-b')?.memberRank).toBe('C');
  });
});
