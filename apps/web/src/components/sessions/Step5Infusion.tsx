'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import type { TherapyPlan, InfusionExecution, CreateInfusionInput } from '@/types/session';
import { therapyPlanApi, type TherapyPlan as MemberTherapyPlan } from '@/lib/therapyPlanApi';
import { devError } from '@/lib/logger';

interface Step5InfusionProps {
  sessionId: string;
  memberId?: string;
  therapyPlan: TherapyPlan | null;
  infusion: InfusionExecution | null;
  isLocked: boolean;
  onComplete: () => void;
  onNext?: () => void; // Optional callback to navigate to next step
  onEditTherapyPlanSet?: () => void; // Callback to open edit modal
}

// IFA fields handled separately with radio selection
const DOSE_FIELDS = [
  { key: 'hho', label: 'HHO', unit: 'ml' },
  { key: 'hhoKonsentrat', label: 'HHO Konsentrat', unit: 'ml' },
  { key: 'h2', label: 'H2', unit: 'ml' },
  { key: 'no', label: 'NO', unit: 'ml' },
  { key: 'gaso', label: 'GASO', unit: 'ml' },
  { key: 'o2', label: 'O2', unit: 'ml' },
  { key: 'o3', label: 'O3', unit: 'ml' },
  { key: 'edta', label: 'EDTA', unit: 'ml' },
  { key: 'mb', label: 'MB', unit: 'ml' },
  { key: 'h2s', label: 'H2S', unit: 'ml' },
  { key: 'kcl', label: 'KCL', unit: 'ml' },
  { key: 'jmlNb', label: 'Jml.NB', unit: 'ml' },
];

// For display purposes
const ALL_DOSE_FIELDS = [
  { key: 'ifa250', label: 'IFA + NO 2,5ml', unit: 'Botol' },
  { key: 'ifa500', label: 'IFA 500ml', unit: 'Botol' },
  ...DOSE_FIELDS,
];

type NumericDoseKey =
  | 'ifa250'
  | 'ifa500'
  | 'hho'
  | 'hhoKonsentrat'
  | 'h2'
  | 'no'
  | 'gaso'
  | 'o2'
  | 'o3'
  | 'edta'
  | 'mb'
  | 'h2s'
  | 'kcl'
  | 'jmlNb';

interface TherapyPlanSetRow {
  id: string;
  planCode: string;
  planNumber?: number | null;
  therapyPlanSetId?: string | null;
  setCode?: string | null;
  setName?: string | null;
  setVersion?: number | null;
  setStatus?: string | null;
  version?: number | null;
  keterangan?: string | null;
  ifa250?: number | null;
  ifa500?: number | null;
  hho?: number | null;
  hhoKonsentrat?: number | null;
  h2?: number | null;
  no?: number | null;
  gaso?: number | null;
  o2?: number | null;
  o3?: number | null;
  edta?: number | null;
  mb?: number | null;
  h2s?: number | null;
  kcl?: number | null;
  jmlNb?: number | null;
  ifaSubstances?: MemberTherapyPlan['ifaSubstances'];
  ifaSubstanceTotalMl?: number | null;
  isUsed?: boolean;
  usedInSession?: MemberTherapyPlan['usedInSession'];
  createdAt?: string;
  supersededById?: string | null;
  supersededAt?: string | null;
}

interface DoseColumn {
  key: NumericDoseKey;
  label: string;
  aliases?: string[];
  mergeIfaSubstances?: boolean;
}

interface ExtraSubstanceColumn {
  id: string;
  label: string;
  unit: string;
  normalizedName: string;
}

const SET_DOSE_COLUMNS: DoseColumn[] = [
  { key: 'ifa250', label: 'IFA+NO' },
  { key: 'ifa500', label: 'IFA 500' },
  { key: 'hho', label: 'HHO ml', aliases: ['hho', 'nb hho'], mergeIfaSubstances: true },
  { key: 'hhoKonsentrat', label: 'HHO Kons. ml', aliases: ['hho konsentrat', 'hhokonsentrat', 'hhoc'], mergeIfaSubstances: true },
  { key: 'h2', label: 'H2 ml', aliases: ['h2', 'hydrogen'], mergeIfaSubstances: true },
  { key: 'no', label: 'NO ml', aliases: ['no', 'nitric oxide'], mergeIfaSubstances: true },
  { key: 'gaso', label: 'GASO ml', aliases: ['gaso', 'gt', 'gasotransmitter'], mergeIfaSubstances: true },
  { key: 'o2', label: 'O2 ml', aliases: ['o2', 'oxygen'], mergeIfaSubstances: true },
  { key: 'o3', label: 'O3 ml', aliases: ['o3', 'ozone'], mergeIfaSubstances: true },
  { key: 'edta', label: 'EDTA ml', aliases: ['edta'], mergeIfaSubstances: true },
  { key: 'mb', label: 'MB ml', aliases: ['mb', 'methylene blue'], mergeIfaSubstances: true },
  { key: 'h2s', label: 'H2S ml', aliases: ['h2s', 'h2s konsentrat', 'hk'], mergeIfaSubstances: true },
  { key: 'kcl', label: 'KCL ml', aliases: ['kcl'], mergeIfaSubstances: true },
  { key: 'jmlNb', label: 'Jml NB' },
];

const KNOWN_IFA_ALIASES = new Set(
  SET_DOSE_COLUMNS.flatMap((column) => column.aliases || []).map(normalizeName)
);

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function toPositiveNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function formatDoseValue(value: number): string {
  if (value <= 0) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function isDefaultNoInIfa(substance: { name: string; amount: number; unit?: string }): boolean {
  const amount = Number(substance.amount);

  return (
    normalizeName(substance.name) === 'no' &&
    (substance.unit || 'ml').toLowerCase() === 'ml' &&
    Number.isFinite(amount) &&
    Math.abs(amount - 2.5) < 0.001
  );
}

function getIfaSubstanceTotal(
  substances: TherapyPlanSetRow['ifaSubstances'],
  aliases: string[]
): number {
  const normalizedAliases = new Set(aliases.map(normalizeName));

  return (substances || []).reduce((total, substance) => {
    if (!normalizedAliases.has(normalizeName(substance.name))) return total;
    if ((substance.unit || 'ml').toLowerCase() !== 'ml') return total;
    if (isDefaultNoInIfa(substance)) return total;
    return total + toPositiveNumber(substance.amount);
  }, 0);
}

function getColumnValue(plan: TherapyPlanSetRow, column: DoseColumn): number {
  const baseValue = toPositiveNumber(plan[column.key]);
  if (!column.mergeIfaSubstances || !column.aliases) return baseValue;
  return baseValue + getIfaSubstanceTotal(plan.ifaSubstances, column.aliases);
}

function getExtraSubstanceColumns(plans: TherapyPlanSetRow[]): ExtraSubstanceColumn[] {
  const columns = new Map<string, ExtraSubstanceColumn>();

  plans.forEach((plan) => {
    (plan.ifaSubstances || []).forEach((substance) => {
      const normalizedName = normalizeName(substance.name);
      if (!normalizedName || KNOWN_IFA_ALIASES.has(normalizedName)) return;
      if (isDefaultNoInIfa(substance)) return;

      const unit = substance.unit || 'ml';
      const id = `${normalizedName}-${normalizeName(unit)}`;
      if (columns.has(id)) return;

      columns.set(id, {
        id,
        label: `${substance.name} ${unit}`,
        unit,
        normalizedName,
      });
    });
  });

  return Array.from(columns.values());
}

function getExtraSubstanceValue(plan: TherapyPlanSetRow, column: ExtraSubstanceColumn): number {
  return (plan.ifaSubstances || []).reduce((total, substance) => {
    if (normalizeName(substance.name) !== column.normalizedName) return total;
    if ((substance.unit || 'ml').toLowerCase() !== column.unit.toLowerCase()) return total;
    if (isDefaultNoInIfa(substance)) return total;
    return total + toPositiveNumber(substance.amount);
  }, 0);
}

function getPlanSetKey(plan: Partial<TherapyPlanSetRow>): string {
  return plan.therapyPlanSetId || `${plan.setName || 'legacy'}-${plan.setVersion || plan.version || 1}`;
}

function isSameTherapyPlanSet(plan: Partial<TherapyPlanSetRow>, selectedPlan: TherapyPlan): boolean {
  if (selectedPlan.therapyPlanSetId && plan.therapyPlanSetId) {
    return plan.therapyPlanSetId === selectedPlan.therapyPlanSetId;
  }

  return getPlanSetKey(plan) === getPlanSetKey(selectedPlan);
}

function hasDoseDeviation(planValue: unknown, actualValue: unknown): boolean {
  const planned = toPositiveNumber(planValue);
  const actual = toPositiveNumber(actualValue);

  if (planned === 0 && actual === 0) return false;
  return planned !== actual;
}

function getNoInIfaAmount(plan: TherapyPlan, actualIfa250: unknown): number {
  if (toPositiveNumber(actualIfa250) === 0) return 0;

  const noInIfa = (plan.ifaSubstances || []).reduce((total, substance) => {
    if (normalizeName(substance.name) !== 'no') return total;
    if ((substance.unit || 'ml').toLowerCase() !== 'ml') return total;
    return total + toPositiveNumber(substance.amount);
  }, 0);

  return noInIfa > 0 ? noInIfa : 2.5;
}

function getPlannedActualDose(
  key: string,
  plan: TherapyPlan,
  actual: CreateInfusionInput
): number {
  const plannedDose = toPositiveNumber(plan[key as keyof TherapyPlan]);

  if (key !== 'no') return plannedDose;

  return Math.max(plannedDose - getNoInIfaAmount(plan, actual.ifa250), 0);
}

export default function Step5Infusion({
  sessionId,
  memberId,
  therapyPlan,
  infusion,
  isLocked,
  onComplete,
  onNext,
  onEditTherapyPlanSet,
}: Step5InfusionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDeviation, setHasDeviation] = useState(false);
  const [showPlanDetails, setShowPlanDetails] = useState(true);
  const [selectedSetPlans, setSelectedSetPlans] = useState<TherapyPlanSetRow[]>([]);
  const [loadingSetPlans, setLoadingSetPlans] = useState(false);
  const [setPlansError, setSetPlansError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateInfusionInput>({
    ifa250: 1, // Default 1 botol IFA + NO 2,5ml per terapi (wajib)
    ifa500: undefined,
    hho: undefined,
    hhoKonsentrat: undefined,
    h2: undefined,
    no: undefined,
    gaso: undefined,
    o2: undefined,
    o3: undefined,
    edta: undefined,
    mb: undefined,
    h2s: undefined,
    kcl: undefined,
    jmlNb: undefined,
    deviationNotes: undefined,
    bottleType: undefined,
    jenisCairan: undefined,
    volumeCarrier: undefined,
    jumlahJarum: undefined,
    tanggalProduksi: undefined,
  });

  // NO AUTO-FILL - Staff enters actual values manually
  // Auto-fill removed per user request to allow verification of therapy plan first

  useEffect(() => {
    if (!therapyPlan) {
      setSelectedSetPlans([]);
      return;
    }

    if (!memberId) {
      setSelectedSetPlans([therapyPlan]);
      return;
    }

    let isMounted = true;

    const loadSelectedSetPlans = async () => {
      setLoadingSetPlans(true);
      setSetPlansError(null);

      try {
        const plans = await therapyPlanApi.getMemberTherapyPlans(memberId);
        if (!isMounted) return;

        const plansInSelectedSet = plans
          .filter((plan) => isSameTherapyPlanSet(plan, therapyPlan))
          .sort((a, b) => (a.planNumber || 0) - (b.planNumber || 0));

        setSelectedSetPlans(plansInSelectedSet.length > 0 ? plansInSelectedSet : [therapyPlan]);
      } catch (err) {
        devError('Failed to load selected therapy plan set:', err);
        if (!isMounted) return;
        setSelectedSetPlans([therapyPlan]);
        setSetPlansError('Gagal memuat satu set therapy plan. Menampilkan terapi yang dipilih saja.');
      } finally {
        if (isMounted) {
          setLoadingSetPlans(false);
        }
      }
    };

    loadSelectedSetPlans();

    return () => {
      isMounted = false;
    };
  }, [memberId, therapyPlan]);

  // Check for deviations (including IFA fields)
  useEffect(() => {
    if (!therapyPlan) {
      setHasDeviation(false);
      return;
    }

    const ifaDeviation =
      hasDoseDeviation(therapyPlan.ifa250, formData.ifa250) ||
      hasDoseDeviation(therapyPlan.ifa500, formData.ifa500);

    const otherDeviations = DOSE_FIELDS.some((field) => {
      const planValue = getPlannedActualDose(field.key, therapyPlan, formData);
      const actualValue = formData[field.key as keyof CreateInfusionInput];
      return hasDoseDeviation(planValue, actualValue);
    });

    setHasDeviation(ifaDeviation || otherDeviations);
  }, [formData, therapyPlan]);

  const [shouldNavigateNext, setShouldNavigateNext] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (hasDeviation) {
      setError('Dosis aktual belum sesuai therapy plan. Edit therapy plan terlebih dahulu agar rencana dan aktual sama.');
      return;
    }

    setLoading(true);

    try {
      await sessionApi.createInfusion(sessionId, formData);
      onComplete();
      // Navigate to next step if user clicked "Simpan & Lanjut"
      if (shouldNavigateNext && onNext) {
        onNext();
        setShouldNavigateNext(false);
      }
    } catch (err: any) {
      devError('Failed to create infusion:', err);
      setError(err.response?.data?.error?.message || 'Gagal menyimpan infus aktual');
      setShouldNavigateNext(false);
    } finally {
      setLoading(false);
    }
  };

  const updateDose = (key: string, value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    setFormData({ ...formData, [key]: numValue });
  };

  const handleEditTherapyPlan = () => {
    if (onEditTherapyPlanSet) {
      onEditTherapyPlanSet();
      return;
    }

    if (memberId) {
      router.push(`/members/${memberId}?tab=therapy-plan`);
    }
  };

  const displaySetPlans = useMemo(() => {
    if (selectedSetPlans.length > 0) return selectedSetPlans;
    return therapyPlan ? [therapyPlan] : [];
  }, [selectedSetPlans, therapyPlan]);

  if (isLocked) {
    return (
      <div style={{
        padding: '24px',
        background: 'rgba(148,163,184,0.05)',
        border: '2px solid rgba(148,163,184,0.2)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(148,163,184,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontWeight: '700',
            fontSize: '20px'
          }}>
            5
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>
              💧 Infus Aktual
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Step sebelumnya harus diselesaikan terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (infusion) {
    return (
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))',
        border: '2px solid rgba(34,197,94,0.3)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '700',
            fontSize: '24px',
            boxShadow: '0 4px 12px rgba(34,197,94,0.3)'
          }}>
            ✓
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>
              💧 Infus Aktual
            </h3>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>
              Infus aktual telah dicatat
            </p>
          </div>
          </div>
          {(onEditTherapyPlanSet || memberId) && (
            <button
              type="button"
              onClick={handleEditTherapyPlan}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(251,191,36,0.45)',
                background: 'rgba(251,191,36,0.18)',
                color: '#fbbf24',
                fontSize: '12px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              Edit Therapy Plan
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '16px'
        }}>
          {ALL_DOSE_FIELDS.map((field) => {
            const value = infusion[field.key as keyof InfusionExecution];
            if (!value) return null;
            return (
              <div key={field.key} style={{
                padding: '12px',
                background: field.key === 'ifa250' ? 'rgba(34,197,94,0.15)' : 
                           field.key === 'ifa500' ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.08)',
                border: field.key === 'ifa250' ? '2px solid rgba(34,197,94,0.4)' : 
                        field.key === 'ifa500' ? '2px solid rgba(251,191,36,0.4)' : '1px solid rgba(148,163,184,0.2)',
                borderRadius: 'var(--radius-md)'
              }}>
                <p style={{ fontSize: '11px', color: field.key === 'ifa250' ? '#4ade80' : field.key === 'ifa500' ? '#fbbf24' : '#94a3b8', marginBottom: '4px' }}>
                  {field.label}
                </p>
                <p style={{ fontSize: '16px', fontWeight: '700', color: field.key === 'ifa250' ? '#4ade80' : field.key === 'ifa500' ? '#fbbf24' : '#60a5fa' }}>
                  {Number(value)} <span style={{ fontSize: '12px', color: '#94a3b8' }}>{field.unit}</span>
                </p>
              </div>
            );
          })}
        </div>

        {infusion.deviationNotes && (
          <div style={{
            padding: '16px',
            background: 'rgba(251,191,36,0.15)',
            border: '2px solid rgba(251,191,36,0.3)',
            borderRadius: 'var(--radius-md)',
            marginTop: '16px'
          }}>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#fbbf24', marginBottom: '8px' }}>
              ⚠️ Catatan Deviasi:
            </p>
            <p style={{ fontSize: '14px', color: '#fcd34d', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {infusion.deviationNotes}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
      border: '2px solid rgba(59,130,246,0.3)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: '24px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '20px',
          boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
        }}>
          5
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#f1f5f9' }}>
            💧 Infus Aktual
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Catat dosis aktual yang diberikan
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '16px',
          background: 'rgba(239,68,68,0.15)',
          border: '2px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          color: '#fca5a5',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {hasDeviation && (
        <div style={{
          padding: '16px',
          background: 'rgba(251,191,36,0.15)',
          border: '2px solid rgba(251,191,36,0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#fbbf24', marginBottom: '4px' }}>
                Deviasi Terdeteksi
              </p>
              <p style={{ fontSize: '13px', color: '#fcd34d' }}>
                Ada perbedaan antara dosis aktual dan therapy plan. Edit therapy plan terlebih dahulu agar rencana dan aktual menjadi sesuai.
              </p>
            </div>
            {(onEditTherapyPlanSet || memberId) && (
              <button
                type="button"
                onClick={handleEditTherapyPlan}
                style={{
                  marginLeft: 'auto',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(251,191,36,0.45)',
                  background: 'rgba(251,191,36,0.18)',
                  color: '#fbbf24',
                  fontSize: '12px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                Edit Therapy Plan
              </button>
            )}
          </div>
        </div>
      )}

      {/* Therapy Plan Reference Section */}
      {therapyPlan && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: 'rgba(59,130,246,0.08)',
          border: '2px solid rgba(59,130,246,0.3)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: showPlanDetails ? '16px' : '0',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => setShowPlanDetails(!showPlanDetails)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>📋</span>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#60a5fa', marginBottom: '2px' }}>
                  Rencana Terapi (Set: {therapyPlan.setName || 'N/A'})
                </h4>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Terapi #{therapyPlan.planNumber || '-'} • Versi {therapyPlan.setVersion || '1'} • {therapyPlan.setStatus || 'ACTIVE'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(onEditTherapyPlanSet || memberId) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditTherapyPlan();
                  }}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(251,191,36,0.15)',
                    border: '1px solid rgba(251,191,36,0.4)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fbbf24',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(251,191,36,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(251,191,36,0.15)';
                  }}
                >
                  Edit Therapy Plan
                </button>
              )}
              <span style={{ 
                fontSize: '18px', 
                color: '#60a5fa',
                transform: showPlanDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                display: 'inline-block'
              }}>
                ▼
              </span>
            </div>
          </div>

          {showPlanDetails && (
            <>
              {setPlansError && (
                <div style={{
                  padding: '12px',
                  marginBottom: '12px',
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid rgba(251,191,36,0.28)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fbbf24',
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  {setPlansError}
                </div>
              )}

              <TherapyPlanSelectedSetTable
                plans={displaySetPlans}
                selectedPlanId={therapyPlan.id}
                loading={loadingSetPlans}
              />

              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 'var(--radius-md)',
              }}>
                <p style={{ fontSize: '12px', color: '#60a5fa', lineHeight: '1.6' }}>
                  <strong>Petunjuk:</strong> Gunakan baris terapi yang ditandai sebagai acuan infus aktual. Jika dosis aktual berbeda, edit therapy plan terlebih dahulu agar rencana dan aktual sama.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* IFA Selection - Mutually Exclusive */}
        <div style={{ 
          marginBottom: '24px',
          padding: '16px',
          background: 'rgba(34,197,94,0.1)',
          borderRadius: 'var(--radius-md)',
          border: '2px solid rgba(34,197,94,0.3)'
        }}>
          <p style={{ 
            margin: '0 0 12px 0', 
            fontSize: '13px', 
            color: '#4ade80',
            fontWeight: '700'
          }}>
            🧪 IFA (Infus) - Pilih salah satu <span style={{ color: '#ef4444' }}>*</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* IFA 250ml Option */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '12px 16px',
              background: formData.ifa250 && formData.ifa250 > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
              borderRadius: 'var(--radius-md)',
              border: formData.ifa250 && formData.ifa250 > 0 ? '2px solid #4ade80' : '1px solid rgba(148,163,184,0.3)',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="ifaTypeInfusion"
                checked={formData.ifa250 !== undefined && formData.ifa250 > 0}
                onChange={() => setFormData({ ...formData, ifa250: 1, ifa500: undefined })}
                style={{ width: '18px', height: '18px', accentColor: '#4ade80' }}
                disabled={loading}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#4ade80' }}>
                  IFA + NO 2,5ml ⭐
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Default - Wajib 1 botol per terapi
                  {therapyPlan?.ifa250 && <span style={{ marginLeft: '8px', color: '#60a5fa' }}>(Rencana: {Number(therapyPlan.ifa250)} Botol)</span>}
                </span>
              </div>
              {formData.ifa250 && formData.ifa250 > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={formData.ifa250}
                    onChange={(e) => setFormData({ ...formData, ifa250: parseInt(e.target.value) || 1, ifa500: undefined })}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '70px',
                      padding: '8px',
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(148,163,184,0.3)',
                      borderRadius: 'var(--radius-md)',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}
                    disabled={loading}
                  />
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Botol</span>
                </div>
              )}
            </label>

            {/* IFA 500ml Option */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '12px 16px',
              background: formData.ifa500 && formData.ifa500 > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
              borderRadius: 'var(--radius-md)',
              border: formData.ifa500 && formData.ifa500 > 0 ? '2px solid #fbbf24' : '1px solid rgba(148,163,184,0.3)',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="ifaTypeInfusion"
                checked={formData.ifa500 !== undefined && formData.ifa500 > 0}
                onChange={() => setFormData({ ...formData, ifa250: undefined, ifa500: 1 })}
                style={{ width: '18px', height: '18px', accentColor: '#fbbf24' }}
                disabled={loading}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>
                  IFA 500ml (Alternatif)
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Special case - Pengganti IFA + NO 2,5ml
                  {therapyPlan?.ifa500 && <span style={{ marginLeft: '8px', color: '#60a5fa' }}>(Rencana: {Number(therapyPlan.ifa500)} Botol)</span>}
                </span>
              </div>
              {formData.ifa500 && formData.ifa500 > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={formData.ifa500}
                    onChange={(e) => setFormData({ ...formData, ifa250: undefined, ifa500: parseInt(e.target.value) || 1 })}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '70px',
                      padding: '8px',
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(148,163,184,0.3)',
                      borderRadius: 'var(--radius-md)',
                      color: '#f1f5f9',
                      fontSize: '14px',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}
                    disabled={loading}
                  />
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Botol</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Other Dose Input Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {DOSE_FIELDS.map((field) => {
            const rawPlanValue = therapyPlan?.[field.key as keyof TherapyPlan];
            const planValue = therapyPlan ? getPlannedActualDose(field.key, therapyPlan, formData) : 0;
            const noInIfaAmount = field.key === 'no' && therapyPlan ? getNoInIfaAmount(therapyPlan, formData.ifa250) : 0;
            const rawNoPlanValue = field.key === 'no' ? toPositiveNumber(rawPlanValue) : 0;
            const actualValue = formData[field.key as keyof CreateInfusionInput];
            const isDifferent = hasDoseDeviation(planValue, actualValue);
            const hasPlanValue = planValue > 0 || toPositiveNumber(rawPlanValue) > 0;

            return (
              <div key={field.key} style={{
                padding: '16px',
                background: isDifferent ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.08)',
                border: isDifferent ? '2px solid rgba(251,191,36,0.3)' : '1px solid rgba(148,163,184,0.2)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#cbd5e1' }}>
                    {field.label}
                  </label>
                  {hasPlanValue && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>
                      Rencana: {formatDoseValue(planValue)}
                      {field.key === 'no' && noInIfaAmount > 0 && rawNoPlanValue > 0 && (
                        <span style={{ display: 'block', marginTop: '2px', color: '#60a5fa' }}>
                          TP {formatDoseValue(rawNoPlanValue)} - IFA {formatDoseValue(noInIfaAmount)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    value={actualValue || ''}
                    onChange={(e) => updateDose(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 48px 12px 12px',
                      background: 'rgba(15,23,42,0.5)',
                      border: isDifferent ? '2px solid #fbbf24' : '1px solid rgba(148,163,184,0.3)',
                      borderRadius: 'var(--radius-md)',
                      color: '#f1f5f9',
                      fontSize: '16px',
                      fontWeight: '600',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    placeholder="0"
                    disabled={loading}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#60a5fa';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDifferent ? '#fbbf24' : 'rgba(148,163,184,0.3)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#94a3b8',
                    pointerEvents: 'none'
                  }}>
                    {field.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
          <button
            type="submit"
            disabled={loading || hasDeviation}
            style={{
              padding: '12px 24px',
              background: 'rgba(148,163,184,0.2)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading || hasDeviation ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Menyimpan...' : '💾 Simpan'}
          </button>
          {onNext && (
            <button
              type="submit"
              disabled={loading || hasDeviation}
              onClick={() => setShouldNavigateNext(true)}
              style={{
                padding: '12px 32px',
                background: loading || hasDeviation 
                  ? 'rgba(34,197,94,0.3)' 
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading || hasDeviation ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading || hasDeviation 
                  ? 'none' 
                  : '0 4px 12px rgba(34,197,94,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                if (!loading && !hasDeviation) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(34,197,94,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = loading || hasDeviation 
                  ? 'none' 
                  : '0 4px 12px rgba(34,197,94,0.3)';
              }}
            >
              {loading ? '⏳ Menyimpan...' : 'Simpan & Lanjut →'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function TherapyPlanSelectedSetTable({
  plans,
  selectedPlanId,
  loading,
}: {
  plans: TherapyPlanSetRow[];
  selectedPlanId: string;
  loading: boolean;
}) {
  const extraColumns = getExtraSubstanceColumns(plans);
  const visibleDoseColumns = SET_DOSE_COLUMNS.filter((column) => {
    return plans.some((plan) => getColumnValue(plan, column) > 0);
  });
  const visibleExtraColumns = extraColumns.filter((column) => {
    return plans.some((plan) => getExtraSubstanceValue(plan, column) > 0);
  });
  const allDoseColumns = [...visibleDoseColumns, ...visibleExtraColumns];

  if (loading && plans.length === 0) {
    return (
      <div style={{
        padding: '18px',
        border: '1px solid rgba(59,130,246,0.22)',
        borderRadius: '8px',
        background: 'rgba(59,130,246,0.04)',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        fontWeight: 700,
      }}>
        Memuat set therapy plan...
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div style={{
        padding: '18px',
        border: '1px solid rgba(59,130,246,0.22)',
        borderRadius: '8px',
        background: 'rgba(59,130,246,0.04)',
        color: 'var(--text-secondary)',
        fontSize: '13px',
      }}>
        Belum ada set therapy plan yang bisa ditampilkan.
      </div>
    );
  }

  return (
    <div
      style={{
        overflow: 'hidden',
        borderRadius: '8px',
        border: '1px solid rgba(59,130,246,0.22)',
        background: 'rgba(59,130,246,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 14px',
          borderBottom: '1px solid rgba(59,130,246,0.18)',
          background: 'rgba(59,130,246,0.08)',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            color: '#60a5fa',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          Satu Set Therapy Plan yang Dipilih
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {plans.length} terapi
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: `${360 + Math.max(allDoseColumns.length, 1) * 92}px`,
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <th style={{ ...setTableHeaderStyle(), width: '140px', textAlign: 'left' }}>Terapi</th>
              <th style={{ ...setTableHeaderStyle(), width: '220px', textAlign: 'left' }}>Keterangan</th>
              {allDoseColumns.map((column) => (
                <th key={column.label} style={{ ...setTableHeaderStyle(), textAlign: 'right' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, index) => {
              const isSelected = plan.id === selectedPlanId;
              const planNumber = plan.planNumber || index + 1;

              return (
                <tr
                  key={plan.id}
                  style={{
                    background: isSelected
                      ? 'rgba(59,130,246,0.18)'
                      : index % 2 === 0
                        ? 'rgba(255,255,255,0.025)'
                        : 'transparent',
                  }}
                >
                  <td style={setTableCellStyle(isSelected)}>
                    <div style={{ fontWeight: 800, color: isSelected ? '#93c5fd' : 'var(--text-primary)' }}>
                      Terapi #{planNumber}
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          display: 'inline-flex',
                          marginTop: '5px',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          background: 'rgba(59,130,246,0.18)',
                          border: '1px solid rgba(96,165,250,0.32)',
                          color: '#93c5fd',
                          fontSize: '10px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}
                      >
                        Dipilih
                      </span>
                    )}
                  </td>
                  <td style={setTableCellStyle(isSelected)}>
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: plan.keterangan ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                      title={plan.keterangan || undefined}
                    >
                      {plan.keterangan || '-'}
                    </div>
                  </td>
                  {visibleDoseColumns.map((column) => (
                    <td key={column.key} style={{ ...setTableCellStyle(isSelected), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDoseValue(getColumnValue(plan, column))}
                    </td>
                  ))}
                  {visibleExtraColumns.map((column) => (
                    <td key={column.id} style={{ ...setTableCellStyle(isSelected), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDoseValue(getExtraSubstanceValue(plan, column))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function setTableHeaderStyle() {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(148,163,184,0.18)',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    whiteSpace: 'nowrap' as const,
  };
}

function setTableCellStyle(isSelected: boolean) {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(148,163,184,0.13)',
    color: isSelected ? '#dbeafe' : 'var(--text-primary)',
    fontSize: '13px',
    verticalAlign: 'middle' as const,
  };
}
