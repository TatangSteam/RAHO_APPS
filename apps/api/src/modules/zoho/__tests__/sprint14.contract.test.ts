import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Sprint 14 additive and local-independence contract', () => {
  it('memasang webhook sebelum authenticate dan melindungi dashboard sesudah authenticate', () => {
    const routes = read('src/modules/zoho/zoho.routes.ts');
    const publicWebhook = routes.indexOf("router.post('/webhooks/:organizationId'");
    const authentication = routes.indexOf('router.use(authenticate)');
    const inbox = routes.indexOf("router.get('/webhooks'");
    expect(publicWebhook).toBeGreaterThan(-1);
    expect(publicWebhook).toBeLessThan(authentication);
    expect(inbox).toBeGreaterThan(authentication);
  });

  it('memiliki inbox, reconciliation resumable, cutover, canary dan rollback', () => {
    const schema = read('prisma/schema.prisma');
    const reconciliation = read('src/modules/zoho/zoho.reconciliation.service.ts');
    const goLive = read('src/modules/zoho/zoho.go-live.service.ts');
    for (const model of [
      'model ZohoWebhookInbox',
      'model ZohoReconciliationRun',
      'model ZohoReconciliationResult',
      'model ZohoGoLiveControl',
    ]) expect(schema).toContain(model);
    expect(reconciliation).toContain("status: paused ? 'PAUSED' : 'FAILED'");
    expect(reconciliation).toContain('resourceIndex');
    expect(goLive).toContain("mode: 'OFF'");
    expect(goLive).toContain('mismatchFreeBusinessDays < 5');
    expect(goLive).toContain('rollbackGoLive');
  });

  it('tidak membuat flow lokal mengimpor client Zoho', () => {
    for (const file of [
      'src/modules/packages/packages.service.ts',
      'src/modules/sessions/services/session-completion.service.ts',
      'src/modules/invoices/invoices.service.ts',
      'src/modules/inventory/services/inventory-ledger.service.ts',
      'src/modules/purchasing/purchasing.service.ts',
    ]) {
      const source = read(file);
      expect(source).not.toContain('getActiveZohoClient');
      expect(source).not.toContain('ZohoClient');
    }
  });

  it('worker berhenti aman saat OFF dan membatasi event saat CANARY', () => {
    const worker = read('src/modules/zoho/zoho.worker.ts');
    expect(worker).toContain("if (gate.mode === 'OFF') return 0");
    expect(worker).toContain("gate?.mode === 'CANARY'");
    expect(worker).toContain('gate.canaryBranchIds');
  });

  it('tidak mengubah role atau permission SUPER_ADMIN yang sudah ada', () => {
    const schema = read('prisma/schema.prisma');
    const routes = read('src/modules/zoho/zoho.routes.ts');
    expect(schema).toContain('SUPER_ADMIN');
    expect(routes).toContain('PERMISSIONS.ZOHO_CONNECTION_MANAGE');
    expect(routes).toContain('PERMISSIONS.ZOHO_RECONCILE_RUN');
  });
});
