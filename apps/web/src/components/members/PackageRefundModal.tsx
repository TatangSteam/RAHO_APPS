'use client';

import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styles from './PackageActionModal.module.css';

interface PackageRefundModalProps {
  show: boolean;
  packageCode: string;
  finalPrice: number;
  reason: string;
  refundAmount: number;
  submitting: boolean;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onRefundAmountChange: (value: number) => void;
  onSubmit: () => void;
}

export default function PackageRefundModal({
  show,
  packageCode,
  finalPrice,
  reason,
  refundAmount,
  submitting,
  onClose,
  onReasonChange,
  onRefundAmountChange,
  onSubmit,
}: PackageRefundModalProps) {
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
          <h2>💰 Refund Paket</h2>
          <button onClick={onClose} className={styles.closeButton}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.infoBox}>
            <p><strong>Kode Paket:</strong> {packageCode}</p>
            <p><strong>Harga Paket:</strong> Rp {finalPrice.toLocaleString('id-ID')}</p>
          </div>

          <div className={styles.formGroup}>
            <label>Alasan Refund <span className={styles.required}>*</span></label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Masukkan alasan refund..."
              rows={4}
              className={styles.textarea}
              disabled={submitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Jumlah Refund <span className={styles.required}>*</span></label>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => onRefundAmountChange(Number(e.target.value))}
              placeholder="Masukkan jumlah refund"
              className={styles.input}
              disabled={submitting}
              min={0}
              max={finalPrice}
            />
            <small className={styles.hint}>Maksimal: Rp {finalPrice.toLocaleString('id-ID')}</small>
          </div>

          <div className={styles.warningBox}>
            <p>⚠️ <strong>Perhatian:</strong></p>
            <ul>
              <li>Paket akan dibatalkan dan status menjadi CANCELLED</li>
              <li>Sesi terapi yang sudah dilakukan tidak akan terpengaruh</li>
              <li>Invoice akan dibatalkan</li>
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
            disabled={submitting || !reason || refundAmount <= 0}
          >
            {submitting ? 'Memproses...' : 'Refund Paket'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
