export type MemberRank = 'A' | 'B' | 'C';

export interface MemberRankSource {
  id: string;
  memberId: string;
  purchaseGroupId?: string | null;
  finalPrice: unknown;
  discountAmount?: unknown;
  discountPercent?: unknown;
  status?: string | null;
  createdAt: Date;
}

export interface MemberRankResult {
  memberRank: MemberRank | null;
  lastPurchaseDiscountPercent: number | null;
  lastPackagePurchaseAt: string | null;
}

export const EMPTY_MEMBER_RANK: MemberRankResult = {
  memberRank: null,
  lastPurchaseDiscountPercent: null,
  lastPackagePurchaseAt: null,
};

function toSafeNumber(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}

function getPurchaseKey(pkg: MemberRankSource): string {
  return pkg.purchaseGroupId || pkg.id;
}

export function getRankFromDiscount(discountPercent: number): MemberRank {
  if (discountPercent <= 20) return 'A';
  if (discountPercent <= 50) return 'B';
  return 'C';
}

/**
 * Derives a member rank from their latest non-cancelled package purchase.
 * Bundled rows are evaluated as one purchase and legacy percentage-only rows
 * remain supported.
 */
export function calculateMemberRank(packages: MemberRankSource[]): MemberRankResult {
  const validPackages = packages
    .filter(pkg => pkg.status !== 'CANCELLED')
    .sort((left, right) => {
      const dateDelta = right.createdAt.getTime() - left.createdAt.getTime();
      return dateDelta !== 0 ? dateDelta : right.id.localeCompare(left.id);
    });

  const latestPackage = validPackages[0];
  if (!latestPackage) return { ...EMPTY_MEMBER_RANK };

  const latestPurchaseKey = getPurchaseKey(latestPackage);
  const latestPurchaseRows = validPackages.filter(
    pkg =>
      pkg.memberId === latestPackage.memberId &&
      getPurchaseKey(pkg) === latestPurchaseKey,
  );

  const totals = latestPurchaseRows.reduce(
    (result, pkg) => {
      const finalPrice = toSafeNumber(pkg.finalPrice);
      const discountAmount = toSafeNumber(pkg.discountAmount);

      result.grossAmount += finalPrice + discountAmount;
      result.discountAmount += discountAmount;
      result.explicitPercent = Math.max(
        result.explicitPercent,
        toSafeNumber(pkg.discountPercent),
      );
      result.latestAt = Math.max(result.latestAt, pkg.createdAt.getTime());
      return result;
    },
    {
      grossAmount: 0,
      discountAmount: 0,
      explicitPercent: 0,
      latestAt: latestPackage.createdAt.getTime(),
    },
  );

  const effectivePercent =
    totals.grossAmount > 0
      ? (totals.discountAmount / totals.grossAmount) * 100
      : 0;
  const normalizedPercent = Math.min(
    100,
    Math.max(totals.explicitPercent, effectivePercent),
  );
  const roundedPercent = Number(normalizedPercent.toFixed(2));

  return {
    memberRank: getRankFromDiscount(roundedPercent),
    lastPurchaseDiscountPercent: roundedPercent,
    lastPackagePurchaseAt: new Date(totals.latestAt).toISOString(),
  };
}

export function buildMemberRankMap(
  packages: MemberRankSource[],
): Map<string, MemberRankResult> {
  const packagesByMember = new Map<string, MemberRankSource[]>();

  for (const pkg of packages) {
    const memberPackages = packagesByMember.get(pkg.memberId) || [];
    memberPackages.push(pkg);
    packagesByMember.set(pkg.memberId, memberPackages);
  }

  return new Map(
    Array.from(packagesByMember.entries()).map(([memberId, memberPackages]) => [
      memberId,
      calculateMemberRank(memberPackages),
    ]),
  );
}
