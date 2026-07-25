import { z } from 'zod';

const decimalString = (scale: number) => z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(value), {
    message: `Harus berupa angka positif dengan maksimal ${scale} angka desimal`,
  })
  .refine((value) => Number(value) > 0, { message: 'Nilai harus lebih besar dari nol' });

const nonNegativeMoney = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value), {
    message: 'Unit cost harus berupa angka non-negatif dengan maksimal 4 angka desimal',
  });

export const receiveInventorySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  branchId: z.string().trim().min(1),
  inventoryItemId: z.string().trim().min(1),
  stockLocationId: z.string().trim().min(1).optional(),
  quantity: decimalString(4),
  unitCost: nonNegativeMoney,
  currency: z.literal('IDR').default('IDR'),
  batch: z.object({
    batchNumber: z.string().trim().min(1).max(100),
    manufactureDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
  }).optional(),
  sourceType: z.string().trim().min(1).max(80),
  sourceId: z.string().trim().min(1).max(160),
  sourceNumber: z.string().trim().max(160).optional(),
  reasonCode: z.string().trim().min(1).max(80).default('RECEIPT'),
  occurredAt: z.coerce.date().optional(),
  costCenterCode: z.string().trim().max(80).optional(),
});

export const openingInventorySchema = receiveInventorySchema.omit({
  sourceType: true,
  reasonCode: true,
  inventoryItemId: true,
}).extend({
  inventoryItemId: z.string().trim().min(1).optional(),
  masterProductId: z.string().trim().min(1).optional(),
}).superRefine((value, ctx) => {
  if (!value.inventoryItemId && !value.masterProductId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['masterProductId'],
      message: 'Pilih product untuk opening stock',
    });
  }
  if (value.inventoryItemId && value.masterProductId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['masterProductId'],
      message: 'Gunakan inventory item atau master product, bukan keduanya',
    });
  }
});

export const issueInventorySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  branchId: z.string().trim().min(1),
  sourceType: z.string().trim().min(1).max(80),
  sourceId: z.string().trim().min(1).max(160),
  sourceNumber: z.string().trim().max(160).optional(),
  reasonCode: z.string().trim().min(1).max(80).default('ISSUE'),
  occurredAt: z.coerce.date().default(() => new Date()),
  costCenterCode: z.string().trim().max(80).optional(),
  lines: z.array(z.object({
    inventoryItemId: z.string().trim().min(1),
    stockLocationId: z.string().trim().min(1).optional(),
    batchId: z.string().trim().min(1).optional(),
    quantity: decimalString(4),
  })).min(1).max(100),
});

export const reverseInventoryPostingSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  reasonCode: z.string().trim().min(3).max(80),
  occurredAt: z.coerce.date().default(() => new Date()),
});

export const inventoryLedgerQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  masterProductId: z.string().trim().min(1).optional(),
  inventoryItemId: z.string().trim().min(1).optional(),
  stockLocationId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ReceiveInventoryInput = z.infer<typeof receiveInventorySchema>;
export type OpeningInventoryInput = z.infer<typeof openingInventorySchema>;
export type IssueInventoryInput = z.infer<typeof issueInventorySchema>;
export type ReverseInventoryPostingInput = z.infer<typeof reverseInventoryPostingSchema>;
export type InventoryLedgerQuery = z.infer<typeof inventoryLedgerQuerySchema>;
