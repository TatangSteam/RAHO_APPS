'use client';

import { useState, useEffect } from 'react';
import { FileText, Upload, Download, Trash2, Calendar, User, Loader2, AlertCircle, X } from 'lucide-react';
import { labResultsApi } from '@/lib/labResultsApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

interface LabResult {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  description: string | null;
  labDate: string | null;
  uploadedBy: string;
  uploadedByUser: {
    profile: {
      fullName: string;
    };
  };
  createdAt: string;
}

interface MemberLabResultsTabProps {
  memberId: string;
}

export default function MemberLabResultsTab({ memberId }: MemberLabResultsTabProps) {
  const { user } = useAuthStore();
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [labDate, setLabDate] = useState('');

  // Check if current user can upload/delete lab results
  // Upload: All staff can upload
  const canUpload = user?.role && ['DOCTOR', 'NURSE', 'ADMIN_LAYANAN', 'ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  // Delete: Only ADMIN_MANAGER and SUPER_ADMIN
  const canDelete = user?.role && ['ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user.role);

  useEffect(() => {
    loadLabResults();
  }, [memberId]);

  const loadLabResults = async () => {
    try {
      setLoading(true);
      const data = await labResultsApi.getMemberLabResults(memberId);
      setLabResults(data);
    } catch (error) {
      console.error('Failed to load lab results:', error);
      showToast.error('Gagal memuat hasil lab');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(selectedFile.type)) {
      showToast.error('Format file harus PDF, JPG, atau PNG');
      return;
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 10MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      showToast.error('Pilih file terlebih dahulu');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      if (labDate) {
        formData.append('labDate', labDate);
      }

      await labResultsApi.uploadLabResult(memberId, formData);
      showToast.success('Hasil lab berhasil diupload');
      setShowUploadModal(false);
      resetForm();
      loadLabResults();
    } catch (error: any) {
      console.error('Upload failed:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (labResultId: string) => {
    if (!confirm('Yakin ingin menghapus hasil lab ini?')) return;

    try {
      await labResultsApi.deleteLabResult(memberId, labResultId);
      showToast.success('Hasil lab berhasil dihapus');
      loadLabResults();
    } catch (error: any) {
      console.error('Delete failed:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal menghapus file');
    }
  };

  const resetForm = () => {
    setFile(null);
    setDescription('');
    setLabDate('');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') return '📄';
    if (fileType.startsWith('image/')) return '🖼️';
    return '📁';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
        <p className="text-neutral-500 dark:text-neutral-400">Memuat hasil lab...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-500" />
          Hasil Lab
        </h3>
        {canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 transition-all"
          >
            <Upload className="h-4 w-4" />
            Upload Hasil Lab
          </button>
        )}
      </div>

      {labResults.length === 0 ? (
        <div className="text-center py-12 px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/20 mx-auto mb-4">
            <FileText className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Belum ada hasil lab
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Upload file hasil laboratorium member di sini
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {labResults.map((result) => (
            <div
              key={result.id}
              className="p-4 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl">{getFileIcon(result.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 dark:text-white truncate">
                      {result.fileName}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatFileSize(result.fileSize)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <a
                    href={result.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors"
                    title="Download/View"
                  >
                    <Download size={14} />
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(result.id)}
                      className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {result.description && (
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  {result.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                {result.labDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(result.labDate).toLocaleDateString('id-ID')}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User size={12} />
                  {result.uploadedByUser.profile.fullName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                Upload Hasil Lab
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                disabled={uploading}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  File (PDF, JPG, PNG - Max 10MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
                {file && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ {file.name} ({formatFileSize(file.size)})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Tanggal Lab (Opsional)
                </label>
                <input
                  type="date"
                  value={labDate}
                  onChange={(e) => setLabDate(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Keterangan
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg resize-none bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  rows={3}
                  placeholder="Contoh: Hasil lab darah lengkap, kolesterol tinggi"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                disabled={uploading}
                className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300"
              >
                Batal
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
