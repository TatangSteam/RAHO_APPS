import { z } from 'zod';
import { SessionType, VitalType, VitalTiming, BottleType, EMRNoteType, DiagnosisCategory, MaterialDeviationReason } from '@prisma/client';

// BoosterType enum values (not exported from Prisma because not used as field type in any model)
// These values match the BoosterType enum in schema.prisma
const BoosterType = {
  NO: 'NO',
  GT: 'GT',
  MB: 'MB',
  KCL: 'KCL',
  H2S: 'H2S',
  HK: 'HK',
  O3: 'O3',
  HHO: 'HHO',
  NO2: 'NO2',
} as const;

const ifaSubstanceSchema = z.object({
  name: z.string().trim().min(1, 'Nama zat wajib diisi').max(80),
  amount: z.number().min(0, 'Jumlah zat tidak boleh negatif'),
  unit: z.string().trim().max(20).optional().default('ml'),
  keterangan: z.string().trim().max(500).optional(),
  isDefault: z.boolean().optional(),
});

// ============================================================
// CREATE SESSION
// ============================================================

export const createSessionSchema = z.object({
  branchId: z.string().cuid().optional(),
  memberId: z.string().cuid(),
  memberPackageId: z.string().cuid().nullable().optional(),
  boosterPackageId: z.string().cuid().optional(),
  therapyPlanId: z.string().cuid().optional(), // Optional: auto-selected from active set by session number
  adminLayananId: z.string().cuid(),
  doctorId: z.string().cuid().optional(), // Optional - auto-filled if user is DOCTOR
  nurseId: z.string().cuid().optional(), // Optional - auto-filled if user is NURSE
  additionalDoctorIds: z.array(z.string().cuid()).optional().default([]), // Additional doctors
  additionalNurseIds: z.array(z.string().cuid()).optional().default([]), // Additional nurses
  treatmentDate: z.string().datetime(),
  pelaksanaan: z.nativeEnum(SessionType),
  // Manual session numbering (optional - if not provided, auto-calculate)
  manualInfusKe: z.number().int().positive().optional(), // Global session number
  manualBranchInfusKe: z.number().int().positive().optional(), // Branch-specific session number
  useManualNumbering: z.boolean().optional().default(false),
}).refine(
  (data) => !!data.memberPackageId || !data.boosterPackageId,
  { message: 'Paket Booster tidak dapat digunakan pada sesi tanpa paket' }
).refine(
  (data) => {
    // At least doctorId or nurseId must be provided (the other will be auto-filled)
    return data.doctorId || data.nurseId;
  },
  { message: 'Minimal doctorId atau nurseId harus diisi' }
).refine(
  (data) => {
    // If manual numbering is enabled, both manualInfusKe and manualBranchInfusKe must be provided
    if (data.useManualNumbering && (!data.manualInfusKe || !data.manualBranchInfusKe)) {
      return false;
    }
    return true;
  },
  { message: 'Nomor sesi global dan cabang harus diisi jika mode manual diaktifkan' }
);

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// ============================================================
// UPDATE SESSION DETAILS
// ============================================================

export const updateSessionDetailsSchema = z.object({
  memberPackageId: z.string().cuid().optional(),
  treatmentDate: z.string().datetime().optional(),
  pelaksanaan: z.nativeEnum(SessionType).optional(),
  adminLayananId: z.string().cuid().optional(),
  doctorId: z.string().cuid().optional(),
  nurseId: z.string().cuid().optional(),
  additionalDoctorIds: z.array(z.string().cuid()).optional(),
  additionalNurseIds: z.array(z.string().cuid()).optional(),
  useBooster: z.boolean().optional(),
  boosterPackageId: z.string().cuid().nullable().optional(),
  infusKe: z.number().int().positive().optional(),
  branchInfusKe: z.number().int().positive().optional(),
  shiftFollowingSessions: z.boolean().optional().default(false),
}).refine(
  (data) => data.useBooster !== true || !!data.boosterPackageId,
  { message: 'Paket booster wajib dipilih jika menggunakan booster' }
);

export type UpdateSessionDetailsInput = z.infer<typeof updateSessionDetailsSchema>;

// ============================================================
// STEP 1: DIAGNOSIS
// ============================================================

export const createDiagnosisSchema = z.object({
  sourceDiagnosisId: z.string().cuid().optional(),
  doktorPemeriksa: z.string().cuid(),
  diagnosa: z.string().min(3, 'Diagnosa minimal 3 karakter'),
  kategoriDiagnosa: z.nativeEnum(DiagnosisCategory).optional().nullable(),
  kategoriDiagnosaList: z.array(z.nativeEnum(DiagnosisCategory)).optional().nullable(),
  // Allow empty strings and convert to undefined for optional string fields
  icdPrimer: z.string().optional().nullable().transform(val => val || undefined),
  icdSekunder: z.string().optional().nullable().transform(val => val || undefined),
  icdTersier: z.string().optional().nullable().transform(val => val || undefined),
  keluhanRiwayatSekarang: z.string().optional().nullable().transform(val => val || undefined),
  riwayatPenyakitTerdahulu: z.string().optional().nullable().transform(val => val || undefined),
  riwayatSosialKebiasaan: z.string().optional().nullable().transform(val => val || undefined),
  riwayatPengobatan: z.string().optional().nullable().transform(val => val || undefined),
  pemeriksaanFisik: z.string().optional().nullable().transform(val => val || undefined),
  pemeriksaanTambahan: z.record(z.string()).optional().nullable(),
});

export type CreateDiagnosisInput = z.infer<typeof createDiagnosisSchema>;

// Update diagnosis schema (for editing existing diagnosis)
export const updateDiagnosisSchema = z.object({
  diagnosa: z.string().min(3, 'Diagnosa minimal 3 karakter').optional(),
  kategoriDiagnosa: z.nativeEnum(DiagnosisCategory).optional().nullable(),
  kategoriDiagnosaList: z.array(z.nativeEnum(DiagnosisCategory)).optional().nullable(),
  icdPrimer: z.string().optional().nullable().transform(val => val || undefined),
  icdSekunder: z.string().optional().nullable().transform(val => val || undefined),
  icdTersier: z.string().optional().nullable().transform(val => val || undefined),
  keluhanRiwayatSekarang: z.string().optional().nullable().transform(val => val || undefined),
  riwayatPenyakitTerdahulu: z.string().optional().nullable().transform(val => val || undefined),
  riwayatSosialKebiasaan: z.string().optional().nullable().transform(val => val || undefined),
  riwayatPengobatan: z.string().optional().nullable().transform(val => val || undefined),
  pemeriksaanFisik: z.string().optional().nullable().transform(val => val || undefined),
  pemeriksaanTambahan: z.record(z.any()).optional().nullable().transform(val => val || undefined),
});

export type UpdateDiagnosisInput = z.infer<typeof updateDiagnosisSchema>;

// ============================================================
// STEP 2: THERAPY PLAN
// ============================================================

export const createTherapyPlanSchema = z.object({
  keterangan: z.string().optional(),
  ifa250: z.number().optional(), // IFA + NO 2,5ml (satuan: Botol)
  ifa500: z.number().optional(), // IFA 500ml (satuan: Botol)
  hho: z.number().optional(),
  hhoKonsentrat: z.number().optional(),
  h2: z.number().optional(),
  no: z.number().optional(),
  gaso: z.number().optional(),
  o2: z.number().optional(),
  o3: z.number().optional(),
  edta: z.number().optional(),
  mb: z.number().optional(),
  h2s: z.number().optional(),
  kcl: z.number().optional(),
  jmlNb: z.number().optional(),
  ifaSubstances: z.array(ifaSubstanceSchema).optional(),
  ifaSubstanceTotalMl: z.number().min(0).optional(),
}).refine(
  (data) => {
    // IFA is mutually exclusive - only one can be selected
    const hasIfa250 = data.ifa250 !== undefined && data.ifa250 > 0;
    const hasIfa500 = data.ifa500 !== undefined && data.ifa500 > 0;
    
    // At least one IFA must be selected
    if (!hasIfa250 && !hasIfa500) {
      return false;
    }
    
    // Cannot have both
    if (hasIfa250 && hasIfa500) {
      return false;
    }
    
    return true;
  },
  { message: 'Pilih salah satu tipe IFA (250ml atau 500ml), tidak boleh keduanya' }
);

export type CreateTherapyPlanInput = z.infer<typeof createTherapyPlanSchema>;

// ============================================================
// STEP 3 & 8: VITAL SIGNS
// ============================================================

export const createVitalSignSchema = z.object({
  pencatatan: z.nativeEnum(VitalType),
  waktuCatat: z.nativeEnum(VitalTiming),
  value: z.coerce.number().refine(Number.isFinite, {
    message: 'Nilai tanda vital harus berupa angka',
  }),
  unit: z.string().optional(),
  recordedBy: z.string().cuid(),
});

export type CreateVitalSignInput = z.infer<typeof createVitalSignSchema>;

// ============================================================
// STEP 4: BOOSTER TYPE
// ============================================================

export const updateBoosterTypeSchema = z.object({
  boosterType: z.nativeEnum(BoosterType),
});

export type UpdateBoosterTypeInput = z.infer<typeof updateBoosterTypeSchema>;

export const updateSessionBoosterPackageSchema = z.object({
  useBooster: z.boolean(),
  boosterPackageId: z.string().cuid().nullable().optional(),
}).refine(
  (data) => !data.useBooster || !!data.boosterPackageId,
  { message: 'Paket booster wajib dipilih jika menggunakan booster' }
);

export type UpdateSessionBoosterPackageInput = z.infer<typeof updateSessionBoosterPackageSchema>;

// ============================================================
// STEP 5: INFUSION EXECUTION
// ============================================================

export const createInfusionSchema = z.object({
  ifa250: z.number().optional(), // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500: z.number().optional(), // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho: z.number().optional(),
  hhoKonsentrat: z.number().optional(),
  h2: z.number().optional(),
  no: z.number().optional(),
  gaso: z.number().optional(),
  o2: z.number().optional(),
  o3: z.number().optional(),
  edta: z.number().optional(),
  mb: z.number().optional(),
  h2s: z.number().optional(),
  kcl: z.number().optional(),
  jmlNb: z.number().optional(),
  deviationNotes: z.string().optional(),
  bottleType: z.nativeEnum(BottleType).optional(),
  jenisCairan: z.string().optional(),
  volumeCarrier: z.number().optional(),
  jumlahJarum: z.number().int().optional(),
  tanggalProduksi: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().datetime().optional()
  ),
}).refine(
  (data) => {
    // IFA is mutually exclusive - only one can be selected
    const hasIfa250 = data.ifa250 !== undefined && data.ifa250 > 0;
    const hasIfa500 = data.ifa500 !== undefined && data.ifa500 > 0;
    
    // At least one IFA must be selected
    if (!hasIfa250 && !hasIfa500) {
      return false;
    }
    
    // Cannot have both
    if (hasIfa250 && hasIfa500) {
      return false;
    }
    
    return true;
  },
  { message: 'Pilih salah satu tipe IFA (250ml atau 500ml), tidak boleh keduanya' }
);

export type CreateInfusionInput = z.infer<typeof createInfusionSchema>;

// ============================================================
// STEP 6: MATERIAL USAGE
// ============================================================

export const createMaterialUsageSchema = z.object({
  inventoryItemId: z.string().cuid(),
  quantity: z.union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d+(?:\.\d{1,4})?$/.test(value) && Number(value) > 0, {
      message: 'Quantity harus lebih besar dari nol dan maksimal 4 angka desimal',
    }),
  unit: z.string().trim().min(1).max(40).optional(),
  recordedBy: z.string().cuid().optional(),
  deviationReason: z.nativeEnum(MaterialDeviationReason).optional(),
  deviationNotes: z.string().trim().max(2000).optional(),
});

export type CreateMaterialUsageInput = z.infer<typeof createMaterialUsageSchema>;

// ============================================================
// STEP 9: EMR NOTE
// ============================================================

export const createEMRNoteSchema = z.object({
  noteType: z.nativeEnum(EMRNoteType),
  content: z.string().max(5000, 'Maksimal 5000 karakter'),
  writtenBy: z.string().cuid(),
});

export type CreateEMRNoteInput = z.infer<typeof createEMRNoteSchema>;

// ============================================================
// STEP 10: DOCTOR EVALUATION
// ============================================================

export const createEvaluationSchema = z.object({
  keluhan: z.string().nullable().optional(),
  rekomendasi: z.string().nullable().optional(),
  subjective: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  assessment: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  generalNotes: z.string().nullable().optional(),
  writtenBy: z.string().cuid(),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;

export const cancelSessionCompletionSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  reason: z.string().trim().min(5).max(1000),
});

export type CancelSessionCompletionInput = z.infer<typeof cancelSessionCompletionSchema>;
