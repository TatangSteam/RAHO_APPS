import {
  Prisma,
  Role,
  TreatmentCompletionStatus,
  type DoctorEvaluation,
} from '@prisma/client';
import { prisma } from '@lib/prisma';

export const UNFINISHED_SESSION_REMINDER_ROLES: Role[] = [
  Role.ADMIN_CABANG,
  Role.ADMIN_LAYANAN,
  Role.DOCTOR,
  Role.NURSE,
];

export type UnfinishedSessionStepKey =
  | 'DIAGNOSIS'
  | 'THERAPY_PLAN'
  | 'VITAL_BEFORE'
  | 'INFUSION'
  | 'MATERIALS'
  | 'VITAL_AFTER'
  | 'DOCTOR_EVALUATION'
  | 'FINALIZE';

export type UnfinishedSessionReminderKind = 'OPERATIONAL_STEPS' | 'DOCTOR_EVALUATION';

export interface UnfinishedSessionStep {
  key: UnfinishedSessionStepKey;
  label: string;
}

export interface UnfinishedSessionState {
  diagnosis: boolean;
  therapyPlan: boolean;
  vitalBefore: boolean;
  infusion: boolean;
  materials: boolean;
  vitalAfter: boolean;
  doctorEvaluation: boolean;
}

export interface ResolvedUnfinishedSessionReminder {
  kind: UnfinishedSessionReminderKind;
  missingSteps: UnfinishedSessionStep[];
}

const PRE_EVALUATION_STEPS: Array<{
  state: keyof Omit<UnfinishedSessionState, 'doctorEvaluation'>;
  key: UnfinishedSessionStepKey;
  label: string;
}> = [
  { state: 'diagnosis', key: 'DIAGNOSIS', label: 'Diagnosis sesi' },
  { state: 'therapyPlan', key: 'THERAPY_PLAN', label: 'Rencana terapi' },
  { state: 'vitalBefore', key: 'VITAL_BEFORE', label: 'Vital sign sebelum terapi' },
  { state: 'infusion', key: 'INFUSION', label: 'Pelaksanaan infus' },
  { state: 'materials', key: 'MATERIALS', label: 'Pemakaian material' },
  { state: 'vitalAfter', key: 'VITAL_AFTER', label: 'Vital sign sesudah terapi' },
];

type EvaluationSnapshot = Pick<
  DoctorEvaluation,
  'subjective' | 'objective' | 'assessment' | 'plan' | 'generalNotes'
> | null;

export function hasFilledDoctorEvaluation(evaluation: EvaluationSnapshot): boolean {
  if (!evaluation) return false;

  return [
    evaluation.subjective,
    evaluation.objective,
    evaluation.assessment,
    evaluation.plan,
    evaluation.generalNotes,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);
}

/**
 * Divides unfinished work by assignment. Nakes and MSO may complete every
 * workflow step, including the SOAP evaluation and finalization.
 */
export function resolveUnfinishedSessionReminder(
  role: Role,
  state: UnfinishedSessionState,
): ResolvedUnfinishedSessionReminder | null {
  const missingOperationalSteps = PRE_EVALUATION_STEPS
    .filter((step) => !state[step.state])
    .map(({ key, label }) => ({ key, label }));

  if (role === Role.DOCTOR) {
    if (missingOperationalSteps.length > 0 || state.doctorEvaluation) return null;

    return {
      kind: 'DOCTOR_EVALUATION',
      missingSteps: [{ key: 'DOCTOR_EVALUATION', label: 'Evaluasi dokter' }],
    };
  }

  const operationalRoles: Role[] = [Role.ADMIN_CABANG, Role.ADMIN_LAYANAN, Role.NURSE];
  if (!operationalRoles.includes(role)) {
    return null;
  }

  if (missingOperationalSteps.length > 0) {
    return { kind: 'OPERATIONAL_STEPS', missingSteps: missingOperationalSteps };
  }

  if (!state.doctorEvaluation && (role === Role.ADMIN_LAYANAN || role === Role.NURSE)) {
    return {
      kind: 'DOCTOR_EVALUATION',
      missingSteps: [{ key: 'DOCTOR_EVALUATION', label: 'Evaluasi SOAP' }],
    };
  }

  if (state.doctorEvaluation) {
    return {
      kind: 'OPERATIONAL_STEPS',
      missingSteps: [{ key: 'FINALIZE', label: 'Finalisasi sesi' }],
    };
  }

  return null;
}

export function buildUnfinishedSessionAssignmentScope(input: {
  userId: string;
  role: Role;
  branchId: string | null;
}): Prisma.TreatmentSessionWhereInput | null {
  if (input.role === Role.ADMIN_CABANG) {
    return input.branchId ? { branchId: input.branchId } : null;
  }

  if (input.role === Role.ADMIN_LAYANAN) {
    return { adminLayananId: input.userId };
  }

  if (input.role === Role.NURSE) {
    return {
      OR: [
        { nurseId: input.userId },
        { sessionNurses: { some: { nurseId: input.userId } } },
      ],
    };
  }

  if (input.role === Role.DOCTOR) {
    return {
      OR: [
        { doctorId: input.userId },
        { sessionDoctors: { some: { doctorId: input.userId } } },
      ],
    };
  }

  return null;
}

export class UnfinishedSessionReminderService {
  async listForUser(input: {
    userId: string;
    role: Role;
    branchId: string | null;
  }) {
    const assignmentScope = buildUnfinishedSessionAssignmentScope(input);
    if (!assignmentScope) return { total: 0, items: [] };

    const sessions = await prisma.treatmentSession.findMany({
      where: {
        isCompleted: false,
        completionStatus: TreatmentCompletionStatus.IN_PROGRESS,
        AND: [assignmentScope],
      },
      orderBy: [{ treatmentDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        sessionCode: true,
        treatmentDate: true,
        branch: { select: { id: true, name: true, branchCode: true } },
        encounter: {
          select: {
            diagnoses: { take: 1, select: { id: true } },
            member: {
              select: {
                id: true,
                memberNo: true,
                user: { select: { profile: { select: { fullName: true } } } },
              },
            },
          },
        },
        therapyPlan: { select: { id: true } },
        vitalSigns: { select: { waktuCatat: true } },
        infusion: { select: { id: true } },
        materials: { take: 1, select: { id: true } },
        evaluation: {
          select: {
            subjective: true,
            objective: true,
            assessment: true,
            plan: true,
            generalNotes: true,
          },
        },
      },
    });

    const items = sessions.flatMap((session) => {
      const reminder = resolveUnfinishedSessionReminder(input.role, {
        diagnosis: session.encounter.diagnoses.length > 0,
        therapyPlan: Boolean(session.therapyPlan),
        vitalBefore: session.vitalSigns.some((vital) => vital.waktuCatat === 'SEBELUM'),
        infusion: Boolean(session.infusion),
        materials: session.materials.length > 0,
        vitalAfter: session.vitalSigns.some((vital) => vital.waktuCatat === 'SESUDAH'),
        doctorEvaluation: hasFilledDoctorEvaluation(session.evaluation),
      });

      if (!reminder) return [];

      return [{
        sessionId: session.id,
        sessionCode: session.sessionCode,
        treatmentDate: session.treatmentDate.toISOString(),
        branch: session.branch,
        member: {
          memberId: session.encounter.member.id,
          memberNo: session.encounter.member.memberNo,
          fullName: session.encounter.member.user.profile?.fullName || session.encounter.member.memberNo,
        },
        ...reminder,
      }];
    });

    return { total: items.length, items: items.slice(0, 20) };
  }
}
