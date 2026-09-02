import { resolveEffectivePackagePricings } from '../package-pricing-scope';

const pricing = (overrides: Partial<{
  id: string;
  branchId: string | null;
  packageType: string;
  boosterType: string | null;
  serviceType: string | null;
  productCode: string | null;
  totalSessions: number;
}> = {}) => ({
  id: 'global-basic',
  branchId: null,
  packageType: 'BASIC',
  boosterType: null,
  serviceType: 'PM',
  productCode: 'TNB-P7-PM',
  totalSessions: 7,
  ...overrides,
});

describe('resolveEffectivePackagePricings', () => {
  it('keeps Global pricing as fallback for a branch', () => {
    expect(resolveEffectivePackagePricings([pricing()], 'branch-1')).toHaveLength(1);
  });

  it('uses branch pricing over the matching Global product', () => {
    const global = pricing();
    const branch = pricing({ id: 'branch-basic', branchId: 'branch-1' });

    expect(resolveEffectivePackagePricings([global, branch], 'branch-1')).toEqual([branch]);
  });

  it('does not collapse different products with otherwise equal attributes', () => {
    const first = pricing({ productCode: 'FREE-2-A', totalSessions: 2 });
    const second = pricing({ id: 'free-b', productCode: 'FREE-2-B', totalSessions: 2 });

    expect(resolveEffectivePackagePricings([first, second], 'branch-1')).toHaveLength(2);
  });
});
