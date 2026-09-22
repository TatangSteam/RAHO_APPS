'use client';

import { PackageActionModal } from './PackageActionModal';
import { Button } from '@/components/ui/Button';
import styles from './PackageActionModal.module.css';

interface PackageCancelModalProps {
  show: boolean;
  packageCode: string;
  reason: string;
  submitting: boolean;
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
  itemLabel?: string;
  returnsStock?: boolean;
}

export default function PackageCancelModal({
  show,
  packageCode,
  reason,
  submitting,
  onClose,
  onReasonChange,
  onSubmit,
  itemLabel = 'Paket',
  returnsStock = false,
}: PackageCancelModalProps) {
  if (!show) return null;

  return (
    <PackageActionModal
      open={show}
      title="❌ Batalkan Pembelian"
      onClose={onClose}
      footer={(
        <>
          <Button unstyled onClick={onClose} className={styles.btnSecondary} disabled={submitting}>
            Batal
          </Button>
          <Button
            unstyled
            onClick={onSubmit}
            className={styles.btnDanger}
            disabled={submitting || reason.trim().length < 5}
          >
            {submitting ? 'Memproses...' : 'Batalkan Pembelian'}
          </Button>
        </>
      )}
    >
          <div className={styles.infoBox}>
            <p><strong>Kode {itemLabel}:</strong> {packageCode}</p>
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
              minLength={5}
            />
            {reason.length > 0 && reason.trim().length < 5 && (
              <small className={styles.error} style={{ color: '#ef4444', marginTop: '4px', display: 'block' }}>
                Alasan pembatalan minimal 5 karakter ({reason.trim().length}/5)
              </small>
            )}
          </div>

          <div className={styles.warningBox}>
            <p>⚠️ <strong>Perhatian:</strong></p>
            <ul>
              <li>Invoice akan dibatalkan</li>
              <li>{itemLabel} akan dibatalkan dan tetap tersimpan dalam histori audit</li>
              {returnsStock && <li>Reservasi stok akan dilepas sehingga stok siap dijual kembali</li>}
              <li>Tidak ada refund karena belum ada pembayaran</li>
              <li>Tindakan ini tidak dapat dibatalkan</li>
            </ul>
          </div>
    </PackageActionModal>
  );
}
