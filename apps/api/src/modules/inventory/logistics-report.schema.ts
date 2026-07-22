import { z } from 'zod';

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD');

const datedReportQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Tanggal akhir harus setelah tanggal awal' });
  }
});

export const logisticsDashboardQuerySchema = datedReportQuerySchema;

export const stockCardQuerySchema = datedReportQuerySchema.and(z.object({
  inventoryItemId: z.string().trim().min(1),
  stockLocationId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}));

export const inventoryValuationQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  masterProductId: z.string().trim().min(1).optional(),
  stockLocationId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type LogisticsDashboardQuery = z.infer<typeof logisticsDashboardQuerySchema>;
export type StockCardQuery = z.infer<typeof stockCardQuerySchema>;
export type InventoryValuationQuery = z.infer<typeof inventoryValuationQuerySchema>;
