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

export function cleanMemberName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeMemberName(name: string): string {
  return cleanMemberName(name).toLocaleLowerCase('id-ID');
}

export function hasMatchingMemberName(
  fullName: string,
  candidates: Array<string | null | undefined>,
): boolean {
  const normalizedName = normalizeMemberName(fullName);

  return candidates.some(
    (candidate) => candidate != null && normalizeMemberName(candidate) === normalizedName,
  );
}

export function parseMemberBirthDate(
  dateString: string,
  currentYear = new Date().getFullYear(),
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

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
