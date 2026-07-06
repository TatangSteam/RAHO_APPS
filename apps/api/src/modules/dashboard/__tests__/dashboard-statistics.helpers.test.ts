import { PackageStatus, PackageType } from '@prisma/client';
import {
  type DashboardPackageRow,
  summarizeDashboardPackages,
} from '../dashboard-statistics.helpers';

const startDate = new Date('2026-07-01T00:00:00.000Z');
const endDate = new Date('2026-07-31T23:59:59.999Z');

function createPackage(
  id: string,
  overrides: Partial<DashboardPackageRow> = {}
): DashboardPackageRow {
  return {
    id,
    purchaseGroupId: null,
    packageType: PackageType.BASIC,
    status: PackageStatus.PENDING_PAYMENT,
    createdAt: new Date('2026-07-06T00:00:00.000Z'),
    ...overrides,
  };
}

describe('summarizeDashboardPackages', () => {
  it('counts a multi-row bundle as one purchase', () => {
    const packages = Array.from({ length: 20 }, (_, index) =>
      createPackage(`package-${index}`, { purchaseGroupId: 'group-1' })
    );

    expect(summarizeDashboardPackages(packages, startDate, endDate)).toEqual({
      packagesSold: 1,
      activePackages: 0,
      pendingPayment: 1,
      byType: [{ type: PackageType.BASIC, count: 1 }],
    });
  });

  it('counts standalone packages separately and aggregates active bundle rows once', () => {
    const packages = [
      createPackage('active-1', {
        purchaseGroupId: 'group-active',
        status: PackageStatus.ACTIVE,
      }),
      createPackage('expired-1', {
        purchaseGroupId: 'group-active',
        status: PackageStatus.EXPIRED,
      }),
      createPackage('standalone', { status: PackageStatus.ACTIVE }),
    ];

    const summary = summarizeDashboardPackages(packages, startDate, endDate);

    expect(summary.packagesSold).toBe(2);
    expect(summary.activePackages).toBe(2);
    expect(summary.pendingPayment).toBe(0);
  });
});
