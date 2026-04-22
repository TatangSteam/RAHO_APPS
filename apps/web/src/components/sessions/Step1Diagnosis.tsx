'use client';

import { useState, useEffect } from 'react';
import { sessionApi } from '@/lib/sessionApi';
import { memberApi } from '@/lib/memberApi';
import { useAuthStore } from '@/stores/authStore';
import type { Diagnosis, CreateDiagnosisInput, DiagnosisCategory } from '@/types/session';
import ICDSearchInput from '@/components/ui/ICDSearchInput';
import styles from './Step1Diagnosis.module.css';

interface Step1DiagnosisProps {
  encounterId: string;
  memberId: string;
  diagnosis: Diagnosis | null;
  isLocked: boolean;
  onComplete: () => void;
}

const DIAGNOSIS_CATEGORIES: { value: DiagnosisCategory; label: string }[] = [
  { value: 'HIPERTENSI', label: 'Hipertensi' },
  { value: 'NEUROLOGI', label: 'Neurologi' },
  { value: 'DIABETES', label: 'Diabetes' },
  { value: 'KARDIOVASKULAR', label: 'Kardiovaskular' },
  { value: 'ORTOPEDI', label: 'Ortopedi' },
  { value: 'IMUNOLOGI', label: 'Imunologi' },
  { value: 'HEMATOLOGI', label: 'Hematologi' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

export default function Step1Diagnosis({
  encounterId,
  memberId,
  diagnosis,
  isLocked,
  onComplete,
}: Step1DiagnosisProps) {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberDiagnoses, setMemberDiagnoses] = useState<any[]>([]);

  const [formData, setFormData] = useState<CreateDiagnosisInput>({
    doktorPemeriksa: user?.userId || '',
    diagnosa: '',
    kategoriDiagnosa: undefined,
    icdPrimer: '',
    icdSekunder: '',
    icdTersier: '',
    keluhanRiwayatSekarang: '',
    riwayatPenyakitTerdahulu: '',
    riwayatSosialKebiasaan: '',
    riwayatPengobatan: '',
    pemeriksaanFisik: '',
    pemeriksaanTambahan: {},
  });

  // Load member's previous diagnoses
  useEffect(() => {
    const loadDiagnoses = async () => {
      try {
        const response = await memberApi.getMemberDiagnoses(memberId);
        setMemberDiagnoses(response.data || []);
      } catch (err) {
        console.error('Failed to load member diagnoses:', err);
      }
    };

    if (memberId) {
      loadDiagnoses();
    }
  }, [memberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.diagnosa) {
      setError('Pilih diagnosa yang sudah ada');
      return;
    }

    setLoading(true);

    try {
      const data: CreateDiagnosisInput = {
        ...formData,
        pemeriksaanTambahan: undefined, // Not needed when using existing diagnosis
      };

      await sessionApi.createDiagnosis(encounterId, data);
      setIsEditing(false);
      onComplete();
    } catch (err: any) {
      console.error('Failed to create diagnosis:', err);
      setError(err.response?.data?.error?.message || 'Gagal menyimpan diagnosa');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExistingDiagnosis = (selectedDiagnosis: any) => {
    setFormData({
      doktorPemeriksa: user?.userId || '',
      diagnosa: selectedDiagnosis.diagnosa,
      kategoriDiagnosa: selectedDiagnosis.kategoriDiagnosa,
      icdPrimer: selectedDiagnosis.icdPrimer || '',
      icdSekunder: selectedDiagnosis.icdSekunder || '',
      icdTersier: selectedDiagnosis.icdTersier || '',
      keluhanRiwayatSekarang: selectedDiagnosis.keluhanRiwayatSekarang || '',
      riwayatPenyakitTerdahulu: selectedDiagnosis.riwayatPenyakitTerdahulu || '',
      riwayatSosialKebiasaan: selectedDiagnosis.riwayatSosialKebiasaan || '',
      riwayatPengobatan: selectedDiagnosis.riwayatPengobatan || '',
      pemeriksaanFisik: selectedDiagnosis.pemeriksaanFisik || '',
      pemeriksaanTambahan: selectedDiagnosis.pemeriksaanTambahan || {},
    });
  };

  if (isLocked) {
    return (
      <div className={`${styles.container} ${styles.locked}`}>
        <div className={styles.header}>
          <div className={`${styles.stepNumber} ${styles.locked}`}>1</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Step 1: Diagnosa</h3>
            <p className={styles.subtitle}>Step ini terkunci</p>
          </div>
        </div>
      </div>
    );
  }

  if (diagnosis && !isEditing) {
    return (
      <div className={`${styles.container} ${styles.completed}`}>
        <div className={styles.header}>
          <div className={`${styles.stepNumber} ${styles.completed}`}>✓</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Step 1: Diagnosa</h3>
            <p className={styles.subtitle}>{diagnosis.diagnosisCode}</p>
          </div>
        </div>

        <div className={styles.completedContent}>
          <div className={styles.completedField}>
            <p className={styles.completedLabel}>Diagnosa:</p>
            <p className={styles.completedValue}>{diagnosis.diagnosa}</p>
          </div>
          {diagnosis.kategoriDiagnosa && (
            <div className={styles.completedField}>
              <p className={styles.completedLabel}>Kategori:</p>
              <p className={styles.completedValue}>{diagnosis.kategoriDiagnosa}</p>
            </div>
          )}
          {diagnosis.keluhanRiwayatSekarang && (
            <div className={styles.completedField}>
              <p className={styles.completedLabel}>Keluhan & Riwayat Sekarang:</p>
              <p className={styles.completedValue}>{diagnosis.keluhanRiwayatSekarang}</p>
            </div>
          )}
          {diagnosis.pemeriksaanFisik && (
            <div className={styles.completedField}>
              <p className={styles.completedLabel}>Pemeriksaan Fisik:</p>
              <p className={styles.completedValue}>{diagnosis.pemeriksaanFisik}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={`${styles.stepNumber} ${styles.active}`}>1</div>
        <div className={styles.headerContent}>
          <h3 className={styles.title}>Step 1: Diagnosa</h3>
          <p className={styles.subtitle}>Pilih diagnosa untuk sesi terapi ini</p>
        </div>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Show message if no diagnoses available */}
      {memberDiagnoses.length === 0 && (
        <div className={styles.warningAlert}>
          <span className={styles.warningIcon}>ℹ️</span>
          <div>
            <p><strong>Belum ada diagnosa untuk member ini.</strong></p>
            <p>Silakan buat diagnosa terlebih dahulu di tab <strong>Diagnosa</strong> pada halaman detail member.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Select existing diagnosis - ONLY OPTION */}
        {memberDiagnoses.length > 0 && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Pilih Diagnosa <span className={styles.required}>*</span>
              </label>
              <select
                onChange={(e) => {
                  const selected = memberDiagnoses.find((d) => d.id === e.target.value);
                  if (selected) {
                    handleSelectExistingDiagnosis(selected);
                  }
                }}
                className={styles.formSelect}
                disabled={loading}
                defaultValue=""
              >
                <option value="">-- Pilih diagnosa --</option>
                {memberDiagnoses.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.diagnosa} ({d.kategoriDiagnosa || 'Umum'}) - {new Date(d.createdAt).toLocaleDateString('id-ID')}
                  </option>
                ))}
              </select>
              <p className={styles.helpText}>
                Pilih diagnosa yang sesuai untuk sesi terapi ini. Diagnosa baru dapat dibuat di tab Diagnosa member.
              </p>
            </div>

            {/* Show selected diagnosis details */}
            {formData.diagnosa && (
              <div className={styles.selectedDiagnosisPreview}>
                <h4 className={styles.previewTitle}>Detail Diagnosa Terpilih:</h4>
                
                <div className={styles.previewField}>
                  <p className={styles.previewLabel}>Diagnosa:</p>
                  <p className={styles.previewValue}>{formData.diagnosa}</p>
                </div>

                {formData.kategoriDiagnosa && (
                  <div className={styles.previewField}>
                    <p className={styles.previewLabel}>Kategori:</p>
                    <p className={styles.previewValue}>{formData.kategoriDiagnosa}</p>
                  </div>
                )}

                {(formData.icdPrimer || formData.icdSekunder || formData.icdTersier) && (
                  <div className={styles.previewField}>
                    <p className={styles.previewLabel}>ICD Codes:</p>
                    <p className={styles.previewValue}>
                      {[formData.icdPrimer, formData.icdSekunder, formData.icdTersier]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                )}

                {formData.keluhanRiwayatSekarang && (
                  <div className={styles.previewField}>
                    <p className={styles.previewLabel}>Keluhan & Riwayat:</p>
                    <p className={styles.previewValue}>{formData.keluhanRiwayatSekarang}</p>
                  </div>
                )}

                {formData.pemeriksaanFisik && (
                  <div className={styles.previewField}>
                    <p className={styles.previewLabel}>Pemeriksaan Fisik:</p>
                    <p className={styles.previewValue}>{formData.pemeriksaanFisik}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className={styles.footer}>
          <button
            type="submit"
            disabled={loading || !formData.diagnosa || memberDiagnoses.length === 0}
            className={styles.submitBtn}
          >
            {loading ? 'Menyimpan...' : 'Gunakan Diagnosa Ini'}
          </button>
        </div>
      </form>
    </div>
  );
}
