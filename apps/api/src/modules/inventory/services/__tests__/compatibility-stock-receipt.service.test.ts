import { Prisma } from '@prisma/client';
import { postCompatibilityStockReceiptInTransaction } from '../compatibility-stock-reconciliation.service';

describe('postCompatibilityStockReceiptInTransaction', () => {
  it('always adds the receipt when the old ledger is greater than mirror stock', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'item-1',
          branchId: 'branch-1',
          masterProductId: 'product-1',
          stock: new Prisma.Decimal(8),
          warehouseId: 'warehouse-1',
          stockLocationId: 'location-1',
          balances: [{ onHandQty: new Prisma.Decimal(10) }],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryBalance: {
        upsert: jest.fn().mockResolvedValue({ id: 'balance-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryCostLayer: { create: jest.fn().mockResolvedValue({ id: 'layer-1' }) },
    } as any;

    const result = await postCompatibilityStockReceiptInTransaction(tx, {
      inventoryItemId: 'item-1',
      quantity: 5,
      actorUserId: 'user-1',
      sourceType: 'LEGACY_SHIPMENT_RECEIPT',
      sourceId: 'shipment-1',
    });

    expect(result.stockBefore.toFixed()).toBe('10');
    expect(result.stockAfter.toFixed()).toBe('15');
    expect(result.ledgerIncrement.toFixed()).toBe('5');
    expect(tx.inventoryBalance.update.mock.calls[0][0].data.onHandQty.increment.toFixed()).toBe('5');
    expect(tx.inventoryItem.update.mock.calls[0][0].data.stock.toFixed()).toBe('15');
  });

  it('repairs missing historical balance before adding the received quantity', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'item-1',
          branchId: 'branch-1',
          masterProductId: 'product-1',
          stock: new Prisma.Decimal(8),
          warehouseId: 'warehouse-1',
          stockLocationId: 'location-1',
          balances: [{ onHandQty: new Prisma.Decimal(3) }],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryBalance: {
        upsert: jest.fn().mockResolvedValue({ id: 'balance-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryCostLayer: { create: jest.fn().mockResolvedValue({ id: 'layer-1' }) },
    } as any;

    const result = await postCompatibilityStockReceiptInTransaction(tx, {
      inventoryItemId: 'item-1',
      quantity: 5,
      actorUserId: 'user-1',
      sourceType: 'LEGACY_SHIPMENT_RECEIPT',
      sourceId: 'shipment-1',
    });

    expect(result.stockBefore.toFixed()).toBe('8');
    expect(result.stockAfter.toFixed()).toBe('13');
    expect(result.ledgerIncrement.toFixed()).toBe('10');
    expect(tx.inventoryBalance.update.mock.calls[0][0].data.onHandQty.increment.toFixed()).toBe('10');
    expect(tx.inventoryCostLayer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceType: 'LEGACY_SHIPMENT_RECEIPT',
        sourceId: 'shipment-1',
        unitCost: null,
        valuationStatus: 'PENDING_VALUATION',
      }),
    });
  });
});
