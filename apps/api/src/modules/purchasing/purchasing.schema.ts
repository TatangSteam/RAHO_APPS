import { z } from 'zod';

const money = z.string().regex(/^\d+(?:\.\d{1,4})?$/, 'Nominal maksimal empat desimal');
const quantity = z.string().regex(/^\d+(?:\.\d{1,4})?$/, 'Quantity maksimal empat desimal');

export const createSupplierSchema = z.object({
  code: z.string().trim().min(2).max(30), name: z.string().trim().min(2).max(150),
  taxId: z.string().trim().max(50).optional(), contactName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(), email: z.string().email().optional(),
  address: z.string().trim().max(500).optional(), paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
});
export const updateSupplierSchema = createSupplierSchema.partial().extend({ status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional() });
export const listPurchasingSchema = z.object({ branchId: z.string().cuid().optional(), status: z.string().trim().max(40).optional() });

export const createPurchaseRequestSchema = z.object({
  postingKey: z.string().trim().min(8).max(150), branchId: z.string().cuid(), requestDate: z.coerce.date(),
  requiredDate: z.coerce.date().optional(), description: z.string().trim().min(3).max(500),
  items: z.array(z.object({ masterProductId: z.string().cuid(), description: z.string().trim().min(2).max(250), requestedQty: quantity, estimatedUnitCost: money })).min(1).max(100),
});
export const approvePurchaseRequestSchema = z.object({
  note: z.string().trim().max(500).optional(),
  items: z.array(z.object({ itemId: z.string().cuid(), approvedQty: quantity })).min(1),
});
export const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const createPurchaseOrderSchema = z.object({
  postingKey: z.string().trim().min(8).max(150), purchaseRequestId: z.string().cuid(), supplierId: z.string().cuid(),
  orderDate: z.coerce.date(), expectedDate: z.coerce.date().optional(), notes: z.string().trim().max(500).optional(),
});
export const createGoodsReceiptSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(150), receiptDate: z.coerce.date(), evidenceReference: z.string().trim().max(500).optional(),
  lines: z.array(z.object({ purchaseOrderItemId: z.string().cuid(), inventoryItemId: z.string().cuid(), stockLocationId: z.string().cuid(), quantity,
    batchNumber: z.string().trim().max(80).optional(), manufactureDate: z.coerce.date().optional(), expiryDate: z.coerce.date().optional() })).min(1).max(100),
});
export const createSupplierInvoiceSchema = z.object({
  postingKey: z.string().trim().min(8).max(150), purchaseOrderId: z.string().cuid(), supplierInvoiceNumber: z.string().trim().min(2).max(100),
  invoiceDate: z.coerce.date(), dueDate: z.coerce.date(), amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/), evidenceReference: z.string().trim().max(500).optional(),
});
export const createSupplierPaymentSchema = z.object({
  postingKey: z.string().trim().min(8).max(150), cashBankAccountId: z.string().cuid(), paymentDate: z.coerce.date(),
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/), paymentReference: z.string().trim().min(2).max(150),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type ApprovePurchaseRequestInput = z.infer<typeof approvePurchaseRequestSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;
export type CreateSupplierInvoiceInput = z.infer<typeof createSupplierInvoiceSchema>;
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;
