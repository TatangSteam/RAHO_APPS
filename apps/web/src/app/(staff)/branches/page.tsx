'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { branchesApi } from '@/lib/api/branchesApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { hasRole, MANAGER_ABOVE_ROLES } from '@/types/auth';
import { 
  Building2, Plus, Search, Filter, Edit, Trash2, Users, 
  MapPin, Phone, ChevronLeft, ChevronRight 
} from 'lucide-react';
import styles from '@/styles/branches.module.css';

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
  const limit = 10;

  // Check authorization
  useEffect(() => {
    console.log('🔍 [BranchesPage] User check:', { 
      user, 
      role: user?.role, 
      hasAccess: user ? hasRole(user.role, MANAGER_ABOVE_ROLES) : false,
      requiredRoles: MANAGER_ABOVE_ROLES 
    });
    
    if (!user) {
      console.warn('⚠️ [BranchesPage] No user found, redirecting to login');
      router.push('/login');
      return;
    }
    
    if (!hasRole(user.role, MANAGER_ABOVE_ROLES)) {
      console.warn('⚠️ [BranchesPage] User does not have required role:', { 
        userRole: user?.role, 
        requiredRoles: MANAGER_ABOVE_ROLES 
      });
      showToast.error(`Akses ditolak. Role Anda: ${user.role}. Diperlukan: SUPER_ADMIN atau ADMIN_MANAGER`);
      router.push('/dashboard');
      return;
    }
    
    console.log('✅ [BranchesPage] User authorized, role:', user.role);
  }, [user, router]);

  useEffect(() => {
    if (user && hasRole(user.role, MANAGER_ABOVE_ROLES)) {
      loadBranches();
    }
  }, [page, search, typeFilter, statusFilter, user]);

  const loadBranches = async () => {
    if (!user || !hasRole(user.role, MANAGER_ABOVE_ROLES)) {
      return;
    }

    try {
      setLoading(true);
      const params: any = { page, limit };
      
      if (search) params.search = search;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';

      const response = await branchesApi.listBranches(params);
      
      if (response.data && response.data.data) {
        setBranches(response.data.data);
        setTotal(response.data.meta?.total || 0);
      }
    } catch (error: any) {
      console.error('Error loading branches:', error);
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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (branchId: string, branchName: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus cabang "${branchName}"?`)) {
      return;
    }

    try {
      await branchesApi.deleteBranch(branchId);
      showToast.success('Cabang berhasil dihapus');
      loadBranches();
    } catch (error: any) {
      console.error('Error deleting branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal menghapus cabang');
    }
  };

  const getBranchTypeColor = (type: string) => {
    switch (type) {
      case 'PUSAT': return '#f59e0b';
      case 'PREMIERE': return '#eab308';
      case 'PARTNERSHIP': return '#3b82f6';
      case 'KLINIK': return '#10b981';
      case 'HOMECARE': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getBranchTypeLabel = (type: string) => {
    return type.charAt(0) + type.slice(1).toLowerCase();
  };

  const totalPages = Math.ceil(total / limit);

  // Stats
  const activeCount = branches.filter(b => b.isActive).length;
  const totalMembers = branches.reduce((sum, b) => sum + (b._count?.members || 0), 0);
  const totalStaff = branches.reduce((sum, b) => sum + (b._count?.staff || 0), 0);

  // Show loading if user is not yet available
  if (!user) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <p>Memuat informasi user...</p>
      </div>
    );
  }

  // Check if user has access
  if (!hasRole(user.role, MANAGER_ABOVE_ROLES)) {
    return (
      <div className={styles.accessDenied}>
        <div className={styles.accessDeniedContent}>
          <Building2 size={64} color="#ef4444" />
          <h2>Akses Ditolak</h2>
          <p>Anda tidak memiliki akses ke halaman ini.</p>
          <p><strong>Role Anda:</strong> {user.role}</p>
          <p><strong>Role yang Diperlukan:</strong> SUPER_ADMIN atau ADMIN_MANAGER</p>
          <button 
            className={styles.backToDashboardBtn}
            onClick={() => router.push('/dashboard')}
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.branchesPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}>
              <Building2 size={28} />
            </div>
            <div className={styles.headerText}>
              <h1>Pengaturan Cabang</h1>
              <p>Kelola semua cabang klinik dengan mudah dan efisien</p>
            </div>
          </div>
          <button className={styles.createBtn} onClick={() => router.push('/branches/create')}>
            <Plus size={20} />
            <span>Tambah Cabang</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#3b82f615', color: '#3b82f6' }}>
            <Building2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{total}</div>
            <div className={styles.statLabel}>Total Cabang</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#10b98115', color: '#10b981' }}>
            <Building2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{activeCount}</div>
            <div className={styles.statLabel}>Cabang Aktif</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#f59e0b15', color: '#f59e0b' }}>
            <Users size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{totalMembers}</div>
            <div className={styles.statLabel}>Total Member</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#8b5cf615', color: '#8b5cf6' }}>
            <Users size={24} />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{totalStaff}</div>
            <div className={styles.statLabel}>Total Staff</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Cari cabang..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <Filter size={18} />
          <select 
            value={typeFilter} 
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Semua Tipe</option>
            <option value="PUSAT">Pusat</option>
            <option value="PREMIERE">Premiere</option>
            <option value="PARTNERSHIP">Partnership</option>
            <option value="KLINIK">Klinik</option>
            <option value="HOMECARE">Homecare</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
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
            <div className={styles.loadingSpinner} />
            <p>Memuat data cabang...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className={styles.emptyState}>
            <Building2 size={48} />
            <h3>Belum Ada Cabang</h3>
            <p>Mulai dengan menambahkan cabang pertama Anda.</p>
            <button className={styles.createBtn} onClick={() => router.push('/branches/create')}>
              <Plus size={18} />
              Tambah Cabang
            </button>
          </div>
        ) : (
          <>
            <table className={styles.branchesTable}>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Cabang</th>
                  <th>Tipe</th>
                  <th>Lokasi</th>
                  <th>Kontak</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td>
                      <span className={styles.branchCode}>{branch.branchCode}</span>
                    </td>
                    <td>
                      <div className={styles.branchNameCell}>
                        <Building2 size={16} />
                        <span>{branch.name}</span>
                      </div>
                    </td>
                    <td>
                      <span 
                        className={styles.typeBadge}
                        style={{ 
                          background: `${getBranchTypeColor(branch.type)}20`,
                          color: getBranchTypeColor(branch.type),
                          borderColor: `${getBranchTypeColor(branch.type)}40`
                        }}
                      >
                        {getBranchTypeLabel(branch.type)}
                      </span>
                    </td>
                    <td>
                      <div className={styles.locationCell}>
                        <MapPin size={14} />
                        <span>{branch.city}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.contactCell}>
                        <Phone size={14} />
                        <span>{branch.phone}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.membersCell}>
                        <Users size={14} />
                        <span>{branch._count?.members || 0}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${branch.isActive ? styles.active : styles.inactive}`}>
                        {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={`${styles.actionBtn} ${styles.view}`}
                          onClick={() => router.push(`/branches/${branch.id}`)}
                          title="Lihat Detail"
                        >
                          <Building2 size={16} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.edit}`}
                          onClick={() => router.push(`/branches/${branch.id}/edit`)}
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.delete}`}
                          onClick={() => handleDelete(branch.id, branch.name)}
                          title="Hapus"
                        >
                          <Trash2 size={16} />
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
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                
                <div className={styles.pageInfo}>
                  Page {page} of {totalPages}
                </div>
                
                <button
                  className={styles.pageBtn}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
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
}
