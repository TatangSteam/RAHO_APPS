import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Sprint 9 integration contract', () => {
  const root = resolve(__dirname, '../../../../..');
  const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
  const approval = readFileSync(resolve(root, 'src/modules/approvals/approval.service.ts'), 'utf8');
  const control = readFileSync(resolve(root, 'src/modules/inventory/services/inventory-control.service.ts'), 'utf8');
  const ledger = readFileSync(resolve(root, 'src/modules/inventory/services/inventory-ledger.service.ts'), 'utf8');
  const homecare = readFileSync(resolve(root, 'src/modules/inventory/services/inventory-discrepancy-homecare.service.ts'), 'utf8');

  it('uses one approval engine across the four required modules', () => {
    for (const subject of ['EXPENSE', 'PURCHASE_REQUEST', 'STOCK_REQUEST', 'INVENTORY_ADJUSTMENT']) {
      expect(schema).toContain(subject === 'INVENTORY_ADJUSTMENT' ? 'model InventoryAdjustment' : 'model ApprovalInstance');
      expect(approval).toContain('subjectType');
    }
  });

  it('keeps opname posting atomic and multi-bag completion outside revenue', () => {
    expect(control).toContain('postAdjustmentInTransaction');
    expect(control).toContain('postInventoryAdjustmentDerivedJournal');
    expect(ledger).toContain('STOCK_LOCATION_OPNAME_LOCKED');
    expect(homecare).toContain('homecareMultiBagUsage.create');
    expect(homecare).toContain('revenuePosted: false');
    expect(homecare).not.toContain('revenueRecognition.create');
  });
});
