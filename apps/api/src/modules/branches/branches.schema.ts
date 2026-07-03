import { z } from 'zod';

const branchTypeSchema = z.enum(['PUSAT', 'PREMIER', 'PARTNERSHIP']);
const provinceCodeSchema = z.string().regex(/^\d{2}$/, 'Kode provinsi harus 2 digit');
const branchCodeSchema = z
  .string()
  .trim()
  .min(3, 'Kode cabang minimal 3 karakter')
  .max(20, 'Kode cabang maksimal 20 karakter')
  .regex(/^[a-zA-Z0-9]+$/, 'Kode cabang hanya boleh berisi huruf dan angka')
  .transform((value) => value.toUpperCase());
const regencyCodeSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 4) return value.trim();
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  },
  z.string().regex(/^\d{2}\.\d{2}$/, 'Kode kabupaten/kota harus 4 digit, contoh 31.71')
);

// ── Create Branch Schema ──────────────────────────────────────
export const createBranchSchema = z.object({
  name: z.string().min(3).max(100),
  address: z.string().min(5),
  city: z.string().min(2).max(50),
  provinceCode: provinceCodeSchema.optional(),
  regencyCode: regencyCodeSchema,
  phone: z.string().min(8).max(20),
  type: branchTypeSchema.default('PREMIER'),
  operatingHours: z.string().optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

// ── Update Branch Schema ──────────────────────────────────────
export const updateBranchSchema = z
  .object({
    name: z.string().min(3).max(100).optional(),
    address: z.string().min(5).optional(),
    city: z.string().min(2).max(50).optional(),
    provinceCode: provinceCodeSchema.optional(),
    regencyCode: regencyCodeSchema.optional(),
    phone: z.string().min(8).max(20).optional(),
    type: branchTypeSchema.optional(),
    operatingHours: z.string().optional(),
    isActive: z.boolean().optional(),
    branchCode: branchCodeSchema.optional(),
    autoGenerateBranchCode: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.autoGenerateBranchCode && !data.regencyCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['regencyCode'],
        message: 'Kabupaten/kota wajib dipilih untuk membuat kode cabang otomatis',
      });
    }
  });

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

// ── Update Branch Code Schema (Super Admin only) ──────────────
export const updateBranchCodeSchema = z.object({
  branchCode: branchCodeSchema.optional(),
  autoGenerateBranchCode: z.boolean().optional(),
}).refine(
  (data) => data.branchCode || data.autoGenerateBranchCode,
  { message: 'Either branchCode or autoGenerateBranchCode must be provided' }
);

export type UpdateBranchCodeInput = z.infer<typeof updateBranchCodeSchema>;

// ── List Branches Query Schema ────────────────────────────────
export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  type: branchTypeSchema.optional(),
});

export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
