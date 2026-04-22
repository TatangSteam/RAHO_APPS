'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { getAllBranches, deleteBranch, type Branch } from '@/lib/branchesApi';
import { showToast } from '@/lib/toast';
import CreateBranchModal from '@/components/branches/CreateBranchModal';
import EditBranchModal from '@/components/branches/EditBranchModal';
import styles from './page.module.css';

export default function BranchesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Check access
    if (!['ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
      showToast.error('Akses ditolak');
      router.push('/dashboard');
      return;
    }

    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const response = await getAllBranches();
      setBranches(response.data || []);
    } catch (error: any) {
      console.error('Error loading branches:', error);
      showToast.error(error.message || 'Gagal memuat data cabang');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (branchId: string, branchName: string) => {
    if (!confirm(`Yakin ingin menonaktifkan cabang "${branchName}"?`)) {
      return;
    }

    try {
      await deleteBranch(branchId);
      showToast.success('Cabang berhasil dinonaktifkan');
      loadBranches();
    } catch (error: any) {
      console.error('Error deleting branch:', error);
      showToast.error(error.message || 'Gagal menonaktifkan cabang');
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data cabang...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>🏢 Manajemen Cabang</h1>
          <p>Kelola semua cabang klinik</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
          ➕ Tambah Cabang
        </button>
      </div>

      {branches.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🏢</div>
          <h3>Belum Ada Cabang</h3>
          <p>Tambahkan cabang pertama untuk memulai</p>
          <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
            ➕ Tambah Cabang
          </button>
        </div>
      ) : (
        <div className={styles.branchGrid}>
          {branches.map((branch) => (
            <div key={branch.id} className={styles.branchCard}>
              <div 
                className={styles.branchClickable}
                onClick={() => router.push(`/admin/branches/${branch.id}`)}
              >
                <div className={styles.branchHeader}>
                  <div>
                    <h3>{branch.name}</h3>
                    <p className={styles.branchCode}>{branch.branchCode}</p>
                  </div>
                  <div className={styles.badges}>
                    <span className={`${styles.typeBadge} ${styles[branch.type.toLowerCase()]}`}>
                      {branch.type === 'KLINIK' ? '🏥 Klinik' : 
                       branch.type === 'HOMECARE' ? '🏠 Homecare' :
                       branch.type === 'PREMIERE' ? '⭐ Premiere' : '🤝 Partnership'}
                    </span>
                    <span className={`${styles.statusBadge} ${branch.isActive ? styles.active : styles.inactive}`}>
                      {branch.isActive ? '✓ Aktif' : '✗ Nonaktif'}
                    </span>
                  </div>
                </div>

                <div className={styles.branchBody}>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>📍 Alamat:</span>
                    <span>{branch.address}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>🏙️ Kota:</span>
                    <span>{branch.city}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.label}>📞 Telepon:</span>
                    <span>{branch.phone}</span>
                  </div>
                  {branch.operatingHours && (
                    <div className={styles.infoRow}>
                      <span className={styles.label}>🕐 Jam Operasional:</span>
                      <span>{branch.operatingHours}</span>
                    </div>
                  )}
                </div>

                {branch.stats && (
                  <div className={styles.stats}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{branch.stats.activeUsers}</span>
                      <span className={styles.statLabel}>User Aktif</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{branch.stats.totalMembers}</span>
                      <span className={styles.statLabel}>Member</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{branch.stats.activePackages}</span>
                      <span className={styles.statLabel}>Paket Aktif</span>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.actions}>
                <button
                  className={`${styles.actionBtn} ${styles.view}`}
                  onClick={() => router.push(`/admin/branches/${branch.id}`)}
                >
                  👁️ Detail
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.edit}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingBranch(branch);
                  }}
                >
                  ✏️ Edit
                </button>
                {branch.isActive && (
                  <button
                    className={`${styles.actionBtn} ${styles.delete}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(branch.id, branch.name);
                    }}
                  >
                    🚫 Nonaktifkan
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateBranchModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadBranches();
        }}
      />

      {/* Edit Modal */}
      {editingBranch && (
        <EditBranchModal
          show={!!editingBranch}
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSuccess={() => {
            setEditingBranch(null);
            loadBranches();
          }}
        />
      )}
    </div>
  );
}
