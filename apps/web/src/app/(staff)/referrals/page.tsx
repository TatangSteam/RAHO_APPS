'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as referralsApi from '@/lib/api/referralsApi';
import { branchesApi } from '@/lib/api/branchesApi';
import { useAuthStore } from '@/stores/authStore';
import styles from '@/styles/referrals.module.css';

interface Branch {
  id: string;
  name: string;
  branchCode: string;
}

export default function ReferralsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [referrals, setReferrals] = useState<referralsApi.ReferralCode[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check if user is ADMIN_CABANG (should not see branch filter)
  const isAdminCabang = user?.role === 'ADMIN_CABANG';

  useEffect(() => {
    fetchReferrals();
    fetchBranches();
  }, [page, search, branchFilter, typeFilter]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const response = await referralsApi.listReferrals({
        page,
        limit,
        search: search || undefined,
        branchId: branchFilter || undefined,
        referrerType: typeFilter as any || undefined,
        isActive: 'true',
      });
      setReferrals(response.data.data.referrals);
      setTotal(response.data.data.total);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    // Only fetch branches if user is not ADMIN_CABANG
    if (isAdminCabang) return;
    
    try {
      const response = await branchesApi.getAllBranches();
      setBranches(response.data.data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kode referral ini?')) return;

    try {
      await referralsApi.deleteReferral(id);
      fetchReferrals();
    } catch (error) {
      console.error('Error deleting referral:', error);
      alert('Gagal menghapus kode referral');
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await referralsApi.exportIncentivesExcel({
        branchId: branchFilter || undefined,
        referrerType: typeFilter || undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Insentif_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Gagal export ke Excel');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await referralsApi.exportIncentivesPDF({
        branchId: branchFilter || undefined,
        referrerType: typeFilter || undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Insentif_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Gagal export ke PDF');
    }
  };

  const handleExportSummary = async () => {
    try {
      const response = await referralsApi.exportSummaryExcel({
        branchId: branchFilter || undefined,
        referrerType: typeFilter || undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ringkasan_Insentif_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting summary:', error);
      alert('Gagal export ringkasan');
    }
  };

  const formatIncentive = (type: string, value: number) => {
    if (type === 'PERCENTAGE') {
      return `${value}%`;
    }
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const getReferrerTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SALES: 'Sales',
      DOKTER: 'Dokter',
      MEMBER: 'Member',
    };
    return labels[type] || type;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Kode Referral</h1>
          <p className={styles.subtitle}>Kelola kode referral dan insentif sales</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportButton} onClick={handleExportSummary}>
            📊 Ringkasan
          </button>
          <button className={styles.exportButton} onClick={handleExportExcel}>
            📥 Excel
          </button>
          <button className={styles.exportButton} onClick={handleExportPDF}>
            📄 PDF
          </button>
          <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
            + Tambah Referral
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Cari kode, nama, phone, email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={styles.searchInput}
        />
        {/* Hide branch filter for ADMIN_CABANG */}
        {!isAdminCabang && (
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className={styles.filterSelect}
          >
            <option value="">Semua Cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className={styles.filterSelect}
        >
          <option value="">Semua Tipe</option>
          <option value="SALES">Sales</option>
          <option value="DOKTER">Dokter</option>
          <option value="MEMBER">Member</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.loading}>Memuat data...</div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Cabang</th>
                  <th>Kontak</th>
                  <th>Total Referral</th>
                  <th>Total Insentif</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {referrals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={styles.emptyState}>
                      Tidak ada data referral
                    </td>
                  </tr>
                ) : (
                  referrals.map((referral) => (
                    <tr key={referral.id}>
                      <td>
                        <span className={styles.code}>{referral.code}</span>
                      </td>
                      <td>{referral.referrerName}</td>
                      <td>
                        <span className={`${styles.badge} ${styles[`badge${referral.referrerType}`]}`}>
                          {getReferrerTypeLabel(referral.referrerType)}
                        </span>
                      </td>
                      <td>{referral.branch.name}</td>
                      <td>
                        <div className={styles.contact}>
                          {referral.phone && <div>{referral.phone}</div>}
                          {referral.email && <div className={styles.email}>{referral.email}</div>}
                        </div>
                      </td>
                      <td className={styles.textCenter}>{referral.totalReferrals}</td>
                      <td className={styles.textRight}>{formatCurrency(referral.totalIncentiveEarned)}</td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={styles.viewButton}
                            onClick={() => router.push(`/referrals/${referral.id}`)}
                          >
                            Detail
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => handleDelete(referral.id)}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={styles.paginationButton}
              >
                ← Sebelumnya
              </button>
              <span className={styles.paginationInfo}>
                Halaman {page} dari {totalPages} ({total} total)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={styles.paginationButton}
              >
                Selanjutnya →
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReferralModal
          branches={branches}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchReferrals();
          }}
        />
      )}
    </div>
  );
}

// Create Referral Modal Component
function CreateReferralModal({
  branches,
  onClose,
  onSuccess,
}: {
  branches: Branch[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<referralsApi.CreateReferralInput>({
    referrerName: '',
    referrerType: 'SALES',
    branchId: '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await referralsApi.createReferral(formData);
      onSuccess();
    } catch (error) {
      console.error('Error creating referral:', error);
      alert('Gagal membuat kode referral');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Tambah Kode Referral</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Nama Referrer *</label>
            <input
              type="text"
              value={formData.referrerName}
              onChange={(e) => setFormData({ ...formData, referrerName: e.target.value })}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Tipe *</label>
              <select
                value={formData.referrerType}
                onChange={(e) => setFormData({ ...formData, referrerType: e.target.value as any })}
                required
              >
                <option value="SALES">Sales</option>
                <option value="DOKTER">Dokter</option>
                <option value="MEMBER">Member</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Cabang *</label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                required
              >
                <option value="">Pilih Cabang</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.infoBox}>
            <strong>ℹ️ Catatan:</strong> Insentif ditentukan saat membuat member, bukan saat membuat kode referral.
            Setiap member dapat memiliki rate insentif yang berbeda meskipun menggunakan kode referral yang sama.
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Batal
            </button>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
