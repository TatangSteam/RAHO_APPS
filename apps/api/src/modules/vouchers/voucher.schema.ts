import { z } from 'zod';
import {
  CampaignVoucherStatus,
  VoucherCampaignStatus,
  VoucherCodeMode,
  VoucherLocationPolicy,
} from '@prisma/client';

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

const campaignDateSchema = dateSchema.refine(isValidDateOnly, 'Tanggal campaign tidak valid.');

export const createVoucherCampaignSchema = z.object({
  code: z.string().trim().min(3).max(40)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value), 'Kode hanya boleh berisi huruf, angka, dan strip.'),
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(3).max(1_000),
  quota: z.number().int().min(1).max(100_000),
  basicSessions: z.number().int().min(0).max(10_000),
  boosterSessions: z.number().int().min(0).max(10_000),
  boosterType: z.string().trim().max(100).nullable().optional(),
  unitPrice: z.number().finite().min(0).max(1_000_000_000_000).nullable().optional(),
  totalPrice: z.number().finite().min(0).max(1_000_000_000_000).nullable().optional(),
  issueStartAt: campaignDateSchema.nullable().optional(),
  issueEndAt: campaignDateSchema.nullable().optional(),
  claimStartAt: campaignDateSchema.nullable().optional(),
  claimEndAt: campaignDateSchema.nullable().optional(),
  benefitValidityDays: z.number().int().min(1).max(3_650).nullable().optional(),
  termsSnapshot: z.string().trim().max(5_000).nullable().optional(),
  locationPolicy: z.nativeEnum(VoucherLocationPolicy).default(VoucherLocationPolicy.ALL_ACTIVE),
  codeMode: z.nativeEnum(VoucherCodeMode).default(VoucherCodeMode.AUTO),
  status: z.nativeEnum(VoucherCampaignStatus).default(VoucherCampaignStatus.DRAFT),
}).superRefine((value, context) => {
  if (value.basicSessions === 0 && value.boosterSessions === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['basicSessions'], message: 'Minimal satu manfaat BASIC atau BOOSTER wajib diisi.' });
  }
  if (value.issueStartAt && value.issueEndAt && value.issueEndAt < value.issueStartAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['issueEndAt'], message: 'Tanggal akhir penerbitan tidak boleh sebelum tanggal mulai.' });
  }
  if (value.claimStartAt && value.claimEndAt && value.claimEndAt < value.claimStartAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['claimEndAt'], message: 'Tanggal akhir klaim tidak boleh sebelum tanggal mulai.' });
  }
});

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

export const createVoucherLocationSchema = z.object({
  displayName: z.string().trim().min(2).max(150),
  locationGroup: z.enum(['RAHO_REGULER', 'RAHO_PREMIER', 'PARTNER']),
  city: z.string().trim().min(2).max(100),
  partnerName: z.string().trim().max(150).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  mapsUrl: z.string().trim().url('Tautan Google Maps tidak valid.').max(1000).nullable().optional(),
});

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
export type CreateVoucherCampaignInput = z.infer<typeof createVoucherCampaignSchema>;
export type ClaimVoucherInput = z.infer<typeof claimVoucherSchema>;
export type CreateVoucherOperatorInput = z.infer<typeof createVoucherOperatorSchema>;
export type UpdateVoucherOperatorInput = z.infer<typeof updateVoucherOperatorSchema>;
export type CreateVoucherLocationInput = z.infer<typeof createVoucherLocationSchema>;
export type ExportVoucherCodesInput = z.infer<typeof exportVoucherCodesSchema>;
export type GenerateVoucherCodesInput = z.infer<typeof generateVoucherCodesSchema>;
export type ListVoucherClaimsInput = z.infer<typeof listVoucherClaimsSchema>;
