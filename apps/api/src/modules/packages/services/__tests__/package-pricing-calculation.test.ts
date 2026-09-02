import { calculateCatalogPackageTotal } from '../package-pricing-calculation';

describe('calculateCatalogPackageTotal', () => {
  it('treats BASIC price as the full package price', () => {
    expect(calculateCatalogPackageTotal({
      packageType: 'BASIC',
      price: 12_500_000,
      totalSessions: 7,
    })).toBe(12_500_000);
  });

  it('multiplies BOOSTER per-session price by sessions and quantity', () => {
    expect(calculateCatalogPackageTotal({
      packageType: 'BOOSTER',
      price: 650_000,
      totalSessions: 3,
    }, 2)).toBe(3_900_000);
  });
});
