import { z } from 'zod';

const money = z.union([z.string(), z.number()]).transform(String)
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), 'Nominal tidak valid.');

export const createApprovalRuleSchema = z.object({
  ruleCode: z.string().trim().min(3).max(80).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(3).max(160),
  module: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
  transactionType: z.string().trim().min(1).max(80).default('*').transform((value) => value.toUpperCase()),
  branchId: z.string().cuid().optional(),
  category: z.string().trim().max(80).optional(),
  minAmount: money.default('0'),
  maxAmount: money.optional(),
  priority: z.number().int().min(0).max(10000).default(0),
  steps: z.array(z.object({
    name: z.string().trim().min(2).max(120),
    permissionCode: z.string().trim().min(3).max(120).transform((value) => value.toUpperCase()),
    requiredApprovals: z.number().int().min(1).max(10).default(1),
  })).min(1).max(10),
}).refine((value) => !value.maxAmount || Number(value.maxAmount) >= Number(value.minAmount), {
  path: ['maxAmount'], message: 'Max amount harus lebih besar atau sama dengan min amount.',
});

export const approvalInboxQuerySchema = z.object({
  module: z.string().trim().max(80).optional(),
  branchId: z.string().cuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).default('PENDING'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateApprovalRuleInput = z.infer<typeof createApprovalRuleSchema>;
export type ApprovalInboxQuery = z.infer<typeof approvalInboxQuerySchema>;
