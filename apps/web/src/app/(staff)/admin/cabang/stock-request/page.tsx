'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { createStockRequest, getBranchStockRequests } from '@/lib/adminApi';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

interface StockRequestItem {
  masterProductId: string;
  quantity: number;
  notes?: string;
}

interface StockRequest {
  id: string;
  requestCode: string;
  status: string;
  notes?: string;
  requestedBy: string;
  createdAt: string;
  items: Array<{
    productName: string;
    requestedQuantity: number;
    unit: string;
    notes?: string;
  }>;
}

export default function StockRequestPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<StockRequestItem[]>([{ masterProductId: '', quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (user?.role !== 'ADMIN_CABANG') {
      router.push('/dashboard');
      return;
    }

    loadRequests();
  }, [user, router]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await getBranchStockRequests();
      setRequests(res.data || []);
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { masterProductId: '', quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof StockRequestItem, value: StockRequestItem[keyof StockRequestItem]) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi
    if (items.some(item => !item.masterProductId || item.quantity < 1)) {
      showToast.error('Lengkapi semua item permintaan');
      return;
    }

    try {
      setSubmitting(true);
      await createStockRequest({
        notes,
        items: items.map(item => ({
          masterProductId: item.masterProductId,
          quantity: item.quantity,
          notes: item.notes
        }))
      });

      showToast.success('Permintaan stok berhasil dibuat');
      setItems([{ masterProductId: '', quantity: 1 }]);
      setNotes('');
      setShowForm(false);
      loadRequests();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.message || 'Gagal membuat permintaan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && requests.length === 0) {
    return <div className={styles.loading}>Memuat data...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Request Stok</h1>
        <p>Minta stok produk dari pusat</p>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className={styles.formSection}>
          <div className={styles.formHeader}>
            <h2>Buat Permintaan Stok Baru</h2>
            <button className={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Items */}
            <div className={styles.formGroup}>
              <label>Produk yang Diminta</label>
              <div className={styles.itemsList}>
                {items.map((item, index) => (
                  <div key={index} className={styles.itemRow}>
                    <input
                      type="text"
                      placeholder="ID Produk"
                      value={item.masterProductId}
                      onChange={(e) => handleItemChange(index, 'masterProductId', e.target.value)}
                      className={styles.input}
                    />
                    <input
                      type="number"
                      placeholder="Jumlah"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                      className={styles.input}
                    />
                    <input
                      type="text"
                      placeholder="Catatan (opsional)"
                      value={item.notes || ''}
                      onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                      className={styles.input}
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleRemoveItem(index)}
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={styles.addItemBtn}
                onClick={handleAddItem}
              >
                + Tambah Item
              </button>
            </div>

            {/* Notes */}
            <div className={styles.formGroup}>
              <label htmlFor="notes">Catatan Umum</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan untuk permintaan ini..."
                className={styles.textarea}
                rows={3}
              />
            </div>

            {/* Buttons */}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowForm(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting}
              >
                {submitting ? 'Mengirim...' : 'Kirim Permintaan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request List */}
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h2>Riwayat Permintaan</h2>
          {!showForm && (
            <button className={styles.newBtn} onClick={() => setShowForm(true)}>
              + Permintaan Baru
            </button>
          )}
        </div>

        {requests.length === 0 ? (
          <p className={styles.empty}>Belum ada permintaan stok</p>
        ) : (
          <div className={styles.requestsList}>
            {requests.map((request) => (
              <div key={request.id} className={styles.requestCard}>
                <div className={styles.requestHeader}>
                  <div>
                    <h3>{request.requestCode}</h3>
                    <p className={styles.date}>
                      {new Date(request.createdAt).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <span className={`${styles.badge} ${styles[request.status.toLowerCase()]}`}>
                    {request.status === 'PENDING' && '⏳ Pending'}
                    {request.status === 'APPROVED' && '✅ Disetujui'}
                    {request.status === 'REJECTED' && '❌ Ditolak'}
                  </span>
                </div>

                <div className={styles.requestItems}>
                  <h4>Item yang Diminta:</h4>
                  <ul>
                    {request.items.map((item, idx) => (
                      <li key={idx}>
                        {item.productName} - {item.requestedQuantity} {item.unit}
                        {item.notes && <span className={styles.itemNote}>({item.notes})</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {request.notes && (
                  <div className={styles.requestNotes}>
                    <strong>Catatan:</strong> {request.notes}
                  </div>
                )}

                <div className={styles.requestFooter}>
                  <small>Diminta oleh: {request.requestedBy}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
