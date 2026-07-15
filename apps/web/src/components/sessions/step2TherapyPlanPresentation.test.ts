import type { TherapyPlan as SessionTherapyPlan } from '@/types/session';
import type { TherapyPlan } from '@/lib/therapyPlanApi';
import {
  canEditSessionTherapyPlan,
  getStep2TherapyPlansForTable,
  getTherapyPlanSubtitle,
  sortTherapyPlanSet,
  toSessionTherapyPlanTablePlan,
} from './step2TherapyPlanPresentation';

const sessionPlan: SessionTherapyPlan = {
  id: 'plan-1',
  planCode: 'TP-001',
  planNumber: 2,
  therapyPlanSetId: 'set-1',
  setName: 'Set Detox',
  setVersion: 3,
  setStatus: 'ACTIVE',
  treatmentSessionId: 'session-1',
  keterangan: null,
  ifa250: 1,
  ifa500: null,
  hho: null,
  hhoKonsentrat: null,
  h2: 2,
  no: null,
  gaso: null,
  o2: null,
  o3: null,
  edta: null,
  mb: null,
  h2s: null,
  kcl: null,
  jmlNb: null,
  ifaSubstances: null,
  ifaSubstanceTotalMl: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const tablePlans = [
  { id: 'plan-3', planCode: 'TP-003', planNumber: 3, isUsed: true, createdAt: '2026-07-01T00:00:00.000Z' },
  { id: 'plan-1', planCode: 'TP-001', planNumber: 1, isUsed: true, createdAt: '2026-07-01T00:00:00.000Z' },
] as TherapyPlan[];

describe('step2TherapyPlanPresentation', () => {
  it('allows only therapy plan editor roles', () => {
    expect(canEditSessionTherapyPlan('SUPER_ADMIN')).toBe(true);
    expect(canEditSessionTherapyPlan('ADMIN_MANAGER')).toBe(true);
    expect(canEditSessionTherapyPlan('DOCTOR')).toBe(true);
    expect(canEditSessionTherapyPlan('NURSE')).toBe(true);
    expect(canEditSessionTherapyPlan(null)).toBe(false);
  });

  it('maps session therapy plan into table plan fallback shape', () => {
    const tablePlan = toSessionTherapyPlanTablePlan(sessionPlan, 'session-2');

    expect(tablePlan).toEqual(
      expect.objectContaining({
        id: 'plan-1',
        keterangan: '',
        ifa250: 1,
        ifa500: undefined,
        h2: 2,
        isUsed: true,
        usedInSession: expect.objectContaining({
          id: 'session-2',
          treatmentDate: sessionPlan.createdAt,
          infusKe: 2,
          totalSessionsCount: 2,
          branchSessionsCount: 2,
        }),
      })
    );
  });

  it('sorts therapy plan set by plan number without mutating the source array', () => {
    const sorted = sortTherapyPlanSet(tablePlans);

    expect(sorted.map((plan) => plan.id)).toEqual(['plan-1', 'plan-3']);
    expect(tablePlans.map((plan) => plan.id)).toEqual(['plan-3', 'plan-1']);
  });

  it('uses fetched set plans first and falls back to session therapy plan', () => {
    expect(getStep2TherapyPlansForTable(tablePlans, sessionPlan, 'session-1')).toBe(tablePlans);

    const fallback = getStep2TherapyPlansForTable([], sessionPlan, 'session-1');
    expect(fallback).toHaveLength(1);
    expect(fallback[0].id).toBe('plan-1');

    expect(getStep2TherapyPlansForTable([], null, 'session-1')).toEqual([]);
  });

  it('formats therapy plan subtitle from set and plan number', () => {
    expect(getTherapyPlanSubtitle(sessionPlan)).toBe('Set Detox · Terapi #2');
    expect(getTherapyPlanSubtitle({ ...sessionPlan, setName: null, setVersion: null, planNumber: null })).toBe(
      'Set v1 · Terapi #-'
    );
  });
});
