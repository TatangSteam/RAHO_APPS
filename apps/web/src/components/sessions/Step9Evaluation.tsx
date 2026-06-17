'use client';

import { useState } from 'react';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { evaluationApi } from '@/lib/evaluationApi';
import { devError } from '@/lib/logger';

interface Evaluation {
  id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  generalNotes: string | null;
  writtenBy: string;
  createdAt: string;
}

interface Step9EvaluationProps {
  sessionId: string;
  evaluation: Evaluation | null;
  isLocked: boolean;
  onComplete: () => void;
}

export default function Step9Evaluation({
  sessionId,
  evaluation,
  isLocked,
  onComplete,
}: Step9EvaluationProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    generalNotes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // At least one field must be filled
    const hasContent = Object.values(formData).some(val => val.trim() !== '');
    if (!hasContent) {
      showToast.error('Minimal satu field harus diisi');
      return;
    }

    setLoading(true);

    try {
      await evaluationApi.createEvaluation(sessionId, {
        ...formData,
        writtenBy: user?.userId || '',
      });

      showToast.success('Evaluasi dokter berhasil disimpan');
      onComplete();
    } catch (error: any) {
      devError('Error saving evaluation:', error);
      showToast.error(error.message || 'Gagal menyimpan evaluasi');
    } finally {
      setLoading(false);
    }
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
            9
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>
              📋 Evaluasi Dokter
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Step sebelumnya harus diselesaikan terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (evaluation) {
    return (
      <div style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))',
        border: '2px solid rgba(34,197,94,0.3)',
        borderRadius: 'var(--radius-lg)',
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
              📋 Evaluasi Dokter
            </h3>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>
              Evaluasi telah dicatat
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {evaluation.subjective && (
            <div style={{
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>
                SUBJECTIVE (Keluhan Pasien)
              </p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {evaluation.subjective}
              </p>
            </div>
          )}

          {evaluation.objective && (
            <div style={{
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>
                OBJECTIVE (Hasil Pemeriksaan)
              </p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {evaluation.objective}
              </p>
            </div>
          )}

          {evaluation.assessment && (
            <div style={{
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>
                ASSESSMENT (Diagnosa)
              </p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {evaluation.assessment}
              </p>
            </div>
          )}

          {evaluation.plan && (
            <div style={{
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>
                PLAN (Rencana Tindak Lanjut)
              </p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {evaluation.plan}
              </p>
            </div>
          )}

          {evaluation.generalNotes && (
            <div style={{
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>
                CATATAN UMUM
              </p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {evaluation.generalNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
      border: '2px solid rgba(59,130,246,0.3)',
      borderRadius: 'var(--radius-lg)',
    }}>
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
          9
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#f1f5f9' }}>
            📋 Evaluasi Dokter (SOAP)
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Catat evaluasi dokter menggunakan format SOAP
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
            Subjective (Keluhan Pasien)
          </label>
          <textarea
            value={formData.subjective}
            onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
            rows={3}
            placeholder="Keluhan yang disampaikan pasien..."
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none'
            }}
            disabled={loading}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
            Objective (Hasil Pemeriksaan)
          </label>
          <textarea
            value={formData.objective}
            onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
            rows={3}
            placeholder="Hasil pemeriksaan fisik dan vital signs..."
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none'
            }}
            disabled={loading}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
            Assessment (Diagnosa)
          </label>
          <textarea
            value={formData.assessment}
            onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
            rows={3}
            placeholder="Diagnosa atau kesimpulan kondisi pasien..."
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none'
            }}
            disabled={loading}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
            Plan (Rencana Tindak Lanjut)
          </label>
          <textarea
            value={formData.plan}
            onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
            rows={3}
            placeholder="Rencana terapi dan tindak lanjut..."
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none'
            }}
            disabled={loading}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
            Catatan Umum
          </label>
          <textarea
            value={formData.generalNotes}
            onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
            rows={2}
            placeholder="Catatan tambahan..."
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none'
            }}
            disabled={loading}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 32px',
              background: loading
                ? 'rgba(59,130,246,0.3)'
                : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(59,130,246,0.3)'
            }}
          >
            {loading ? '⏳ Menyimpan...' : '💾 Simpan Evaluasi'}
          </button>
        </div>
      </form>
    </div>
  );
}
