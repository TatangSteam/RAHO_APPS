'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Stethoscope, User, FileText, Info, AlertTriangle, Loader2, ChevronDown, Check, Edit, RefreshCw } from 'lucide-react';
import { diagnosisApi } from '@/lib/diagnosisApi';
import { usersApi } from '@/lib/usersApi';
import type { Diagnosis, CreateDiagnosisInput, DiagnosisCategory } from '@/types/session';
import type { StaffMember } from '@/lib/usersApi';
import { confirm, showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import ICDSearchInput from '@/components/ui/ICDSearchInput';
import { icdApi } from '@/lib/icdApi';
import { devError } from '@/lib/logger';

interface MemberDiagnosesTabProps {
  memberId: string;
  memberBranchId?: string;
  canEdit?: boolean;
}

const DEFAULT_CATEGORY_OPTIONS: { value: DiagnosisCategory; label: string; description: string }[] = [
  { value: 'STROKE', label: 'Stroke', description: 'Gangguan pembuluh darah otak dan pasca stroke' },
  { value: 'JANTUNG_KARDIOVASKULAR', label: 'Jantung Kardiovascular', description: 'Penyakit jantung dan pembuluh darah' },
  { value: 'SINDROM_METABOLIK', label: 'Sindrom Metabolik', description: 'Obesitas, resistensi insulin, dislipidemia, dan hipertensi metabolik' },
  { value: 'KANKER', label: 'Kanker', description: 'Kondisi kanker dan pendampingan terapi terkait' },
  { value: 'DEGENERATIF', label: 'Degeneratif', description: 'Penyakit degeneratif dan penurunan fungsi organ atau jaringan' },
  { value: 'AUTO_IMUN', label: 'Auto Imun', description: 'Gangguan sistem imun yang menyerang jaringan tubuh sendiri' },
  { value: 'LAINNYA', label: 'Lainnya', description: 'Kategori diagnosa lainnya' },
];

const LEGACY_CATEGORY_LABELS: Partial<Record<DiagnosisCategory, string>> = {
  HIPERTENSI: 'Hipertensi',
  NEUROLOGI: 'Neurologi',
  DIABETES: 'Diabetes',
  KARDIOVASKULAR: 'Kardiovaskular',
  ORTOPEDI: 'Ortopedi',
  IMUNOLOGI: 'Imunologi',
  HEMATOLOGI: 'Hematologi',
  ONKOLOGI: 'Onkologi',
};

function getDiagnosisCategoryLabel(
  category: DiagnosisCategory | string | null | undefined,
  options = DEFAULT_CATEGORY_OPTIONS
): string {
  if (!category) return 'Umum';
  return (
    options.find((option) => option.value === category)?.label ||
    LEGACY_CATEGORY_LABELS[category as DiagnosisCategory] ||
    category
  );
}

function getDiagnosisCategories(diagnosis: Pick<Diagnosis, 'kategoriDiagnosa' | 'kategoriDiagnosaList'>): DiagnosisCategory[] {
  if (Array.isArray(diagnosis.kategoriDiagnosaList) && diagnosis.kategoriDiagnosaList.length > 0) {
    return diagnosis.kategoriDiagnosaList;
  }

  return diagnosis.kategoriDiagnosa ? [diagnosis.kategoriDiagnosa] : [];
}

export default function MemberDiagnosesTab({ memberId, memberBranchId, canEdit = true }: MemberDiagnosesTabProps) {
  const { user } = useAuthStore();
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  
  // Nakes/MSO may create an initial diagnosis. Medical corrections to an
  // existing diagnosis are restricted to doctors and enforced again by API.
  const canCreateDiagnosis = Boolean(
    canEdit &&
      user?.role &&
      ['DOCTOR', 'NURSE', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'SUPER_ADMIN'].includes(user.role)
  );
  const canEditDiagnosis = Boolean(canEdit && user?.role === 'DOCTOR');
  const canDeleteDiagnosis = Boolean(
    canEdit &&
      user?.role &&
      ['SUPER_ADMIN'].includes(user.role)
  );
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<Diagnosis | null>(null);
  const [doctors, setDoctors] = useState<StaffMember[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_CATEGORY_OPTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [deletingDiagnosisId, setDeletingDiagnosisId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState<CreateDiagnosisInput>({
    doktorPemeriksa: '',
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
    pemeriksaanTambahan: {}
  });

  // Multiple categories support
  const [selectedCategories, setSelectedCategories] = useState<DiagnosisCategory[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const [additionalExams, setAdditionalExams] = useState<Array<{ key: string; value: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    try {
      setDoctorsLoading(true);
      setDoctorsError(null);
      const branchIdToUse = memberBranchId || user?.branchId || undefined;
      const data = await usersApi.getDoctors(branchIdToUse);
      setDoctors(data);
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load doctors:', error);
      setDoctors([]);
      setDoctorsError('Daftar dokter gagal dimuat.');
    } finally {
      setDoctorsLoading(false);
    }
  }, [memberBranchId, user?.branchId]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      loadDoctors();
    }
  }, [showCreateModal, loadDoctors]);

  useEffect(() => {
    if (showCreateModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showCreateModal]);

  const loadDiagnoses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await diagnosisApi.getMemberDiagnoses(memberId);
      setDiagnoses(data);
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load diagnoses:', error);
      showToast.error('Gagal memuat data diagnosa');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  const loadCategoryOptions = async () => {
    try {
      const data = await diagnosisApi.getCategories();
      if (data.length > 0) {
        setCategoryOptions(
          data.map((category) => ({
            value: category.value as DiagnosisCategory,
            label: category.label,
            description: category.description,
          }))
        );
      }
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load diagnosis categories:', error);
      setCategoryOptions(DEFAULT_CATEGORY_OPTIONS);
    }
  };

  useEffect(() => {
    void loadDiagnoses();
    void loadCategoryOptions();
  }, [loadDiagnoses, memberId]);

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

  const toggleCategory = (category: DiagnosisCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((selectedCategory) => selectedCategory !== category)
        : [...prev, category]
    );
  };

  const getCategoryLabel = (category: DiagnosisCategory | string | null | undefined) =>
    getDiagnosisCategoryLabel(category, categoryOptions);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.doktorPemeriksa || !formData.diagnosa) {
      setError('Dokter pemeriksa dan diagnosa wajib diisi');
      return;
    }

    if (formData.diagnosa.length < 3) {
      setError('Diagnosa minimal 3 karakter');
      return;
    }

    try {
      setSubmitting(true);

      const pemeriksaanTambahan: Record<string, string> = {};
      additionalExams.forEach(exam => {
        if (exam.key && exam.value) {
          pemeriksaanTambahan[exam.key] = exam.value;
        }
      });

      const primaryCategory = selectedCategories.length > 0 ? selectedCategories[0] : undefined;
      
      const payload: CreateDiagnosisInput = {
        ...formData,
        kategoriDiagnosa: primaryCategory,
        kategoriDiagnosaList: selectedCategories,
        icdPrimer: formData.icdPrimer ? icdApi.completeICDCode(formData.icdPrimer) : undefined,
        icdSekunder: formData.icdSekunder ? icdApi.completeICDCode(formData.icdSekunder) : undefined,
        icdTersier: formData.icdTersier ? icdApi.completeICDCode(formData.icdTersier) : undefined,
        pemeriksaanTambahan: Object.keys(pemeriksaanTambahan).length > 0 ? pemeriksaanTambahan : undefined
      };

      if (editingDiagnosis) {
        // Update existing diagnosis
        await diagnosisApi.updateDiagnosis(memberId, editingDiagnosis.id, payload);
        showToast.success('Diagnosa berhasil diperbarui');
      } else {
        // Create new diagnosis
        await diagnosisApi.createDiagnosis(memberId, payload);
        showToast.success('Diagnosa berhasil dibuat');
      }
      
      setShowCreateModal(false);
      setEditingDiagnosis(null);
      resetForm();
      loadDiagnoses();
    } catch (error) {
      assertCaughtError(error);
      setError(error.response?.data?.error?.message || `Gagal ${editingDiagnosis ? 'memperbarui' : 'membuat'} diagnosa`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      doktorPemeriksa: '',
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
      pemeriksaanTambahan: {}
    });
    setSelectedCategories([]);
    setAdditionalExams([]);
    setError(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setEditingDiagnosis(null);
    setShowCreateModal(true);
  };

  const handleEditDiagnosis = (diagnosis: Diagnosis) => {
    // Pre-fill form with diagnosis data
    setFormData({
      doktorPemeriksa: diagnosis.doktorPemeriksa,
      diagnosa: diagnosis.diagnosa,
      kategoriDiagnosa: diagnosis.kategoriDiagnosa || undefined,
      kategoriDiagnosaList: getDiagnosisCategories(diagnosis),
      icdPrimer: diagnosis.icdPrimer || '',
      icdSekunder: diagnosis.icdSekunder || '',
      icdTersier: diagnosis.icdTersier || '',
      keluhanRiwayatSekarang: diagnosis.keluhanRiwayatSekarang || '',
      riwayatPenyakitTerdahulu: diagnosis.riwayatPenyakitTerdahulu || '',
      riwayatSosialKebiasaan: diagnosis.riwayatSosialKebiasaan || '',
      riwayatPengobatan: diagnosis.riwayatPengobatan || '',
      pemeriksaanFisik: diagnosis.pemeriksaanFisik || '',
      pemeriksaanTambahan: diagnosis.pemeriksaanTambahan || {}
    });

    setSelectedCategories(getDiagnosisCategories(diagnosis));

    // Set additional exams
    if (diagnosis.pemeriksaanTambahan && typeof diagnosis.pemeriksaanTambahan === 'object') {
      const exams = Object.entries(diagnosis.pemeriksaanTambahan).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      setAdditionalExams(exams);
    } else {
      setAdditionalExams([]);
    }

    setEditingDiagnosis(diagnosis);
    setShowCreateModal(true);
  };

  const handleDeleteDiagnosis = async (diagnosis: Diagnosis) => {
    const confirmed = await confirm.show({
      title: 'Hapus Diagnosa',
      message: `Hapus diagnosa ${diagnosis.diagnosisCode}? Data yang dihapus tidak bisa dipulihkan.`,
      variant: 'danger',
      confirmText: 'Hapus Diagnosa',
      cancelText: 'Batal',
    });

    if (!confirmed) return;

    setDeletingDiagnosisId(diagnosis.id);
    try {
      await diagnosisApi.deleteDiagnosis(memberId, diagnosis.id);
      showToast.success('Diagnosa berhasil dihapus');
      await loadDiagnoses();
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to delete diagnosis:', error);
      showToast.error(
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        'Gagal menghapus diagnosa'
      );
    } finally {
      setDeletingDiagnosisId(null);
    }
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setShowCreateModal(false);
      setEditingDiagnosis(null);
      resetForm();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
        <p className="text-neutral-500 dark:text-neutral-400">Memuat data diagnosa...</p>
      </div>
    );
  }

  // Modal content
  const modalContent = showCreateModal && mounted ? (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCloseModal} />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {editingDiagnosis ? 'Edit Diagnosa' : 'Buat Diagnosa Baru'}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {editingDiagnosis ? 'Perbarui data diagnosa member' : 'Isi data diagnosa untuk member'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseModal}
              disabled={submitting}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} id="create-diagnosis-form" className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Dokter Pemeriksa */}
            <div className="space-y-2">
              <label htmlFor="diagnosis-doctor" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                <User className="h-4 w-4" /> Dokter Pemeriksa <span className="text-red-500">*</span>
              </label>
              <select
                id="diagnosis-doctor"
                value={formData.doktorPemeriksa}
                onChange={(e) => setFormData({ ...formData, doktorPemeriksa: e.target.value })}
                className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                disabled={doctorsLoading || Boolean(doctorsError) || doctors.length === 0}
                aria-busy={doctorsLoading}
                required
              >
                <option value="">
                  {doctorsLoading
                    ? 'Memuat daftar dokter...'
                    : doctorsError
                      ? 'Daftar dokter gagal dimuat'
                      : doctors.length === 0
                        ? 'Belum ada dokter aktif di cabang ini'
                        : 'Pilih dokter...'}
                </option>
                {doctors.map((doctor) => (
                  <option key={doctor.userId} value={doctor.userId}>
                    {doctor.fullName} ({doctor.staffCode})
                  </option>
                ))}
              </select>
              {doctorsError && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-500/30 dark:bg-red-500/10">
                  <p className="text-xs text-red-700 dark:text-red-300">{doctorsError}</p>
                  <button
                    type="button"
                    onClick={loadDoctors}
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-500/20"
                    title="Muat ulang daftar dokter"
                    aria-label="Muat ulang daftar dokter"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Diagnosa */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                <FileText className="h-4 w-4" /> Diagnosa <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.diagnosa}
                onChange={(e) => setFormData({ ...formData, diagnosa: e.target.value })}
                className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                rows={3}
                placeholder="Masukkan diagnosa (minimal 3 karakter)"
                required
                minLength={3}
              />
            </div>

            {/* Kategori Diagnosa */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Kategori Diagnosa
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all flex items-center justify-between"
                >
                  <span className={selectedCategories.length === 0 ? 'text-neutral-400' : ''}>
                    {selectedCategories.length === 0 
                      ? 'Pilih kategori...' 
                      : selectedCategories.map(getCategoryLabel).join(', ')}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showCategoryDropdown && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {categoryOptions.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => toggleCategory(cat.value)}
                        className="w-full px-4 py-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">{cat.label}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">{cat.description}</p>
                        </div>
                        {selectedCategories.includes(cat.value) && (
                          <Check className="h-4 w-4 text-amber-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Selected Categories Tags */}
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedCategories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                    >
                      {getCategoryLabel(cat)}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ICD Codes - Stacked vertically */}
            <div className="space-y-4">
              <ICDSearchInput
                label="ICD Primer"
                value={formData.icdPrimer || ''}
                onChange={(value) => setFormData({ ...formData, icdPrimer: value })}
                placeholder="Cari kode ICD primer..."
                category={selectedCategories[0]}
              />
              <ICDSearchInput
                label="ICD Sekunder"
                value={formData.icdSekunder || ''}
                onChange={(value) => setFormData({ ...formData, icdSekunder: value })}
                placeholder="Cari kode ICD sekunder..."
                category={selectedCategories[0]}
              />
              <ICDSearchInput
                label="ICD Tersier"
                value={formData.icdTersier || ''}
                onChange={(value) => setFormData({ ...formData, icdTersier: value })}
                placeholder="Cari kode ICD tersier..."
                category={selectedCategories[0]}
              />
            </div>

            {/* Keluhan & Riwayat */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Keluhan & Riwayat Sekarang
              </label>
              <textarea
                value={formData.keluhanRiwayatSekarang}
                onChange={(e) => setFormData({ ...formData, keluhanRiwayatSekarang: e.target.value })}
                className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                rows={3}
                placeholder="Keluhan pasien saat ini..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Riwayat Penyakit Terdahulu
                </label>
                <textarea
                  value={formData.riwayatPenyakitTerdahulu}
                  onChange={(e) => setFormData({ ...formData, riwayatPenyakitTerdahulu: e.target.value })}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                  placeholder="Riwayat penyakit sebelumnya..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Riwayat Sosial & Kebiasaan
                </label>
                <textarea
                  value={formData.riwayatSosialKebiasaan}
                  onChange={(e) => setFormData({ ...formData, riwayatSosialKebiasaan: e.target.value })}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                  placeholder="Kebiasaan merokok, alkohol, dll..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Riwayat Pengobatan
                </label>
                <textarea
                  value={formData.riwayatPengobatan}
                  onChange={(e) => setFormData({ ...formData, riwayatPengobatan: e.target.value })}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                  placeholder="Obat yang sedang dikonsumsi..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Pemeriksaan Fisik
                </label>
                <textarea
                  value={formData.pemeriksaanFisik}
                  onChange={(e) => setFormData({ ...formData, pemeriksaanFisik: e.target.value })}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                  rows={2}
                  placeholder="Hasil pemeriksaan fisik..."
                />
              </div>
            </div>

            {/* Pemeriksaan Tambahan */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Pemeriksaan Tambahan
                </label>
                <button
                  type="button"
                  onClick={handleAddExam}
                  className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Tambah
                </button>
              </div>
              {additionalExams.map((exam, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={exam.key}
                    onChange={(e) => handleExamChange(index, 'key', e.target.value)}
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Nama pemeriksaan"
                  />
                  <input
                    type="text"
                    value={exam.value}
                    onChange={(e) => handleExamChange(index, 'value', e.target.value)}
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    placeholder="Hasil"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExam(index)}
                    className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Info Box */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">Informasi</p>
                <p className="text-amber-600 dark:text-amber-400">
                  Diagnosa wajib dibuat sebelum memulai sesi terapi. Pilih satu atau lebih kategori diagnosa yang paling sesuai.
                </p>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50 flex-shrink-0 rounded-b-2xl">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all disabled:opacity-50 flex-1"
            >
              Batal
            </button>
            <button
              type="submit"
              form="create-diagnosis-form"
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingDiagnosis ? 'Memperbarui...' : 'Menyimpan...'}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {editingDiagnosis ? 'Update Diagnosa' : 'Simpan Diagnosa'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-amber-500" />
            Diagnosa Member
          </h3>
          {canCreateDiagnosis && (
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 transition-all"
            >
              <Plus className="h-4 w-4" />
              Buat Diagnosa
            </button>
          )}
        </div>

        {diagnoses.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/20 mx-auto mb-4">
              <Stethoscope className="h-8 w-8 text-amber-500" />
            </div>
            <p className="text-base font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Belum ada diagnosa
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              Diagnosa wajib dibuat sebelum memulai sesi terapi
            </p>
            {canCreateDiagnosis && (
              <button
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                Buat Diagnosa Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {diagnoses.map((diagnosis) => (
              <div key={diagnosis.id} className="p-5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-mono text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-1">
                      {diagnosis.diagnosisCode}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {new Date(diagnosis.createdAt).toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getDiagnosisCategories(diagnosis).map((category) => (
                      <span
                        key={category}
                        className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
                      >
                        {getCategoryLabel(category)}
                      </span>
                    ))}
                    {canEditDiagnosis && (
                      <button
                        onClick={() => handleEditDiagnosis(diagnosis)}
                        className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
                        title="Edit Diagnosa"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {canDeleteDiagnosis && (
                      <button
                        onClick={() => void handleDeleteDiagnosis(diagnosis)}
                        disabled={deletingDiagnosisId === diagnosis.id}
                        className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        title="Hapus Diagnosa"
                      >
                        {deletingDiagnosisId === diagnosis.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Dokter Pemeriksa</p>
                  <p className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    <User className="h-4 w-4 text-amber-500" />
                    {doctors.find(d => d.userId === diagnosis.doktorPemeriksa)?.fullName || diagnosis.doktorPemeriksa}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Diagnosa</p>
                  <p className="font-semibold text-neutral-900 dark:text-white">{diagnosis.diagnosa}</p>
                </div>

                {(diagnosis.icdPrimer || diagnosis.icdSekunder || diagnosis.icdTersier) && (
                  <div className="mb-4">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Kode ICD</p>
                    <div className="flex flex-wrap gap-2">
                      {diagnosis.icdPrimer && (
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                          Primer: {diagnosis.icdPrimer}
                        </span>
                      )}
                      {diagnosis.icdSekunder && (
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400">
                          Sekunder: {diagnosis.icdSekunder}
                        </span>
                      )}
                      {diagnosis.icdTersier && (
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400">
                          Tersier: {diagnosis.icdTersier}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {diagnosis.keluhanRiwayatSekarang && (
                  <div className="mb-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Keluhan & Riwayat Sekarang</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{diagnosis.keluhanRiwayatSekarang}</p>
                  </div>
                )}

                {diagnosis.riwayatPenyakitTerdahulu && (
                  <div className="mb-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Riwayat Penyakit Terdahulu</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{diagnosis.riwayatPenyakitTerdahulu}</p>
                  </div>
                )}

                {diagnosis.riwayatSosialKebiasaan && (
                  <div className="mb-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Riwayat Sosial & Kebiasaan</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{diagnosis.riwayatSosialKebiasaan}</p>
                  </div>
                )}

                {diagnosis.riwayatPengobatan && (
                  <div className="mb-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Riwayat Pengobatan</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{diagnosis.riwayatPengobatan}</p>
                  </div>
                )}

                {diagnosis.pemeriksaanFisik && (
                  <div className="mb-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Pemeriksaan Fisik</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{diagnosis.pemeriksaanFisik}</p>
                  </div>
                )}

                {diagnosis.pemeriksaanTambahan && Object.keys(diagnosis.pemeriksaanTambahan).length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Pemeriksaan Tambahan</p>
                    <div className="space-y-1">
                      {Object.entries(diagnosis.pemeriksaanTambahan).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm">
                          <span className="font-medium text-neutral-600 dark:text-neutral-400">{key}:</span>
                          <span className="text-neutral-700 dark:text-neutral-300">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
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

      {/* Portal for Modal */}
      {mounted && showCreateModal && createPortal(modalContent, document.body)}
    </>
  );
}
