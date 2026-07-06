import { PackageStatus } from '@prisma/client';
import { getAggregatePackageStatus } from '../package-retrieval.helpers';

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
