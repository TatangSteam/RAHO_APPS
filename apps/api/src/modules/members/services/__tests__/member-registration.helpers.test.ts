import {
  parseMemberBirthDate,
  resolveMemberIdentityNumber,
} from '../member-registration.helpers';

describe('member registration helpers', () => {
  describe('parseMemberBirthDate', () => {
    it('parses valid dates within the supported year range', () => {
      expect(parseMemberBirthDate('1990-01-15', 2026)?.toISOString()).toBe(
        '1990-01-15T00:00:00.000Z',
      );
      expect(parseMemberBirthDate('2027-01-01', 2026)?.toISOString()).toBe(
        '2027-01-01T00:00:00.000Z',
      );
    });

    it('rejects malformed dates and years outside the supported range', () => {
      expect(parseMemberBirthDate('not-a-date', 2026)).toBeNull();
      expect(parseMemberBirthDate('1899-12-31', 2026)).toBeNull();
      expect(parseMemberBirthDate('2028-01-01', 2026)).toBeNull();
    });
  });

  describe('resolveMemberIdentityNumber', () => {
    it.each([
      ['VIP', 'VIP'],
      ['SPECIAL', 'SPC'],
      ['FOREIGN_AUTO', 'MNA'],
      ['NO_NIK', 'AUTO'],
    ] as const)('generates a %s identity with the expected prefix', (identityType, prefix) => {
      expect(resolveMemberIdentityNumber(identityType, undefined, 'MBR-JKT-0001')).toBe(
        `${prefix}-MBR-JKT-0001`,
      );
    });

    it('defaults to an automatic identity when type and value are missing', () => {
      expect(resolveMemberIdentityNumber(undefined, undefined, 'MBR-JKT-0001')).toBe(
        'AUTO-MBR-JKT-0001',
      );
    });

    it('defaults to NIK validation when only an identity value is provided', () => {
      expect(
        resolveMemberIdentityNumber(undefined, '3174010101010001', 'MBR-JKT-0001'),
      ).toBe('3174010101010001');
      expect(() => resolveMemberIdentityNumber(undefined, '1234', 'MBR-JKT-0001')).toThrow(
        expect.objectContaining({ status: 400, code: 'INVALID_NIK' }),
      );
    });

    it('trims and returns passport or KITAS identities', () => {
      expect(resolveMemberIdentityNumber('PASSPORT', ' A1234567 ', 'MBR-JKT-0001')).toBe(
        'A1234567',
      );
      expect(resolveMemberIdentityNumber('KITAS', ' 3174-ABC ', 'MBR-JKT-0001')).toBe(
        '3174-ABC',
      );
    });

    it('requires identity values for manual identity types', () => {
      expect(() => resolveMemberIdentityNumber('NIK', '  ', 'MBR-JKT-0001')).toThrow(
        expect.objectContaining({ status: 400, code: 'IDENTITY_REQUIRED' }),
      );
      expect(() => resolveMemberIdentityNumber('PASSPORT', undefined, 'MBR-JKT-0001')).toThrow(
        expect.objectContaining({ status: 400, code: 'IDENTITY_REQUIRED' }),
      );
    });

    it('requires NIK identities to contain exactly 16 digits', () => {
      expect(() => resolveMemberIdentityNumber('NIK', '1234567890', 'MBR-JKT-0001')).toThrow(
        expect.objectContaining({ status: 400, code: 'INVALID_NIK' }),
      );
      expect(resolveMemberIdentityNumber('NIK', '3174010101010001', 'MBR-JKT-0001')).toBe(
        '3174010101010001',
      );
    });
  });
});
