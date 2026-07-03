'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { branchesApi } from '@/lib/api/branchesApi';
import { devError } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

interface ExportMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSearch?: string;
  currentStatus?: string;
}

interface Branch {
  id: string;
  branchCode: string;
  name: string;
}

type QuickExportPreset = 'all' | 'summary' | 'active-packages' | 'new-members';
type GroupByOption = 'none' | 'branch' | 'packageType' | 'registrationMonth' | 'gender' | 'referral';
type SortByOption = 'memberNo' | 'fullName' | 'createdAt' | 'lastTherapyDate';
type SortOrder = 'asc' | 'desc';

interface ExportColumn {
  key: string;
  label: string;
  category: 'basic' | 'contact' | 'package' | 'medical' | 'referral' | 'therapy';
}

interface ExportFilters {
  branchIds: string[];
  status: string;
  dateRange: { start: string; end: string };
  packageTypes: string[];
  gender: string;
  ageRange: { min: number | null; max: number | null };
  referralCodeId: string;
  search: string;
}

interface ExportOptions {
  columns: string[];
  groupBy: GroupByOption;
  sortBy: SortByOption;
  sortOrder: SortOrder;
  includeSubtotals: boolean;
  includeGrandTotal: boolean;
}

// ============================================================
// COLUMN DEFINITIONS
// ============================================================

const EXPORT_COLUMNS: ExportColumn[] = [
  // Data Dasar
  { key: 'memberNo', label: 'No. Member', category: 'basic' },
  { key: 'fullName', label: 'Nama Lengkap', category: 'basic' },
  { key: 'nik', label: 'Identitas', category: 'basic' },
  { key: 'birthPlace', label: 'Tempat Lahir', category: 'basic' },
  { key: 'birthDate', label: 'Tanggal Lahir', category: 'basic' },
  { key: 'age', label: 'Umur', category: 'basic' },
  { key: 'gender', label: 'Jenis Kelamin', category: 'basic' },
  { key: 'maritalStatus', label: 'Status Nikah', category: 'basic' },
  { key: 'occupation', label: 'Pekerjaan', category: 'basic' },
  { key: 'registrationBranch', label: 'Cabang Registrasi', category: 'basic' },
  { key: 'status', label: 'Status', category: 'basic' },
  { key: 'lifeStatus', label: 'Status Meninggal', category: 'basic' },
  { key: 'registrationDate', label: 'Tanggal Registrasi', category: 'basic' },
  // Kontak
  { key: 'phone', label: 'Telepon', category: 'contact' },
  { key: 'email', label: 'Username Login', category: 'contact' },
  { key: 'address', label: 'Alamat', category: 'contact' },
  { key: 'postalCode', label: 'Kode Pos', category: 'contact' },
  { key: 'emergencyContact', label: 'Kontak Darurat', category: 'contact' },
  // Paket
  { key: 'activePackageCount', label: 'Jumlah Paket Aktif', category: 'package' },
  { key: 'totalRemainingSessions', label: 'Total Sesi Tersisa', category: 'package' },
  { key: 'packageDetails', label: 'Detail Paket', category: 'package' },
  // Medis
  { key: 'infoSource', label: 'Sumber Info RAHO', category: 'medical' },
  { key: 'photoConsent', label: 'Persetujuan Foto', category: 'medical' },
  { key: 'diagnosisCount', label: 'Jumlah Diagnosis', category: 'medical' },
  { key: 'latestDiagnosis', label: 'Diagnosis Terakhir', category: 'medical' },
  // Referral
  { key: 'referralCode', label: 'Kode Referral', category: 'referral' },
  { key: 'referrerName', label: 'Nama Referrer', category: 'referral' },
  { key: 'referrerType', label: 'Tipe Referrer', category: 'referral' },
  // Data Terapi
  { key: 'totalTherapySessions', label: 'Total Sesi Terapi', category: 'therapy' },
  { key: 'completedSessions', label: 'Sesi Selesai', category: 'therapy' },
  { key: 'lastTherapyDate', label: 'Tanggal Terapi Terakhir', category: 'therapy' },
];

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
  basic: { label: 'Data Dasar', icon: '📋' },
  contact: { label: 'Kontak', icon: '📞' },
  package: { label: 'Paket', icon: '📦' },
  medical: { label: 'Medis', icon: '🏥' },
  referral: { label: 'Referral', icon: '🔗' },
  therapy: { label: 'Data Terapi', icon: '💉' },
};

const QUICK_PRESETS: Record<QuickExportPreset, { label: string; icon: string; desc: string; columns: string[] }> = {
  all: {
    label: 'Semua Data',
    icon: '📊',
    desc: 'Export semua kolom data member',
    columns: EXPORT_COLUMNS.map(c => c.key),
  },
  summary: {
    label: 'Ringkasan',
    icon: '📝',
    desc: 'Data dasar dan kontak saja',
    columns: ['memberNo', 'fullName', 'phone', 'email', 'registrationBranch', 'status', 'registrationDate'],
  },
  'active-packages': {
    label: 'Data Paket Aktif',
    icon: '📦',
    desc: 'Member dengan paket aktif',
    columns: ['memberNo', 'fullName', 'phone', 'registrationBranch', 'activePackageCount', 'totalRemainingSessions', 'packageDetails'],
  },
  'new-members': {
    label: 'Member Baru',
    icon: '🆕',
    desc: 'Member terdaftar bulan ini',
    columns: ['memberNo', 'fullName', 'phone', 'email', 'registrationBranch', 'registrationDate', 'referralCode', 'referrerName'],
  },
};

// ============================================================
// COMPONENT
// ============================================================

export default function ExportMembersModal({
  isOpen,
  onClose,
  currentSearch,
  currentStatus,
}: ExportMembersModalProps) {
  const { accessToken, user } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeTab, setActiveTab] = useState<'quick' | 'custom'>('quick');
  const [selectedPreset, setSelectedPreset] = useState<QuickExportPreset | null>('summary');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['basic']);
  
  const [filters, setFilters] = useState<ExportFilters>({
    branchIds: [],
    status: currentStatus || '',
    dateRange: { start: '', end: '' },
    packageTypes: [],
    gender: '',
    ageRange: { min: null, max: null },
    referralCodeId: '',
    search: currentSearch || '',
  });
  
  const [options, setOptions] = useState<ExportOptions>({
    columns: QUICK_PRESETS.summary.columns,
    groupBy: 'none',
    sortBy: 'memberNo',
    sortOrder: 'asc',
    includeSubtotals: false,
    includeGrandTotal: false,
  });
  
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER')) {
      loadBranches();
    }
  }, [isOpen, user?.role]);

  useEffect(() => {
    if (isOpen && activeTab === 'custom') {
      const timer = setTimeout(() => loadPreviewCount(), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, filters]);

  const loadBranches = async () => {
    try {
      const response = await branchesApi.getAllBranches();
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      setBranches(data.map((b: any) => ({ id: b.id, branchCode: b.branchCode, name: b.name })));
    } catch (error) {
      devError('Failed to load branches:', error);
    }
  };

  const loadPreviewCount = async () => {
    try {
      setLoadingPreview(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/members/export/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewCount(data.data.count);
      }
    } catch (error) {
      devError('Failed to load preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const columnsByCategory = useMemo(() => {
    const grouped: Record<string, ExportColumn[]> = {};
    EXPORT_COLUMNS.forEach(col => {
      if (!grouped[col.category]) grouped[col.category] = [];
      grouped[col.category].push(col);
    });
    return grouped;
  }, []);

  const handlePresetSelect = (preset: QuickExportPreset) => {
    setSelectedPreset(preset);
    setOptions(prev => ({ ...prev, columns: QUICK_PRESETS[preset].columns }));
  };

  const handleColumnToggle = (columnKey: string) => {
    setOptions(prev => ({
      ...prev,
      columns: prev.columns.includes(columnKey)
        ? prev.columns.filter(c => c !== columnKey)
        : [...prev.columns, columnKey],
    }));
    setSelectedPreset(null);
  };

  const handleCategoryToggle = (category: string) => {
    const categoryColumns = columnsByCategory[category]?.map(c => c.key) || [];
    const allSelected = categoryColumns.every(key => options.columns.includes(key));
    setOptions(prev => ({
      ...prev,
      columns: allSelected
        ? prev.columns.filter(c => !categoryColumns.includes(c))
        : Array.from(new Set([...prev.columns, ...categoryColumns])),
    }));
    setSelectedPreset(null);
  };

  const toggleCategoryExpand = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      if (!accessToken) throw new Error('Token tidak ditemukan. Silakan login kembali.');

      const exportPayload = {
        filters: activeTab === 'quick' ? { search: currentSearch || '', status: currentStatus || '', preset: selectedPreset } : filters,
        options: {
          ...options,
          columns: activeTab === 'quick' && selectedPreset ? QUICK_PRESETS[selectedPreset].columns : options.columns,
        },
        format,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/members/export`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(exportPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Gagal export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `members-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast.success('Data berhasil di-export');
      onClose();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal export data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const selectedColumnCount = activeTab === 'quick' && selectedPreset
    ? QUICK_PRESETS[selectedPreset].columns.length
    : options.columns.length;

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700/50 bg-gradient-to-r from-zinc-900 to-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Export Builder</h2>
              <p className="text-sm text-zinc-400">Kustomisasi data member untuk di-export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 bg-zinc-900">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'quick'
                ? 'bg-zinc-800 text-amber-400 border-t border-x border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Export
            </span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
              activeTab === 'custom'
                ? 'bg-zinc-800 text-amber-400 border-t border-x border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Custom Export
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-zinc-800 p-6">
          {activeTab === 'quick' ? (
            <div className="space-y-6">
              {/* Preset Cards */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">Pilih Template Export</label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(QUICK_PRESETS) as [QuickExportPreset, typeof QUICK_PRESETS['all']][]).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => handlePresetSelect(key)}
                      className={`group relative p-4 rounded-xl text-left transition-all duration-200 ${
                        selectedPreset === key
                          ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10'
                          : 'bg-zinc-700/30 border border-zinc-600/50 hover:border-amber-500/30 hover:bg-zinc-700/50'
                      }`}
                    >
                      {selectedPreset === key && (
                        <div className="absolute top-3 right-3">
                          <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{preset.icon}</span>
                        <span className={`font-semibold ${selectedPreset === key ? 'text-amber-400' : 'text-zinc-200'}`}>
                          {preset.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mb-2">{preset.desc}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          selectedPreset === key ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-600/50 text-zinc-400'
                        }`}>
                          {preset.columns.length} kolom
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Filter Info */}
              {(currentSearch || currentStatus) && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm text-blue-300 font-medium">Filter Aktif</p>
                    <p className="text-xs text-blue-400/80 mt-1">
                      Export akan menggunakan filter yang sedang aktif
                      {currentSearch && <span className="ml-1">(pencarian: &quot;{currentSearch}&quot;)</span>}
                      {currentStatus && <span className="ml-1">(status: {currentStatus})</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Custom Export Tab */
            <div className="space-y-6">
              {/* Filters Section */}
              <div className="rounded-xl bg-zinc-700/30 border border-zinc-600/50 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-700/50 border-b border-zinc-600/50">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filter Data
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  {/* Branch Filter */}
                  {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER') && branches.length > 0 && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Cabang</label>
                      <div className="flex flex-wrap gap-2">
                        {branches.map(branch => (
                          <button
                            key={branch.id}
                            onClick={() => setFilters(prev => ({
                              ...prev,
                              branchIds: prev.branchIds.includes(branch.id)
                                ? prev.branchIds.filter(id => id !== branch.id)
                                : [...prev.branchIds, branch.id],
                            }))}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                              filters.branchIds.includes(branch.id)
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'border-zinc-600 text-zinc-400 hover:border-amber-500/30 hover:text-zinc-300'
                            }`}
                          >
                            {branch.name}
                          </button>
                        ))}
                      </div>
                      {filters.branchIds.length === 0 && (
                        <p className="text-xs text-zinc-500 mt-2">Semua cabang akan di-export</p>
                      )}
                    </div>
                  )}

                  {/* Status & Gender */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                    >
                      <option value="">Semua Status</option>
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Jenis Kelamin</label>
                    <select
                      value={filters.gender}
                      onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                    >
                      <option value="">Semua</option>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>

                  {/* Date Range */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Registrasi Dari</label>
                    <input
                      type="date"
                      value={filters.dateRange.start}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, start: e.target.value } }))}
                      className="w-full px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Sampai</label>
                    <input
                      type="date"
                      value={filters.dateRange.end}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, end: e.target.value } }))}
                      className="w-full px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                    />
                  </div>

                  {/* Package Type */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Tipe Paket</label>
                    <div className="flex gap-2">
                      {['BASIC', 'BOOSTER'].map(type => (
                        <button
                          key={type}
                          onClick={() => setFilters(prev => ({
                            ...prev,
                            packageTypes: prev.packageTypes.includes(type)
                              ? prev.packageTypes.filter(t => t !== type)
                              : [...prev.packageTypes, type],
                          }))}
                          className={`px-4 py-2 text-xs rounded-lg border transition-all ${
                            filters.packageTypes.includes(type)
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                              : 'border-zinc-600 text-zinc-400 hover:border-amber-500/30'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Age Range */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Usia Minimal</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      placeholder="Min"
                      value={filters.ageRange.min ?? ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, ageRange: { ...prev.ageRange, min: e.target.value ? parseInt(e.target.value) : null } }))}
                      className="w-full px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Usia Maksimal</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      placeholder="Max"
                      value={filters.ageRange.max ?? ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, ageRange: { ...prev.ageRange, max: e.target.value ? parseInt(e.target.value) : null } }))}
                      className="w-full px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Column Selection */}
              <div className="rounded-xl bg-zinc-700/30 border border-zinc-600/50 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-700/50 border-b border-zinc-600/50 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Pilih Kolom
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                    {options.columns.length} dipilih
                  </span>
                </div>
                <div className="divide-y divide-zinc-600/30">
                  {Object.entries(columnsByCategory).map(([category, columns]) => {
                    const categorySelected = columns.filter(c => options.columns.includes(c.key)).length;
                    const allSelected = categorySelected === columns.length;
                    const isExpanded = expandedCategories.includes(category);
                    
                    return (
                      <div key={category}>
                        <button
                          onClick={() => toggleCategoryExpand(category)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-700/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{CATEGORY_INFO[category]?.icon}</span>
                            <span className="text-sm font-medium text-zinc-200">{CATEGORY_INFO[category]?.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCategoryToggle(category); }}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                allSelected
                                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                                  : 'bg-zinc-600/50 text-zinc-400 hover:bg-zinc-600'
                              }`}
                            >
                              {categorySelected}/{columns.length}
                            </button>
                            <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                            {columns.map(col => (
                              <label
                                key={col.key}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-zinc-700/30 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={options.columns.includes(col.key)}
                                  onChange={() => handleColumnToggle(col.key)}
                                  className="w-4 h-4 rounded border-zinc-500 bg-zinc-700 text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0"
                                />
                                <span className="text-sm text-zinc-300">{col.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grouping & Sorting */}
              <div className="rounded-xl bg-zinc-700/30 border border-zinc-600/50 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-700/50 border-b border-zinc-600/50">
                  <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Pengaturan Tampilan
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Kelompokkan Berdasarkan</label>
                    <select
                      value={options.groupBy}
                      onChange={(e) => setOptions(prev => ({ ...prev, groupBy: e.target.value as GroupByOption }))}
                      className="w-full px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                    >
                      <option value="none">Tidak Ada</option>
                      <option value="branch">Cabang</option>
                      <option value="packageType">Tipe Paket</option>
                      <option value="registrationMonth">Bulan Registrasi</option>
                      <option value="gender">Jenis Kelamin</option>
                      <option value="referral">Referral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">Urutkan Berdasarkan</label>
                    <div className="flex gap-2">
                      <select
                        value={options.sortBy}
                        onChange={(e) => setOptions(prev => ({ ...prev, sortBy: e.target.value as SortByOption }))}
                        className="flex-1 px-3 py-2 text-sm bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-200 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 outline-none"
                      >
                        <option value="memberNo">No. Member</option>
                        <option value="fullName">Nama</option>
                        <option value="createdAt">Tanggal Registrasi</option>
                        <option value="lastTherapyDate">Terapi Terakhir</option>
                      </select>
                      <button
                        onClick={() => setOptions(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                        className="px-3 py-2 bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-600/50 transition-colors"
                        title={options.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                      >
                        {options.sortOrder === 'asc' ? '↑' : '↓'}
                      </button>
                    </div>
                  </div>
                  {options.groupBy !== 'none' && (
                    <>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.includeSubtotals}
                          onChange={(e) => setOptions(prev => ({ ...prev, includeSubtotals: e.target.checked }))}
                          className="w-4 h-4 rounded border-zinc-500 bg-zinc-700 text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0"
                        />
                        <span className="text-sm text-zinc-300">Tampilkan Subtotal per Grup</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.includeGrandTotal}
                          onChange={(e) => setOptions(prev => ({ ...prev, includeGrandTotal: e.target.checked }))}
                          className="w-4 h-4 rounded border-zinc-500 bg-zinc-700 text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0"
                        />
                        <span className="text-sm text-zinc-300">Tampilkan Grand Total</span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/20">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-400">Preview Data</p>
                    <p className="text-xs text-amber-400/70">
                      {loadingPreview ? 'Menghitung...' : previewCount !== null ? `${previewCount.toLocaleString()} member akan di-export` : 'Klik refresh untuk melihat'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadPreviewCount}
                  disabled={loadingPreview}
                  className="px-3 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingPreview ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : 'Refresh'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-700/50 bg-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-400">Format:</span>
            <div className="flex rounded-lg overflow-hidden border border-zinc-600">
              <button
                onClick={() => setFormat('xlsx')}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  format === 'xlsx'
                    ? 'bg-emerald-500/20 text-emerald-400 border-r border-emerald-500/30'
                    : 'bg-zinc-700/50 text-zinc-400 border-r border-zinc-600 hover:bg-zinc-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </span>
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  format === 'csv'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CSV
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-700/50 hover:bg-zinc-700 border border-zinc-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleExport}
              disabled={loading || selectedColumnCount === 0}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-lg shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export ({selectedColumnCount} kolom)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
