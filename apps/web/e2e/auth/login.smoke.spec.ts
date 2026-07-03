import { test, expect } from '../fixtures/base';
import { E2E_ROLES, getTestUser, missingCredentialMessage } from '../fixtures/test-users';
import { loginByUi } from '../helpers/auth';

test.describe('auth smoke', () => {
  for (const role of E2E_ROLES) {
    test(`login via UI as ${role}`, async ({ page }) => {
      const user = getTestUser(role);
      test.skip(!user, missingCredentialMessage(role));

      await loginByUi(page, user!);
      await expect(page.locator('body')).toContainText(/Dashboard|Member|Audit|Sesi|Raho/i);
    });
  }

  test('shows client validation for invalid login form', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username atau Email').fill('ab');
    await page.getByLabel('Password', { exact: true }).fill('123');
    await page.locator('#btn-login').click();

    await expect(page.getByText('Username atau email minimal 3 karakter.')).toBeVisible();
    await expect(page.getByText('Password minimal 6 karakter.')).toBeVisible();
  });
});
