import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { directAdjustStock } from '@modules/inventory/services/inventory-control.service';
import { getSkuValuationLookup } from '@modules/inventory/services/logistics-report.service';
import { createAccountingPeriodService } from '@modules/accounting/accounting.service';
import { prepareAddOnInventoryForSale } from '../add-on-inventory-setup.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    masterProduct: { findMany: jest.fn() },
    accountingPeriod: { findFirst: jest.fn() },
  },
}));
jest.mock('@modules/accounting/accounting.service', () => ({
  createAccountingPeriodService: jest.fn(),
}));
jest.mock('@modules/inventory/services/inventory-control.service', () => ({
  directAdjustStock: jest.fn(),
}));
jest.mock('@modules/inventory/services/logistics-report.service', () => ({
  getSkuValuationLookup: jest.fn(),
}));
jest.mock('../package-assignment.helpers', () => ({
  physicalAddOnCatalog: () => [
    { code: 'PRD-ANN-KNG-001', inventorySku: 'PRD-ANN-KNG-001', unitsPerSale: 1 },
    { code: 'PRD-ANN-KNG-003', inventorySku: 'PRD-ANN-KNG-001', unitsPerSale: 24 },
  ],
}));

const lookup = {
  status: 'PENDING_VALUATION',
  tracksBatch: false,
  inventoryItemId: 'item-1',
  stockLocationId: 'location-1',
  valuationBatchId: null,
  mirrorQty: new Prisma.Decimal(100),
  pendingQty: new Prisma.Decimal(100),
  missingLayerQty: new Prisma.Decimal(0),
};

describe('automatic add-on inventory setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.masterProduct.findMany as jest.Mock).mockResolvedValue([{
      sku: 'PRD-ANN-KNG-001',
      defaultUnitCost: new Prisma.Decimal(15_000),
    }]);
    (getSkuValuationLookup as jest.Mock).mockResolvedValue(lookup);
    (directAdjustStock as jest.Mock).mockResolvedValue({ direct: true });
    (prisma.accountingPeriod.findFirst as jest.Mock).mockResolvedValue({ id: 'period-1', status: 'OPEN' });
    (createAccountingPeriodService as jest.Mock).mockResolvedValue({ id: 'period-1', status: 'OPEN' });
  });

  it('creates the current accounting period before valuing stock when none exists', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-22T05:00:00.000Z'));
    (prisma.accountingPeriod.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await prepareAddOnInventoryForSale('branch-1', 'super-1');

    expect(createAccountingPeriodService).toHaveBeenCalledWith('super-1', expect.objectContaining({
      periodNo: expect.any(Number),
      branchId: null,
      startDate: new Date('2026-08-31T17:00:00.000Z'),
      endDate: new Date('2026-09-30T16:59:59.999Z'),
    }));
    expect(result.accountingPeriodCreated).toBe(true);
    expect(directAdjustStock).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('values each physical SKU once with the editable master cost', async () => {
    const result = await prepareAddOnInventoryForSale('branch-1', 'super-1');

    expect(result.prepared).toBe(1);
    expect(getSkuValuationLookup).toHaveBeenCalledTimes(1);
    expect(directAdjustStock).toHaveBeenCalledWith('super-1', 'item-1', expect.objectContaining({
      adjustment: '0',
      unitCost: '15000.0000',
      stockLocationId: 'location-1',
      reasonCode: 'LEGACY_OPENING_VALUATION',
      valuationDocumentReference: 'AUTO-MASTER-COST:PRD-ANN-KNG-001',
    }));
  });

  it('does not invent a cost when the admin has not configured one', async () => {
    (prisma.masterProduct.findMany as jest.Mock).mockResolvedValue([]);

    const result = await prepareAddOnInventoryForSale('branch-1', 'super-1');

    expect(result.issues).toEqual([expect.objectContaining({
      sku: 'PRD-ANN-KNG-001',
      message: 'Harga modal bawaan belum diatur pada Master Inventori.',
    })]);
    expect(directAdjustStock).not.toHaveBeenCalled();
  });

  it('leaves stock that is already ready unchanged', async () => {
    (getSkuValuationLookup as jest.Mock).mockResolvedValue({ ...lookup, status: 'READY' });

    const result = await prepareAddOnInventoryForSale('branch-1', 'super-1');

    expect(result.results).toEqual([{ sku: 'PRD-ANN-KNG-001', status: 'READY' }]);
    expect(directAdjustStock).not.toHaveBeenCalled();
  });
});
