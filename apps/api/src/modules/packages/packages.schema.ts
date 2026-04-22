import { z } from 'zod';

// PackageType enum (mirrors Prisma schema)
const PackageTypeEnum = z.enum(['BASIC', 'BOOSTER']);

// Extended booster types (NO, GT, MB, KCL, H2S, HK, O3)
const ExtendedBoosterTypeEnum = z.enum(['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3']);

// Service types for pricing
const ServiceTypeEnum = z.enum(['PM', 'PS', 'PTY', 'PDA', 'PHC']);

// Add-on types
const AddOnTypeEnum = z.enum(['AIR_NANO', 'ROKOK_KENKOU', 'KONSULTASI_GIZI', 'KONSULTASI_PSIKOLOG', 'LAINNYA']);

export const assignPackageSchema = z.object({
  // Array of packages to assign (optional if addOns provided)
  packages: z.array(z.object({
    pricingId: z.string(),
    quantity: z.number().int().min(1),
    boosterType: ExtendedBoosterTypeEnum.optional(), // For booster packages
    serviceType: ServiceTypeEnum.optional(), // For booster packages
  })).default([]),
  
  // Array of add-ons to assign (optional)
  addOns: z.array(z.object({
    type: AddOnTypeEnum,
    code: z.string(),
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
  })).default([]),
  
  // Discount
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  discountNote: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.packages.length > 0 || data.addOns.length > 0,
  { message: 'Minimal 1 paket atau add-on harus dipilih' }
);

export const verifyPaymentSchema = z.object({
  notes: z.string().optional(),
  // Payment proof file (required)
  proofFileUrl: z.string().url('URL file bukti pembayaran harus valid'),
  proofFileName: z.string().min(1, 'Nama file bukti pembayaran diperlukan'),
  proofFileSize: z.number().int().min(1, 'Ukuran file harus lebih dari 0'),
  proofMimeType: z.string().refine(
    (type) => ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(type),
    { message: 'Format file harus JPG, PNG, atau PDF' }
  ),
});

export const createPackagePricingSchema = z.object({
  packageType: PackageTypeEnum,
  name: z.string().min(3, 'Nama paket minimal 3 karakter'),
  totalSessions: z.number().int().min(1, 'Jumlah sesi minimal 1'),
  price: z.number().min(0, 'Harga tidak boleh negatif'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updatePackagePricingSchema = z.object({
  name: z.string().min(3).optional(),
  price: z.number().min(0).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type AssignPackageInput = z.infer<typeof assignPackageSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type CreatePackagePricingInput = z.infer<typeof createPackagePricingSchema>;
export type UpdatePackagePricingInput = z.infer<typeof updatePackagePricingSchema>;
