import { z } from 'zod';

const money = z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Nominal maksimal dua desimal');
const quantity = z.string().regex(/^\d+(?:\.\d{1,4})?$/, 'Quantity maksimal empat desimal');

export const openingBalanceLineSchema = z.object({
  type: z.enum(['GENERAL', 'CASH_BANK', 'INVENTORY', 'AR', 'AP', 'DEPOSIT', 'DEFERRED_REVENUE']),
  accountCode: z.string().trim().min(1).max(30),
  description: z.string().trim().min(2).max(250),
  debit: money.default('0'),
  credit: money.default('0'),
  counterpartyRef: z.string().trim().max(100).optional(),
  cashBankAccountId: z.string().cuid().optional(),
  inventoryItemId: z.string().cuid().optional(),
  stockLocationId: z.string().cuid().optional(),
  quantity: quantity.optional(),
  unitCost: quantity.optional(),
  batchNumber: z.string().trim().max(100).optional(),
  manufactureDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
}).superRefine((line, context) => {
  const debit = Number(line.debit);
  const credit = Number(line.credit);
  if ((debit > 0) === (credit > 0)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Line harus memiliki tepat satu sisi debit/kredit' });
  if (line.type === 'CASH_BANK' && !line.cashBankAccountId) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cash/bank account wajib untuk opening kas/bank' });
  if (line.type === 'INVENTORY' && (!line.inventoryItemId || !line.stockLocationId || !line.quantity || !line.unitCost)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Item, lokasi, quantity, dan unit cost wajib untuk opening stock' });
  }
});

export const createOpeningBalanceSchema = z.object({
  postingKey: z.string().trim().min(8).max(150),
  branchId: z.string().cuid(),
  balanceDate: z.coerce.date(),
  description: z.string().trim().min(3).max(250),
  lines: z.array(openingBalanceLineSchema).min(2).max(500),
});

export const rejectOpeningBalanceSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const listOpeningBalancesQuerySchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'POSTED', 'REJECTED']).optional(),
});

export type CreateOpeningBalanceInput = z.infer<typeof createOpeningBalanceSchema>;
export type ListOpeningBalancesQuery = z.infer<typeof listOpeningBalancesQuerySchema>;
