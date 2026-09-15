import { inventoryValuationQuerySchema } from '../logistics-report.schema';

describe('Inventory valuation table filters', () => {
  it('parses pending-only and search while preserving pagination', () => {
    expect(inventoryValuationQuerySchema.parse({
      branchId: 'branch-1', pendingOnly: 'true', search: ' PRD-ANN-BRU-001 ', page: '2', limit: '25',
    })).toEqual({
      branchId: 'branch-1', pendingOnly: true, search: 'PRD-ANN-BRU-001', page: 2, limit: 25,
    });
  });

  it('rejects invalid filter values', () => {
    expect(inventoryValuationQuerySchema.safeParse({ pendingOnly: 'yes' }).success).toBe(false);
    expect(inventoryValuationQuerySchema.safeParse({ search: '   ' }).success).toBe(false);
  });
});
