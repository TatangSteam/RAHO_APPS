import type { Role } from '@/types/auth';
import type { SessionDetail, StepCompletion } from '@/types/session';

export const SESSION_STEP_OWNER: Record<number, string> = {
  1: 'Dokter',
  2: 'Dokter',
  3: 'Nakes',
  4: 'Nakes',
  5: 'Nakes',
  6: 'Nakes',
  7: 'Nakes',
  8: 'Nakes',
  9: 'Dokter',
};

const MANAGER_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'];

export function canEditSessionStep(role: Role | undefined, step: number): boolean {
  if (!role) return false;
  if (MANAGER_ROLES.includes(role)) return true;
  if (role === 'NURSE' || role === 'ADMIN_LAYANAN') return step >= 1 && step <= 9;
  if (step === 1 || step === 2 || step === 9) return role === 'DOCTOR';
  return false;
}

export function canFinalizeSession(role: Role | undefined): boolean {
  return !!role && (
    MANAGER_ROLES.includes(role)
    || role === 'DOCTOR'
    || role === 'NURSE'
    || role === 'ADMIN_LAYANAN'
  );
}

export const REQUIRED_SESSION_STEPS: Array<{
  key: keyof StepCompletion;
  label: string;
  step: number;
}> = [
  { key: 'step1_diagnosis', label: 'Diagnosis', step: 1 },
  { key: 'step2_therapyPlan', label: 'Therapy plan', step: 2 },
  { key: 'step3_vitalBefore', label: 'Tanda vital sebelum', step: 3 },
  { key: 'step4_infusion', label: 'Infus aktual', step: 4 },
  { key: 'step5_materials', label: 'Material', step: 5 },
  { key: 'step7_vitalAfter', label: 'Tanda vital sesudah', step: 7 },
  { key: 'step8_evaluation', label: 'Evaluasi dokter', step: 9 },
];

export function getMissingRequiredSteps(steps: StepCompletion) {
  return REQUIRED_SESSION_STEPS.filter((item) => !steps[item.key]);
}

export function buildCompletionSummary(detail: SessionDetail) {
  return {
    member: detail.session.member.fullName,
    sessionCode: detail.session.sessionCode,
    treatmentDate: detail.session.treatmentDate,
    therapyPlan: detail.therapyPlan?.planCode || '-',
    infusionRecorded: Boolean(detail.infusion),
    materialLines: detail.materials.length,
    materialQuantity: detail.materials.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    deviations: detail.materials.filter((item) => item.deviationReason).length,
    vitalBefore: detail.vitalSigns.filter((item) => item.waktuCatat === 'SEBELUM').length,
    vitalAfter: detail.vitalSigns.filter((item) => item.waktuCatat === 'SESUDAH').length,
    missing: getMissingRequiredSteps(detail.steps),
  };
}

export function getDeviceClass(width: number): 'MOBILE' | 'TABLET' | 'DESKTOP' | 'UNKNOWN' {
  if (!Number.isFinite(width) || width <= 0) return 'UNKNOWN';
  if (width < 640) return 'MOBILE';
  if (width < 1024) return 'TABLET';
  return 'DESKTOP';
}
