'use client';

import { useEffect, useState } from 'react';
import {
  getUserBranches,
  assignUserToBranch,
  removeUserFromBranch,
  getAvailableBranches,
  type StaffBranchAssignment,
  type Branch,
} from '@/lib/api/staffBranchApi';
import { toast } from 'react-hot-toast';
import styles from './StaffBranchModal.module.css';

interface StaffBranchModalProps {
  userId: string;
  userName: string;
  userRole: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Staff Branch Management Modal
 * Allows Admin Manager to assign/remove branch assignments for doctors/nurses
 */
export function StaffBranchModal({
  userId,
  userName,
  userRole,
  onClose,
  onSuccess,
}: StaffBranchModalProps) {
  const [assigned, setAssigned] = useState<StaffBranchAssignment[]>([]);
  const [available, setAvailable] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, [userId]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const [userBranchesData, availableBranchesData] = await Promise.all([
        getUserBranches(userId),
        getAvailableBranches(userId),
      ]);
      setAssigned(userBranchesData.assignedBranches);
      setAvailable(availableBranchesData);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal memuat data cabang');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (branchId: string) => {
    try {
      setActionLoading(branchId);
      await assignUserToBranch(userId, branchId);
      toast.success('Cabang berhasil ditambahkan');
      await loadBranches();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal menambahkan cabang');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (branchId: string, isPrimary: boolean) => {
    if (isPrimary) {
      toast.error('Tidak dapat menghapus cabang utama');
      return;
    }

    if (!confirm('Yakin ingin menghapus assignment cabang ini?')) {
      return;
    }

    try {
      setActionLoading(branchId);
      await removeUserFromBranch(userId, branchId);
      toast.success('Assignment cabang berhasil dihapus');
      await loadBranches();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Gagal menghapus assignment cabang');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Kelola Cabang</h2>
          <p className={styles.subtitle}>
            {userName} ({userRole})
          </p>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>Memuat data...</div>
          ) : (
            <>
              {/* Assigned Branches Section */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Cabang yang Di-assign ({assigned.length})
                </h3>
                <div className={styles.branchList}>
                  {assigned.length === 0 ? (
                    <p className={styles.emptyText}>Belum ada cabang yang di-assign</p>
                  ) : (
                    assigned.map((assignment) => (
                      <div key={assignment.id} className={styles.branchRow}>
                        <div className={styles.branchInfo}>
                          {assignment.isPrimary && (
                            <span className={styles.primaryBadge} title="Cabang Utama">
                              ⭐
                            </span>
                          )}
                          <div>
                            <div className={styles.branchName}>
                              {assignment.branch.name}
                            </div>
                            <div className={styles.branchCode}>
                              {assignment.branch.branchCode}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => handleRemove(assignment.branchId, assignment.isPrimary)}
                          disabled={assignment.isPrimary || actionLoading === assignment.branchId}
                          title={assignment.isPrimary ? 'Cabang utama tidak dapat dihapus' : 'Hapus assignment'}
                        >
                          {actionLoading === assignment.branchId ? '...' : 'Hapus'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Available Branches Section */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Cabang Tersedia ({available.length})
                </h3>
                <div className={styles.branchList}>
                  {available.length === 0 ? (
                    <p className={styles.emptyText}>
                      Tidak ada cabang yang tersedia untuk ditambahkan
                    </p>
                  ) : (
                    available.map((branch) => (
                      <div key={branch.id} className={styles.branchRow}>
                        <div className={styles.branchInfo}>
                          <div>
                            <div className={styles.branchName}>{branch.name}</div>
                            <div className={styles.branchCode}>{branch.branchCode}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.addButton}
                          onClick={() => handleAssign(branch.id)}
                          disabled={actionLoading === branch.id}
                        >
                          {actionLoading === branch.id ? '...' : 'Tambah'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelButton} onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
