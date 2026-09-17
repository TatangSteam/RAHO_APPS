import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Step5Infusion from './Step5Infusion';
import Step9Evaluation from './Step9Evaluation';
import { areSessionStepPrerequisitesMet, canEditSessionStep } from './sessionWorkflow';
import { sessionApi } from '@/lib/sessionApi';
import { evaluationApi } from '@/lib/evaluationApi';
import type { StepCompletion } from '@/types/session';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { userId: 'doctor-1', role: 'DOCTOR' } }) }));
jest.mock('@/lib/sessionApi', () => ({ sessionApi: { createInfusion: jest.fn() } }));
jest.mock('@/lib/evaluationApi', () => ({ evaluationApi: { createEvaluation: jest.fn(), updateEvaluation: jest.fn() } }));
jest.mock('@/lib/therapyPlanApi', () => ({ therapyPlanApi: { getMemberTherapyPlans: jest.fn() } }));
jest.mock('@/lib/toast', () => ({ showToast: { success: jest.fn(), error: jest.fn() } }));

const steps: StepCompletion = {
  step1_diagnosis: false, step2_therapyPlan: false, step3_vitalBefore: false,
  step4_infusion: false, step5_materials: false, step6_photo: false,
  step7_vitalAfter: false, step8_evaluation: false,
};
const enabled = (step: number) => canEditSessionStep('DOCTOR', step) && areSessionStepPrerequisitesMet('DOCTOR', step, steps);

describe('doctor independent section saves', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits actual infusion without a therapy plan or earlier steps', async () => {
    (sessionApi.createInfusion as jest.Mock).mockResolvedValue({ id: 'infusion-1' });
    const completed = jest.fn();
    render(<fieldset disabled={!enabled(4)}><Step5Infusion sessionId="session-1" therapyPlan={null} infusion={null} isLocked={!enabled(4)} onComplete={completed} /></fieldset>);
    const save = screen.getByRole('button', { name: /Simpan$/ });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(sessionApi.createInfusion).toHaveBeenCalledWith('session-1', expect.objectContaining({ ifa250: 1 })));
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
  });

  it('submits SOAP evaluation without vital signs after therapy', async () => {
    (evaluationApi.createEvaluation as jest.Mock).mockResolvedValue({ id: 'evaluation-1' });
    const completed = jest.fn();
    render(<fieldset disabled={!enabled(9)}><Step9Evaluation sessionId="session-1" evaluation={null} isLocked={!enabled(9)} onComplete={completed} /></fieldset>);
    fireEvent.change(screen.getByPlaceholderText('Data subjektif dari pasien...'), { target: { value: 'Catatan dokter' } });
    const save = screen.getByRole('button', { name: /Simpan Evaluasi/ });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(evaluationApi.createEvaluation).toHaveBeenCalledWith('session-1', expect.objectContaining({ subjective: 'Catatan dokter', writtenBy: 'doctor-1' })));
    await waitFor(() => expect(completed).toHaveBeenCalledTimes(1));
  });
});
