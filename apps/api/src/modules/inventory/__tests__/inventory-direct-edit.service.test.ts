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

  it('updates operational stock and mutation without writing an inventory ledger entry', async () => {
    const tx = {
      masterProduct: {
        update: jest.fn(),
      },
      stockMutation: {
        create: jest.fn().mockResolvedValue({ id: 'mutation-1' }),
      },
      inventoryItem: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          ...currentItem,
          stock: 200,
          branch: { id: 'branch-1', name: 'Cabang HQ' },
        }),
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
    expect((tx as any).inventoryLedger).toBeUndefined();
    expect(result.item.stock).toBe(200);
  });
});
