import { envSchema } from '../env';

describe('optional Zoho environment', () => {
  it('tetap mengizinkan API start ketika seluruh konfigurasi Zoho opsional kosong', () => {
    const parsed = envSchema.safeParse({
      ...process.env,
      ZOHO_CLIENT_ID: '',
      ZOHO_CLIENT_SECRET: '',
      ZOHO_REDIRECT_URI: '',
      ZOHO_TOKEN_ENCRYPTION_KEY: '',
      ZOHO_WEB_REDIRECT_URL: '',
      ZOHO_WEBHOOK_SECRET: '',
      ZOHO_SYNC_WORKER_ENABLED: 'false',
      ZOHO_RECONCILIATION_ENABLED: 'false',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.ZOHO_CLIENT_ID).toBeUndefined();
    expect(parsed.data.ZOHO_CLIENT_SECRET).toBeUndefined();
    expect(parsed.data.ZOHO_REDIRECT_URI).toBeUndefined();
    expect(parsed.data.ZOHO_TOKEN_ENCRYPTION_KEY).toBeUndefined();
    expect(parsed.data.ZOHO_WEB_REDIRECT_URL).toBeUndefined();
    expect(parsed.data.ZOHO_WEBHOOK_SECRET).toBeUndefined();
    expect(parsed.data.ZOHO_SYNC_WORKER_ENABLED).toBe(false);
    expect(parsed.data.ZOHO_RECONCILIATION_ENABLED).toBe(false);
  });
});
