'use client';

import React from 'react';
import type { Invoice } from '@/types/invoice';
import { formatNumberWithDots } from '@/lib/formatNumber';
import { devLog } from '@/lib/logger';
import styles from './InvoiceDocument.module.css';

interface Props {
  invoice: Invoice;
}

export default function InvoiceDocument({ invoice }: Props) {
  // Debug log untuk melihat data invoice (only in development)
  React.useEffect(() => {
    devLog('🔍 Invoice data received:', {
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      discountPercent: invoice.discountPercent,
      taxAmount: invoice.taxAmount,
      taxPercent: invoice.taxPercent,
      totalAmount: invoice.totalAmount,
    });
  }, [invoice]);

  const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      DRAFT: styles.statusDraft,
      PENDING_PAYMENT: styles.statusPending,
      PAID: styles.statusPaid,
      OVERDUE: styles.statusOverdue,
      CANCELLED: styles.statusCancelled
    };
    return statusMap[status] || styles.statusDraft;
  };

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      DRAFT: 'DRAFT',
      PENDING_PAYMENT: 'MENUNGGU PEMBAYARAN',
      PAID: 'LUNAS',
      OVERDUE: 'JATUH TEMPO',
      CANCELLED: 'DIBATALKAN'
    };
    return textMap[status] || status;
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${formatNumberWithDots(amount)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Group invoice items by code + description + pricePerUnit
  const groupedItems = React.useMemo(() => {
    if (!invoice.items || invoice.items.length === 0) return [];

    const itemsMap = new Map<string, any>();

    invoice.items.forEach((item) => {
      const productCode = (item as any).code || `ITEM-${item.id}`;
      const key = `${productCode}|${item.description}|${item.pricePerUnit}`;

      if (itemsMap.has(key)) {
        const existing = itemsMap.get(key);
        existing.quantity += item.quantity;
        existing.totalAmount += item.totalAmount;
      } else {
        itemsMap.set(key, {
          ...item,
          code: productCode,
          quantity: item.quantity,
          totalAmount: item.totalAmount,
        });
      }
    });

    return Array.from(itemsMap.values());
  }, [invoice.items]);

  return (
    <div id="invoice-document" className={styles.invoiceDocument}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.companyName}>REVERSE AGING & HOMEOSTASIS CLUB</h1>
          <p className={styles.companyLegal}>CV DUNIA SEHAT SENTOSA INDONESIA</p>
          <p className={styles.companyAddress}>Komplek Duta Merlin Blok E No 05-06, Jalan Gajah Mada No 3-6</p>
          <p className={styles.companyCity}>Jakarta Pusat | (021) 3192-8888 | info@raho.id</p>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}></div>

      {/* Invoice Title & Status */}
      <div className={styles.titleSection}>
        <h2 className={styles.invoiceTitleText}>INVOICE</h2>
        <span className={`${styles.statusBadge} ${getStatusClass(invoice.status)}`}>
          {getStatusText(invoice.status)}
        </span>
      </div>

      {/* Invoice Info - Two Columns */}
      <div className={styles.invoiceInfo}>
        <div className={styles.infoLeft}>
          <div className={styles.infoGroup}>
            <h3 className={styles.infoGroupTitle}>DETAIL INVOICE</h3>
            <p className={styles.infoRow}>
              <span className={styles.infoLabel}>No. Faktur:</span>
              <span className={styles.infoValue}>{invoice.invoiceNumber}</span>
            </p>
            <p className={styles.infoRow}>
              <span className={styles.infoLabel}>Tanggal:</span>
              <span className={styles.infoValue}>{formatDate(invoice.createdAt)}</span>
            </p>
            {invoice.dueDate && (
              <p className={styles.infoRow}>
                <span className={styles.infoLabel}>Jatuh Tempo:</span>
                <span className={styles.infoValue}>{formatDate(invoice.dueDate)}</span>
              </p>
            )}
          </div>
        </div>
        <div className={styles.infoRight}>
          <div className={styles.infoGroup}>
            <h3 className={styles.infoGroupTitle}>TAGIHAN UNTUK</h3>
            <p className={styles.billToName}>{invoice.memberName || 'Member'}</p>
            <p className={styles.billToDetail}>Member No: {invoice.memberNo || '-'}</p>
            {invoice.branchName && (
              <p className={styles.billToDetail}>Cabang: {invoice.branchName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.itemsTable}>
          <thead className={styles.tableHeader}>
            <tr>
              <th className={styles.colNo}>No</th>
              <th className={styles.colCode}>Kode Barang</th>
              <th className={styles.colName}>Nama Barang / Layanan</th>
              <th className={styles.colQty}>Qty</th>
              <th className={styles.colPrice}>Harga Satuan</th>
              <th className={styles.colTotal}>Total</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {groupedItems.map((item, index) => {
              return (
                <tr key={`${item.id}-${index}`} className={styles.tableRow}>
                  <td className={styles.colNo}>{index + 1}</td>
                  <td className={styles.colCode}>
                    <div className={styles.itemCode}>{item.code}</div>
                  </td>
                  <td className={styles.colName}>
                    <div className={styles.itemName}>{item.description}</div>
                    {(item as any).subDescription && (
                      <div className={styles.itemSubDescription}>{(item as any).subDescription}</div>
                    )}
                  </td>
                  <td className={styles.colQty}>{item.quantity}</td>
                  <td className={styles.colPrice}>{formatCurrency(item.pricePerUnit)}</td>
                  <td className={styles.colTotal}>{formatCurrency(item.totalAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryTable}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Subtotal</span>
            <span className={styles.summaryValue}>{formatCurrency(invoice.subtotal)}</span>
          </div>
          
          {invoice.discountAmount && invoice.discountAmount > 0 && (
            <div className={`${styles.summaryRow} ${styles.summaryDiscount}`}>
              <span className={styles.summaryLabel}>
                Diskon {invoice.discountPercent ? `(${invoice.discountPercent}%)` : ''}
              </span>
              <span className={styles.summaryValue}>- {formatCurrency(invoice.discountAmount)}</span>
            </div>
          )}
          
          {invoice.taxAmount && invoice.taxAmount > 0 && (
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>
                Pajak {invoice.taxPercent ? `(${invoice.taxPercent}%)` : ''}
              </span>
              <span className={styles.summaryValue}>{formatCurrency(invoice.taxAmount)}</span>
            </div>
          )}
          
          <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
            <span className={styles.summaryLabel}>TOTAL PEMBAYARAN</span>
            <span className={styles.summaryValue}>{formatCurrency(invoice.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Incentive Information */}
      {invoice.incentive && (
        <div className={styles.incentiveInfo}>
          <h3 className={styles.sectionTitle}>Informasi Insentif Referral</h3>
          <div className={styles.incentiveContent}>
            <p className={styles.incentiveRow}>
              <span className={styles.incentiveLabel}>Jumlah Insentif:</span>
              <span className={styles.incentiveValue}>{formatCurrency(invoice.incentive.totalAmount)}</span>
            </p>
            <p className={styles.incentiveRow}>
              <span className={styles.incentiveLabel}>Untuk:</span>
              <span className={styles.incentiveValue}>
                {invoice.incentive.referrerName} ({invoice.incentive.referralCode})
              </span>
            </p>
            <p className={styles.incentiveNote}>
              * Insentif referral akan diberikan kepada {invoice.incentive.referrerName}
            </p>
          </div>
        </div>
      )}


      {/* Notes */}
      {invoice.notes && (
        <div className={styles.notes}>
          <h3 className={styles.sectionTitle}>📝 Catatan</h3>
          <p className={styles.notesContent}>{invoice.notes}</p>
        </div>
      )}

      {/* Payment History */}
      {invoice.status === 'PAID' && invoice.payments && invoice.payments.length > 0 && (
        <div className={styles.paymentHistory}>
          <h3 className={styles.sectionTitle}>✅ Riwayat Pembayaran</h3>
          {invoice.payments.map((payment) => (
            <div key={payment.id} className={styles.paymentHistoryItem}>
              <p><strong>Metode:</strong> {payment.paymentMethod}</p>
              {payment.paymentReference && (
                <p><strong>Referensi:</strong> {payment.paymentReference}</p>
              )}
              <p><strong>Jumlah:</strong> {formatCurrency(payment.amount)}</p>
              <p><strong>Tanggal Bayar:</strong> {formatDate(payment.receivedAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Signature */}
      <div className={styles.signature}>
        <div className={styles.signatureBox}>
          <div className={styles.signatureLabel}>Penerima</div>
          <div className={styles.signatureLine}></div>
          <div className={styles.signatureName}>
            {invoice.memberName || 'Member'}
          </div>
        </div>
        <div className={styles.signatureBox}>
          <div className={styles.signatureLabel}>Dibuat Oleh</div>
          <div className={styles.signatureLine}></div>
          <div className={styles.signatureName}>
            {invoice.createdByName || 'Admin'}
          </div>
        </div>
        {invoice.verifiedByName && (
          <div className={styles.signatureBox}>
            <div className={styles.signatureLabel}>Diverifikasi Oleh</div>
            <div className={styles.signatureLine}></div>
            <div className={styles.signatureName}>
              {invoice.verifiedByName}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <p className={styles.footerText}>
          Terima kasih atas kepercayaan Anda menggunakan layanan Raho ERP
        </p>
        <p className={styles.footerText}>
          Dokumen ini dicetak secara otomatis dan sah tanpa tanda tangan
        </p>
        <p className={styles.footerMeta}>
          Generated: {new Date().toLocaleString('id-ID')} | Invoice #{invoice.invoiceNumber}
        </p>
      </div>
    </div>
  );
}
