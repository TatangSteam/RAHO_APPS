import { StockRequest } from '../types';
import styles from '../page.module.css';

interface StockRequestCardProps {
  request: StockRequest;
  userRole?: string;
  onReview: (request: StockRequest) => void;
}

export default function StockRequestCard({ request, userRole, onReview }: StockRequestCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className={`${styles.badge} ${styles.pending}`}>⏳ PENDING</span>;
      case 'APPROVED':
        return <span className={`${styles.badge} ${styles.approved}`}>✓ APPROVED</span>;
      case 'REJECTED':
        return <span className={`${styles.badge} ${styles.rejected}`}>✗ REJECTED</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  return (
    <div className={styles.requestCard} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <h3>{request.requestCode}</h3>
          <p className={styles.branch}>{request.branchName}</p>
        </div>
        {getStatusBadge(request.status)}
      </div>

      <div className={styles.cardBody}>
        {/* Bundle Indicator */}
        {request.itemCount > 1 && (
          <div className={styles.bundleIndicator}>
            <span className={styles.bundleIcon}>📦</span>
            <span>Bundle: Semua {request.itemCount} item akan di-approve bersamaan</span>
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

      {request.status === 'PENDING' && userRole === 'SUPER_ADMIN' && (
        <div className={styles.cardActions}>
          <button
            className={`${styles.actionBtn} ${styles.approve}`}
            onClick={() => onReview(request)}
          >
            ✓ Approve
          </button>
          <button
            className={`${styles.actionBtn} ${styles.reject}`}
            onClick={() => onReview(request)}
          >
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  );
}