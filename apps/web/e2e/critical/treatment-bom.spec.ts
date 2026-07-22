import { test, expect } from '../fixtures/base';
import { requireTestUser } from '../fixtures/test-users';
import { loginByApi } from '../helpers/auth';

test.describe('Inventory - Treatment BOM', () => {
  test('loads BOM versions and opens the draft form on desktop and mobile', async ({ page, request }) => {
    await loginByApi(page, request, requireTestUser('SUPER_ADMIN'));

    const listResponse = page.waitForResponse((response) => (
      response.request().method() === 'GET'
      && response.url().includes('/inventory/treatment-boms')
    ));
    await page.goto('/inventory/treatment-boms');
    expect((await listResponse).ok()).toBeTruthy();

    await expect(page.getByRole('heading', { name: 'Treatment BOM' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buat Draft' })).toBeVisible();

    await page.getByRole('button', { name: 'Buat Draft' }).click();
    await expect(page.getByRole('dialog', { name: 'Draft Treatment BOM' })).toBeVisible();
    await expect(page.getByLabel('Paket')).toBeVisible();
    await expect(page.getByLabel('Catatan versi')).toBeVisible();
    await expect(page.getByLabel(/Quantity/)).toBeVisible();

    await page.screenshot({
      path: test.info().outputPath('treatment-bom-desktop.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog', { name: 'Draft Treatment BOM' })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    await page.screenshot({
      path: test.info().outputPath('treatment-bom-mobile.png'),
      fullPage: true,
    });
  });
});
