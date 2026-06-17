'use client';

import { useState } from 'react';
import { sessionApi } from '@/lib/sessionApi';
import type { TherapyPlan, CreateTherapyPlanInput } from '@/types/session';
import { devError } from '@/lib/logger';
import TherapyPlanDoseTable from '@/components/therapy-plan/TherapyPlanDoseTable';
import TherapyPlanSubstancesEditor from '@/components/therapy-plan/TherapyPlanSubstancesEditor';
import {
  calculateIfaSubstanceTotalMl,
  createDefaultIfaSubstances,
  prepareIfaSubstancePayload,
} from '@/lib/therapyPlanSubstances';
import styles from './Step2TherapyPlan.module.css';

interface Step2TherapyPlanProps {
  sessionId: string;
  therapyPlan: TherapyPlan | null;
  isLocked: boolean;
  onComplete: () => void;
}

// IFA fields are handled separately with radio selection
// AUTO-FILL fields (digunakan di infus aktual): NO, GASO (GT), MB, KCL, H2S, O3, O2, EDTA
// MANUAL fields (tidak ada di infus aktual): HHO, H2, JML NB
const AUTO_FILL_FIELDS = [
  { key: 'no', label: 'NO', unit: 'ml', product: 'NB NO' },
  { key: 'gaso', label: 'GASO', unit: 'ml', product: 'GT' },
  { key: 'mb', label: 'MB', unit: 'ml', product: 'Methylene Blue' },
  { key: 'kcl', label: 'KCL', unit: 'ml', product: 'KCL' },
  { key: 'h2s', label: 'H2S', unit: 'ml', product: 'Cairan H2S' },
  { key: 'o3', label: 'O3', unit: 'ml', product: 'Ozone' },
  { key: 'o2', label: 'O2', unit: 'ml', product: 'Oxygen' },
  { key: 'edta', label: 'EDTA', unit: 'ml', product: 'EDTA' },
] as const;

const MANUAL_FIELDS = [
  { key: 'hho', label: 'HHO', unit: 'ml', product: 'NB-HHO' },
  { key: 'h2', label: 'H2', unit: 'ml', product: 'Hydrogen' },
  { key: 'jmlNb', label: 'Jml.NB', unit: 'ml', product: '' },
] as const;

export default function Step2TherapyPlan({
  sessionId,
  therapyPlan,
  isLocked,
  onComplete,
}: Step2TherapyPlanProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateTherapyPlanInput>({
    keterangan: '',
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
    ifaSubstances: createDefaultIfaSubstances(),
    ifaSubstanceTotalMl: 2.5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate IFA is selected (either 250 or 500)
    const hasIfa = (formData.ifa250 && formData.ifa250 > 0) || (formData.ifa500 && formData.ifa500 > 0);
    
    if (!hasIfa) {
      setError('Pilih salah satu tipe IFA (250ml atau 500ml)');
      return;
    }

    // Validate at least one dose field is filled (IFA counts)
    const allDoseFields = [...AUTO_FILL_FIELDS, ...MANUAL_FIELDS];
    const hasAtLeastOneDose = hasIfa || allDoseFields.some((field) => {
      const value = formData[field.key as keyof CreateTherapyPlanInput];
      return value !== undefined && value !== null && Number(value) > 0;
    });

    if (!hasAtLeastOneDose) {
      setError('Minimal satu field dosis harus diisi');
      return;
    }

    setLoading(true);

    try {
      await sessionApi.createTherapyPlan(sessionId, {
        ...formData,
        ...prepareIfaSubstancePayload(formData.ifaSubstances),
      });
      onComplete();
    } catch (err: any) {
      devError('Failed to create therapy plan:', err);
      setError(err.response?.data?.error?.message || 'Gagal menyimpan terapi plan');
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
      <div className={`${styles.container} ${styles.locked}`}>
        <div className={styles.header}>
          <div className={`${styles.stepNumber} ${styles.locked}`}>2</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Step 2: Terapi Plan</h3>
            <p className={styles.subtitle}>Diagnosa harus diisi terlebih dahulu</p>
          </div>
        </div>
      </div>
    );
  }

  if (therapyPlan) {
    return (
      <div className={`${styles.container} ${styles.completed}`}>
        <div className={styles.header}>
          <div className={`${styles.stepNumber} ${styles.completed}`}>✓</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Step 2: Terapi Plan</h3>
            <p className={styles.subtitle}>{therapyPlan.planCode}</p>
          </div>
        </div>

        <div className={styles.completedContent}>
          <TherapyPlanDoseTable plan={therapyPlan} />

          {therapyPlan.keterangan && (
            <div className={styles.keteranganSection}>
              <p className={styles.keteranganLabel}>Keterangan:</p>
              <p className={styles.keteranganValue}>{therapyPlan.keterangan}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={`${styles.stepNumber} ${styles.active}`}>2</div>
        <div className={styles.headerContent}>
          <h3 className={styles.title}>Step 2: Terapi Plan</h3>
          <p className={styles.subtitle}>Isi rencana dosis terapi</p>
        </div>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
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
              background: formData.ifa250 && formData.ifa250 > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              border: formData.ifa250 && formData.ifa250 > 0 ? '2px solid #4ade80' : '1px solid rgba(148,163,184,0.3)',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="ifaType"
                checked={formData.ifa250 !== undefined && formData.ifa250 > 0}
                onChange={() => setFormData({
                  ...formData,
                  ifa250: 1,
                  ifa500: undefined,
                  ifaSubstances: formData.ifaSubstances?.length ? formData.ifaSubstances : createDefaultIfaSubstances(),
                  ifaSubstanceTotalMl: formData.ifaSubstances?.length
                    ? calculateIfaSubstanceTotalMl(formData.ifaSubstances)
                    : 2.5,
                })}
                style={{ width: '18px', height: '18px', accentColor: '#4ade80' }}
                disabled={loading}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#4ade80' }}>
                  IFA + NO 2,5ml ⭐
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Default - Wajib 1 botol per terapi
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
                    className={styles.doseInput}
                    style={{ width: '70px', textAlign: 'center' }}
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
              borderRadius: '8px',
              border: formData.ifa500 && formData.ifa500 > 0 ? '2px solid #fbbf24' : '1px solid rgba(148,163,184,0.3)',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                name="ifaType"
                checked={formData.ifa500 !== undefined && formData.ifa500 > 0}
                onChange={() => setFormData({
                  ...formData,
                  ifa250: undefined,
                  ifa500: 1,
                  ifaSubstances: [],
                  ifaSubstanceTotalMl: 0,
                })}
                style={{ width: '18px', height: '18px', accentColor: '#fbbf24' }}
                disabled={loading}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>
                  IFA 500ml (Alternatif)
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Special case - Pengganti IFA + NO 2,5ml
                </span>
              </div>
              {formData.ifa500 && formData.ifa500 > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={formData.ifa500}
                    onChange={(e) => setFormData({
                      ...formData,
                      ifa250: undefined,
                      ifa500: parseInt(e.target.value) || 1,
                      ifaSubstances: [],
                      ifaSubstanceTotalMl: 0,
                    })}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.doseInput}
                    style={{ width: '70px', textAlign: 'center' }}
                    disabled={loading}
                  />
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Botol</span>
                </div>
              )}
            </label>
          </div>
        </div>

        <TherapyPlanSubstancesEditor
          value={formData.ifaSubstances}
          disabled={loading}
          onChange={(ifaSubstances) =>
            setFormData({
              ...formData,
              ifaSubstances,
              ifaSubstanceTotalMl: calculateIfaSubstanceTotalMl(ifaSubstances),
            })
          }
        />

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
            🔄 Auto-Fill (Ada Booster Package)
          </p>
          <div className={styles.doseGrid}>
            {AUTO_FILL_FIELDS.map((field) => (
              <div key={field.key} className={styles.doseField}>
                <label className={styles.doseLabel} style={{ color: '#60a5fa' }}>
                  {field.label} <span style={{ fontSize: '10px', color: '#94a3b8' }}>({field.product})</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData[field.key] || ''}
                  onChange={(e) => updateDose(field.key, e.target.value)}
                  className={styles.doseInput}
                  style={{ borderColor: 'rgba(59,130,246,0.3)' }}
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        </div>

        {/* MANUAL FIELDS - Tidak Ada Booster Package */}
        <div style={{ 
          marginBottom: '20px',
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
            ✏️ Manual Input (Tidak Ada Booster Package)
          </p>
          <div className={styles.doseGrid}>
            {MANUAL_FIELDS.map((field) => (
              <div key={field.key} className={styles.doseField}>
                <label className={styles.doseLabel} style={{ color: '#94a3b8' }}>
                  {field.label} {field.product && <span style={{ fontSize: '10px', color: '#64748b' }}>({field.product})</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData[field.key] || ''}
                  onChange={(e) => updateDose(field.key, e.target.value)}
                  className={styles.doseInput}
                  placeholder="0"
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Keterangan</label>
          <textarea
            value={formData.keterangan}
            onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
            className={styles.formTextarea}
            placeholder="Catatan tambahan tentang terapi plan..."
            disabled={loading}
          />
        </div>

        <div className={styles.footer}>
          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? 'Menyimpan...' : 'Simpan Terapi Plan'}
          </button>
        </div>
      </form>
    </div>
  );
}
