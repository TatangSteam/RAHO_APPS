'use client';

import { useState, useEffect } from 'react';
import { sessionApi } from '@/lib/sessionApi';
import type { TherapyPlan, InfusionExecution, CreateInfusionInput } from '@/types/session';

interface Step5InfusionProps {
  sessionId: string;
  therapyPlan: TherapyPlan | null;
  infusion: InfusionExecution | null;
  isLocked: boolean;
  onComplete: () => void;
}

// IFA fields handled separately with radio selection
const DOSE_FIELDS = [
  { key: 'hho', label: 'HHO', unit: 'ml' },
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

export default function Step5Infusion({
  sessionId,
  therapyPlan,
  infusion,
  isLocked,
  onComplete,
}: Step5InfusionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDeviation, setHasDeviation] = useState(false);

  const [formData, setFormData] = useState<CreateInfusionInput>({
    ifa250: 1, // Default 1 botol IFA + NO 2,5ml per terapi (wajib)
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
    deviationNotes: undefined,
    bottleType: undefined,
    jenisCairan: undefined,
    volumeCarrier: undefined,
    jumlahJarum: undefined,
    tanggalProduksi: undefined,
  });

  // Initialize form with therapy plan values
  useEffect(() => {
    if (therapyPlan) {
      setFormData({
        ...formData,
        ifa250: therapyPlan.ifa250 ? Number(therapyPlan.ifa250) : 1,
        ifa500: therapyPlan.ifa500 ? Number(therapyPlan.ifa500) : undefined,
        hho: therapyPlan.hho ? Number(therapyPlan.hho) : undefined,
        h2: therapyPlan.h2 ? Number(therapyPlan.h2) : undefined,
        no: therapyPlan.no ? Number(therapyPlan.no) : undefined,
        gaso: therapyPlan.gaso ? Number(therapyPlan.gaso) : undefined,
        o2: therapyPlan.o2 ? Number(therapyPlan.o2) : undefined,
        o3: therapyPlan.o3 ? Number(therapyPlan.o3) : undefined,
        edta: therapyPlan.edta ? Number(therapyPlan.edta) : undefined,
        mb: therapyPlan.mb ? Number(therapyPlan.mb) : undefined,
        h2s: therapyPlan.h2s ? Number(therapyPlan.h2s) : undefined,
        kcl: therapyPlan.kcl ? Number(therapyPlan.kcl) : undefined,
        jmlNb: therapyPlan.jmlNb ? Number(therapyPlan.jmlNb) : undefined,
      });
    }
  }, [therapyPlan]);

  // Check for deviations (including IFA fields)
  useEffect(() => {
    if (!therapyPlan) return;

    // Check IFA deviations
    const ifaDeviation = 
      (therapyPlan.ifa250 && Number(therapyPlan.ifa250) !== (formData.ifa250 || 0)) ||
      (therapyPlan.ifa500 && Number(therapyPlan.ifa500) !== (formData.ifa500 || 0)) ||
      (!therapyPlan.ifa250 && formData.ifa250 && formData.ifa250 > 0) ||
      (!therapyPlan.ifa500 && formData.ifa500 && formData.ifa500 > 0);

    const otherDeviations = DOSE_FIELDS.some((field) => {
      const planValue = therapyPlan[field.key as keyof TherapyPlan];
      const actualValue = formData[field.key as keyof CreateInfusionInput];

      if (!planValue && !actualValue) return false;
      if (!planValue || !actualValue) return true;

      return Number(planValue) !== Number(actualValue);
    });

    setHasDeviation(ifaDeviation || otherDeviations);
  }, [formData, therapyPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (hasDeviation && !formData.deviationNotes) {
      setError('Catatan deviasi wajib diisi karena ada perbedaan dengan rencana');
      return;
    }

    setLoading(true);

    try {
      await sessionApi.createInfusion(sessionId, formData);
      onComplete();
    } catch (err: any) {
      console.error('Failed to create infusion:', err);
      setError(err.response?.data?.error?.message || 'Gagal menyimpan infus aktual');
    } finally {
      setLoading(false);
    }
  };

  const updateDose = (key: string, value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    setFormData({ ...formData, [key]: numValue });
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
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
                Ada perbedaan antara rencana dan aktual. Catatan deviasi wajib diisi.
              </p>
            </div>
          </div>
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
            const planValue = therapyPlan?.[field.key as keyof TherapyPlan];
            const actualValue = formData[field.key as keyof CreateInfusionInput];
            const isDifferent = planValue && actualValue && Number(planValue) !== Number(actualValue);

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
                  {planValue && (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Rencana: {Number(planValue)}
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

        {/* Deviation Notes */}
        {hasDeviation && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '700',
              color: '#cbd5e1',
              marginBottom: '8px'
            }}>
              Catatan Deviasi (jika ada perbedaan dengan rencana) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={formData.deviationNotes}
              onChange={(e) => setFormData({ ...formData, deviationNotes: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f1f5f9',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                transition: 'all 0.2s'
              }}
              placeholder="Jelaskan alasan perbedaan dosis..."
              disabled={loading}
              onFocus={(e) => {
                e.target.style.borderColor = '#60a5fa';
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(148,163,184,0.3)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        )}

        {/* Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
          <button
            type="submit"
            disabled={loading || (hasDeviation && !formData.deviationNotes)}
            style={{
              padding: '12px 32px',
              background: loading || (hasDeviation && !formData.deviationNotes) 
                ? 'rgba(59,130,246,0.3)' 
                : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading || (hasDeviation && !formData.deviationNotes) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading || (hasDeviation && !formData.deviationNotes) 
                ? 'none' 
                : '0 4px 12px rgba(59,130,246,0.3)'
            }}
            onMouseEnter={(e) => {
              if (!loading && !(hasDeviation && !formData.deviationNotes)) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59,130,246,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = loading || (hasDeviation && !formData.deviationNotes) 
                ? 'none' 
                : '0 4px 12px rgba(59,130,246,0.3)';
            }}
          >
            {loading ? '⏳ Menyimpan...' : '💾 Simpan Infus'}
          </button>
        </div>
      </form>
    </div>
  );
}
