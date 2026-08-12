import {
  evaluateInventoryMutationChain,
  evaluateInventoryValue,
  evaluateJournal,
  evaluateOpening,
  gate,
  summarizeGate,
} from '../go-live-audit.helpers';

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

  it('mendeteksi mutation chain terputus dan saldo akhir yang tidak cocok', () => {
    expect(evaluateInventoryMutationChain('3', [
      { id: 'in', quantity: '5', stockBefore: '0', stockAfter: '5' },
      { id: 'out', quantity: '2', stockBefore: '5', stockAfter: '3' },
    ]).valid).toBe(true);
    expect(evaluateInventoryMutationChain('4', [
      { id: 'in', quantity: '5', stockBefore: '0', stockAfter: '5' },
      { id: 'out', quantity: '2', stockBefore: '6', stockAfter: '4' },
    ])).toMatchObject({ valid: false });
  });

  it('memulai mutation chain baru dari checkpoint migration legacy', () => {
    expect(evaluateInventoryMutationChain('18', [
      { id: 'old-receipt', quantity: '10', stockBefore: '10', stockAfter: '20', referenceType: 'SHIPMENT' },
      { id: 'legacy-checkpoint', quantity: '20', stockBefore: '0', stockAfter: '20', referenceType: 'LEGACY_MIGRATION' },
      { id: 'new-usage', quantity: '2', stockBefore: '20', stockAfter: '18', referenceType: 'TREATMENT_SESSION' },
    ])).toEqual({ valid: true, issues: [] });

    expect(evaluateInventoryMutationChain('17', [
      { id: 'legacy-checkpoint', quantity: '20', stockBefore: '0', stockAfter: '20', referenceType: 'LEGACY_MIGRATION' },
      { id: 'broken-new-usage', quantity: '2', stockBefore: '19', stockAfter: '17', referenceType: 'TREATMENT_SESSION' },
    ])).toMatchObject({ valid: false });
  });

  it('mencocokkan FIFO layer plus in-transit dengan akun kontrol inventory', () => {
    expect(evaluateInventoryValue('800.004', '200', '1000').matches).toBe(true);
    const mismatch = evaluateInventoryValue('800', '150', '1000');
    expect(mismatch.matches).toBe(false);
    expect(mismatch.difference.toFixed(2)).toBe('-50.00');
  });
});
