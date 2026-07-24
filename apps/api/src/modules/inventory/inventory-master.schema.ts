import { ProductCategory } from '@prisma/client';
import { z } from 'zod';

const code = z.string().trim().min(1).max(40).transform((value) => value.toUpperCase());
const positiveDecimal = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d{1,12}(?:\.\d{1,6})?$/.test(value) && Number(value) > 0, {
    message: 'Nilai harus lebih besar dari nol, maksimal 12 digit utuh dan 6 angka desimal',
  });

export const masterListQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  includeInactive: z.coerce.boolean().default(false),
  search: z.string().trim().max(100).optional(),
});

export const createWarehouseSchema = z.object({
  branchId: z.string().trim().min(1),
  code,
  name: z.string().trim().min(2).max(120),
  isDefault: z.boolean().default(false),
});

export const updateWarehouseSchema = createWarehouseSchema.omit({ branchId: true }).partial().extend({
  isActive: z.boolean().optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Minimal satu field harus diubah' },
);

export const createStockLocationSchema = z.object({
  warehouseId: z.string().trim().min(1),
  code,
  name: z.string().trim().min(2).max(120),
  isDefault: z.boolean().default(false),
});

export const updateStockLocationSchema = createStockLocationSchema.omit({ warehouseId: true }).partial().extend({
  isActive: z.boolean().optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Minimal satu field harus diubah' },
);

export const createUomSchema = z.object({
  code,
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(80).optional(),
  precision: z.number().int().min(0).max(6).default(4),
});

export const updateUomSchema = createUomSchema.partial().extend({
  isActive: z.boolean().optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Minimal satu field harus diubah' },
);

export const createMasterProductSchema = z.object({
  sku: code,
  name: z.string().trim().min(2).max(160),
  category: z.nativeEnum(ProductCategory),
  description: z.string().trim().max(1000).optional(),
  baseUomId: z.string().trim().min(1),
  usageUomId: z.string().trim().min(1),
  conversionFactor: positiveDecimal,
  tracksBatch: z.boolean().default(false),
  tracksExpiry: z.boolean().default(false),
  isAutoUsedPerSession: z.boolean().default(false),
  isAutoAddedToBranch: z.boolean().default(false),
});

export const updateMasterProductSchema = createMasterProductSchema.partial().extend({
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Minimal satu field harus diubah',
});

export const conversionPreviewSchema = z.object({
  quantity: positiveDecimal,
  factor: positiveDecimal,
  direction: z.enum(['BASE_TO_USAGE', 'USAGE_TO_BASE']),
});

export const createBatchSchema = z.object({
  masterProductId: z.string().trim().min(1),
  batchNumber: z.string().trim().min(1).max(100),
  manufactureDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
}).refine(
  (value) => !value.manufactureDate || !value.expiryDate || value.expiryDate > value.manufactureDate,
  { path: ['expiryDate'], message: 'Expiry date harus setelah manufacture date' },
);

export const updateBatchSchema = z.object({
  batchNumber: z.string().trim().min(1).max(100).optional(),
  manufactureDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  isBlocked: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Minimal satu field harus diubah',
});

export type MasterListQuery = z.infer<typeof masterListQuerySchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateStockLocationInput = z.infer<typeof createStockLocationSchema>;
export type UpdateStockLocationInput = z.infer<typeof updateStockLocationSchema>;
export type CreateUomInput = z.infer<typeof createUomSchema>;
export type UpdateUomInput = z.infer<typeof updateUomSchema>;
export type CreateMasterProductInput = z.infer<typeof createMasterProductSchema>;
export type UpdateMasterProductInput = z.infer<typeof updateMasterProductSchema>;
export type ConversionPreviewInput = z.infer<typeof conversionPreviewSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
