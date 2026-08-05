export type TreatmentRevenueSource = {
  revenueSourceType: 'BASIC' | 'BASIC_WITH_BOOSTER';
  revenuePackageId: string;
  revenuePackageIds: string[];
};

export function selectTreatmentRevenueSource(
  basicPackageId: string,
  boosterPackageId: string | null,
): TreatmentRevenueSource {
  return boosterPackageId
    ? {
        revenueSourceType: 'BASIC_WITH_BOOSTER',
        revenuePackageId: basicPackageId,
        revenuePackageIds: [basicPackageId, boosterPackageId],
      }
    : {
        revenueSourceType: 'BASIC',
        revenuePackageId: basicPackageId,
        revenuePackageIds: [basicPackageId],
      };
}
