import { PackageStatus, PackageType } from '@prisma/client';
import {
  buildAutomaticKitMaterialUsageRows,
  DEBT_PACKAGE_STATUSES,
  DEBT_SESSION_LIMIT,
  getDebtSessionAllowance,
  getSessionPackageAvailability,
  isDebtPackageStatus,
} from '../session-creation.helpers';

const activeBasicPackage = {
  packageType: PackageType.BASIC,
  status: PackageStatus.ACTIVE,
  totalSessions: 10,
  usedSessions: 3,
};

describe('session creation helpers', () => {
  it('returns active availability with the remaining session count', () => {
    expect(getSessionPackageAvailability(activeBasicPackage)).toEqual({
      mode: 'ACTIVE',
      remainingSessions: 7,
    });
  });

  it.each(DEBT_PACKAGE_STATUSES)('returns debt availability for %s packages', (status) => {
    expect(getSessionPackageAvailability({ ...activeBasicPackage, status })).toEqual({
      mode: 'DEBT',
      remainingSessions: 7,
    });
    expect(isDebtPackageStatus(status)).toBe(true);
  });

  it('rejects booster packages before evaluating their session balance', () => {
    expect(() =>
      getSessionPackageAvailability({
        ...activeBasicPackage,
        packageType: PackageType.BOOSTER,
        totalSessions: 0,
      }),
    ).toThrow(expect.objectContaining({ status: 422, code: 'INVALID_PACKAGE_TYPE' }));
  });

  it('rejects basic packages with no remaining sessions', () => {
    expect(() =>
      getSessionPackageAvailability({
        ...activeBasicPackage,
        usedSessions: activeBasicPackage.totalSessions,
      }),
    ).toThrow(expect.objectContaining({ status: 422, code: 'PACKAGE_SESSIONS_EXHAUSTED' }));
  });

  it.each([PackageStatus.EXPIRED, PackageStatus.CANCELLED])(
    'rejects packages with unusable status %s',
    (status) => {
      expect(() =>
        getSessionPackageAvailability({ ...activeBasicPackage, status }),
      ).toThrow(expect.objectContaining({ status: 422, code: 'PACKAGE_NOT_ACTIVE' }));
      expect(isDebtPackageStatus(status)).toBe(false);
    },
  );

  it('limits debt allowance by both package balance and the global debt quota', () => {
    expect(DEBT_SESSION_LIMIT).toBe(2);
    expect(getDebtSessionAllowance(10, 0)).toBe(2);
    expect(getDebtSessionAllowance(10, 1)).toBe(1);
    expect(getDebtSessionAllowance(1, 0)).toBe(1);
  });

  it('rejects debt packages after the global debt quota is exhausted', () => {
    expect(() => getDebtSessionAllowance(10, 2)).toThrow(
      expect.objectContaining({ status: 422, code: 'PACKAGE_DEBT_LIMIT_REACHED' }),
    );
  });

  it('builds draft material rows for mandatory infusion kit components', () => {
    const rows = buildAutomaticKitMaterialUsageRows('session-1', 'user-1', [
      {
        inventoryItemId: 'inventory-infus-set',
        quantity: '1',
        unit: 'Piece',
        conversionFactor: '1',
      },
      {
        inventoryItemId: 'inventory-oneswab',
        quantity: '2',
        unit: 'Piece',
        conversionFactor: '10',
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      usageKey: 'session-1:inventory-infus-set',
      treatmentSessionId: 'session-1',
      inventoryItemId: 'inventory-infus-set',
      unit: 'Piece',
      recordedBy: 'user-1',
    });
    expect(rows[0].quantity.toString()).toBe('1');
    expect(rows[0].baseQuantity.toString()).toBe('1');
    expect(rows[0].recommendedQuantity?.toString()).toBe('1');
    expect(rows[1].quantity.toString()).toBe('2');
    expect(rows[1].baseQuantity.toString()).toBe('0.2');
  });

  it('rejects an invalid infusion kit unit conversion', () => {
    expect(() => buildAutomaticKitMaterialUsageRows('session-1', 'user-1', [{
      inventoryItemId: 'inventory-1',
      quantity: '1',
      unit: 'Piece',
      conversionFactor: '0',
    }])).toThrow('Conversion factor komponen Infus Set + Pelengkap harus lebih besar dari nol.');
  });
});
