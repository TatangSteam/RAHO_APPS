'use client';

import { useState, useEffect } from 'react';
import { diagnosisApi } from '@/lib/diagnosisApi';
import { usersApi } from '@/lib/usersApi';
import type { Diagnosis, CreateDiagnosisInput, DiagnosisCategory } from '@/types/session';
import type { StaffMember } from '@/lib/usersApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import ICDSearchInput from '@/components/ui/ICDSearchInput';

interface MemberDiagnosesTabProps {
  memberId: string;
}

export default function MemberDiagnosesTab({ memberId }: MemberDiagnosesTabProps) {
  const { user } = useAuthStore();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreateDiagnosisInput>({
    doktorPemeriksa: '',
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
    pemeriksaanTambahan: {}
  });

  const [additionalExams, setAdditionalExams] = useState<Array<{ key: string; value: string }>>([]);
  const [categories, setCategories] = useState<Array<{ value: string; label: string; description: string }>>([]);

  useEffect(() => {
    loadDiagnoses();
    loadDoctors();
    loadCategories();
  }, [memberId]);

  const loadCategories = async () => {
    try {
      const data = await diagnosisApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Fallback to hardcoded categories
      setCategories([
        { value: 'HIPERTENSI', label: 'Hipertensi', description: 'Penyakit tekanan darah tinggi' },
        { value: 'NEUROLOGI', label: 'Neurologi', description: 'Gangguan sistem saraf' },
        { value: 'DIABETES', label: 'Diabetes', description: 'Diabetes melitus' },
        { value: 'KARDIOVASKULAR', label: 'Kardiovaskular', description: 'Penyakit jantung' },
        { value: 'ORTOPEDI', label: 'Ortopedi', description: 'Gangguan muskuloskeletal' },
        { value: 'IMUNOLOGI', label: 'Imunologi', description: 'Gangguan sistem imun' },
        { value: 'HEMATOLOGI', label: 'Hematologi', description: 'Gangguan darah' },
        { value: 'LAINNYA', label: 'Lainnya', description: 'Kategori lainnya' },
      ]);
    }
  };

  const loadDiagnoses = async () => {
    try {
      setLoading(true);
      const data = await diagnosisApi.getMemberDiagnoses(memberId);
      setDiagnoses(data);
    } catch (error) {
      console.error('Failed to load diagnoses:', error);
      showToast.error('Gagal memuat data diagnosa');
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    try {
      const data = await usersApi.getDoctors(user?.branchId || undefined);
      setDoctors(data);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  };

  const handleAddExam = () => {
    setAdditionalExams([...additionalExams, { key: '', value: '' }]);
  };

  const handleRemoveExam = (index: number) => {
    setAdditionalExams(additionalExams.filter((_, i) => i !== index));
  };

  const handleExamChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...additionalExams];
    updated[index][field] = value;
    setAdditionalExams(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.doktorPemeriksa || !formData.diagnosa) {
      showToast.error('Dokter pemeriksa dan diagnosa wajib diisi');
      return;
    }

    if (formData.diagnosa.length < 3) {
      showToast.error('Diagnosa minimal 3 karakter');
      return;
    }

    try {
      setSubmitting(true);

      // Convert additional exams to object
      const pemeriksaanTambahan: Record<string, string> = {};
      additionalExams.forEach(exam => {
        if (exam.key && exam.value) {
          pemeriksaanTambahan[exam.key] = exam.value;
        }
      });

      const payload: CreateDiagnosisInput = {
        ...formData,
        pemeriksaanTambahan: Object.keys(pemeriksaanTambahan).length > 0 ? pemeriksaanTambahan : undefined
      };

      await diagnosisApi.createDiagnosis(memberId, payload);
      showToast.success('Diagnosa berhasil dibuat');
      setShowCreateModal(false);
      resetForm();
      loadDiagnoses();
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal membuat diagnosa');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      doktorPemeriksa: '',
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
      pemeriksaanTambahan: {}
    });
    setAdditionalExams([]);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Memuat data diagnosa...</p>
      </div>
    );
  }

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600' }}>📋 Diagnosa Member</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            ➕ Buat Diagnosa
          </button>
        </div>

        {diagnoses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
            <p style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Belum ada diagnosa
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Diagnosa wajib dibuat sebelum memulai sesi terapi
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              ➕ Buat Diagnosa Pertama
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {diagnoses.map((diagnosis) => (
              <div key={diagnosis.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <p style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {diagnosis.diagnosisCode}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(diagnosis.createdAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  {diagnosis.kategoriDiagnosa && (
                    <span className="badge badge-blue">
                      {diagnosis.kategoriDiagnosa}
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Dokter Pemeriksa</p>
                  <p style={{ fontWeight: '600' }}>👨‍⚕️ {doctors.find(d => d.userId === diagnosis.doktorPemeriksa)?.fullName || diagnosis.doktorPemeriksa}</p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Diagnosa</p>
                  <p style={{ fontWeight: '600', fontSize: '15px' }}>{diagnosis.diagnosa}</p>
                </div>

                {(diagnosis.icdPrimer || diagnosis.icdSekunder || diagnosis.icdTersier) && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Kode ICD</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {diagnosis.icdPrimer && (
                        <span className="badge badge-primary">Primer: {diagnosis.icdPrimer}</span>
                      )}
                      {diagnosis.icdSekunder && (
                        <span className="badge badge-cyan">Sekunder: {diagnosis.icdSekunder}</span>
                      )}
                      {diagnosis.icdTersier && (
                        <span className="badge badge-purple">Tersier: {diagnosis.icdTersier}</span>
                      )}
                    </div>
                  </div>
                )}

                {diagnosis.keluhanRiwayatSekarang && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Keluhan & Riwayat Sekarang</p>
                    <p style={{ fontSize: '14px' }}>{diagnosis.keluhanRiwayatSekarang}</p>
                  </div>
                )}

                {diagnosis.riwayatPenyakitTerdahulu && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Riwayat Penyakit Terdahulu</p>
                    <p style={{ fontSize: '14px' }}>{diagnosis.riwayatPenyakitTerdahulu}</p>
                  </div>
                )}

                {diagnosis.riwayatSosialKebiasaan && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Riwayat Sosial & Kebiasaan</p>
                    <p style={{ fontSize: '14px' }}>{diagnosis.riwayatSosialKebiasaan}</p>
                  </div>
                )}

                {diagnosis.riwayatPengobatan && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Riwayat Pengobatan</p>
                    <p style={{ fontSize: '14px' }}>{diagnosis.riwayatPengobatan}</p>
                  </div>
                )}

                {diagnosis.pemeriksaanFisik && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pemeriksaan Fisik</p>
                    <p style={{ fontSize: '14px' }}>{diagnosis.pemeriksaanFisik}</p>
                  </div>
                )}

                {diagnosis.pemeriksaanTambahan && Object.keys(diagnosis.pemeriksaanTambahan).length > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Pemeriksaan Tambahan</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {Object.entries(diagnosis.pemeriksaanTambahan).map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', gap: '8px', fontSize: '14px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{key}:</span>
                          <span>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Diagnosis Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '40px 24px', overflowY: 'auto' }}>
          <div className="card max-w-3xl w-full" style={{ width: '100%', maxWidth: '900px', animation: 'fadeIn 0.2s', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700' }}>📋 Buat Diagnosa Baru</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                disabled={submitting}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Dokter Pemeriksa */}
              <div className="form-group">
                <label className="form-label">
                  Dokter Pemeriksa <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  value={formData.doktorPemeriksa}
                  onChange={(e) => setFormData({ ...formData, doktorPemeriksa: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Pilih dokter...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.userId} value={doctor.userId}>
                      {doctor.fullName} ({doctor.staffCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Diagnosa */}
              <div className="form-group">
                <label className="form-label">
                  Diagnosa <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  value={formData.diagnosa}
                  onChange={(e) => setFormData({ ...formData, diagnosa: e.target.value })}
                  className="form-input"
                  rows={3}
                  placeholder="Masukkan diagnosa (minimal 3 karakter)"
                  required
                  minLength={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Kategori Diagnosa */}
              <div className="form-group">
                <label className="form-label">Kategori Diagnosa</label>
                <select
                  value={formData.kategoriDiagnosa || ''}
                  onChange={(e) => setFormData({ ...formData, kategoriDiagnosa: e.target.value as DiagnosisCategory || undefined })}
                  className="form-input"
                >
                  <option value="">Pilih kategori...</option>
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value} title={cat.description}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {formData.kategoriDiagnosa && categories.find(c => c.value === formData.kategoriDiagnosa) && (
                  <p className="form-hint">
                    {categories.find(c => c.value === formData.kategoriDiagnosa)?.description}
                  </p>
                )}
              </div>

              {/* ICD Codes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <ICDSearchInput
                  label="ICD Primer"
                  value={formData.icdPrimer || ''}
                  onChange={(value) => setFormData({ ...formData, icdPrimer: value })}
                  placeholder="Cari kode ICD primer..."
                />
                <ICDSearchInput
                  label="ICD Sekunder"
                  value={formData.icdSekunder || ''}
                  onChange={(value) => setFormData({ ...formData, icdSekunder: value })}
                  placeholder="Cari kode ICD sekunder..."
                />
                <ICDSearchInput
                  label="ICD Tersier"
                  value={formData.icdTersier || ''}
                  onChange={(value) => setFormData({ ...formData, icdTersier: value })}
                  placeholder="Cari kode ICD tersier..."
                />
              </div>

              {/* Keluhan & Riwayat */}
              <div className="form-group">
                <label className="form-label">Keluhan & Riwayat Sekarang</label>
                <textarea
                  value={formData.keluhanRiwayatSekarang}
                  onChange={(e) => setFormData({ ...formData, keluhanRiwayatSekarang: e.target.value })}
                  className="form-input"
                  rows={3}
                  placeholder="Keluhan pasien saat ini..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Riwayat Penyakit Terdahulu</label>
                <textarea
                  value={formData.riwayatPenyakitTerdahulu}
                  onChange={(e) => setFormData({ ...formData, riwayatPenyakitTerdahulu: e.target.value })}
                  className="form-input"
                  rows={2}
                  placeholder="Riwayat penyakit sebelumnya..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Riwayat Sosial & Kebiasaan</label>
                <textarea
                  value={formData.riwayatSosialKebiasaan}
                  onChange={(e) => setFormData({ ...formData, riwayatSosialKebiasaan: e.target.value })}
                  className="form-input"
                  rows={2}
                  placeholder="Kebiasaan merokok, alkohol, dll..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Riwayat Pengobatan</label>
                <textarea
                  value={formData.riwayatPengobatan}
                  onChange={(e) => setFormData({ ...formData, riwayatPengobatan: e.target.value })}
                  className="form-input"
                  rows={2}
                  placeholder="Obat yang sedang dikonsumsi..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pemeriksaan Fisik</label>
                <textarea
                  value={formData.pemeriksaanFisik}
                  onChange={(e) => setFormData({ ...formData, pemeriksaanFisik: e.target.value })}
                  className="form-input"
                  rows={3}
                  placeholder="Hasil pemeriksaan fisik..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Pemeriksaan Tambahan */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Pemeriksaan Tambahan</label>
                  <button
                    type="button"
                    onClick={handleAddExam}
                    className="btn btn-sm btn-secondary"
                  >
                    ➕ Tambah
                  </button>
                </div>
                {additionalExams.map((exam, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={exam.key}
                      onChange={(e) => handleExamChange(index, 'key', e.target.value)}
                      className="form-input"
                      placeholder="Nama pemeriksaan"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="text"
                      value={exam.value}
                      onChange={(e) => handleExamChange(index, 'value', e.target.value)}
                      className="form-input"
                      placeholder="Hasil"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExam(index)}
                      className="btn btn-sm btn-danger"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  disabled={submitting}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {submitting ? (
                    <>
                      <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                      Menyimpan...
                    </>
                  ) : (
                    '💾 Simpan Diagnosa'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
