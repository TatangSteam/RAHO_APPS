import { z } from 'zod';
import { ProductType, AirNanoColor, AirNanoVolume, AirNanoUnit } from '@prisma/client';

// ============================================================
// NON-THERAPY PRODUCTS SCHEMAS
// ============================================================

export const createNonTherapyProductSchema = z.object({
  productCode: z.string().min(1, 'Product code is required'),
  productType: z.nativeEnum(ProductType),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  airNanoColor: z.nativeEnum(AirNanoColor).optional(),
  airNanoVolume: z.nativeEnum(AirNanoVolume).optional(),
  airNanoUnit: z.nativeEnum(AirNanoUnit).optional(),
  pricePerUnit: z.number().positive('Price must be positive'),
});

export const updateNonTherapyProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  pricePerUnit: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export const assignNonTherapyToMemberSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().optional(),
});

export const verifyNonTherapyPurchaseSchema = z.object({
  notes: z.string().optional(),
});

export type CreateNonTherapyProductInput = z.infer<typeof createNonTherapyProductSchema>;
export type UpdateNonTherapyProductInput = z.infer<typeof updateNonTherapyProductSchema>;
export type AssignNonTherapyToMemberInput = z.infer<typeof assignNonTherapyToMemberSchema>;
export type VerifyNonTherapyPurchaseInput = z.infer<typeof verifyNonTherapyPurchaseSchema>;
