'use client';

import type { TherapyPlanSubstance } from '@/lib/therapyPlanSubstances';

type TherapyPlanDoseKey =
  | 'ifa250'
  | 'ifa500'
  | 'no'
  | 'gaso'
  | 'mb'
  | 'kcl'
  | 'h2s'
  | 'o3'
  | 'o2'
  | 'edta'
  | 'hho'
  | 'hhoKonsentrat'
  | 'h2'
  | 'jmlNb';

export interface TherapyPlanDoseTablePlan {
  ifa250?: number | null;
  ifa500?: number | null;
  no?: number | null;
  gaso?: number | null;
  mb?: number | null;
  kcl?: number | null;
  h2s?: number | null;
  o3?: number | null;
  o2?: number | null;
  edta?: number | null;
  hho?: number | null;
  hhoKonsentrat?: number | null;
  h2?: number | null;
  jmlNb?: number | null;
  ifaSubstances?: TherapyPlanSubstance[] | null;
}

interface DoseFieldMeta {
  key: TherapyPlanDoseKey;
  label: string;
  unit: string;
  source: string;
  note?: string;
}

interface DoseRow {
  id: string;
  name: string;
  amount: number;
  unit: string;
  source: string;
  note?: string;
  tone: 'ifa' | 'main' | 'manual';
}

interface TherapyPlanDoseTableProps {
  plan: TherapyPlanDoseTablePlan;
  title?: string;
  emptyText?: string;
  compact?: boolean;
  showSourceColumn?: boolean;
  showNoteColumn?: boolean;
  includeDefaultIfaSubstances?: boolean;
}

const DOSE_FIELDS: DoseFieldMeta[] = [
  { key: 'ifa250', label: 'IFA + NO 2,5ml', unit: 'Botol', source: 'IFA', note: 'Infus IFA 250ml' },
  { key: 'ifa500', label: 'IFA 500ml', unit: 'Botol', source: 'IFA', note: 'Alternatif IFA' },
  { key: 'no', label: 'NO', unit: 'ml', source: 'Zat Utama', note: 'NB NO' },
  { key: 'gaso', label: 'GASO', unit: 'ml', source: 'Zat Utama', note: 'GT' },
  { key: 'mb', label: 'MB', unit: 'ml', source: 'Zat Utama', note: 'Methylene Blue' },
  { key: 'kcl', label: 'KCL', unit: 'ml', source: 'Zat Utama' },
  { key: 'h2s', label: 'H2S', unit: 'ml', source: 'Zat Utama', note: 'Cairan H2S' },
  { key: 'o3', label: 'O3', unit: 'ml', source: 'Zat Utama', note: 'Ozone' },
  { key: 'o2', label: 'O2', unit: 'ml', source: 'Zat Utama', note: 'Oxygen' },
  { key: 'edta', label: 'EDTA', unit: 'ml', source: 'Zat Utama' },
  { key: 'hho', label: 'HHO', unit: 'ml', source: 'Manual', note: 'NB-HHO' },
  { key: 'hhoKonsentrat', label: 'HHO Konsentrat', unit: 'ml', source: 'Manual', note: 'HHO Konsentrat' },
  { key: 'h2', label: 'H2', unit: 'ml', source: 'Manual', note: 'Hydrogen' },
  { key: 'jmlNb', label: 'Jml.NB', unit: 'ml', source: 'Manual' },
];

function toNumber(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function normalizeSubstanceName(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isDefaultIfaSubstance(substance: TherapyPlanSubstance): boolean {
  const amount = Number(substance.amount);
  const unit = (substance.unit || 'ml').trim().toLowerCase();

  return (
    (substance.isDefault === true || normalizeSubstanceName(substance.name) === 'no') &&
    unit === 'ml' &&
    Number.isFinite(amount) &&
    Math.abs(amount - 2.5) < 0.001
  );
}

function buildRows(plan: TherapyPlanDoseTablePlan, includeDefaultIfaSubstances: boolean): DoseRow[] {
  const mainRows = DOSE_FIELDS.flatMap((field) => {
    const amount = toNumber(plan[field.key]);
    if (amount === null) return [];

    return [
      {
        id: field.key,
        name: field.label,
        amount,
        unit: field.unit,
        source: field.source,
        note: field.note,
        tone: field.source === 'IFA' ? 'ifa' : field.source === 'Manual' ? 'manual' : 'main',
      } satisfies DoseRow,
    ];
  });

  const ifaSubstanceRows: DoseRow[] = [];

  (plan.ifaSubstances || []).forEach((substance, index) => {
    const amount = toNumber(substance.amount);
    if (amount === null || !substance.name?.trim()) return;
    if (!includeDefaultIfaSubstances && isDefaultIfaSubstance(substance)) return;

    ifaSubstanceRows.push({
      id: `ifa-substance-${index}-${substance.name}`,
      name: substance.name.trim(),
      amount,
      unit: substance.unit || 'ml',
      source: 'Zat IFA',
      note: substance.keterangan,
      tone: 'main',
    });
  });

  return [...mainRows, ...ifaSubstanceRows];
}

function getToneStyle(tone: DoseRow['tone']) {
  if (tone === 'ifa') {
    return {
      color: '#4ade80',
      background: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.28)',
    };
  }

  if (tone === 'manual') {
    return {
      color: '#cbd5e1',
      background: 'rgba(148,163,184,0.12)',
      borderColor: 'rgba(148,163,184,0.22)',
    };
  }

  return {
    color: '#60a5fa',
    background: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.24)',
  };
}

export default function TherapyPlanDoseTable({
  plan,
  title = 'Dosis dan Zat Terapi',
  emptyText = 'Belum ada dosis atau zat tercatat.',
  compact = false,
  showSourceColumn = true,
  showNoteColumn = true,
  includeDefaultIfaSubstances = true,
}: TherapyPlanDoseTableProps) {
  const rows = buildRows(plan, includeDefaultIfaSubstances);
  const columns = [
    { key: 'name', label: 'Zat / Komponen' },
    { key: 'amount', label: 'Jumlah' },
    { key: 'unit', label: 'Satuan' },
    ...(showSourceColumn ? [{ key: 'source', label: 'Sumber' }] : []),
    ...(showNoteColumn ? [{ key: 'note', label: 'Keterangan' }] : []),
  ] as const;

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
          padding: compact ? '10px 12px' : '12px 16px',
          borderBottom: '1px solid rgba(59,130,246,0.18)',
          background: 'rgba(59,130,246,0.08)',
        }}
      >
        <div
          style={{
            fontSize: compact ? '11px' : '12px',
            fontWeight: 700,
            color: '#60a5fa',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {rows.length} item
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth:
                showSourceColumn || showNoteColumn
                  ? compact
                    ? '520px'
                    : '640px'
                  : compact
                  ? '360px'
                  : '420px',
            }}
          >
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    style={{
                      padding: compact ? '9px 10px' : '10px 12px',
                      textAlign: column.key === 'amount' ? 'right' : 'left',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      borderBottom: '1px solid rgba(148,163,184,0.18)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const toneStyle = getToneStyle(row.tone);

                return (
                  <tr key={row.id}>
                    <td
                      style={{
                        padding: compact ? '9px 10px' : '11px 12px',
                        borderBottom: '1px solid rgba(148,163,184,0.12)',
                        color: 'var(--text-primary)',
                        fontSize: compact ? '12px' : '13px',
                        fontWeight: 700,
                      }}
                    >
                      {row.name}
                    </td>
                    <td
                      style={{
                        padding: compact ? '9px 10px' : '11px 12px',
                        borderBottom: '1px solid rgba(148,163,184,0.12)',
                        color: toneStyle.color,
                        fontSize: compact ? '12px' : '14px',
                        fontWeight: 800,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatAmount(row.amount)}
                    </td>
                    <td
                      style={{
                        padding: compact ? '9px 10px' : '11px 12px',
                        borderBottom: '1px solid rgba(148,163,184,0.12)',
                        color: 'var(--text-secondary)',
                        fontSize: compact ? '12px' : '13px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.unit}
                    </td>
                    {showSourceColumn && (
                      <td
                        style={{
                          padding: compact ? '9px 10px' : '11px 12px',
                          borderBottom: '1px solid rgba(148,163,184,0.12)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: `1px solid ${toneStyle.borderColor}`,
                            background: toneStyle.background,
                            color: toneStyle.color,
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {row.source}
                        </span>
                      </td>
                    )}
                    {showNoteColumn && (
                      <td
                        style={{
                          padding: compact ? '9px 10px' : '11px 12px',
                          borderBottom: '1px solid rgba(148,163,184,0.12)',
                          color: 'var(--text-secondary)',
                          fontSize: compact ? '12px' : '13px',
                          minWidth: '180px',
                        }}
                      >
                        {row.note || '-'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
