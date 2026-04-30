import { useState } from 'react';
import { StockRequest } from '../types';
import styles from '../page.module.css';

interface ReviewModalProps {
  request: StockRequest;
  onClose: () => void;
  onApprove: (requestId: string, reviewNotes: string) => Promise<void>;
  onReject: (requestId: string, reviewNotes: string) => Promise<void>;
  loading: boolean;
}

export default function ReviewModal({ request, onClose, onApprove, onReject, loading }: ReviewModalProps) {
  const [reviewNotes, setReviewNotes] = useState('');

  const handleApprove = async () => {
    if (!reviewNotes.trim()) {
      return; // Parent should handle validation
    }
    await onApprove(request.id, reviewNotes);
  };

  const handleReject = async () => {
    if (!reviewNotes.trim()) {
      return; // Parent should handle validation
    }
    await onReject(request.id, reviewNotes);
  };

  const handleClose = () => {
    setReviewNotes('');
    onClose();
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={handleClose} />
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Review Request Stok</h2>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.requestInfo}>
            <p className={styles.requestCode}>{request.requestCode}</p>
            <p className={styles.requestBranch}>{request.branchName}</p>
          </div>

          {/* Bundle Indicator in Modal */}
          {request.itemCount > 1 && (
            <div className={styles.bundleIndicator}>
              <span className={styles.bundleIcon}>📦</span>
              <span>Bundle Approval: Semua {request.itemCount} item akan di-approve/reject bersamaan</span>
            </div>
          )}

          <div className={styles.itemsListModal}>
            <h3>Items yang Diminta</h3>
            {request.items.map((item) => (
              <div key={item.id} className={styles.itemRowModal}>
                <span>{item.productName}</span>
                <span className={styles.qty}>{item.requestedQty} {item.unit}</span>
              </div>
            ))}
          </div>

          <div className={styles.formGroup}>
            <label>Catatan Review</label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Masukkan catatan review..."
              rows={4}
              className={styles.textarea}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={`${styles.modalBtn} ${styles.approve}`}
            onClick={handleApprove}
            disabled={loading}
          >
            {loading ? 'Memproses...' : '✓ Approve'}
          </button>
          <button
            className={`${styles.modalBtn} ${styles.reject}`}
            onClick={handleReject}
            disabled={loading}
          >
            {loading ? 'Memproses...' : '✗ Reject'}
          </button>
          <button
            className={`${styles.modalBtn} ${styles.cancel}`}
            onClick={handleClose}
            disabled={loading}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}