import { z } from 'zod';
import { ReferrerType } from '@prisma/client';

const emptyStringToNull = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const nullableText = z.preprocess(
  emptyStringToNull,
  z.string().trim().nullable().optional(),
);

const nullableEmail = z.preprocess(
  emptyStringToNull,
  z.string().trim().email('Email tidak valid').nullable().optional(),
);

// ── Create Referral Schema ────────────────────────────────────
export const createReferralSchema = z.object({
  referrerName: z.string().min(1, 'Nama referrer wajib diisi'),
  referrerType: z.nativeEnum(ReferrerType),
  branchId: z.string().cuid('Branch ID tidak valid'),
  phone: nullableText,
  email: nullableEmail,
});

export type CreateReferralInput = z.infer<typeof createReferralSchema>;

// ── Update Referral Schema ────────────────────────────────────
export const updateReferralSchema = z.object({
  referrerName: z.string().min(1, 'Nama referrer wajib diisi').optional(),
  referrerType: z.nativeEnum(ReferrerType).optional(),
  phone: nullableText,
  email: nullableEmail,
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

