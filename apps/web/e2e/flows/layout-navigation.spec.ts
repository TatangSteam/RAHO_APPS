import { test } from '../fixtures/base';
import { StaffLayoutPage } from '../pages/StaffLayoutPage';

test.describe('Staff layout navigation', () => {
  test('should show shared role label and communication links for branch admin', async ({ loginAs, page }) => {
    await loginAs('ADMIN_CABANG');

    const layout = new StaffLayoutPage(page);
    await layout.expectRoleLabel('Admin Cabang');
    await layout.expectSidebarLinkVisible(/^Notifikasi$/);
    await layout.expectSidebarLinkVisible(/^Chat$/);
  });

  test('should show manager system links for admin manager', async ({ loginAs, page }) => {
    await loginAs('ADMIN_MANAGER');

    const layout = new StaffLayoutPage(page);
    await layout.expectRoleLabel('Admin Manager');
    await layout.expectSidebarLinkVisible(/^Pengaturan Cabang$/);
    await layout.expectSidebarLinkVisible(/^Audit Log$/);
  });

  test('should hide manager-only links for nurse', async ({ loginAs, page }) => {
    await loginAs('NURSE');

    const layout = new StaffLayoutPage(page);
    await layout.expectRoleLabel('Nakes');
    await layout.expectSidebarLinkVisible(/^Sesi Terapi$/);
    await layout.expectSidebarLinkHidden(/^Audit Log$/);
    await layout.expectSidebarLinkHidden(/^Pembayaran$/);
  });
});
