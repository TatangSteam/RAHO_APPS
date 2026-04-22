import { z } from 'zod';
import { SessionType, BoosterType, VitalType, VitalTiming, BottleType, EMRNoteType, DiagnosisCategory } from '@prisma/client';

// ============================================================
// CREATE SESSION
// ============================================================

export const createSessionSchema = z.object({
  memberId: z.string().cuid(),
  memberPackageId: z.string().cuid(),
  boosterPackageId: z.string().cuid().optional(),
  therapyPlanId: z.string().cuid(), // NEW: Required therapy plan
  adminLayananId: z.string().cuid(),
  doctorId: z.string().cuid(),
  nurseId: z.string().cuid(),
  treatmentDate: z.string().datetime(),
  pelaksanaan: z.nativeEnum(SessionType),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// ============================================================
// STEP 1: DIAGNOSIS
// ============================================================

export const createDiagnosisSchema = z.object({
  doktorPemeriksa: z.string().cuid(),
  diagnosa: z.string().min(3, 'Diagnosa minimal 3 karakter'),
  kategoriDiagnosa: z.nativeEnum(DiagnosisCategory).optional(),
  icdPrimer: z.string().optional(),
  icdSekunder: z.string().optional(),
  icdTersier: z.string().optional(),
  keluhanRiwayatSekarang: z.string().optional(),
  riwayatPenyakitTerdahulu: z.string().optional(),
  riwayatSosialKebiasaan: z.string().optional(),
  riwayatPengobatan: z.string().optional(),
  pemeriksaanFisik: z.string().optional(),
  pemeriksaanTambahan: z.record(z.string()).optional(),
});

export type CreateDiagnosisInput = z.infer<typeof createDiagnosisSchema>;

// ============================================================
// STEP 2: THERAPY PLAN
// ============================================================

export const createTherapyPlanSchema = z.object({
  keterangan: z.string().optional(),
  ifa: z.number().optional(),
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
    // At least one dose field must be filled
    return Object.values(data).some((val) => typeof val === 'number' && val > 0);
  },
  { message: 'Minimal satu field dosis harus diisi' }
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
  ifa: z.number().optional(),
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
});

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
