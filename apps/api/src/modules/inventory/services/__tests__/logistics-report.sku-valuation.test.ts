import { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import { getSkuValuationLookup } from '../logistics-report.service';

jest.mock('@lib/prisma', () => ({
  prisma: {
    masterProduct: { findFirst: jest.fn() },
    inventoryItem: { findFirst: jest.fn() },
    stockLocation: { findFirst: jest.fn() },
  },
}));

describe('SKU valuation lookup for legacy inventory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.masterProduct.findFirst as jest.Mock).mockResolvedValue({
      id: 'product-1',
      sku: 'PRD-ANN-BRU-001',
      name: 'Air Nano Biru 600ml',
      baseUnit: 'Botol',
      unit: 'Botol',
      isActive: true,
      tracksBatch: false,
    });
    (prisma.inventoryItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'item-1',
      stock: new Prisma.Decimal(72),
      stockLocationId: null,
      balances: [],
    });
  });

  it('allows legacy mirror stock to be valued through the branch default location', async () => {
    (prisma.stockLocation.findFirst as jest.Mock).mockResolvedValue({ id: 'location-default' });

    await expect(getSkuValuationLookup('branch-1', 'PRD-ANN-BRU-001')).resolves.toMatchObject({
      inventoryItemId: 'item-1',
      stockLocationId: 'location-default',
      mirrorQty: new Prisma.Decimal(72),
      status: 'NO_STOCK_LOCATION',
      canValue: true,
    });
  });

  it('keeps valuation blocked when the branch has no active stock location', async () => {
    (prisma.stockLocation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(getSkuValuationLookup('branch-1', 'PRD-ANN-BRU-001')).resolves.toMatchObject({
      stockLocationId: null,
      status: 'NO_STOCK_LOCATION',
      canValue: false,
    });
  });
});
