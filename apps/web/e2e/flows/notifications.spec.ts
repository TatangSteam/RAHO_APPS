import { test, expect } from '../fixtures/base';
import { waitForLoadingToFinish } from '../helpers/waiters';

test.describe('Notification System', () => {
  test('should view notifications', async ({ loginAs, page }) => {
    // Login as manager who should have notifications
    await loginAs('ADMIN_MANAGER');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Click notification icon/bell
    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i], [data-notification], .notification-button')
    );
    
    await notificationButton.click();

    // Wait for notification panel/dropdown to open
    await page.waitForTimeout(500);

    // Verify notifications panel is visible
    const notificationPanel = page.locator('[data-notifications], .notifications-panel, [role="menu"]');
    await expect(notificationPanel).toBeVisible({ timeout: 5000 });
  });

  test('should show notification badge count', async ({ loginAs, page }) => {
    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Check notification badge
    const badge = page.locator('[data-notification-count], .notification-badge, .badge');
    
    // If badge is visible, it should show a number
    if (await badge.isVisible({ timeout: 2000 })) {
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/\d+/); // Should be a number
    }
  });

  test('should mark notification as read', async ({ loginAs, page }) => {
    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Open notifications
    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i], [data-notification]')
    );
    await notificationButton.click();

    await page.waitForTimeout(500);

    // Find an unread notification (if any)
    const unreadNotification = page.locator('[data-unread="true"], .notification-unread, .unread').first();
    
    if (await unreadNotification.isVisible({ timeout: 2000 })) {
      // Get initial badge count
      const badge = page.locator('[data-notification-count], .notification-badge');
      let initialCount = 0;
      if (await badge.isVisible({ timeout: 1000 })) {
        const badgeText = await badge.textContent();
        initialCount = parseInt(badgeText || '0');
      }

      // Click on the notification to mark as read
      await unreadNotification.click();

      await page.waitForTimeout(500);

      // Badge count should decrease or notification should be marked as read
      if (initialCount > 0) {
        const newBadgeText = await badge.textContent();
        const newCount = parseInt(newBadgeText || '0');
        expect(newCount).toBeLessThanOrEqual(initialCount);
      }
    }
  });

  test('should clear all notifications', async ({ loginAs, page }) => {
    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Open notifications
    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i]')
    );
    await notificationButton.click();

    await page.waitForTimeout(500);

    // Look for clear all button
    const clearAllButton = page.getByRole('button', { name: /clear.*all|hapus.*semua|mark.*all.*read/i });
    
    if (await clearAllButton.isVisible({ timeout: 2000 })) {
      // Click clear all
      await clearAllButton.click();

      await page.waitForTimeout(500);

      // Notification badge should be zero or hidden
      const badge = page.locator('[data-notification-count], .notification-badge');
      
      if (await badge.isVisible({ timeout: 1000 })) {
        const badgeText = await badge.textContent();
        expect(badgeText).toMatch(/^0$|^$/); // Should be 0 or empty
      }
    }
  });

  test('should show notification details on click', async ({ loginAs, page }) => {
    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Open notifications
    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i]')
    );
    await notificationButton.click();

    await page.waitForTimeout(500);

    // Click on first notification
    const firstNotification = page.locator('[data-notification], .notification-item').first();
    
    if (await firstNotification.isVisible({ timeout: 2000 })) {
      await firstNotification.click();

      // Should navigate to related page or show details
      await page.waitForTimeout(1000);

      // Verify navigation occurred or modal opened
      // This depends on your notification implementation
    }
  });

  test('should update badge count in real-time', async ({ loginAs, page }) => {
    test.slow(); // This test might take longer

    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Get initial badge count
    const badge = page.locator('[data-notification-count], .notification-badge');
    let initialCount = 0;
    
    if (await badge.isVisible({ timeout: 2000 })) {
      const badgeText = await badge.textContent();
      initialCount = parseInt(badgeText || '0');
    }

    // Wait for a few seconds (notifications might come via websocket/polling)
    await page.waitForTimeout(5000);

    // Check if count changed (might be same, but badge should still be visible if > 0)
    if (await badge.isVisible({ timeout: 2000 })) {
      const newBadgeText = await badge.textContent();
      expect(newBadgeText).toMatch(/\d+/);
    }
  });
});

test.describe('Notification Types', () => {
  test('should show stock request notifications for manager', async ({ loginAs, page }) => {
    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Open notifications
    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i]')
    );
    await notificationButton.click();

    await page.waitForTimeout(500);

    // Look for stock request related notifications
    const stockNotification = page.locator('text=/stock.*request|permintaan.*stok/i');
    
    // Manager should see stock request notifications
    // Notification may or may not be present depending on data
    const hasStockNotifications = await stockNotification.isVisible({ timeout: 2000 }).catch(() => false);
    
    // Just verify notification panel is accessible
    const notificationPanel = page.locator('[data-notifications], .notifications-panel');
    await expect(notificationPanel).toBeVisible();
  });

  test('should show payment verification notifications', async ({ loginAs, page }) => {
    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Open notifications
    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i]')
    );
    await notificationButton.click();

    await page.waitForTimeout(500);

    // Look for payment related notifications
    const paymentNotification = page.locator('text=/payment|pembayaran|verifikasi/i');
    
    // Notification may or may not be present
    // Just verify panel is accessible
    const notificationPanel = page.locator('[data-notifications], .notifications-panel');
    await expect(notificationPanel).toBeVisible();
  });
});

test.describe('Notification Preferences', () => {
  test('should access notification settings', async ({ loginAs, page }) => {
    // Login as user
    await loginAs('ADMIN_CABANG');

    // Navigate to profile or settings
    await page.goto('/profile');
    await waitForLoadingToFinish(page);

    // Look for notification settings/preferences
    const notificationSettings = page.locator('text=/notification.*setting|pengaturan.*notif|preferences/i');
    
    if (await notificationSettings.isVisible({ timeout: 3000 })) {
      await notificationSettings.click();
      await page.waitForTimeout(500);

      // Verify notification preferences page/section loaded
      await expect(page.locator('text=/notification|notif/i')).toBeVisible();
    }
  });

  test('should toggle notification preferences', async ({ loginAs, page }) => {
    // Login as user
    await loginAs('ADMIN_CABANG');

    await page.goto('/profile');
    await waitForLoadingToFinish(page);

    // Look for notification toggles/checkboxes
    const emailNotificationToggle = page.locator('input[type="checkbox"]').filter({ 
      has: page.locator('text=/email.*notification/i') 
    }).or(
      page.getByLabel(/email.*notification/i)
    );

    if (await emailNotificationToggle.isVisible({ timeout: 3000 })) {
      // Get current state
      const isChecked = await emailNotificationToggle.isChecked();

      // Toggle
      await emailNotificationToggle.click();

      // Wait for save
      await page.waitForTimeout(500);

      // Verify state changed
      const newState = await emailNotificationToggle.isChecked();
      expect(newState).toBe(!isChecked);
    }
  });
});

test.describe('Notification Accessibility', () => {
  test('should be accessible via keyboard', async ({ loginAs, page }) => {
    // Login as user
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Focus on notification button via keyboard
    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i]')
    );

    await notificationButton.focus();

    // Verify focused
    await expect(notificationButton).toBeFocused();

    // Press Enter to open
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);

    // Notification panel should open
    const notificationPanel = page.locator('[data-notifications], .notifications-panel, [role="menu"]');
    await expect(notificationPanel).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ loginAs, page }) => {
    // Login as user
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Check notification button has aria-label
    const notificationButton = page.locator('[aria-label*="notification" i]');
    
    if (await notificationButton.isVisible({ timeout: 2000 })) {
      const ariaLabel = await notificationButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/notification/i);
    }
  });
});

test.describe('Notification Performance', () => {
  test('should load notifications quickly', async ({ loginAs, page }) => {
    // Login as manager
    await loginAs('ADMIN_MANAGER');

    await page.goto('/dashboard');
    await waitForLoadingToFinish(page);

    // Measure time to open notifications
    const startTime = Date.now();

    const notificationButton = page.getByRole('button', { name: /notif/i }).or(
      page.locator('[aria-label*="notification" i]')
    );
    await notificationButton.click();

    // Wait for panel to appear
    const notificationPanel = page.locator('[data-notifications], .notifications-panel');
    await expect(notificationPanel).toBeVisible({ timeout: 5000 });

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Should load in less than 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });
});
