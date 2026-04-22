'use client';

import { useState } from 'react';
import type { Invoice } from '@/types/invoice';
import { formatNumberWithDots } from '@/lib/formatNumber';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import styles from './InvoiceView.module.css';

interface InvoiceViewProps {
  invoice: Invoice;
  onClose?: () => void;
}

const COMPANY_NAME = 'REVERSE AGING & HOMEOSTASIS CLUB';
const COMPANY_LEGAL = 'CV DUNIA SEHAT SENTOSA INDONESIA';
const COMPANY_ADDRESS = 'Komplek Duta Merlin Blok E No 05-06, Jalan Gajah Mada No 3-6';
const COMPANY_CITY = 'Jakarta Pusat';
const COMPANY_PHONE = '(021) 3192-8888';
const COMPANY_EMAIL = 'info@raho.id';
const BANK_NAME = 'BCA';
const BANK_ACCOUNT = '1306-9938-88';
const BANK_HOLDER = 'CV DUNIA SEHAT SENTOSA';

export default function InvoiceView({ invoice, onClose }: InvoiceViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 500);
  };

  const handleDownloadPDF = async () => {
    try {
      await generateInvoicePDF(invoice);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Gagal membuat PDF');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PAID':
        return styles.statusPaid;
      case 'PENDING_PAYMENT':
        return styles.statusPending;
      case 'OVERDUE':
        return styles.statusOverdue;
      case 'CANCELLED':
        return styles.statusCancelled;
      default:
        return styles.statusDraft;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Draft',
      PENDING_PAYMENT: 'Menunggu Pembayaran',
      PAID: 'Lunas',
      CANCELLED: 'Dibatalkan',
      OVERDUE: 'Jatuh Tempo',
    };
    return labels[status] || status;
  };

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h2 className={styles.title}>Invoice #{invoice.invoiceNumber}</h2>
          <span className={`${styles.statusBadge} ${getStatusBadgeClass(invoice.status)}`}>
            {getStatusLabel(invoice.status)}
          </span>
        </div>
        <div className={styles.toolbarRight}>
          <button onClick={handlePrint} className={`${styles.button} ${styles.buttonSecondary}`}>
            🖨️ Cetak
          </button>
          <button onClick={handleDownloadPDF} className={`${styles.button} ${styles.buttonPrimary}`}>
            📥 Download PDF
          </button>
          {onClose && (
            <button onClick={onClose} className={`${styles.button} ${styles.buttonSecondary}`}>
              ✕ Tutup
            </button>
          )}
        </div>
      </div>

      {/* Invoice Content */}
      <div className={styles.invoiceContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.companyInfo}>
            <h1 className={styles.companyName}>{COMPANY_NAME}</h1>
            <p className={styles.companyLegal}>{COMPANY_LEGAL}</p>
            <p className={styles.companyAddress}>{COMPANY_ADDRESS}</p>
            <p className={styles.companyCity}>{COMPANY_CITY}</p>
            <p className={styles.companyContact}>
              {COMPANY_PHONE} | {COMPANY_EMAIL}
            </p>
          </div>
          <div className={styles.invoiceTitle}>
            <h2>INVOICE</h2>
          </div>
        </div>

        {/* Invoice Details */}
        <div className={styles.detailsSection}>
          <div className={styles.detailsColumn}>
            <div className={styles.detailGroup}>
              <h3 className={styles.detailGroupTitle}>DETAIL INVOICE</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>No. Faktur:</span>
                <span className={styles.detailValue}>{invoice.invoiceNumber}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tanggal:</span>
                <span className={styles.detailValue}>
                  {new Date(invoice.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
              {invoice.dueDate && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Jatuh Tempo:</span>
                  <span className={styles.detailValue}>
                    {new Date(invoice.dueDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.detailsColumn}>
            <div className={styles.detailGroup}>
              <h3 className={styles.detailGroupTitle}>TAGIHAN UNTUK</h3>
              <div className={styles.billTo}>
                <p className={styles.billToName}>{invoice.memberName}</p>
                {invoice.memberNo && (
                  <p className={styles.billToDetail}>Member No: {invoice.memberNo}</p>
                )}
                {invoice.branchName && (
                  <p className={styles.billToDetail}>Branch: {invoice.branchName}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className={styles.itemsSection}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th className={styles.colCode}>Kode</th>
                <th className={styles.colQty}>Qty</th>
                <th className={styles.colDescription}>Deskripsi</th>
                <th className={styles.colPrice}>Harga Satuan</th>
                <th className={styles.colTotal}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className={styles.colCode}>{item.code || '-'}</td>
                  <td className={styles.colQty}>{item.quantity}</td>
                  <td className={styles.colDescription}>
                    <div className={styles.itemDescription}>{item.description}</div>
                    {item.subDescription && (
                      <div className={styles.itemSubDescription}>{item.subDescription}</div>
                    )}
                  </td>
                  <td className={styles.colPrice}>Rp {formatNumberWithDots(item.pricePerUnit)}</td>
                  <td className={styles.colTotal}>Rp {formatNumberWithDots(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className={styles.summarySection}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Subtotal</span>
            <span className={styles.summaryValue}>Rp {formatNumberWithDots(invoice.subtotal)}</span>
          </div>

          {invoice.discountAmount && invoice.discountAmount > 0 && (
            <div className={`${styles.summaryRow} ${styles.discount}`}>
              <span className={styles.summaryLabel}>Diskon</span>
              <span className={styles.summaryValue}>- Rp {formatNumberWithDots(invoice.discountAmount)}</span>
            </div>
          )}

          {invoice.taxAmount && invoice.taxAmount > 0 && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Pajak (PPN)</span>
              <span className={styles.summaryValue}>Rp {formatNumberWithDots(invoice.taxAmount)}</span>
            </div>
          )}

          <div className={`${styles.summaryRow} ${styles.total}`}>
            <span className={styles.summaryLabel}>TOTAL</span>
            <span className={styles.summaryValue}>Rp {formatNumberWithDots(invoice.totalAmount)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className={styles.paymentSection}>
          <h3 className={styles.sectionTitle}>INFORMASI PEMBAYARAN</h3>
          <div className={styles.paymentInfo}>
            <div className={styles.paymentRow}>
              <span className={styles.paymentLabel}>Bank:</span>
              <span className={styles.paymentValue}>{BANK_NAME}</span>
            </div>
            <div className={styles.paymentRow}>
              <span className={styles.paymentLabel}>No. Rekening:</span>
              <span className={styles.paymentValue}>{BANK_ACCOUNT}</span>
            </div>
            <div className={styles.paymentRow}>
              <span className={styles.paymentLabel}>Atas Nama:</span>
              <span className={styles.paymentValue}>{BANK_HOLDER}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className={styles.notesSection}>
            <h3 className={styles.sectionTitle}>CATATAN</h3>
            <p className={styles.notesContent}>{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerColumn}>
            <p className={styles.footerLabel}>Dibuat oleh:</p>
            <p className={styles.footerValue}>{invoice.createdByName}</p>
          </div>

          {invoice.verifiedByName && (
            <div className={styles.footerColumn}>
              <p className={styles.footerLabel}>Diverifikasi oleh:</p>
              <p className={styles.footerValue}>{invoice.verifiedByName}</p>
            </div>
          )}

          <div className={styles.footerColumn}>
            <p className={styles.footerInfo}>
              Generated: {new Date().toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
