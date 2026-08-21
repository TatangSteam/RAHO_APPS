import { createReimbursementSchema, reimbursementDecisionSchema } from '../reimbursement.schema';

const valid = {
  postingKey: 'claim-key-123',
  branchId: 'cm12345678901234567890123',
  expenseDate: '2026-08-21',
  category: 'Transportasi',
  description: 'Transport ke lokasi homecare',
  amount: '150000',
  paymentMethod: 'BANK_TRANSFER',
  recipientBankName: 'BCA',
  recipientAccountNumber: '1234567890',
  recipientAccountHolder: 'Pengaju Reimburse',
};

describe('reimbursement input', () => {
  it('requires a complete destination for bank transfer', () => {
    const result = createReimbursementSchema.safeParse({ ...valid, recipientAccountNumber: '' });
    expect(result.success).toBe(false);
  });

  it('allows cash reimbursement without bank destination', () => {
    const result = createReimbursementSchema.safeParse({
      ...valid,
      paymentMethod: 'CASH',
      recipientBankName: '',
      recipientAccountNumber: '',
      recipientAccountHolder: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero and more than two decimal places', () => {
    expect(createReimbursementSchema.safeParse({ ...valid, amount: '0' }).success).toBe(false);
    expect(createReimbursementSchema.safeParse({ ...valid, amount: '10.123' }).success).toBe(false);
  });

  it('requires a reason for rejection and revision', () => {
    expect(reimbursementDecisionSchema.safeParse({ decision: 'REJECT' }).success).toBe(false);
    expect(reimbursementDecisionSchema.safeParse({ decision: 'RETURN_FOR_REVISION', note: 'Perbaiki foto bukti.' }).success).toBe(true);
    expect(reimbursementDecisionSchema.safeParse({ decision: 'APPROVE' }).success).toBe(true);
  });
});
