'use client';

import { useState, useEffect } from 'react';
import { doctorBranchApi, ManagedBranch } from '@/lib/api/doctorBranchApi';
import { branchesApi } from '@/lib/api/branchesApi';
import styles from './page.module.css';

export default function AdminManagerBranchesPage() {
  const [branches, setBranches] = useState<ManagedBranch[]>([]);
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [managedData, allData] = await Promise.all([
        doctorBranchApi.getManagedBranches(true),
        branchesApi.getAllBranches(),
      ]);
      setBranches(managedData.branches);
      setAllBranches(allData.branches || allData);
    } catch (err: any) {
      console.error('Failed to load branches:', err);
      alert('Gagal memuat data cabang');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBranch = async () => {
    if (!selectedBranchId) {
      alert('Pilih cabang terlebih dahulu');
      return;
    }

    try {
      await doctorBranchApi.addManagedBranch(selectedBranchId);
      alert('Cabang berhasil ditambahkan ke daftar kelola Anda');
      setShowAddModal(false);
      setSelectedBranchId('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Gagal menambahkan cabang');
    }
  };

  const handleRemoveBranch = async (branchId: string, isPrimary: boolean) => {
    if (isPrimary) {
      alert('Cabang utama tidak dapat dihapus');
      return;
    }

    if (!confirm('Yakin ingin menghapus cabang ini dari daftar kelola?')) return;

    try {
      await doctorBranchApi.removeManagedBranch(branchId);
      alert('Cabang berhasil dihapus dari daftar kelola');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Gagal menghapus cabang');
    }
  };

  const availableBranches = allBranches.filter(
    (b) => !branches.some((mb) => mb.branchId === b.id)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Kelola Cabang</h1>
          <p className={styles.subtitle}>
            Manage cabang yang Anda kelola untuk assignment dokter
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className={styles.addBtn}>
          + Tambah Cabang
        </button>
      </div>

      {loading && (
        <div className={styles.loadingState}>
          <p>Memuat data cabang...</p>
        </div>
      )}

      {!loading && branches.length === 0 && (
        <div className={styles.emptyState}>
          <p>Belum ada cabang yang dikelola</p>
        </div>
      )}

      {!loading && branches.length > 0 && (
        <div className={styles.branchGrid}>
          {branches.map((branch) => (
            <div key={branch.branchId} className={styles.branchCard}>
              <div className={styles.branchHeader}>
                <div>
                  <h3 className={styles.branchName}>{branch.branchName}</h3>
                  <p className={styles.branchCode}>{branch.branchCode}</p>
                </div>
                {branch.isPrimary && (
                  <span className={styles.primaryBadge}>Cabang Utama</span>
                )}
              </div>

              {branch.address && (
                <p className={styles.branchAddress}>📍 {branch.address}</p>
              )}

              <div className={styles.branchType}>
                <span className={styles.typeLabel}>Tipe:</span>
                <span className={styles.typeValue}>{branch.type}</span>
              </div>

              {branch.stats && (
                <div className={styles.statsSection}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Dokter:</span>
                    <span className={styles.statValue}>{branch.stats.doctorCount}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Perawat:</span>
                    <span className={styles.statValue}>{branch.stats.nurseCount}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Member:</span>
                    <span className={styles.statValue}>{branch.stats.memberCount}</span>
                  </div>
                </div>
              )}

              <div className={styles.branchFooter}>
                <span className={styles.addedDate}>
                  Ditambahkan: {new Date(branch.addedAt).toLocaleDateString('id-ID')}
                </span>
                {!branch.isPrimary && (
                  <button
                    onClick={() => handleRemoveBranch(branch.branchId, branch.isPrimary)}
                    className={styles.removeBtn}
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Tambah Cabang</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalDescription}>
                Pilih cabang dari Admin Manager lain untuk ditambahkan ke daftar kelola Anda
              </p>

              <label className={styles.modalLabel}>Pilih Cabang:</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className={styles.modalSelect}
              >
                <option value="">-- Pilih Cabang --</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.branchCode})
                  </option>
                ))}
              </select>

              {availableBranches.length === 0 && (
                <p className={styles.noOptions}>
                  Semua cabang sudah ada di daftar kelola Anda
                </p>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => setShowAddModal(false)}
                className={styles.cancelBtn}
              >
                Batal
              </button>
              <button
                onClick={handleAddBranch}
                className={styles.confirmBtn}
                disabled={!selectedBranchId}
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
