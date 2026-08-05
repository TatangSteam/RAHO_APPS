import { selectTreatmentRevenueSource } from '../treatment-revenue-source';

describe('additive treatment revenue source', () => {
  it('always recognizes Basic when no Booster is selected', () => {
    expect(selectTreatmentRevenueSource('basic-1', null)).toEqual({
      revenueSourceType: 'BASIC',
      revenuePackageId: 'basic-1',
      revenuePackageIds: ['basic-1'],
    });
  });

  it('recognizes Basic plus Booster when a Booster is selected', () => {
    expect(selectTreatmentRevenueSource('basic-1', 'booster-1')).toEqual({
      revenueSourceType: 'BASIC_WITH_BOOSTER',
      revenuePackageId: 'basic-1',
      revenuePackageIds: ['basic-1', 'booster-1'],
    });
  });
});
