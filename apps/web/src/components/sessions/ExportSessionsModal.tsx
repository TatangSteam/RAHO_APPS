'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect } from 'react';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { usersApi, type StaffMember } from '@/lib/usersApi';
import { devError } from '@/lib/logger';

interface ExportSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    pelaksanaan?: string;
    doctorId?: string;
  };
}

export default function ExportSessionsModal({
  isOpen,
  onClose,
  currentFilters,
}: ExportSessionsModalProps) {
  const { accessToken, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'csv' | 'json' | 'xlsx'>('xlsx');
  const [groupBy, setGroupBy] = useState<'date' | 'member' | 'doctor' | 'none'>('none');
  const [fields, setFields] = useState({
    basicInfo: true,
    memberInfo: true,
    staffInfo: true,
    vitalSigns: false,
    therapyPlan: false,
    infusion: false,
    materials: false,
    evaluation: false,
  });

  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [pelaksanaan, setPelaksanaan] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<StaffMember[]>([]);

  const loadDoctors = useCallback(async () => {
    try {
      const doctorsList = await usersApi.getDoctors(user?.branchId || undefined);
      setDoctors(doctorsList);
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load doctors:', error);
    }
  }, [user?.branchId]);

  useEffect(() => {
    if (isOpen) {
      void loadDoctors();
      // Set current filters if provided
      if (currentFilters) {
        setDateFrom(currentFilters.dateFrom || '');
        setDateTo(currentFilters.dateTo || '');
        setStatus(currentFilters.status || '');
        setPelaksanaan(currentFilters.pelaksanaan || '');
        setDoctorId(currentFilters.doctorId || '');
      }
    }
  }, [currentFilters, isOpen, loadDoctors]);

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
      queryParams.append('format', format);
      queryParams.append('groupBy', groupBy);

      const filters: {
        dateFrom?: string;
        dateTo?: string;
        status?: string;
        pelaksanaan?: string;
        doctorId?: string;
      } = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (status) filters.status = status;
      if (pelaksanaan) filters.pelaksanaan = pelaksanaan;
      if (doctorId) filters.doctorId = doctorId;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/treatment-sessions/export?${queryParams.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields, filters }),
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
      a.download = `sessions-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast.success('Data berhasil di-export');
      onClose();
    } catch (error) {
      assertCaughtError(error);
      devError('Export error:', error);
      showToast.error(error.message || 'Gagal export data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = Object.values(fields).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-3xl w-full max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)] flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Export Data Sesi Terapi
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Pilih data dan filter yang ingin di-export
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
            {/* Format & Grouping */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label mb-3">Format File</label>
                <div className="space-y-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="xlsx"
                      checked={format === 'xlsx'}
                      onChange={(e) => setFormat(e.target.value as 'xlsx')}
                      className="mr-2"
                      disabled={loading}
                    />
                    <span className="text-sm">📊 Excel (XLSX)</span>
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
                    <span className="text-sm">📄 CSV</span>
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
                    <span className="text-sm">🔧 JSON</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="form-label mb-3">Grouping</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                  className="form-input"
                  disabled={loading}
                >
                  <option value="none">Tanpa Grouping</option>
                  <option value="date">Per Tanggal</option>
                  <option value="member">Per Member</option>
                  <option value="doctor">Per Dokter</option>
                </select>
              </div>
            </div>

            {/* Filters */}
            <div>
              <label className="form-label mb-3">Filter Data</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  >
                    <option value="">Semua</option>
                    <option value="completed">Selesai</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    Pelaksanaan
                  </label>
                  <select
                    value={pelaksanaan}
                    onChange={(e) => setPelaksanaan(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  >
                    <option value="">Semua</option>
                    <option value="ON_SITE">On Site</option>
                    <option value="HOME_CARE">Home Care</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    Dokter
                  </label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  >
                    <option value="">Semua Dokter</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.userId} value={doctor.userId}>
                        {doctor.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Field Selection */}
            <div>
              <label className="form-label mb-3">
                Pilih Data ({selectedCount} dipilih)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.basicInfo}
                    onChange={() => handleToggleField('basicInfo')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">📋 Info Dasar</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Kode, Tanggal, Status, Cabang
                    </div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.memberInfo}
                    onChange={() => handleToggleField('memberInfo')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">👤 Info Member</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Nama, No. Member, Paket
                    </div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.staffInfo}
                    onChange={() => handleToggleField('staffInfo')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">👨‍⚕️ Info Staff</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Admin, Dokter, Nakes
                    </div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.vitalSigns}
                    onChange={() => handleToggleField('vitalSigns')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">💓 Vital Signs</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Sebelum & Sesudah
                    </div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.therapyPlan}
                    onChange={() => handleToggleField('therapyPlan')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">📝 Therapy Plan</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Rencana terapi
                    </div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.infusion}
                    onChange={() => handleToggleField('infusion')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">💉 Infusion Aktual</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Data infus aktual
                    </div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.materials}
                    onChange={() => handleToggleField('materials')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">📦 Material Usage</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      Material yang digunakan
                    </div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer p-3 rounded-lg border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                  <input
                    type="checkbox"
                    checked={fields.evaluation}
                    onChange={() => handleToggleField('evaluation')}
                    className="mt-1 mr-3"
                    disabled={loading}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">🩺 Evaluasi Dokter</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      SOAP & catatan
                    </div>
                  </div>
                </label>
              </div>
            </div>
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
