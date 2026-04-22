'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import InvoiceDocument from './InvoiceDocument';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import type { Invoice } from '@/types/invoice';
import styles from './InvoiceModal.module.css';

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

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      await generateInvoicePDF(invoice);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Gagal export PDF');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
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
            📄 Invoice {invoice.invoiceNumber}
          </h3>
          <div className={styles.modalActions}>
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              🖨️ Print
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              {exporting ? '⏳ Exporting...' : '📥 Download PDF'}
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

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-document,
          #invoice-document * {
            visibility: visible;
          }
          #invoice-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20mm;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}
