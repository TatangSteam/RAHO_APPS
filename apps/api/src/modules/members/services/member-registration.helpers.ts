export type MemberIdentityType =
  | 'NIK'
  | 'PASSPORT'
  | 'KITAS'
  | 'VIP'
  | 'SPECIAL'
  | 'FOREIGN_AUTO'
  | 'NO_NIK';

const GENERATED_IDENTITY_PREFIXES: Partial<Record<MemberIdentityType, string>> = {
  VIP: 'VIP',
  SPECIAL: 'SPC',
  FOREIGN_AUTO: 'MNA',
  NO_NIK: 'AUTO',
};

export function parseMemberBirthDate(
  dateString: string,
  currentYear = new Date().getFullYear(),
): Date | null {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  return year >= 1900 && year <= currentYear + 1 ? date : null;
}

export function resolveMemberIdentityNumber(
  identityType: MemberIdentityType | undefined,
  rawIdentity: string | undefined,
  memberNo: string,
): string | null {
  const type = identityType || (rawIdentity ? 'NIK' : 'NO_NIK');
  const generatedPrefix = GENERATED_IDENTITY_PREFIXES[type];

  if (generatedPrefix) {
    return `${generatedPrefix}-${memberNo}`;
  }

  const identity = rawIdentity?.trim();

  if (!identity) {
    throw {
      status: 400,
      code: 'IDENTITY_REQUIRED',
      message: type === 'NIK' ? 'NIK wajib diisi' : 'Nomor identitas wajib diisi',
    };
  }

  if (type === 'NIK' && !/^\d{16}$/.test(identity)) {
    throw {
      status: 400,
      code: 'INVALID_NIK',
      message: 'NIK harus 16 digit',
    };
  }

  return identity;
}
