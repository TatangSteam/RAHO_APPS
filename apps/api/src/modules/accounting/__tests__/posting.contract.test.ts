import { validateAndNormalizePosting } from '../posting.contract';

const validPosting = {
  postingKey: 'TEST:PAYMENT:001',
  transactionDate: '2026-07-21T00:00:00.000Z',
  branchId: 'branch-1',
  actorUserId: 'user-1',
  description: 'Test payment posting',
  lines: [
    { accountCode: '1120', debit: '1000000.10' },
    { accountCode: '2200', credit: '1000000.10' },
  ],
  sourceLinks: [{ sourceType: 'INVOICE_PAYMENT', sourceId: 'payment-1' }],
};

describe('accounting posting contract', () => {
  it('validates a balanced journal using Decimal arithmetic', () => {
    const posting = validateAndNormalizePosting(validPosting);
    expect(posting.totalDebit.toFixed(2)).toBe('1000000.10');
    expect(posting.totalCredit.toFixed(2)).toBe('1000000.10');
    expect(posting.lines[0].branchId).toBe('branch-1');
  });

  it('rejects an unbalanced journal', () => {
    expect(() => validateAndNormalizePosting({
      ...validPosting,
      lines: [
        { accountCode: '1120', debit: '100.00' },
        { accountCode: '2200', credit: '99.99' },
      ],
    })).toThrow('Jurnal tidak balanced');
  });

  it('rejects a line with both debit and credit', () => {
    expect(() => validateAndNormalizePosting({
      ...validPosting,
      lines: [
        { accountCode: '1120', debit: '100.00', credit: '1.00' },
        { accountCode: '2200', credit: '99.00' },
      ],
    })).toThrow('tepat satu sisi debit atau kredit');
  });

  it('requires a source document', () => {
    expect(() => validateAndNormalizePosting({ ...validPosting, sourceLinks: [] }))
      .toThrow('source document');
  });

  it('rejects an empty source identity', () => {
    expect(() => validateAndNormalizePosting({
      ...validPosting,
      sourceLinks: [{ sourceType: 'STOCK_MUTATION', sourceId: ' ' }],
    })).toThrow('Source type dan source ID');
  });

  it('rejects an empty account code', () => {
    expect(() => validateAndNormalizePosting({
      ...validPosting,
      lines: [
        { accountCode: ' ', debit: '100.00' },
        { accountCode: '2200', credit: '100.00' },
      ],
    })).toThrow('Account code');
  });

  it('rejects values with more than two decimal places', () => {
    expect(() => validateAndNormalizePosting({
      ...validPosting,
      lines: [
        { accountCode: '1120', debit: '1.001' },
        { accountCode: '2200', credit: '1.001' },
      ],
    })).toThrow('dua angka desimal');
  });

  it('rejects cross-branch lines in one journal entry', () => {
    expect(() => validateAndNormalizePosting({
      ...validPosting,
      lines: [
        { accountCode: '1300', debit: '100.00', branchId: 'branch-1' },
        { accountCode: '2100', credit: '100.00', branchId: 'branch-2' },
      ],
    })).toThrow('satu branch');
  });

  it('rejects duplicate source relations', () => {
    expect(() => validateAndNormalizePosting({
      ...validPosting,
      sourceLinks: [
        { sourceType: 'PAYMENT', sourceId: 'payment-1' },
        { sourceType: 'payment', sourceId: 'payment-1', relationType: 'PRIMARY' },
      ],
    })).toThrow('tidak boleh duplikat');
  });
});
