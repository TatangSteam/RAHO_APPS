import { z } from 'zod';

const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Nominal maksimal dua desimal')
  .refine((value) => Number(value) > 0, 'Nominal harus lebih besar dari nol.');

const baseFields = z.object({
  branchId: z.string().cuid(),
  expenseDate: z.coerce.date(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(500),
  amount: money,
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']),
  recipientBankName: z.string().trim().max(100).optional(),
  recipientAccountNumber: z.string().trim().max(50).optional(),
  recipientAccountHolder: z.string().trim().max(120).optional(),
});

function bankDestinationIsComplete(input: z.infer<typeof baseFields>) {
  return input.paymentMethod !== 'BANK_TRANSFER'
    || Boolean(input.recipientBankName && input.recipientAccountNumber && input.recipientAccountHolder);
}

export const createReimbursementSchema = baseFields.extend({
  postingKey: z.string().trim().min(8).max(150),
}).refine(bankDestinationIsComplete, {
  path: ['recipientAccountNumber'],
  message: 'Nama bank, nomor rekening, dan pemilik rekening wajib untuk transfer.',
});

export const updateReimbursementSchema = baseFields.omit({ branchId: true }).partial()
  .refine((input) => Object.keys(input).length > 0, 'Minimal satu data reimburse harus diubah.');

export const reimbursementDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN_FOR_REVISION']),
  note: z.string().trim().max(500).optional(),
}).refine((input) => input.decision === 'APPROVE' || Boolean(input.note && input.note.length >= 3), {
  path: ['note'], message: 'Alasan atau catatan perbaikan wajib diisi.',
});

export const payReimbursementSchema = z.object({
  expenseAccountCode: z.string().trim().min(1).max(30),
  cashBankAccountId: z.string().cuid(),
  paymentDate: z.coerce.date(),
  paymentReference: z.string().trim().max(120).optional(),
});

export const listReimbursementsQuerySchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAID']).optional(),
});

export type CreateReimbursementInput = z.infer<typeof createReimbursementSchema>;
export type UpdateReimbursementInput = z.infer<typeof updateReimbursementSchema>;
export type ReimbursementDecisionInput = z.infer<typeof reimbursementDecisionSchema>;
export type PayReimbursementInput = z.infer<typeof payReimbursementSchema>;
export type ListReimbursementsQuery = z.infer<typeof listReimbursementsQuerySchema>;
