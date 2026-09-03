import { z } from 'zod';
import { CampaignVoucherStatus } from '@prisma/client';

const nikSchema = z.string().trim().regex(/^\d{16}$/, 'NIK harus tepat 16 digit.');
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD.');

function isValidDateOnly(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function jakartaToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

const birthDateSchema = dateSchema
  .refine(isValidDateOnly, 'Tanggal lahir tidak valid.')
  .refine((value) => value <= jakartaToday(), 'Tanggal lahir tidak boleh di masa depan.');

export const issueVoucherSchema = z.object({
  campaignId: z.string().min(1),
  code: z.string().trim().min(6).max(64).optional(),
  recipientName: z.string().trim().min(2).max(150),
  nik: nikSchema,
  dateOfBirth: birthDateSchema,
  allowedLocationId: z.string().min(1).nullable().optional(),
  claimDeadline: dateSchema.nullable().optional(),
});

export const claimVoucherSchema = z.object({
  code: z.string().trim().min(6).max(64),
  recipientName: z.string().trim().min(2).max(150),
  nik: nikSchema,
  dateOfBirth: birthDateSchema,
  locationId: z.string().min(1),
  requestId: z.string().uuid(),
});

export const createVoucherOperatorSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,50}$/, 'Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau strip.'),
  password: z.string().min(8).max(100),
  locationIds: z.array(z.string().min(1)).min(1),
  validUntil: dateSchema.nullable().optional(),
});

export const updateVoucherOperatorSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
  locationIds: z.array(z.string().min(1)).min(1).optional(),
  validUntil: dateSchema.nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Minimal satu perubahan wajib diisi.');

export const exportVoucherCodesSchema = z.object({
  campaignId: z.string().min(1).optional(),
  status: z.nativeEnum(CampaignVoucherStatus).optional(),
});

export const generateVoucherCodesSchema = z.object({
  count: z.number().int().min(1).max(200).optional(),
});

export const listVoucherClaimsSchema = z.object({
  search: z.string().trim().max(100).optional(),
  campaignId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type IssueVoucherInput = z.infer<typeof issueVoucherSchema>;
export type ClaimVoucherInput = z.infer<typeof claimVoucherSchema>;
export type CreateVoucherOperatorInput = z.infer<typeof createVoucherOperatorSchema>;
export type UpdateVoucherOperatorInput = z.infer<typeof updateVoucherOperatorSchema>;
export type ExportVoucherCodesInput = z.infer<typeof exportVoucherCodesSchema>;
export type GenerateVoucherCodesInput = z.infer<typeof generateVoucherCodesSchema>;
export type ListVoucherClaimsInput = z.infer<typeof listVoucherClaimsSchema>;
