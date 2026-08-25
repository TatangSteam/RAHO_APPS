'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect } from 'react';
import { sessionApi } from '@/lib/sessionApi';
import { diagnosisApi } from '@/lib/diagnosisApi';
import { useAuthStore } from '@/stores/authStore';
import { confirm, showToast } from '@/lib/toast';
import type { Diagnosis, CreateDiagnosisInput, DiagnosisCategory } from '@/types/session';
import { devLog, devError } from '@/lib/logger';
import styles from './Step1Diagnosis.module.css';
import { useSessionWorkflowDraft } from './SessionWorkflowDraftContext';

interface Step1DiagnosisProps {
  encounterId: string;
  memberId: string;
  diagnosis: Diagnosis | null;
  isLocked: boolean;
  onComplete: () => void;
}

const CATEGORY_LABELS: Record<DiagnosisCategory, string> = {
  HIPERTENSI: 'Hipertensi',
  NEUROLOGI: 'Neurologi',
  DIABETES: 'Diabetes',
  KARDIOVASKULAR: 'Kardiovaskular',
  ORTOPEDI: 'Ortopedi',
  IMUNOLOGI: 'Imunologi',
  HEMATOLOGI: 'Hematologi',
  STROKE: 'Stroke',
  JANTUNG_KARDIOVASKULAR: 'Jantung Kardiovascular',
  SINDROM_METABOLIK: 'Sindrom Metabolik',
  KANKER: 'Kanker',
  DEGENERATIF: 'Degeneratif',
  AUTO_IMUN: 'Auto Imun',
  ONKOLOGI: 'Onkologi',
  LAINNYA: 'Lainnya',
};

function getDiagnosisCategoryLabel(category: DiagnosisCategory | string | null | undefined): string {
  if (!category) return 'Umum';
  return CATEGORY_LABELS[category as DiagnosisCategory] || category;
}

function getDiagnosisCategories(
  diagnosis: { kategoriDiagnosa?: DiagnosisCategory | string | null; kategoriDiagnosaList?: (DiagnosisCategory | string)[] | null }
): (DiagnosisCategory | string)[] {
  if (Array.isArray(diagnosis.kategoriDiagnosaList) && diagnosis.kategoriDiagnosaList.length > 0) {
    return diagnosis.kategoriDiagnosaList;
  }

  return diagnosis.kategoriDiagnosa ? [diagnosis.kategoriDiagnosa] : [];
}

export default function Step1Diagnosis({
  encounterId,
  memberId,
  diagnosis,
  isLocked,
  onComplete,
}: Step1DiagnosisProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberDiagnoses, setMemberDiagnoses] = useState<Diagnosis[]>([]);
  const canDeleteDiagnosis = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';
  const canEditDiagnosis = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'DOCTOR', 'NURSE'].includes(user?.role || '');
  const diagnosisDraft = useSessionWorkflowDraft<CreateDiagnosisInput>('diagnosis');

  const [formData, setFormData] = useState<CreateDiagnosisInput>({
    sourceDiagnosisId: undefined,
    doktorPemeriksa: user?.userId || '',
    diagnosa: '',
    kategoriDiagnosa: undefined,
    kategoriDiagnosaList: [],
    icdPrimer: '',
    icdSekunder: '',
    icdTersier: '',
    keluhanRiwayatSekarang: '',
    riwayatPenyakitTerdahulu: '',
    riwayatSosialKebiasaan: '',
    riwayatPengobatan: '',
    pemeriksaanFisik: '',
    pemeriksaanTambahan: {},
    ...diagnosisDraft.initialDraft,
  });
  const [editFormData, setEditFormData] = useState<Partial<CreateDiagnosisInput>>({});
  const [additionalExamJson, setAdditionalExamJson] = useState('{}');

  useEffect(() => {
    if (!diagnosis) diagnosisDraft.updateDraft(formData);
  }, [diagnosis, formData]);

  useEffect(() => {
    if (!diagnosis) return;
    setEditFormData({
      diagnosa: diagnosis.diagnosa,
      kategoriDiagnosa: diagnosis.kategoriDiagnosa || undefined,
      kategoriDiagnosaList: getDiagnosisCategories(diagnosis) as DiagnosisCategory[],
      icdPrimer: diagnosis.icdPrimer || '',
      icdSekunder: diagnosis.icdSekunder || '',
      icdTersier: diagnosis.icdTersier || '',
      keluhanRiwayatSekarang: diagnosis.keluhanRiwayatSekarang || '',
      riwayatPenyakitTerdahulu: diagnosis.riwayatPenyakitTerdahulu || '',
      riwayatSosialKebiasaan: diagnosis.riwayatSosialKebiasaan || '',
      riwayatPengobatan: diagnosis.riwayatPengobatan || '',
      pemeriksaanFisik: diagnosis.pemeriksaanFisik || '',
      pemeriksaanTambahan: diagnosis.pemeriksaanTambahan || {},
    });
    setAdditionalExamJson(JSON.stringify(diagnosis.pemeriksaanTambahan || {}, null, 2));
    setIsEditing(false);
  }, [diagnosis]);

  // Load member's previous diagnoses
  useEffect(() => {
    const loadDiagnoses = async () => {
      devLog('🔍 Step1Diagnosis - memberId received:', memberId);
      
      if (!memberId) {
        devError('❌ Step1Diagnosis - memberId is undefined or empty!');
        setMemberDiagnoses([]);
        return;
      }
      
      try {
        const data = await diagnosisApi.getMemberDiagnoses(memberId);
        devLog('📋 Loaded diagnoses for member:', memberId, 'count:', data?.length, data);
        setMemberDiagnoses(data || []);
      } catch (err) {
      assertCaughtError(err);
        devError('Failed to load member diagnoses:', err);
        setMemberDiagnoses([]);
      }
    };

    if (memberId) {
      loadDiagnoses();
    } else {
      devLog('⚠️ Step1Diagnosis - memberId is falsy, skipping diagnosis load');
    }
  }, [memberId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.diagnosa) {
      setError('Pilih diagnosa yang sudah ada');
      return;
    }

    // Validate doktorPemeriksa is a valid CUID
    if (!formData.doktorPemeriksa || formData.doktorPemeriksa.length < 20) {
      setError('Dokter pemeriksa tidak valid. Silakan pilih diagnosa lagi.');
      devError('❌ Invalid doktorPemeriksa:', formData.doktorPemeriksa);
      return;
    }

    setLoading(true);

    try {
      const data: CreateDiagnosisInput = {
        ...(formData.sourceDiagnosisId ? { sourceDiagnosisId: formData.sourceDiagnosisId } : {}),
        doktorPemeriksa: formData.doktorPemeriksa,
        diagnosa: formData.diagnosa,
        ...(formData.kategoriDiagnosa ? { kategoriDiagnosa: formData.kategoriDiagnosa } : {}),
        ...(formData.kategoriDiagnosaList?.length ? { kategoriDiagnosaList: formData.kategoriDiagnosaList } : {}),
        ...(formData.icdPrimer ? { icdPrimer: formData.icdPrimer } : {}),
        ...(formData.icdSekunder ? { icdSekunder: formData.icdSekunder } : {}),
        ...(formData.icdTersier ? { icdTersier: formData.icdTersier } : {}),
        ...(formData.keluhanRiwayatSekarang ? { keluhanRiwayatSekarang: formData.keluhanRiwayatSekarang } : {}),
        ...(formData.riwayatPenyakitTerdahulu ? { riwayatPenyakitTerdahulu: formData.riwayatPenyakitTerdahulu } : {}),
        ...(formData.riwayatSosialKebiasaan ? { riwayatSosialKebiasaan: formData.riwayatSosialKebiasaan } : {}),
        ...(formData.riwayatPengobatan ? { riwayatPengobatan: formData.riwayatPengobatan } : {}),
        ...(formData.pemeriksaanFisik ? { pemeriksaanFisik: formData.pemeriksaanFisik } : {}),
      };

      devLog('📤 Submitting diagnosis with data:', data);
      devLog('📤 doktorPemeriksa being sent:', data.doktorPemeriksa);

      await sessionApi.createDiagnosis(encounterId, data);
      onComplete();
      diagnosisDraft.clearDraft();
    } catch (err) {
      assertCaughtError(err);
      devError('Failed to save diagnosis:', err);
      const errorDetails = err.response?.data?.error?.details;
      if (errorDetails && Array.isArray(errorDetails)) {
        const messages = errorDetails.map((detail) => {
          const item = detail as { path?: string[]; message?: string };
          return `${item.path?.join('.')}: ${item.message}`;
        }).join(', ');
        setError(`Validasi gagal: ${messages}`);
      } else {
        setError(err.response?.data?.error?.message || 'Gagal menyimpan diagnosa');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExistingDiagnosis = (selectedDiagnosis: Diagnosis) => {
    devLog('📋 Selected diagnosis:', selectedDiagnosis);
    devLog('📋 doktorPemeriksa from diagnosis:', selectedDiagnosis.doktorPemeriksa);
    
    setFormData({
      sourceDiagnosisId: selectedDiagnosis.id,
      doktorPemeriksa: selectedDiagnosis.doktorPemeriksa || user?.userId || '', // Use original doctor from diagnosis
      diagnosa: selectedDiagnosis.diagnosa,
      // Convert null to undefined for optional enum fields (Zod expects undefined, not null)
      kategoriDiagnosa: selectedDiagnosis.kategoriDiagnosa || undefined,
      kategoriDiagnosaList: getDiagnosisCategories(selectedDiagnosis) as DiagnosisCategory[],
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

  const handleDeleteSessionDiagnosis = async () => {
    if (!diagnosis) return;

    const confirmed = await confirm.show({
      title: 'Hapus Diagnosa Sesi',
      message: `Hapus diagnosa ${diagnosis.diagnosisCode} dari sesi ini? Step diagnosa akan kembali kosong.`,
      variant: 'danger',
      confirmText: 'Hapus Diagnosa',
      cancelText: 'Batal',
    });

    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await sessionApi.deleteDiagnosisByEncounter(encounterId);
      showToast.success('Diagnosa sesi berhasil dihapus');
      onComplete();
    } catch (err) {
      assertCaughtError(err);
      devError('Failed to delete session diagnosis:', err);
      setError(err.response?.data?.error?.message || 'Gagal menghapus diagnosa sesi');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateDiagnosis = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!diagnosis || !editFormData.diagnosa?.trim()) {
      setError('Diagnosa wajib diisi');
      return;
    }

    let pemeriksaanTambahan: Record<string, string>;
    try {
      const parsed = JSON.parse(additionalExamJson || '{}') as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('Pemeriksaan tambahan harus berupa object JSON');
      }
      pemeriksaanTambahan = parsed as Record<string, string>;
    } catch {
      setError('Format pemeriksaan tambahan tidak valid. Gunakan object JSON, contoh: {"EKG":"Normal"}');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sessionApi.updateDiagnosis(encounterId, {
        ...editFormData,
        diagnosa: editFormData.diagnosa.trim(),
        pemeriksaanTambahan,
      });
      showToast.success('Diagnosa sesi berhasil diperbarui');
      setIsEditing(false);
      onComplete();
    } catch (err) {
      assertCaughtError(err);
      devError('Failed to update session diagnosis:', err);
      setError(err.response?.data?.error?.message || 'Gagal memperbarui diagnosa sesi');
    } finally {
      setLoading(false);
    }
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

  if (diagnosis && isEditing) {
    const selectedCategories = (editFormData.kategoriDiagnosaList || []) as DiagnosisCategory[];
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={`${styles.stepNumber} ${styles.active}`}>1</div>
          <div className={styles.headerContent}>
            <h3 className={styles.title}>Edit Diagnosa Sesi</h3>
            <p className={styles.subtitle}>{diagnosis.diagnosisCode} — perubahan tercatat di audit log</p>
          </div>
        </div>

        {error && <div className={styles.errorAlert}><span>!</span><span>{error}</span></div>}

        <form onSubmit={handleUpdateDiagnosis} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Diagnosa <span className={styles.required}>*</span></label>
            <textarea
              className={styles.formTextarea}
              value={editFormData.diagnosa || ''}
              onChange={(event) => setEditFormData((current) => ({ ...current, diagnosa: event.target.value }))}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Kategori Diagnosa</label>
            <select
              multiple
              className={styles.formSelect}
              value={selectedCategories}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions).map((option) => option.value as DiagnosisCategory);
                setEditFormData((current) => ({
                  ...current,
                  kategoriDiagnosa: values[0],
                  kategoriDiagnosaList: values,
                }));
              }}
              disabled={loading}
              size={5}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className={styles.helpText}>Gunakan Ctrl/Command untuk memilih lebih dari satu kategori.</p>
          </div>

          <div className={styles.gridThreeCol}>
            {[
              ['icdPrimer', 'ICD Primer'],
              ['icdSekunder', 'ICD Sekunder'],
              ['icdTersier', 'ICD Tersier'],
            ].map(([field, label]) => (
              <div key={field} className={styles.formGroup}>
                <label className={styles.formLabel}>{label}</label>
                <input
                  className={styles.formInput}
                  value={String(editFormData[field as keyof CreateDiagnosisInput] || '')}
                  onChange={(event) => setEditFormData((current) => ({ ...current, [field]: event.target.value }))}
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          {[
            ['keluhanRiwayatSekarang', 'Keluhan & Riwayat Sekarang'],
            ['riwayatPenyakitTerdahulu', 'Riwayat Penyakit Terdahulu'],
            ['riwayatSosialKebiasaan', 'Riwayat Sosial & Kebiasaan'],
            ['riwayatPengobatan', 'Riwayat Pengobatan'],
            ['pemeriksaanFisik', 'Pemeriksaan Fisik'],
          ].map(([field, label]) => (
            <div key={field} className={styles.formGroup}>
              <label className={styles.formLabel}>{label}</label>
              <textarea
                className={styles.formTextarea}
                value={String(editFormData[field as keyof CreateDiagnosisInput] || '')}
                onChange={(event) => setEditFormData((current) => ({ ...current, [field]: event.target.value }))}
                disabled={loading}
              />
            </div>
          ))}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Pemeriksaan Tambahan (JSON)</label>
            <textarea
              className={styles.formTextarea}
              value={additionalExamJson}
              onChange={(event) => setAdditionalExamJson(event.target.value)}
              disabled={loading}
              spellCheck={false}
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={() => setIsEditing(false)} disabled={loading}>Batal</button>
            <button type="submit" className={styles.submitBtn} disabled={loading || !editFormData.diagnosa?.trim()}>
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (diagnosis) {
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
          {error && (
            <div className={styles.errorAlert}>
              <span className={styles.errorIcon}>!</span>
              <span>{error}</span>
            </div>
          )}
          <div className={styles.completedField}>
            <p className={styles.completedLabel}>Diagnosa:</p>
            <p className={styles.completedValue}>{diagnosis.diagnosa}</p>
          </div>
          {getDiagnosisCategories(diagnosis).length > 0 && (
            <div className={styles.completedField}>
              <p className={styles.completedLabel}>Kategori:</p>
              <p className={styles.completedValue}>
                {getDiagnosisCategories(diagnosis).map(getDiagnosisCategoryLabel).join(', ')}
              </p>
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
          {(canEditDiagnosis || canDeleteDiagnosis) && (
            <div className={styles.editButtonContainer}>
              <div className={styles.footer} style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                {canEditDiagnosis && (
                  <button type="button" onClick={() => setIsEditing(true)} className={styles.editBtn}>
                    Edit Diagnosa
                  </button>
                )}
                {canDeleteDiagnosis && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteSessionDiagnosis()}
                    disabled={deleting}
                    className={styles.deleteBtn}
                  >
                    {deleting ? 'Menghapus...' : 'Hapus Diagnosa'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CREATE MODE - Select existing diagnosis
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
                    {d.diagnosa} ({getDiagnosisCategories(d).map(getDiagnosisCategoryLabel).join(', ') || 'Umum'}) - {new Date(d.createdAt).toLocaleDateString('id-ID')}
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

                {getDiagnosisCategories(formData).length > 0 && (
                  <div className={styles.previewField}>
                    <p className={styles.previewLabel}>Kategori:</p>
                    <p className={styles.previewValue}>
                      {getDiagnosisCategories(formData).map(getDiagnosisCategoryLabel).join(', ')}
                    </p>
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
