'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { compressImageWithPreset, formatFileSize, isImageFile } from '@/lib/imageCompressor';
import { devError } from '@/lib/logger';
import styles from './VerifyPaymentModal.module.css';

interface PaymentProof {
  file: File | null;
  preview: string | null;
}

interface UploadPaymentProofModalProps {
  show: boolean;
  packageCode: string;
  finalPrice: number;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (file: File) => void;
}

export default function UploadPaymentProofModal({
  show,
  packageCode,
  finalPrice,
  submitting,
  onClose,
  onSubmit
}: UploadPaymentProofModalProps) {
  const [paymentProof, setPaymentProof] = useState<PaymentProof>({ file: null, preview: null });
  const [error, setError] = useState<string>('');
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; compressed: number } | null>(null);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (show) {
      setPaymentProof({ file: null, preview: null });
      setError('');
      setCompressionInfo(null);
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

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - ONLY IMAGES
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format file harus JPG atau PNG');
      return;
    }

    // Validate file size (max 10MB before compression)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Ukuran file maksimal 10MB');
      return;
    }

    setError('');

    // Compress the image
    if (isImageFile(file)) {
      setCompressing(true);
      try {
        const result = await compressImageWithPreset(file, 'paymentProof');
        const preview = URL.createObjectURL(result.blob);
        setPaymentProof({ file: result.file, preview });
        setCompressionInfo({
          original: result.originalSize,
          compressed: result.compressedSize
        });
      } catch (error) {
        devError('Error compressing image:', error);
        // Fallback to original file
        const reader = new FileReader();
        reader.onloadend = () => {
          const preview = reader.result as string;
          setPaymentProof({ file, preview });
          setCompressionInfo(null);
        };
        reader.readAsDataURL(file);
      } finally {
        setCompressing(false);
      }
    }
  }, []);

  const handleRemoveFile = () => {
    setPaymentProof({ file: null, preview: null });
    setError('');
    setCompressionInfo(null);
  };

  const handleSubmit = () => {
    if (!paymentProof.file) {
      setError('Harap pilih file bukti pembayaran');
      return;
    }
    onSubmit(paymentProof.file);
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
            <span className={styles.modalIcon}>📤</span>
            Upload Bukti Pembayaran
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
          <div style={{
            background: 'var(--surface-hover)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Paket:</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
                {packageCode}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Pembayaran:</span>
              <span style={{ color: 'var(--color-primary-400)', fontSize: '16px', fontWeight: 700 }}>
                Rp {finalPrice.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className={styles.warningBox}>
            <span className={styles.warningIcon}>ℹ️</span>
            <div className={styles.warningText}>
              Setelah bukti pembayaran diupload, paket Anda akan menunggu verifikasi dari admin cabang. 
              Anda akan menerima notifikasi setelah pembayaran diverifikasi.
            </div>
          </div>

          {/* Payment Proof Upload */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              📸 Bukti Pembayaran (Wajib) *
            </label>
            <p className={styles.formHint}>
              Upload foto struk atau bukti transfer (JPG atau PNG, max 10MB - akan dikompresi otomatis)
            </p>

            {compressing ? (
              <div className={styles.uploadBox} style={{ cursor: 'wait' }}>
                <div className={styles.uploadContent}>
                  <span className={styles.uploadIcon}>⏳</span>
                  <span className={styles.uploadText}>
                    Mengkompresi gambar...
                  </span>
                </div>
              </div>
            ) : paymentProof.file ? (
              <div className={styles.filePreview}>
                <div className={styles.imagePreview}>
                  <img src={paymentProof.preview!} alt="Payment proof" />
                </div>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{paymentProof.file.name}</div>
                  <div className={styles.fileSize}>
                    {formatFileSize(paymentProof.file.size)}
                    {compressionInfo && (
                      <span style={{ color: '#22c55e', marginLeft: '8px' }}>
                        (dikompresi dari {formatFileSize(compressionInfo.original)})
                      </span>
                    )}
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
            onClick={handleSubmit}
            disabled={submitting || !paymentProof.file || compressing}
            className={`${styles.button} ${styles.buttonPrimary}`}
            title={!paymentProof.file ? 'Bukti pembayaran wajib diupload' : ''}
          >
            {submitting ? '⏳ Mengirim...' : '📤 Upload'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
