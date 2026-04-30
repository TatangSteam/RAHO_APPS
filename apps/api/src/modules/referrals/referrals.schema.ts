import { z } from 'zod';
import { ReferrerType } from '@prisma/client';

// ── Create Referral Schema ────────────────────────────────────
export const createReferralSchema = z.object({
  referrerName: z.string().min(1, 'Nama referrer wajib diisi'),
  referrerType: z.nativeEnum(ReferrerType),
  branchId: z.string().cuid('Branch ID tidak valid'),
  phone: z.string().optional(),
  email: z.string().email('Email tidak valid').optional(),
});

export type CreateReferralInput = z.infer<typeof createReferralSchema>;

// ── Update Referral Schema ────────────────────────────────────
export const updateReferralSchema = z.object({
  referrerName: z.string().min(1, 'Nama referrer wajib diisi').optional(),
  referrerType: z.nativeEnum(ReferrerType).optional(),
  phone: z.string().optional(),
  email: z.string().email('Email tidak valid').optional(),
  isActive: z.boolean().optional(),
});

export type UpdateReferralInput = z.infer<typeof updateReferralSchema>;

// ── List Referrals Query Schema ───────────────────────────────
export const listReferralsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  branchId: z.string().cuid().optional(),
  referrerType: z.nativeEnum(ReferrerType).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export type ListReferralsQuery = z.infer<typeof listReferralsQuerySchema>;

