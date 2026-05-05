'use client';

import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styles from './PackageActionModal.module.css';

interface PackageEditModalProps {
  show: boolean;
  packageCode: string;
  currentQuantity: number;
  currentDiscount: number;
  currentDiscountNote: string;
  currentNotes: string;
  pricePerSession: number;
  quantity: number;
  discount: number;
  discountNote: string;
  notes: string;
  submitting: boolean;
  onClose: () => void;
  onQuantityChange: (value: number) => void;
  onDiscountChange: (value: number) => void;
  onDiscountNoteChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
}

export default function PackageEditModal({
  show,
  packageCode,
  currentQuantity,
  currentDiscount,
  pricePerSession,
  quantity,
  discount,
  discountNote,
  notes,
  submitting,
  onClose,
  onQuantityChange,
  onDiscountChange,
  onDiscountNoteChange,
  onNotesChange,
  onSubmit,
}: PackageEditModalProps) {
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

  const originalPrice = pricePerSession * quantity;
  const finalPrice = originalPrice - discount;

  const modalContent = (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>✏️ Edit Pembelian Paket</h2>
          <button onClick={onClose} className={styles.closeButton}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.infoBox}>
            <p><strong>Kode Paket:</strong> {packageCode}</p>
            <p><strong>Harga per Sesi:</strong> Rp {pricePerSession.toLocaleString('id-ID')}</p>
          </div>

          <div className={styles.formGroup}>
            <label>Jumlah Sesi <span className={styles.required}>*</span></label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => onQuantityChange(Number(e.target.value))}
              placeholder="Masukkan jumlah sesi"
              className={styles.input}
              disabled={submitting}
              min={1}
            />
            <small className={styles.hint}>Saat ini: {currentQuantity} sesi</small>
          </div>

          <div className={styles.formGroup}>
            <label>Diskon (Rp)</label>
            <input
              type="number"
              value={discount}
              onChange={(e) => onDiscountChange(Number(e.target.value))}
              placeholder="Masukkan diskon"
              className={styles.input}
              disabled={submitting}
              min={0}
              max={originalPrice}
            />
            <small className={styles.hint}>Saat ini: Rp {currentDiscount.toLocaleString('id-ID')}</small>
          </div>

          <div className={styles.formGroup}>
            <label>Catatan Diskon</label>
            <input
              type="text"
              value={discountNote}
              onChange={(e) => onDiscountNoteChange(e.target.value)}
              placeholder="Contoh: Promo member baru"
              className={styles.input}
              disabled={submitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Catatan</label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Catatan tambahan..."
              rows={3}
              className={styles.textarea}
              disabled={submitting}
            />
          </div>

          <div className={styles.priceCalculation}>
            <div className={styles.priceRow}>
              <span>Harga Asli:</span>
              <span>Rp {originalPrice.toLocaleString('id-ID')}</span>
            </div>
            <div className={styles.priceRow}>
              <span>Diskon:</span>
              <span className={styles.discount}>- Rp {discount.toLocaleString('id-ID')}</span>
            </div>
            <div className={styles.priceRow + ' ' + styles.total}>
              <span><strong>Total:</strong></span>
              <span><strong>Rp {finalPrice.toLocaleString('id-ID')}</strong></span>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnSecondary} disabled={submitting}>
            Batal
          </button>
          <button 
            onClick={onSubmit} 
            className={styles.btnPrimary} 
            disabled={submitting || quantity <= 0 || finalPrice <= 0}
          >
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
