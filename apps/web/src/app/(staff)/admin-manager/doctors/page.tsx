'use client';

import { useState, useEffect } from 'react';
import { doctorBranchApi, DoctorWithBranches, ManagedBranch } from '@/lib/api/doctorBranchApi';
import styles from './page.module.css';

export default function AdminManagerDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorWithBranches[]>([]);
  const [branches, setBranches] = useState<ManagedBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load managed branches
  useEffect(() => {
    loadBranches();
  }, []);

  // Load doctors when branch changes
  useEffect(() => {
    loadDoctors();
  }, [selectedBranchId]);

  const loadBranches = async () => {
    try {
      const data = await doctorBranchApi.getManagedBranches(false);
      setBranches(data);
    } catch (err: any) {
      console.error('Failed to load branches:', err);
      setError('Gagal memuat cabang');
    }
  };

  const loadDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await doctorBranchApi.getDoctorsByBranch({
        branchId: selectedBranchId || undefined,
        status: true,
      });
      setDoctors(data.doctors);
    } catch (err: any) {
      console.error('Failed to load doctors:', err);
      setError(err.response?.data?.error?.message || 'Gagal memuat data dokter');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDoctor = async (doctorId: string, branchId: string) => {
    if (!confirm('Yakin ingin remove dokter dari cabang ini?')) return;

    try {
      await doctorBranchApi.removeDoctorFromBranch(doctorId, branchId);
      alert('Dokter berhasil di-remove dari cabang');
      loadDoctors();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Gagal remove dokter');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Kelola Dokter</h1>
        <p className={styles.subtitle}>
          Manage assignment dokter ke cabang yang Anda kelola
        </p>
      </div>

      {/* Branch Filter */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Filter Cabang:</label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Semua Cabang</option>
          {branches.map((branch) => (
            <option key={branch.branchId} value={branch.branchId}>
              {branch.branchName} {branch.isPrimary ? '(Utama)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Error Alert */}
      {error && (
        <div className={styles.errorAlert}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loadingState}>
          <p>Memuat data dokter...</p>
        </div>
      )}

      {/* Doctors List */}
      {!loading && doctors.length === 0 && (
        <div className={styles.emptyState}>
          <p>Belum ada dokter di-assign ke cabang ini</p>
        </div>
      )}

      {!loading && doctors.length > 0 && (
        <div className={styles.doctorGrid}>
          {doctors.map((doctor) => (
            <div key={doctor.userId} className={styles.doctorCard}>
              <div className={styles.doctorHeader}>
                <h3 className={styles.doctorName}>{doctor.fullName}</h3>
                <span
                  className={`${styles.statusBadge} ${
                    doctor.isActive ? styles.statusActive : styles.statusInactive
                  }`}
                >
                  {doctor.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>

              <div className={styles.doctorInfo}>
                <p>
                  <strong>Email:</strong> {doctor.email}
                </p>
                {doctor.phoneNumber && (
                  <p>
                    <strong>Telepon:</strong> {doctor.phoneNumber}
                  </p>
                )}
                <p>
                  <strong>Jumlah Sesi:</strong> {doctor.sessionCount}
                </p>
              </div>

              <div className={styles.branchesSection}>
                <p className={styles.branchesLabel}>
                  <strong>Cabang Assigned:</strong>
                </p>
                <div className={styles.branchList}>
                  {doctor.assignedBranches.map((branch) => (
                    <div key={branch.branchId} className={styles.branchItem}>
                      <span className={styles.branchName}>
                        {branch.branchName} ({branch.branchCode})
                      </span>
                      <button
                        onClick={() => handleRemoveDoctor(doctor.userId, branch.branchId)}
                        className={styles.removeBtn}
                        title="Remove dari cabang"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
