'use client';

import AppImage from '@/components/ui/AppImage';
import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Invoice } from '@/types/invoice';
import { formatNumberWithDots } from '@/lib/formatNumber';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { devLog, devError } from '@/lib/logger';
import styles from './PaymentProofModal.module.css';

interface Props {
  invoice: Invoice;
  onClose: () => void;
}

export default function PaymentProofModal({ invoice, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const imageUrlsRef = useRef<Map<string, string>>(new Map());

  const paymentsWithProof = useMemo(
    () => invoice.payments.filter((payment) => payment.proofFileUrl),
    [invoice.payments],
  );

  const loadImage = useCallback(async (paymentId: string, proofFileUrl: string) => {
    if (imageUrls.has(paymentId) || loadingImages.has(paymentId)) {
      return;
    }

    setLoadingImages(prev => new Set(prev).add(paymentId));

    try {
      const blobUrl = await createAuthenticatedObjectUrl(proofFileUrl);
      setImageUrls(prev => new Map(prev).set(paymentId, blobUrl));
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to load payment proof image:', error);
    } finally {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });
    }
  }, [imageUrls, loadingImages]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    paymentsWithProof.forEach((payment) => {
      if (payment.proofFileUrl) {
        loadImage(payment.id, payment.proofFileUrl);
      }
    });
  }, [loadImage, paymentsWithProof]);

  if (!mounted) return null;
  if (paymentsWithProof.length === 0) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  devLog('PaymentProofModal Debug:', {
    invoiceNumber: invoice.invoiceNumber,
    totalPayments: invoice.payments.length,
    paymentsWithProof: paymentsWithProof.length,
    payments: invoice.payments.map(p => ({
      id: p.id,
      amount: p.amount,
      proofFileUrl: p.proofFileUrl,
      proofFileName: p.proofFileName,
      proofMimeType: p.proofMimeType,
    }))
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            Bukti Pembayaran - Invoice {invoice.invoiceNumber}
          </h3>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className={styles.proofContainer}>
          <h4 className={styles.proofTitle}>Bukti Pembayaran</h4>

          <div className={styles.proofList}>
            {paymentsWithProof.map((payment, index) => (
              <div key={payment.id} className={styles.proofCard}>
                <div className={styles.proofCardHeader}>
                  <div>
                    <h5 className={styles.proofCardTitle}>Pembayaran {index + 1}</h5>
                    <p className={styles.proofCardMeta}>Rp {formatNumberWithDots(payment.amount)}</p>
                  </div>
                  {imageUrls.has(payment.id) && (
                    <a
                      href={imageUrls.get(payment.id)}
                      download={payment.proofFileName}
                      className={styles.downloadButton}
                    >
                      Download Bukti
                    </a>
                  )}
                </div>

                <div className={styles.paymentDetails}>
                  <div className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Jumlah Pembayaran:</span>
                      <span className={styles.detailValue}>Rp {formatNumberWithDots(payment.amount)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Tanggal Pembayaran:</span>
                      <span className={styles.detailValue}>{formatDate(payment.receivedAt)}</span>
                    </div>
                    {payment.paymentReference && (
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Referensi:</span>
                        <span className={styles.detailValue}>{payment.paymentReference}</span>
                      </div>
                    )}
                    {payment.notes && (
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Catatan:</span>
                        <span className={styles.detailValue}>{payment.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.proofContent}>
                  <div className={styles.imageContainer}>
                    {loadingImages.has(payment.id) ? (
                      <div className={styles.imagePlaceholder}>
                        Memuat gambar...
                      </div>
                    ) : imageUrls.has(payment.id) ? (
                      <AppImage
                        src={imageUrls.get(payment.id)}
                        alt={`Bukti Pembayaran ${index + 1}`}
                        className={styles.proofImage}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          devError('Failed to load image:', target.src);
                          target.style.display = 'none';
                          const parent = target.parentNode as HTMLElement;
                          if (parent && !parent.querySelector(`.${styles.errorMessage}`)) {
                            const errorDiv = document.createElement('div');
                            errorDiv.className = styles.errorMessage;
                            errorDiv.textContent = 'Gagal memuat gambar bukti pembayaran';
                            parent.appendChild(errorDiv);
                          }
                        }}
                      />
                    ) : (
                      <div className={styles.imagePlaceholder}>
                        Gambar tidak tersedia
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.modalActions}>
          <button
            onClick={onClose}
            className={styles.closeActionButton}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
