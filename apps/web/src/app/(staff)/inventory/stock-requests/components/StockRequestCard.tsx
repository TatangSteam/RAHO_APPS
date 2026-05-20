'use client';

import { StockRequest, STATUS_LABELS, STATUS_COLORS, STATUS_ICONS, StockRequestStatus } from '../types';
import styles from '../page.module.css';

interface StockRequestCardProps {
  request: StockRequest;
  userRole?: string;
  onReview: (request: StockRequest) => void;
  onUploadPayment?: (request: StockRequest) => void;
  onReceive?: (request: StockRequest) => void;
}

export default function StockRequestCard({ 
  request, 
  userRole, 
  onReview,
  onUploadPayment,
  onReceive,
}: StockRequestCardProps) {
  const getStatusBadge = (status: StockRequestStatus) => {
    const color = STATUS_COLORS[status] || '#6b7280';
    const icon = STATUS_ICONS[status] || '📋';
    const label = STATUS_LABELS[status] || status;

    return (
      <span 
        className={styles.badge} 
        style={{ 
          backgroundColor: `${color}20`,
          color: color,
          border: `1px solid ${color}40`,
        }}
      >
        {icon} {label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Determine what actions are available
  const isManager = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER';
  const isAdminCabang = userRole === 'ADMIN_CABANG';
  
  const canReview = isManager && ['PENDING', 'PAYMENT_UPLOADED'].includes(request.status);
  const canUploadPayment = isManager && request.status === 'WAITING_PAYMENT';
  const canReceive = isAdminCabang && request.status === 'SHIPPED';

  return (
    <div className={styles.requestCard} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <h3>{request.requestCode}</h3>
          <p className={styles.branch}>
            {request.branchName}
            <span style={{ 
              marginLeft: '8px', 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontSize: '0.7rem',
              backgroundColor: request.branchType === 'PREMIERE' ? '#dbeafe' : '#fef3c7',
              color: request.branchType === 'PREMIERE' ? '#1d4ed8' : '#92400e',
            }}>
              {request.branchType}
            </span>
          </p>
        </div>
        {getStatusBadge(request.status)}
      </div>

      <div className={styles.cardBody}>
        {/* Bundle Indicator */}
        {request.itemCount > 1 && (
          <div className={styles.bundleIndicator}>
            <span className={styles.bundleIcon}>📦</span>
            <span>Bundle: {request.itemCount} item</span>
          </div>
        )}
        
        <div className={styles.itemsSection}>
          <div className={styles.itemCount}>
            <span className={styles.label}>Items</span>
            <span className={styles.value}>{request.itemCount}</span>
          </div>

          <div className={styles.itemsList}>
            {request.items.slice(0, 2).map((item) => (
              <div key={item.id} className={styles.itemRow}>
                <span className={styles.itemName}>{item.productName}</span>
                <span className={styles.itemQty}>{item.requestedQty} {item.unit}</span>
              </div>
            ))}
            {request.items.length > 2 && (
              <div className={styles.moreItems}>+{request.items.length - 2} item lainnya</div>
            )}
          </div>
        </div>

        {/* Invoice Info for Partnership */}
        {request.invoice && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px 12px', 
            backgroundColor: '#f0fdf4', 
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#166534' }}>📄 {request.invoice.invoiceNumber}</span>
              <span style={{ fontWeight: 600, color: '#166534' }}>
                {formatCurrency(request.invoice.totalAmount)}
              </span>
            </div>
          </div>
        )}

        {/* Shipment Info */}
        {request.shipment && (
          <div style={{ 
            marginTop: '8px', 
            padding: '8px 12px', 
            backgroundColor: '#eff6ff', 
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#1d4ed8' }}>🚚 {request.shipment.shipmentCode}</span>
              <span style={{ color: '#1d4ed8' }}>{request.shipment.status}</span>
            </div>
          </div>
        )}

        {/* Payment Proof Indicator */}
        {request.paymentProofUrl && (
          <div style={{ 
            marginTop: '8px', 
            padding: '6px 12px', 
            backgroundColor: '#fef3c7', 
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: '#92400e',
          }}>
            💳 Bukti pembayaran sudah diupload
          </div>
        )}

        {request.notes && (
          <div className={styles.notesSection}>
            <span className={styles.label}>Catatan:</span>
            <p className={styles.noteText}>{request.notes}</p>
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.date}>
            {new Date(request.createdAt).toLocaleDateString('id-ID', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={styles.cardActions}>
        {canReview && (
          <button
            className={`${styles.actionBtn} ${styles.approve}`}
            onClick={() => onReview(request)}
          >
            {request.status === 'PENDING' ? '📋 Review' : '✓ Konfirmasi'}
          </button>
        )}

        {canUploadPayment && onUploadPayment && (
          <button
            className={`${styles.actionBtn} ${styles.approve}`}
            onClick={() => onUploadPayment(request)}
            style={{ backgroundColor: '#8b5cf6' }}
          >
            📤 Upload Bukti Bayar
          </button>
        )}

        {canReceive && onReceive && (
          <button
            className={`${styles.actionBtn} ${styles.approve}`}
            onClick={() => onReceive(request)}
            style={{ backgroundColor: '#10b981' }}
          >
            📦 Terima Barang
          </button>
        )}

        {/* View Details for completed/other statuses */}
        {!canReview && !canUploadPayment && !canReceive && (
          <button
            className={`${styles.actionBtn}`}
            onClick={() => onReview(request)}
            style={{ backgroundColor: '#6b7280' }}
          >
            👁 Lihat Detail
          </button>
        )}
      </div>
    </div>
  );
}
