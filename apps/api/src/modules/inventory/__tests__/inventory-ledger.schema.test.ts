import { openingInventorySchema } from '../inventory-ledger.schema';

const baseOpening = {
  idempotencyKey: 'OPENING-VITC-001',
  branchId: 'branch-pusat',
  quantity: '10',
  unitCost: '100',
  currency: 'IDR',
  sourceId: 'OPENING-VITC-001',
};

describe('openingInventorySchema', () => {
  it('menerima master product yang belum memiliki inventory item cabang', () => {
    const result = openingInventorySchema.parse({
      ...baseOpening,
      masterProductId: 'product-vitamin-c',
    });

    expect(result.masterProductId).toBe('product-vitamin-c');
    expect(result.inventoryItemId).toBeUndefined();
  });

  it('tetap menerima inventory item lama untuk backward compatibility', () => {
    const result = openingInventorySchema.parse({
      ...baseOpening,
      inventoryItemId: 'inventory-item-vitamin-c',
    });

    expect(result.inventoryItemId).toBe('inventory-item-vitamin-c');
  });

  it('menolak opening tanpa product atau dengan dua target sekaligus', () => {
    expect(openingInventorySchema.safeParse(baseOpening).success).toBe(false);
    expect(openingInventorySchema.safeParse({
      ...baseOpening,
      inventoryItemId: 'inventory-item-vitamin-c',
      masterProductId: 'product-vitamin-c',
    }).success).toBe(false);
  });
});
