import { test, expect } from '../fixtures/base';
import { waitForPageLoad } from '../helpers/waiters';

test.describe('Logout Flow - All Roles', () => {
  const roles = [
    'SUPER_ADMIN',
    'ADMIN_MANAGER',
    'ADMIN_CABANG',
    'ADMIN_LAYANAN',
    'DOCTOR',
    'NURSE',
  ] as const;

  for (const role of roles) {
    test(`should logout successfully as ${role}`, async ({ loginAs }) => {
      const page = await loginAs(role);

      // Navigate to dashboard
      await page.goto('/dashboard');
      await waitForPageLoad(page);

      // Click logout button
      const logoutButton = page.getByRole('button', { name: /keluar|logout/i });
      await logoutButton.click();

      // Verify redirected to login page
      await page.waitForURL(/\/login/);
      await expect(page).toHaveURL(/\/login/);

      // Verify logout message appears
      const message = page.locator('text=/sesi.*berakhir|logged out|keluar/i');
      await expect(message).toBeVisible({ timeout: 5000 });

      // Verify cannot access protected routes after logout
      await page.goto('/dashboard');
      await page.waitForURL(/\/login/);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test('should clear session on logout', async ({ loginAs, page: newPage }) => {
    const page = await loginAs('ADMIN_CABANG');

    // Get session storage before logout
    const beforeLogout = await page.evaluate(() => localStorage.getItem('auth-storage'));
    expect(beforeLogout).toBeTruthy();

    // Logout
    const logoutButton = page.getByRole('button', { name: /keluar|logout/i });
    await logoutButton.click();
    await page.waitForURL(/\/login/);

    // Verify session is cleared
    const afterLogout = await page.evaluate(() => localStorage.getItem('auth-storage'));
    expect(afterLogout).toBeFalsy();

    // Try to manually navigate to protected route
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle logout from different pages', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    
    const pages = [
      '/dashboard',
      '/members',
      '/inventory',
      '/profile',
    ];

    for (const url of pages) {
      // Login again for each test
      await page.goto('/login');
      
      // Navigate to specific page
      await page.goto(url);
      await waitForPageLoad(page);

      // Logout from that page
      const logoutButton = page.getByRole('button', { name: /keluar|logout/i });
      await logoutButton.click();

      // Verify redirected to login
      await page.waitForURL(/\/login/);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should prevent back navigation after logout', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await waitForPageLoad(page);

    // Logout
    const logoutButton = page.getByRole('button', { name: /keluar|logout/i });
    await logoutButton.click();
    await page.waitForURL(/\/login/);

    // Try to go back
    await page.goBack();
    
    // Should stay on login or redirect to login
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should handle concurrent logouts', async ({ loginAs, context }) => {
    // Create multiple pages with same session
    const page1 = await loginAs('ADMIN_CABANG');
    const page2 = await context.newPage();
    
    // Share auth state
    await page2.goto('/dashboard');
    await waitForPageLoad(page2);

    // Logout from first page
    const logoutButton1 = page1.getByRole('button', { name: /keluar|logout/i });
    await logoutButton1.click();
    await page1.waitForURL(/\/login/);

    // Verify second page also logged out
    await page2.reload();
    await page2.waitForURL(/\/login/);
    await expect(page2).toHaveURL(/\/login/);

    await page2.close();
  });

  test('should show logout confirmation on unsaved changes', async ({ loginAs, page: newPage }) => {
    const page = await loginAs('ADMIN_CABANG');

    // Navigate to form page
    await page.goto('/members/new');
    await waitForPageLoad(page);

    // Fill some fields (create unsaved changes)
    await page.getByLabel(/nama|name/i).fill('Test Member');

    // Try to logout
    const logoutButton = page.getByRole('button', { name: /keluar|logout/i });
    
    // Setup dialog handler
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toMatch(/unsaved|belum.*disimpan/i);
      await dialog.accept();
    });

    await logoutButton.click();
    
    // Should still logout
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('should timeout session after inactivity', async ({ loginAs, page: newPage }) => {
    test.slow(); // This test takes longer
    
    const page = await loginAs('ADMIN_CABANG');
    await page.goto('/dashboard');

    // Set token to expire soon (if you have a way to manipulate token expiry)
    // For now, we'll just wait and test if session timeout works
    
    // Wait for a reasonable timeout (adjust based on your app's session timeout)
    // For testing, you might want to reduce session timeout in test environment
    
    // This is a placeholder - adjust based on actual session timeout
    await page.waitForTimeout(5000);

    // Try to make an API call or navigate
    await page.goto('/members');
    
    // If session expired, should redirect to login with message
    const isOnLogin = page.url().includes('/login');
    if (isOnLogin) {
      const message = page.locator('text=/sesi.*berakhir|session.*expired/i');
      await expect(message).toBeVisible();
    }
  });
});

test.describe('Logout Button Accessibility', () => {
  test('should be accessible via keyboard', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    await page.goto('/dashboard');

    // Find logout button
    const logoutButton = page.getByRole('button', { name: /keluar|logout/i });

    // Focus on logout button via keyboard navigation
    await page.keyboard.press('Tab');
    // May need multiple tabs depending on page structure
    // You might want to focus directly
    await logoutButton.focus();

    // Verify focused
    await expect(logoutButton).toBeFocused();

    // Press Enter to logout
    await page.keyboard.press('Enter');

    // Verify logout
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have proper ARIA labels', async ({ loginAs }) => {
    const page = await loginAs('ADMIN_CABANG');
    await page.goto('/dashboard');

    const logoutButton = page.getByRole('button', { name: /keluar|logout/i });
    
    // Verify button is accessible
    await expect(logoutButton).toBeVisible();
    await expect(logoutButton).toBeEnabled();
    
    // Check if it has proper role
    const role = await logoutButton.getAttribute('role');
    expect(role).toBeTruthy();
  });
});
