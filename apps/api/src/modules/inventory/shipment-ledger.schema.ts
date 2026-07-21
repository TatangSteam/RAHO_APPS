import { DiscrepancyType, Prisma } from '@prisma/client';
import { z } from 'zod';

const positiveQuantity = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0, {
    message: 'Quantity harus lebih besar dari nol dengan maksimal 4 angka desimal',
  });

const nonNegativeQuantity = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value), {
    message: 'Quantity harus non-negatif dengan maksimal 4 angka desimal',
  });

const booleanField = z.preprocess((value) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0' || value === '') return false;
  return value;
}, z.boolean());

export const dispatchShipmentSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  notes: z.string().trim().max(1000).optional(),
  shipmentPhotoUrl: z.string().trim().max(1000).optional(),
  shipmentPhotoName: z.string().trim().max(255).optional(),
  occurredAt: z.coerce.date().default(() => new Date()),
  items: z.array(z.object({
    masterProductId: z.string().trim().min(1),
    sentQty: positiveQuantity,
  })).min(1).max(100).optional(),
}).superRefine((value, context) => {
  const ids = value.items?.map((item) => item.masterProductId) ?? [];
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Item dispatch tidak boleh duplikat' });
  }
});

export const receiveShipmentLedgerSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  isFinal: booleanField.default(false),
  notes: z.string().trim().max(1000).optional(),
  occurredAt: z.coerce.date().default(() => new Date()),
  receivedItems: z.array(z.object({
    masterProductId: z.string().trim().min(1),
    receivedQty: nonNegativeQuantity,
    quarantineQty: nonNegativeQuantity.default('0'),
    stockLocationId: z.string().trim().min(1).optional(),
  })).max(100).default([]),
  discrepancies: z.array(z.object({
    masterProductId: z.string().trim().min(1),
    discrepancyType: z.nativeEnum(DiscrepancyType),
    notes: z.string().trim().min(3).max(1000),
    photoUrl: z.string().trim().max(1000).optional(),
    photoFileName: z.string().trim().max(255).optional(),
  })).max(100).default([]),
}).superRefine((value, context) => {
  const ids = value.receivedItems.map((item) => item.masterProductId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['receivedItems'], message: 'Product receipt tidak boleh duplikat' });
  }
  value.receivedItems.forEach((item, index) => {
    if (new Prisma.Decimal(item.quarantineQty).greaterThan(item.receivedQty)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['receivedItems', index, 'quarantineQty'], message: 'Quarantine tidak boleh melebihi received quantity' });
    }
  });
  if (!value.isFinal && !value.receivedItems.some((item) => Number(item.receivedQty) > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['receivedItems'], message: 'Minimal satu received quantity harus lebih besar dari nol' });
  }
});

export type DispatchShipmentInput = z.infer<typeof dispatchShipmentSchema>;
export type ReceiveShipmentLedgerInput = z.infer<typeof receiveShipmentLedgerSchema>;

export type ShipmentReceiptEvidence = {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
};
