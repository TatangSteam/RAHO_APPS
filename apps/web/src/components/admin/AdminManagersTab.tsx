'use client';

import { assertCaughtError } from '@/lib/caughtError';
import React, { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminManagersApi, AdminManager, AdminManagerConversionRole } from '@/lib/api/adminManagersApi';
import { CreateAdminManagerModal } from './CreateAdminManagerModal';
import { showToast } from '@/lib/toast';
import { devLog, devError } from '@/lib/logger';
import { BadgeDollarSign, ChevronLeft, ChevronRight, Eye, Filter, Loader2, Search, Users, Building2 } from 'lucide-react';
import styles from './AdminManagersTab.module.css';

export const AdminManagersTab: React.FC = () => {
  const router = useRouter();
  // State
  const [managers, setManagers] = useState<AdminManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<AdminManagerConversionRole | 'ADMIN_MANAGER'>('ADMIN_MANAGER');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [convertingManagerId, setConvertingManagerId] = useState<string | null>(null);
  const limit = 10;

  const loadManagers = useCallback(async () => {
    try {
      setLoading(true);
      
      const params: NonNullable<Parameters<typeof adminManagersApi.getAdminManagers>[0]> = { page, limit };
      if (roleFilter !== 'ADMIN_MANAGER') params.role = roleFilter;
      if (search) params.search = search;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';

      devLog('🔍 Calling getAdminManagers with params:', params);
      const response = await adminManagersApi.getAdminManagers(params);
      devLog('✅ Response received:', response);
      
      // Handle different response structures
      if (response && response.data) {
        setManagers(Array.isArray(response.data) ? response.data : []);
        setTotal(response.meta?.total || 0);
      } else {
        devLog('⚠️ Unexpected response structure:', response);
        setManagers([]);
        setTotal(0);
      }
    } catch (error) {
      assertCaughtError(error);
      devError('❌ Error loading admin managers:', error);
      devError('Error details:', error.response?.data);
      showToast.error(error.response?.data?.message || 'Gagal memuat data Admin Manager');
      setManagers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter]);

  useEffect(() => {
    void loadManagers();
  }, [loadManagers]);

  const handleCreateSuccess = () => {
    loadManagers();
    setShowCreateModal(false);
  };

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page on search
  };

  const handleStatusFilterChange = (value: 'all' | 'active' | 'inactive') => {
    setStatusFilter(value);
    setPage(1); // Reset to first page on filter change
  };

  const setManagerRole = async (manager: AdminManager, targetRole: AdminManagerConversionRole | 'ADMIN_MANAGER') => {
    const revoking = targetRole === 'ADMIN_MANAGER';
    const finance = targetRole === 'FINANCE_LOGISTICS_CONTROLLER';
    const roleLabel = revoking ? 'Admin Manager' : finance ? 'Finance & Logistik' : 'Admin Logistik';
    const impact = finance
      ? 'Akses Finance dan Logistik seluruh cabang aktif.'
      : 'Akses logistik global sesuai kewenangan Admin Logistik, tanpa peran Finance.';
    if (!window.confirm(
      revoking
        ? `Cabut akses Finance/Logistik ${manager.fullName}?\n\nAkun kembali menjadi Admin Manager. Semua assignment cabang dan izin tambahan ALLOW dicabut; aturan DENY tetap disimpan. Cabang harus diatur ulang melalui Detail. User ID dan histori transaksi tidak dihapus. Pengguna perlu keluar dan login ulang.`
        : `Tetapkan ${manager.fullName} sebagai ${roleLabel}?\n\nPeran dan assignment Admin Manager akan diganti, bukan dirangkap. ${impact}\nUser ID dan histori transaksi tetap tersimpan. Pengguna perlu keluar dan login ulang.`,
    )) return;

    try {
      setConvertingManagerId(manager.id);
      const response = await adminManagersApi.convertAdminManagerRole(
        manager.id,
        targetRole,
      );
      showToast.success(
        revoking
          ? `Akses Finance/Logistik ${manager.fullName} berhasil dicabut. Atur ulang cabang pada Detail Admin Manager dan minta pengguna login ulang.`
          : `${manager.fullName} berhasil ditetapkan sebagai ${roleLabel}${finance ? ` untuk ${response.data.assignedBranchCount} cabang` : ''}. Pengguna perlu login ulang.`,
      );
      await loadManagers();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || error.response?.data?.message || `Gagal menetapkan ${roleLabel}.`);
    } finally {
      setConvertingManagerId(null);
    }
  };

  // Pagination
  const totalPages = Math.ceil(total / limit);
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  // Stats
  const activeCount = managers.filter(m => m.isActive).length;
  const totalBranches = managers.reduce((sum, m) => sum + m.branches.length, 0);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.adminManagersTab}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <h2>Admin Managers</h2>
            <p>Kelola dan monitor Admin Manager di sistem</p>
            <p>Pilih Set Logistik atau Set Finance &amp; Logistik pada akun yang ingin diubah perannya. Histori tetap tersimpan; pengguna perlu login ulang.</p>
            <p>Untuk mencabut, pilih Finance &amp; Logistik atau Admin Logistik pada filter Peran, lalu klik Cabut Akses.</p>
          </div>
          <button className={styles.addButton} onClick={() => setShowCreateModal(true)}>
            <span className={styles.addIcon}>+</span>
            <span>Tambah Admin Manager</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#3b82f615', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{total}</div>
            <div className={styles.statLabel}>Total Admin Manager</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#10b98115', color: '#10b981' }}>
            <Users size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{activeCount}</div>
            <div className={styles.statLabel}>Admin Manager Aktif</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f59e0b15', color: '#f59e0b' }}>
            <Building2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{totalBranches}</div>
            <div className={styles.statLabel}>Total Branches Assigned</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Cari Admin Manager..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <Filter size={18} />
          <select 
            value={statusFilter} 
            onChange={(e) => handleStatusFilterChange(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Tidak Aktif</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label htmlFor="manager-role-filter">Peran</label>
          <select id="manager-role-filter" value={roleFilter} onChange={(event) => {
            setRoleFilter(event.target.value as AdminManagerConversionRole | 'ADMIN_MANAGER');
            setPage(1);
          }}>
            <option value="ADMIN_MANAGER">Admin Manager</option>
            <option value="ADMIN_LOGISTIK">Admin Logistik</option>
            <option value="FINANCE_LOGISTICS_CONTROLLER">Finance &amp; Logistik</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}>⏳</div>
            <p>Memuat data Admin Manager...</p>
          </div>
        ) : managers.length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={48} />
            <h3>{roleFilter === 'ADMIN_MANAGER' ? 'Belum Ada Admin Manager' : 'Tidak ada akun dengan peran yang dipilih'}</h3>
            <p>{roleFilter === 'ADMIN_MANAGER' ? 'Mulai dengan menambahkan Admin Manager pertama Anda.' : 'Periksa pencarian dan status, atau pilih peran lain.'}</p>
          </div>
        ) : (
          <>
            <table className={styles.managersTable}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Branches</th>
                  <th>Dibuat</th>
                  <th>Login Terakhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager) => (
                  <tr key={manager.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar}>
                          {manager.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.fullName}>{manager.fullName}</span>
                        {manager.role && manager.role !== 'ADMIN_MANAGER' && (
                          <span>{manager.role === 'ADMIN_LOGISTIK' ? 'Admin Logistik' : 'Finance & Logistik'}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.email}>{manager.email}</span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${manager.isActive ? styles.active : styles.inactive}`}>
                        {manager.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.branchesCell}>
                        {manager.branches.length > 0 ? (
                          <div className={styles.branchList}>
                            <span className={styles.branchCount}>
                              <Building2 size={14} />
                              {manager.branches.length} {manager.branches.length === 1 ? 'branch' : 'branches'}
                            </span>
                            <div className={styles.branchTooltip}>
                              {manager.branches.map((branch) => (
                                <div key={branch.id} className={styles.branchItem}>
                                  <span className={styles.branchCode}>{branch.branchCode}</span>
                                  <span className={styles.branchName}>{branch.name}</span>
                                  <span className={`${styles.branchScope} ${branch.accessScope === 'MEMBER_VIEW_ONLY' ? styles.memberOnly : styles.fullAccess}`}>
                                    {branch.accessScope === 'MEMBER_VIEW_ONLY' ? 'Member only' : 'Full'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className={styles.noBranches}>Tidak ada branch</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.date}>{formatDate(manager.createdAt)}</span>
                    </td>
                    <td>
                      <span className={styles.date}>
                        {manager.lastLoginAt ? formatDate(manager.lastLoginAt) : '-'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        {manager.role && manager.role !== 'ADMIN_MANAGER' ? (
                          <button
                            type="button"
                            className={styles.financeRoleBtn}
                            onClick={() => void setManagerRole(manager, 'ADMIN_MANAGER')}
                            aria-label={`Cabut Akses untuk ${manager.fullName}`}
                            disabled={convertingManagerId !== null}
                          >
                            {convertingManagerId === manager.id && <Loader2 size={16} className={styles.spinningIcon} />}
                            <span>Cabut Akses</span>
                          </button>
                        ) : (
                          <>
                        <button
                          type="button"
                          className={styles.financeRoleBtn}
                          onClick={() => void setManagerRole(manager, 'ADMIN_LOGISTIK')}
                          title="Ganti peran menjadi Admin Logistik, tanpa peran Finance"
                          aria-label={`Set Logistik untuk ${manager.fullName}`}
                          disabled={!manager.isActive || convertingManagerId !== null}
                        >
                          <Building2 size={16} />
                          <span>Set Logistik</span>
                        </button>
                        <button
                          type="button"
                          className={styles.financeRoleBtn}
                          onClick={() => void setManagerRole(manager, 'FINANCE_LOGISTICS_CONTROLLER')}
                          title="Tetapkan sebagai Finance & Logistics Controller"
                          aria-label={`Set Finance & Logistik untuk ${manager.fullName}`}
                          disabled={!manager.isActive || convertingManagerId !== null}
                        >
                          {convertingManagerId === manager.id
                            ? <Loader2 size={16} className={styles.spinningIcon} />
                            : <BadgeDollarSign size={16} />}
                          <span>Set Finance &amp; Logistik</span>
                        </button>
                        <button
                          className={styles.viewDetailBtn}
                          onClick={() => router.push(`/admin/managers/${manager.id}`)}
                          title="Lihat Detail & Kelola"
                        >
                          <Eye size={16} />
                          <span>Detail</span>
                        </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage(p => p - 1)}
                  disabled={!canGoPrevious}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                
                <div className={styles.pageInfo}>
                  Page {page} of {totalPages}
                </div>
                
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage(p => p + 1)}
                  disabled={!canGoNext}
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Admin Manager Modal */}
      <CreateAdminManagerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};
