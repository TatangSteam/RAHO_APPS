import { Prisma } from '@prisma/client';

export type ValuationLayer = {
  remainingQty: Prisma.Decimal | string;
  unitCost: Prisma.Decimal | string;
  isVoided?: boolean;
  valuationStatus?: 'VALUED' | 'PENDING_VALUATION';
};

/** Nilai aset hanya bersumber dari cost layer; reserved quantity tidak memindahkan atau mengurangi aset. */
export function calculateInventoryAssetValue(layers: ValuationLayer[]) {
  return layers.reduce((total, layer) => layer.isVoided || layer.valuationStatus === 'PENDING_VALUATION'
    ? total
    : total.add(new Prisma.Decimal(layer.remainingQty).mul(new Prisma.Decimal(layer.unitCost))), new Prisma.Decimal(0));
}
