import { z } from 'zod';

const quantity = z.union([z.string(), z.number()]).transform(String)
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0, 'Quantity harus lebih dari 0 dengan maksimal 4 desimal.');
const nonNegativeQuantity = z.union([z.string(), z.number()]).transform(String)
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value), 'Quantity harus non-negatif dengan maksimal 4 desimal.');
const unitCost = z.union([z.string(), z.number()]).transform(String)
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) >= 0, 'Unit cost tidak valid.');
const positiveUnitCost = z.union([z.string(), z.number()]).transform(String)
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0, 'Harga pokok harus lebih dari 0 dengan maksimal 4 desimal.');
const signedAdjustment = z.union([z.string(), z.number()]).transform(String)
  .refine(
    (value) => /^-?\d+(?:\.\d{1,4})?$/.test(value) && Number(value) !== 0,
    'Penyesuaian stok harus bukan 0 dengan maksimal 4 desimal.',
  );

export const createAdjustmentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  branchId: z.string().trim().min(1),
  stockLocationId: z.string().trim().min(1),
  reasonCode: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  description: z.string().trim().min(5).max(500),
  submit: z.boolean().default(true),
  lines: z.array(z.object({
    inventoryItemId: z.string().trim().min(1),
    batchId: z.string().trim().min(1).optional(),
    direction: z.enum(['IN', 'OUT']),
    quantity,
    unitCost: unitCost.optional(),
    notes: z.string().trim().max(500).optional(),
  })).min(1).max(200),
});

export const adjustmentDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().min(3).max(500),
});

export const directStockAdjustmentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  adjustment: signedAdjustment,
  unitCost: positiveUnitCost.optional(),
  notes: z.string().trim().min(3).max(500),
  stockLocationId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  reasonCode: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()).default('OTHER'),
});

export const listInventoryControlSchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const startStockOpnameSchema = z.object({
  branchId: z.string().trim().min(1),
  stockLocationId: z.string().trim().min(1),
  notes: z.string().trim().max(500).optional(),
});

export const countStockOpnameSchema = z.object({
  lines: z.array(z.object({
    lineId: z.string().trim().min(1),
    physicalQty: nonNegativeQuantity,
    resolvedUnitCost: unitCost.optional(),
    resolution: z.enum(['ADJUST', 'RECOUNT']).optional(),
    resolutionNote: z.string().trim().max(500).optional(),
  })).min(1).max(500),
});

export const resolveDiscrepancySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  action: z.enum(['RELEASE_TO_STOCK', 'RETURN_TO_SENDER', 'WRITE_OFF', 'NO_STOCK_ACTION']),
  quantity: quantity.optional(),
  notes: z.string().trim().min(3).max(500),
});

export const completeMultiBagUsageSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  treatmentSessionId: z.string().trim().min(1),
  teamId: z.string().trim().min(1),
  branchId: z.string().trim().min(1),
  usageDate: z.coerce.date().default(() => new Date()),
  notes: z.string().trim().min(3).max(500),
  bags: z.array(z.object({
    bagId: z.string().trim().min(1),
    items: z.array(z.object({
      masterProductId: z.string().trim().min(1),
      quantity,
      unit: z.string().trim().max(30).optional(),
      notes: z.string().trim().max(500).optional(),
    })).min(1).max(100),
  })).min(2).max(20),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type AdjustmentDecisionInput = z.infer<typeof adjustmentDecisionSchema>;
export type DirectStockAdjustmentInput = z.infer<typeof directStockAdjustmentSchema>;
export type InventoryControlListQuery = z.infer<typeof listInventoryControlSchema>;
export type StartStockOpnameInput = z.infer<typeof startStockOpnameSchema>;
export type CountStockOpnameInput = z.infer<typeof countStockOpnameSchema>;
export type ResolveDiscrepancyInput = z.infer<typeof resolveDiscrepancySchema>;
export type CompleteMultiBagUsageInput = z.infer<typeof completeMultiBagUsageSchema>;
