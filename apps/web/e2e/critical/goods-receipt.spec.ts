import { test, expect } from '../fixtures/base';
import { requireTestUser } from '../fixtures/test-users';
import { loginByApi } from '../helpers/auth';

test.describe('Inventory - Goods Receipt', () => {
  test('renders the receipt workspace on desktop and mobile', async ({ page, request }) => {
    await loginByApi(page, request, requireTestUser('SUPER_ADMIN'));
    await page.getByRole('link', { name: 'Goods Receipt' }).click();

    await expect(page).toHaveURL(/\/inventory\/goods-receipts/);
    await expect(page.getByRole('heading', { name: 'Goods Receipt' })).toBeVisible();
    await expect(page.getByLabel('Cabang')).toBeVisible();
    await expect(page.getByRole('button', { name: /PO Terbuka/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Riwayat Receipt/i })).toBeVisible();
    await expect(page.getByText('Memuat Goods Receipt...')).toBeHidden();
    await expect(page.getByText('Mohon tunggu sebentar...')).toBeHidden();

    await page.screenshot({
      path: test.info().outputPath('goods-receipt-desktop.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: /Riwayat Receipt/i }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Goods Receipt' })).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: test.info().outputPath('goods-receipt-mobile.png'),
      fullPage: true,
    });
  });
});
