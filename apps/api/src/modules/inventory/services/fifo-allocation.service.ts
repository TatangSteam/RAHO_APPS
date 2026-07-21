import { Prisma } from '@prisma/client';
import { errors } from '@middleware/errorHandler';

export interface FifoLayerInput {
  id: string;
  inventoryBalanceId: string;
  batchId: string | null;
  receivedAt: Date;
  remainingQty: Prisma.Decimal;
  unitCost: Prisma.Decimal;
}

export interface FifoAllocation {
  layerId: string;
  inventoryBalanceId: string;
  batchId: string | null;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
}

function compareLayers(left: FifoLayerInput, right: FifoLayerInput): number {
  const byDate = left.receivedAt.getTime() - right.receivedAt.getTime();
  return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
}

export function allocateFifo(
  requestedQuantity: Prisma.Decimal.Value,
  layers: FifoLayerInput[],
): FifoAllocation[] {
  const requested = new Prisma.Decimal(requestedQuantity);
  if (requested.lessThanOrEqualTo(0)) {
    throw errors.badRequest('INVALID_QUANTITY', 'Quantity issue harus lebih besar dari nol.');
  }

  let remaining = requested;
  const allocations: FifoAllocation[] = [];

  for (const layer of [...layers].sort(compareLayers)) {
    if (remaining.isZero()) break;
    if (!layer.remainingQty.isPositive() || layer.unitCost.isNegative()) continue;

    const quantity = Prisma.Decimal.min(layer.remainingQty, remaining);
    allocations.push({
      layerId: layer.id,
      inventoryBalanceId: layer.inventoryBalanceId,
      batchId: layer.batchId,
      quantity,
      unitCost: layer.unitCost,
      totalCost: quantity.mul(layer.unitCost),
    });
    remaining = remaining.sub(quantity);
  }

  if (!remaining.isZero()) {
    throw errors.unprocessable(
      'INSUFFICIENT_VALUED_STOCK',
      `Cost layer valid tidak mencukupi. Kurang ${remaining.toFixed(4)} unit.`,
    );
  }

  return allocations;
}

export function sumAllocationCost(allocations: FifoAllocation[]): Prisma.Decimal {
  return allocations.reduce(
    (total, allocation) => total.add(allocation.totalCost),
    new Prisma.Decimal(0),
  );
}
