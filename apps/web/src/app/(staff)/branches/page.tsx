

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { branchesApi } from '@/lib/api/branchesApi';
import { showToast, confirm } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { hasRole, MANAGER_ABOVE_ROLES } from '@/types/auth';
import { devError } from '@/lib/logger';
import { 
  Building2, Plus, Search, Filter, Edit, Trash2, Users, 
  MapPin, Phone, ChevronLeft, ChevronRight, RefreshCw, Eye, AlertTriangle
} from 'lucide-react';

interface Branch {
  id: string;
  branchCode: string;
  name: string;
  type: string;
  address: string;
  city: string;
  phone: string;
  operatingHours?: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    members?: number;
    staff?: number;
  };
}

interface BranchSummary {
  total: number;
  active: number;
  inactive: number;
}

export default function BranchesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<BranchSummary>({ total: 0, active: 0, inactive: 0 });
  const limit = 10;

  // Check authorization
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    if (!hasRole(user.role, MANAGER_ABOVE_ROLES)) {
      showToast.error(`Akses ditolak. Role Anda: ${user.role}. Diperlukan: SUPER_ADMIN atau ADMIN_MANAGER`);
      router.push('/dashboard');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (user && hasRole(user.role, MANAGER_ABOVE_ROLES)) {
      loadBranches();
    }
  }, [page, search, typeFilter, statusFilter, user]);

  const loadBranches = async () => {
    if (!user || !hasRole(user.role, MANAGER_ABOVE_ROLES)) return;

    try {
      setLoading(true);
      const params: any = { page, limit };
      
      if (search) params.search = search;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';

      const response = await branchesApi.listBranches(params);
      
      if (response.data && response.data.data) {
        const branchesData = response.data.data;
        const meta = response.data.meta;

        setBranches(branchesData);
        setTotal(meta?.total || 0);
        setSummary(meta?.summary || {
          total: meta?.total || branchesData.length,
          active: branchesData.filter((branch: Branch) => branch.isActive).length,
          inactive: branchesData.filter((branch: Branch) => !branch.isActive).length,
        });
      }
    } catch (error: any) {
      devError('Error loading branches:', error);
      if (error.response?.status === 401) {
        showToast.error('Sesi Anda telah berakhir, silakan login kembali');
        router.push('/login');
      } else if (error.response?.status === 403) {
        showToast.error('Anda tidak memiliki akses ke halaman ini');
        router.push('/dashboard');
      } else {
        showToast.error('Gagal memuat data cabang');
      }
      setBranches([]);
      setSummary({ total: 0, active: 0, inactive: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (branchId: string, branchName: string) => {
    const confirmed = await confirm.delete(branchName);
    if (!confirmed) return;

    try {
      await branchesApi.deleteBranch(branchId);
      showToast.success('Cabang berhasil dihapus');
      if (branches.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        loadBranches();
      }
    } catch (error: any) {
      devError('Error deleting branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal menghapus cabang');
    }
  };

  const getBranchTypeStyle = (type: string) => {
    const styles: Record<string, { bg: string; text: string; border: string }> = {
      PUSAT: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/30' },
      PREMIER: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-500/30' },
      PARTNERSHIP: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/30' },
      KLINIK: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30' },
      HOMECARE: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/30' },
    };
    return styles[type] || { bg: 'bg-neutral-100 dark:bg-neutral-500/20', text: 'text-neutral-700 dark:text-neutral-400', border: 'border-neutral-200 dark:border-neutral-500/30' };
  };

  const getBranchTypeLabel = (type: string) => {
    if (type === 'PREMIER') return 'Premier (Cabang)';
    return type.charAt(0) + type.slice(1).toLowerCase();
  };

  const totalPages = Math.ceil(total / limit);

  // Stats
  const totalMembers = branches.reduce((sum, b) => sum + (b._count?.members || 0), 0);
  const totalStaff = branches.reduce((sum, b) => sum + (b._count?.staff || 0), 0);

  // Show loading if user is not yet available
  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 text-amber-500 animate-spin" />
          <p className="text-neutral-500 dark:text-neutral-400">Memuat informasi user...</p>
        </div>
      </div>
    );
  }

  // Check if user has access
  if (!hasRole(user.role, MANAGER_ABOVE_ROLES)) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/20 mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Akses Ditolak</h2>
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">Anda tidak memiliki akses ke halaman ini.</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-1"><strong>Role Anda:</strong> {user.role}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6"><strong>Role yang Diperlukan:</strong> SUPER_ADMIN atau ADMIN_MANAGER</p>
          <button 
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Pengaturan Cabang</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Kelola semua cabang klinik dengan mudah dan efisien</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/branches/create')}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 transition-all"
          >
            <Plus className="h-5 w-5" />
            Tambah Cabang
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20">
              <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{summary.total}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">TOTAL CABANG</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
              <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{summary.active}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">CABANG AKTIF</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
              <Users className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalMembers}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">TOTAL MEMBER</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-500/20">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{totalStaff}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">TOTAL STAFF</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-800 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Cari cabang..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-neutral-700 transition-all"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-neutral-400" />
            <select 
              value={typeFilter} 
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            >
              <option value="all">Semua Tipe</option>
              <option value="PUSAT">Pusat</option>
              <option value="PREMIER">Premier (Cabang)</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="KLINIK">Klinik</option>
              <option value="HOMECARE">Homecare</option>
            </select>

            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-4 py-3 text-sm rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="h-10 w-10 text-amber-500 animate-spin mb-4" />
            <p className="text-neutral-500 dark:text-neutral-400">Memuat data cabang...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
              <Building2 className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Belum Ada Cabang</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Mulai dengan menambahkan cabang pertama Anda.</p>
            <button 
              onClick={() => router.push('/branches/create')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all"
            >
              <Plus className="h-4 w-4" />
              Tambah Cabang
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Kode</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Nama Cabang</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Tipe</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Lokasi</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Kontak</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Members</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {branches.map((branch) => {
                    const typeStyle = getBranchTypeStyle(branch.type);
                    return (
                      <tr key={branch.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            {branch.branchCode}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-neutral-400" />
                            <span className="font-medium text-neutral-900 dark:text-white">{branch.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                            {getBranchTypeLabel(branch.type)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                            <MapPin className="h-3.5 w-3.5" />
                            {branch.city}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                            <Phone className="h-3.5 w-3.5" />
                            {branch.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                            <Users className="h-3.5 w-3.5" />
                            {branch._count?.members || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                            branch.isActive 
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                              : 'bg-neutral-100 dark:bg-neutral-500/20 text-neutral-600 dark:text-neutral-400'
                          }`}>
                            {branch.isActive ? 'AKTIF' : 'TIDAK AKTIF'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => router.push(`/branches/${branch.id}`)}
                              title="Lihat Detail"
                              className="p-2 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/branches/${branch.id}/edit`)}
                              title="Edit"
                              className="p-2 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {branch.isActive && (
                              <button
                                onClick={() => handleDelete(branch.id, branch.name)}
                                title="Hapus"
                                className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Page {page} of {totalPages}
                </span>
                
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
