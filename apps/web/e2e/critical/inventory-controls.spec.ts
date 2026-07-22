import { test, expect } from '../fixtures/base';
import { requireTestUser } from '../fixtures/test-users';
import { loginByApi } from '../helpers/auth';

test.describe('Inventory - Adjustment and Stock Opname', () => {
  test('renders both control views without horizontal overflow', async ({ page, request }) => {
    await loginByApi(page, request, requireTestUser('SUPER_ADMIN'));
    await page.goto('/inventory/controls');

    await expect(page).toHaveURL(/\/inventory\/controls/);
    await expect(page.getByRole('heading', { name: 'Inventory Control' })).toBeVisible();
    await expect(page.getByLabel('Cabang')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buat Adjustment' })).toBeVisible();
    await expect(page.getByText('Memuat inventory control...')).toBeHidden();
    await expect(page.getByText('Mohon tunggu sebentar...')).toBeHidden();
    await expect(page.getByText('Gagal memuat inventory control.')).toBeHidden();

    await page.screenshot({ path: test.info().outputPath('inventory-controls-desktop.png'), fullPage: true });

    await page.getByRole('button', { name: 'Stock Opname' }).click();
    await expect(page.getByRole('button', { name: 'Mulai Opname' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Inventory Control' })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath('inventory-controls-mobile.png'), fullPage: true });
  });
});
