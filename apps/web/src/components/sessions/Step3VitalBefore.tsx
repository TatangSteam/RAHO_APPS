'use client';

import { useState, useEffect } from 'react';
import { sessionApi } from '@/lib/sessionApi';
import { useAuthStore } from '@/stores/authStore';
import type { VitalSign, VitalType } from '@/types/session';

interface Step3VitalBeforeProps {
  sessionId: string;
  vitalSigns: VitalSign[];
  isLocked: boolean;
  onComplete: () => void;
}

const VITAL_FIELDS: Array<{ type: VitalType; label: string; unit: string; placeholder: string }> = [
  { type: 'SISTOL', label: 'Sistol', unit: 'mmHg', placeholder: '120' },
  { type: 'DIASTOL', label: 'Diastol', unit: 'mmHg', placeholder: '80' },
  { type: 'HR', label: 'Heart Rate', unit: 'bpm', placeholder: '75' },
  { type: 'SATURASI', label: 'Saturasi O2', unit: '%', placeholder: '98' },
  { type: 'PI', label: 'Perfusion Index', unit: '%', placeholder: '5' },
];

export default function Step3VitalBefore({
  sessionId,
  vitalSigns,
  isLocked,
  onComplete,
}: Step3VitalBeforeProps) {
  const { user } = useAuthStore();
  const [values, setValues] = useState<Record<VitalType, string>>({
    SISTOL: '',
    DIASTOL: '',
    HR: '',
    SATURASI: '',
    PI: '',
  });
  const [saving, setSaving] = useState<Record<VitalType, boolean>>({
    SISTOL: false,
    DIASTOL: false,
    HR: false,
    SATURASI: false,
    PI: false,
  });
  const [saved, setSaved] = useState<Record<VitalType, boolean>>({
    SISTOL: false,
    DIASTOL: false,
    HR: false,
    SATURASI: false,
    PI: false,
  });

  // Load existing vital signs
  useEffect(() => {
    const newValues: Record<VitalType, string> = {
      SISTOL: '',
      DIASTOL: '',
      HR: '',
      SATURASI: '',
      PI: '',
    };
    const newSaved: Record<VitalType, boolean> = {
      SISTOL: false,
      DIASTOL: false,
      HR: false,
      SATURASI: false,
      PI: false,
    };

    vitalSigns.forEach((vital) => {
      newValues[vital.pencatatan] = String(vital.value);
      newSaved[vital.pencatatan] = true;
    });

    setValues(newValues);
    setSaved(newSaved);
  }, [vitalSigns]);

  const handleBlur = async (type: VitalType) => {
    const value = values[type];
    if (!value || value === '') return;

    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) return;

    setSaving({ ...saving, [type]: true });

    try {
      const field = VITAL_FIELDS.find((f) => f.type === type);
      await sessionApi.upsertVitalSign(sessionId, {
        pencatatan: type,
        waktuCatat: 'SEBELUM',
        value: numValue,
        unit: field?.unit,
        recordedBy: user?.userId || '',
      });

      setSaved({ ...saved, [type]: true });
      
      // Check if all fields are saved - but don't auto-complete
      const allSaved = VITAL_FIELDS.every((field) => {
        if (field.type === type) return true;
        return saved[field.type] || values[field.type] === '';
      });

      // Only call onComplete if user explicitly wants to move on
      // Don't auto-complete to prevent unwanted navigation
      if (allSaved) {
        // User can manually click next step when ready
      }
    } catch (err: any) {
      console.error('Failed to save vital sign:', err);
    } finally {
      setSaving({ ...saving, [type]: false });
    }
  };

  const handleChange = (type: VitalType, value: string) => {
    setValues({ ...values, [type]: value });
    setSaved({ ...saved, [type]: false });
  };

  if (isLocked) {
    return (
      <div style={{
        padding: '24px',
        background: 'rgba(148,163,184,0.05)',
        border: '2px solid rgba(148,163,184,0.2)',
        borderRadius: 'var(--radius-lg)',
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
            3
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>
              💉 Tanda Vital SEBELUM
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Therapy plan harus diisi terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allFieldsSaved = VITAL_FIELDS.every((field) => saved[field.type]);

  return (
    <div style={{
      padding: '24px',
      background: allFieldsSaved
        ? 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))'
        : 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
      border: allFieldsSaved
        ? '2px solid rgba(34,197,94,0.3)'
        : '2px solid rgba(59,130,246,0.3)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: allFieldsSaved
            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '20px',
          boxShadow: allFieldsSaved
            ? '0 4px 12px rgba(34,197,94,0.3)'
            : '0 4px 12px rgba(59,130,246,0.3)'
        }}>
          {allFieldsSaved ? '✓' : '3'}
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#f1f5f9' }}>
            💉 Tanda Vital SEBELUM
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Auto-save saat blur (keluar dari field)
          </p>
        </div>
      </div>

      {/* Form Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '16px'
      }}>
        {VITAL_FIELDS.map((field) => (
          <div key={field.type} style={{ position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}>
              {field.label}
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '4px' }}>
                ({field.unit})
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.1"
                value={values[field.type]}
                onChange={(e) => handleChange(field.type, e.target.value)}
                onBlur={() => handleBlur(field.type)}
                placeholder={field.placeholder}
                className="form-input"
                style={{
                  width: '100%',
                  paddingRight: '40px',
                }}
              />
              <div style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
              }}>
                {saving[field.type] && (
                  <div className="spinner" style={{ width: '16px', height: '16px' }} />
                )}
                {!saving[field.type] && saved[field.type] && (
                  <svg style={{ width: '20px', height: '20px', color: '#22c55e' }} fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Success Message */}
      {allFieldsSaved && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <span style={{ fontSize: '14px', color: 'var(--color-success)', fontWeight: '600' }}>
            ✓ Semua tanda vital SEBELUM telah tersimpan
          </span>
          <button
            onClick={onComplete}
            className="btn btn-success btn-sm"
          >
            💾 Simpan
          </button>
        </div>
      )}
    </div>
  );
}
