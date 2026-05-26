import { z } from 'zod';
import { SessionType, VitalType, VitalTiming, BottleType, EMRNoteType, DiagnosisCategory } from '@prisma/client';

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

// ============================================================
// CREATE SESSION
// ============================================================

export const createSessionSchema = z.object({
  memberId: z.string().cuid(),
  memberPackageId: z.string().cuid(),
  boosterPackageId: z.string().cuid().optional(),
  therapyPlanId: z.string().cuid(), // NEW: Required therapy plan
  adminLayananId: z.string().cuid(),
  doctorId: z.string().cuid().optional(), // Optional - auto-filled if user is DOCTOR
  nurseId: z.string().cuid().optional(), // Optional - auto-filled if user is NURSE
  additionalDoctorIds: z.array(z.string().cuid()).optional().default([]), // Additional doctors
  additionalNurseIds: z.array(z.string().cuid()).optional().default([]), // Additional nurses
  treatmentDate: z.string().datetime(),
  pelaksanaan: z.nativeEnum(SessionType),
}).refine(
  (data) => {
    // At least doctorId or nurseId must be provided (the other will be auto-filled)
    return data.doctorId || data.nurseId;
  },
  { message: 'Minimal doctorId atau nurseId harus diisi' }
);

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// ============================================================
// STEP 1: DIAGNOSIS
// ============================================================

export const createDiagnosisSchema = z.object({
  doktorPemeriksa: z.string().cuid(),
  diagnosa: z.string().min(3, 'Diagnosa minimal 3 karakter'),
  kategoriDiagnosa: z.nativeEnum(DiagnosisCategory).optional().nullable(),
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

// ============================================================
// STEP 2: THERAPY PLAN
// ============================================================

export const createTherapyPlanSchema = z.object({
  keterangan: z.string().optional(),
  ifa250: z.number().optional(), // IFA + NO 2,5ml (satuan: Botol)
  ifa500: z.number().optional(), // IFA 500ml (satuan: Botol)
  hho: z.number().optional(),
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
  value: z.number(),
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

// ============================================================
// STEP 5: INFUSION EXECUTION
// ============================================================

export const createInfusionSchema = z.object({
  ifa250: z.number().optional(), // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500: z.number().optional(), // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho: z.number().optional(),
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
  quantity: z.number().positive(),
  unit: z.string(),
  recordedBy: z.string().cuid(),
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
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  generalNotes: z.string().optional(),
  writtenBy: z.string().cuid(),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
