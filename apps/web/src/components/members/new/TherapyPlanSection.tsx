'use client';

import { useState } from 'react';

type DoseInputValue = number | string | undefined;

export interface TherapyPlanData {
  infusKe: number;
  keterangan?: string;
  ifa250?: DoseInputValue; // IFA + NO 2,5ml (satuan: Botol)
  ifa500?: DoseInputValue; // IFA 500ml (satuan: Botol)
  hho?: DoseInputValue;
  h2?: DoseInputValue;
  no?: DoseInputValue;
  gaso?: DoseInputValue;
  o2?: DoseInputValue;
  o3?: DoseInputValue;
  edta?: DoseInputValue;
  mb?: DoseInputValue;
  h2s?: DoseInputValue;
  kcl?: DoseInputValue;
  jmlNb?: DoseInputValue;
}

interface TherapyPlanSectionProps {
  therapyPlans: TherapyPlanData[];
  onChange: (plans: TherapyPlanData[]) => void;
}

// AUTO-FILL fields (digunakan di infus aktual): NO, GASO (GT), MB, KCL, H2S, O3, O2, EDTA
const AUTO_FILL_FIELDS = [
  { key: 'no', label: 'NO', unit: 'ml', product: 'NB NO' },
  { key: 'gaso', label: 'GASO', unit: 'ml', product: 'GT' },
  { key: 'mb', label: 'MB', unit: 'ml', product: 'Methylene Blue' },
  { key: 'kcl', label: 'KCL', unit: 'ml', product: 'KCL' },
  { key: 'h2s', label: 'H2S', unit: 'ml', product: 'Cairan H2S' },
  { key: 'o3', label: 'O3', unit: 'ml', product: 'Ozone' },
  { key: 'o2', label: 'O2', unit: 'ml', product: 'Oxygen' },
  { key: 'edta', label: 'EDTA', unit: 'ml', product: 'EDTA' },
];

// MANUAL fields (tidak ada di infus aktual): HHO, H2, JML NB
const MANUAL_FIELDS = [
  { key: 'hho', label: 'HHO', unit: 'ml', product: 'NB-HHO' },
  { key: 'h2', label: 'H2', unit: 'ml', product: 'Hydrogen' },
  { key: 'jmlNb', label: 'Jml.NB', unit: 'ml', product: '' },
];

const decimalPattern = /^\d*\.?\d*$/;

const parseDoseInput = (value: DoseInputValue): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function TherapyPlanSection({ therapyPlans, onChange }: TherapyPlanSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(therapyPlans.length > 0 ? 0 : null);

  const handleAddPlan = () => {
    const nextInfusKe = therapyPlans.length > 0 
      ? Math.max(...therapyPlans.map(p => p.infusKe)) + 1 
      : 1;
    
    const newPlan: TherapyPlanData = {
      infusKe: nextInfusKe,
      keterangan: '',
      ifa250: 1, // Default 1 botol IFA + NO 2,5ml
      ifa500: undefined,
      hho: undefined,
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
    };
    
    const newPlans = [...therapyPlans, newPlan];
    onChange(newPlans);
    setExpandedIndex(newPlans.length - 1);
  };

  const handleRemovePlan = (index: number) => {
    const newPlans = therapyPlans.filter((_, i) => i !== index);
    onChange(newPlans);
    if (expandedIndex === index) {
      setExpandedIndex(newPlans.length > 0 ? 0 : null);
    }
  };

  const handleFieldChange = (index: number, field: keyof TherapyPlanData, value: number | string | undefined) => {
    const newPlans = [...therapyPlans];
    newPlans[index] = { ...newPlans[index], [field]: value };
    onChange(newPlans);
  };

  const handleNumberChange = (index: number, field: keyof TherapyPlanData, value: string) => {
    if (!decimalPattern.test(value)) return;
    handleFieldChange(index, field, value === '' ? undefined : value);
  };

  const handleIfaTypeChange = (index: number, type: 'ifa250' | 'ifa500') => {
    const newPlans = [...therapyPlans];
    if (type === 'ifa250') {
      newPlans[index] = { ...newPlans[index], ifa250: 1, ifa500: undefined };
    } else {
      newPlans[index] = { ...newPlans[index], ifa250: undefined, ifa500: 1 };
    }
    onChange(newPlans);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--surface-border)' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '18px'
        }}>
          D
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Rencana Terapi (Opsional)</h2>
        </div>
        <button
          type="button"
          onClick={handleAddPlan}
          className="btn btn-primary btn-sm"
        >
          ➕ Tambah Terapi
        </button>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        💡 Isi rencana terapi untuk member ini. Anda bisa menambahkan rencana untuk infus ke-1, ke-2, ke-3, dst.
      </p>

      {therapyPlans.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'rgba(139,92,246,0.05)',
          borderRadius: 'var(--radius-lg)',
          border: '2px dashed rgba(139,92,246,0.2)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💉</div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Belum ada rencana terapi
          </p>
          <button
            type="button"
            onClick={handleAddPlan}
            className="btn btn-primary"
          >
            ➕ Tambah Rencana Terapi Pertama
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {therapyPlans.map((plan, index) => (
            <div
              key={index}
              style={{
                border: '2px solid var(--surface-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: expandedIndex === index ? 'rgba(139,92,246,0.03)' : 'transparent',
                borderColor: expandedIndex === index ? 'rgba(139,92,246,0.3)' : 'var(--surface-border)'
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  background: expandedIndex === index ? 'rgba(139,92,246,0.08)' : 'rgba(148,163,184,0.03)',
                  borderBottom: expandedIndex === index ? '2px solid rgba(139,92,246,0.2)' : 'none'
                }}
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '16px'
                }}>
                  {plan.infusKe}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                    Terapi Infus Ke-{plan.infusKe}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Klik untuk mengisi detail dosis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePlan(index);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 12px' }}
                >
                  🗑️ Hapus
                </button>
                <span style={{ fontSize: '20px', color: 'var(--text-muted)' }}>
                  {expandedIndex === index ? '▼' : '▶'}
                </span>
              </div>

              {/* Content */}
              {expandedIndex === index && (
                <div style={{ padding: '24px' }}>
                  {/* Keterangan */}
                  <div style={{ marginBottom: '20px' }}>
                    <label className="form-label" style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '700' }}>
                      📝 Keterangan (Opsional)
                    </label>
                    <textarea
                      value={plan.keterangan || ''}
                      onChange={(e) => handleFieldChange(index, 'keterangan', e.target.value)}
                      className="form-input"
                      placeholder="Contoh: Therapy plan untuk sesi pertama, dosis standar..."
                      rows={2}
                      style={{ resize: 'vertical', minHeight: '60px' }}
                    />
                  </div>

                  {/* IFA Selection - Mutually Exclusive */}
                  <div style={{ 
                    marginBottom: '20px',
                    padding: '16px',
                    background: 'rgba(34,197,94,0.1)',
                    borderRadius: '8px',
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
                        background: (parseDoseInput(plan.ifa250) || 0) > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        border: (parseDoseInput(plan.ifa250) || 0) > 0 ? '2px solid #4ade80' : '1px solid rgba(148,163,184,0.3)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name={`ifaType-${index}`}
                          checked={(parseDoseInput(plan.ifa250) || 0) > 0}
                          onChange={() => handleIfaTypeChange(index, 'ifa250')}
                          style={{ width: '18px', height: '18px', accentColor: '#4ade80' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#4ade80' }}>
                            IFA + NO 2,5ml ⭐
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Default - Wajib 1 botol per terapi
                          </span>
                        </div>
                        {(parseDoseInput(plan.ifa250) || 0) > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              min="1"
                              value={plan.ifa250 ?? ''}
                              onChange={(e) => handleNumberChange(index, 'ifa250', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="form-input"
                              style={{ width: '70px', textAlign: 'center', padding: '8px' }}
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
                        background: (parseDoseInput(plan.ifa500) || 0) > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        border: (parseDoseInput(plan.ifa500) || 0) > 0 ? '2px solid #fbbf24' : '1px solid rgba(148,163,184,0.3)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name={`ifaType-${index}`}
                          checked={(parseDoseInput(plan.ifa500) || 0) > 0}
                          onChange={() => handleIfaTypeChange(index, 'ifa500')}
                          style={{ width: '18px', height: '18px', accentColor: '#fbbf24' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>
                            IFA 500ml (Alternatif)
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Special case - Pengganti IFA + NO 2,5ml
                          </span>
                        </div>
                        {(parseDoseInput(plan.ifa500) || 0) > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              min="1"
                              value={plan.ifa500 ?? ''}
                              onChange={(e) => handleNumberChange(index, 'ifa500', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="form-input"
                              style={{ width: '70px', textAlign: 'center', padding: '8px' }}
                            />
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Botol</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* AUTO-FILL FIELDS - Ada Booster Package */}
                  <div style={{ 
                    marginBottom: '20px',
                    padding: '16px',
                    background: 'rgba(59,130,246,0.08)',
                    borderRadius: '8px',
                    border: '1px solid rgba(59,130,246,0.2)'
                  }}>
                    <p style={{ 
                      margin: '0 0 12px 0', 
                      fontSize: '13px', 
                      color: '#60a5fa',
                      fontWeight: '700'
                    }}>
                      🔄 Auto-Fill (Digunakan di Infus Aktual)
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      {AUTO_FILL_FIELDS.map(({ key, label, product }) => (
                        <div key={key}>
                          <label className="form-label" style={{ fontSize: '13px', color: '#60a5fa' }}>
                            {label} <span style={{ fontSize: '10px', color: '#94a3b8' }}>({product})</span>
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={plan[key as keyof TherapyPlanData] as DoseInputValue ?? ''}
                              onChange={(e) => handleNumberChange(index, key as keyof TherapyPlanData, e.target.value)}
                              className="form-input"
                              placeholder="0.00"
                              style={{ paddingRight: '45px', borderColor: 'rgba(59,130,246,0.3)' }}
                            />
                            <span style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '13px',
                              color: 'var(--text-muted)',
                              fontWeight: '500'
                            }}>ml</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* MANUAL FIELDS - Tidak Ada Booster Package */}
                  <div style={{ 
                    padding: '16px',
                    background: 'rgba(148,163,184,0.08)',
                    borderRadius: '8px',
                    border: '1px solid rgba(148,163,184,0.2)'
                  }}>
                    <p style={{ 
                      margin: '0 0 12px 0', 
                      fontSize: '13px', 
                      color: '#94a3b8',
                      fontWeight: '700'
                    }}>
                      ✏️ Manual Input
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      {MANUAL_FIELDS.map(({ key, label, product }) => (
                        <div key={key}>
                          <label className="form-label" style={{ fontSize: '13px', color: '#94a3b8' }}>
                            {label} {product && <span style={{ fontSize: '10px', color: '#64748b' }}>({product})</span>}
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={plan[key as keyof TherapyPlanData] as DoseInputValue ?? ''}
                              onChange={(e) => handleNumberChange(index, key as keyof TherapyPlanData, e.target.value)}
                              className="form-input"
                              placeholder="0.00"
                              style={{ paddingRight: '45px' }}
                            />
                            <span style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '13px',
                              color: 'var(--text-muted)',
                              fontWeight: '500'
                            }}>ml</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
