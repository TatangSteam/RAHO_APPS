'use client';

import { PackageActionModal } from './PackageActionModal';
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
  if (!show) return null;

  return (
    <PackageActionModal
      open={show}
      title="❌ Batalkan Pembelian"
      onClose={onClose}
      footer={(
        <>
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
        </>
      )}
    >
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
    </PackageActionModal>
  );
}
