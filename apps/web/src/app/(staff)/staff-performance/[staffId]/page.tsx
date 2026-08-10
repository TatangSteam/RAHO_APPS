'use client';

import AppImage from '@/components/ui/AppImage';
import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { usersApi, StaffSessionHistoryResponse } from '@/lib/usersApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import {
  Activity, ChevronLeft, ChevronRight, Building2, Loader2, Calendar,
  Stethoscope, Heart, UserCog, ArrowLeft, User, Mail, Phone,
  Package, Hash, Clock, CheckCircle2, Download
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'DOCTOR': return <Stethoscope size={14} className="text-blue-500" />;
    case 'NURSE': return <Heart size={14} className="text-green-500" />;
    case 'ADMIN_CABANG': return <UserCog size={14} className="text-amber-500" />;
    case 'ADMIN_LAYANAN': return <UserCog size={14} className="text-purple-500" />;
    default: return null;
  }
};

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    DOCTOR: 'Dokter',
    NURSE: 'Nakes',
    ADMIN_CABANG: 'Admin Cabang',
    ADMIN_LAYANAN: 'Admin Layanan',
  };
  return labels[role] || role;
};

const getRoleColor = (role: string) => {
  const colors: Record<string, string> = {
    DOCTOR: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
    NURSE: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
    ADMIN_CABANG: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
    ADMIN_LAYANAN: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  };
  return colors[role] || 'bg-neutral-100 dark:bg-neutral-500/20 text-neutral-700 dark:text-neutral-400';
};

const getPositionLabel = (position: string) => {
  const labels: Record<string, string> = {
    doctor: 'Dokter',
    nurse: 'Nakes',
    adminLayanan: 'Admin Layanan',
  };
  return labels[position] || position;
};

const getPositionColor = (position: string) => {
  const colors: Record<string, string> = {
    doctor: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    nurse: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
    adminLayanan: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
  };
  return colors[position] || 'bg-neutral-100 dark:bg-neutral-500/20 text-neutral-700 dark:text-neutral-400';
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const getPackageLabel = (packageType: string, boosterType: string | null) => {
  const packageLabels: Record<string, string> = {
    BASIC: 'Basic',
    STANDARD: 'Standard',
    PREMIUM: 'Premium',
    BOOSTER: 'Booster',
  };
  
  if (packageType === 'BOOSTER' && boosterType) {
    const boosterLabels: Record<string, string> = {
      IFA_250: 'IFA 250',
      IFA_500: 'IFA 500',
      GLUTATHIONE: 'Gasotransmitter',
      VITAMIN_C: 'Vitamin C',
    };
    return boosterLabels[boosterType] || boosterType;
  }
  
  return packageLabels[packageType] || packageType;
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StaffPerformanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffId = params.staffId as string;
  const branchId = searchParams.get('branchId') || undefined;
  
  const [data, setData] = useState<StaffSessionHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [positionFilter, setPositionFilter] = useState<'all' | 'doctor' | 'nurse' | 'adminLayanan'>('all');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [exporting, setExporting] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const result = await usersApi.getStaffSessionHistory(staffId, {
        branchId,
        position: positionFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });
      setData(result);
    } catch (error) {
      assertCaughtError(error);
      devError('Error fetching history:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat data riwayat');
    } finally {
      setLoading(false);
    }
  }, [branchId, endDate, limit, page, positionFilter, staffId, startDate]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleViewSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await usersApi.exportStaffPerformanceDetail(staffId, {
        branchId,
        position: positionFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const staffCode = data?.staff.staffCode?.replace(/[^a-zA-Z0-9_-]/g, '-') || 'staff';
      link.download = `detail-kinerja-${staffCode}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast.success('Detail sesi terapi berhasil diekspor');
    } catch (error) {
      assertCaughtError(error);
      devError('Error exporting staff performance detail:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengekspor detail kinerja');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-6">
      {/* Back Button */}
      <button
        onClick={() => {
          const returnParams = new URLSearchParams();
          if (branchId) returnParams.set('branchId', branchId);
          if (startDate) returnParams.set('startDate', startDate);
          if (endDate) returnParams.set('endDate', endDate);
          const queryString = returnParams.toString();
          router.push(`/staff-performance${queryString ? `?${queryString}` : ''}`);
        }}
        className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        Kembali ke Daftar Kinerja
      </button>

      {/* Staff Info Card */}
      {data?.staff && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Avatar */}
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black font-bold text-2xl flex-shrink-0 overflow-hidden shadow-lg shadow-amber-500/30">
              {data.staff.avatarUrl ? (
                <AppImage src={data.staff.avatarUrl} alt={data.staff.fullName} className="w-full h-full object-cover" />
              ) : (
                data.staff.fullName.charAt(0).toUpperCase()
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{data.staff.fullName}</h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(data.staff.role)}`}>
                  {getRoleIcon(data.staff.role)}
                  {getRoleLabel(data.staff.role)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <Hash size={14} />
                  <span>{data.staff.staffCode}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail size={14} />
                  <span>{data.staff.email}</span>
                </div>
                {data.staff.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={14} />
                    <span>{data.staff.phone}</span>
                  </div>
                )}
                {data.staff.branch && (
                  <div className="flex items-center gap-1.5">
                    <Building2 size={14} />
                    <span>{data.staff.branch.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                <Stethoscope size={18} className="text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{data.summary.asDoctor}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Dokter</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
                <Heart size={18} className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{data.summary.asNurse}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Nakes</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
                <UserCog size={18} className="text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{data.summary.asAdminLayanan}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">Admin</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                <Activity size={18} className="text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{data.summary.total}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Total</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end gap-4">
        <select
          value={positionFilter}
          onChange={(e) => { setPositionFilter(e.target.value as typeof positionFilter); setPage(1); }}
          className="px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all min-w-[180px]"
        >
          <option value="all">Semua Posisi</option>
          <option value="doctor">Sebagai Dokter</option>
          <option value="nurse">Sebagai Nakes</option>
          <option value="adminLayanan">Sebagai Admin Layanan</option>
        </select>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
            Tanggal sesi terapi
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                aria-label="Tanggal sesi terapi mulai"
                className="pl-10 pr-3 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
            <span className="text-neutral-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              aria-label="Tanggal sesi terapi akhir"
              className="px-3 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || loading || !data}
          className="md:ml-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-amber-500/20"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Mengekspor...' : 'Export Detail Sesi'}
        </button>
      </div>

      {/* Session History */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Riwayat Sesi Terapi</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Daftar sesi terapi yang diikuti oleh staff ini
          </p>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <span className="text-neutral-500 dark:text-neutral-400">Memuat data...</span>
            </div>
          </div>
        ) : data?.sessions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <Activity className="h-8 w-8 text-neutral-400" />
              </div>
              <div>
                <p className="text-neutral-900 dark:text-white font-medium">Tidak ada riwayat sesi</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Staff ini belum memiliki riwayat sesi terapi
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {data?.sessions.map((session) => (
              <div
                key={session.id}
                className="px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                onClick={() => handleViewSession(session.id)}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Session Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg">
                        {session.sessionCode}
                      </span>
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        Infus ke-{session.infusKe}
                      </span>
                      {session.isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 size={12} />
                          Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Clock size={12} />
                          Belum Selesai
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        <span>{formatDate(session.treatmentDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User size={14} />
                        <span>{session.member.fullName}</span>
                        <span className="text-neutral-400">({session.member.memberNo})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Package size={14} />
                        <span>{getPackageLabel(session.package.packageType, session.package.boosterType)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Building2 size={14} />
                        <span>{session.branch.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Position Badges */}
                  <div className="flex flex-wrap gap-2">
                    {session.positions.map((pos) => (
                      <span
                        key={pos}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${getPositionColor(pos)}`}
                      >
                        {pos === 'doctor' && <Stethoscope size={12} />}
                        {pos === 'nurse' && <Heart size={12} />}
                        {pos === 'adminLayanan' && <UserCog size={12} />}
                        {getPositionLabel(pos)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, data?.total || 0)} dari {data?.total || 0} sesi
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
                          ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
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
    </div>
  );
}
