import { Prisma } from '@prisma/client';
import {
  resolveInfusionKitAvailability,
  serializeInfusionKitAvailability,
} from '../infusion-kit-availability.service';

type Client = NonNullable<Parameters<typeof resolveInfusionKitAvailability>[1]>;

const product = (id: string, sku: string, name: string) => ({
  id,
  sku,
  name,
  isActive: true,
  category: 'DEVICE',
  unit: 'Piece',
  baseUnit: 'Piece',
  usageUnit: 'Piece',
  conversionFactor: new Prisma.Decimal(1),
  description: null,
  isAutoUsedPerSession: false,
  isAutoAddedToBranch: true,
  defaultInitialStock: null,
  baseUomId: null,
  usageUomId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('infusion kit availability', () => {
  it('calculates complete-session capacity from the bottleneck component', async () => {
    const components = [
      { sku: 'SET', quantity: 1, stock: 10 },
      { sku: 'SWAB', quantity: 2, stock: 79 },
      { sku: 'ULTRAFIK', quantity: 3, stock: 13 },
    ];
    const client = {
      masterProduct: {
        findFirst: jest.fn().mockResolvedValue({
          ...product('kit', 'PRD-INF-SET-002', 'Infus Set + Pelengkap'),
          kitComponents: components.map((item, index) => ({
            id: `link-${index}`,
            kitProductId: 'kit',
            componentProductId: `product-${index}`,
            quantity: new Prisma.Decimal(item.quantity),
            isRequired: true,
            sortOrder: index,
            createdAt: new Date(),
            updatedAt: new Date(),
            componentProduct: product(`product-${index}`, item.sku, item.sku),
          })),
        }),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue(components.map((item, index) => ({
          id: `inventory-${index}`,
          masterProductId: `product-${index}`,
          branchId: 'branch-1',
          stock: new Prisma.Decimal(item.stock),
          minThreshold: new Prisma.Decimal(0),
          storageLocation: null,
          warehouseId: null,
          stockLocationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          balances: [{
            onHandQty: new Prisma.Decimal(item.stock),
            reservedQty: new Prisma.Decimal(0),
            quarantineQty: new Prisma.Decimal(0),
          }],
        }))),
      },
    } as unknown as Client;

    const result = await resolveInfusionKitAvailability('branch-1', client);
    const serialized = serializeInfusionKitAvailability(result);

    expect(serialized.configured).toBe(true);
    expect(serialized.available).toBe(true);
    expect(serialized.availableSessionCount).toBe(4);
    expect(serialized.components.find((item) => item.sku === 'ULTRAFIK')).toMatchObject({
      requiredUsageQuantity: '3.0000',
      availableUsageQuantity: '13.0000',
      availableSessionCount: 4,
    });
  });

  it('reports an unconfigured kit without treating legacy parent stock as available', async () => {
    const client = {
      masterProduct: {
        findFirst: jest.fn().mockResolvedValue({
          ...product('kit', 'PRD-INF-SET-002', 'Infus Set + Pelengkap'),
          kitComponents: [],
        }),
      },
      inventoryItem: { findMany: jest.fn() },
    } as unknown as Client;

    const result = await resolveInfusionKitAvailability('branch-1', client);

    expect(serializeInfusionKitAvailability(result)).toMatchObject({
      configured: false,
      available: false,
      availableSessionCount: 0,
      components: [],
    });
    expect(client.inventoryItem.findMany).not.toHaveBeenCalled();
  });
});
