'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as referralsApi from '@/lib/api/referralsApi';
import { branchesApi } from '@/lib/api/branchesApi';
import { useAuthStore } from '@/stores/authStore';
import { showToast, confirm } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { 
  Edit2, FileText, Plus, Search, Eye, Trash2,
  Download, FileSpreadsheet, Users, Phone, Mail, Building2, 
  ChevronLeft, ChevronRight, BarChart3
} from 'lucide-react';
import { PageLoading } from '@/components/ui/LoadingSpinner';
import CreateReferralModal from '@/components/referrals/CreateReferralModal';
import EditReferralModal from '@/components/referrals/EditReferralModal';
import {
  REFERRER_TYPE_OPTIONS,
  datedExportFilename,
  downloadBlob,
  formatCurrency,
  getReferrerTypeLabel,
  type ReferrerType,
} from '@/lib/referralUtils';

interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

export default function ReferralsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [referrals, setReferrals] = useState<referralsApi.ReferralCode[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReferrerType | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReferral, setEditingReferral] = useState<referralsApi.ReferralCode | null>(null);
  const [mounted, setMounted] = useState(false);

  const isAdminCabang = user?.role === 'ADMIN_CABANG';

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const response = await referralsApi.listReferrals({
        page,
        limit,
        search: search || undefined,
        branchId: branchFilter || undefined,
        referrerType: typeFilter || undefined,
        isActive: 'true',
      });
      setReferrals(response.data.data.referrals);
      setTotal(response.data.data.total);
    } catch (error) {
      assertCaughtError(error);
      devError('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, limit, page, search, typeFilter]);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await branchesApi.getAllBranches();
      setBranches(response.data.data);
    } catch (error) {
      assertCaughtError(error);
      devError('Error fetching branches:', error);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm.delete('kode referral ini');
    if (!confirmed) return;
    try {
      await referralsApi.deleteReferral(id);
      showToast.success('Kode referral berhasil dihapus');
      fetchReferrals();
    } catch (error) {
      assertCaughtError(error);
      devError('Error deleting referral:', error);
      showToast.error('Gagal menghapus kode referral');
    }
  };

  const exportFilters = {
    branchId: branchFilter || undefined,
    referrerType: typeFilter || undefined,
  };

  const exportBlob = async (
    request: () => Promise<{ data: BlobPart }>,
    filename: string,
    errorMessage: string,
  ) => {
    try {
      const response = await request();
      downloadBlob(response.data, filename);
    } catch (error) {
      assertCaughtError(error);
      devError(errorMessage, error);
      showToast.error(errorMessage);
    }
  };

  const handleExportExcel = async () => {
    await exportBlob(
      () => referralsApi.exportIncentivesExcel(exportFilters),
      datedExportFilename('Laporan_Insentif', 'xlsx'),
      'Gagal export ke Excel',
    );
  };

  const handleExportPDF = async () => {
    await exportBlob(
      () => referralsApi.exportIncentivesPDF(exportFilters),
      datedExportFilename('Laporan_Insentif', 'pdf'),
      'Gagal export ke PDF',
    );
  };

  const handleExportSummary = async () => {
    await exportBlob(
      () => referralsApi.exportSummaryExcel(exportFilters),
      datedExportFilename('Ringkasan_Insentif', 'xlsx'),
      'Gagal export ringkasan',
    );
  };

  const getReferrerTypeStyle = (type: string) => {
    const styles: Record<string, { bg: string; text: string }> = {
      SALES: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' },
      DOKTER: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
      MEMBER: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400' },
    };
    return styles[type] || { bg: 'bg-neutral-100 dark:bg-neutral-500/20', text: 'text-neutral-700 dark:text-neutral-400' };
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/30">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Kode Referral</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Kelola kode referral dan insentif sales</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportSummary}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              <BarChart3 className="h-4 w-4" />
              Ringkasan
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/30 transition-all"
            >
              <Plus className="h-5 w-5" />
              Tambah Referral
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari nama atau kode referral..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>

        {!isAdminCabang && (
          <select
            value={branchFilter}
            onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
            className="px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all min-w-[200px]"
          >
            <option value="">Semua Cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        )}

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as ReferrerType | ''); setPage(1); }}
          className="px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all min-w-[160px]"
        >
          <option value="">Semua Tipe</option>
          {REFERRER_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Kode</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Tipe</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Cabang</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Kontak</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Total Referral</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Total Insentif</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <PageLoading text="Memuat data referral" />
                  </td>
                </tr>
              ) : referrals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <Users className="h-8 w-8 text-neutral-400" />
                      </div>
                      <div>
                        <p className="text-neutral-900 dark:text-white font-medium">Tidak ada data referral</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Klik tombol &quot;Tambah Referral&quot; untuk membuat baru</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                referrals.map((referral) => {
                  const typeStyle = getReferrerTypeStyle(referral.referrerType);
                  return (
                    <tr key={referral.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 rounded-lg">
                          {referral.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white font-semibold text-sm">
                            {referral.referrerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-neutral-900 dark:text-white">{referral.referrerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${typeStyle.bg} ${typeStyle.text}`}>
                          {getReferrerTypeLabel(referral.referrerType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                          <Building2 className="h-4 w-4 text-neutral-400" />
                          <span className="text-sm">{referral.branch?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                          {referral.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-neutral-400" />
                              <span>{referral.phone}</span>
                            </div>
                          )}
                          {referral.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-neutral-400" />
                              <span>{referral.email}</span>
                            </div>
                          )}
                          {!referral.phone && !referral.email && (
                            <span className="text-neutral-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-neutral-900 dark:text-white">{referral.totalReferrals}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(referral.totalIncentiveEarned)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => router.push(`/referrals/${referral.id}`)}
                            className="p-2 rounded-lg text-neutral-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingReferral(referral)}
                            className="p-2 rounded-lg text-neutral-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(referral.id)}
                            className="p-2 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} dari {total} data
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 text-sm font-medium rounded-lg transition-all ${
                        page === pageNum
                          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                          : 'bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {mounted && showCreateModal && (
        <CreateReferralModal
          branches={branches}
          isAdminCabang={isAdminCabang}
          userBranchId={user?.branchId || undefined}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchReferrals();
          }}
        />
      )}

      {mounted && editingReferral && (
        <EditReferralModal
          referral={editingReferral}
          onClose={() => setEditingReferral(null)}
          onSuccess={() => {
            setEditingReferral(null);
            showToast.success('Kode referral berhasil diperbarui');
            fetchReferrals();
          }}
        />
      )}
    </div>
  );
}

