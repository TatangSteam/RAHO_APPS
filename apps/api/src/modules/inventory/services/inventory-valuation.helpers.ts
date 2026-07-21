import { Prisma } from '@prisma/client';

export type ValuationLayer = {
  remainingQty: Prisma.Decimal | string;
  unitCost: Prisma.Decimal | string;
  isVoided?: boolean;
  valuationStatus?: 'VALUED' | 'PENDING_VALUATION';
};

export type InTransitValuationLayer = {
  shippedQty: Prisma.Decimal | string;
  receivedQty: Prisma.Decimal | string;
  unitCost: Prisma.Decimal | string;
};

/** Reserved tidak mengubah aset; outstanding transfer layer tetap dihitung sebagai persediaan in-transit. */
export function calculateInventoryAssetValue(
  layers: ValuationLayer[],
  inTransitLayers: InTransitValuationLayer[] = [],
) {
  const onHandValue = layers.reduce((total, layer) => layer.isVoided || layer.valuationStatus === 'PENDING_VALUATION'
    ? total
    : total.add(new Prisma.Decimal(layer.remainingQty).mul(new Prisma.Decimal(layer.unitCost))), new Prisma.Decimal(0));
  return inTransitLayers.reduce((total, layer) => {
    const outstandingQty = new Prisma.Decimal(layer.shippedQty).sub(new Prisma.Decimal(layer.receivedQty));
    return outstandingQty.isPositive()
      ? total.add(outstandingQty.mul(new Prisma.Decimal(layer.unitCost)))
      : total;
  }, onHandValue);
}
