import { z } from 'zod';

// ── Create Branch Schema ──────────────────────────────────────
export const createBranchSchema = z.object({
  branchCode: z.string().min(2).max(10),
  name: z.string().min(3).max(100),
  address: z.string().min(5),
  city: z.string().min(2).max(50),
  phone: z.string().min(8).max(20),
  type: z.enum(['KLINIK', 'HOMECARE', 'PREMIERE', 'PARTNERSHIP']).default('PREMIERE'),
  operatingHours: z.string().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

// ── Update Branch Schema ──────────────────────────────────────
export const updateBranchSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).max(50).optional(),
  phone: z.string().min(8).max(20).optional(),
  type: z.enum(['KLINIK', 'HOMECARE', 'PREMIERE', 'PARTNERSHIP']).optional(),
  operatingHours: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

// ── List Branches Query Schema ────────────────────────────────
export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  type: z.enum(['KLINIK', 'HOMECARE', 'PREMIERE', 'PARTNERSHIP']).optional(),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
