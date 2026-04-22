'use client';

import { useState } from 'react';
import type { Invoice } from '@/types/invoice';
import { formatNumberWithDots } from '@/lib/formatNumber';
import InvoiceView from './InvoiceView';
import styles from './InvoiceList.module.css';

interface InvoiceListProps {
  invoices: Invoice[];
  loading?: boolean;
  onRefresh?: () => void;
}

export default function InvoiceList({ invoices, loading = false, onRefresh }: InvoiceListProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredInvoices = filterStatus === 'ALL'
    ? invoices
    : invoices.filter(inv => inv.status === filterStatus);

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

  if (selectedInvoice) {
    return (
      <InvoiceView
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>📄 Daftar Invoice</h2>
        {onRefresh && (
          <button onClick={onRefresh} className={styles.refreshButton} disabled={loading}>
            {loading ? '⏳ Memuat...' : '🔄 Refresh'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_PAYMENT">Menunggu Pembayaran</option>
            <option value="PAID">Lunas</option>
            <option value="OVERDUE">Jatuh Tempo</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </div>
        <div className={styles.filterInfo}>
          Menampilkan {filteredInvoices.length} dari {invoices.length} invoice
        </div>
      </div>

      {/* Invoice Table */}
      {filteredInvoices.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>📭</p>
          <p className={styles.emptyText}>Tidak ada invoice</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colNumber}>No. Invoice</th>
                <th className={styles.colDate}>Tanggal</th>
                <th className={styles.colAmount}>Jumlah</th>
                <th className={styles.colStatus}>Status</th>
                <th className={styles.colDueDate}>Jatuh Tempo</th>
                <th className={styles.colAction}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className={styles.tableRow}>
                  <td className={styles.colNumber}>
                    <span className={styles.invoiceNumber}>{invoice.invoiceNumber}</span>
                  </td>
                  <td className={styles.colDate}>
                    {new Date(invoice.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className={styles.colAmount}>
                    <span className={styles.amount}>Rp {formatNumberWithDots(invoice.totalAmount)}</span>
                  </td>
                  <td className={styles.colStatus}>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </td>
                  <td className={styles.colDueDate}>
                    {invoice.dueDate
                      ? new Date(invoice.dueDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                      : '-'}
                  </td>
                  <td className={styles.colAction}>
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className={styles.viewButton}
                      title="Lihat detail invoice"
                    >
                      👁️ Lihat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
