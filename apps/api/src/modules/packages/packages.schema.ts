import { z } from 'zod';

// PackageType enum (mirrors Prisma schema)
const PackageTypeEnum = z.enum(['BASIC', 'BOOSTER']);

// Extended booster types (NO, GT, MB, KCL, H2S, HK, O3, HHO, NO2)
const ExtendedBoosterTypeEnum = z.enum(['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3', 'HHO', 'NO2']);

// Service types for pricing
const ServiceTypeEnum = z.enum(['PM', 'PS', 'PTY', 'PDA', 'PHC']);

// Add-on types
const AddOnTypeEnum = z.enum(['AIR_NANO', 'ROKOK_KENKOU', 'KONSULTASI_GIZI', 'KONSULTASI_PSIKOLOG', 'LAINNYA']);

const PaymentPlanTypeEnum = z.enum(['FULL_PAYMENT', 'INSTALLMENT']);

function isValidProofFileUrl(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return (
    normalizedPath.startsWith('/api/v1/files/') ||
    normalizedPath.startsWith('/files/') ||
    normalizedPath.startsWith('/invoices/')
  );
}

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
  paymentPlan: z.object({
    type: PaymentPlanTypeEnum.default('FULL_PAYMENT'),
    installmentCount: z.number().int().min(2).max(24).optional(),
    installments: z.array(z.object({
      installmentNumber: z.number().int().min(1),
      amount: z.number().min(0),
      dueDate: z.string().datetime().optional(),
    })).optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.packages.length === 0 && data.addOns.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimal 1 paket atau add-on harus dipilih',
    });
  }

  if (data.paymentPlan?.type === 'INSTALLMENT') {
    const installmentCount = data.paymentPlan.installmentCount || 0;
    const installments = data.paymentPlan.installments || [];

    if (installmentCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentPlan', 'installmentCount'],
        message: 'Jumlah termin minimal 2',
      });
    }

    if (installments.length !== installmentCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentPlan', 'installments'],
        message: 'Jumlah nominal termin harus sesuai jumlah termin',
      });
    }

    if (!installments[0] || installments[0].amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentPlan', 'installments', 0, 'amount'],
        message: 'Termin pertama wajib memiliki nominal pembayaran awal',
      });
    }

    installments.forEach((installment, index) => {
      if (installment.installmentNumber !== index + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentPlan', 'installments', index, 'installmentNumber'],
          message: 'Nomor termin tidak berurutan',
        });
      }
    });
  }
});

export const verifyPaymentSchema = z.object({
  notes: z.string().optional(),
  paidAmount: z.number().min(0).optional(),
  // Payment proof file (required)
  proofFileUrl: z.string().min(1, 'URL file bukti pembayaran harus valid').refine(
    isValidProofFileUrl,
    { message: 'URL file bukti pembayaran harus valid' }
  ),
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

export const refundPackageSchema = z.object({
  reason: z.string().min(8, 'Alasan refund minimal 8 karakter'),
  refundAmount: z.preprocess(
    (val) => val === undefined || val === '' ? undefined : Number(val),
    z.number().min(0).optional()
  ),
});

export const cancelPackageSchema = z.object({
  reason: z.string().min(5, 'Alasan pembatalan minimal 5 karakter'),
});

export const editPackageSchema = z.object({
  packages: z.array(z.object({
    pricingId: z.string(),
    quantity: z.number().int().min(1),
    boosterType: ExtendedBoosterTypeEnum.optional(),
    serviceType: ServiceTypeEnum.optional(),
  })).default([]),
  
  addOns: z.array(z.object({
    type: AddOnTypeEnum,
    code: z.string(),
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
  })).default([]),
  
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  discountNote: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.packages.length > 0 || data.addOns.length > 0,
  { message: 'Minimal 1 paket atau add-on harus dipilih' }
);

export type AssignPackageInput = z.infer<typeof assignPackageSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type CreatePackagePricingInput = z.infer<typeof createPackagePricingSchema>;
export type UpdatePackagePricingInput = z.infer<typeof updatePackagePricingSchema>;
export type RefundPackageInput = z.infer<typeof refundPackageSchema>;
export type CancelPackageInput = z.infer<typeof cancelPackageSchema>;
export type EditPackageInput = z.infer<typeof editPackageSchema>;
