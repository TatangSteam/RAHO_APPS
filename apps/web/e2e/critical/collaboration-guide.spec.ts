import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.simulation`;
  await page.context().addCookies([{
    name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: 'guide-user' })).toString('base64'),
    url: baseURL!,
  }]);
  await page.addInitScript((accessToken) => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: {
      user: { userId: 'guide-user', email: 'guide@example.test', role: 'SUPER_ADMIN', fullName: 'Pengguna Panduan', branches: [] },
      accessToken, refreshToken: 'guide-mock-refresh', isAuthenticated: true, assignedBranches: [],
    }, version: 0 }));
  }, token);
});

test('guide is available on all three workspace pages even without a team, without writes', async ({ page }) => {
  const writes: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    if (!['GET', 'OPTIONS'].includes(route.request().method())) writes.push(route.request().method());
    const response = route.request().url().includes('/collaboration/bootstrap')
      ? { teams: [], selectedTeamId: null, tasks: [], users: [], activities: [], stats: { total: 0, todo: 0, inProgress: 0, submitted: 0, completed: 0, overdue: 0 } }
      : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: response }) });
  });
  for (const path of ['/extra/collaboration', '/extra/collaboration/tasks', '/extra/collaboration/teams']) {
    await page.goto(path);
    await page.getByRole('button', { name: 'Panduan Daily Task', exact: true }).click();
    await expect(page.getByRole('heading', { name: '1. Kenali fungsi Tim & Tugas' })).toBeVisible();
    await expect(page.getByText('Belum memilih tim?', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Bagian berikutnya' }).click();
    await expect(page.getByRole('heading', { name: '2. Baca dashboard tanpa salah mengartikan angka' })).toBeVisible();
    await page.getByRole('button', { name: 'Tutup panduan', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(0);
  }
  expect(writes).toEqual([]);
});

test('staff can read dashboard explanations on desktop and mobile without horizontal overflow', async ({ page }) => {
  const actor = { id: 'guide-user', fullName: 'Pengguna Panduan', email: 'guide@example.test', role: 'SUPER_ADMIN' };
  await page.route('**/api/v1/**', async (route) => {
    const response = route.request().url().includes('/collaboration/bootstrap') ? {
      teams: [{ id: 'guide-team', name: 'Tim Contoh', myRole: 'STAFF', taskVisibilityPolicy: 'ALL_TEAM_MEMBERS', memberships: [{ id: 'guide-membership', role: 'STAFF', status: 'ACTIVE', userId: actor.id, user: actor }] }],
      selectedTeamId: 'guide-team', tasks: [], users: [], activities: [],
      stats: { total: 0, todo: 0, inProgress: 0, submitted: 0, completed: 0, overdue: 0 },
    } : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: response }) });
  });
  await page.goto('/extra/collaboration');
  await page.getByRole('button', { name: 'Panduan Daily Task', exact: true }).click();
  await expect(page.getByText(/Anda sebagai Staff/)).toBeVisible();
  await page.getByRole('button', { name: 'Arti angka dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2. Baca dashboard tanpa salah mengartikan angka' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tugas Baru', exact: true })).toHaveCount(0);
  const guide = page.getByRole('region', { name: 'Bantuan penggunaan Daily Task' });
  await guide.screenshot({ path: test.info().outputPath('daily-task-guide-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  // The staff layout animates the desktop sidebar margin for 300ms on resize.
  // Check the settled mobile layout, not an intermediate animation frame.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await guide.screenshot({ path: test.info().outputPath('daily-task-guide-mobile.png') });
  await page.getByRole('button', { name: 'Rutinitas anggota', exact: true }).click();
  await expect(page.getByRole('heading', { name: '3. Langkah harian untuk orang yang mengerjakan tugas' })).toBeVisible();
  await page.getByRole('button', { name: 'Tutup panduan penggunaan' }).click();
  await expect(page.getByRole('button', { name: 'Panduan Daily Task', exact: true })).toBeFocused();
});
