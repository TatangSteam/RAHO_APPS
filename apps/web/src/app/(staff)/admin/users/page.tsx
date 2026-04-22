'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import CreateStaffModal from '@/components/staff/CreateStaffModal';
import styles from './page.module.css';

interface Staff {
  id: string;
  email: string;
  role: string;
  staffCode: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  profile: {
    fullName: string;
    phone?: string;
  };
  branch: {
    name: string;
    branchCode: string;
  };
}

interface StaffActivity {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  createdAt: string;
  user: {
    staffCode: string;
    profile: {
      fullName: string;
    };
  };
}

export default function StaffManagementPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'activity'>('staff');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }

    // Check if user has access (ADMIN_CABANG, ADMIN_MANAGER, or SUPER_ADMIN)
    if (!['ADMIN_CABANG', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
      showToast.error('Akses ditolak. Anda tidak memiliki akses ke halaman ini.');
      router.push('/dashboard');
      return;
    }

    fetchStaff();
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users?limit=100`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Gagal memuat data user');
      }

      const data = await response.json();
      setStaff(data.data || []);
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      showToast.error(error.message || 'Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/audit-logs?limit=50`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Gagal memuat aktivitas');
      }

      const data = await response.json();
      setActivities(data.data || []);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
      showToast.error(error.message || 'Gagal memuat aktivitas');
    }
  };

  const handleToggleActive = async (staffId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${staffId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Gagal mengubah status user');
      }

      showToast.success(`User berhasil ${!currentStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
      fetchStaff();
    } catch (error: any) {
      console.error('Error toggling staff status:', error);
      showToast.error(error.message || 'Gagal mengubah status user');
    }
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; className: string }> = {
      DOCTOR: { label: 'Dokter', className: styles.roleDoctor },
      NURSE: { label: 'Perawat', className: styles.roleNurse },
      ADMIN_LAYANAN: { label: 'Admin Layanan', className: styles.roleAdmin },
    };

    const roleInfo = roleMap[role] || { label: role, className: styles.roleDefault };
    return <span className={`${styles.roleBadge} ${roleInfo.className}`}>{roleInfo.label}</span>;
  };

  const getActionBadge = (action: string) => {
    const actionMap: Record<string, { label: string; className: string }> = {
      CREATE: { label: 'Buat', className: styles.actionCreate },
      UPDATE: { label: 'Update', className: styles.actionUpdate },
      DELETE: { label: 'Hapus', className: styles.actionDelete },
      VERIFY: { label: 'Verifikasi', className: styles.actionVerify },
    };

    const actionInfo = actionMap[action] || { label: action, className: styles.actionDefault };
    return <span className={`${styles.actionBadge} ${actionInfo.className}`}>{actionInfo.label}</span>;
  };

  if (!mounted) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>👥 Kelola User</h1>
          <p>Kelola user di cabang Anda</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
          ➕ Tambah User
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'staff' ? styles.active : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          👤 Daftar User
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'activity' ? styles.active : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          📊 Aktivitas User
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data...</p>
        </div>
      ) : activeTab === 'staff' ? (
        <div className={styles.staffGrid}>
          {staff.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>👥</div>
              <h3>Belum Ada User</h3>
              <p>Tambahkan user pertama untuk cabang Anda</p>
            </div>
          ) : (
            staff.map((s) => (
              <div key={s.id} className={styles.staffCard}>
                <div className={styles.staffHeader}>
                  <div>
                    <h3>{s.profile.fullName}</h3>
                    <p className={styles.staffCode}>{s.staffCode}</p>
                  </div>
                  {getRoleBadge(s.role)}
                </div>

                <div className={styles.staffBody}>
                  <div className={styles.staffInfo}>
                    <span className={styles.label}>Email:</span>
                    <span>{s.email}</span>
                  </div>
                  {s.profile.phone && (
                    <div className={styles.staffInfo}>
                      <span className={styles.label}>Telepon:</span>
                      <span>{s.profile.phone}</span>
                    </div>
                  )}
                  <div className={styles.staffInfo}>
                    <span className={styles.label}>Status:</span>
                    <span className={`${styles.statusBadge} ${s.isActive ? styles.active : styles.inactive}`}>
                      {s.isActive ? '✓ Aktif' : '✗ Nonaktif'}
                    </span>
                  </div>
                  {s.lastLoginAt && (
                    <div className={styles.staffInfo}>
                      <span className={styles.label}>Login Terakhir:</span>
                      <span>{new Date(s.lastLoginAt).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                </div>

                <div className={styles.staffActions}>
                  <button
                    className={`${styles.actionBtn} ${s.isActive ? styles.deactivate : styles.activate}`}
                    onClick={() => handleToggleActive(s.id, s.isActive)}
                  >
                    {s.isActive ? '🚫 Nonaktifkan' : '✓ Aktifkan'}
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.view}`}
                    onClick={() => setSelectedStaff(s)}
                  >
                    👁️ Detail
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={styles.activityList}>
          {activities.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📊</div>
              <h3>Belum Ada Aktivitas</h3>
              <p>Aktivitas user akan muncul di sini</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className={styles.activityCard}>
                <div className={styles.activityHeader}>
                  {getActionBadge(activity.action)}
                  <span className={styles.activityTime}>
                    {new Date(activity.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className={styles.activityBody}>
                  <p className={styles.activityUser}>
                    <strong>{activity.user.profile.fullName}</strong> ({activity.user.staffCode})
                  </p>
                  <p className={styles.activityDetail}>
                    {activity.action} {activity.resource}
                    {activity.resourceId && ` #${activity.resourceId.substring(0, 8)}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Staff Modal */}
      <CreateStaffModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchStaff}
        accessToken={accessToken || ''}
        branchId={user?.branchId || null}
        userRole={user?.role || ''}
      />

      {/* Staff Detail Modal */}
      {selectedStaff && (
        <div className={styles.modal}>
          <div className={styles.modalOverlay} onClick={() => setSelectedStaff(null)} />
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Detail User</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedStaff(null)}>✕</button>
            </div>

            <div className={styles.detailBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Nama:</span>
                <span>{selectedStaff.profile.fullName}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Kode Staff:</span>
                <span>{selectedStaff.staffCode}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Email:</span>
                <span>{selectedStaff.email}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Role:</span>
                {getRoleBadge(selectedStaff.role)}
              </div>
              {selectedStaff.profile.phone && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Telepon:</span>
                  <span>{selectedStaff.profile.phone}</span>
                </div>
              )}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Cabang:</span>
                <span>{selectedStaff.branch.name} ({selectedStaff.branch.branchCode})</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status:</span>
                <span className={`${styles.statusBadge} ${selectedStaff.isActive ? styles.active : styles.inactive}`}>
                  {selectedStaff.isActive ? '✓ Aktif' : '✗ Nonaktif'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Dibuat:</span>
                <span>{new Date(selectedStaff.createdAt).toLocaleString('id-ID')}</span>
              </div>
              {selectedStaff.lastLoginAt && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Login Terakhir:</span>
                  <span>{new Date(selectedStaff.lastLoginAt).toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={`${styles.modalBtn} ${styles.cancel}`}
                onClick={() => setSelectedStaff(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
