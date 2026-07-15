import { z } from 'zod';
import { Role, BranchType, PackageType } from '@prisma/client';

const emptyStringToNull = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const nullableTrimmedString = (schema: z.ZodString) =>
  z.preprocess(emptyStringToNull, schema.trim().nullable().optional());

// ============================================================
// BRANCH SCHEMAS
// ============================================================

export const createBranchSchema = z.object({
  branchCode: z.string()
    .min(2, 'Kode cabang minimal 2 karakter')
    .max(10, 'Kode cabang maksimal 10 karakter')
    .regex(/^[A-Z0-9]+$/, 'Kode cabang hanya boleh huruf besar dan angka'),
  name: z.string()
    .min(3, 'Nama cabang minimal 3 karakter')
    .max(100, 'Nama cabang maksimal 100 karakter'),
  address: z.string()
    .min(10, 'Alamat minimal 10 karakter')
    .max(500, 'Alamat maksimal 500 karakter'),
  city: z.string()
    .min(2, 'Nama kota minimal 2 karakter')
    .max(50, 'Nama kota maksimal 50 karakter'),
  phone: z.string()
    .min(10, 'Nomor telepon minimal 10 digit')
    .max(15, 'Nomor telepon maksimal 15 digit')
    .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid'),
  type: z.nativeEnum(BranchType).optional(),
  operatingHours: z.string()
    .min(5, 'Jam operasional minimal 5 karakter')
    .max(100, 'Jam operasional maksimal 100 karakter')
    .optional()
});

export const updateBranchSchema = z.object({
  name: z.string()
    .min(3, 'Nama cabang minimal 3 karakter')
    .max(100, 'Nama cabang maksimal 100 karakter')
    .optional(),
  address: z.string()
    .min(10, 'Alamat minimal 10 karakter')
    .max(500, 'Alamat maksimal 500 karakter')
    .optional(),
  city: z.string()
    .min(2, 'Nama kota minimal 2 karakter')
    .max(50, 'Nama kota maksimal 50 karakter')
    .optional(),
  phone: z.string()
    .min(10, 'Nomor telepon minimal 10 digit')
    .max(15, 'Nomor telepon maksimal 15 digit')
    .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid')
    .optional(),
  type: z.nativeEnum(BranchType).optional(),
  operatingHours: z.string()
    .min(5, 'Jam operasional minimal 5 karakter')
    .max(100, 'Jam operasional maksimal 100 karakter')
    .optional(),
  isActive: z.boolean().optional()
});

// ============================================================
// USER MANAGEMENT SCHEMAS
// ============================================================

export const createUserSchema = z.object({
  email: z.string()
    .email('Format email tidak valid')
    .max(100, 'Email maksimal 100 karakter'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .max(50, 'Password maksimal 50 karakter')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password harus mengandung huruf kecil, huruf besar, dan angka'),
  role: z.nativeEnum(Role),
  fullName: z.string()
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(100, 'Nama lengkap maksimal 100 karakter'),
  phone: z.string()
    .min(10, 'Nomor telepon minimal 10 digit')
    .max(15, 'Nomor telepon maksimal 15 digit')
    .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid')
    .optional(),
  branchIds: z.array(z.string().uuid('ID cabang tidak valid')).optional()
});

export const createAdminManagerSchema = z.object({
  email: z.string()
    .email('Format email tidak valid')
    .max(100, 'Email maksimal 100 karakter'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .max(50, 'Password maksimal 50 karakter'),
  fullName: z.string()
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(100, 'Nama lengkap maksimal 100 karakter'),
  phoneNumber: z.string()
    .min(10, 'Nomor telepon minimal 10 digit')
    .max(20, 'Nomor telepon maksimal 20 digit')
    .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid'),
  adminManagerAccessScope: z.enum(['FULL', 'MEMBER_VIEW_ONLY']).optional(),
  branchAssignments: z.array(z.object({
    branchId: z.string().min(1, 'ID cabang tidak valid'),
    accessScope: z.enum(['FULL', 'MEMBER_VIEW_ONLY']).optional(),
  })).optional(),
  branchIds: z.array(z.string().min(1, 'ID cabang tidak valid'))
    .optional()
}).refine(
  (data) => (data.branchAssignments?.length || 0) > 0 || (data.branchIds?.length || 0) > 0,
  {
    message: 'Minimal 1 cabang harus dipilih',
    path: ['branchIds'],
  },
);

// ============================================================
// STOCK REQUEST SCHEMAS
// ============================================================

export const stockRequestItemSchema = z.object({
  masterProductId: z.string()
    .uuid('ID produk tidak valid'),
  quantity: z.number()
    .int('Jumlah harus berupa bilangan bulat')
    .min(1, 'Jumlah minimal 1')
    .max(10000, 'Jumlah maksimal 10000'),
  notes: z.string()
    .max(200, 'Catatan maksimal 200 karakter')
    .optional()
});

export const createStockRequestSchema = z.object({
  notes: z.string()
    .max(500, 'Catatan maksimal 500 karakter')
    .optional(),
  items: z.array(stockRequestItemSchema)
    .max(50, 'Maksimal 50 item per permintaan')
});

// ============================================================
// PACKAGE PRICING SCHEMAS
// ============================================================

export const createPackagePricingSchema = z.object({
  packageType: z.nativeEnum(PackageType),
  boosterType: nullableTrimmedString(z.string()
    .min(1, 'Tipe booster minimal 1 karakter')
    .max(50, 'Tipe booster maksimal 50 karakter')), // Required for BOOSTER packages
  serviceType: nullableTrimmedString(z.string()
    .min(2, 'Tipe layanan minimal 2 karakter')
    .max(50, 'Tipe layanan maksimal 50 karakter')), // Required for BOOSTER packages
  name: z.string()
    .min(3, 'Nama paket minimal 3 karakter')
    .max(100, 'Nama paket maksimal 100 karakter'),
  totalSessions: z.number()
    .int('Total sesi harus berupa bilangan bulat')
    .min(1, 'Total sesi minimal 1')
    .max(100, 'Total sesi maksimal 100'),
  price: z.number()
    .min(0, 'Harga tidak boleh negatif')
    .max(100000000, 'Harga maksimal 100 juta'),
  productCode: nullableTrimmedString(z.string()
    .min(2, 'Kode produk minimal 2 karakter')
    .max(50, 'Kode produk maksimal 50 karakter')),
  isActive: z.boolean().optional(),
  branchId: nullableTrimmedString(z.string()
    .min(1, 'ID cabang tidak valid')) // Optional: null/undefined = global pricing
});

export const updatePackagePricingSchema = z.object({
  packageType: z.enum(['BASIC', 'BOOSTER']).optional(),
  boosterType: nullableTrimmedString(z.string()
    .min(1, 'Tipe booster minimal 1 karakter')
    .max(50, 'Tipe booster maksimal 50 karakter')),
  serviceType: nullableTrimmedString(z.string()
    .min(2, 'Tipe layanan minimal 2 karakter')
    .max(50, 'Tipe layanan maksimal 50 karakter')),
  name: z.string()
    .min(3, 'Nama paket minimal 3 karakter')
    .max(100, 'Nama paket maksimal 100 karakter')
    .optional(),
  totalSessions: z.number()
    .int('Jumlah sesi harus bilangan bulat')
    .min(1, 'Jumlah sesi minimal 1')
    .max(100, 'Jumlah sesi maksimal 100')
    .optional(),
  productCode: nullableTrimmedString(z.string()
    .min(2, 'Kode produk minimal 2 karakter')
    .max(50, 'Kode produk maksimal 50 karakter')),
  price: z.number()
    .min(0, 'Harga tidak boleh negatif')
    .max(100000000, 'Harga maksimal 100 juta')
    .optional(),
  isActive: z.boolean().optional()
});

// ============================================================
// NON-THERAPY PRODUCT (ADD-ON) SCHEMAS
// ============================================================

export const createNonTherapyProductSchema = z.object({
  productCode: z.string()
    .min(2, 'Kode produk minimal 2 karakter')
    .max(50, 'Kode produk maksimal 50 karakter'),
  productType: z.enum(['AIR_NANO', 'ROKOK_KENKOU']),
  name: z.string()
    .min(3, 'Nama produk minimal 3 karakter')
    .max(100, 'Nama produk maksimal 100 karakter'),
  description: z.string()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional(),
  pricePerUnit: z.number()
    .min(0, 'Harga tidak boleh negatif')
    .max(100000000, 'Harga maksimal 100 juta'),
  // Air Nano specific fields
  airNanoColor: z.enum(['KUNING', 'BIRU', 'HIJAU']).optional(),
  airNanoVolume: z.enum(['ML_600', 'ML_1500']).optional(),
  airNanoUnit: z.enum(['BOTOL', 'DUS']).optional(),
  isActive: z.boolean().optional()
});

export const updateNonTherapyProductSchema = z.object({
  name: z.string()
    .min(3, 'Nama produk minimal 3 karakter')
    .max(100, 'Nama produk maksimal 100 karakter')
    .optional(),
  description: z.string()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional(),
  pricePerUnit: z.number()
    .min(0, 'Harga tidak boleh negatif')
    .max(100000000, 'Harga maksimal 100 juta')
    .optional(),
  isActive: z.boolean().optional()
});

// ============================================================
// QUERY PARAMETER SCHEMAS
// ============================================================

export const periodQuerySchema = z.object({
  period: z.string()
    .regex(/^\d+$/, 'Period harus berupa angka')
    .transform(val => parseInt(val))
    .refine(val => val >= 1 && val <= 365, 'Period harus antara 1-365 hari')
    .optional()
    .default('30')
});

export const userFilterSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  branchId: z.string().uuid('ID cabang tidak valid').optional(),
  isActive: z.string()
    .transform(val => val === 'true')
    .optional(),
  search: z.string().optional(),
  page: z.string()
    .regex(/^\d+$/, 'Page harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('20')
});

export const packagePricingFilterSchema = z.object({
  branchId: z.string().min(1, 'ID cabang tidak valid').optional(),
  packageType: z.nativeEnum(PackageType).optional(),
  isActive: z.string()
    .transform(val => val === 'true')
    .optional(),
  search: z.string().optional(),
  page: z.string()
    .regex(/^\d+$/, 'Page harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('20')
});

// ============================================================
// IMPERSONATION SCHEMAS
// ============================================================

export const getAdminManagersQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.string()
    .transform(val => val === 'true' ? true : val === 'false' ? false : undefined)
    .optional(),
  page: z.string()
    .regex(/^\d+$/, 'Page harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('10')
});

export const getBranchAdminsQuerySchema = z.object({
  branchId: z.string().uuid('ID cabang tidak valid').optional(),
  search: z.string().optional(),
  isActive: z.string()
    .transform(val => val === 'true' ? true : val === 'false' ? false : undefined)
    .optional(),
  page: z.string()
    .regex(/^\d+$/, 'Page harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit harus berupa angka')
    .transform(val => parseInt(val))
    .optional()
    .default('10')
});

export const impersonateUserParamsSchema = z.object({
  userId: z.string().min(1, 'ID user tidak boleh kosong')
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateAdminManagerInput = z.infer<typeof createAdminManagerSchema>;
export type CreateStockRequestInput = z.infer<typeof createStockRequestSchema>;
export type StockRequestItemInput = z.infer<typeof stockRequestItemSchema>;
export type CreatePackagePricingInput = z.infer<typeof createPackagePricingSchema>;
export type UpdatePackagePricingInput = z.infer<typeof updatePackagePricingSchema>;
export type CreateNonTherapyProductInput = z.infer<typeof createNonTherapyProductSchema>;
export type UpdateNonTherapyProductInput = z.infer<typeof updateNonTherapyProductSchema>;
export type PeriodQueryInput = z.infer<typeof periodQuerySchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type PackagePricingFilterInput = z.infer<typeof packagePricingFilterSchema>;
export type GetAdminManagersQueryInput = z.infer<typeof getAdminManagersQuerySchema>;
export type GetBranchAdminsQueryInput = z.infer<typeof getBranchAdminsQuerySchema>;
export type ImpersonateUserParamsInput = z.infer<typeof impersonateUserParamsSchema>;
