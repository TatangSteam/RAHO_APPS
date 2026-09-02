type CatalogPricing = {
  packageType: 'BASIC' | 'BOOSTER';
  price: number | string | { toString(): string };
  totalSessions: number;
};

/**
 * PackagePricing.price stores the full package price for BASIC and the
 * per-session price for BOOSTER. Keep this conversion in one place so the
 * catalog, assignment, and package-edit flows produce the same total.
 */
export function calculateCatalogPackageTotal(
  pricing: CatalogPricing,
  quantity = 1,
): number {
  const unitPrice = Number(pricing.price);
  const sessionsPerPackage = pricing.packageType === 'BOOSTER'
    ? pricing.totalSessions
    : 1;

  return unitPrice * sessionsPerPackage * quantity;
}
