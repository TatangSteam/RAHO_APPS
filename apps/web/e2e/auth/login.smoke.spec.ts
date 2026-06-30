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
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Password').fill('123');
    await page.locator('#btn-login').click();

    await expect(page.getByText('Format email tidak valid.')).toBeVisible();
    await expect(page.getByText('Password minimal 6 karakter.')).toBeVisible();
  });
});
