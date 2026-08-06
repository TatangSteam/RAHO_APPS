import { z } from 'zod';
import {
  DiscrepancyType,
  HomecareBagOpnameStatus,
  HomecareBagStatus,
  HomecareBagUsageStatus,
  HomecareTeamMemberRole,
} from '@prisma/client';

const idSchema = z.string().min(1, 'ID wajib diisi');
const optionalText = z.string().trim().optional();
const requiredNotes = z.string().trim().min(1, 'Keterangan wajib diisi');
const positiveQty = z.coerce.number().positive('Jumlah harus lebih dari 0');
const nonNegativeQty = z.coerce.number().min(0, 'Jumlah tidak boleh negatif');

const supportFileSchema = z.object({
  supportFileUrl: optionalText,
  supportFileName: optionalText,
  supportFileSize: z.coerce.number().int().positive().optional(),
  supportFileMimeType: optionalText,
});

const stockRequestItemSchema = z.object({
  masterProductId: idSchema,
  requestedQty: positiveQty,
  notes: optionalText,
});

const approvalItemSchema = z.object({
  masterProductId: idSchema,
  approvedQty: nonNegativeQty,
  notes: optionalText,
});

const receivedItemSchema = z.object({
  masterProductId: idSchema,
  receivedQty: nonNegativeQty,
});

const discrepancySchema = z.object({
  masterProductId: idSchema,
  expectedQty: nonNegativeQty,
  receivedQty: nonNegativeQty,
  discrepancyType: z.nativeEnum(DiscrepancyType),
  notes: requiredNotes,
  photoUrl: optionalText,
  photoFileName: optionalText,
});

export const getCentralStockQuerySchema = z.object({
  search: optionalText,
  category: optionalText,
  includeInactive: z.coerce.boolean().optional(),
});

export const createBranchStockRequestSchema = z.object({
  items: z.array(stockRequestItemSchema).min(1, 'Minimal satu item harus diminta'),
  notes: requiredNotes,
});

export const approveStockRequestSchema = z.object({
  items: z.array(approvalItemSchema).optional(),
  reviewNotes: optionalText,
});

export const approveBagStockRequestSchema = approveStockRequestSchema.extend({
  sourceBranchId: idSchema.optional(),
});

export const rejectStockRequestSchema = z.object({
  reviewNotes: requiredNotes,
});

export const shipStockSchema = z.object({
  notes: requiredNotes,
  shipmentPhotoUrl: optionalText,
  shipmentPhotoName: optionalText,
});

export const receiveShipmentSchema = z.object({
  receivedItems: z.array(receivedItemSchema).optional(),
  discrepancies: z.array(discrepancySchema).optional(),
  notes: requiredNotes,
  receiptFileUrl: optionalText,
  receiptFileName: optionalText,
  receiptFileSize: z.coerce.number().int().positive().optional(),
  receiptMimeType: optionalText,
});

export const createHomecareTeamSchema = z.object({
  teamCode: optionalText,
  name: z.string().trim().min(1, 'Nama tim wajib diisi'),
  branchId: idSchema,
  description: optionalText,
});

export const addHomecareTeamMemberSchema = z.object({
  userId: idSchema,
  role: z.nativeEnum(HomecareTeamMemberRole),
  notes: optionalText,
});

export const removeHomecareTeamMemberSchema = z.object({
  notes: optionalText,
});

export const createHomecareBagSchema = z.object({
  bagCode: optionalText,
  name: z.string().trim().min(1, 'Nama tas wajib diisi'),
  teamId: idSchema,
  branchId: idSchema.optional(),
  status: z.nativeEnum(HomecareBagStatus).optional(),
  notes: optionalText,
});

export const assignHomecareBagSchema = z.object({
  teamId: idSchema,
  notes: optionalText,
});

export const createBagStockRequestSchema = z.object({
  teamId: idSchema,
  bagId: idSchema,
  priority: z.string().trim().min(1).optional(),
  requestNotes: requiredNotes,
  items: z.array(stockRequestItemSchema).min(1, 'Minimal satu item harus diminta'),
}).merge(supportFileSchema);

export const rejectBagStockRequestSchema = rejectStockRequestSchema;
export const shipBagStockSchema = shipStockSchema;
export const receiveBagShipmentSchema = receiveShipmentSchema;

export const useBagStockSchema = z.object({
  bagId: idSchema,
  teamId: idSchema.optional(),
  treatmentSessionId: idSchema.optional(),
  status: z.nativeEnum(HomecareBagUsageStatus).optional(),
  usageDate: z.coerce.date().optional(),
  notes: requiredNotes,
  allowNegativeStock: z.boolean().optional(),
  items: z.array(z.object({
    masterProductId: idSchema,
    quantity: positiveQty,
    unit: optionalText,
    notes: optionalText,
  })).min(1, 'Minimal satu item harus dipakai'),
}).merge(supportFileSchema);

export const returnBagStockSchema = z.object({
  bagId: idSchema,
  teamId: idSchema.optional(),
  toBranchId: idSchema,
  returnedAt: z.coerce.date().optional(),
  notes: requiredNotes,
  allowNegativeStock: z.boolean().optional(),
  items: z.array(z.object({
    masterProductId: idSchema,
    quantity: positiveQty,
    isReusable: z.boolean().optional(),
    condition: optionalText,
    notes: optionalText,
  })).min(1, 'Minimal satu item harus diretur'),
}).merge(supportFileSchema);

export const createBagOpnameSchema = z.object({
  bagId: idSchema,
  teamId: idSchema.optional(),
  status: z.nativeEnum(HomecareBagOpnameStatus).optional(),
  checkedAt: z.coerce.date().optional(),
  notes: requiredNotes,
  createAdjustments: z.boolean().optional(),
  items: z.array(z.object({
    masterProductId: idSchema,
    physicalQty: nonNegativeQty,
    notes: optionalText,
  })).min(1, 'Minimal satu item harus dicek'),
}).merge(supportFileSchema);

export type CreateBranchStockRequestInput = z.infer<typeof createBranchStockRequestSchema>;
export type ApproveStockRequestInput = z.infer<typeof approveStockRequestSchema>;
export type ApproveBagStockRequestInput = z.infer<typeof approveBagStockRequestSchema>;
export type RejectStockRequestInput = z.infer<typeof rejectStockRequestSchema>;
export type ShipStockInput = z.infer<typeof shipStockSchema>;
export type ReceiveShipmentInput = z.infer<typeof receiveShipmentSchema>;
export type CreateHomecareTeamInput = z.infer<typeof createHomecareTeamSchema>;
export type AddHomecareTeamMemberInput = z.infer<typeof addHomecareTeamMemberSchema>;
export type RemoveHomecareTeamMemberInput = z.infer<typeof removeHomecareTeamMemberSchema>;
export type CreateHomecareBagInput = z.infer<typeof createHomecareBagSchema>;
export type AssignHomecareBagInput = z.infer<typeof assignHomecareBagSchema>;
export type CreateBagStockRequestInput = z.infer<typeof createBagStockRequestSchema>;
export type UseBagStockInput = z.infer<typeof useBagStockSchema>;
export type ReturnBagStockInput = z.infer<typeof returnBagStockSchema>;
export type CreateBagOpnameInput = z.infer<typeof createBagOpnameSchema>;
