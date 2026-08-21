import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Sprint 10 logistics reporting contract', () => {
  const apiRoot = resolve(process.cwd());
  const service = readFileSync(resolve(apiRoot, 'src/modules/inventory/services/logistics-report.service.ts'), 'utf8');
  const routes = readFileSync(resolve(apiRoot, 'src/modules/inventory/inventory.routes.ts'), 'utf8');
  const page = readFileSync(resolve(apiRoot, '../web/src/app/(staff)/inventory/dashboard/page.tsx'), 'utf8');
  const migration = readFileSync(resolve(apiRoot, 'prisma/migrations/20260722170000_logistics_reporting_indexes/migration.sql'), 'utf8');

  it('exposes dashboard, stock-card, and valuation read endpoints', () => {
    expect(routes).toContain("'/reports/logistics-dashboard'");
    expect(routes).toContain("'/reports/stock-card'");
    expect(routes).toContain("'/reports/valuation'");
    expect(routes.match(/PERMISSIONS\.INVENTORY_READ/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('sources logistics metrics from operational ledgers', () => {
    for (const source of [
      'inventoryBalance.findMany',
      'inventoryPosting.findMany',
      'inventoryCostLayer.findMany',
      'materialUsage.findMany',
      'stockRequest.findMany',
      'shipment.findMany',
      'shipmentDiscrepancy.findMany',
      'stockOpname.findMany',
    ]) expect(service).toContain(source);
    expect(service).toContain('totalAssetValue: layerValue.add(inTransitValue)');
  });

  it('ships all three operational views and report indexes', () => {
    expect(page).toContain("type View = 'OVERVIEW' | 'STOCK_CARD' | 'VALUATION'");
    expect(page).toContain('Top Material Usage');
    expect(page).toContain('Shipment Metrics');
    expect(migration).toContain('material_usages_status_consumedAt_idx');
    expect(migration).toContain('stock_mutations_inventoryItemId_inventoryPostingId_idx');
  });

  it('does not present partial or missing valuation as a final zero value', () => {
    expect(page).toContain("dashboardValuationComplete ? currency(dashboard.valuation.totalAssetValue) : 'Belum lengkap'");
    expect(page).toContain('Nilai inventory belum lengkap.');
    expect(page).toContain('Pending valuation');
    expect(page).toContain("row.averageUnitCost === null ? 'Belum dinilai'");
    expect(page).toContain('Mismatch quantity/layer');
  });
});
