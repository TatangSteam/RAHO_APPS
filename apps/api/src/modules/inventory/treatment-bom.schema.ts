import { z } from 'zod';

const positiveQuantity = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0, {
    message: 'Quantity harus lebih besar dari nol dan maksimal 4 angka desimal.',
  });

export const treatmentBomItemSchema = z.object({
  masterProductId: z.string().trim().min(1),
  recommendedQuantity: positiveQuantity,
  tolerancePercent: z.coerce.number().min(0).max(100).default(0),
  isRequired: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(1000).optional(),
});

export const createTreatmentBomSchema = z.object({
  packagePricingId: z.string().trim().min(1),
  branchId: z.string().trim().min(1).nullable().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(treatmentBomItemSchema).min(1).max(100),
}).superRefine((value, context) => {
  if (value.effectiveFrom && value.effectiveTo && value.effectiveTo <= value.effectiveFrom) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['effectiveTo'], message: 'Effective to harus setelah effective from.' });
  }
  const productIds = value.items.map((item) => item.masterProductId);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Product tidak boleh duplikat dalam satu BOM.' });
  }
});

export const updateTreatmentBomSchema = z.object({
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  items: z.array(treatmentBomItemSchema).min(1).max(100).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Minimal satu field harus diubah.',
}).superRefine((value, context) => {
  if (value.effectiveFrom && value.effectiveTo && value.effectiveTo <= value.effectiveFrom) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['effectiveTo'], message: 'Effective to harus setelah effective from.' });
  }
  if (value.items) {
    const productIds = value.items.map((item) => item.masterProductId);
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Product tidak boleh duplikat dalam satu BOM.' });
    }
  }
});

export const treatmentBomListQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  packagePricingId: z.string().trim().min(1).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateTreatmentBomInput = z.infer<typeof createTreatmentBomSchema>;
export type UpdateTreatmentBomInput = z.infer<typeof updateTreatmentBomSchema>;
export type TreatmentBomListQuery = z.infer<typeof treatmentBomListQuerySchema>;
