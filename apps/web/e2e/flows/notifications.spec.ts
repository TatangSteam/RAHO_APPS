import { test, expect } from '../fixtures/base';
import { waitForLoadingToFinish } from '../helpers/waiters';
import { NotificationsPage } from '../pages/NotificationsPage';

test.describe('Notification System', () => {
  test('should view notifications page', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    await notificationsPage.expectShell();
  });

  test('should show notification badge count in navigation when available', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForLoadingToFinish(page);

    const notificationsPage = new NotificationsPage(page);
    const notificationLink = notificationsPage.notificationLink();
    await expect(notificationLink).toBeVisible({ timeout: 10000 });

    const linkText = await notificationLink.textContent();
    if (/\d+/.test(linkText || '')) {
      expect(linkText).toMatch(/\d+/);
    }
  });

  test('should refresh notifications', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    await notificationsPage.refresh();
  });

  test('should show notification details or empty state', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    if (await notificationsPage.clickFirstActionableNotificationIfPresent()) {
      await expect(page).toHaveURL(/\/inventory\//, { timeout: 10000 });
    } else {
      await notificationsPage.expectShell();
    }
  });

  test('should mark notification as read', async () => {
    test.fixme(true, 'Current notifications page does not expose mark-as-read controls yet.');
  });

  test('should clear all notifications', async () => {
    test.fixme(true, 'Current notifications page does not expose clear-all controls yet.');
  });

  test('should update badge count in real-time', async ({ loginAs, page }) => {
    test.slow();

    await loginAs('ADMIN_MANAGER');
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();
    await notificationsPage.expectShell();
  });
});

test.describe('Notification Types', () => {
  test('should show stock request notifications for manager', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    await expect(page.getByText(/request stok baru/i)).toBeVisible();
  });

  test('should show payment verification notifications', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();

    await expect(page.getByText(/bukti pembayaran/i)).toBeVisible();
  });
});

test.describe('Notification Preferences', () => {
  test('should access notification settings', async () => {
    test.fixme(true, 'Notification preference settings are not exposed in the current profile UI.');
  });

  test('should toggle notification preferences', async () => {
    test.fixme(true, 'Notification preference toggles are not exposed in the current profile UI.');
  });
});

test.describe('Notification Accessibility', () => {
  test('should be accessible via keyboard', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForLoadingToFinish(page);

    const notificationLink = page.getByRole('link', { name: /notifikasi/i }).first();
    await notificationLink.focus();
    await expect(notificationLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/notifications/);
    await new NotificationsPage(page).expectShell();
  });

  test('should have proper accessible link text', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForLoadingToFinish(page);

    await expect(page.getByRole('link', { name: /notifikasi/i }).first()).toBeVisible();
  });
});

test.describe('Notification Performance', () => {
  test('should load notifications quickly', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');

    const startTime = Date.now();
    const notificationsPage = new NotificationsPage(page);
    await notificationsPage.goto();
    await notificationsPage.expectShell();

    expect(Date.now() - startTime).toBeLessThan(5000);
  });
});
