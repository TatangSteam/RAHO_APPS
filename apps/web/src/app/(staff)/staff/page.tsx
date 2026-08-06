'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { showToast, confirm } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { devLog, devError } from '@/lib/logger';
import { 
  UserCog, Plus, Edit, Trash2, Search, 
  Mail, Phone, Shield, RefreshCw
} from 'lucide-react';
import StaffCrudModal from '@/components/branches/StaffCrudModal';
import styles from './page.module.css';
import { PageLoading } from '@/components/ui/LoadingSpinner';

interface Staff {
  id: string;
  email: string;
  role: string;
  staffCode: string;
  isActive: boolean;
  therapyCount?: number;
  profile: {
    fullName: string;
    phone: string;
    avatarUrl?: string;
  };
  branch?: {
    id: string;
    name: string;
    branchCode: string;
  };
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN_CABANG: 'Admin Cabang',
  ADMIN_LAYANAN: 'Admin Layanan',
  DOCTOR: 'Dokter',
  NURSE: 'Perawat',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN_CABANG: '#f59e0b',
  ADMIN_LAYANAN: '#22c55e',
  DOCTOR: '#3b82f6',
  NURSE: '#06b6d4',
};

export default function StaffManagementPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<'create' | 'edit'>('create');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const loadStaff = useCallback(async () => {
    if (!user?.branchId) return;

    try {
      setLoading(true);
      const response = await api.get('/users', {
        params: {
          branchId: user.branchId,
          page: 1,
          limit: 100,
        },
      });
      
      devLog('🔍 [StaffPage] API response:', response.data);
      
      // API returns { success: true, data: [...users], meta: {...} }
      const staffData = response.data.data || [];
      devLog('🔍 [StaffPage] Staff data:', staffData);
      
      setStaff(Array.isArray(staffData) ? staffData : []);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading staff:', error);
      showToast.error('Gagal memuat data staff');
    } finally {
      setLoading(false);
    }
  }, [user?.branchId]);

  // Check authorization - only ADMIN_CABANG can access
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'ADMIN_CABANG') {
      showToast.error('Anda tidak memiliki akses ke halaman ini');
      router.push('/dashboard');
      return;
    }
    if (!user.branchId) {
      showToast.error('Anda tidak terdaftar di cabang manapun');
      router.push('/dashboard');
      return;
    }
    void loadStaff();
  }, [loadStaff, router, user]);

  const handleOpenCreateModal = () => {
    setSelectedStaff(null);
    setModalAction('create');
    setShowModal(true);
  };

  const handleOpenEditModal = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setModalAction('edit');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedStaff(null);
  };

  const handleModalSuccess = () => {
    handleCloseModal();
    loadStaff();
  };

  const handleDeleteStaff = async (staffMember: Staff) => {
    const confirmed = await confirm.warning(
      'Nonaktifkan Staff',
      `Apakah Anda yakin ingin menonaktifkan ${staffMember.profile.fullName}?`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/users/${staffMember.id}`);
      showToast.success('Staff berhasil dinonaktifkan');
      loadStaff();
    } catch (error) {
      assertCaughtError(error);
      devError('Error deleting staff:', error);
      showToast.error(error.response?.data?.message || 'Gagal menonaktifkan staff');
    }
  };

  // Filter staff based on search and role
  const filteredStaff = staff.filter((s) => {
    const matchesSearch = 
      s.profile.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.staffCode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = !roleFilter || s.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  if (!user || user.role !== 'ADMIN_CABANG') {
    return null;
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <UserCog size={24} />
          </div>
          <div className={styles.headerText}>
            <h1>Kelola Staff</h1>
            <p>Kelola staff untuk cabang {user.branchCode || 'Anda'}</p>
          </div>
        </div>
        <button className={styles.addButton} onClick={handleOpenCreateModal}>
          <Plus size={18} />
          <span>Tambah Staff</span>
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Cari nama, email, atau kode staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Semua Role</option>
          <option value="ADMIN_LAYANAN">Admin Layanan</option>
          <option value="DOCTOR">Dokter</option>
          <option value="NURSE">Perawat</option>
        </select>
        <button className={styles.refreshButton} onClick={loadStaff} title="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{staff.length}</div>
          <div className={styles.statLabel}>Total Staff</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {staff.filter(s => s.role === 'ADMIN_LAYANAN').length}
          </div>
          <div className={styles.statLabel}>Admin Layanan</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {staff.filter(s => s.role === 'DOCTOR').length}
          </div>
          <div className={styles.statLabel}>Dokter</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {staff.filter(s => s.role === 'NURSE').length}
          </div>
          <div className={styles.statLabel}>Perawat</div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <PageLoading text="Memuat data staff" />
      ) : filteredStaff.length === 0 ? (
        <div className={styles.emptyState}>
          <UserCog size={48} />
          <h3>Belum Ada Staff</h3>
          <p>
            {searchQuery || roleFilter 
              ? 'Tidak ada staff yang sesuai dengan filter.'
              : 'Cabang ini belum memiliki staff. Tambahkan staff pertama.'}
          </p>
          {!searchQuery && !roleFilter && (
            <button className={styles.emptyButton} onClick={handleOpenCreateModal}>
              <Plus size={18} />
              <span>Tambah Staff Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Kontak</th>
                <th>Role</th>
                <th>Kode Staff</th>
                <th>Terapi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((staffMember) => (
                <tr key={staffMember.id}>
                  <td>
                    <div className={styles.staffCell}>
                      <div className={styles.avatar}>
                        {staffMember.profile.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.staffInfo}>
                        <div className={styles.staffName}>
                          {staffMember.profile.fullName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.contactInfo}>
                      <div className={styles.contactItem}>
                        <Mail size={14} />
                        <span>{staffMember.email}</span>
                      </div>
                      {staffMember.profile.phone && (
                        <div className={styles.contactItem}>
                          <Phone size={14} />
                          <span>{staffMember.profile.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span 
                      className={styles.roleBadge}
                      style={{ 
                        background: `${ROLE_COLORS[staffMember.role] || '#6b7280'}15`,
                        color: ROLE_COLORS[staffMember.role] || '#6b7280',
                        borderColor: `${ROLE_COLORS[staffMember.role] || '#6b7280'}30`,
                      }}
                    >
                      <Shield size={12} />
                      {ROLE_LABELS[staffMember.role] || staffMember.role}
                    </span>
                  </td>
                  <td>
                    <span className={styles.staffCode}>
                      {staffMember.staffCode || '-'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.therapyCount}>
                      {staffMember.therapyCount || 0} sesi
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${staffMember.isActive ? styles.active : styles.inactive}`}>
                      {staffMember.isActive ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {/* ADMIN_CABANG tidak boleh mengedit ADMIN_CABANG lain */}
                      {staffMember.role !== 'ADMIN_CABANG' && (
                        <button
                          className={`${styles.actionBtn} ${styles.editBtn}`}
                          onClick={() => handleOpenEditModal(staffMember)}
                          title="Edit Staff"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                      {/* ADMIN_CABANG tidak boleh menghapus ADMIN_CABANG lain */}
                      {staffMember.role !== 'ADMIN_CABANG' && (
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => handleDeleteStaff(staffMember)}
                          title="Nonaktifkan Staff"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Staff CRUD Modal */}
      {showModal && user?.branchId && (
        <StaffCrudModal
          isOpen={showModal}
          onClose={handleCloseModal}
          onSuccess={handleModalSuccess}
          action={modalAction}
          branchId={user.branchId}
          staffData={selectedStaff}
          callerRole={user.role}
        />
      )}
    </div>
  );
}
