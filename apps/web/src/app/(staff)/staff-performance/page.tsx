'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usersApi, StaffPerformance, StaffPerformanceSummaryResponse } from '@/lib/usersApi';
import { branchesApi } from '@/lib/api/branchesApi';
import { doctorBranchApi, ManagedBranch } from '@/lib/api/doctorBranchApi';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import {
  Activity, Search, Eye, Building2, ChevronLeft, ChevronRight,
  Users, Calendar, Stethoscope, Heart, UserCog,
  TrendingUp, Filter, BarChart3
} from 'lucide-react';
import { PageLoading } from '@/components/ui/LoadingSpinner';

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
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdminManager = user?.role === 'ADMIN_MANAGER';
  const canSelectBranch = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_MANAGER';

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    // For ADMIN_CABANG, use their branch automatically
    if (isAdminCabang && user?.branchId) {
      setBranchFilter(user.branchId);
    }
    // For SUPER_ADMIN, default to "all" (Semua Cabang)
    if (isSuperAdmin && !branchFilter) {
      setBranchFilter('all');
    }
    // For ADMIN_MANAGER, auto-select first managed branch if available
    if (isAdminManager && branches.length > 0 && !branchFilter) {
      setBranchFilter(branches[0].id);
    }
  }, [isAdminCabang, isSuperAdmin, isAdminManager, user?.branchId, branches]);

  useEffect(() => {
    // Only fetch if we have a branch selected (required) or Super Admin with 'all'
    if (branchFilter || isAdminCabang) {
      fetchPerformance();
    }
  }, [page, branchFilter, startDate, endDate]);

  const fetchBranches = async () => {
    try {
      console.log('🔍 fetchBranches - isAdminManager:', isAdminManager);
      
      // Admin Manager uses dedicated managed branches API
      if (isAdminManager) {
        console.log('📞 Calling doctorBranchApi.getManagedBranches...');
        const branchesArray = await doctorBranchApi.getManagedBranches(false);
        console.log('✅ Managed branches:', branchesArray);
        
        setBranches(Array.isArray(branchesArray) ? branchesArray.map((b: ManagedBranch) => ({
          id: b.branchId,
          name: b.branchName,
          branchCode: b.branchCode,
        })) : []);
        
        console.log('✅ Branches set successfully:', branchesArray.length, 'branches');
      } else {
        // Super Admin and Admin Cabang use general branches API
        console.log('📞 Calling branchesApi.getAllBranches...');
        const response = await branchesApi.getAllBranches();
        console.log('✅ Response from getAllBranches:', response);
        
        const branchList = response?.data?.data || [];
        setBranches(Array.isArray(branchList) ? branchList : []);
      }
    } catch (error: any) {
      console.error('❌ Error fetching branches:', error);
      devError('Error fetching branches:', error);
      setBranches([]);
      // Don't show error if Admin Manager has no branches yet (empty is valid)
      if (!isAdminManager || error?.response?.status !== 404) {
        showToast.error('Gagal memuat daftar cabang');
      }
    }
  };

  const fetchPerformance = async () => {
    try {
      console.log('🔍 fetchPerformance - branchFilter:', branchFilter);
      setLoading(true);
      const result = await usersApi.getStaffPerformanceSummary({
        branchId: branchFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });
      console.log('✅ Performance result:', result);
      setData(result);
    } catch (error: any) {
      console.error('❌ Error fetching performance:', error);
      devError('Error fetching performance:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat data kinerja');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (staffId: string) => {
    const params = new URLSearchParams();
    if (branchFilter) params.set('branchId', branchFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const queryString = params.toString();
    router.push(`/staff-performance/${staffId}${queryString ? `?${queryString}` : ''}`);
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/20 dark:to-amber-600/20">
                <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalSessions}</p>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total Sesi</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-600/20">
                <Stethoscope className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalAsDoctor}</p>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sbg Dokter</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-green-200 dark:from-green-500/20 dark:to-green-600/20">
                <Heart className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalAsNurse}</p>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sbg Nakes</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-500/20 dark:to-purple-600/20">
                <UserCog className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalAsAdmin}</p>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Sbg Admin</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari nama atau kode staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            />
          </div>

          {/* Branch Filter */}
          {canSelectBranch && (
            <div className="relative min-w-[180px]">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <select
                value={branchFilter}
                onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all appearance-none cursor-pointer"
              >
                {isSuperAdmin && (
                  <option value="all">📊 Semua Cabang</option>
                )}
                <option value="">Pilih Cabang</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 rotate-90 pointer-events-none" />
            </div>
          )}

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="pl-10 pr-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
              />
            </div>
            <span className="text-neutral-400 text-sm">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Branch Info Badge */}
      {data?.branch && branchFilter !== 'all' && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm">
          <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-neutral-600 dark:text-neutral-400">Cabang:</span>
          <span className="font-semibold text-amber-700 dark:text-amber-400">{data.branch.name}</span>
        </div>
      )}

      {/* No Branches Available for Admin Manager */}
      {isAdminManager && branches.length === 0 && !loading && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
              <Building2 className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">Tidak Ada Cabang yang Dikelola</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Anda belum mengelola cabang manapun. Silakan tambahkan cabang melalui halaman <span className="font-semibold">Kelola Cabang</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Branch Selected */}
      {!branchFilter && canSelectBranch && !loading && !isSuperAdmin && branches.length > 0 && (
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
          {/* Table Header Info */}
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-neutral-900 dark:text-white">Daftar Staff</span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                ({filteredStaff.length} staff)
              </span>
            </div>
            {data?.dateRange?.startDate && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(data.dateRange.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {data.dateRange.endDate && ` - ${new Date(data.dateRange.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50/80 dark:bg-neutral-800/80 sticky top-0 z-10">
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center">#</span>
                      Staff
                    </div>
                  </th>
                  {branchFilter === 'all' && (
                    <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} />
                        Cabang
                      </div>
                    </th>
                  )}
                  <th className="px-4 sm:px-6 py-3.5 text-left text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">Role</th>
                  <th className="px-3 sm:px-4 py-3.5 text-center text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">
                    <div className="flex flex-col items-center gap-0.5">
                      <Stethoscope size={14} className="text-blue-500" />
                      <span className="hidden sm:inline">Dokter</span>
                    </div>
                  </th>
                  <th className="px-3 sm:px-4 py-3.5 text-center text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">
                    <div className="flex flex-col items-center gap-0.5">
                      <Heart size={14} className="text-green-500" />
                      <span className="hidden sm:inline">Nakes</span>
                    </div>
                  </th>
                  <th className="px-3 sm:px-4 py-3.5 text-center text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">
                    <div className="flex flex-col items-center gap-0.5">
                      <UserCog size={14} className="text-purple-500" />
                      <span className="hidden sm:inline">Admin</span>
                    </div>
                  </th>
                  <th className="px-3 sm:px-4 py-3.5 text-center text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">
                    <div className="flex flex-col items-center gap-0.5">
                      <TrendingUp size={14} className="text-amber-500" />
                      <span className="hidden sm:inline">Total</span>
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 text-center text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={branchFilter === 'all' ? 8 : 7} className="px-6 py-20 text-center">
                      <PageLoading text="Memuat data kinerja" />
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={branchFilter === 'all' ? 8 : 7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                          <Users className="h-8 w-8 text-neutral-400" />
                        </div>
                        <div>
                          <p className="text-neutral-900 dark:text-white font-semibold">Tidak ada data staff</p>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                            {search ? 'Coba ubah kata kunci pencarian' : 'Belum ada staff di cabang ini'}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff, index) => {
                    const rank = index + 1 + ((page - 1) * limit);
                    const isTopThree = rank <= 3 && staff.performance.total > 0;
                    
                    return (
                      <tr 
                        key={staff.id} 
                        className={`group transition-all duration-200 ${
                          isTopThree 
                            ? 'bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-100/50 dark:hover:bg-amber-500/10' 
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                        }`}
                      >
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-center gap-3">
                            {/* Rank Badge */}
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${
                              rank === 1 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/30' :
                              rank === 2 ? 'bg-gradient-to-br from-neutral-300 to-neutral-400 text-black' :
                              rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                              'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                            }`}>
                              {rank}
                            </div>
                            {/* Avatar */}
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold flex-shrink-0 overflow-hidden ${
                              isTopThree 
                                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black ring-2 ring-amber-400/50' 
                                : 'bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-600 text-neutral-700 dark:text-neutral-200'
                            }`}>
                              {staff.avatarUrl ? (
                                <img src={staff.avatarUrl} alt={staff.fullName} className="w-full h-full object-cover" />
                              ) : (
                                staff.fullName.charAt(0).toUpperCase()
                              )}
                            </div>
                            {/* Name & Code */}
                            <div className="min-w-0">
                              <p className={`font-semibold truncate ${isTopThree ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-900 dark:text-white'}`}>
                                {staff.fullName}
                              </p>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{staff.staffCode}</p>
                            </div>
                          </div>
                        </td>
                        {branchFilter === 'all' && (
                          <td className="px-4 sm:px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                              <Building2 size={12} className="text-neutral-400" />
                              <span className="truncate max-w-[100px]">{staff.branch?.name || '-'}</span>
                            </span>
                          </td>
                        )}
                        <td className="px-4 sm:px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${getRoleColor(staff.role)} border-current/20`}>
                            {getRoleIcon(staff.role)}
                            <span className="hidden sm:inline">{getRoleLabel(staff.role)}</span>
                          </span>
                        </td>
                        {/* Performance Numbers */}
                        <td className="px-3 sm:px-4 py-4 text-center">
                          <div className={`inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg text-sm font-bold transition-all ${
                            staff.performance.asDoctor > 0 
                              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' 
                              : 'text-neutral-300 dark:text-neutral-600'
                          }`}>
                            {staff.performance.asDoctor}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-4 text-center">
                          <div className={`inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg text-sm font-bold transition-all ${
                            staff.performance.asNurse > 0 
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' 
                              : 'text-neutral-300 dark:text-neutral-600'
                          }`}>
                            {staff.performance.asNurse}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-4 text-center">
                          <div className={`inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg text-sm font-bold transition-all ${
                            staff.performance.asAdminLayanan > 0 
                              ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400' 
                              : 'text-neutral-300 dark:text-neutral-600'
                          }`}>
                            {staff.performance.asAdminLayanan}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-4 text-center">
                          <div className={`inline-flex items-center justify-center gap-1 h-8 px-3 rounded-lg text-sm font-bold ${
                            staff.performance.total > 0
                              ? 'bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-500/20 dark:to-amber-600/20 text-amber-700 dark:text-amber-400 shadow-sm'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                          }`}>
                            {staff.performance.total > 0 && <TrendingUp size={12} />}
                            {staff.performance.total}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleViewDetail(staff.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 transition-all group-hover:shadow-md group-hover:shadow-amber-500/10"
                            >
                              <Eye size={14} />
                              <span className="hidden sm:inline">Detail</span>
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 order-2 sm:order-1">
                Menampilkan <span className="font-semibold text-neutral-700 dark:text-neutral-300">{((page - 1) * limit) + 1}</span> - <span className="font-semibold text-neutral-700 dark:text-neutral-300">{Math.min(page * limit, data?.total || 0)}</span> dari <span className="font-semibold text-neutral-700 dark:text-neutral-300">{data?.total || 0}</span> staff
              </div>
              <div className="flex items-center gap-1.5 order-1 sm:order-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 text-sm font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Prev</span>
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
                        className={`h-9 w-9 text-sm font-semibold rounded-lg transition-all ${
                          page === pageNum
                            ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/30'
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
                  className="flex items-center justify-center h-9 w-9 sm:w-auto sm:px-3 text-sm font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <span className="hidden sm:inline mr-1">Next</span>
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
