'use client';

import { useState } from 'react';

export interface TherapyPlanData {
  infusKe: number;
  ifa?: number;
  hho?: number;
  h2?: number;
  no?: number;
  gaso?: number;
  o2?: number;
  o3?: number;
  edta?: number;
  mb?: number;
  h2s?: number;
  kcl?: number;
  jmlNb?: number;
  notes?: string;
}

interface TherapyPlanSectionProps {
  therapyPlans: TherapyPlanData[];
  onChange: (plans: TherapyPlanData[]) => void;
}

export default function TherapyPlanSection({ therapyPlans, onChange }: TherapyPlanSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(therapyPlans.length > 0 ? 0 : null);

  const handleAddPlan = () => {
    const nextInfusKe = therapyPlans.length > 0 
      ? Math.max(...therapyPlans.map(p => p.infusKe)) + 1 
      : 1;
    
    const newPlan: TherapyPlanData = {
      infusKe: nextInfusKe,
      ifa: undefined,
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

  const handleFieldChange = (index: number, field: keyof TherapyPlanData, value: number | string) => {
    const newPlans = [...therapyPlans];
    newPlans[index] = { ...newPlans[index], [field]: value };
    onChange(newPlans);
  };

  const handleNumberChange = (index: number, field: keyof TherapyPlanData, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    handleFieldChange(index, field, numValue as number);
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
                  {/* Dosis Infus */}
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      💉 Dosis Infus
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      {[
                        { key: 'ifa', label: 'IFA' },
                        { key: 'hho', label: 'HHO' },
                        { key: 'h2', label: 'H2' },
                        { key: 'no', label: 'NO' },
                        { key: 'gaso', label: 'GASO' },
                        { key: 'o2', label: 'O2' },
                        { key: 'o3', label: 'O3' },
                        { key: 'edta', label: 'EDTA' },
                        { key: 'mb', label: 'MB' },
                        { key: 'h2s', label: 'H2S' },
                        { key: 'kcl', label: 'KCL' },
                        { key: 'jmlNb', label: 'Jml. NB' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="form-label" style={{ fontSize: '13px' }}>{label}</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={plan[key as keyof TherapyPlanData] as number || ''}
                              onChange={(e) => handleNumberChange(index, key as keyof TherapyPlanData, e.target.value)}
                              className="form-input"
                              placeholder="0.0"
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
