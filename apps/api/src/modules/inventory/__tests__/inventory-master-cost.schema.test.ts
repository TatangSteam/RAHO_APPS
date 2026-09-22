import { createMasterProductSchema, updateMasterProductSchema } from '../inventory-master.schema';

describe('master product default purchase cost', () => {
  it('accepts an editable positive purchase cost', () => {
    expect(updateMasterProductSchema.parse({ defaultUnitCost: '15000' })).toEqual({
      defaultUnitCost: '15000',
    });
  });

  it('allows an admin to clear the optional cost but rejects zero and negative values', () => {
    expect(updateMasterProductSchema.parse({ defaultUnitCost: null })).toEqual({ defaultUnitCost: null });
    expect(updateMasterProductSchema.safeParse({ defaultUnitCost: 0 }).success).toBe(false);
    expect(updateMasterProductSchema.safeParse({ defaultUnitCost: -1 }).success).toBe(false);
  });

  it('supports the purchase cost when a product is created', () => {
    const result = createMasterProductSchema.parse({
      sku: 'TEST-001',
      name: 'Produk Test',
      category: 'CONSUMABLE',
      baseUomId: 'uom-1',
      usageUomId: 'uom-1',
      conversionFactor: '1',
      defaultUnitCost: 20_000,
    });
    expect(result.defaultUnitCost).toBe('20000');
  });
});
