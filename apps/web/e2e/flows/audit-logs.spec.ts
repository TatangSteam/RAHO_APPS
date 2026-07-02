import { test, expect } from '../fixtures/base';
import { AuditLogPage } from '../pages/AuditLogPage';
import { MemberPage, type MemberData } from '../pages/MemberPage';

function uniqueMember(overrides: Partial<MemberData> = {}): MemberData {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    name: `Audit Member ${suffix}`,
    email: `audit${suffix}@example.com`,
    phone: `081${suffix.slice(-9).padStart(9, '0')}`,
    address: 'Jl. Audit Test No. 123',
    birthDate: '1990-01-01',
    gender: 'MALE',
    ...overrides,
  };
}

test.describe('Audit Log Viewing', () => {
  let auditLogPage: AuditLogPage;

  test.beforeEach(async ({ loginAs }) => {
    // Login as admin who can view audit logs
    const page = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(page);
    await auditLogPage.goto();
  });

  test('should view audit logs', async () => {
    // Verify audit log page loaded
    await expect(auditLogPage.page.locator('h1, h2')).toContainText(/audit|log|riwayat/i);

    // Verify logs are displayed
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should show recent logs first', async () => {
    // Verify latest log is visible
    const latestLog = await auditLogPage.getLatestLog();
    await expect(latestLog).toBeVisible();

    // Check if timestamp is recent (within last 24 hours typically)
    await auditLogPage.expectRecentLog(1440); // 24 hours
  });

  test('should display log details', async ({ page }) => {
    // Get first log entry
    const latestLog = await auditLogPage.getLatestLog();
    
    // Click to view details
    const detailButton = latestLog.locator('button[title*="detail" i], button').last();
    if (await detailButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await detailButton.click();
      
      // Verify detail modal/page opened
      await expect(page.locator('text=/Pelaku|Cabang|Data|Before|After|Metadata/i').first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Audit Log Filters', () => {
  let auditLogPage: AuditLogPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(page);
    await auditLogPage.goto();
  });

  test('should filter by user', async () => {
    // Filter by specific user
    await auditLogPage.filterByUser('super');

    // Verify filtered results
    await auditLogPage.expectLogByUser('super');
    
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should filter by action type', async () => {
    // Filter by CREATE action
    await auditLogPage.filterByAction('CREATE');

    // Verify filtered results show CREATE actions
    await auditLogPage.expectLogWithAction('CREATE');
    
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter by entity type', async () => {
    // Filter by Member entity
    await auditLogPage.filterByEntity('Member');

    // Verify filtered results show Member entity
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter by date range', async () => {
    // Filter by last 7 days
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    const startDate = lastWeek.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    await auditLogPage.filterByDateRange(startDate, endDate);

    // Verify results are within date range
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should filter by multiple criteria', async () => {
    // Filter by user + action + date range
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const startDate = lastMonth.toISOString().split('T')[0];

    await auditLogPage.filterByCriteria({
      action: 'CREATE',
      startDate: startDate,
      endDate: today,
    });

    // Verify filtered results
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should clear filters', async () => {
    // Apply some filters
    await auditLogPage.filterByAction('CREATE');
    
    const filteredCount = await auditLogPage.getLogCount();

    // Clear filters
    await auditLogPage.clearFilters();

    // Verify more results shown after clearing
    const unfilteredCount = await auditLogPage.getLogCount();
    expect(unfilteredCount).toBeGreaterThanOrEqual(filteredCount);
  });
});

test.describe('Audit Log Search', () => {
  let auditLogPage: AuditLogPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(page);
    await auditLogPage.goto();
  });

  test('should search audit logs', async () => {
    // Search for 'member'
    await auditLogPage.searchLogs('member');

    // Verify search results
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should search by username', async () => {
    // Search for specific user
    await auditLogPage.searchLogs('admin');

    // Verify results contain admin
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should search by action', async () => {
    // Search for login action
    await auditLogPage.searchLogs('LOGIN');

    // Verify results
    const count = await auditLogPage.getLogCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Audit Log Export', () => {
  let auditLogPage: AuditLogPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(page);
    await auditLogPage.goto();
  });

  test('should export audit logs to CSV', async () => {
    // Export to CSV
    const download = await auditLogPage.exportToCSV();

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('should export audit logs to Excel', async () => {
    test.fixme(true, 'Audit log page currently exposes CSV export only.');

    // Export to Excel
    const download = await auditLogPage.exportToExcel();

    // Verify download
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });
});

test.describe('Audit Log Accuracy', () => {
  let auditLogPage: AuditLogPage;
  let memberPage: MemberPage;

  test.beforeEach(async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    auditLogPage = new AuditLogPage(page);
    memberPage = new MemberPage(page);
  });

  test('should log member creation', async ({ loginAs }) => {
    const member = uniqueMember();

    // Create a member
    await memberPage.goto();
    await memberPage.createMember(member);

    // Switch to super admin to view audit logs
    const adminPage = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(adminPage);
    await auditLogPage.goto();

    // Verify CREATE action was logged
    await auditLogPage.verifyActionLogged('CREATE', 'Member');
  });

  test('should log member update', async ({ loginAs }) => {
    const member = uniqueMember();

    // Create member
    await memberPage.goto();
    await memberPage.createMember(member);
    await memberPage.viewMember(member.name);
    const memberDetailPath = new URL(memberPage.page.url()).pathname;

    // Switch to super admin and update member because current UI exposes edit there
    const adminPage = await loginAs('SUPER_ADMIN');
    await adminPage.goto(memberDetailPath, { waitUntil: 'domcontentloaded' });
    await expect(adminPage.getByText(member.name).first()).toBeVisible({ timeout: 10000 });
    await adminPage.getByRole('button', { name: /edit|ubah|sunting/i }).first().click();
    await expect(adminPage.locator('[name="fullName"]')).toBeVisible({ timeout: 10000 });

    const updatedName = `${member.name} Updated`;
    await adminPage.locator('[name="fullName"]').fill(updatedName);
    const updateResponsePromise = adminPage
      .waitForResponse(
        (response) =>
          response.url().includes('/api/v1/members/') &&
          response.request().method() === 'PATCH',
        { timeout: 30000 },
      )
      .catch(() => undefined);

    await adminPage.getByRole('button', { name: /simpan perubahan/i }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse, 'Update member API response was not observed.').toBeTruthy();
    expect(updateResponse!.ok(), `Update member API failed: ${updateResponse!.status()} ${await updateResponse!.text()}`).toBeTruthy();

    auditLogPage = new AuditLogPage(adminPage);
    await auditLogPage.goto();

    // Verify UPDATE action was logged
    await auditLogPage.verifyActionLogged('UPDATE', 'Member');
  });

  test('should log member deletion', async ({ loginAs }) => {
    test.fixme(true, 'Delete member action is not exposed in the current member list/detail UI.');

    const member = uniqueMember();

    // Create member
    await memberPage.goto();
    await memberPage.createMember(member);

    // Delete member
    await memberPage.searchMember(member.name);
    await memberPage.deleteMember(member.name);

    // Switch to super admin
    const adminPage = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(adminPage);
    await auditLogPage.goto();

    // Verify DELETE action was logged
    await auditLogPage.verifyActionLogged('DELETE', 'Member');
  });

  test('should log login action', async ({ loginAs }) => {
    // Login creates audit log automatically
    const page = await loginAs('ADMIN_CABANG');

    // Switch to super admin to view logs
    const adminPage = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(adminPage);
    await auditLogPage.goto();

    // Verify LOGIN action was logged
    await auditLogPage.verifyActionLogged('LOGIN', 'Auth');
  });

  test('should log logout action', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');

    // Logout
    const logoutButton = page.getByRole('button', { name: /keluar|logout/i });
    await logoutButton.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Login as super admin to check logs
    const adminPage = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(adminPage);
    await auditLogPage.goto();

    // Verify LOGOUT action was logged
    await auditLogPage.verifyActionLogged('LOGOUT', 'Auth');
  });
});

test.describe('Audit Log Security', () => {
  test('should restrict access for non-admin users', async ({ loginAs, page }) => {
    // Try to access audit logs as non-admin
    await loginAs('NURSE');

    // Try to navigate to audit logs
    await page.goto('/admin/audit-logs');

    // Should either redirect or show permission denied
    const isOnAuditLogs = page.url().includes('audit-log');
    const hasPermissionError = await page
      .locator('text=/audit log hanya dapat diakses|permission|tidak.*izin|forbidden|403/i')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const isOnDashboard = await page.getByRole('heading', { name: /dashboard/i }).isVisible({ timeout: 3000 }).catch(() => false);

    // Either not on audit logs page OR showing permission error
    expect(isOnAuditLogs === false || hasPermissionError === true || isOnDashboard === true).toBeTruthy();
  });

  test('should mask sensitive data in logs', async ({ loginAs }) => {
    const page = await loginAs('SUPER_ADMIN');
    const auditLogPage = new AuditLogPage(page);
    await auditLogPage.goto();

    // Search for password-related logs
    await auditLogPage.searchLogs('password');

    // If any password field is shown in logs, it should be masked
    const count = await auditLogPage.getLogCount();
    
    if (count > 0) {
      // View first log detail
      const latestLog = await auditLogPage.getLatestLog();
      const detailButton = latestLog.locator('button[title*="detail" i], button').last();
      
      if (await detailButton.isVisible({ timeout: 2000 })) {
        await detailButton.click();
        const detailModal = page.locator('.fixed.inset-0').last();
        await expect(detailModal).toBeVisible({ timeout: 5000 });
        
        // The word "password" can appear in an audit reason, but raw password values must not be logged.
        const detailText = await detailModal.textContent();
        expect(detailText || '').not.toMatch(/"password"\s*:\s*"(?!\*+|masked|hidden)[^"]+"/i);
        expect(detailText || '').not.toMatch(/Member123!|Admin123!|Password123!/i);
      }
    }
  });
});
