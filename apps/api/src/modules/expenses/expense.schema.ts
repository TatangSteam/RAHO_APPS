import { z } from 'zod';

export const createExpenseSchema = z.object({
  postingKey: z.string().trim().min(8).max(150),
  branchId: z.string().cuid(),
  expenseDate: z.coerce.date(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(3).max(500),
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Nominal maksimal dua desimal'),
  expenseAccountCode: z.string().trim().min(1).max(30),
  cashBankAccountId: z.string().cuid(),
});

export const updateExpenseSchema = createExpenseSchema
  .omit({ postingKey: true, branchId: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, 'Minimal satu field expense harus diubah.');

export const approvalExpenseSchema = z.object({ note: z.string().trim().max(500).optional() });
export const rejectExpenseSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const listExpensesQuerySchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID']).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
