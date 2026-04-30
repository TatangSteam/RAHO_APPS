'use client';

import { useState } from 'react';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

interface ExportMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSearch?: string;
  currentStatus?: string;
}

export default function ExportMembersModal({
  isOpen,
  onClose,
  currentSearch,
  currentStatus,
}: ExportMembersModalProps) {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'csv' | 'json' | 'xlsx'>('xlsx');
  const [fields, setFields] = useState({
    basicInfo: true,
    contactInfo: true,
    medicalInfo: false,
    packages: false,
    sessions: false,
    diagnosis: false,
  });

  const handleToggleField = (field: keyof typeof fields) => {
    setFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleExport = async () => {
    try {
      setLoading(true);

      if (!accessToken) {
        throw new Error('Token tidak ditemukan. Silakan login kembali.');
      }

      const queryParams = new URLSearchParams();
      if (currentSearch) queryParams.append('search', currentSearch);
      if (currentStatus) queryParams.append('status', currentStatus);
      queryParams.append('format', format);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/members/export?${queryParams.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Gagal export data');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `members-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast.success('Data berhasil di-export');
      onClose();
    } catch (error: any) {
      console.error('Export error:', error);
      showToast.error(error.message || 'Gagal export data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = Object.values(fields).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)] flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Export Data Member
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Pilih data yang ingin di-export
            </p>
          </div>
          <button onClick={onClose} disabled={loading} className="btn-icon">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <label className="form-label mb-3">Format File</label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="xlsx"
                    checked={format === 'xlsx'}
                    onChange={(e) => setFormat(e.target.value as 'xlsx')}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    📊 Excel (XLSX)
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="csv"
                    checked={format === 'csv'}
                    onChange={(e) => setFormat(e.target.value as 'csv')}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    📄 CSV
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    value="json"
                    checked={format === 'json'}
                    onChange={(e) => setFormat(e.target.value as 'json')}
                    className="mr-2"
                    disabled={loading}
                  />
                  <span className="text-sm text-[var(--text-primary)]">
                    🔧 JSON
                  </span>
                </label>
              </div>
            </div>

            {/* Field Selection */}
            <div>
              <label className="form-label mb-3">
                Pilih Data ({selectedCount} dipilih)
              </label>
              <div className="space-y-3">
                {/* Basic Info */}
                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.basicInfo}
                    onChange={() => handleToggleField('basicInfo')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      📋 Informasi Dasar
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      No. Member, Nama, NIK, Tanggal Lahir, Jenis Kelamin, Status, dll
                    </div>
                  </div>
                </label>

                {/* Contact Info */}
                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.contactInfo}
                    onChange={() => handleToggleField('contactInfo')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      📞 Informasi Kontak
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Telepon, Email, Alamat, Kode Pos, Kontak Darurat
                    </div>
                  </div>
                </label>

                {/* Medical Info */}
                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.medicalInfo}
                    onChange={() => handleToggleField('medicalInfo')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      🏥 Informasi Medis
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Sumber Info RAHO, Persetujuan Foto
                    </div>
                  </div>
                </label>

                {/* Packages */}
                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.packages}
                    onChange={() => handleToggleField('packages')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      📦 Data Paket
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Paket Aktif, Sesi Tersisa, Detail Paket
                    </div>
                  </div>
                </label>

                {/* Sessions */}
                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.sessions}
                    onChange={() => handleToggleField('sessions')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      💉 Data Sesi Terapi
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Total Sesi, Sesi Selesai, Sesi Terakhir
                    </div>
                  </div>
                </label>

                {/* Diagnosis */}
                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.diagnosis}
                    onChange={() => handleToggleField('diagnosis')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      🩺 Data Diagnosis
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Total Diagnosis, Diagnosis Terakhir, Kategori
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Info */}
            {(currentSearch || currentStatus) && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-400">
                  💡 Export akan menggunakan filter yang sedang aktif
                  {currentSearch && ` (pencarian: "${currentSearch}")`}
                  {currentStatus && ` (status: ${currentStatus})`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--surface-border)] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || selectedCount === 0}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <span className="spinner w-4 h-4"></span>
                Exporting...
              </>
            ) : (
              <>
                📥 Export {selectedCount > 0 && `(${selectedCount} kategori)`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
