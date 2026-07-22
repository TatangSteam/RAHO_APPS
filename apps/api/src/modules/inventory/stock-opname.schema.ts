import { StockAdjustmentReason } from '@prisma/client';
import { z } from 'zod';

const decimal = z.union([z.string(), z.number()]).transform(String)
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value), 'Quantity maksimal empat desimal.');

export const createStockOpnameSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  branchId: z.string().cuid(),
  countedAt: z.coerce.date(),
  reasonCode: z.nativeEnum(StockAdjustmentReason).default(StockAdjustmentReason.STOCK_OPNAME),
  notes: z.string().trim().min(3).max(1000),
  lines: z.array(z.object({
    inventoryItemId: z.string().cuid(),
    stockLocationId: z.string().cuid(),
    batchId: z.string().cuid().optional(),
    physicalQty: decimal,
    positiveUnitCost: decimal.optional(),
    notes: z.string().trim().max(500).optional(),
  })).min(1).max(500),
});

export const stockOpnameDecisionSchema = z.object({ note: z.string().trim().max(1000).optional() });
export const rejectStockOpnameSchema = z.object({ note: z.string().trim().min(3).max(1000) });
export const stockOpnameListSchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateStockOpnameInput = z.infer<typeof createStockOpnameSchema>;
export type StockOpnameListInput = z.infer<typeof stockOpnameListSchema>;
