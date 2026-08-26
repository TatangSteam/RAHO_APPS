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
});
