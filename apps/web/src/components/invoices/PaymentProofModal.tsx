'use client';

import { useState, useEffect } from 'react';
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
  const [selectedPayment, setSelectedPayment] = useState(0);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  // Filter payments that have proof files
  const paymentsWithProof = invoice.payments.filter(payment => payment.proofFileUrl);
  const currentPayment = paymentsWithProof[selectedPayment];

  // Load image with authentication
  const loadImage = async (paymentId: string, proofFileUrl: string) => {
    if (imageUrls.has(paymentId) || loadingImages.has(paymentId)) {
      return;
    }

    setLoadingImages(prev => new Set(prev).add(paymentId));

    try {
      const blobUrl = await createAuthenticatedObjectUrl(proofFileUrl);
      
      setImageUrls(prev => new Map(prev).set(paymentId, blobUrl));
    } catch (error) {
      devError('Failed to load payment proof image:', error);
    } finally {
      setLoadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(paymentId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      // Cleanup blob URLs
      imageUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageUrls]);

  // Load image when payment changes
  useEffect(() => {
    if (currentPayment?.proofFileUrl) {
      loadImage(currentPayment.id, currentPayment.proofFileUrl);
    }
  }, [currentPayment?.id, currentPayment?.proofFileUrl]);

  if (!mounted) return null;
  if (paymentsWithProof.length === 0) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  devLog('🔍 PaymentProofModal Debug:', {
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

  devLog('🖼️ Current Payment Proof:', {
    proofFileUrl: currentPayment.proofFileUrl,
    proofFileName: currentPayment.proofFileName,
    proofMimeType: currentPayment.proofMimeType,
    blobUrl: imageUrls.get(currentPayment.id),
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

  const getPaymentMethodLabel = (method: string) => {
    const methodMap: Record<string, string> = {
      CASH: 'Tunai',
      TRANSFER: 'Transfer Bank',
      DEBIT: 'Kartu Debit',
      CREDIT: 'Kartu Kredit',
      QRIS: 'QRIS',
      OTHER: 'Lainnya'
    };
    return methodMap[method] || method;
  };

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            🧾 Bukti Pembayaran - Invoice {invoice.invoiceNumber}
          </h3>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Payment Selection (if multiple payments) */}
        {paymentsWithProof.length > 1 && (
          <div className={styles.paymentTabs}>
            {paymentsWithProof.map((payment, index) => (
              <button
                key={payment.id}
                onClick={() => setSelectedPayment(index)}
                className={`${styles.paymentTab} ${
                  selectedPayment === index ? styles.paymentTabActive : ''
                }`}
              >
                Pembayaran {index + 1} - Rp {formatNumberWithDots(payment.amount)}
              </button>
            ))}
          </div>
        )}

        {/* Payment Details */}
        <div className={styles.paymentDetails}>
          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Jumlah Pembayaran:</span>
              <span className={styles.detailValue}>Rp {formatNumberWithDots(currentPayment.amount)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Metode Pembayaran:</span>
              <span className={styles.detailValue}>{getPaymentMethodLabel(currentPayment.paymentMethod)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Tanggal Pembayaran:</span>
              <span className={styles.detailValue}>{formatDate(currentPayment.receivedAt)}</span>
            </div>
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Diterima Oleh:</span>
              <span className={styles.detailValue}>{currentPayment.receivedByName}</span>
            </div>
            {currentPayment.paymentReference && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Referensi:</span>
                <span className={styles.detailValue}>{currentPayment.paymentReference}</span>
              </div>
            )}
            {currentPayment.notes && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Catatan:</span>
                <span className={styles.detailValue}>{currentPayment.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Proof File Display */}
        <div className={styles.proofContainer}>
          <h4 className={styles.proofTitle}>Bukti Pembayaran</h4>
          
          {currentPayment.proofFileUrl && (
            <div className={styles.proofContent}>
              <div className={styles.imageContainer}>
                {loadingImages.has(currentPayment.id) ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    ⏳ Memuat gambar...
                  </div>
                ) : imageUrls.has(currentPayment.id) ? (
                  <img
                    src={imageUrls.get(currentPayment.id)}
                    alt="Bukti Pembayaran"
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
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Gambar tidak tersedia
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.modalActions}>
          {currentPayment.proofFileUrl && imageUrls.has(currentPayment.id) && (
            <a
              href={imageUrls.get(currentPayment.id)}
              download={currentPayment.proofFileName}
              className={styles.downloadButton}
            >
              📥 Download Bukti
            </a>
          )}
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