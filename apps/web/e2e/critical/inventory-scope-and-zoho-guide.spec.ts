import { test, expect } from '../fixtures/base';
import { requireTestUser } from '../fixtures/test-users';
import { loginByApi } from '../helpers/auth';

test.describe('Automatic inventory scope and Zoho existing-data guide', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginByApi(page, request, requireTestUser('SUPER_ADMIN'));
  });

  test('hides warehouse management from daily inventory master', async ({ page }) => {
    await page.goto('/inventory/master-data');

    await expect(page.getByRole('heading', { name: 'Master Inventori' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Warehouse' })).toHaveCount(0);
    await expect(page.getByText(/Scope stok otomatis mengikuti cabang/i)).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('inventory-master-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName,
          text: element.innerText?.slice(0, 80),
          className: element.className,
          right: element.getBoundingClientRect().right,
          width: element.getBoundingClientRect().width,
        })),
    }));
    expect(mobileLayout.overflow, JSON.stringify(mobileLayout.offenders)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath('inventory-master-mobile.png'), fullPage: true });
  });

  test('shows safe pull-before-push guidance on Zoho connection page', async ({ page }) => {
    await page.goto('/admin/integrations/zoho');

    await expect(page.getByRole('heading', { name: 'Integrasi Zoho Books' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tarik & cocokkan dulu, baru kirim transaksi baru' })).toBeVisible();
    await expect(page.getByText('Transaksi historis ada di Zoho')).toBeVisible();
    await expect(page.getByText('Jangan push ulang; gunakan saldo awal dan rekonsiliasi.')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('zoho-existing-data-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      offenders: Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName,
          text: element.innerText?.slice(0, 80),
          className: element.className,
          right: element.getBoundingClientRect().right,
          width: element.getBoundingClientRect().width,
        })),
    }));
    expect(mobileLayout.overflow, JSON.stringify(mobileLayout.offenders)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath('zoho-existing-data-mobile.png'), fullPage: true });
  });
});
