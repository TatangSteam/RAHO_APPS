import { z } from 'zod';

// ============================================================
// INVOICE SCHEMAS
// ============================================================

export const invoiceItemSchema = z.object({
  itemType: z.enum(['PACKAGE', 'ADDON', 'NON_THERAPY']),
  itemId: z.string().cuid('Invalid item ID'),
  quantity: z.number().int().positive().default(1),
});

export const createInvoiceSchema = z.object({
  memberId: z.string().cuid('Invalid member ID'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  discountNote: z.string().optional(),
  taxPercent: z.number().min(0).max(100).default(0),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateInvoiceSchema = z.object({
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  discountNote: z.string().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const finalizeInvoiceSchema = z.object({
  dueDate: z.string().datetime().optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Nominal harus berupa decimal string maksimal dua desimal'),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER']),
  cashBankAccountId: z.string().cuid('Cash/bank account tidak valid'),
  paymentReference: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  postingKey: z.string().trim().min(8).max(150),
});

export const verifyPaymentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type FinalizeInvoiceInput = z.infer<typeof finalizeInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
