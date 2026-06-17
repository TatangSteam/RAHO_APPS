import { z } from 'zod';

// Gender enum sesuai dengan Prisma schema
const GenderEnum = z.enum(['L', 'P']);

// Incentive type enum
const IncentiveTypeEnum = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);
const IdentityTypeEnum = z.enum(['NIK', 'PASSPORT', 'KITAS', 'VIP', 'SPECIAL', 'FOREIGN_AUTO', 'NO_NIK']);

const ifaSubstanceSchema = z.object({
  name: z.string().trim().min(1, 'Nama zat wajib diisi').max(80),
  amount: z.number().min(0, 'Jumlah zat tidak boleh negatif'),
  unit: z.string().trim().max(20).optional().default('ml'),
  keterangan: z.string().trim().max(500).optional(),
  isDefault: z.boolean().optional(),
});

// ============================================================
// THERAPY PLAN SCHEMAS
// ============================================================

// Single therapy plan schema (reusable)
export const therapyPlanDataSchema = z.object({
  keterangan: z.string().optional().default(''),
  ifa250: z.number().int().min(0).nullable().optional(),
  ifa500: z.number().int().min(0).nullable().optional(),
  hho: z.number().min(0).nullable().optional(),
  h2: z.number().min(0).nullable().optional(),
  no: z.number().min(0).nullable().optional(),
  gaso: z.number().min(0).nullable().optional(),
  o2: z.number().min(0).nullable().optional(),
  o3: z.number().min(0).nullable().optional(),
  edta: z.number().min(0).nullable().optional(),
  mb: z.number().min(0).nullable().optional(),
  h2s: z.number().min(0).nullable().optional(),
  kcl: z.number().min(0).nullable().optional(),
  jmlNb: z.number().min(0).nullable().optional(),
  ifaSubstances: z.array(ifaSubstanceSchema).nullable().optional(),
  ifaSubstanceTotalMl: z.number().min(0).nullable().optional(),
}).refine(
  (data) => {
    // At least one dose field must be filled
    return !!(
      data.ifa250 ||
      data.ifa500 ||
      data.hho ||
      data.h2 ||
      data.no ||
      data.gaso ||
      data.o2 ||
      data.o3 ||
      data.edta ||
      data.mb ||
      data.h2s ||
      data.kcl ||
      data.jmlNb
    );
  },
  { message: 'Minimal satu field dosis harus diisi' }
).refine(
  (data) => {
    // IFA 250 and IFA 500 are mutually exclusive
    return !(data.ifa250 && data.ifa500);
  },
  { message: 'IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan' }
);

// Bulk create therapy plans schema
export const bulkCreateTherapyPlansSchema = z.object({
  therapyPlans: z.array(therapyPlanDataSchema)
    .min(1, 'Minimal 1 therapy plan harus dibuat')
    .max(50, 'Maksimal 50 therapy plans dapat dibuat sekaligus'),
});

// Edit therapy plan schema (allows partial updates)
export const editTherapyPlanSchema = z.object({
  keterangan: z.string().optional(),
  ifa250: z.number().int().min(0).nullable().optional(),
  ifa500: z.number().int().min(0).nullable().optional(),
  hho: z.number().min(0).nullable().optional(),
  h2: z.number().min(0).nullable().optional(),
  no: z.number().min(0).nullable().optional(),
  gaso: z.number().min(0).nullable().optional(),
  o2: z.number().min(0).nullable().optional(),
  o3: z.number().min(0).nullable().optional(),
  edta: z.number().min(0).nullable().optional(),
  mb: z.number().min(0).nullable().optional(),
  h2s: z.number().min(0).nullable().optional(),
  kcl: z.number().min(0).nullable().optional(),
  jmlNb: z.number().min(0).nullable().optional(),
  ifaSubstances: z.array(ifaSubstanceSchema).nullable().optional(),
  ifaSubstanceTotalMl: z.number().min(0).nullable().optional(),
});

// ============================================================
// MEMBER SCHEMAS
// ============================================================

export const createMemberSchema = z.object({
  // Branch selection (for ADMIN_MANAGER)
  branchId: z.string().optional(),
  
  // Section A - Data Pribadi
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  identityType: IdentityTypeEnum.optional().default('NIK'),
  nik: z.string().optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(), // ISO date string
  gender: GenderEnum.optional(),
  religion: z.string().optional(), // Agama
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit'),
  email: z.string().email('Format email tidak valid').optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  maritalStatus: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  infoSource: z.string().optional(),
  postalCode: z.string().optional(),

  // Section B - Akun Member
  memberEmail: z.string().email('Format email tidak valid'),
  memberPassword: z.string().min(8, 'Password minimal 8 karakter'),
  referralCode: z.string().optional().transform((val) => {
    // Trim whitespace and convert empty string to undefined
    if (!val || val.trim() === '') return undefined;
    return val.trim();
  }),
  referralCodeId: z.string().optional().transform((val) => {
    // Handle empty string as undefined
    if (val === '' || val === null) return undefined;
    return val;
  }),
  isConsentToPhoto: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'string') {
        return val === 'true' || val === '1';
      }
      return val;
    })
    .default(false),
  
  // Section C - Incentive Settings (Optional)
  firstIncentiveType: z.string().optional().transform((val) => {
    if (!val || val === '' || val === 'undefined' || val === 'null') return undefined;
    return val as 'PERCENTAGE' | 'FIXED_AMOUNT';
  }),
  firstIncentiveValue: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '' || val === 'undefined' || val === 'null') return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? undefined : num;
  }),
  nextIncentiveType: z.string().optional().transform((val) => {
    if (!val || val === '' || val === 'undefined' || val === 'null') return undefined;
    return val as 'PERCENTAGE' | 'FIXED_AMOUNT';
  }),
  nextIncentiveValue: z.union([z.string(), z.number()]).optional().transform((val) => {
    if (val === undefined || val === null || val === '' || val === 'undefined' || val === 'null') return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? undefined : num;
  }),
}).passthrough(); // Allow additional fields (like psp, photo) to pass through without validation

export const updateMemberSchema = z.object({
  fullName: z.string().min(3).optional(),
  nik: z.string().optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(),
  gender: GenderEnum.optional(),
  religion: z.string().optional(), // Agama
  phone: z.string().min(10).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  maritalStatus: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  infoSource: z.string().optional(),
  postalCode: z.string().optional(),
  isActive: z.boolean().optional(),
  
  // Incentive fields
  firstIncentiveType: IncentiveTypeEnum.optional(),
  firstIncentiveValue: z.number().min(0).optional(),
  nextIncentiveType: IncentiveTypeEnum.optional(),
  nextIncentiveValue: z.number().min(0).optional(),
});

export const grantAccessSchema = z.object({
  memberNo: z.string().min(1, 'Nomor member wajib diisi'),
});

export const sendNotificationSchema = z.object({
  title: z.string().min(1, 'Judul wajib diisi'),
  message: z.string().min(1, 'Pesan wajib diisi'),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type GrantAccessInput = z.infer<typeof grantAccessSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
