import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Sprint 13 additive integration contract', () => {
  it('memisahkan consumer inventory dari finance treatment', () => {
    const session = read('src/modules/sessions/services/session-completion.service.ts');
    const handlers = read('src/modules/zoho/zoho.handlers.ts');
    expect(session).toContain('TREATMENT_INVENTORY_CONSUMED_EVENT');
    expect(session).toContain('TREATMENT_INVENTORY_REVERSED_EVENT');
    expect(handlers).toContain("registerZohoEventHandler('TREATMENT_COMPLETED', handleTreatmentCompleted)");
    expect(handlers).toContain('registerZohoEventHandler(TREATMENT_INVENTORY_CONSUMED_EVENT, handleInventoryAdjustmentEvent)');
  });

  it('mencakup treatment, adjustment manual, opname, capability dan fallback export', () => {
    const worker = read('src/modules/zoho/zoho.worker.ts');
    const routes = read('src/modules/zoho/zoho.routes.ts');
    for (const eventType of [
      'TREATMENT_INVENTORY_CONSUMED',
      'TREATMENT_INVENTORY_REVERSED',
      'INVENTORY_ADJUSTMENT_POSTED',
      'STOCK_OPNAME_POSTED',
    ]) expect(worker).toContain(eventType);
    expect(routes).toContain('/inventory-adjustments/capability/probe');
    expect(routes).toContain('/inventory-adjustments/export');
    expect(routes).toContain('/inventory-adjustments/reconcile/run');
  });

  it('tidak mengubah katalog permission atau akses SUPER_ADMIN', () => {
    const routes = read('src/modules/zoho/zoho.routes.ts');
    expect(routes).toContain('PERMISSIONS.ZOHO_SYNC_READ');
    expect(routes).toContain('PERMISSIONS.ZOHO_RECONCILE_RUN');
    expect(routes).not.toContain('SPRINT_13_');
  });
});
