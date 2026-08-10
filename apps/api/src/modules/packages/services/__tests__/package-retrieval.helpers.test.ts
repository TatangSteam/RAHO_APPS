import { PackageStatus } from '@prisma/client';
import { getAggregatePackageStatus, getCurrentPackageGroupItems } from '../package-retrieval.helpers';

describe('getAggregatePackageStatus', () => {
  it('keeps a group active while one package is still active', () => {
    expect(
      getAggregatePackageStatus([
        { status: PackageStatus.EXPIRED },
        { status: PackageStatus.ACTIVE },
      ])
    ).toBe(PackageStatus.ACTIVE);
  });

  it('returns expired after every package is expired', () => {
    expect(
      getAggregatePackageStatus([
        { status: PackageStatus.EXPIRED },
        { status: PackageStatus.EXPIRED },
      ])
    ).toBe(PackageStatus.EXPIRED);
  });
});

describe('getCurrentPackageGroupItems', () => {
  it('excludes removed historical rows from current session totals', () => {
    const items = [
      { id: 'basic-current', status: PackageStatus.ACTIVE, totalSessions: 15 },
      { id: 'basic-free-current', status: PackageStatus.ACTIVE, totalSessions: 2 },
      { id: 'basic-free-duplicate', status: PackageStatus.CANCELLED, totalSessions: 2 },
      { id: 'booster-current', status: PackageStatus.ACTIVE, totalSessions: 17 },
      { id: 'booster-old-1', status: PackageStatus.CANCELLED, totalSessions: 1 },
      { id: 'booster-old-2', status: PackageStatus.CANCELLED, totalSessions: 1 },
    ];

    const currentItems = getCurrentPackageGroupItems(items);

    expect(currentItems).toEqual([items[0], items[1], items[3]]);
    expect(currentItems.filter((item) => item.id.startsWith('basic-')).reduce(
      (total, item) => total + item.totalSessions,
      0,
    )).toBe(17);
    expect(currentItems.filter((item) => item.id.startsWith('booster-')).reduce(
      (total, item) => total + item.totalSessions,
      0,
    )).toBe(17);
  });

  it('keeps a fully cancelled purchase visible for history', () => {
    const items = [
      { id: 'cancelled-1', status: PackageStatus.CANCELLED },
      { id: 'cancelled-2', status: PackageStatus.CANCELLED },
    ];

    expect(getCurrentPackageGroupItems(items)).toEqual(items);
  });
});
