'use client';

import { useState } from 'react';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { evaluationApi } from '@/lib/evaluationApi';
import { devError } from '@/lib/logger';

interface ComplaintsRecommendations {
  keluhan: string | null;
  rekomendasi: string | null;
}

interface Step8ComplaintsRecommendationsProps {
  sessionId: string;
  complaintsRecommendations: ComplaintsRecommendations | null;
  isLocked: boolean;
  onComplete: () => void;
}

export default function Step8ComplaintsRecommendations({
  sessionId,
  complaintsRecommendations,
  isLocked,
  onComplete,
}: Step8ComplaintsRecommendationsProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    keluhan: complaintsRecommendations?.keluhan || '',
    rekomendasi: complaintsRecommendations?.rekomendasi || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // At least one field should be filled (since it's optional step, we allow both empty to skip)
    const hasContent = formData.keluhan.trim() !== '' || formData.rekomendasi.trim() !== '';
    if (!hasContent) {
      showToast.error('Minimal satu field harus diisi atau skip step ini');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        keluhan: formData.keluhan.trim() || null,
        rekomendasi: formData.rekomendasi.trim() || null,
        writtenBy: user?.userId || '',
      };

      if (complaintsRecommendations) {
        await evaluationApi.updateEvaluation(sessionId, payload);
      } else {
        await evaluationApi.createEvaluation(sessionId, payload);
      }

      showToast.success('Keluhan dan rekomendasi berhasil disimpan');
      onComplete();
    } catch (error: any) {
      devError('Error saving complaints & recommendations:', error);
      showToast.error(error.message || 'Gagal menyimpan keluhan dan rekomendasi');
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
            8
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>
              📝 Keluhan & Rekomendasi
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Step sebelumnya harus diselesaikan terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (complaintsRecommendations && (complaintsRecommendations.keluhan || complaintsRecommendations.rekomendasi)) {
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
              📝 Keluhan & Rekomendasi
            </h3>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>
              Keluhan dan rekomendasi telah dicatat
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {complaintsRecommendations.keluhan && (
            <div style={{
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>
                KELUHAN PASIEN
              </p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {complaintsRecommendations.keluhan}
              </p>
            </div>
          )}

          {complaintsRecommendations.rekomendasi && (
            <div style={{
              padding: '16px',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: 'var(--radius-md)'
            }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>
                REKOMENDASI
              </p>
              <p style={{ fontSize: '14px', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {complaintsRecommendations.rekomendasi}
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
      background: 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(245,158,11,0.05))',
      border: '2px solid rgba(251,191,36,0.3)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '20px',
          boxShadow: '0 4px 12px rgba(251,191,36,0.3)'
        }}>
          8
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#f1f5f9' }}>
            📝 Keluhan & Rekomendasi Pasien
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Catat keluhan pasien dan rekomendasi (opsional)
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        marginBottom: '20px',
        padding: '12px 16px',
        background: 'rgba(251,191,36,0.1)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: 'var(--radius-md)',
        fontSize: '13px',
        color: '#fbbf24',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '18px' }}>ℹ️</span>
        <span>
          Step ini bersifat opsional. Isi keluhan pasien dan rekomendasi jika diperlukan, atau skip langsung ke evaluasi dokter.
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
            Keluhan Pasien
          </label>
          <textarea
            value={formData.keluhan}
            onChange={(e) => setFormData({ ...formData, keluhan: e.target.value })}
            rows={4}
            placeholder="Catat keluhan utama atau perkembangan keluhan yang disampaikan pasien selama sesi terapi..."
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.6'
            }}
            disabled={loading}
          />
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
            Contoh: Nyeri kepala berkurang, mual hilang setelah sesi ke-3, dll.
          </p>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
            Rekomendasi untuk Pasien
          </label>
          <textarea
            value={formData.rekomendasi}
            onChange={(e) => setFormData({ ...formData, rekomendasi: e.target.value })}
            rows={4}
            placeholder="Catat rekomendasi untuk pasien seperti pola makan, istirahat, aktivitas, atau persiapan sesi berikutnya..."
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              lineHeight: '1.6'
            }}
            disabled={loading}
          />
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
            Contoh: Perbanyak minum air putih, istirahat cukup 7-8 jam, hindari makanan pedas, dll.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(148,163,184,0.2)' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 32px',
              background: loading
                ? 'rgba(251,191,36,0.3)'
                : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(251,191,36,0.3)'
            }}
          >
            {loading ? '⏳ Menyimpan...' : '💾 Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}
