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
});
