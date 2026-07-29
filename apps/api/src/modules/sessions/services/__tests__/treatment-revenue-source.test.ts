import { selectTreatmentRevenueSource } from '../treatment-revenue-source';

describe('exclusive treatment revenue source', () => {
  it('uses only Basic when no Booster is selected', () => {
    expect(selectTreatmentRevenueSource('basic-1', null)).toEqual({
      revenueSourceType: 'BASIC',
      revenuePackageId: 'basic-1',
    });
  });

  it('uses only Booster when a Booster is selected, never Basic plus Booster', () => {
    expect(selectTreatmentRevenueSource('basic-1', 'booster-1')).toEqual({
      revenueSourceType: 'BOOSTER',
      revenuePackageId: 'booster-1',
    });
  });
});
