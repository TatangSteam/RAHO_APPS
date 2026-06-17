'use client';

import { ExternalLink, Pencil } from 'lucide-react';
import type { TherapyPlan } from '@/lib/therapyPlanApi';
import type { TherapyPlanSubstance } from '@/lib/therapyPlanSubstances';

interface TherapyPlanListTableProps {
  plans: TherapyPlan[];
  onEdit: (plan: TherapyPlan) => void;
  onOpenSession: (sessionId: string) => void;
}

type NumericTherapyPlanKey =
  | 'ifa250'
  | 'ifa500'
  | 'hho'
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

interface DoseColumn {
  key: NumericTherapyPlanKey;
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

const DOSE_COLUMNS: DoseColumn[] = [
  { key: 'ifa250', label: 'IFA+NO' },
  { key: 'ifa500', label: 'IFA 500' },
  { key: 'hho', label: 'HHO ml', aliases: ['hho', 'nb hho'], mergeIfaSubstances: true },
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
  DOSE_COLUMNS.flatMap((column) => column.aliases || []).map(normalizeName)
);

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function toNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function getIfaSubstanceTotal(
  substances: TherapyPlanSubstance[] | null | undefined,
  aliases: string[]
): number {
  const normalizedAliases = new Set(aliases.map(normalizeName));

  return (substances || []).reduce((total, substance) => {
    if (!normalizedAliases.has(normalizeName(substance.name))) return total;
    if ((substance.unit || 'ml').toLowerCase() !== 'ml') return total;
    return total + toNumber(substance.amount);
  }, 0);
}

function getColumnValue(plan: TherapyPlan, column: DoseColumn): number {
  const baseValue = toNumber(plan[column.key]);
  if (!column.mergeIfaSubstances || !column.aliases) return baseValue;
  return baseValue + getIfaSubstanceTotal(plan.ifaSubstances, column.aliases);
}

function getExtraSubstanceColumns(plans: TherapyPlan[]): ExtraSubstanceColumn[] {
  const columns = new Map<string, ExtraSubstanceColumn>();

  plans.forEach((plan) => {
    (plan.ifaSubstances || []).forEach((substance) => {
      const normalizedName = normalizeName(substance.name);
      if (!normalizedName || KNOWN_IFA_ALIASES.has(normalizedName)) return;

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

function getExtraSubstanceValue(plan: TherapyPlan, column: ExtraSubstanceColumn): number {
  return (plan.ifaSubstances || []).reduce((total, substance) => {
    if (normalizeName(substance.name) !== column.normalizedName) return total;
    if ((substance.unit || 'ml').toLowerCase() !== column.unit.toLowerCase()) return total;
    return total + toNumber(substance.amount);
  }, 0);
}

function isTherapyPlanEditHistory(plan: TherapyPlan): boolean {
  return Boolean(plan.supersededById || plan.supersededAt);
}

function getPlanStatus(plan: TherapyPlan): { label: string; color: string; background: string; border: string } {
  if (isTherapyPlanEditHistory(plan)) {
    return {
      label: 'History Edit',
      color: '#94a3b8',
      background: 'rgba(148,163,184,0.12)',
      border: 'rgba(148,163,184,0.24)',
    };
  }

  if (plan.isUsed) {
    return {
      label: 'Sudah Digunakan',
      color: '#22c55e',
      background: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.28)',
    };
  }

  return {
    label: 'Belum Digunakan',
    color: '#f59e0b',
    background: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.28)',
  };
}

export default function TherapyPlanListTable({
  plans,
  onEdit,
  onOpenSession,
}: TherapyPlanListTableProps) {
  const extraColumns = getExtraSubstanceColumns(plans);
  const allDoseColumns = [...DOSE_COLUMNS, ...extraColumns];

  return (
    <div
      style={{
        border: '1px solid rgba(148,163,184,0.22)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--surface-card)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: `${760 + allDoseColumns.length * 92}px`,
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr style={{ background: 'rgba(148,163,184,0.08)' }}>
              {['Kode Plan', 'Tanggal', 'Infus Ke', ...allDoseColumns.map((column) => column.label), 'Keterangan', 'Status', 'Aksi'].map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  style={{
                    width:
                      header === 'Kode Plan'
                        ? '210px'
                        : header === 'Keterangan'
                          ? '220px'
                          : header === 'Status'
                            ? '150px'
                            : header === 'Aksi'
                              ? '112px'
                              : '92px',
                    padding: '11px 12px',
                    textAlign: allDoseColumns.some((column) => column.label === header) ? 'right' : 'left',
                    borderBottom: '1px solid rgba(148,163,184,0.22)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, rowIndex) => {
              const status = getPlanStatus(plan);
              const date = plan.usedInSession?.treatmentDate || plan.createdAt;
              const infusKe = plan.usedInSession?.totalSessionsCount ?? '-';

              return (
                <tr
                  key={plan.id}
                  style={{
                    background: rowIndex % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                  }}
                >
                  <td style={cellStyle({ sticky: true })}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {plan.planCode}
                    </div>
                    {plan.version && plan.version > 1 && (
                      <div style={{ marginTop: '3px', color: '#60a5fa', fontSize: '11px', fontWeight: 700 }}>
                        v{plan.version}
                      </div>
                    )}
                  </td>
                  <td style={cellStyle()}>{formatDate(date)}</td>
                  <td style={{ ...cellStyle(), textAlign: 'center' }}>{infusKe}</td>
                  {DOSE_COLUMNS.map((column) => {
                    const value = getColumnValue(plan, column);
                    const ifaAddition = column.mergeIfaSubstances && column.aliases
                      ? getIfaSubstanceTotal(plan.ifaSubstances, column.aliases)
                      : 0;

                    return (
                      <td
                        key={column.key}
                        style={{ ...cellStyle(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                        title={ifaAddition > 0 ? `Termasuk zat IFA ${formatNumber(ifaAddition)}` : undefined}
                      >
                        {formatNumber(value)}
                      </td>
                    );
                  })}
                  {extraColumns.map((column) => (
                    <td
                      key={column.id}
                      style={{ ...cellStyle(), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatNumber(getExtraSubstanceValue(plan, column))}
                    </td>
                  ))}
                  <td style={cellStyle()}>
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={plan.keterangan || undefined}
                    >
                      {plan.keterangan || '-'}
                    </div>
                  </td>
                  <td style={cellStyle()}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '5px 9px',
                        borderRadius: '8px',
                        background: status.background,
                        border: `1px solid ${status.border}`,
                        color: status.color,
                        fontSize: '11px',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td style={cellStyle()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {!plan.isUsed && !isTherapyPlanEditHistory(plan) && (
                        <button
                          type="button"
                          onClick={() => onEdit(plan)}
                          title="Edit therapy plan"
                          style={iconButtonStyle('#60a5fa', 'rgba(59,130,246,0.12)', 'rgba(59,130,246,0.28)')}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {plan.usedInSession && (
                        <button
                          type="button"
                          onClick={() => onOpenSession(plan.usedInSession!.id)}
                          title="Lihat sesi"
                          style={iconButtonStyle('#22c55e', 'rgba(34,197,94,0.12)', 'rgba(34,197,94,0.28)')}
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cellStyle({ sticky = false }: { sticky?: boolean } = {}): React.CSSProperties {
  return {
    position: sticky ? 'sticky' : undefined,
    left: sticky ? 0 : undefined,
    zIndex: sticky ? 1 : undefined,
    background: sticky ? 'var(--surface-card)' : undefined,
    padding: '10px 12px',
    borderBottom: '1px solid rgba(148,163,184,0.16)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    verticalAlign: 'middle',
  };
}

function iconButtonStyle(color: string, background: string, border: string): React.CSSProperties {
  return {
    width: '30px',
    height: '30px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: `1px solid ${border}`,
    background,
    color,
    cursor: 'pointer',
  };
}
