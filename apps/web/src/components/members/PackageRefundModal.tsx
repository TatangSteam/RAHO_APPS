'use client';

import AppImage from '@/components/ui/AppImage';
import { assertCaughtError } from '@/lib/caughtError';
import { useEffect, useState, useCallback } from 'react';
import { PackageActionModal } from './PackageActionModal';
import { Button } from '@/components/ui/Button';
import styles from './PackageActionModal.module.css';
import { compressImageWithPreset, formatFileSize, isImageFile } from '@/lib/imageCompressor';
import { devError } from '@/lib/logger';

interface PackageRefundModalProps {
  show: boolean;
  packageCode: string;
  finalPrice: number;
  reason: string;
  refundAmount: number;
  returnAddOnsToStock: boolean;
  submitting: boolean;
  refundProof?: { file: File | null; preview: string | null };
  onClose: () => void;
  onReasonChange: (value: string) => void;
  onRefundAmountChange: (value: number) => void;
  onReturnAddOnsToStockChange: (value: boolean) => void;
  onProofChange?: (value: { file: File | null; preview: string | null }) => void;
  onSubmit: () => void;
}

export default function PackageRefundModal({
  show,
  packageCode,
  finalPrice,
  reason,
  refundAmount,
  returnAddOnsToStock,
  submitting,
  refundProof,
  onClose,
  onReasonChange,
  onRefundAmountChange,
  onReturnAddOnsToStockChange,
  onProofChange,
  onSubmit,
}: PackageRefundModalProps) {
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; compressed: number } | null>(null);

  useEffect(() => {
    if (show) {
      setCompressionInfo(null);
    }
  }, [show]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file || !onProofChange) {
      onProofChange?.({ file: null, preview: null });
      setCompressionInfo(null);
      return;
    }

    if (isImageFile(file)) {
      setCompressing(true);
      try {
        const result = await compressImageWithPreset(file, 'paymentProof');
        setCompressionInfo({
          original: result.originalSize,
          compressed: result.compressedSize
        });
        onProofChange({ file: result.file, preview: URL.createObjectURL(result.blob) });
      } catch (error) {
      assertCaughtError(error);
        devError('Error compressing image:', error);
        // Fallback to original file
        const reader = new FileReader();
        reader.onloadend = () => {
          onProofChange({ file, preview: reader.result as string });
        };
        reader.readAsDataURL(file);
        setCompressionInfo(null);
      } finally {
        setCompressing(false);
      }
    } else {
      onProofChange({ file: null, preview: null });
    }
  }, [onProofChange]);

  if (!show) return null;

  return (
    <PackageActionModal
      open={show}
      title="💰 Refund Paket"
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
            disabled={submitting || compressing || !reason || reason.length < 8 || refundAmount <= 0}
          >
            {submitting ? 'Memproses...' : 'Refund Paket'}
          </Button>
        </>
      )}
    >
          <div className={styles.infoBox}>
            <p><strong>Kode Paket:</strong> {packageCode}</p>
            <p><strong>Harga Paket:</strong> Rp {finalPrice.toLocaleString('id-ID')}</p>
          </div>

          <div className={styles.formGroup}>
            <label>Alasan Refund <span className={styles.required}>*</span></label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Masukkan alasan refund (minimal 8 karakter)..."
              rows={4}
              className={styles.textarea}
              disabled={submitting}
              minLength={8}
            />
            {reason.length > 0 && reason.length < 8 && (
              <small className={styles.error} style={{ color: '#ef4444', marginTop: '4px', display: 'block' }}>
                Alasan refund minimal 8 karakter ({reason.length}/8)
              </small>
            )}
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

          <div className={styles.formGroup}>
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={returnAddOnsToStock}
                onChange={(event) => onReturnAddOnsToStockChange(event.target.checked)}
                disabled={submitting}
                style={{ marginTop: '3px' }}
              />
              <span>
                Kembalikan add-on fisik ke stok
                <small className={styles.hint} style={{ display: 'block', fontWeight: 400 }}>
                  Centang hanya jika barang add-on benar-benar sudah diterima kembali. Stok dan HPP akan direversal otomatis.
                </small>
              </span>
            </label>
          </div>

          {onProofChange && (
            <div className={styles.formGroup}>
              <label>Bukti Refund (Opsional)</label>
              {compressing ? (
                <div className={styles.input} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                  ⏳ Mengkompresi gambar...
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={styles.input}
                  disabled={submitting}
                />
              )}
              {refundProof?.preview && (
                <div className={styles.imagePreview}>
                  <AppImage src={refundProof.preview} alt="Preview" style={{ maxWidth: '200px', marginTop: '8px', borderRadius: '4px' }} />
                  {compressionInfo && (
                    <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px' }}>
                      ✓ Dikompresi: {formatFileSize(compressionInfo.original)} → {formatFileSize(compressionInfo.compressed)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={styles.warningBox}>
            <p>⚠️ <strong>Perhatian:</strong></p>
            <ul>
              <li>Paket akan dibatalkan dan status menjadi CANCELLED</li>
              <li>Sesi terapi yang sudah dilakukan tidak akan terpengaruh</li>
              <li>Invoice akan dibatalkan</li>
              <li>Tindakan ini tidak dapat dibatalkan</li>
            </ul>
          </div>
    </PackageActionModal>
  );
}
