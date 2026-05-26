'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as referralsApi from '@/lib/api/referralsApi';
import { devError } from '@/lib/logger';
import styles from '@/styles/referral-detail.module.css';

export default function ReferralDetailPage() {
  const router = useRouter();
  const params = useParams();
  const referralId = params.referralId as string;

  const [referral, setReferral] = useState<referralsApi.ReferralCode | null>(null);
  const [incentives, setIncentives] = useState<referralsApi.IncentiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [incentivesLoading, setIncentivesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchReferral();
    fetchIncentives();
  }, [referralId, page]);

  const fetchReferral = async () => {
    try {
      setLoading(true);
      const response = await referralsApi.getReferralById(referralId);
      setReferral(response.data.data);
    } catch (error) {
      devError('Error fetching referral:', error);
      alert('Gagal memuat data referral');
      router.push('/referrals');
    } finally {
      setLoading(false);
    }
  };

  const fetchIncentives = async () => {
    try {
      setIncentivesLoading(true);
      const response = await referralsApi.getReferralIncentives(referralId, page, limit);
      setIncentives(response.data.data.records);
      setTotal(response.data.data.total);
    } catch (error) {
      devError('Error fetching incentives:', error);
    } finally {
      setIncentivesLoading(false);
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

  const handleExportExcel = async () => {
    try {
      const response = await referralsApi.exportIncentivesExcel({
        referralId: referralId,
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Insentif_${referral?.code}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      devError('Error exporting to Excel:', error);
      alert('Gagal export ke Excel');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await referralsApi.exportIncentivesPDF({
        referralId: referralId,
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Insentif_${referral?.code}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      devError('Error exporting to PDF:', error);
      alert('Gagal export ke PDF');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Memuat data...</div>;
  }

  if (!referral) {
    return <div className={styles.error}>Data referral tidak ditemukan</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => router.push('/referrals')}>
          ← Kembali
        </button>
        <div className={styles.headerActions}>
          <button className={styles.exportButton} onClick={handleExportExcel}>
            📥 Excel
          </button>
          <button className={styles.exportButton} onClick={handleExportPDF}>
            📄 PDF
          </button>
          <button className={styles.editButton} onClick={() => setShowEditModal(true)}>
            Edit
          </button>
        </div>
      </div>

      {/* Referral Info Card */}
      <div className={styles.infoCard}>
        <div className={styles.infoHeader}>
          <div>
            <h1 className={styles.title}>{referral.referrerName}</h1>
            <div className={styles.meta}>
              <span className={styles.code}>{referral.code}</span>
              <span className={`${styles.badge} ${styles[`badge${referral.referrerType}`]}`}>
                {getReferrerTypeLabel(referral.referrerType)}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Cabang</div>
            <div className={styles.infoValue}>{referral.branch.name}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Phone</div>
            <div className={styles.infoValue}>{referral.phone || '-'}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Email</div>
            <div className={styles.infoValue}>{referral.email || '-'}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Total Referral</div>
            <div className={styles.infoValue}>{referral.totalReferrals}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Total Insentif Diperoleh</div>
            <div className={styles.infoValue}>{formatCurrency(referral.totalIncentiveEarned)}</div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <strong>ℹ️ Catatan:</strong> Insentif ditentukan per member, bukan per kode referral. Setiap member yang menggunakan kode ini dapat memiliki rate insentif yang berbeda.
        </div>
      </div>

      {/* Incentive Records */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Riwayat Insentif</h2>

        {incentivesLoading ? (
          <div className={styles.loading}>Memuat riwayat...</div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Member</th>
                    <th>Paket</th>
                    <th>Nilai Paket</th>
                    <th>Tipe</th>
                    <th>Insentif</th>
                    <th>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {incentives.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>
                        Belum ada riwayat insentif
                      </td>
                    </tr>
                  ) : (
                    incentives.map((record) => (
                      <tr key={record.id}>
                        <td>{new Date(record.createdAt).toLocaleDateString('id-ID')}</td>
                        <td>
                          <div>
                            <div className={styles.memberName}>
                              {record.member.user.profile.fullName}
                            </div>
                            <div className={styles.memberNo}>{record.member.memberNo}</div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div>{record.packageName}</div>
                            <div className={styles.packageCode}>{record.memberPackage.packageCode}</div>
                          </div>
                        </td>
                        <td className={styles.textRight}>{formatCurrency(record.packageValue)}</td>
                        <td>
                          <span className={`${styles.typeBadge} ${record.isFirstPackage ? styles.typeFirst : styles.typeNext}`}>
                            {record.isFirstPackage ? 'Pertama' : 'Lanjutan'}
                          </span>
                        </td>
                        <td>{formatIncentive(record.incentiveType, record.incentiveValue)}</td>
                        <td className={styles.textRight}>
                          <span className={styles.incentiveAmount}>
                            {formatCurrency(record.incentiveAmount)}
                          </span>
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
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditReferralModal
          referral={referral}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchReferral();
          }}
        />
      )}
    </div>
  );
}

// Edit Referral Modal Component
function EditReferralModal({
  referral,
  onClose,
  onSuccess,
}: {
  referral: referralsApi.ReferralCode;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<referralsApi.UpdateReferralInput>({
    referrerName: referral.referrerName,
    referrerType: referral.referrerType,
    phone: referral.phone || '',
    email: referral.email || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await referralsApi.updateReferral(referral.id, formData);
      onSuccess();
    } catch (error) {
      devError('Error updating referral:', error);
      alert('Gagal mengupdate kode referral');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Edit Kode Referral</h2>
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
              <label>Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className={styles.infoBox}>
            <strong>ℹ️ Catatan:</strong> Insentif ditentukan saat membuat member, bukan di kode referral. Untuk mengubah insentif, edit member yang menggunakan kode referral ini.
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
