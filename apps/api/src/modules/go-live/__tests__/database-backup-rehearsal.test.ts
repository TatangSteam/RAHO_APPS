import { createRequire } from 'module';

type TableSnapshot = {
  rowCount: number;
  hashSeed0: string;
  hashSeed104729: string;
};

type RehearsalModule = {
  criticalTables: string[];
  businessTotalQueries: Record<string, string>;
  assertSnapshotsMatch(source: Record<string, TableSnapshot>, restored: Record<string, TableSnapshot>): void;
  assertBusinessTotalsMatch(source: Record<string, string>, restored: Record<string, string>): void;
};

const requireFromHere = createRequire(__filename);
const rehearsal = requireFromHere('../../../../scripts/rehearse-database-backup.cjs') as RehearsalModule;

describe('database backup rehearsal safety contract', () => {
  it('covers critical legacy, finance, and logistics tables', () => {
    expect(rehearsal.criticalTables).toEqual(expect.arrayContaining([
      'members',
      'member_packages',
      'invoices',
      'invoice_payments',
      'cash_bank_transactions',
      'expenses',
      'purchase_orders',
      'goods_receipts',
      'supplier_invoices',
      'supplier_payments',
      'inventory_items',
      'inventory_balances',
      'stock_requests',
      'stock_reservations',
      'shipments',
      'treatment_sessions',
      'material_usages',
      'package_revenue_contracts',
      'deferred_revenue_movements',
      'journal_entries',
      'journal_lines',
    ]));
  });

  it('covers monetary and quantity control totals', () => {
    expect(Object.keys(rehearsal.businessTotalQueries)).toEqual(expect.arrayContaining([
      'invoices.total_amount',
      'payments.verified_amount',
      'cash_bank.posted_amount',
      'supplier_invoices.balance_amount',
      'inventory.on_hand',
      'inventory.cost_layer_value',
      'journals.posted_debit',
      'journals.posted_credit',
      'deferred.remaining',
    ]));
  });

  it('rejects a restore when row content changes even if row count stays equal', () => {
    const source = Object.fromEntries(rehearsal.criticalTables.map((table) => [table, {
      rowCount: 1,
      hashSeed0: '100',
      hashSeed104729: '200',
    }]));
    const restored = structuredClone(source);
    restored.invoices.hashSeed0 = '101';

    expect(() => rehearsal.assertSnapshotsMatch(source, restored)).toThrow('Restore table snapshot mismatch');
  });

  it('rejects a restore when a Finance or Logistics control total changes', () => {
    const source = Object.fromEntries(Object.keys(rehearsal.businessTotalQueries).map((key) => [key, '100.00']));
    const restored = { ...source, 'inventory.on_hand': '99.0000' };

    expect(() => rehearsal.assertBusinessTotalsMatch(source, restored)).toThrow('Restore business-total mismatch');
  });
});
