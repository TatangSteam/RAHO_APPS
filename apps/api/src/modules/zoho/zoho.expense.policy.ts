export type ZohoExpenseEvidence = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
};

export type ZohoExpenseSnapshot = {
  localEntityId: string;
  externalKey: string;
  referenceNumber: string;
  expenseNumber: string;
  branchId: string;
  expenseDate: string;
  paidAt: string;
  amount: string;
  category: string;
  description: string;
  expenseAccountCode: string;
  cashBankAccountId: string;
  evidence: ZohoExpenseEvidence | null;
};

export type ZohoExpenseDependencies = {
  expenseAccountId: string;
  paidThroughAccountId: string;
  locationId?: string;
};

export type ZohoExpenseRemote = {
  expense_id?: string | number;
  account_id?: string | number;
  paid_through_account_id?: string | number;
  date?: string;
  amount?: number;
  total?: number;
  reference_number?: string | null;
  description?: string;
};

export type ExpenseReconciliation = {
  status: 'MATCHED' | 'MISMATCH' | 'MISSING';
  reasons: string[];
};

export const ZOHO_EXPENSE_RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const ZOHO_EXPENSE_RECEIPT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
]);

function amount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Nominal expense harus lebih besar dari nol.');
  return parsed;
}

function text(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function validateExpenseSnapshot(
  snapshot: ZohoExpenseSnapshot,
  dependencies: Partial<ZohoExpenseDependencies>,
): string[] {
  const issues: string[] = [];
  if (!snapshot.localEntityId || !snapshot.referenceNumber) issues.push('Identitas expense ERP tidak lengkap.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.expenseDate)) issues.push('Tanggal expense tidak valid.');
  const parsedAmount = Number(snapshot.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) issues.push('Nominal expense harus lebih besar dari nol.');
  if (!dependencies.expenseAccountId) issues.push(`Akun beban ${snapshot.expenseAccountCode} belum dipetakan ke Zoho.`);
  if (!dependencies.paidThroughAccountId) issues.push('Akun kas/bank paid-through belum dipetakan ke Zoho.');
  if (snapshot.evidence) {
    if (!ZOHO_EXPENSE_RECEIPT_MIME_TYPES.has(snapshot.evidence.mimeType.toLowerCase())) {
      issues.push('Tipe receipt tidak didukung Zoho. Gunakan PDF, JPG, PNG, GIF, atau BMP.');
    }
    if (snapshot.evidence.fileSize <= 0 || snapshot.evidence.fileSize > ZOHO_EXPENSE_RECEIPT_MAX_BYTES) {
      issues.push('Ukuran receipt harus lebih dari 0 dan maksimal 5 MB.');
    }
    if (!snapshot.evidence.checksum) issues.push('Checksum receipt tidak tersedia.');
  }
  return issues;
}

export function buildZohoExpensePayload(
  snapshot: ZohoExpenseSnapshot,
  dependencies: ZohoExpenseDependencies,
) {
  return {
    account_id: dependencies.expenseAccountId,
    paid_through_account_id: dependencies.paidThroughAccountId,
    date: snapshot.expenseDate,
    amount: amount(snapshot.amount),
    reference_number: text(snapshot.referenceNumber, 100),
    description: text(`${snapshot.category} - ${snapshot.description}`, 100),
    is_billable: false,
    ...(dependencies.locationId ? { location_id: dependencies.locationId } : {}),
  };
}

export function reconcileExpense(
  snapshot: ZohoExpenseSnapshot,
  remote?: ZohoExpenseRemote,
): ExpenseReconciliation {
  if (!remote) return { status: 'MISSING', reasons: ['Expense Zoho tidak ditemukan.'] };
  const reasons: string[] = [];
  const remoteAmount = Number(remote.total ?? remote.amount);
  if (!Number.isFinite(remoteAmount) || Math.abs(remoteAmount - Number(snapshot.amount)) > 0.005) {
    reasons.push(`Nominal berbeda: ERP ${snapshot.amount}, Zoho ${Number.isFinite(remoteAmount) ? remoteAmount : '-'}.`);
  }
  if (remote.date !== snapshot.expenseDate) reasons.push(`Tanggal berbeda: ERP ${snapshot.expenseDate}, Zoho ${remote.date || '-'}.`);
  if (remote.reference_number !== snapshot.referenceNumber) {
    reasons.push(`Referensi berbeda: ERP ${snapshot.referenceNumber}, Zoho ${remote.reference_number || '-'}.`);
  }
  return { status: reasons.length ? 'MISMATCH' : 'MATCHED', reasons };
}

/**
 * Expense yang sudah PAID tidak dihapus otomatis dari Zoho. Koreksi harus
 * melalui reversal lokal yang immutable, lalu compensating action terpisah.
 */
export const ZOHO_EXPENSE_REVERSAL_POLICY = 'NO_AUTOMATIC_DELETE' as const;
