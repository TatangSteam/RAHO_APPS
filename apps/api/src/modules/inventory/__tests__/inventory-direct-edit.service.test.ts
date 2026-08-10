import { prisma } from '../../../lib/prisma';
import { InventoryItemsService } from '../services/inventory-items.service';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    inventoryItem: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prismaMock = prisma as any;

describe('InventoryItemsService direct stock edit', () => {
  const service = new InventoryItemsService();
  const currentItem = {
    id: 'inventory-item-1',
    masterProductId: 'master-product-1',
    branchId: 'branch-1',
    stock: 0,
    minThreshold: 10,
    storageLocation: null,
    warehouseId: 'warehouse-1',
    stockLocationId: 'location-1',
    masterProduct: {
      name: 'IFA + NO 2,5ml',
      category: 'MEDICINE',
      unit: 'Botol',
      baseUnit: 'Botol',
      usageUnit: 'Botol',
      conversionFactor: 1,
      description: null,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a direct stock edit when the caller is not a Super Admin', async () => {
    await expect(service.updateInventoryItem(
      currentItem.id,
      {
        stock: 200,
        stockAdjustmentNotes: 'Koreksi stok fisik',
      },
      'manager-1',
      false,
    )).rejects.toMatchObject({
      status: 403,
      code: 'DIRECT_STOCK_UPDATE_FORBIDDEN',
    });

    expect(prismaMock.inventoryItem.findUnique).not.toHaveBeenCalled();
  });

  it('updates operational stock and reconciles the authoritative inventory ledger', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      masterProduct: {
        update: jest.fn(),
      },
      stockMutation: {
        create: jest.fn().mockResolvedValue({ id: 'mutation-1' }),
      },
      inventoryItem: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn()
          .mockResolvedValueOnce({
            id: currentItem.id,
            branchId: currentItem.branchId,
            masterProductId: currentItem.masterProductId,
            stock: currentItem.stock,
            warehouseId: currentItem.warehouseId,
            stockLocationId: currentItem.stockLocationId,
            balances: [],
          })
          .mockResolvedValueOnce({
          ...currentItem,
          stock: 200,
          branch: { id: 'branch-1', name: 'Cabang HQ' },
          }),
      },
      inventoryBalance: {
        upsert: jest.fn().mockResolvedValue({ id: 'balance-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryCostLayer: {
        create: jest.fn().mockResolvedValue({ id: 'layer-1' }),
      },
    };

    prismaMock.inventoryItem.findUnique.mockResolvedValue(currentItem);
    prismaMock.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await service.updateInventoryItem(
      currentItem.id,
      {
        stock: 200,
        stockAdjustmentNotes: 'Koreksi stok fisik',
      },
      'super-admin-1',
      true,
    );

    expect(tx.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: currentItem.id },
      data: { stock: 200 },
    });
    expect(tx.stockMutation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryItemId: currentItem.id,
        type: 'ADJUSTMENT',
        stockBefore: 0,
        stockAfter: 200,
        quantity: 200,
        referenceType: 'SuperAdminDirectEdit',
        referenceId: 'super-admin-1',
        notes: 'Koreksi stok fisik',
        createdBy: 'super-admin-1',
      }),
    });
    expect(tx.inventoryBalance.update).toHaveBeenCalledWith({
      where: { id: 'balance-1' },
      data: { onHandQty: { increment: expect.objectContaining({}) }, version: { increment: 1 } },
    });
    expect(tx.inventoryCostLayer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        inventoryBalanceId: 'balance-1',
        originalQty: expect.objectContaining({}),
        remainingQty: expect.objectContaining({}),
        unitCost: null,
        valuationStatus: 'PENDING_VALUATION',
      }),
    });
    expect(result.item.stock).toBe(200);
  });

  it('repairs a missing ledger balance when the visible stock value is saved unchanged', async () => {
    const itemWithVisibleStock = { ...currentItem, stock: 200 };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      masterProduct: { update: jest.fn() },
      stockMutation: { create: jest.fn() },
      inventoryItem: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn()
          .mockResolvedValueOnce({
            id: itemWithVisibleStock.id,
            branchId: itemWithVisibleStock.branchId,
            masterProductId: itemWithVisibleStock.masterProductId,
            stock: itemWithVisibleStock.stock,
            warehouseId: itemWithVisibleStock.warehouseId,
            stockLocationId: itemWithVisibleStock.stockLocationId,
            balances: [],
          })
          .mockResolvedValueOnce({
            ...itemWithVisibleStock,
            branch: { id: 'branch-1', name: 'Cabang HQ' },
          }),
      },
      inventoryBalance: {
        upsert: jest.fn().mockResolvedValue({ id: 'balance-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryCostLayer: { create: jest.fn().mockResolvedValue({ id: 'layer-1' }) },
    };
    prismaMock.inventoryItem.findUnique.mockResolvedValue(itemWithVisibleStock);
    prismaMock.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));

    await service.updateInventoryItem(
      itemWithVisibleStock.id,
      { stock: 200, stockAdjustmentNotes: 'Sinkronisasi saldo ledger' },
      'super-admin-1',
      true,
    );

    expect(tx.inventoryBalance.update).toHaveBeenCalled();
    expect(tx.stockMutation.create).not.toHaveBeenCalled();
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
  });
});
