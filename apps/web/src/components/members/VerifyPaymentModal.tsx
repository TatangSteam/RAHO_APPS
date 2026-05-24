'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './VerifyPaymentModal.module.css';

interface PaymentProof {
  file: File | null;
  preview: string | null;
}

interface VerifyPaymentModalProps {
  show: boolean;
  notes: string;
  submitting: boolean;
  onClose: () => void;
  onNotesChange: (notes: string) => void;
  onProofChange: (proof: PaymentProof) => void;
  onSubmit: () => void;
}

export default function VerifyPaymentModal({
  show,
  notes,
  submitting,
  onClose,
  onNotesChange,
  onProofChange,
  onSubmit
}: VerifyPaymentModalProps) {
  const [paymentProof, setPaymentProof] = useState<PaymentProof>({ file: null, preview: null });
  const [error, setError] = useState<string>('');

  // Reset state when modal opens or closes
  useEffect(() => {
    if (show) {
      // Reset state when modal opens
      setPaymentProof({ file: null, preview: null });
      setError('');
      onProofChange({ file: null, preview: null });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [show]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [show, onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - ONLY IMAGES
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format file harus JPG atau PNG');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Ukuran file maksimal 5MB');
      return;
    }

    setError('');

    // Create preview for images
    const reader = new FileReader();
    reader.onloadend = () => {
      const preview = reader.result as string;
      const proof = { file, preview };
      setPaymentProof(proof);
      onProofChange(proof);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setPaymentProof({ file: null, preview: null });
    onProofChange({ file: null, preview: null });
    setError('');
  };

  if (!show) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div className={styles.modalOverlay} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <span className={styles.modalIcon}>✅</span>
            Verifikasi Pembayaran
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <div className={styles.warningBox}>
            <span className={styles.warningIcon}>⚠️</span>
            <div className={styles.warningText}>
              Pastikan pembayaran telah diterima sebelum melakukan verifikasi. 
              Paket akan langsung aktif setelah diverifikasi dan invoice akan otomatis dibuat.
            </div>
          </div>

          {/* Payment Proof Upload */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              📸 Bukti Pembayaran (Wajib) *
            </label>
            <p className={styles.formHint}>
              Upload foto struk atau bukti transfer (JPG atau PNG, max 5MB)
            </p>

            {paymentProof.file ? (
              <div className={styles.filePreview}>
                <div className={styles.imagePreview}>
                  <img src={paymentProof.preview!} alt="Payment proof" />
                </div>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{paymentProof.file.name}</div>
                  <div className={styles.fileSize}>
                    {(paymentProof.file.size / 1024).toFixed(2)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className={styles.removeButton}
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className={styles.uploadBox}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                />
                <div className={styles.uploadContent}>
                  <span className={styles.uploadIcon}>📤</span>
                  <span className={styles.uploadText}>
                    Klik untuk upload atau drag & drop
                  </span>
                </div>
              </label>
            )}

            {error && <div className={styles.errorMessage}>{error}</div>}
          </div>

          {/* Notes */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Catatan Verifikasi (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              className={styles.formTextarea}
              placeholder="Contoh: Pembayaran diterima via transfer BCA"
            />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className={`${styles.button} ${styles.buttonSecondary}`}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || !paymentProof.file}
            className={`${styles.button} ${styles.buttonPrimary}`}
            title={!paymentProof.file ? 'Bukti pembayaran wajib diupload' : ''}
          >
            {submitting ? '⏳ Memverifikasi...' : '✅ Verifikasi'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
