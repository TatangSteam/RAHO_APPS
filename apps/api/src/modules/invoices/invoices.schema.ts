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
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QRIS', 'OTHER']),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type FinalizeInvoiceInput = z.infer<typeof finalizeInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
