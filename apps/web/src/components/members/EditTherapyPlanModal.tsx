'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { therapyPlanApi, TherapyPlan } from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';

interface EditTherapyPlanModalProps {
  therapyPlan: TherapyPlan;
  memberId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditFormData {
  keterangan?: string;
  ifa250?: number | null;
  ifa500?: number | null;
  hho?: number | null;
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
}

export default function EditTherapyPlanModal({
  therapyPlan,
  memberId,
  onClose,
  onSuccess,
}: EditTherapyPlanModalProps) {
  const [formData, setFormData] = useState<EditFormData>({
    keterangan: therapyPlan.keterangan || '',
    ifa250: therapyPlan.ifa250 ? Number(therapyPlan.ifa250) : null,
    ifa500: therapyPlan.ifa500 ? Number(therapyPlan.ifa500) : null,
    hho: therapyPlan.hho ? Number(therapyPlan.hho) : null,
    h2: therapyPlan.h2 ? Number(therapyPlan.h2) : null,
    no: therapyPlan.no ? Number(therapyPlan.no) : null,
    gaso: therapyPlan.gaso ? Number(therapyPlan.gaso) : null,
    o2: therapyPlan.o2 ? Number(therapyPlan.o2) : null,
    o3: therapyPlan.o3 ? Number(therapyPlan.o3) : null,
    edta: therapyPlan.edta ? Number(therapyPlan.edta) : null,
    mb: therapyPlan.mb ? Number(therapyPlan.mb) : null,
    h2s: therapyPlan.h2s ? Number(therapyPlan.h2s) : null,
    kcl: therapyPlan.kcl ? Number(therapyPlan.kcl) : null,
    jmlNb: therapyPlan.jmlNb ? Number(therapyPlan.jmlNb) : null,
  });
  const [ifaType, setIfaType] = useState<'250' | '500' | null>(
    therapyPlan.ifa250 ? '250' : therapyPlan.ifa500 ? '500' : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    if (field === 'keterangan') {
      setFormData({ ...formData, [field]: value });
    } else {
      const numValue = value === '' ? null : parseFloat(value);
      setFormData({ ...formData, [field]: numValue });
    }
  };

  const handleIfaChange = (type: '250' | '500') => {
    if (ifaType === type) {
      // Deselect
      setIfaType(null);
      setFormData({ ...formData, ifa250: null, ifa500: null });
    } else {
      // Select and clear the other
      setIfaType(type);
      if (type === '250') {
        setFormData({ ...formData, ifa250: 1, ifa500: null });
      } else {
        setFormData({ ...formData, ifa250: null, ifa500: 1 });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one dose field
    const hasDose = Object.entries(formData).some(
      ([key, value]) => key !== 'keterangan' && value && value > 0
    );

    if (!hasDose) {
      showToast.error('Minimal satu field dosis harus diisi');
      return;
    }

    try {
      setSubmitting(true);
      const result = await therapyPlanApi.editTherapyPlan(memberId, therapyPlan.id, formData);
      showToast.success(result.message || 'Therapy plan berhasil diedit!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Edit therapy plan error:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengedit therapy plan');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 9998,
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: 'var(--card-background)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(168,85,247,0.1))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>
                  ✏️ Edit Therapy Plan
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                  Mengedit akan membuat versi baru, versi lama tetap tersimpan
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#ef4444',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                ✕ Tutup
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '24px' }}>
              {/* Original Plan Info */}
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(148,163,184,0.1)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '24px',
                  border: '1px solid rgba(148,163,184,0.2)',
                }}
              >
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0', fontWeight: '600' }}>
                  📋 Plan Code: <span style={{ color: 'var(--color-primary-400)' }}>{therapyPlan.planCode}</span>
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  Versi sekarang: <strong>{therapyPlan.version || 1}</strong> → Versi baru: <strong>{(therapyPlan.version || 1) + 1}</strong>
                </p>
              </div>

              {/* Keterangan */}
              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                  📝 Keterangan (Opsional)
                </label>
                <textarea
                  className="form-input"
                  value={formData.keterangan || ''}
                  onChange={(e) => handleInputChange('keterangan', e.target.value)}
                  placeholder="Contoh: Therapy plan untuk sesi pertama..."
                  rows={3}
                  style={{ resize: 'vertical', fontSize: '14px' }}
                />
              </div>

              {/* IFA Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
                  💉 IFA A + MG (Pilih Salah Satu)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div
                    onClick={() => handleIfaChange('250')}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${ifaType === '250' ? 'var(--color-primary-500)' : 'rgba(148,163,184,0.2)'}`,
                      background: ifaType === '250' ? 'rgba(59,130,246,0.1)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="radio"
                        checked={ifaType === '250'}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>IFA 250ml ⭐</span>
                    </div>
                    {ifaType === '250' && (
                      <input
                        className="form-input"
                        type="number"
                        step="1"
                        min="0"
                        value={formData.ifa250 ?? ''}
                        onChange={(e) => handleInputChange('ifa250', e.target.value)}
                        placeholder="Jumlah botol"
                        style={{ fontSize: '14px' }}
                      />
                    )}
                  </div>

                  <div
                    onClick={() => handleIfaChange('500')}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${ifaType === '500' ? 'var(--color-primary-500)' : 'rgba(148,163,184,0.2)'}`,
                      background: ifaType === '500' ? 'rgba(59,130,246,0.1)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="radio"
                        checked={ifaType === '500'}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>IFA 500ml</span>
                    </div>
                    {ifaType === '500' && (
                      <input
                        className="form-input"
                        type="number"
                        step="1"
                        min="0"
                        value={formData.ifa500 ?? ''}
                        onChange={(e) => handleInputChange('ifa500', e.target.value)}
                        placeholder="Jumlah botol"
                        style={{ fontSize: '14px' }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Other Doses */}
              <div style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
                  💊 Dosis Lainnya
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[
                    { key: 'no', label: 'NO', desc: 'Nitric Oxide' },
                    { key: 'gaso', label: 'GASO' },
                    { key: 'mb', label: 'MB', desc: 'Methylen Blue' },
                    { key: 'kcl', label: 'KCL' },
                    { key: 'h2s', label: 'H2S', desc: 'Cairan H2S' },
                    { key: 'o3', label: 'O3', desc: 'Ozone' },
                    { key: 'o2', label: 'O2', desc: 'Oxygen' },
                    { key: 'edta', label: 'EDTA' },
                    { key: 'hho', label: 'HHO', desc: 'NB-HHO' },
                    { key: 'h2', label: 'H2', desc: 'Hydrogen' },
                    { key: 'jmlNb', label: 'JML NB' },
                  ].map(({ key, label, desc }) => (
                    <div key={key}>
                      <label className="form-label" style={{ fontSize: '12px', fontWeight: '600' }}>
                        {label} {desc && <span style={{ fontSize: '10px', color: '#94a3b8' }}>({desc})</span>}
                      </label>
                      <input
                        className="form-input"
                        type="number"
                        step="0.01"
                        value={formData[key as keyof EditFormData] as number | '' ?? ''}
                        onChange={(e) => handleInputChange(key as keyof EditFormData, e.target.value)}
                        placeholder="0.00"
                        style={{ fontSize: '14px' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}
            >
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ minWidth: '120px' }}>
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{ minWidth: '180px' }}
              >
                {submitting ? '⏳ Menyimpan...' : '✅ Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
