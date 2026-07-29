import {
  buildZohoExpensePayload,
  reconcileExpense,
  validateExpenseSnapshot,
  ZOHO_EXPENSE_REVERSAL_POLICY,
  ZohoExpenseDependencies,
  ZohoExpenseSnapshot,
} from '../zoho.expense.policy';
import { ZOHO_REQUIRED_SCOPES, ZOHO_SCOPE_VERSION } from '../zoho.client';

function snapshot(overrides: Partial<ZohoExpenseSnapshot> = {}): ZohoExpenseSnapshot {
  return {
    localEntityId: 'expense-1',
    externalKey: 'RAHO:EXPENSE:expense-1',
    referenceNumber: 'EXP/HQ/2026/0001',
    expenseNumber: 'EXP/HQ/2026/0001',
    branchId: 'branch-1',
    expenseDate: '2026-07-29',
    paidAt: '2026-07-29T08:00:00.000Z',
    amount: '125000.00',
    category: 'Operasional',
    description: 'Pembelian alat tulis',
    expenseAccountCode: '6100',
    cashBankAccountId: 'bank-1',
    evidence: {
      fileName: 'receipt.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      checksum: 'abc123',
    },
    ...overrides,
  };
}

const dependencies: ZohoExpenseDependencies = {
  expenseAccountId: 'zoho-expense-account',
  paidThroughAccountId: 'zoho-bank',
  locationId: 'zoho-location',
};

describe('Zoho expense policy', () => {
  it('creates the exact paid expense payload without an internal evidence URL', () => {
    const payload = buildZohoExpensePayload(snapshot(), dependencies);
    expect(payload).toEqual({
      account_id: 'zoho-expense-account',
      paid_through_account_id: 'zoho-bank',
      date: '2026-07-29',
      amount: 125000,
      reference_number: 'EXP/HQ/2026/0001',
      description: 'Operasional - Pembelian alat tulis',
      is_billable: false,
      location_id: 'zoho-location',
    });
    expect(JSON.stringify(payload)).not.toMatch(/evidence|https?:\/\//i);
  });

  it('accepts no receipt, PDF, and JPG while rejecting unsupported or oversized evidence', () => {
    expect(validateExpenseSnapshot(snapshot({ evidence: null }), dependencies)).toEqual([]);
    expect(validateExpenseSnapshot(snapshot({
      evidence: { fileName: 'receipt.jpg', fileSize: 1024, mimeType: 'image/jpeg', checksum: 'x' },
    }), dependencies)).toEqual([]);
    expect(validateExpenseSnapshot(snapshot({
      evidence: { fileName: 'receipt.webp', fileSize: 6 * 1024 * 1024, mimeType: 'image/webp', checksum: 'x' },
    }), dependencies)).toEqual(expect.arrayContaining([
      expect.stringContaining('Tipe receipt'),
      expect.stringContaining('maksimal 5 MB'),
    ]));
  });

  it('requires both expense and paid-through mappings', () => {
    expect(validateExpenseSnapshot(snapshot(), {})).toEqual(expect.arrayContaining([
      expect.stringContaining('Akun beban 6100'),
      expect.stringContaining('paid-through'),
    ]));
  });

  it('reconciles amount, date, and reference', () => {
    const local = snapshot();
    expect(reconcileExpense(local, {
      expense_id: 'zoho-expense-1',
      total: 125000,
      date: '2026-07-29',
      reference_number: 'EXP/HQ/2026/0001',
    }).status).toBe('MATCHED');
    expect(reconcileExpense(local, {
      expense_id: 'zoho-expense-1',
      total: 120000,
      date: '2026-07-28',
      reference_number: 'OTHER',
    })).toEqual({
      status: 'MISMATCH',
      reasons: expect.arrayContaining([
        expect.stringContaining('Nominal berbeda'),
        expect.stringContaining('Tanggal berbeda'),
        expect.stringContaining('Referensi berbeda'),
      ]),
    });
    expect(reconcileExpense(local).status).toBe('MISSING');
  });

  it('adds Sprint 8 scopes without automatic destructive reversal', () => {
    expect(ZOHO_SCOPE_VERSION).toBe(12);
    expect(ZOHO_REQUIRED_SCOPES).toEqual(expect.arrayContaining([
      'ZohoBooks.expenses.READ',
      'ZohoBooks.expenses.CREATE',
      'ZohoBooks.expenses.UPDATE',
    ]));
    expect(ZOHO_REQUIRED_SCOPES).not.toContain('ZohoBooks.expenses.DELETE');
    expect(ZOHO_EXPENSE_REVERSAL_POLICY).toBe('NO_AUTOMATIC_DELETE');
  });
});
