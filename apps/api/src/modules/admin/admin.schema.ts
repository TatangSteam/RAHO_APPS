import { z } from 'zod';
import { Role, BranchType, PackageType } from '@prisma/client';

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
    .max(50, 'Password maksimal 50 karakter')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password harus mengandung huruf kecil, huruf besar, dan angka'),
  fullName: z.string()
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(100, 'Nama lengkap maksimal 100 karakter'),
  phone: z.string()
    .min(10, 'Nomor telepon minimal 10 digit')
    .max(15, 'Nomor telepon maksimal 15 digit')
    .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid'),
  branchIds: z.array(z.string().uuid('ID cabang tidak valid'))
    .min(1, 'Minimal 1 cabang harus dipilih')
});

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
    .min(1, 'Minimal 1 item harus diminta')
    .max(50, 'Maksimal 50 item per permintaan')
});

// ============================================================
// PACKAGE PRICING SCHEMAS
// ============================================================

export const createPackagePricingSchema = z.object({
  branchId: z.string()
    .uuid('ID cabang tidak valid'),
  packageType: z.nativeEnum(PackageType),
  productCode: z.string()
    .min(2, 'Kode produk minimal 2 karakter')
    .max(50, 'Kode produk maksimal 50 karakter')
    .optional(),
  name: z.string()
    .min(3, 'Nama paket minimal 3 karakter')
    .max(100, 'Nama paket maksimal 100 karakter'),
  totalSessions: z.number()
    .int('Total sesi harus berupa bilangan bulat')
    .min(1, 'Total sesi minimal 1')
    .max(100, 'Total sesi maksimal 100'),
  price: z.number()
    .min(0, 'Harga tidak boleh negatif')
    .max(100000000, 'Harga maksimal 100 juta')
});

export const updatePackagePricingSchema = z.object({
  name: z.string()
    .min(3, 'Nama paket minimal 3 karakter')
    .max(100, 'Nama paket maksimal 100 karakter')
    .optional(),
  productCode: z.string()
    .min(2, 'Kode produk minimal 2 karakter')
    .max(50, 'Kode produk maksimal 50 karakter')
    .optional(),
  price: z.number()
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
  branchId: z.string().uuid('ID cabang tidak valid').optional(),
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
export type PeriodQueryInput = z.infer<typeof periodQuerySchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type PackagePricingFilterInput = z.infer<typeof packagePricingFilterSchema>;