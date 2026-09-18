import { expect, test } from '@playwright/test';

test('manual credentials and Excel preview/confirmed queue work without real Zoho writes', async ({ page, baseURL }) => {
  const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.simulation`;
  await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: 'excel-user' })).toString('base64'), url: baseURL! }]);
  await page.addInitScript((accessToken) => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: {
      user: { userId: 'excel-user', email: 'excel@example.test', role: 'SUPER_ADMIN', fullName: 'Pengguna Excel', branches: [] },
      accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, assignedBranches: [],
    }, version: 0 }));
  }, token);
  const writes: Array<{ path: string; data: unknown }> = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST') writes.push({ path, data: request.headers()['content-type']?.includes('json') ? request.postDataJSON() : null });
    let data: unknown = [];
    if (path.endsWith('/zoho/status')) data = { configured: true, connected: false, dryRun: true, workerEnabled: true, connections: [] };
    if (path.endsWith('/runtime/databases')) data = { activeProfileId: 'default', profiles: [{ id: 'default', label: 'ERP aktif', isActive: true }] };
    if (path.endsWith('/runtime/zoho-api-profiles')) data = { activeProfileId: null, profiles: [] };
    if (path.endsWith('/excel-import/inspect')) data = { sheets: [{ id: 1, name: 'Pelanggan', columns: [{ id: '1', label: 'Nama' }, { id: '2', label: 'Email' }] }] };
    if (path.endsWith('/excel-import/preview')) data = {
      rows: [{ rowNumber: 2, data: { name: 'Budi', email: 'budi@example.test' }, errors: [] }],
      normalizedRows: [{ rowNumber: 2, name: 'Budi', email: 'budi@example.test' }],
      validCount: 1, errorCount: 0, proof: 'simulated-proof', organization: { id: 'org-sim', name: 'Organisasi Simulasi' },
      mode: 'LIVE', readyToQueue: true, message: 'Data siap masuk antrean.',
    };
    if (path.endsWith('/excel-import/commit')) data = { queued: 1, alreadyQueued: 0, events: [] };
    if (path.endsWith('/zoho/events')) data = { items: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0 } };
    await route.fulfill({ status: path.endsWith('/excel-import/commit') ? 202 : 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });

  await page.goto('/admin/integrations/zoho');
  await page.getByRole('button', { name: '+ Input kode API Zoho', exact: true }).click();
  const form = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Input kode API Zoho secara manual' }) });
  await expect(form.getByLabel('Authorized Redirect URI')).toHaveValue(`${new URL(baseURL!).origin}/api/zoho/callback`);
  await form.getByLabel('Nama API', { exact: true }).fill('API Simulasi');
  await form.getByLabel('Client ID', { exact: true }).fill('1000.simulated-client');
  await form.getByLabel('Client Secret', { exact: true }).fill('simulated-secret-only');
  await form.getByRole('button', { name: 'Simpan kode API Zoho', exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(writes[0].data).toMatchObject({ clientId: '1000.simulated-client', clientSecret: 'simulated-secret-only' });

  await page.getByRole('button', { name: 'Impor Excel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Impor Excel ke Zoho Books' })).toBeVisible();
  await page.getByLabel('File Excel', { exact: true }).setInputFiles({ name: 'contacts.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('mock workbook; real XLSX parsing is covered by backend tests') });
  await page.getByRole('button', { name: 'Baca sheet', exact: true }).click();
  await expect(page.getByLabel('Nama', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Email (opsional)', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Lihat pratinjau', exact: true }).click();
  await expect(page.getByText(/Organisasi Simulasi \(org-sim\)/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kirim ke antrean Zoho' })).toBeDisabled();
  expect(writes.filter((entry) => entry.path.endsWith('/commit'))).toHaveLength(0);
  await page.screenshot({ path: test.info().outputPath('zoho-excel-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath('zoho-excel-mobile.png'), fullPage: true });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Kirim ke antrean Zoho' }).click();
  await expect(page.getByText(/1 baris baru masuk antrean/)).toBeVisible();
  await expect(page.getByText(/belum berarti data sudah tersimpan di Zoho/)).toBeVisible();
  expect(writes.filter((entry) => entry.path.endsWith('/commit'))).toHaveLength(1);
  await page.getByRole('button', { name: 'Lihat antrean impor' }).click();
  await expect(page.getByRole('checkbox', { name: 'Hanya impor Excel' })).toBeChecked();
  expect(writes.every((entry) => /runtime\/zoho-api-profiles|excel-import\/(inspect|preview|commit)/.test(entry.path))).toBe(true);
});
