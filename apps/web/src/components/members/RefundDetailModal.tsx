'use client';

import AppImage from '@/components/ui/AppImage';
import { useState } from 'react';
import { formatCurrency } from '@/lib/formatNumber';
import styles from './RefundDetailModal.module.css';

interface RefundDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  refundData: {
    packageCode: string;
    refundAmount: number;
    refundReason: string;
    refundedBy?: string;
    refundedAt?: string;
    refundProofUrl?: string;
    refundProofFileName?: string;
  };
}

export default function RefundDetailModal({ isOpen, onClose, refundData }: RefundDetailModalProps) {
  const [imageError, setImageError] = useState(false);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>💰 DETAIL REFUND</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Info Section */}
          <div className={styles.infoSection}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Kode Paket</span>
              <span className={styles.value}>{refundData.packageCode}</span>
            </div>

            <div className={styles.infoRow}>
              <span className={styles.label}>Jumlah Refund</span>
              <span className={styles.value}>{formatCurrency(refundData.refundAmount)}</span>
            </div>

            {refundData.refundedAt && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Tanggal Refund</span>
                <span className={styles.value}>
                  {new Date(refundData.refundedAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}

            {refundData.refundedBy && (
              <div className={styles.infoRow}>
                <span className={styles.label}>Diproses Oleh</span>
                <span className={styles.value}>{refundData.refundedBy}</span>
              </div>
            )}

            <div className={styles.infoRow}>
              <span className={styles.label}>Alasan</span>
              <span className={styles.value}>{refundData.refundReason}</span>
            </div>
          </div>

          {/* Proof Section */}
          {refundData.refundProofUrl && (
            <div className={styles.proofSection}>
              <div className={styles.proofLabel}>
                🖼️ Bukti Refund
              </div>
              {!imageError ? (
                <div className={styles.imageWrapper}>
                  <AppImage
                    src={refundData.refundProofUrl}
                    alt="Bukti Refund"
                    className={styles.proofImage}
                    onError={() => setImageError(true)}
                  />
                  <a
                    href={refundData.refundProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.viewFullButton}
                  >
                    🔍 Lihat Ukuran Penuh
                  </a>
                </div>
              ) : (
                <div className={styles.errorMessage}>
                  <p>⚠️ Gagal memuat gambar</p>
                  <a
                    href={refundData.refundProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.downloadLink}
                  >
                    📥 Download {refundData.refundProofFileName || 'Bukti'}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
