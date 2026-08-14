export type TreatmentRevenueSource = {
  revenueSourceType: 'BASIC' | 'BASIC_WITH_BOOSTER';
  revenuePackageId: string;
  revenuePackageIds: string[];
};

export function selectTreatmentPackageUsageIds(
  basicPackageId: string | null,
  boosterPackageId: string | null,
): string[] {
  if (!basicPackageId) return [];
  return boosterPackageId && boosterPackageId !== basicPackageId
    ? [basicPackageId, boosterPackageId]
    : [basicPackageId];
}

export function selectTreatmentRevenueSource(
  basicPackageId: string | null,
  boosterPackageId: string | null,
): TreatmentRevenueSource | null {
  if (!basicPackageId) return null;
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
