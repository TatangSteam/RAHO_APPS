import { expect } from '@playwright/test';
import { test } from '../fixtures/base';
import { StaffLayoutPage } from '../pages/StaffLayoutPage';

test.describe('Staff layout navigation', () => {
  test('should show shared role label and communication links for branch admin', async ({ loginAs, page }) => {
    await loginAs('ADMIN_CABANG');

    const layout = new StaffLayoutPage(page);
    await layout.expectRoleLabel('Admin Cabang');
    await layout.expectSidebarLinkVisible(/^Notifikasi$/);
    await layout.expectSidebarLinkVisible(/^Chat$/);
    await layout.expectSidebarLinkHidden(/^Kas & Bank$/);
    await layout.expectSidebarLinkHidden(/^Expense$/);
    await layout.expectSidebarLinkHidden(/^Purchasing & AP$/);
  });

  test('should highlight only the current collaboration submenu', async ({ loginAs, page }) => {
    await loginAs('ADMIN_CABANG');

    const layout = new StaffLayoutPage(page);
    await layout.goto('/extra/collaboration/teams');

    const sidebar = layout.desktopSidebar();
    await expect(sidebar.getByRole('link', { name: /^Tim Saya$/ })).toHaveClass(/bg-amber-100/);
    await expect(sidebar.getByRole('link', { name: /^Dashboard Monitoring$/ })).not.toHaveClass(/bg-amber-100/);
    await expect(sidebar.getByRole('link', { name: /^Tugas & Subtask$/ })).not.toHaveClass(/bg-amber-100/);
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
    await layout.expectSidebarLinkVisible(/Inventori Tim/);
    await layout.expectSidebarLinkHidden(/^Audit Log$/);
    await layout.expectSidebarLinkHidden(/^Pembayaran$/);
    await layout.expectSidebarLinkHidden(/^Stok$/);
  });

  test('should keep doctor navigation focused on clinical work', async ({ loginAs, page }) => {
    await loginAs('DOCTOR');

    const layout = new StaffLayoutPage(page);
    await layout.expectSidebarLinkVisible(/^Member$/);
    await layout.expectSidebarLinkVisible(/^Sesi Terapi$/);
    await layout.expectSidebarLinkHidden(/^Stok$/);
    await layout.expectSidebarLinkHidden(/Inventori Tim/);
    await layout.expectSidebarLinkHidden(/^Mutasi Stok$/);
  });

  test('should keep service admin navigation focused on service tasks', async ({ loginAs, page }) => {
    await loginAs('ADMIN_LAYANAN');

    const layout = new StaffLayoutPage(page);
    await layout.expectSidebarLinkVisible(/^Member$/);
    await layout.expectSidebarLinkVisible(/^Sesi Terapi$/);
    await layout.expectSidebarLinkVisible(/^Pembayaran$/);
    await layout.expectSidebarLinkVisible(/Inventori Tim/);
    await layout.expectSidebarLinkHidden(/^Mutasi Stok$/);
  });
});
