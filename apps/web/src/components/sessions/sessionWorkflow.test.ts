import {
  buildCompletionSummary,
  canEditSessionStep,
  canFinalizeSession,
  getDeviceClass,
  getMissingRequiredSteps,
} from './sessionWorkflow';
import type { SessionDetail, StepCompletion } from '@/types/session';

const completeSteps: StepCompletion = {
  step1_diagnosis: true,
  step2_therapyPlan: true,
  step3_vitalBefore: true,
  step4_infusion: true,
  step5_materials: true,
  step6_photo: false,
  step7_vitalAfter: true,
  step8_evaluation: true,
};

describe('sessionWorkflow', () => {
  it('memisahkan langkah dokter dari langkah operasional Nakes dan MSO', () => {
    expect(canEditSessionStep('DOCTOR', 1)).toBe(true);
    expect(canEditSessionStep('DOCTOR', 9)).toBe(true);
    expect(canEditSessionStep('NURSE', 3)).toBe(true);
    expect(canEditSessionStep('NURSE', 8)).toBe(true);
    expect(canEditSessionStep('ADMIN_LAYANAN', 3)).toBe(true);
    expect(canEditSessionStep('ADMIN_LAYANAN', 8)).toBe(true);
    expect(canEditSessionStep('ADMIN_LAYANAN', 1)).toBe(false);
    expect(canEditSessionStep('ADMIN_LAYANAN', 9)).toBe(false);
    expect(canFinalizeSession('ADMIN_LAYANAN')).toBe(false);
  });

  it('menganggap foto opsional dan menunjukkan step wajib yang hilang', () => {
    expect(getMissingRequiredSteps(completeSteps)).toEqual([]);
    expect(getMissingRequiredSteps({ ...completeSteps, step5_materials: false }))
      .toEqual([expect.objectContaining({ step: 5, label: 'Material' })]);
  });

  it('membuat ringkasan completion tanpa menghitung isi catatan medis', () => {
    const detail = {
      session: {
        sessionCode: 'SES-001',
        treatmentDate: '2026-08-25T08:00:00.000Z',
        member: { fullName: 'Member Demo' },
      },
      therapyPlan: { planCode: 'TP-001' },
      infusion: { id: 'inf-1' },
      vitalSigns: [
        { waktuCatat: 'SEBELUM' },
        { waktuCatat: 'SESUDAH' },
      ],
      materials: [
        { quantity: 2, deviationReason: null },
        { quantity: 1, deviationReason: 'CLINICAL_ADJUSTMENT' },
      ],
      steps: completeSteps,
    } as unknown as SessionDetail;

    expect(buildCompletionSummary(detail)).toMatchObject({
      member: 'Member Demo',
      materialLines: 2,
      materialQuantity: 3,
      deviations: 1,
      vitalBefore: 1,
      vitalAfter: 1,
      missing: [],
    });
  });

  it('mengelompokkan perangkat secara konsisten', () => {
    expect(getDeviceClass(390)).toBe('MOBILE');
    expect(getDeviceClass(800)).toBe('TABLET');
    expect(getDeviceClass(1440)).toBe('DESKTOP');
  });
});
