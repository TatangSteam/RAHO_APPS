'use client';

import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styles from './PackageActionModal.module.css';

interface PackageCancelModalProps {
  show: boolean;
  packageCode: string;
  reason: string;
  submitting: boolean;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
}

export default function PackageCancelModal({
  show,
  packageCode,
  reason,
  submitting,
  onClose,
  onReasonChange,
  onSubmit,
}: PackageCancelModalProps) {
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  if (!show) return null;

  const modalContent = (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>❌ Batalkan Pembelian</h2>
          <button onClick={onClose} className={styles.closeButton}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.infoBox}>
            <p><strong>Kode Paket:</strong> {packageCode}</p>
          </div>

          <div className={styles.formGroup}>
            <label>Alasan Pembatalan <span className={styles.required}>*</span></label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Masukkan alasan pembatalan..."
              rows={4}
              className={styles.textarea}
              disabled={submitting}
            />
          </div>

          <div className={styles.warningBox}>
            <p>⚠️ <strong>Perhatian:</strong></p>
            <ul>
              <li>Invoice akan dibatalkan</li>
              <li>Paket akan dihapus dari sistem</li>
              <li>Tidak ada refund karena belum ada pembayaran</li>
              <li>Tindakan ini tidak dapat dibatalkan</li>
            </ul>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnSecondary} disabled={submitting}>
            Batal
          </button>
          <button 
            onClick={onSubmit} 
            className={styles.btnDanger} 
            disabled={submitting || !reason}
          >
            {submitting ? 'Memproses...' : 'Batalkan Pembelian'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
