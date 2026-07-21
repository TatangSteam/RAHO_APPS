import { buildInternalTransferJournal, calculateTransferValueInvariant, INTERNAL_TRANSFER_ACCOUNTS } from '../internal-transfer-posting.helpers';

describe('AC-004 internal transfer posting policy', () => {
  it('menjaga total inventory value saat dispatch dan receipt', () => {
    const before = calculateTransferValueInvariant('1000000.0000', '0', '0');
    const duringTransit = calculateTransferValueInvariant('600000.0000', '400000.0000', '0');
    const afterReceipt = calculateTransferValueInvariant('600000.0000', '0', '400000.0000');
    expect(duringTransit.equals(before)).toBe(true);
    expect(afterReceipt.equals(before)).toBe(true);
  });

  it('hanya memakai akun aset persediaan dan in-transit tanpa revenue/expense', () => {
    const dispatch = buildInternalTransferJournal('DISPATCH', '400000.0000');
    const receipt = buildInternalTransferJournal('RECEIPT', '400000.0000');
    for (const journal of [dispatch, receipt]) {
      const debit = journal.reduce((sum, line) => sum.add(line.debit), journal[0].debit.mul(0));
      const credit = journal.reduce((sum, line) => sum.add(line.credit), journal[0].credit.mul(0));
      expect(debit.equals(credit)).toBe(true);
      expect(journal.map((line) => line.accountCode).sort()).toEqual(Object.values(INTERNAL_TRANSFER_ACCOUNTS).sort());
      expect(journal.every((line) => line.accountCode.startsWith('1'))).toBe(true);
    }
    expect(dispatch[0].accountCode).toBe(INTERNAL_TRANSFER_ACCOUNTS.inTransit);
    expect(receipt[0].accountCode).toBe(INTERNAL_TRANSFER_ACCOUNTS.inventory);
  });
});
