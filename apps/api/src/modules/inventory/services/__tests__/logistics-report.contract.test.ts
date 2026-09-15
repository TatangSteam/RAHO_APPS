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
    expect(page).toContain('valuedCost(row.averageUnitCost)');
    expect(page).toContain("Number.isFinite(parsed) ? parsed : null");
    expect(page).toContain('Mismatch quantity/layer');
  });

  it('makes pending valuation actionable without changing stock quantity or the full-scope summary', () => {
    expect(service).toContain('prisma.inventoryBalance.count({ where: rowWhere })');
    expect(service).toMatch(/prisma\.inventoryBalance\.aggregate\(\{\s+where: balanceWhere/);
    expect(service).toMatch(/prisma\.inventoryBalance\.findMany\(\{\s+where: rowWhere/);
    expect(page).toContain('pendingOnly, search: appliedSearch || undefined, page: valuationPage, limit: 25');
    expect(page).toContain('inventoryApi.valueLegacyStock(valuationTarget.inventoryItemId');
    expect(page).toContain('adjustment: 0');
    expect(page).toContain("reasonCode: 'LEGACY_OPENING_VALUATION'");
  });

  it('finds a searched SKU even when its balance has no active cost layer', () => {
    expect(service).toContain('getSkuValuationLookup(query.branchId, query.search)');
    expect(service).toContain("status: 'NOT_ASSIGNED_TO_BRANCH'");
    expect(service).toContain("status: 'NO_LEDGER_BALANCE'");
    expect(service).toContain("status: 'NO_COST_LAYER'");
    expect(service).toMatch(/onHandQty: \{ gt: 0 \}, costLayers: \{ none: \{ remainingQty:/);
    expect(service).toContain('missingCostLayerQty,');
    expect(page).toContain('skuStatusHint(skuLookup)');
    expect(page).toContain('hasMissingCostLayer(row)');
  });
});
