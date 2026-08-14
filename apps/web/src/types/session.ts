import type { MaterialDeviationReason } from '@/lib/materialsApi';

// ============================================================
// SESSION TYPES
// ============================================================

export type SessionType = 'ON_SITE' | 'HOME_CARE';
export type BoosterType = 'NO' | 'GT' | 'MB' | 'KCL' | 'H2S' | 'HK' | 'O3' | 'HHO' | 'NO2' | 'GASSOTRAUS';
export type VitalType = 'SISTOL' | 'DIASTOL' | 'HR' | 'SATURASI' | 'PI';
export type VitalTiming = 'SEBELUM' | 'SESUDAH';
export type BottleType = 'IFA' | 'EDTA';
export type DiagnosisCategory = 
  | 'HIPERTENSI'
  | 'NEUROLOGI'
  | 'DIABETES'
  | 'KARDIOVASKULAR'
  | 'ORTOPEDI'
  | 'IMUNOLOGI'
  | 'HEMATOLOGI'
  | 'STROKE'
  | 'JANTUNG_KARDIOVASKULAR'
  | 'SINDROM_METABOLIK'
  | 'KANKER'
  | 'DEGENERATIF'
  | 'AUTO_IMUN'
  | 'ONKOLOGI'
  | 'LAINNYA';

export interface TherapyPlanSubstance {
  name: string;
  amount: number;
  unit: string;
  keterangan?: string;
  isDefault?: boolean;
}

// ============================================================
// CREATE SESSION
// ============================================================

export interface CreateSessionInput {
  branchId?: string;
  memberId: string;
  memberPackageId?: string | null;
  boosterPackageId?: string;
  therapyPlanId?: string; // Optional: backend can auto-select from active set by session number
  adminLayananId: string;
  doctorId?: string; // Optional - auto-filled if user is DOCTOR
  nurseId?: string; // Optional - auto-filled if user is NURSE
  additionalDoctorIds?: string[];
  additionalNurseIds?: string[];
  treatmentDate: string;
  pelaksanaan: SessionType;
  // Manual session numbering (optional)
  useManualNumbering?: boolean;
  manualInfusKe?: number; // Global session number
  manualBranchInfusKe?: number; // Branch-specific session number
}

export interface CreateSessionResponse {
  sessionId: string;
  sessionCode: string;
  encounterId: string;
  encounterCode: string;
  infusKe: number;
  branchInfusKe: number;
  message: string;
}

export interface SuggestedSessionNumbers {
  globalInfusKe: number;
  branchInfusKe: number;
}

// ============================================================
// SESSION DETAIL
// ============================================================

export interface SessionMember {
  memberId: string;
  memberNo: string;
  fullName: string;
}

export interface SessionStaff {
  userId: string;
  fullName: string;
  staffCode?: string | null;
}

export interface SessionDoctorAssignment {
  id: string;
  isPrimary: boolean;
  doctor: SessionStaff;
}

export interface SessionNurseAssignment {
  id: string;
  isPrimary: boolean;
  nurse: SessionStaff;
}

export interface SessionBoosterPackage {
  packageId: string;
  packageCode: string;
  boosterType: BoosterType | null;
}

export interface SessionMemberPackage {
  packageId: string;
  packageCode: string;
  packageType: 'BASIC' | 'BOOSTER';
}

export interface Session {
  sessionId: string;
  sessionCode: string;
  encounterId: string;
  encounterCode: string;
  infusKe: number; // Total therapy count (global across all branches)
  branchInfusKe?: number; // Therapy count at current branch
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  branchSessionCounts?: Array<{
    branchId: string;
    branchName: string;
    branchCode: string;
    sessionCount: number;
  }>; // Session counts per branch (for multi-branch display)
  pelaksanaan: SessionType;
  treatmentDate: string;
  isCompleted: boolean;
  completionStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string | null;
  recognizedRevenue?: string;
  materialCost?: string;
  grossProfit?: string;
  completionJournalEntryId?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancellationJournalEntryId?: string | null;
  member: SessionMember;
  memberPackage: SessionMemberPackage | null;
  adminLayanan?: SessionStaff | null;
  doctor?: SessionStaff | null;
  doctorEvaluationCompleted?: boolean;
  nurse?: SessionStaff | null;
  sessionDoctors?: SessionDoctorAssignment[];
  sessionNurses?: SessionNurseAssignment[];
  boosterPackage: SessionBoosterPackage | null;
}

export interface Diagnosis {
  id: string;
  diagnosisCode: string;
  sourceDiagnosisId?: string | null;
  encounterId: string;
  doktorPemeriksa: string;
  diagnosa: string;
  kategoriDiagnosa: DiagnosisCategory | null;
  kategoriDiagnosaList?: DiagnosisCategory[] | null;
  icdPrimer: string | null;
  icdSekunder: string | null;
  icdTersier: string | null;
  keluhanRiwayatSekarang: string | null;
  riwayatPenyakitTerdahulu: string | null;
  riwayatSosialKebiasaan: string | null;
  riwayatPengobatan: string | null;
  pemeriksaanFisik: string | null;
  pemeriksaanTambahan: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TherapyPlan {
  id: string;
  planCode: string;
  planNumber?: number | null;
  therapyPlanSetId?: string | null;
  setName?: string | null;
  setVersion?: number | null;
  setStatus?: string | null;
  treatmentSessionId: string;
  keterangan: string | null;
  ifa250: number | null; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500: number | null; // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho: number | null;
  hhoKonsentrat: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
  ifaSubstances: TherapyPlanSubstance[] | null;
  ifaSubstanceTotalMl: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface VitalSign {
  id: string;
  treatmentSessionId: string;
  pencatatan: VitalType;
  waktuCatat: VitalTiming;
  value: number;
  unit: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InfusionExecution {
  id: string;
  treatmentSessionId: string;
  ifa250: number | null; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500: number | null; // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho: number | null;
  hhoKonsentrat: number | null;
  h2: number | null;
  no: number | null;
  gaso: number | null;
  o2: number | null;
  o3: number | null;
  edta: number | null;
  mb: number | null;
  h2s: number | null;
  kcl: number | null;
  jmlNb: number | null;
  deviationNotes: string | null;
  bottleType: BottleType | null;
  jenisCairan: string | null;
  volumeCarrier: number | null;
  jumlahJarum: number | null;
  tanggalProduksi: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StepCompletion {
  step1_diagnosis: boolean;
  step2_therapyPlan: boolean;
  step3_vitalBefore: boolean;
  step4_infusion: boolean;
  step5_materials: boolean;
  step6_photo: boolean;
  step7_vitalAfter: boolean;
  step8_evaluation: boolean;
}

export interface SessionDetail {
  session: Session;
  memberId: string;
  diagnosis: Diagnosis | null;
  therapyPlan: TherapyPlan | null;
  vitalSigns: VitalSign[];
  infusion: InfusionExecution | null;
  materials: SessionMaterial[];
  photo: {
    id: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
    createdAt: string;
  } | null;
  evaluation: {
    id: string;
    keluhan: string | null;
    rekomendasi: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    generalNotes: string | null;
    writtenBy: string;
    createdAt: string;
  } | null;
  steps: StepCompletion;
}

export interface SessionMaterial {
  id: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  recordedBy: string;
  createdAt: string;
  recommendedQuantity?: number | null;
  deviationReason?: MaterialDeviationReason | null;
  deviationNotes?: string | null;
  status?: 'DRAFT' | 'CONSUMED' | 'REVERSED';
  actualUnitCost?: number | null;
  totalActualCost?: number | null;
  inventoryItem: {
    id: string;
    masterProduct: { id: string; name: string; code: string };
  };
}

// ============================================================
// STEP 1: DIAGNOSIS
// ============================================================

export interface CreateDiagnosisInput {
  sourceDiagnosisId?: string;
  doktorPemeriksa: string;
  diagnosa: string;
  kategoriDiagnosa?: DiagnosisCategory;
  kategoriDiagnosaList?: DiagnosisCategory[];
  icdPrimer?: string;
  icdSekunder?: string;
  icdTersier?: string;
  keluhanRiwayatSekarang?: string;
  riwayatPenyakitTerdahulu?: string;
  riwayatSosialKebiasaan?: string;
  riwayatPengobatan?: string;
  pemeriksaanFisik?: string;
  pemeriksaanTambahan?: Record<string, string>;
}

// ============================================================
// STEP 2: THERAPY PLAN
// ============================================================

export interface CreateTherapyPlanInput {
  keterangan?: string;
  ifa250?: number; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500?: number; // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho?: number;
  hhoKonsentrat?: number;
  h2?: number;
  no?: number;
  gaso?: number;
  o2?: number;
  o3?: number;
  edta?: number;
  mb?: number;
  h2s?: number;
  kcl?: number;
  jmlNb?: number;
  ifaSubstances?: TherapyPlanSubstance[];
  ifaSubstanceTotalMl?: number;
}

// ============================================================
// STEP 3 & 8: VITAL SIGNS
// ============================================================

export interface CreateVitalSignInput {
  pencatatan: VitalType;
  waktuCatat: VitalTiming;
  value: number;
  unit?: string;
  recordedBy: string;
}

// ============================================================
// STEP 4: BOOSTER TYPE
// ============================================================

export interface UpdateBoosterTypeInput {
  boosterType: BoosterType;
}

export interface UpdateSessionBoosterPackageInput {
  useBooster: boolean;
  boosterPackageId?: string | null;
}

export interface UpdateSessionDetailsInput {
  memberPackageId?: string;
  treatmentDate?: string;
  pelaksanaan?: SessionType;
  adminLayananId?: string;
  doctorId?: string;
  nurseId?: string;
  additionalDoctorIds?: string[];
  additionalNurseIds?: string[];
  useBooster?: boolean;
  boosterPackageId?: string | null;
  infusKe?: number;
  branchInfusKe?: number;
  shiftFollowingSessions?: boolean;
}

// ============================================================
// STEP 5: INFUSION EXECUTION
// ============================================================

export interface CreateInfusionInput {
  ifa250?: number; // IFA + NO 2,5ml - Wajib 1 botol per terapi (satuan: Botol)
  ifa500?: number; // IFA 500ml - Alternatif/special case (satuan: Botol)
  hho?: number;
  hhoKonsentrat?: number;
  h2?: number;
  no?: number;
  gaso?: number;
  o2?: number;
  o3?: number;
  edta?: number;
  mb?: number;
  h2s?: number;
  kcl?: number;
  jmlNb?: number;
  deviationNotes?: string;
  bottleType?: BottleType;
  jenisCairan?: string;
  volumeCarrier?: number;
  jumlahJarum?: number;
  tanggalProduksi?: string;
}

// ============================================================
// SESSION LIST
// ============================================================

export interface SessionListItem {
  sessionId: string;
  sessionCode: string;
  memberNo: string;
  memberName: string;
  treatmentDate: string;
  infusKe: number;
  doctorName: string;
  nurseName: string;
  pelaksanaan: SessionType;
  isCompleted: boolean;
}
