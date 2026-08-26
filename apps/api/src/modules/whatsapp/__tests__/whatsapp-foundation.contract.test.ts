import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiRoot = resolve(__dirname, '../../../..');

describe('WhatsApp session report foundation contract', () => {
  it('keeps WhatsApp disabled by default and exposes a read-only preview', () => {
    const env = readFileSync(resolve(apiRoot, 'src/config/env.ts'), 'utf8');
    const routes = readFileSync(resolve(apiRoot, 'src/modules/sessions/sessions.routes.ts'), 'utf8');
    expect(env).toContain("WHATSAPP_ENABLED: z.enum(['true', 'false']).default('false')");
    expect(env).toContain("WHATSAPP_WORKER_ENABLED: z.enum(['true', 'false']).default('false')");
    expect(routes).toContain("'/:sessionId/whatsapp-report/preview'");
    expect(routes).toContain('controller.previewWhatsAppReport.bind(controller)');
    expect(routes).toContain("'/:sessionId/whatsapp-report'");
    expect(routes).toContain("'/:sessionId/whatsapp-deliveries'");
    expect(routes).toContain("'/:sessionId/whatsapp-consent'");
  });

  it('adds immutable encrypted delivery fields without touching old clinical rows', () => {
    const migration = readFileSync(resolve(
      apiRoot,
      'prisma/migrations/20260826150000_add_whatsapp_session_report_foundation/migration.sql',
    ), 'utf8');
    expect(migration).toContain('"recipientEncrypted" TEXT NOT NULL');
    expect(migration).toContain('"payloadEncrypted" TEXT NOT NULL');
    expect(migration).toContain('"idempotencyKey" TEXT NOT NULL');
    expect(migration).not.toContain('UPDATE "treatment_sessions"');
    expect(migration).not.toContain('DELETE FROM');
  });

  it('never returns encrypted recipient or medical payload fields to the browser', () => {
    const service = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-report.service.ts'), 'utf8');
    const safeSelect = service.slice(
      service.indexOf('const SAFE_DELIVERY_SELECT'),
      service.indexOf('async function loadTrustedSessionPhoto'),
    );
    expect(safeSelect).toContain('recipientMasked: true');
    expect(safeSelect).not.toContain('recipientEncrypted');
    expect(safeSelect).not.toContain('payloadEncrypted');
    expect(service).toContain("error.code === 'P2002'");
  });

  it('pins Baileys and implements claim, consent recheck, retry, and provider message id', () => {
    const packageJson = readFileSync(resolve(apiRoot, 'package.json'), 'utf8');
    const worker = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp.worker.ts'), 'utf8');
    const provider = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/baileys-whatsapp.provider.ts'), 'utf8');
    expect(packageJson).toContain('"@whiskeysockets/baileys": "6.7.24"');
    expect(worker).toContain('whatsAppDelivery.updateMany');
    expect(worker).toContain('communicationConsent?.whatsappTreatmentReport');
    expect(worker).toContain('WhatsAppDeliveryStatus.RETRY');
    expect(worker).toContain('providerMessageId: result.messageId');
    expect(provider).toContain('this.socket.sendMessage');
  });

  it('stores Baileys auth encrypted in PostgreSQL and limits pairing controls to super admin', () => {
    const schema = readFileSync(resolve(apiRoot, 'prisma/schema.prisma'), 'utf8');
    const repository = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-auth-state.repository.ts'), 'utf8');
    const routes = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp.routes.ts'), 'utf8');
    const runtime = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-runtime.ts'), 'utf8');
    expect(schema).toContain('model WhatsAppConnection');
    expect(schema).toContain('authStateEncrypted String?');
    expect(repository).toContain('encryptWhatsAppValue');
    expect(repository).not.toContain('useMultiFileAuthState');
    expect(routes).toContain('authorize([Role.SUPER_ADMIN])');
    expect(routes).toContain("'/connection/pair'");
    expect(runtime).toContain('WHATSAPP_WORKER_ENABLED');
  });

  it('keeps phone and default background configuration under super admin control', () => {
    const routes = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp.routes.ts'), 'utf8');
    const manager = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-connection.manager.ts'), 'utf8');
    const report = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-report.service.ts'), 'utf8');
    expect(routes).toContain('authorize([Role.SUPER_ADMIN])');
    expect(routes).toContain("router.put('/config'");
    expect(manager).toContain('updateDefaultBackground');
    expect(report).toContain('configuredBackgroundKey');
    expect(report).toContain("stale client's selection");
  });

  it('does not require doctor evaluation or completed-session status to queue a report', () => {
    const snapshot = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-snapshot.service.ts'), 'utf8');
    const report = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-report.service.ts'), 'utf8');
    expect(snapshot).toContain('doctorEvaluationIncluded');
    expect(snapshot).toContain('operationalReportReady');
    expect(report).toContain('evaluationRequired: false');
    expect(report).not.toContain('WHATSAPP_SESSION_NOT_COMPLETED');
    expect(report).toContain('WHATSAPP_REPORT_NOT_READY');
  });

  it('gives super admin safe delivery monitoring and controlled manual retry', () => {
    const routes = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp.routes.ts'), 'utf8');
    const service = readFileSync(resolve(apiRoot, 'src/modules/whatsapp/whatsapp-admin.service.ts'), 'utf8');
    expect(routes).toContain("router.get('/deliveries'");
    expect(routes).toContain("router.post('/deliveries/:deliveryId/retry'");
    expect(routes).toContain('authorize([Role.SUPER_ADMIN])');
    expect(service).toContain('recipientMasked: true');
    expect(service).not.toContain('recipientEncrypted: true');
    expect(service).not.toContain('payloadEncrypted: true');
    expect(service).toContain('whatsAppDelivery.updateMany');
    expect(service).toContain("resource: 'WhatsAppDelivery'");
    expect(service).toContain('Super Admin menjalankan retry manual delivery WhatsApp.');
  });
});
