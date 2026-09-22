import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { getAddOnAvailability } from '../add-on-availability.service';

jest.mock('@lib/prisma', () => ({ prisma: { inventoryItem: { findMany: jest.fn() } } }));

describe('physical add-on stock preview', () => {
  beforeEach(() => jest.clearAllMocks());
  it('blocks legacy-only stock without location/HPP even when the old stock counter is positive', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{ masterProduct: { sku: 'PRD-ANN-HJU-002' }, stockLocationId: null, balances: [] }]);
    const rows = await getAddOnAvailability('jakarta');
    expect(rows.find((row) => row.code === 'PRD-ANN-HJU-002')).toMatchObject({ availableUnits: 0 });
    expect(rows.find((row) => row.code === 'PRD-ANN-HJU-004')).toMatchObject({ availableUnits: 0 });
  });
  it('counts only non-expired, valued, unreserved stock and converts box units', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{
      masterProduct: { sku: 'PRD-ANN-HJU-002' }, stockLocationId: 'loc-1',
      balances: [
        { stockLocationId: 'loc-1', onHandQty: new Prisma.Decimal(25), reservedQty: new Prisma.Decimal(1), quarantineQty: new Prisma.Decimal(0), batch: null, costLayers: [{ remainingQty: new Prisma.Decimal(24) }] },
        { stockLocationId: 'loc-1', onHandQty: new Prisma.Decimal(30), reservedQty: new Prisma.Decimal(0), quarantineQty: new Prisma.Decimal(0), batch: { isBlocked: true }, costLayers: [{ remainingQty: new Prisma.Decimal(30) }] },
      ],
    }]);
    const rows = await getAddOnAvailability('jakarta');
    expect(rows.find((row) => row.code === 'PRD-ANN-HJU-002')?.availableUnits).toBe(24);
    expect(rows.find((row) => row.code === 'PRD-ANN-HJU-004')?.availableUnits).toBe(2);
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branchId: 'jakarta' }) }));
  });

  it('uses legacy H2S inventory for the current HJU add-on code', async () => {
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([{
      masterProduct: { sku: 'PRD-ANN-H2S-001' }, stockLocationId: 'loc-legacy',
      balances: [{
        stockLocationId: 'loc-legacy', onHandQty: new Prisma.Decimal(42),
        reservedQty: new Prisma.Decimal(0), quarantineQty: new Prisma.Decimal(0), batch: null,
        costLayers: [{ remainingQty: new Prisma.Decimal(42) }],
      }],
    }]);

    const rows = await getAddOnAvailability('jakarta');

    expect(rows.find((row) => row.code === 'PRD-ANN-HJU-001')).toMatchObject({ availableUnits: 42, reason: null });
    expect(rows.find((row) => row.code === 'PRD-ANN-HJU-003')).toMatchObject({ availableUnits: 1, reason: null });
  });
});
