import type { TherapyPlan as SessionTherapyPlan } from '@/types/session';
import type { TherapyPlan } from '@/lib/therapyPlanApi';

export const SESSION_THERAPY_PLAN_EDITORS = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'DOCTOR'] as const;

export function canEditSessionTherapyPlan(role?: string | null): boolean {
  return Boolean(role && SESSION_THERAPY_PLAN_EDITORS.includes(role as (typeof SESSION_THERAPY_PLAN_EDITORS)[number]));
}

export function toSessionTherapyPlanTablePlan(
  plan: SessionTherapyPlan,
  sessionId: string
): TherapyPlan {
  const planNumber = plan.planNumber || 0;

  return {
    ...plan,
    keterangan: plan.keterangan || '',
    ifa250: plan.ifa250 ?? undefined,
    ifa500: plan.ifa500 ?? undefined,
    hho: plan.hho ?? undefined,
    h2: plan.h2 ?? undefined,
    no: plan.no ?? undefined,
    gaso: plan.gaso ?? undefined,
    o2: plan.o2 ?? undefined,
    o3: plan.o3 ?? undefined,
    edta: plan.edta ?? undefined,
    mb: plan.mb ?? undefined,
    h2s: plan.h2s ?? undefined,
    kcl: plan.kcl ?? undefined,
    jmlNb: plan.jmlNb ?? undefined,
    isUsed: true,
    usedInSession: {
      id: sessionId,
      sessionCode: '',
      treatmentDate: plan.createdAt,
      infusKe: planNumber,
      branchName: '',
      branchCode: '',
      totalSessionsCount: planNumber,
      branchSessionsCount: planNumber,
    },
  };
}

export function sortTherapyPlanSet(plans: TherapyPlan[]): TherapyPlan[] {
  return [...plans].sort(
    (first, second) => (first.planNumber || 0) - (second.planNumber || 0)
  );
}

export function getStep2TherapyPlansForTable(
  therapyPlanSet: TherapyPlan[],
  therapyPlan: SessionTherapyPlan | null,
  sessionId: string
): TherapyPlan[] {
  if (therapyPlanSet.length > 0) {
    return therapyPlanSet;
  }

  return therapyPlan ? [toSessionTherapyPlanTablePlan(therapyPlan, sessionId)] : [];
}

export function getTherapyPlanSubtitle(therapyPlan: SessionTherapyPlan): string {
  return `${therapyPlan.setName || `Set v${therapyPlan.setVersion || 1}`} · Terapi #${therapyPlan.planNumber || '-'}`;
}
