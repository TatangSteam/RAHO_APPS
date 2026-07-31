import { z } from 'zod';

const quantity = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
    message: 'Quantity harus berupa angka non-negatif dengan maksimal 2 angka desimal',
  });

export const approveStockRequestReservationSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  sourceBranchId: z.string().trim().min(1),
  reviewNotes: z.string().trim().max(1000).optional(),
  lines: z.array(z.object({
    stockRequestItemId: z.string().trim().min(1),
    approvedQty: quantity,
    stockLocationId: z.string().trim().min(1).optional(),
  })).min(1).max(100),
}).superRefine((value, context) => {
  const ids = value.lines.map((line) => line.stockRequestItemId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines'], message: 'Stock request item tidak boleh duplikat' });
  }
  if (!value.lines.some((line) => Number(line.approvedQty) > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['lines'], message: 'Minimal satu item harus disetujui' });
  }
});

export const releaseStockReservationSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(3).max(500),
});

export const stockReservationQuerySchema = z.object({
  sourceBranchId: z.string().trim().min(1).optional(),
  destinationBranchId: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'RELEASED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ApproveStockRequestReservationInput = z.infer<typeof approveStockRequestReservationSchema>;
export type ReleaseStockReservationInput = z.infer<typeof releaseStockReservationSchema>;
export type StockReservationQuery = z.infer<typeof stockReservationQuerySchema>;
