import { Prisma } from '@prisma/client';

export function requiresMaterialDeviationReason(
  actualQuantity: Prisma.Decimal,
  recommendedQuantity: Prisma.Decimal | null,
  tolerancePercent: Prisma.Decimal,
  hasActiveBom: boolean,
): boolean {
  if (!hasActiveBom) return false;
  if (!recommendedQuantity) return true;
  const tolerance = recommendedQuantity.mul(tolerancePercent).div(100);
  return actualQuantity.lessThan(recommendedQuantity.sub(tolerance))
    || actualQuantity.greaterThan(recommendedQuantity.add(tolerance));
}
