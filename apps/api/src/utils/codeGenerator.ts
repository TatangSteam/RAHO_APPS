import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 4);
const nanoid5 = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5);

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
  ADMIN_LAYANAN: 'AL',
  DOCTOR: 'DR',
  NURSE: 'NR',
  ADMIN_CABANG: 'AC',
  ADMIN_MANAGER: 'AM',
  SUPER_ADMIN: 'SA',
  MEMBER: 'MBR',
};

/**
 * Generate staff code: {PREFIX}-{YYYYMMDD}-{RAND4}
 * @example AL-20260413-X9KZ
 */
export function generateStaffCode(role: string): string {
  const prefix = ROLE_PREFIX[role] ?? 'STF';
  return `${prefix}-${getYYYYMMDD()}-${nanoid()}`;
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
  return `PKG-${branchCode}-${typeCode}-${getYYMM()}-${nanoid5()}`;
}

// ── Encounter ─────────────────────────────────────────────────

/**
 * Generate encounter code: ENC-{BRANCH}-{YYMM}-{RAND5}
 * @example ENC-PST-2604-AB3Z9
 */
export function generateEncounterCode(branchCode: string): string {
  return `ENC-${branchCode}-${getYYMM()}-${nanoid5()}`;
}

// ── Session ───────────────────────────────────────────────────

/**
 * Generate session code: SES-{BRANCH}-{INFUSKE:02}-{YYMM}-{RAND5}
 * @example SES-PST-03-2604-P9QR2
 */
export function generateSessionCode(branchCode: string, infusKe: number): string {
  return `SES-${branchCode}-${String(infusKe).padStart(2, '0')}-${getYYMM()}-${nanoid5()}`;
}

// ── Diagnosis ─────────────────────────────────────────────────

/**
 * Generate diagnosis code: DX-{BRANCH}-{YYMM}-{SEQ:05}
 * @example DX-PST-2604-00001
 */
export function generateDiagnosisCode(branchCode: string, sequence: number): string {
  return `DX-${branchCode}-${getYYMM()}-${pad(sequence)}`;
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
  return `SHP-${fromCode}-${toCode}-${getYYMM()}-${nanoid()}`;
}

// ── Invoice ───────────────────────────────────────────────────

/**
 * Generate invoice number: INV-{BRANCH}-{YYMM}-{SEQ:05}
 * @example INV-PST-2604-00001
 */
export function generateInvoiceNumber(branchCode: string, sequence: number): string {
  return `INV-${branchCode}-${getYYMM()}-${pad(sequence)}`;
}
