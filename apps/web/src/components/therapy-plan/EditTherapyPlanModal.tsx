'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { TherapyPlan } from '@/lib/therapyPlanApi';
import { therapyPlanApi } from '@/lib/therapyPlanApi';
import { showToast } from '@/lib/toast';

interface EditTherapyPlanModalProps {
  plan: TherapyPlan;
  memberId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface EditFormData {
  ifa250: number | string;
  ifa500: number | string;
  hho: number | string;
  hhoKonsentrat: number | string;
  h2: number | string;
  no: number | string;
  gaso: number | string;
  o2: number | string;
  o3: number | string;
  edta: number | string;
  mb: number | string;
  h2s: number | string;
  kcl: number | string;
  jmlNb: number | string;
  keterangan: string;
  ifaSubstances: Array<{ name: string; amount: number; unit: string; keterangan?: string }>;
}

const decimalPattern = /^\d*\.?\d*$/;

const parseDoseInput = (value: number | string): number => {
  if (value === '') return 0;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function EditTherapyPlanModal({ plan, memberId, onClose, onSuccess }: EditTherapyPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<EditFormData>({
    ifa250: plan.ifa250 || 0,
    ifa500: plan.ifa500 || 0,
    hho: plan.hho || 0,
    hhoKonsentrat: plan.hhoKonsentrat || 0,
    h2: plan.h2 || 0,
    no: plan.no || 0,
    gaso: plan.gaso || 0,
    o2: plan.o2 || 0,
    o3: plan.o3 || 0,
    edta: plan.edta || 0,
    mb: plan.mb || 0,
    h2s: plan.h2s || 0,
    kcl: plan.kcl || 0,
    jmlNb: plan.jmlNb || 0,
    keterangan: plan.keterangan || '',
    ifaSubstances: plan.ifaSubstances || [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await therapyPlanApi.editTherapyPlan(memberId, plan.id, {
        ...formData,
        ifa250: parseDoseInput(formData.ifa250),
        ifa500: parseDoseInput(formData.ifa500),
        hho: parseDoseInput(formData.hho),
        hhoKonsentrat: parseDoseInput(formData.hhoKonsentrat),
        h2: parseDoseInput(formData.h2),
        no: parseDoseInput(formData.no),
        gaso: parseDoseInput(formData.gaso),
        o2: parseDoseInput(formData.o2),
        o3: parseDoseInput(formData.o3),
        edta: parseDoseInput(formData.edta),
        mb: parseDoseInput(formData.mb),
        h2s: parseDoseInput(formData.h2s),
        kcl: parseDoseInput(formData.kcl),
        jmlNb: parseDoseInput(formData.jmlNb),
      });
      showToast.success('Therapy plan berhasil diedit. Set baru versi ' + ((plan.setVersion || plan.version || 1) + 1) + ' telah dibuat.');
      onSuccess();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengedit therapy plan');
    } finally {
      setLoading(false);
    }
  };

  const handleNumberChange = (field: keyof EditFormData, value: string) => {
    if (!decimalPattern.test(value)) return;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(148,163,184,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>
              Edit Therapy Plan #{plan.planNumber || 1}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {plan.setName || `Set v${plan.setVersion || plan.version || 1}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid rgba(148,163,184,0.24)',
              background: 'rgba(148,163,184,0.08)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Warning Alert */}
        <div
          style={{
            margin: '20px 24px',
            padding: '14px 16px',
            borderRadius: '8px',
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.28)',
            display: 'flex',
            gap: '12px',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b', marginBottom: '4px' }}>
              Edit akan membuat Set Versi Baru
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Sistem akan membuat <strong>Set v{(plan.setVersion || plan.version || 1) + 1}</strong> dengan copy semua therapy plan. 
              Set lama (v{plan.setVersion || plan.version || 1}) akan menjadi SUPERSEDED (history). 
              Perubahan hanya diterapkan pada plan ini di set yang baru.
            </div>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
            {/* Dose Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>IFA + NO 2,5ml (Botol)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.ifa250}
                  onChange={(e) => handleNumberChange('ifa250', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>IFA 500ml (Botol)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.ifa500}
                  onChange={(e) => handleNumberChange('ifa500', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>NO (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.no}
                  onChange={(e) => handleNumberChange('no', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>GASO (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.gaso}
                  onChange={(e) => handleNumberChange('gaso', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>MB (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.mb}
                  onChange={(e) => handleNumberChange('mb', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>KCL (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.kcl}
                  onChange={(e) => handleNumberChange('kcl', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>H2S (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.h2s}
                  onChange={(e) => handleNumberChange('h2s', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>O3 (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.o3}
                  onChange={(e) => handleNumberChange('o3', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>O2 (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.o2}
                  onChange={(e) => handleNumberChange('o2', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>EDTA (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.edta}
                  onChange={(e) => handleNumberChange('edta', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>HHO (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.hho}
                  onChange={(e) => handleNumberChange('hho', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>HHO Konsentrat (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.hhoKonsentrat}
                  onChange={(e) => handleNumberChange('hhoKonsentrat', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>H2 (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.h2}
                  onChange={(e) => handleNumberChange('h2', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700 }}>Jml NB (ml)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.jmlNb}
                  onChange={(e) => handleNumberChange('jmlNb', e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 700 }}>
                Keterangan
              </label>
              <textarea
                className="form-input"
                value={formData.keterangan}
                onChange={(e) => setFormData((prev) => ({ ...prev, keterangan: e.target.value }))}
                rows={3}
                placeholder="Catatan tambahan (opsional)"
                style={{ fontSize: '13px', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(148,163,184,0.2)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary"
              style={{ minWidth: '100px' }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ minWidth: '140px' }}
            >
              {loading ? 'Menyimpan...' : 'Simpan & Buat Set Baru'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
