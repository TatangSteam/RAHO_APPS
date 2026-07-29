export type TreatmentRevenueSource = {
  revenueSourceType: 'BASIC' | 'BOOSTER';
  revenuePackageId: string;
};

export function selectTreatmentRevenueSource(
  basicPackageId: string,
  boosterPackageId: string | null,
): TreatmentRevenueSource {
  return boosterPackageId
    ? { revenueSourceType: 'BOOSTER', revenuePackageId: boosterPackageId }
    : { revenueSourceType: 'BASIC', revenuePackageId: basicPackageId };
}
