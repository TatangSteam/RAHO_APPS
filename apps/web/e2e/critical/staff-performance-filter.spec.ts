import { expect, test } from '../fixtures/base';

test('filters staff session history and export by named MSO and Nakes', async ({ page }) => {
  const branchId = 'branch-1';
  const token = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  await page.context().addCookies([{ name: 'raho-auth-token', value: Buffer.from(JSON.stringify({ role: 'SUPER_ADMIN', userId: 'user-1' })).toString('base64'), domain: 'localhost', path: '/' }]);
  await page.addInitScript(({ accessToken, selectedBranchId }) => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { userId: 'user-1', email: 'superadmin@raho.id', role: 'SUPER_ADMIN', branchId: selectedBranchId, branchCode: 'HQ', fullName: 'Super Administrator', staffCode: null, branches: [selectedBranchId] }, accessToken, refreshToken: 'mock-refresh', isAuthenticated: true, activeBranchId: selectedBranchId, assignedBranches: [selectedBranchId] }, version: 0 }));
  }, { accessToken: token, selectedBranchId: branchId });

  const historyQueries: string[] = [];
  let exportQuery = '';
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/users/staff/ADMIN_LAYANAN')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ userId: 'mso-2', staffCode: 'MSO-2', fullName: 'MSO Kedua' }] }) });
      return;
    }
    if (url.includes('/users/staff/NURSE')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [{ userId: 'nakes-2', staffCode: 'NAKES-2', fullName: 'Nakes Kedua' }] }) });
      return;
    }
    if (url.includes('/users/performance/doctor-1/history/export')) {
      exportQuery = url;
      await route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers: { 'Content-Disposition': 'attachment; filename="detail-kinerja-test.xlsx"' }, body: 'mock workbook' });
      return;
    }
    if (url.includes('/users/performance/doctor-1/history')) {
      historyQueries.push(url);
      const response = {
        staff: { id: 'doctor-1', email: 'doctor@example.test', role: 'DOCTOR', staffCode: 'DOC-1', fullName: 'Dokter Pertama', phone: '', avatarUrl: null, branch: { id: branchId, branchCode: 'BR1', name: 'Cabang Satu' } },
        summary: { asDoctor: 1, asNurse: 0, asAdminLayanan: 0, asOperational: 0, total: 1, incomplete: 0 },
        sessions: [{ id: 'session-1', sessionCode: 'SES-001', infusKe: 1, pelaksanaan: 'ON_SITE', treatmentDate: '2026-08-08T03:00:00.000Z', isCompleted: true, branch: { id: branchId, branchCode: 'BR1', name: 'Cabang Satu' }, member: { memberNo: 'MEM-001', fullName: 'Member Satu' }, package: { packageType: 'BASIC', boosterType: null }, positions: ['doctor'], mso: { id: 'mso-2', fullName: 'MSO Kedua' }, nakes: [{ id: 'nakes-1', fullName: 'Nakes Pertama' }, { id: 'nakes-2', fullName: 'Nakes Kedua' }] }],
        total: 1, page: 1, limit: 20, dateRange: { startDate: null, endDate: null },
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: response }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.goto('/staff-performance/doctor-1?branchId=branch-1');
  await expect(page.getByText('MSO: MSO Kedua')).toBeVisible();
  await expect(page.getByText('Nakes: Nakes Pertama, Nakes Kedua')).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter nama MSO' }).selectOption('mso-2');
  await page.getByRole('combobox', { name: 'Filter nama Nakes' }).selectOption('nakes-2');
  await expect.poll(() => historyQueries.some((url) => url.includes('msoId=mso-2') && url.includes('nakesId=nakes-2'))).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Detail Sesi' }).click();
  await downloadPromise;
  expect(exportQuery).toContain('msoId=mso-2');
  expect(exportQuery).toContain('nakesId=nakes-2');
});
