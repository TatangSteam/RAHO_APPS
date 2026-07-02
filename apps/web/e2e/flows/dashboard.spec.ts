import { test } from '../fixtures/base';
import { DASHBOARD_SMOKE_CASES, DashboardPage } from '../pages/DashboardPage';

test.describe('Dashboard role smoke', () => {
  for (const smokeCase of DASHBOARD_SMOKE_CASES) {
    test(`should load ${smokeCase.role} dashboard shell`, async ({ loginAs, page }) => {
      await loginAs(smokeCase.role);

      const dashboard = new DashboardPage(page);
      await dashboard.goto(smokeCase.path);
      await dashboard.expectShell(smokeCase.heading);

      if (smokeCase.hasDateRangeFilter) {
        await dashboard.expectDateRangeFilter();
      }
    });
  }

  test('should update branch dashboard date range filter state', async ({ loginAs, page }) => {
    await loginAs('ADMIN_CABANG');

    const dashboard = new DashboardPage(page);
    await dashboard.goto('/dashboard');
    await dashboard.expectShell(/^dashboard$/i);
    await dashboard.selectDateRange('7 Hari');
    await dashboard.selectDateRange('Hari Ini');
  });
});
