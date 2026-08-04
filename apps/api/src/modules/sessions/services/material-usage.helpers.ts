import { Prisma } from '@prisma/client';

type ValuedBalance = {
  onHandQty: Prisma.Decimal;
  reservedQty: Prisma.Decimal;
  quarantineQty: Prisma.Decimal;
  costLayers: Array<{ remainingQty: Prisma.Decimal }>;
};

export function calculateValuedAvailableBaseQuantity(balances: ValuedBalance[]): Prisma.Decimal {
  return balances.reduce((total, balance) => {
    const balanceAvailable = balance.onHandQty
      .sub(balance.reservedQty)
      .sub(balance.quarantineQty);
    const valuedLayerQuantity = balance.costLayers.reduce(
      (sum, layer) => sum.add(layer.remainingQty),
      new Prisma.Decimal(0),
    );
    const allocatable = Prisma.Decimal.min(balanceAvailable, valuedLayerQuantity);
    return allocatable.isPositive() ? total.add(allocatable) : total;
  }, new Prisma.Decimal(0));
}

export function calculatePhysicalAvailableBaseQuantity(balances: ValuedBalance[]): Prisma.Decimal {
  return balances.reduce((total, balance) => {
    const available = balance.onHandQty
      .sub(balance.reservedQty)
      .sub(balance.quarantineQty);
    return available.isPositive() ? total.add(available) : total;
  }, new Prisma.Decimal(0));
}

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
