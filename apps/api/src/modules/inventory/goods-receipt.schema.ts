import { GoodsReceiptCondition, PurchaseOrderStatus } from '@prisma/client';
import { z } from 'zod';

const positiveDecimal = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0, {
    message: 'Quantity harus lebih besar dari nol dengan maksimal 4 angka desimal',
  });

const optionalDate = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.coerce.date().optional(),
);

const batchSchema = z.object({
  batchNumber: z.string().trim().min(1).max(100),
  manufactureDate: optionalDate,
  expiryDate: optionalDate,
});

export const postGoodsReceiptSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  receivedAt: z.coerce.date().default(() => new Date()),
  supplierDeliveryNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({
    purchaseOrderItemId: z.string().trim().min(1),
    quantity: positiveDecimal,
    stockLocationId: z.string().trim().min(1),
    condition: z.nativeEnum(GoodsReceiptCondition).default(GoodsReceiptCondition.GOOD),
    batch: batchSchema.optional(),
    notes: z.string().trim().max(500).optional(),
  })).min(1).max(200),
}).superRefine((value, context) => {
  const keys = value.lines.map((line) => [
    line.purchaseOrderItemId,
    line.stockLocationId,
    line.batch?.batchNumber ?? 'NO_BATCH',
    line.condition,
  ].join(':'));
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lines'],
      message: 'PO item, lokasi, batch, dan kondisi tidak boleh duplikat dalam satu receipt',
    });
  }
  value.lines.forEach((line, index) => {
    if (line.condition !== GoodsReceiptCondition.GOOD && !line.notes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines', index, 'notes'],
        message: 'Catatan wajib untuk barang non-good',
      });
    }
  });
});

export const purchaseOrderListQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const goodsReceiptListQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  purchaseOrderId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PostGoodsReceiptInput = z.infer<typeof postGoodsReceiptSchema>;
export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;
export type GoodsReceiptListQuery = z.infer<typeof goodsReceiptListQuerySchema>;
