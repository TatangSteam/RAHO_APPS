type ScopedPricing = {
  id: string;
  branchId: string | null;
  packageType: string;
  boosterType: string | null;
  serviceType: string | null;
  productCode: string | null;
  totalSessions: number;
};

export function getPackagePricingScopeKey(pricing: ScopedPricing): string {
  const productCode = pricing.productCode?.trim().toUpperCase();
  if (productCode) return `PRODUCT:${productCode}`;

  return [
    'ATTR',
    pricing.packageType,
    pricing.boosterType || '',
    pricing.serviceType || '',
    pricing.totalSessions,
  ].join('|');
}

/**
 * Resolve the catalog visible to one branch. A branch-specific row overrides
 * the matching Global row; Global rows remain as fallback for everything else.
 */
export function resolveEffectivePackagePricings<T extends ScopedPricing>(
  pricings: T[],
  branchId: string,
): T[] {
  const effective = new Map<string, T>();

  pricings
    .filter((pricing) => pricing.branchId === null)
    .forEach((pricing) => effective.set(getPackagePricingScopeKey(pricing), pricing));

  pricings
    .filter((pricing) => pricing.branchId === branchId)
    .forEach((pricing) => effective.set(getPackagePricingScopeKey(pricing), pricing));

  return Array.from(effective.values());
}
