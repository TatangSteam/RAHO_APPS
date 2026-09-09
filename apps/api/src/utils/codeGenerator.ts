import { randomInt } from 'node:crypto';

const RANDOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomCode(length: number): string {
  return Array.from(
    { length },
    () => RANDOM_ALPHABET[randomInt(RANDOM_ALPHABET.length)],
  ).join('');
}

/** Format: YYMM (e.g., "2604" for April 2026) */
function getYYMM(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

/** Format: YYYYMMDD (e.g., "20260413") */
function getYYYYMMDD(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Zero-padded sequence number */
function pad(n: number, width = 5): string {
  return String(n).padStart(width, '0');
}

// ── Member ───────────────────────────────────────────────────

/**
 * Generate member number: MBR-{BRANCH}-{YYMM}-{SEQ}
 * @example MBR-PST-2604-00001
 */
export function generateMemberNo(branchCode: string, sequence: number): string {
  return `MBR-${branchCode}-${getYYMM()}-${pad(sequence)}`;
}

/**
 * Get next member sequence for a given branch in current month.
 * This queries the DB for max(memberNo) in the branch+month combination.
 */
export async function getNextMemberSequence(
  branchCode: string,
  prismaQuery: (prefix: string) => Promise<number>,
): Promise<number> {
  const prefix = `MBR-${branchCode}-${getYYMM()}-`;
  return prismaQuery(prefix);
}

// ── Staff Code ────────────────────────────────────────────────

const ROLE_PREFIX: Record<string, string> = {
  ADMIN_LAYANAN: 'STF',
  DOCTOR: 'STF',
  NURSE: 'STF',
  ADMIN_CABANG: 'STF',
  ADMIN_MANAGER: 'STF',
  ADMIN_LOGISTIK: 'STF',
  FINANCE_LOGISTICS_CONTROLLER: 'STF',
  SUPER_ADMIN: 'STF',
  MEMBER: 'MBR',
};

/**
 * Generate staff code: STF-{YYYYMMDD}-{RAND4}
 * @example STF-20260413-X9KZ
 */
export function generateStaffCode(role: string): string {
  const prefix = ROLE_PREFIX[role] ?? 'STF';
  return `${prefix}-${getYYYYMMDD()}-${randomCode(4)}`;
}

// ── Package ───────────────────────────────────────────────────

const PACKAGE_TYPE_CODE: Record<string, string> = {
  BASIC: 'BSC',
  BOOSTER: 'BST',
};

/**
 * Generate package code: PKG-{BRANCH}-{TYPE}-{YYMM}-{RAND5}
 * @example PKG-PST-BSC-2604-XY9A1
 */
export function generatePackageCode(branchCode: string, packageType: string): string {
  const typeCode = PACKAGE_TYPE_CODE[packageType] ?? 'UNK';
  return `PKG-${branchCode}-${typeCode}-${getYYMM()}-${randomCode(5)}`;
}

// ── Encounter ─────────────────────────────────────────────────

/**
 * Generate encounter code: ENC-{BRANCH}-{YYMM}-{RAND5}
 * @example ENC-PST-2604-AB3Z9
 */
export function generateEncounterCode(branchCode: string): string {
  return `ENC-${branchCode}-${getYYMM()}-${randomCode(5)}`;
}

// ── Session ───────────────────────────────────────────────────

/**
 * Generate session code: SES-{BRANCH}-{INFUSKE:02}-{YYMM}-{RAND5}
 * @example SES-PST-03-2604-P9QR2
 */
export function generateSessionCode(branchCode: string, infusKe: number): string {
  return `SES-${branchCode}-${String(infusKe).padStart(2, '0')}-${getYYMM()}-${randomCode(5)}`;
}

/**
 * Keep the ordinal segment of an existing session code aligned with infusKe.
 * The branch, creation month, and random suffix remain stable.
 * Legacy/non-standard codes are returned unchanged.
 */
export function syncSessionCodeOrdinal(sessionCode: string, infusKe: number): string {
  const match = sessionCode.match(/^(SES-.+)-\d+-(\d{4})-([A-Z0-9]{5})$/);
  if (!match) return sessionCode;

  return `${match[1]}-${String(infusKe).padStart(2, '0')}-${match[2]}-${match[3]}`;
}

// ── Diagnosis ─────────────────────────────────────────────────

/**
 * Generate diagnosis code: {PREFIX}-{BRANCH}-{YYMM}-{SEQ:05}
 * @param branchCode - Branch code (e.g., "PST")
 * @param sequence - Sequence number
 * @param prefix - Optional prefix, defaults to "DX" for member diagnoses
 *                 Use "DXS" for session-specific diagnosis copies
 * @example DX-PST-2604-00001 (member diagnosis)
 * @example DXS-PST-2604-00001 (session diagnosis copy)
 */
export function generateDiagnosisCode(branchCode: string, sequence: number, prefix: string = 'DX'): string {
  return `${prefix}-${branchCode}-${getYYMM()}-${pad(sequence)}`;
}

// ── Therapy Plan ──────────────────────────────────────────────

/**
 * Generate therapy plan code: TP-{BRANCH}-{YYMM}-{SEQ:05}
 * @example TP-PST-2604-00001
 */
export function generateTherapyPlanCode(branchCode: string, sequence: number): string {
  return `TP-${branchCode}-${getYYMM()}-${pad(sequence)}`;
}

// ── Evaluation ────────────────────────────────────────────────

/**
 * Generate evaluation code: EVL-{BRANCH}-{YYMM}-{SEQ:05}
 * @example EVL-PST-2604-00001
 */
export function generateEvaluationCode(branchCode: string, sequence: number): string {
  return `EVL-${branchCode}-${getYYMM()}-${pad(sequence)}`;
}

// ── Stock Request ─────────────────────────────────────────────

/**
 * Generate stock request code: REQ-{BRANCH}-{YYMM}-{SEQ:05}
 * @example REQ-PST-2604-00001
 */
export function generateRequestCode(branchCode: string, sequence: number): string {
  return `REQ-${branchCode}-${getYYMM()}-${pad(sequence)}`;
}

// ── Shipment ──────────────────────────────────────────────────

/**
 * Generate shipment code: SHP-{FROM}-{TO}-{YYMM}-{RAND4}
 * @example SHP-PST-BDG-2604-X9KZ
 */
export function generateShipmentCode(fromCode: string, toCode: string): string {
  return `SHP-${fromCode}-${toCode}-${getYYMM()}-${randomCode(4)}`;
}

// ── Invoice ───────────────────────────────────────────────────

/**
 * Generate invoice number: {SEQ:05}-{BRANCH}-{MM}-{YYYY}
 * Format baru: Nomor-KodeCabang-Bulan-Tahun
 * @example 00001-PST-07-2026
 */
export function generateInvoiceNumber(
  branchCode: string,
  sequence: number,
  date = new Date()
): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${pad(sequence)}-${branchCode}-${mm}-${yyyy}`;
}
