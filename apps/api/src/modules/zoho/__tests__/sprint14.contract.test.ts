import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const walkTypeScript = (relative: string): string[] => {
  const absolute = path.join(root, relative);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : walkTypeScript(child);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [child] : [];
  });
};

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
    const coreModules = [
      'src/modules/auth',
      'src/modules/packages',
      'src/modules/invoices',
      'src/modules/sessions',
      'src/modules/inventory',
      'src/modules/purchasing',
      'src/modules/accounting',
      'src/modules/expenses',
      'src/modules/revenue',
    ];
    for (const file of coreModules.flatMap(walkTypeScript)) {
      const source = read(file);
      expect(source).not.toContain('getActiveZohoClient');
      expect(source).not.toContain('ZohoClient');
      expect(source).not.toMatch(/from\s+['"][^'"]*zoho\.client['"]/);
      expect(source).not.toContain('zohoapis.');
    }
  });

  it('worker berhenti aman saat OFF dan membatasi event saat CANARY', () => {
    const worker = read('src/modules/zoho/zoho.worker.ts');
    expect(worker).toContain("if (gate.mode === 'OFF') return 0");
    expect(worker).toContain("gate?.mode === 'CANARY'");
    expect(worker).toContain('gate.canaryBranchIds');
  });

  it('fail-closed saat runtime tidak siap dan tidak kehilangan event hasil dry-run', () => {
    const goLive = read('src/modules/zoho/zoho.go-live.service.ts');
    const env = read('src/config/env.ts');
    expect(goLive).toContain("'ZOHO_WORKER_DISABLED'");
    expect(goLive).toContain("'ZOHO_RUNTIME_CONFIG_INCOMPLETE'");
    expect(goLive).toContain("source: 'CONFIGURATION_INVALID'");
    expect(goLive).toContain("mode: 'DRY_RUN'");
    expect(goLive).not.toContain("mode: env.ZOHO_SYNC_DRY_RUN ? 'DRY_RUN' : 'LIVE'");
    expect(goLive).toContain("where: { status: 'DRY_RUN' }");
    expect(goLive).toContain("status: 'PENDING'");
    expect(goLive).toContain('attempts: 0');
    expect(env).toContain('ZOHO_TOKEN_ENCRYPTION_KEY: z.preprocess(emptyStringToUndefined');
    expect(env).toContain('ZOHO_CLIENT_ID: z.preprocess(emptyStringToUndefined');
  });

  it('mengikat reconciliation ke koneksi aktif dan menghitung canary sekali per hari kerja', () => {
    const goLive = read('src/modules/zoho/zoho.go-live.service.ts');
    const schema = read('prisma/schema.prisma');
    expect(goLive).toContain('zohoConnectionId: connectionId');
    expect(goLive).toContain('zohoConnectionId: connection.id');
    expect(goLive).toContain("'ZOHO_CANARY_BUSINESS_DAY_REQUIRED'");
    expect(goLive).toContain("'ZOHO_CANARY_DAY_ALREADY_RECORDED'");
    expect(schema).toContain('lastMismatchFreeBusinessDayAt DateTime?');
  });

  it('tidak mengubah role atau permission SUPER_ADMIN yang sudah ada', () => {
    const schema = read('prisma/schema.prisma');
    const routes = read('src/modules/zoho/zoho.routes.ts');
    expect(schema).toContain('SUPER_ADMIN');
    expect(routes).toContain('PERMISSIONS.ZOHO_CONNECTION_MANAGE');
    expect(routes).toContain('PERMISSIONS.ZOHO_RECONCILE_RUN');
  });
});
