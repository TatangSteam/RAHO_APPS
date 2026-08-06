export type TreatmentRevenueSource = {
  revenueSourceType: 'BASIC' | 'BASIC_WITH_BOOSTER';
  revenuePackageId: string;
  revenuePackageIds: string[];
};

export function selectTreatmentPackageUsageIds(
  basicPackageId: string,
  boosterPackageId: string | null,
): string[] {
  return boosterPackageId && boosterPackageId !== basicPackageId
    ? [basicPackageId, boosterPackageId]
    : [basicPackageId];
}

export function selectTreatmentRevenueSource(
  basicPackageId: string,
  boosterPackageId: string | null,
): TreatmentRevenueSource {
  const revenuePackageIds = selectTreatmentPackageUsageIds(basicPackageId, boosterPackageId);
  return boosterPackageId
    ? {
        revenueSourceType: 'BASIC_WITH_BOOSTER',
        revenuePackageId: basicPackageId,
        revenuePackageIds,
      }
    : {
        revenueSourceType: 'BASIC',
        revenuePackageId: basicPackageId,
        revenuePackageIds,
      };
}
