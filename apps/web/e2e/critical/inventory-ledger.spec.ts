import { expect, test } from '../fixtures/base';
import { requireTestUser } from '../fixtures/test-users';
import { loginByApi } from '../helpers/auth';

test.describe('Inventory ledger', () => {
  test('shows complete branch totals, protects idempotency, and labels incomplete valuation', async ({ page, request }) => {
    await loginByApi(page, request, requireTestUser('SUPER_ADMIN'));
    await page.getByRole('link', { name: 'Ledger Stok' }).click();

    await expect(page).toHaveURL(/\/inventory\/ledger/);
    await expect(page.getByRole('heading', { name: 'Inventory Ledger' })).toBeVisible();
    await expect(page.getByText('On hand', { exact: true })).toBeVisible();
    await expect(page.getByText('Available', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending valuation', { exact: true })).toBeVisible();
    await expect(page.getByText('Quantity mismatch', { exact: true })).toBeVisible();

    const idempotencyInput = page.getByLabel('Idempotency key');
    await expect(idempotencyInput).toHaveAttribute('readonly', '');
    await expect(idempotencyInput).toHaveAttribute('title', /mencegah transaksi ganda/i);
    await expect(page.getByLabel('Quantity', { exact: true })).toHaveAttribute('min', '0.0001');
    await expect(page.getByLabel('Unit cost')).toHaveAttribute('min', '0');
    await expect(page.getByLabel('Quantity FIFO')).toHaveAttribute('min', '0.0001');

    const totalValueCard = page.getByText('Total inventory value', { exact: true }).locator('..');
    if (await page.getByText('Nilai persediaan belum lengkap.').count()) {
      await expect(totalValueCard.locator('strong')).toHaveText('Belum lengkap');
    } else {
      await expect(totalValueCard.locator('strong')).toContainText('Rp');
    }

    await page.screenshot({ path: test.info().outputPath('inventory-ledger-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
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
    await page.screenshot({ path: test.info().outputPath('inventory-ledger-mobile.png'), fullPage: true });
  });
});
