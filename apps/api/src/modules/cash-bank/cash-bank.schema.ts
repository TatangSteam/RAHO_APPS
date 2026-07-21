import { z } from 'zod';

export const createCashBankAccountSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(2).max(100),
  type: z.enum(['CASH', 'BANK']),
  branchId: z.string().cuid(),
  coaAccountCode: z.string().trim().min(1).max(30),
  currency: z.string().trim().length(3).default('IDR'),
  bankName: z.string().trim().max(100).optional(),
  accountNumber: z.string().trim().max(100).optional(),
  accountHolderName: z.string().trim().max(100).optional(),
  requiresReference: z.boolean().default(false),
});

export const listCashBankAccountsQuerySchema = z.object({
  branchId: z.string().cuid().optional(),
  type: z.enum(['CASH', 'BANK']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export const listCashBankTransactionsQuerySchema = z.object({
  branchId: z.string().cuid().optional(),
  cashBankAccountId: z.string().cuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateCashBankAccountInput = z.infer<typeof createCashBankAccountSchema>;
export type ListCashBankAccountsQuery = z.infer<typeof listCashBankAccountsQuerySchema>;
export type ListCashBankTransactionsQuery = z.infer<typeof listCashBankTransactionsQuerySchema>;
