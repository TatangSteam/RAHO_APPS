import {
  selectTreatmentPackageUsageIds,
  selectTreatmentRevenueSource,
} from '../treatment-revenue-source';

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

  it('returns both reserved package ids for a Basic plus Booster usage reversal', () => {
    expect(selectTreatmentPackageUsageIds('basic-1', 'booster-1')).toEqual([
      'basic-1',
      'booster-1',
    ]);
  });

  it('does not return a duplicate package id for corrupt same-package input', () => {
    expect(selectTreatmentPackageUsageIds('basic-1', 'basic-1')).toEqual(['basic-1']);
  });
});
