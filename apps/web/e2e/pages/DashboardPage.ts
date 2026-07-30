import { type Page, expect } from '@playwright/test';
import type { E2ERole } from '../fixtures/test-users';
import { waitForPageLoad } from '../helpers/waiters';

export interface DashboardSmokeCase {
  role: E2ERole;
  path: string;
  heading: string | RegExp;
  hasDateRangeFilter?: boolean;
}

export const DASHBOARD_SMOKE_CASES: DashboardSmokeCase[] = [
  {
    role: 'SUPER_ADMIN',
    path: '/admin/super-admin',
    heading: /super admin panel/i,
  },
  {
    role: 'ADMIN_MANAGER',
    path: '/dashboard/admin-manager',
    heading: /multi-branch dashboard/i,
    hasDateRangeFilter: true,
  },
  {
    role: 'ADMIN_CABANG',
    path: '/dashboard',
    heading: /^dashboard$/i,
    hasDateRangeFilter: true,
  },
  {
    role: 'ADMIN_LAYANAN',
    path: '/dashboard/admin-layanan',
    heading: /siapkan pelayanan hari ini/i,
  },
  {
    role: 'DOCTOR',
    path: '/dashboard/doctor',
    heading: /sesi yang perlu perhatian/i,
  },
  {
    role: 'NURSE',
    path: '/dashboard/nurse',
    heading: /tindakan yang perlu dilanjutkan/i,
  },
];

export class DashboardPage {
  constructor(private page: Page) {}

  async goto(path: string) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await waitForPageLoad(this.page);
  }

  async expectShell(heading: string | RegExp) {
    await expect(this.page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
  }

  async expectDateRangeFilter() {
    await expect(this.page.getByRole('button', { name: 'Hari Ini' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: '7 Hari' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Bulan Ini' })).toBeVisible();
  }

  async selectDateRange(label: 'Hari Ini' | '7 Hari' | 'Bulan Ini') {
    const button = this.page.getByRole('button', { name: label });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
}
