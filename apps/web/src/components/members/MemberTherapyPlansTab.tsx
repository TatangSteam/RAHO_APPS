'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { therapyPlanApi, TherapyPlan, CreateTherapyPlanInput } from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';

interface MemberTherapyPlansTabProps {
  memberId: string;
}

export default function MemberTherapyPlansTab({ memberId }: MemberTherapyPlansTabProps) {
  const router = useRouter();
  const [therapyPlans, setTherapyPlans] = useState<TherapyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTherapyPlans();
  }, [memberId]);

  const loadTherapyPlans = async () => {
    try {
      setLoading(true);
      const data = await therapyPlanApi.getMemberTherapyPlans(memberId);
      setTherapyPlans(data);
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat therapy plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one dose field is filled
    const hasDose = Object.entries(formData).some(
      ([key, value]) => key !== 'keterangan' && value && value > 0
    );

    if (!hasDose) {
      showToast.error('Minimal satu field dosis harus diisi');
      return;
    }

    try {
      setSubmitting(true);
      const result = await therapyPlanApi.createMemberTherapyPlan(memberId, formData);
      showToast.success(result.message);
      setShowForm(false);
      setFormData({
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
      });
      loadTherapyPlans();
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal membuat therapy plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateTherapyPlanInput, value: string) => {
    if (field === 'keterangan') {
      setFormData({ ...formData, [field]: value });
    } else {
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormData({ ...formData, [field]: numValue });
    }
  };

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '64px 24px',
        background: 'rgba(148,163,184,0.05)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div className="spinner" style={{ 
          width: '48px', 
          height: '48px', 
          margin: '0 auto 16px',
          border: '4px solid rgba(59,130,246,0.2)',
          borderTopColor: 'var(--color-primary-500)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Memuat therapy plans...
        </p>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>💊 Therapy Plans</h3>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {showForm ? '✕ Tutup Form' : '➕ Buat Therapy Plan'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ 
          marginBottom: '24px', 
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(168,85,247,0.05))',
          border: '2px solid rgba(59,130,246,0.2)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ 
                fontSize: '13px', 
                fontWeight: '600', 
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                📝 Keterangan (Opsional)
              </label>
              <textarea
                className="form-input"
                value={formData.keterangan}
                onChange={(e) => handleInputChange('keterangan', e.target.value)}
                placeholder="Contoh: Therapy plan untuk sesi pertama, dosis standar..."
                rows={3}
                style={{ 
                  resize: 'vertical',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ 
              marginBottom: '16px',
              padding: '12px 16px',
              background: 'rgba(59,130,246,0.1)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59,130,246,0.2)'
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: '13px', 
                color: 'var(--color-primary-500)',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                💉 Dosis Terapi (Minimal 1 field harus diisi)
              </p>
            </div>

            {/* IFA Section - Mutually Exclusive Selection */}
            <div style={{ 
              marginBottom: '20px',
              padding: '16px',
              background: 'rgba(34,197,94,0.1)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid rgba(34,197,94,0.3)'
            }}>
              <p style={{ 
                margin: '0 0 12px 0', 
                fontSize: '13px', 
                color: '#4ade80',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
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
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="ifaType"
                    checked={formData.ifa250 !== undefined && formData.ifa250 > 0}
                    onChange={() => setFormData({ ...formData, ifa250: 1, ifa500: undefined })}
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
                  {formData.ifa250 && formData.ifa250 > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        className="form-input"
                        type="number"
                        step="1"
                        min="1"
                        value={formData.ifa250}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setFormData({ ...formData, ifa250: val, ifa500: undefined });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: '14px', width: '70px', textAlign: 'center' }}
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
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="radio"
                    name="ifaType"
                    checked={formData.ifa500 !== undefined && formData.ifa500 > 0}
                    onChange={() => setFormData({ ...formData, ifa250: undefined, ifa500: 1 })}
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
                  {formData.ifa500 && formData.ifa500 > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        className="form-input"
                        type="number"
                        step="1"
                        min="1"
                        value={formData.ifa500}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setFormData({ ...formData, ifa250: undefined, ifa500: val });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: '14px', width: '70px', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Botol</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* AUTO-FILL FIELDS - Digunakan di Infus Aktual */}
            <div style={{ 
              marginBottom: '20px',
              padding: '16px',
              background: 'rgba(59,130,246,0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59,130,246,0.2)'
            }}>
              <p style={{ 
                margin: '0 0 12px 0', 
                fontSize: '13px', 
                color: '#60a5fa',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🔄 Auto-Fill (Digunakan di Infus Aktual)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    NO <span style={{ fontSize: '10px', color: '#94a3b8' }}>(NB NO)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.no ?? ''}
                    onChange={(e) => handleInputChange('no', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    GASO <span style={{ fontSize: '10px', color: '#94a3b8' }}>(GT)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.gaso ?? ''}
                    onChange={(e) => handleInputChange('gaso', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    MB <span style={{ fontSize: '10px', color: '#94a3b8' }}>(Methylene Blue)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.mb ?? ''}
                    onChange={(e) => handleInputChange('mb', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    KCL
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.kcl ?? ''}
                    onChange={(e) => handleInputChange('kcl', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    H2S <span style={{ fontSize: '10px', color: '#94a3b8' }}>(Cairan H2S)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.h2s ?? ''}
                    onChange={(e) => handleInputChange('h2s', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    O3 <span style={{ fontSize: '10px', color: '#94a3b8' }}>(Ozone)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.o3 ?? ''}
                    onChange={(e) => handleInputChange('o3', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    O2 <span style={{ fontSize: '10px', color: '#94a3b8' }}>(Oxygen)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.o2 ?? ''}
                    onChange={(e) => handleInputChange('o2', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#60a5fa' }}>
                    EDTA
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.edta ?? ''}
                    onChange={(e) => handleInputChange('edta', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px', borderColor: 'rgba(59,130,246,0.3)' }}
                  />
                </div>
              </div>
            </div>

            {/* MANUAL FIELDS - Tidak Ada di Infus Aktual */}
            <div style={{ 
              marginBottom: '24px',
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(148,163,184,0.2)'
            }}>
              <p style={{ 
                margin: '0 0 12px 0', 
                fontSize: '13px', 
                color: '#94a3b8',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                ✏️ Manual Input
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>
                    HHO <span style={{ fontSize: '10px', color: '#64748b' }}>(NB-HHO)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.hho ?? ''}
                    onChange={(e) => handleInputChange('hho', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>
                    H2 <span style={{ fontSize: '10px', color: '#64748b' }}>(Hydrogen)</span>
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.h2 ?? ''}
                    onChange={(e) => handleInputChange('h2', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>
                    JML NB
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={formData.jmlNb ?? ''}
                    onChange={(e) => handleInputChange('jmlNb', e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '14px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowForm(false)}
                style={{ minWidth: '120px' }}
              >
                Batal
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting}
                style={{ minWidth: '180px' }}
              >
                {submitting ? '⏳ Menyimpan...' : '✅ Simpan Therapy Plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {therapyPlans.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '64px 24px',
          background: 'rgba(148,163,184,0.05)',
          borderRadius: 'var(--radius-lg)',
          border: '2px dashed rgba(148,163,184,0.2)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>💊</div>
          <p style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#e2e8f0', 
            marginBottom: '8px' 
          }}>
            Belum ada therapy plan
          </p>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Klik tombol "Buat Therapy Plan" untuk menambahkan therapy plan baru
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {therapyPlans.map((plan) => (
            <div 
              key={plan.id} 
              className="card" 
              style={{ 
                padding: '24px',
                background: plan.isUsed 
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(16,185,129,0.05))'
                  : 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(245,158,11,0.05))',
                border: plan.isUsed 
                  ? '2px solid rgba(34,197,94,0.2)' 
                  : '2px solid rgba(251,191,36,0.2)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease',
                cursor: 'default'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: '16px' 
              }}>
                <div>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '18px', 
                    fontWeight: '700',
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)'
                  }}>
                    📋 {plan.planCode}
                  </h4>
                  <span 
                    className="badge" 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: plan.isUsed ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)',
                      color: plan.isUsed ? '#4ade80' : '#fbbf24',
                      border: plan.isUsed ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(251,191,36,0.5)'
                    }}
                  >
                    {plan.isUsed ? '✅ Sudah Digunakan' : '🟡 Belum Digunakan'}
                  </span>
                </div>
                <div style={{ 
                  textAlign: 'right',
                  padding: '8px 12px',
                  background: 'rgba(59,130,246,0.15)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(59,130,246,0.3)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#94a3b8',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    fontWeight: '600',
                    letterSpacing: '0.5px'
                  }}>
                    Dibuat
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#60a5fa' }}>
                    📅 {new Date(plan.createdAt).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '2px', color: '#93c5fd', fontWeight: '600' }}>
                    ⏰ {new Date(plan.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              {plan.keterangan && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '14px 18px',
                  background: 'rgba(168,85,247,0.12)',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid rgba(168,85,247,0.3)',
                  borderLeft: '5px solid #a855f7'
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: '#c084fc', 
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    📝 Keterangan / Catatan
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#f1f5f9', 
                    lineHeight: '1.6',
                    fontWeight: '500',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {plan.keterangan}
                  </div>
                </div>
              )}

              <div style={{ 
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'rgba(59,130,246,0.08)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(59,130,246,0.2)'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: 'var(--color-primary-500)', 
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  💉 Dosis Terapi
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                  gap: '10px' 
                }}>
                  {plan.ifa250 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(34,197,94,0.15)',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid rgba(34,197,94,0.4)'
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#4ade80' }}>IFA + NO 2,5ml ⭐</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#4ade80' }}>
                        {plan.ifa250} Botol
                      </span>
                    </div>
                  )}
                  {plan.ifa500 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(251,191,36,0.15)',
                      borderRadius: 'var(--radius-md)',
                      border: '2px solid rgba(251,191,36,0.4)'
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#fbbf24' }}>IFA 500ml</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#fbbf24' }}>
                        {plan.ifa500} Botol
                      </span>
                    </div>
                  )}
                  {plan.hho && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>HHO</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.hho} ml
                      </span>
                    </div>
                  )}
                  {plan.h2 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>H2</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.h2} ml
                      </span>
                    </div>
                  )}
                  {plan.no && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>NO</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.no} ml
                      </span>
                    </div>
                  )}
                  {plan.gaso && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>GASO</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.gaso} ml
                      </span>
                    </div>
                  )}
                  {plan.o2 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>O2</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.o2} ml
                      </span>
                    </div>
                  )}
                  {plan.o3 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>O3</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.o3} ml
                      </span>
                    </div>
                  )}
                  {plan.edta && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>EDTA</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.edta} ml
                      </span>
                    </div>
                  )}
                  {plan.mb && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>MB</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.mb} ml
                      </span>
                    </div>
                  )}
                  {plan.h2s && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>H2S</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.h2s} ml
                      </span>
                    </div>
                  )}
                  {plan.kcl && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>KCL</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.kcl} ml
                      </span>
                    </div>
                  )}
                  {plan.jmlNb && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>JML NB</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {plan.jmlNb} ml
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {plan.isUsed && plan.usedInSession && (
                <div style={{ 
                  padding: '16px',
                  background: 'rgba(34,197,94,0.2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(34,197,94,0.4)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    color: '#16a34a', 
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    🔗 Digunakan di Sesi Terapi
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ 
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(34,197,94,0.3)'
                    }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        Kode Sesi
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', fontFamily: 'monospace' }}>
                        {plan.usedInSession.sessionCode}
                      </div>
                    </div>

                    <div style={{ 
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(34,197,94,0.3)'
                    }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        📅 Tanggal Terapi
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>
                        {new Date(plan.usedInSession.treatmentDate).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </div>

                    <div style={{ 
                      padding: '10px 12px',
                      background: 'rgba(59,130,246,0.2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(59,130,246,0.4)'
                    }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        🌍 Terapi Ke (Total)
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#60a5fa' }}>
                        #{plan.usedInSession.totalSessionsCount}
                      </div>
                    </div>

                    <div style={{ 
                      padding: '10px 12px',
                      background: 'rgba(168,85,247,0.2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(168,85,247,0.4)'
                    }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        📍 Terapi Ke ({plan.usedInSession.branchName})
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#c084fc' }}>
                        #{plan.usedInSession.branchSessionsCount}
                      </div>
                    </div>
                  </div>

                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => router.push(`/sessions/${plan.usedInSession?.id}`)}
                    style={{ 
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    👁️ Lihat Detail Sesi →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .card {
          animation: fadeIn 0.3s ease;
        }

        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
      `}</style>
    </div>
  );
}
