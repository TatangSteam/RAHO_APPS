import { Role } from '@prisma/client';
import {
  buildUnfinishedSessionAssignmentScope,
  resolveUnfinishedSessionReminder,
  type UnfinishedSessionState,
} from '../unfinished-session-reminder.service';

const completePrerequisites: UnfinishedSessionState = {
  diagnosis: true,
  therapyPlan: true,
  vitalBefore: true,
  infusion: true,
  materials: true,
  vitalAfter: true,
  doctorEvaluation: false,
};

describe('unfinished session reminder responsibility', () => {
  it('does not remind a doctor while a prerequisite is missing', () => {
    const reminder = resolveUnfinishedSessionReminder(Role.DOCTOR, {
      ...completePrerequisites,
      vitalAfter: false,
    });

    expect(reminder).toBeNull();
  });

  it('reminds an assigned doctor only for evaluation after prerequisites are ready', () => {
    expect(resolveUnfinishedSessionReminder(Role.DOCTOR, completePrerequisites)).toEqual({
      kind: 'DOCTOR_EVALUATION',
      missingSteps: [{ key: 'DOCTOR_EVALUATION', label: 'Evaluasi dokter' }],
    });
  });

  it.each([Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.NURSE])(
    'gives missing workflow work to %s',
    (role) => {
      const reminder = resolveUnfinishedSessionReminder(role, {
        ...completePrerequisites,
        infusion: false,
        vitalAfter: false,
      });

      expect(reminder).toEqual({
        kind: 'OPERATIONAL_STEPS',
        missingSteps: [
          { key: 'INFUSION', label: 'Pelaksanaan infus' },
          { key: 'VITAL_AFTER', label: 'Vital sign sesudah terapi' },
        ],
      });
    },
  );

  it.each([Role.ADMIN_LAYANAN, Role.NURSE])(
    'lets %s continue with SOAP when prerequisites are complete',
    (role) => {
      expect(resolveUnfinishedSessionReminder(role, completePrerequisites)).toEqual({
        kind: 'DOCTOR_EVALUATION',
        missingSteps: [{ key: 'DOCTOR_EVALUATION', label: 'Evaluasi SOAP' }],
      });
    },
  );

  it('keeps Admin Cabang waiting when only evaluation is missing', () => {
    expect(resolveUnfinishedSessionReminder(Role.ADMIN_CABANG, completePrerequisites)).toBeNull();
  });

  it('returns finalization to operational staff after evaluation is filled', () => {
    expect(resolveUnfinishedSessionReminder(Role.NURSE, {
      ...completePrerequisites,
      doctorEvaluation: true,
    })).toEqual({
      kind: 'OPERATIONAL_STEPS',
      missingSteps: [{ key: 'FINALIZE', label: 'Finalisasi sesi' }],
    });
  });
});

describe('unfinished session reminder assignment scope', () => {
  it('scopes Admin Cabang to the primary branch', () => {
    expect(buildUnfinishedSessionAssignmentScope({
      userId: 'admin-branch',
      role: Role.ADMIN_CABANG,
      branchId: 'branch-a',
    })).toEqual({ branchId: 'branch-a' });
  });

  it('scopes Admin Layanan to sessions assigned to that admin', () => {
    expect(buildUnfinishedSessionAssignmentScope({
      userId: 'admin-service',
      role: Role.ADMIN_LAYANAN,
      branchId: 'branch-a',
    })).toEqual({ adminLayananId: 'admin-service' });
  });

  it('includes primary and additional nurse assignments', () => {
    expect(buildUnfinishedSessionAssignmentScope({
      userId: 'nurse-a',
      role: Role.NURSE,
      branchId: 'branch-a',
    })).toEqual({
      OR: [
        { nurseId: 'nurse-a' },
        { sessionNurses: { some: { nurseId: 'nurse-a' } } },
      ],
    });
  });

  it('includes primary and additional doctor assignments', () => {
    expect(buildUnfinishedSessionAssignmentScope({
      userId: 'doctor-a',
      role: Role.DOCTOR,
      branchId: 'branch-a',
    })).toEqual({
      OR: [
        { doctorId: 'doctor-a' },
        { sessionDoctors: { some: { doctorId: 'doctor-a' } } },
      ],
    });
  });
});
