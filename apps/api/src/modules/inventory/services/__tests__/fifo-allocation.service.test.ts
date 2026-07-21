import { Prisma } from '@prisma/client';
import { allocateFifo, FifoLayerInput, sumAllocationCost } from '../fifo-allocation.service';

function layer(
  id: string,
  receivedAt: string,
  remainingQty: string,
  unitCost: string,
): FifoLayerInput {
  return {
    id,
    inventoryBalanceId: `balance-${id}`,
    batchId: `batch-${id}`,
    receivedAt: new Date(receivedAt),
    remainingQty: new Prisma.Decimal(remainingQty),
    unitCost: new Prisma.Decimal(unitCost),
  };
}

describe('FIFO allocation', () => {
  it('allocates the oldest valid layer first and splits across layers', () => {
    const allocations = allocateFifo('7', [
      layer('L3', '2026-07-03T00:00:00Z', '5', '120'),
      layer('L1', '2026-07-01T00:00:00Z', '4', '100'),
      layer('L2', '2026-07-02T00:00:00Z', '6', '110'),
    ]);

    expect(allocations.map((allocation) => ({
      layerId: allocation.layerId,
      quantity: allocation.quantity.toFixed(4),
      totalCost: allocation.totalCost.toFixed(4),
    }))).toEqual([
      { layerId: 'L1', quantity: '4.0000', totalCost: '400.0000' },
      { layerId: 'L2', quantity: '3.0000', totalCost: '330.0000' },
    ]);
    expect(sumAllocationCost(allocations).toFixed(4)).toBe('730.0000');
  });

  it('uses id as a deterministic tie breaker', () => {
    const allocations = allocateFifo('1.5', [
      layer('B', '2026-07-01T00:00:00Z', '1', '12'),
      layer('A', '2026-07-01T00:00:00Z', '1', '10'),
    ]);
    expect(allocations.map((allocation) => allocation.layerId)).toEqual(['A', 'B']);
    expect(sumAllocationCost(allocations).toFixed(4)).toBe('16.0000');
  });

  it('preserves four-decimal quantity precision without number conversion', () => {
    const allocations = allocateFifo('0.3333', [
      layer('L1', '2026-07-01T00:00:00Z', '1.0000', '123.4567'),
    ]);
    expect(allocations[0].quantity.toFixed(4)).toBe('0.3333');
    expect(allocations[0].totalCost.toFixed(8)).toBe('41.14811811');
  });

  it('does not mutate input order or remaining quantities', () => {
    const layers = [
      layer('L2', '2026-07-02T00:00:00Z', '2', '20'),
      layer('L1', '2026-07-01T00:00:00Z', '2', '10'),
    ];
    allocateFifo('3', layers);
    expect(layers.map((item) => item.id)).toEqual(['L2', 'L1']);
    expect(layers.map((item) => item.remainingQty.toFixed())).toEqual(['2', '2']);
  });

  it('rejects an issue when valued layers are insufficient', () => {
    expect(() => allocateFifo('5', [layer('L1', '2026-07-01T00:00:00Z', '4', '100')]))
      .toThrow('Cost layer valid tidak mencukupi');
  });

  it('rejects zero and negative requested quantities', () => {
    expect(() => allocateFifo('0', [])).toThrow('lebih besar dari nol');
    expect(() => allocateFifo('-1', [])).toThrow('lebih besar dari nol');
  });
});

