'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import InvoiceDocument from './InvoiceDocument';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import type { Invoice } from '@/types/invoice';
import styles from './InvoiceModal.module.css';
import { devError } from '@/lib/logger';

interface Props {
  show: boolean;
  invoice: Invoice | null;
  onClose: () => void;
}

export default function InvoiceModal({ show, invoice, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [show]);

  if (!show || !invoice || !mounted) return null;

  const documentTitle = invoice.status === 'PAID' ? 'Kwitansi' : 'Invoice';

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      await generateInvoicePDF(invoice);
    } catch (error) {
      devError('Failed to export PDF:', error);
      alert('Gagal export PDF. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header with Actions */}
        <div className={`${styles.modalHeader} no-print`}>
          <h3 className={styles.modalTitle}>
            📄 {documentTitle} {invoice.invoiceNumber}
          </h3>
          <div className={styles.modalActions}>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="btn btn-primary"
              style={{ 
                padding: '8px 16px', 
                fontSize: '14px',
                backgroundColor: exporting ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                marginRight: '8px'
              }}
            >
              {exporting ? '⏳ Mengunduh...' : '📥 Download PDF'}
            </button>
            <button
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className={styles.modalBody}>
          <InvoiceDocument invoice={invoice} />
        </div>
      </div>

      {/* Print Styles - Removed print functionality */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}
