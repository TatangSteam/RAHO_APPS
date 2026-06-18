'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { therapyPlanApi, TherapyPlan, CreateTherapyPlanInput } from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';
import TherapyPlanDoseTable from '@/components/therapy-plan/TherapyPlanDoseTable';
import TherapyPlanListTable from '@/components/therapy-plan/TherapyPlanListTable';
import TherapyPlanSubstancesEditor from '@/components/therapy-plan/TherapyPlanSubstancesEditor';
import {
  calculateIfaSubstanceTotalMl,
  createDefaultIfaSubstances,
  hasAdditionalIfaSubstances,
  prepareIfaSubstancePayload,
} from '@/lib/therapyPlanSubstances';
import BulkTherapyPlanModal from './BulkTherapyPlanModal';
import EditTherapyPlanModal from './EditTherapyPlanModal';

interface MemberTherapyPlansTabProps {
  memberId: string;
}

type TherapyPlanStatusFilter = 'all' | 'available' | 'used' | 'superseded';

interface TherapyPlanFilters {
  search: string;
  status: TherapyPlanStatusFilter;
  dateFrom: string;
  dateTo: string;
  ifaOnly: boolean;
}

const DOSE_KEYS: Array<keyof CreateTherapyPlanInput> = [
  'ifa250',
  'ifa500',
  'hho',
  'h2',
  'no',
  'gaso',
  'o2',
  'o3',
  'edta',
  'mb',
  'h2s',
  'kcl',
  'jmlNb',
];

const createInitialFormData = (): CreateTherapyPlanInput => ({
  keterangan: '',
  ifa250: 1,
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

const createInitialFilters = (): TherapyPlanFilters => ({
  search: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  ifaOnly: false,
});

function getPlanDate(plan: TherapyPlan): Date {
  return new Date(plan.usedInSession?.treatmentDate || plan.createdAt);
}

function getPlanDateKey(plan: TherapyPlan): string {
  const date = getPlanDate(plan);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isTherapyPlanEditHistory(plan: TherapyPlan): boolean {
  return Boolean(plan.supersededById || plan.supersededAt);
}

function getPlanStatusKey(plan: TherapyPlan): Exclude<TherapyPlanStatusFilter, 'all'> {
  if (isTherapyPlanEditHistory(plan)) return 'superseded';
  return plan.isUsed ? 'used' : 'available';
}

function planMatchesFilters(plan: TherapyPlan, filters: TherapyPlanFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  const planDate = getPlanDateKey(plan);
  const substancesText = (plan.ifaSubstances || [])
    .map((substance) => `${substance.name} ${substance.keterangan || ''}`)
    .join(' ');

  const searchableText = [
    plan.planCode,
    plan.keterangan || '',
    plan.usedInSession?.sessionCode || '',
    substancesText,
  ]
    .join(' ')
    .toLowerCase();

  if (search && !searchableText.includes(search)) return false;
  if (filters.status !== 'all' && getPlanStatusKey(plan) !== filters.status) return false;
  if (filters.dateFrom && planDate < filters.dateFrom) return false;
  if (filters.dateTo && planDate > filters.dateTo) return false;
  if (filters.ifaOnly && !hasAdditionalIfaSubstances(plan.ifaSubstances, plan.ifaSubstanceTotalMl)) return false;

  return true;
}

function getTherapyPlanRecommendation(plans: TherapyPlan[], filteredPlans: TherapyPlan[]): string {
  const availableCount = plans.filter((plan) => getPlanStatusKey(plan) === 'available').length;
  const supersededCount = plans.filter((plan) => getPlanStatusKey(plan) === 'superseded').length;
  const ifaSubstanceCount = plans.filter((plan) =>
    hasAdditionalIfaSubstances(plan.ifaSubstances, plan.ifaSubstanceTotalMl)
  ).length;

  if (availableCount > 0) {
    return `Ada ${availableCount} therapy plan belum digunakan. Prioritaskan filter "Belum Digunakan" saat memilih plan untuk sesi baru.`;
  }

  if (supersededCount > 0) {
    return `Ada ${supersededCount} therapy plan history edit. Gunakan filter status untuk menyembunyikan history saat review dosis aktif.`;
  }

  if (ifaSubstanceCount > 0) {
    return `Ada ${ifaSubstanceCount} plan dengan zat IFA tambahan. Di mode tabel, zat dengan nama sama otomatis digabung ke kolom zat utama.`;
  }

  if (filteredPlans.length === 0 && plans.length > 0) {
    return 'Tidak ada data yang cocok dengan filter aktif. Reset filter untuk melihat semua therapy plan.';
  }

  return 'Mode tabel direkomendasikan untuk membandingkan dosis antar sesi; mode kartu tetap cocok untuk membaca catatan detail.';
}

export default function MemberTherapyPlansTab({ memberId }: MemberTherapyPlansTabProps) {
  const router = useRouter();
  const [therapyPlans, setTherapyPlans] = useState<TherapyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TherapyPlan | null>(null);
  const [formData, setFormData] = useState<CreateTherapyPlanInput>(createInitialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [filters, setFilters] = useState<TherapyPlanFilters>(createInitialFilters);

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

  const handleBulkSuccess = () => {
    showToast.success('Therapy plans berhasil dibuat!');
    loadTherapyPlans();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one dose field is filled
    const hasDose = DOSE_KEYS.some((key) => {
      const value = formData[key];
      return typeof value === 'number' && value > 0;
    });

    if (!hasDose) {
      showToast.error('Minimal satu field dosis harus diisi');
      return;
    }

    try {
      setSubmitting(true);
      const result = await therapyPlanApi.createMemberTherapyPlan(memberId, {
        ...formData,
        ...prepareIfaSubstancePayload(formData.ifaSubstances),
      });
      showToast.success(result.message);
      setShowForm(false);
      setFormData(createInitialFormData());
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

  const filteredTherapyPlans = useMemo(() => {
    return therapyPlans.filter((plan) => planMatchesFilters(plan, filters));
  }, [therapyPlans, filters]);

  const recommendation = useMemo(() => {
    return getTherapyPlanRecommendation(therapyPlans, filteredTherapyPlans);
  }, [therapyPlans, filteredTherapyPlans]);

  const hasActiveFilters = Boolean(
    filters.search.trim() ||
    filters.status !== 'all' ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.ifaOnly
  );

  const handleEditPlan = (plan: TherapyPlan) => {
    if (isTherapyPlanEditHistory(plan)) {
      showToast.error('Therapy plan history edit tidak bisa diedit');
      return;
    }

    if (plan.isUsed) {
      showToast.error('Therapy plan yang sudah digunakan tidak bisa diedit');
      return;
    }

    setEditingPlan(plan);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>💊 Therapy Plans</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid rgba(148,163,184,0.24)',
              background: 'rgba(148,163,184,0.08)',
            }}
          >
            {[
              { value: 'table', label: 'Tabel' },
              { value: 'card', label: 'Kartu' },
            ].map((option) => {
              const isActive = viewMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value as 'table' | 'card')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isActive ? 'rgba(245,158,11,0.92)' : 'transparent',
                    color: isActive ? '#111827' : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowBulkModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            📋 Buat Bulk
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowForm(!showForm)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {showForm ? '✕ Tutup Form' : '➕ Buat Therapy Plan'}
          </button>
        </div>
      </div>

      {/* Bulk Creation Modal */}
      {showBulkModal && (
        <BulkTherapyPlanModal
          memberId={memberId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}

      {/* Edit Therapy Plan Modal */}
      {editingPlan && (
        <EditTherapyPlanModal
          therapyPlan={editingPlan}
          memberId={memberId}
          onClose={() => setEditingPlan(null)}
          onSuccess={() => {
            setEditingPlan(null);
            loadTherapyPlans();
          }}
        />
      )}

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
                    checked={(formData.ifa250 ?? 0) > 0}
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
                    checked={(formData.ifa500 ?? 0) > 0}
                    onChange={() => setFormData({
                      ...formData,
                      ifa250: undefined,
                      ifa500: 1,
                      ifaSubstances: [],
                      ifaSubstanceTotalMl: 0,
                    })}
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
                          setFormData({
                            ...formData,
                            ifa250: undefined,
                            ifa500: val,
                            ifaSubstances: [],
                            ifaSubstanceTotalMl: 0,
                          });
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

            <TherapyPlanSubstancesEditor
              value={formData.ifaSubstances}
              disabled={submitting}
              onChange={(ifaSubstances) =>
                setFormData({
                  ...formData,
                  ifaSubstances,
                  ifaSubstanceTotalMl: calculateIfaSubstanceTotalMl(ifaSubstances),
                })
              }
            />

            {/* AUTO-FILL FIELDS - Digunakan di Infus Aktual */}
            <div className="therapy-plan-dose-panel therapy-plan-dose-panel-auto" style={{
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
              <div className="therapy-plan-dose-grid therapy-plan-dose-grid-auto" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
            <div className="therapy-plan-dose-panel therapy-plan-dose-panel-manual" style={{
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
              <div className="therapy-plan-dose-grid therapy-plan-dose-grid-manual" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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
                <div className="therapy-plan-dose-field">
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

            <div className="therapy-plan-form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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

      {therapyPlans.length > 0 && (
        <div
          style={{
            marginBottom: '16px',
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid rgba(148,163,184,0.22)',
            background: 'rgba(148,163,184,0.06)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px',
              alignItems: 'end',
            }}
          >
            <div>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                Cari
              </label>
              <input
                className="form-input"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Kode plan, keterangan, sesi, zat..."
                style={{ fontSize: '13px' }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                Status
              </label>
              <select
                className="form-input"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as TherapyPlanStatusFilter,
                  }))
                }
                style={{ fontSize: '13px' }}
              >
                <option value="all">Semua</option>
                <option value="available">Belum Digunakan</option>
                <option value="used">Sudah Digunakan</option>
                <option value="superseded">History Edit</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                Dari
              </label>
              <input
                className="form-input"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                style={{ fontSize: '13px' }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                Sampai
              </label>
              <input
                className="form-input"
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                style={{ fontSize: '13px' }}
              />
            </div>

            <label
              style={{
                minHeight: '42px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid rgba(20,184,166,0.28)',
                background: filters.ifaOnly ? 'rgba(20,184,166,0.14)' : 'rgba(20,184,166,0.06)',
                color: filters.ifaOnly ? '#5eead4' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={filters.ifaOnly}
                onChange={(event) => setFilters((current) => ({ ...current, ifaOnly: event.target.checked }))}
              />
              Zat Tambahan IFA
            </label>

            <button
              type="button"
              onClick={() => setFilters(createInitialFilters())}
              disabled={!hasActiveFilters}
              style={{
                minHeight: '42px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid rgba(148,163,184,0.24)',
                background: 'rgba(148,163,184,0.08)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
                opacity: hasActiveFilters ? 1 : 0.55,
              }}
            >
              Reset
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(148,163,184,0.16)',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              Menampilkan {filteredTherapyPlans.length} dari {therapyPlans.length} therapy plan
            </div>
            <div style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 700 }}>
              Rekomendasi: {recommendation}
            </div>
          </div>
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
      ) : filteredTherapyPlans.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '42px 24px',
          background: 'rgba(148,163,184,0.05)',
          borderRadius: '8px',
          border: '1px dashed rgba(148,163,184,0.24)'
        }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Tidak ada therapy plan yang cocok
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Ubah filter atau reset untuk melihat semua data.
          </p>
          <button
            type="button"
            onClick={() => setFilters(createInitialFilters())}
            className="btn btn-secondary"
          >
            Reset Filter
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <TherapyPlanListTable
          plans={filteredTherapyPlans}
          onEdit={handleEditPlan}
          onOpenSession={(sessionId) => router.push(`/sessions/${sessionId}`)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTherapyPlans.map((plan) => {
            // Determine card style based on status
            const isHistoryEdit = isTherapyPlanEditHistory(plan);
            const isUsed = plan.isUsed;
            
            let cardBackground, cardBorder;
            if (isHistoryEdit) {
              // Grey for edit history
              cardBackground = 'linear-gradient(135deg, rgba(148,163,184,0.05), rgba(100,116,139,0.05))';
              cardBorder = '2px solid rgba(148,163,184,0.3)';
            } else if (isUsed) {
              // Green for used
              cardBackground = 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(16,185,129,0.05))';
              cardBorder = '2px solid rgba(34,197,94,0.2)';
            } else {
              // Yellow/amber for available
              cardBackground = 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(245,158,11,0.05))';
              cardBorder = '2px solid rgba(251,191,36,0.2)';
            }

            return <div 
              key={plan.id} 
              className="card" 
              style={{ 
                padding: '24px',
                background: cardBackground,
                border: cardBorder,
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease',
                cursor: 'default',
                opacity: isHistoryEdit ? 0.7 : 1
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: '16px' 
              }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '18px', 
                    fontWeight: '700',
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)'
                  }}>
                    📋 {plan.planCode}
                    {plan.version && plan.version > 1 && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        padding: '2px 8px',
                        background: 'rgba(59,130,246,0.2)',
                        border: '1px solid rgba(59,130,246,0.4)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#60a5fa',
                        fontWeight: '600'
                      }}>
                        v{plan.version}
                      </span>
                    )}
                    {isHistoryEdit && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        padding: '2px 8px',
                        background: 'rgba(148,163,184,0.16)',
                        border: '1px solid rgba(148,163,184,0.32)',
                        borderRadius: 'var(--radius-sm)',
                        color: '#cbd5e1',
                        fontWeight: '600'
                      }}>
                        History Edit
                      </span>
                    )}
                  </h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        background: isHistoryEdit
                          ? 'rgba(148,163,184,0.18)'
                          : plan.isUsed
                            ? 'rgba(34,197,94,0.25)'
                            : 'rgba(251,191,36,0.25)',
                        color: isHistoryEdit ? '#cbd5e1' : plan.isUsed ? '#4ade80' : '#fbbf24',
                        border: isHistoryEdit
                          ? '1px solid rgba(148,163,184,0.4)'
                          : plan.isUsed
                            ? '1px solid rgba(34,197,94,0.5)'
                            : '1px solid rgba(251,191,36,0.5)'
                      }}
                    >
                      {isHistoryEdit ? 'History Edit' : plan.isUsed ? '✅ Sudah Digunakan' : '🟡 Belum Digunakan'}
                    </span>
                    {!plan.isUsed && !isHistoryEdit && (
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="btn btn-sm"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: 'rgba(59,130,246,0.2)',
                          border: '1px solid rgba(59,130,246,0.4)',
                          color: '#60a5fa',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
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

              <div style={{ marginBottom: '16px' }}>
                <TherapyPlanDoseTable plan={plan} compact />
              </div>

              {false && (
                <>
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

              {(plan.ifaSubstances ?? []).length > 0 && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  background: 'rgba(20,184,166,0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(20,184,166,0.24)'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#2dd4bf',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Zat Tambahan IFA - Total {plan.ifaSubstanceTotalMl ?? calculateIfaSubstanceTotalMl(plan.ifaSubstances ?? [])} ml
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '10px'
                  }}>
                    {(plan.ifaSubstances ?? []).map((substance, index) => (
                      <div
                        key={`${substance.name}-${index}`}
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(20,184,166,0.12)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(20,184,166,0.25)'
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#5eead4' }}>
                          {substance.name}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#ccfbf1', marginTop: '4px' }}>
                          {substance.amount} {substance.unit}
                        </div>
                        {substance.keterangan && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.4 }}>
                            {substance.keterangan}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

                </>
              )}

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
            </div>;
          })}
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
