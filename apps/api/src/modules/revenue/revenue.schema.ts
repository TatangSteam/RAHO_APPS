import { z } from 'zod';

export const upsertRevenuePolicySchema = z.object({
  packagePricingId: z.string().cuid(),
  deferredRevenueAccountCode: z.string().trim().min(1).max(30).default('2200'),
  revenueAccountCode: z.string().trim().min(1).max(30).default('4100'),
  effectiveFrom: z.coerce.date().optional(),
});
export const revenueListQuerySchema = z.object({
  branchId: z.string().cuid().optional(),
  status: z.enum(['UNFUNDED', 'ACTIVE', 'FULLY_RECOGNIZED', 'CANCELLED']).optional(),
});
export type UpsertRevenuePolicyInput = z.infer<typeof upsertRevenuePolicySchema>;
export type RevenueListQuery = z.infer<typeof revenueListQuerySchema>;
