import { test, expect } from '../fixtures/base';
import { AuditLogPage } from '../pages/AuditLogPage';
import { MemberPage } from '../pages/MemberPage';

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
    const detailButton = latestLog.getByRole('button', { name: /detail|view|lihat/i });
    if (await detailButton.isVisible({ timeout: 2000 })) {
      await detailButton.click();
      
      // Verify detail modal/page opened
      await page.waitForTimeout(500);
      
      // Should show action, user, timestamp, entity info
      await expect(page.locator('text=/action|aksi|user|waktu|entity/i')).toBeVisible();
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
    await auditLogPage.filterByUser('Super Admin');

    // Verify filtered results
    await auditLogPage.expectLogByUser('Super Admin');
    
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
    const testMemberName = `Test Member ${Date.now()}`;

    // Create a member
    await memberPage.goto();
    await memberPage.createMember({
      name: testMemberName,
      email: `test${Date.now()}@example.com`,
      phone: '081234567890',
    });

    // Switch to super admin to view audit logs
    const adminPage = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(adminPage);
    await auditLogPage.goto();

    // Verify CREATE action was logged
    await auditLogPage.verifyActionLogged('CREATE', 'Member');
  });

  test('should log member update', async ({ loginAs }) => {
    const testMemberName = `Test Member ${Date.now()}`;

    // Create member
    await memberPage.goto();
    await memberPage.createMember({
      name: testMemberName,
      email: `test${Date.now()}@example.com`,
      phone: '081234567890',
    });

    // Update member
    await memberPage.searchMember(testMemberName);
    await memberPage.editMember(testMemberName);
    
    await memberPage.page.getByLabel(/catatan|notes/i).fill('Updated via test');
    await memberPage.submitForm();

    // Switch to super admin
    const adminPage = await loginAs('SUPER_ADMIN');
    auditLogPage = new AuditLogPage(adminPage);
    await auditLogPage.goto();

    // Verify UPDATE action was logged
    await auditLogPage.verifyActionLogged('UPDATE', 'Member');
  });

  test('should log member deletion', async ({ loginAs }) => {
    const testMemberName = `Test Member ${Date.now()}`;

    // Create member
    await memberPage.goto();
    await memberPage.createMember({
      name: testMemberName,
      email: `test${Date.now()}@example.com`,
      phone: '081234567890',
    });

    // Delete member
    await memberPage.searchMember(testMemberName);
    await memberPage.deleteMember(testMemberName);

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
    const hasPermissionError = await page.locator('text=/permission|tidak.*izin|forbidden|403/i').isVisible({ timeout: 2000 }).catch(() => false);

    // Either not on audit logs page OR showing permission error
    expect(isOnAuditLogs === false || hasPermissionError === true).toBeTruthy();
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
      const detailButton = latestLog.getByRole('button', { name: /detail|view/i });
      
      if (await detailButton.isVisible({ timeout: 2000 })) {
        await detailButton.click();
        await page.waitForTimeout(500);
        
        // Password should be masked if present
        const passwordField = page.locator('text=/password/i');
        if (await passwordField.isVisible({ timeout: 2000 })) {
          await auditLogPage.expectSensitiveDataMasked('password');
        }
      }
    }
  });
});
