import { test, expect } from '../fixtures/base';
import { ReferralPage } from '../pages/ReferralPage';

test.describe('Referrals', () => {
  test('should load referral list and validate create modal', async ({ loginAs, page }) => {
    await loginAs('ADMIN_CABANG');

    const referralPage = new ReferralPage(page);
    await referralPage.goto();

    const dialog = await referralPage.openCreateModal();
    await referralPage.submitCreateModal(dialog);
    await expect(dialog.getByRole('alert')).toContainText(/nama referrer harus diisi/i);

    await referralPage.closeCreateModal(dialog);
  });

  test('should filter referrals by referrer type', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');

    const referralPage = new ReferralPage(page);
    await referralPage.goto();
    await referralPage.filterByType('SALES');

    await referralPage.expectLoaded();
  });
});
