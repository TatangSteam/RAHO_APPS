'use client';

import React, { useState, useEffect } from 'react';
import { branchAdminsApi, BranchAdmin } from '@/lib/api/branchAdminsApi';
import { ImpersonateButton } from './ImpersonateButton';
import { showToast } from '@/lib/toast';
import { Search, Filter, ChevronLeft, ChevronRight, Users, Building2 } from 'lucide-react';
import styles from './BranchAdminsTab.module.css';

export const BranchAdminsTab: React.FC = () => {
  // State
  const [branchAdmins, setBranchAdmins] = useState<BranchAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Get unique branches for filter dropdown
  const uniqueBranches = Array.from(
    new Map(branchAdmins.map(admin => [admin.branch.id, admin.branch])).values()
  );

  // Load branch admins
  useEffect(() => {
    loadBranchAdmins();
  }, [page, search, branchFilter, statusFilter]);

  const loadBranchAdmins = async () => {
    try {
      setLoading(true);
      
      const params: any = { page, limit };
      if (search) params.search = search;
      if (branchFilter !== 'all') params.branchId = branchFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await branchAdminsApi.getBranchAdmins(params);
      
      setBranchAdmins(response.data);
      setTotal(response.meta.total);
    } catch (error: any) {
      console.error('Error loading branch admins:', error);
      showToast.error(error.response?.data?.message || 'Gagal memuat data Admin Cabang');
      setBranchAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page on search
  };

  const handleBranchFilterChange = (value: string) => {
    setBranchFilter(value);
    setPage(1); // Reset to first page on filter change
  };

  const handleStatusFilterChange = (value: 'all' | 'active' | 'inactive') => {
    setStatusFilter(value);
    setPage(1); // Reset to first page on filter change
  };

  // Pagination
  const totalPages = Math.ceil(total / limit);
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  // Stats
  const activeCount = branchAdmins.filter(admin => admin.isActive).length;
  const branchCount = uniqueBranches.length;

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={styles.branchAdminsTab}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <h2>Admin Cabang</h2>
            <p>Kelola dan monitor Admin Cabang di branches yang Anda kelola</p>
          </div>
          <button className={styles.addButton}>
            <span className={styles.addIcon}>+</span>
            <span>Tambah Admin Cabang</span>
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
            <div className={styles.statLabel}>Total Admin Cabang</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#10b98115', color: '#10b981' }}>
            <Users size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{activeCount}</div>
            <div className={styles.statLabel}>Admin Cabang Aktif</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f59e0b15', color: '#f59e0b' }}>
            <Building2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{branchCount}</div>
            <div className={styles.statLabel}>Total Branches</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Cari Admin Cabang..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <Building2 size={18} />
          <select 
            value={branchFilter} 
            onChange={(e) => handleBranchFilterChange(e.target.value)}
          >
            <option value="all">Semua Branch</option>
            {uniqueBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branchCode} - {branch.name}
              </option>
            ))}
          </select>
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
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}>⏳</div>
            <p>Memuat data Admin Cabang...</p>
          </div>
        ) : branchAdmins.length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={48} />
            <h3>Belum Ada Admin Cabang</h3>
            <p>Mulai dengan menambahkan Admin Cabang pertama Anda.</p>
            <button className={styles.addButton}>
              <span className={styles.addIcon}>+</span>
              Tambah Admin Cabang
            </button>
          </div>
        ) : (
          <>
            <table className={styles.branchAdminsTable}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th>Login Terakhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {branchAdmins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar}>
                          {admin.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className={styles.fullName}>{admin.fullName}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.email}>{admin.email}</span>
                    </td>
                    <td>
                      <div className={styles.branchCell}>
                        <span className={styles.branchCode}>{admin.branch.branchCode}</span>
                        <span className={styles.branchName}>{admin.branch.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${admin.isActive ? styles.active : styles.inactive}`}>
                        {admin.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td>
                      <span className={styles.date}>{formatDate(admin.createdAt)}</span>
                    </td>
                    <td>
                      <span className={styles.date}>
                        {admin.lastLoginAt ? formatDate(admin.lastLoginAt) : '-'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <ImpersonateButton
                          userId={admin.id}
                          userName={admin.fullName}
                          targetRole="ADMIN_CABANG"
                          disabled={!admin.isActive}
                          className={styles.impersonateBtn}
                        />
                        <button
                          className={`${styles.actionBtn} ${styles.edit}`}
                          title="Edit Admin Cabang"
                        >
                          ✏️
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.deactivate}`}
                          title={admin.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {admin.isActive ? '🚫' : '✅'}
                        </button>
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
    </div>
  );
};
