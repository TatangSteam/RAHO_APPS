'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usersApi, StaffPerformance, StaffPerformanceSummaryResponse } from '@/lib/usersApi';
import { branchesApi } from '@/lib/api/branchesApi';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import {
  Activity, Search, Eye, Building2, ChevronLeft, ChevronRight,
  Users, Loader2, Calendar, Stethoscope, Heart, UserCog,
  TrendingUp, Filter, BarChart3
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StaffPerformancePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<StaffPerformanceSummaryResponse | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdminCabang = user?.role === 'ADMIN_CABANG';
  const canSelectBranch = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    // For ADMIN_CABANG, use their branch automatically
    if (isAdminCabang && user?.branchId) {
      setBranchFilter(user.branchId);
    }
  }, [isAdminCabang, user?.branchId]);

  useEffect(() => {
    // Only fetch if we have a branch selected (required)
    if (branchFilter || isAdminCabang) {
      fetchPerformance();
    }
  }, [page, branchFilter, startDate, endDate]);

  const fetchBranches = async () => {
    try {
      const response = await branchesApi.getAllBranches();
      setBranches(response.data.data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const result = await usersApi.getStaffPerformanceSummary({
        branchId: branchFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });
      setData(result);
    } catch (error: any) {
      console.error('Error fetching performance:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat data kinerja');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (staffId: string) => {
    router.push(`/staff-performance/${staffId}`);
  };

  // Filter staff by search
  const filteredStaff = data?.staff.filter((staff) =>
    staff.fullName.toLowerCase().includes(search.toLowerCase()) ||
    staff.staffCode.toLowerCase().includes(search.toLowerCase()) ||
    staff.email.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  // Calculate summary stats
  const totalSessions = filteredStaff.reduce((sum, s) => sum + s.performance.total, 0);
  const totalAsDoctor = filteredStaff.reduce((sum, s) => sum + s.performance.asDoctor, 0);
  const totalAsNurse = filteredStaff.reduce((sum, s) => sum + s.performance.asNurse, 0);
  const totalAsAdmin = filteredStaff.reduce((sum, s) => sum + s.performance.asAdminLayanan, 0);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
              <BarChart3 className="h-7 w-7 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Kinerja Staff</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Lihat performa dan kontribusi staff dalam sesi terapi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
                <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalSessions}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Sesi</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
                <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalAsDoctor}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Sebagai Dokter</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-500/20">
                <Heart className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalAsNurse}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Sebagai Nakes</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-500/20">
                <UserCog className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalAsAdmin}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Sebagai Admin</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari nama atau kode staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
          />
        </div>

        {canSelectBranch && (
          <select
            value={branchFilter}
            onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
            className="px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all min-w-[200px]"
          >
            <option value="">Pilih Cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="pl-10 pr-3 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            />
          </div>
          <span className="text-neutral-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Branch Info */}
      {data?.branch && (
        <div className="mb-4 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <Building2 className="h-4 w-4" />
          <span>Menampilkan data untuk cabang: <strong className="text-neutral-900 dark:text-white">{data.branch.name}</strong></span>
        </div>
      )}

      {/* No Branch Selected */}
      {!branchFilter && canSelectBranch && !loading && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
              <Filter className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">Pilih Cabang</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Silakan pilih cabang terlebih dahulu untuk melihat data kinerja staff
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {(branchFilter || isAdminCabang) && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Staff</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <Stethoscope size={12} />
                      Dokter
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <Heart size={12} />
                      Nakes
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-1">
                      <UserCog size={12} />
                      Admin
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                        <span className="text-neutral-500 dark:text-neutral-400">Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                          <Users className="h-8 w-8 text-neutral-400" />
                        </div>
                        <div>
                          <p className="text-neutral-900 dark:text-white font-medium">Tidak ada data staff</p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {search ? 'Coba ubah kata kunci pencarian' : 'Belum ada staff di cabang ini'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-black font-semibold text-sm flex-shrink-0 overflow-hidden">
                            {staff.avatarUrl ? (
                              <img src={staff.avatarUrl} alt={staff.fullName} className="w-full h-full object-cover" />
                            ) : (
                              staff.fullName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-white">{staff.fullName}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">{staff.staffCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(staff.role)}`}>
                          {getRoleIcon(staff.role)}
                          {getRoleLabel(staff.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-semibold ${staff.performance.asDoctor > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}`}>
                          {staff.performance.asDoctor}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-semibold ${staff.performance.asNurse > 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-400'}`}>
                          {staff.performance.asNurse}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-semibold ${staff.performance.asAdminLayanan > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-400'}`}>
                          {staff.performance.asAdminLayanan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-sm">
                          <TrendingUp size={14} />
                          {staff.performance.total}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleViewDetail(staff.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all"
                          >
                            <Eye size={16} />
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, data?.total || 0)} dari {data?.total || 0} staff
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
      )}
    </div>
  );
}
