// ============================================================
// SESSION TYPES
// ============================================================

export type SessionType = 'ON_SITE' | 'HOME_CARE';
export type BoosterType = 'NO' | 'GASSOTRAUS';
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
  | 'LAINNYA';

// ============================================================
// CREATE SESSION
// ============================================================

export interface CreateSessionInput {
  memberId: string;
  memberPackageId: string;
  boosterPackageId?: string;
  therapyPlanId: string; // NEW: Required therapy plan
  adminLayananId: string;
  doctorId?: string; // Optional - auto-filled if user is DOCTOR
  nurseId?: string; // Optional - auto-filled if user is NURSE
  additionalDoctorIds?: string[];
  additionalNurseIds?: string[];
  treatmentDate: string;
  pelaksanaan: SessionType;
}

export interface CreateSessionResponse {
  sessionId: string;
  sessionCode: string;
  encounterId: string;
  encounterCode: string;
  infusKe: number;
  message: string;
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
}

export interface SessionBoosterPackage {
  packageId: string;
  packageCode: string;
  boosterType: BoosterType | null;
}

export interface Session {
  sessionId: string;
  sessionCode: string;
  encounterId: string;
  encounterCode: string;
  infusKe: number;
  pelaksanaan: SessionType;
  treatmentDate: string;
  isCompleted: boolean;
  member: SessionMember;
  adminLayanan: SessionStaff;
  doctor: SessionStaff;
  nurse: SessionStaff;
  boosterPackage: SessionBoosterPackage | null;
}

export interface Diagnosis {
  id: string;
  diagnosisCode: string;
  encounterId: string;
  doktorPemeriksa: string;
  diagnosa: string;
  kategoriDiagnosa: DiagnosisCategory | null;
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
  treatmentSessionId: string;
  keterangan: string | null;
  ifa: number | null;
  hho: number | null;
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
  ifa: number | null;
  hho: number | null;
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
  materials: any[];
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

// ============================================================
// STEP 1: DIAGNOSIS
// ============================================================

export interface CreateDiagnosisInput {
  doktorPemeriksa: string;
  diagnosa: string;
  kategoriDiagnosa?: DiagnosisCategory;
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
  ifa?: number;
  hho?: number;
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

// ============================================================
// STEP 5: INFUSION EXECUTION
// ============================================================

export interface CreateInfusionInput {
  ifa?: number;
  hho?: number;
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
