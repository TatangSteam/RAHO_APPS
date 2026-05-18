'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

interface Shipment {
  id: string;
  shipmentCode: string;
  fromBranchName: string;
  toBranchName: string;
  status: 'PREPARING' | 'SHIPPED' | 'RECEIVED' | 'APPROVED';
  itemCount: number;
  items: Array<{
    id: string;
    productName: string;
    sentQty: number;
    unit: string;
  }>;
  shippedAt?: string;
  receivedAt?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
}

export default function ShipmentsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PREPARING' | 'SHIPPED' | 'RECEIVED' | 'APPROVED'>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<'ship' | 'receive' | 'approve' | null>(null);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    fetchShipments();
  }, [mounted, user, accessToken, filter]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      
      if (!accessToken) {
        showToast.error('Token tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (filter !== 'ALL') {
        params.append('status', filter);
      }

      const response = await fetch(`/api/inventory/shipments?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          showToast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          router.push('/login');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setShipments(data.data || []);
    } catch (error) {
      showToast.error('Gagal memuat pengiriman');
      console.error('Shipments fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (shipmentId: string, action: 'ship' | 'receive' | 'approve') => {
    try {
      setActionLoading(true);
      const endpoint = `/api/inventory/shipments/${shipmentId}/${action}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ notes: notes || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${action} shipment`);
      }

      const actionText =
        action === 'ship' ? 'dikirim' : action === 'receive' ? 'diterima' : 'di-approve';
      showToast.success(`Pengiriman berhasil ${actionText}`);
      setShowModal(false);
      setNotes('');
      setSelectedShipment(null);
      setModalAction(null);
      fetchShipments();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal memproses pengiriman');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PREPARING':
        return <span className={`${styles.badge} ${styles.preparing}`}>📦 PREPARING</span>;
      case 'SHIPPED':
        return <span className={`${styles.badge} ${styles.shipped}`}>🚚 SHIPPED</span>;
      case 'RECEIVED':
        return <span className={`${styles.badge} ${styles.received}`}>📥 RECEIVED</span>;
      case 'APPROVED':
        return <span className={`${styles.badge} ${styles.approved}`}>✓ APPROVED</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  const canShip = (shipment: Shipment) => 
    ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(user?.role || '') && 
    shipment.status === 'PREPARING';
  const canReceive = (shipment: Shipment) =>
    ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user?.role || '') &&
    shipment.status === 'SHIPPED';
  const canApprove = (shipment: Shipment) =>
    ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user?.role || '') &&
    shipment.status === 'RECEIVED';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🚚 Pengiriman Stok</h1>
        <p>Kelola pengiriman stok antar cabang</p>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filters}>
          {(['ALL', 'PREPARING', 'SHIPPED', 'RECEIVED', 'APPROVED'] as const).map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'ALL'
                ? 'Semua'
                : f === 'PREPARING'
                  ? 'Preparing'
                  : f === 'SHIPPED'
                    ? 'Shipped'
                    : f === 'RECEIVED'
                      ? 'Received'
                      : 'Approved'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data...</p>
        </div>
      ) : shipments.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🚚</div>
          <h3>Belum Ada Pengiriman</h3>
          <p>Belum ada pengiriman stok yang dibuat. Pengiriman akan muncul setelah request stok di-approve.</p>
          <button 
            className={styles.emptyBtn}
            onClick={() => router.push('/inventory/stock-requests')}
          >
            📋 Lihat Request Stok
          </button>
        </div>
      ) : (
        <div className={styles.shipmentsList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {shipments.map((shipment) => (
            <div key={shipment.id} className={styles.shipmentCard} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>{shipment.shipmentCode}</h3>
                  <p className={styles.route}>
                    {shipment.fromBranchName} → {shipment.toBranchName}
                  </p>
                </div>
                {getStatusBadge(shipment.status)}
              </div>

              <div className={styles.cardBody}>
                {/* Timeline / Dates */}
                <div className={styles.timeline}>
                  <div className={styles.timelineItem}>
                    <span className={styles.timelineLabel}>📅 Dibuat:</span>
                    <span className={styles.timelineDate}>
                      {new Date(shipment.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {shipment.shippedAt && (
                    <div className={styles.timelineItem}>
                      <span className={styles.timelineLabel}>🚚 Dikirim:</span>
                      <span className={styles.timelineDate}>
                        {new Date(shipment.shippedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  {shipment.receivedAt && (
                    <div className={styles.timelineItem}>
                      <span className={styles.timelineLabel}>📥 Diterima:</span>
                      <span className={styles.timelineDate}>
                        {new Date(shipment.receivedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  {shipment.approvedAt && (
                    <div className={styles.timelineItem}>
                      <span className={styles.timelineLabel}>✅ Selesai:</span>
                      <span className={styles.timelineDate}>
                        {new Date(shipment.approvedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.itemsCount}>
                  <span className={styles.label}>Items:</span>
                  <span className={styles.value}>{shipment.itemCount}</span>
                </div>

                <div className={styles.items}>
                  {shipment.items.slice(0, 3).map((item) => (
                    <div key={item.id} className={styles.item}>
                      <span className={styles.itemName}>{item.productName}</span>
                      <span className={styles.itemQty}>
                        {item.sentQty} {item.unit}
                      </span>
                    </div>
                  ))}
                  {shipment.items.length > 3 && (
                    <div className={styles.moreItems}>+{shipment.items.length - 3} item lainnya</div>
                  )}
                </div>

                {shipment.notes && (
                  <div className={styles.notesSection}>
                    <span className={styles.label}>📝 Catatan:</span>
                    <p className={styles.notesText}>{shipment.notes}</p>
                  </div>
                )}
              </div>

              {(canShip(shipment) || canReceive(shipment) || canApprove(shipment)) && (
                <div className={styles.cardActions}>
                  {canShip(shipment) && (
                    <button
                      className={`${styles.btn} ${styles.ship}`}
                      onClick={() => {
                        setSelectedShipment(shipment);
                        setModalAction('ship');
                        setShowModal(true);
                      }}
                    >
                      🚚 Kirim
                    </button>
                  )}
                  {canReceive(shipment) && (
                    <button
                      className={`${styles.btn} ${styles.receive}`}
                      onClick={() => {
                        setSelectedShipment(shipment);
                        setModalAction('receive');
                        setShowModal(true);
                      }}
                    >
                      📥 Terima
                    </button>
                  )}
                  {canApprove(shipment) && (
                    <button
                      className={`${styles.btn} ${styles.approve}`}
                      onClick={() => {
                        setSelectedShipment(shipment);
                        setModalAction('approve');
                        setShowModal(true);
                      }}
                    >
                      ✓ Approve
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && selectedShipment && modalAction && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>
              {modalAction === 'ship'
                ? '🚚 Kirim Pengiriman'
                : modalAction === 'receive'
                  ? '📥 Terima Pengiriman'
                  : '✓ Approve Pengiriman'}
            </h2>
            <p className={styles.shipmentCode}>{selectedShipment.shipmentCode}</p>

            <div className={styles.itemsList}>
              <h3>Items:</h3>
              {selectedShipment.items.map((item) => (
                <div key={item.id} className={styles.listItem}>
                  <span>{item.productName}</span>
                  <span className={styles.qty}>
                    {item.sentQty} {item.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.formGroup}>
              <label>Catatan (Opsional):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan catatan..."
                rows={3}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                className={`${styles.btn} ${styles[modalAction]}`}
                onClick={() => handleAction(selectedShipment.id, modalAction)}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Memproses...'
                  : modalAction === 'ship'
                    ? '🚚 Kirim'
                    : modalAction === 'receive'
                      ? '📥 Terima'
                      : '✓ Approve'}
              </button>
              <button
                className={`${styles.btn} ${styles.cancel}`}
                onClick={() => {
                  setShowModal(false);
                  setNotes('');
                  setSelectedShipment(null);
                  setModalAction(null);
                }}
                disabled={actionLoading}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
