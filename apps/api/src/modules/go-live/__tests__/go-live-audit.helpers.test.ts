import { evaluateJournal, evaluateOpening, gate, summarizeGate } from '../go-live-audit.helpers';

describe('Sprint 11 go-live audit helpers', () => {
  it('menolak journal header balanced jika jumlah lines tidak cocok', () => {
    expect(evaluateJournal({ totalDebit: '100', totalCredit: '100', lines: [{ debit: '90', credit: '0' }, { debit: '0', credit: '90' }] })).toBe(false);
    expect(evaluateJournal({ totalDebit: '100', totalCredit: '100', lines: [{ debit: '100', credit: '0' }, { debit: '0', credit: '100' }] })).toBe(true);
  });

  it('opening rehearsal memerlukan balanced, maker-checker, journal, dan subledger links', () => {
    expect(evaluateOpening({ status: 'POSTED', totalDebit: '100', totalCredit: '100', createdBy: 'maker', reviewedBy: 'checker', journalEntryId: 'journal', lines: [{ type: 'INVENTORY', inventoryPostingId: 'posting', cashBankTransactionId: null }, { type: 'CASH_BANK', inventoryPostingId: null, cashBankTransactionId: 'cash' }] }).ready).toBe(true);
    expect(evaluateOpening({ status: 'POSTED', totalDebit: '100', totalCredit: '99', createdBy: 'maker', reviewedBy: 'maker', journalEntryId: null, lines: [] }).ready).toBe(false);
  });

  it('menghasilkan exit gate BLOCKED hanya dari blocker yang gagal', () => {
    expect(summarizeGate([gate('A', 'A', true, 'ok'), gate('B', 'B', false, 'warning', undefined, 'WARNING')]).status).toBe('READY');
    expect(summarizeGate([gate('A', 'A', false, 'failed')]).status).toBe('BLOCKED');
  });
});
