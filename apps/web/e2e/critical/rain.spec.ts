import { expect, test } from '../fixtures/base';

const userId = 'rain-user';
async function login(page: import('@playwright/test').Page, role = 'ADMIN_LAYANAN') {
  const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  const adminManagerAccessScope = role === 'ADMIN_MANAGER' ? 'MEMBER_VIEW_ONLY' : undefined;
  await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role, userId, adminManagerAccessScope })).toString('base64'), domain: 'localhost', path: '/' }]);
  await page.addInitScript(({ accessToken, roleName, id }) => {
    // Isolate chat from the existing once-per-login clinical reminder popup.
    sessionStorage.setItem(`raho:unfinished-session-reminder:shown:${id}`, 'true');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { userId: id, email: 'rain@example.test', role: roleName, adminManagerAccessScope: roleName === 'ADMIN_MANAGER' ? 'MEMBER_VIEW_ONLY' : undefined, branchId: 'branch-hq', branchCode: 'HQ', fullName: 'RAIN User', staffCode: 'MSO001', branches: ['branch-hq'] }, accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, activeBranchId: 'branch-hq', assignedBranches: ['branch-hq'] }, version: 0 }));
  }, { accessToken: token, roleName: role, id: userId });
}
const base = { contractVersion: 'rain.v1', success: true, source: 'erp', isDemo: false, asOf: '2026-09-16T14:30:00+07:00', user: { id: userId }, mode: 'rules' };

for (const role of ['ADMIN_MANAGER', 'VOUCHER_OPERATOR']) {
  test(`RAIN remains accessible for restricted internal role ${role}`, async ({ page }) => {
    await login(page, role);
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }));
    await page.goto('/extra/rain');
    await expect(page.getByRole('heading', { name: 'RAIN', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'RAIN · Asisten Task' })).toHaveAttribute('href', '/extra/rain');
    await expect(page).toHaveURL(/\/extra\/rain$/);
  });
}

test('RAIN is accessible under Extra for MSO, answers ERP results and stays usable on mobile', async ({ page }) => {
  await login(page);
  let payload: Record<string, unknown> = {};
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().url().includes('/ai/chat')) {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...base, intent: 'performance', reply: 'Hari ini ada 8 task, 5 selesai. Completion rate 71,4%.', context: null, data: { performance: { totalTasks: 8, completed: 5, completionRate: 71.4 } } }) });
    } else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.goto('/extra/rain');
  await expect(page.getByRole('heading', { name: 'RAIN', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'RAIN · Asisten Task' })).toHaveAttribute('href', '/extra/rain');
  await expect(page.getByRole('navigation').getByText('Ekstra', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kinerja hari ini', exact: true }).click();
  await expect(page.getByText('Hari ini ada 8 task, 5 selesai. Completion rate 71,4%.')).toBeVisible();
  expect(payload).toEqual({ message: 'Kinerja hari ini' });
  await page.setViewportSize({ width: 390, height: 844 });
  // Wait for the shared layout's sidebar-margin transition after viewport resize.
  await expect.poll(() => page.getByRole('heading', { name: 'RAIN', exact: true }).evaluate((element) => element.getBoundingClientRect().left)).toBeLessThan(40);
  await expect(page.getByRole('button', { name: 'Kirim', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: test.info().outputPath('rain-mobile.png'), fullPage: true });
});

test('RAIN continues task lists with filter context and never sends another user identity', async ({ page }) => {
  await login(page);
  const payloads: Record<string, unknown>[] = [];
  await page.route('**/api/v1/**', async (route) => {
    if (!route.request().url().includes('/ai/chat')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }); return;
    }
    payloads.push(route.request().postDataJSON());
    const first = payloads.length === 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...base, intent: 'tasks', reply: first ? 'Ada 11 task. Ketik lanjut.' : 'Hasil berikutnya.',
      context: first ? { intent: 'tasks', period: 'today', limit: 10, offset: 10 } : null,
      data: { tasks: [{ id: first ? 'task-1' : 'task-11', taskNo: first ? 1 : 11, title: first ? 'Cek layanan' : 'Cek laporan', status: 'TODO', priority: 'HIGH', dueAt: '2026-09-16T10:00:00+07:00', completedAt: null, parentTaskId: null, overdue: true }], pagination: { total: 11, nextOffset: first ? 10 : null } },
    }) });
  });
  await page.goto('/extra/rain');
  await page.getByRole('button', { name: 'Daftar task hari ini', exact: true }).click();
  await expect(page.getByText('Cek layanan', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lanjut hasil berikutnya' }).click();
  await expect(page.getByText('Cek laporan', { exact: true })).toBeVisible();
  expect(payloads[1]).toEqual({ message: 'lanjut', context: { intent: 'tasks', period: 'today', limit: 10, offset: 10 } });
  await expect(page.getByRole('button', { name: 'Lanjut hasil berikutnya' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bersihkan percakapan' }).click();
  await expect(page.getByText('Cek laporan', { exact: true })).toHaveCount(0);
});

test('RAIN reports service errors without claiming zero tasks and lets users retry', async ({ page }) => {
  await login(page);
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().url().includes('/ai/chat')) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Data task belum dapat dimuat.' } }) });
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.goto('/extra/rain');
  await page.getByRole('button', { name: 'Kinerja hari ini', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Data task belum dapat dimuat.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Pertanyaan untuk RAIN' })).toHaveValue('Kinerja hari ini');
  await expect(page.getByRole('button', { name: 'Kirim', exact: true })).toBeEnabled();
  await expect(page.getByText('0 task', { exact: true })).toHaveCount(0);
});
