'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { inventoryApi, Shipment, ReceiveShipmentInput } from '@/lib/api/inventoryApi';
import ShipModal from './components/ShipModal';
import ReceiveModal from './components/ReceiveModal';
import DetailModal from './components/DetailModal';
import styles from './page.module.css';

type ShipmentStatus = 'ALL' | 'PREPARING' | 'SHIPPED' | 'RECEIVED' | 'RECEIVED_WITH_ISSUE';

const STATUS_LABELS: Record<string, string> = {
  PREPARING: 'Sedang Disiapkan',
  SHIPPED: 'Dikirim',
  RECEIVED: 'Diterima',
  RECEIVED_WITH_ISSUE: 'Diterima (Ada Masalah)',
};

const STATUS_ICONS: Record<string, string> = {
  PREPARING: '📦',
  SHIPPED: '🚚',
  RECEIVED: '✅',
  RECEIVED_WITH_ISSUE: '⚠️',
};

export default function ShipmentsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ShipmentStatus>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [modalAction, setModalAction] = useState<'ship' | 'receive' | 'detail' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchShipments = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      const params: any = {};
      if (filter !== 'ALL') {
        params.status = filter;
      }

      const response = await inventoryApi.getShipments(params);
      const responseBody = response.data;
      
      let shipmentsData: Shipment[] = [];
      
      if (responseBody?.data) {
        if (Array.isArray(responseBody.data)) {
          shipmentsData = responseBody.data;
        } else if (responseBody.data.data && Array.isArray(responseBody.data.data)) {
          shipmentsData = responseBody.data.data;
        }
      }
      
      setShipments(shipmentsData);
    } catch (error: any) {
      console.error('Shipments fetch error:', error);
      showToast.error('Gagal memuat pengiriman');
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

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
  }, [mounted, user, accessToken, router, fetchShipments]);

  const handleShip = async (notes?: string) => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      await inventoryApi.shipShipment(selectedShipment.id, { notes });
      showToast.success('Pengiriman berhasil dikirim');
      closeModal();
      fetchShipments();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal mengirim pengiriman');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async (input: ReceiveShipmentInput) => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      await inventoryApi.receiveShipment(selectedShipment.id, input);
      const hasDiscrepancy = input.discrepancies && input.discrepancies.length > 0;
      showToast.success(hasDiscrepancy ? 'Pengiriman diterima dengan catatan ketidaksesuaian' : 'Pengiriman berhasil diterima');
      closeModal();
      fetchShipments();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal menerima pengiriman');
    } finally {
      setActionLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedShipment(null);
    setModalAction(null);
  };

  const openShipModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('ship');
  };

  const openReceiveModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('receive');
  };

  const openDetailModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setModalAction('detail');
  };

  const getStatusBadge = (status: string) => {
    const icon = STATUS_ICONS[status] || '📋';
    const label = STATUS_LABELS[status] || status;
    
    let bgColor = 'rgba(148, 163, 184, 0.2)';
    let textColor = 'rgba(148, 163, 184, 0.9)';
    let borderColor = 'rgba(148, 163, 184, 0.3)';
    
    switch (status) {
      case 'PREPARING':
        bgColor = 'rgba(251, 191, 36, 0.2)';
        textColor = 'rgba(251, 191, 36, 0.9)';
        borderColor = 'rgba(251, 191, 36, 0.3)';
        break;
      case 'SHIPPED':
        bgColor = 'rgba(59, 130, 246, 0.2)';
        textColor = 'rgba(59, 130, 246, 0.9)';
        borderColor = 'rgba(59, 130, 246, 0.3)';
        break;
      case 'RECEIVED':
        bgColor = 'rgba(34, 197, 94, 0.2)';
        textColor = 'rgba(34, 197, 94, 0.9)';
        borderColor = 'rgba(34, 197, 94, 0.3)';
        break;
      case 'RECEIVED_WITH_ISSUE':
        bgColor = 'rgba(249, 115, 22, 0.2)';
        textColor = 'rgba(249, 115, 22, 0.9)';
        borderColor = 'rgba(249, 115, 22, 0.3)';
        break;
    }

    return (
      <span 
        className={styles.badge} 
        style={{ backgroundColor: bgColor, color: textColor, border: `1px solid ${borderColor}` }}
      >
        {icon} {label}
      </span>
    );
  };

  const canShip = (shipment: Shipment) => 
    ['SUPER_ADMIN', 'ADMIN_MANAGER'].includes(user?.role || '') && 
    shipment.status === 'PREPARING';
    
  const canReceive = (shipment: Shipment) =>
    user?.role === 'ADMIN_CABANG' &&
    shipment.status === 'SHIPPED';

  const filterOptions: { value: ShipmentStatus; label: string; icon: string }[] = [
    { value: 'ALL', label: 'Semua', icon: '📋' },
    { value: 'PREPARING', label: 'Disiapkan', icon: '📦' },
    { value: 'SHIPPED', label: 'Dikirim', icon: '🚚' },
    { value: 'RECEIVED', label: 'Diterima', icon: '✅' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🚚 Pengiriman Stok</h1>
        <p>Kelola pengiriman stok antar cabang</p>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filters}>
          {filterOptions.map((f) => (
            <button
              key={f.value}
              className={`${styles.filterBtn} ${filter === f.value ? styles.active : ''}`}
              onClick={() => setFilter(f.value)}
            >
              <span>{f.icon}</span> {f.label}
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
          <p>Belum ada pengiriman stok. Pengiriman akan muncul setelah request stok disetujui.</p>
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
            <div 
              key={shipment.id} 
              className={styles.shipmentCard} 
              style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => openDetailModal(shipment)}
            >
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
                {/* Timeline */}
                <div className={styles.timeline}>
                  <div className={styles.timelineItem}>
                    <span className={styles.timelineLabel}>📅 Dibuat:</span>
                    <span className={styles.timelineDate}>
                      {new Date(shipment.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
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
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.itemsCount}>
                  <span className={styles.label}>Items:</span>
                  <span className={styles.value}>{shipment.items.length}</span>
                </div>

                <div className={styles.items}>
                  {shipment.items.slice(0, 3).map((item) => (
                    <div key={item.id} className={styles.item}>
                      <span className={styles.itemName}>{item.productName}</span>
                      <span className={styles.itemQty}>
                        {item.sentQty} {item.unit}
                        {item.receivedQty !== undefined && item.receivedQty !== item.sentQty && (
                          <span style={{ color: '#dc2626', marginLeft: '4px' }}>
                            (diterima: {item.receivedQty})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {shipment.items.length > 3 && (
                    <div className={styles.moreItems}>+{shipment.items.length - 3} item lainnya</div>
                  )}
                </div>

                {/* Discrepancies */}
                {shipment.discrepancies && shipment.discrepancies.length > 0 && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '8px 12px', 
                    background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.15) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  }}>
                    <div style={{ fontWeight: 600, color: 'rgba(239, 68, 68, 0.9)', marginBottom: '4px' }}>
                      ⚠️ Ketidaksesuaian ({shipment.discrepancies.length})
                    </div>
                    {shipment.discrepancies.slice(0, 2).map((d, i) => (
                      <div key={i} style={{ color: 'rgba(239, 68, 68, 0.8)', fontSize: '0.75rem' }}>
                        {d.productName}: {d.discrepancyType}
                      </div>
                    ))}
                  </div>
                )}

                {shipment.notes && (
                  <div className={styles.notesSection}>
                    <span className={styles.label}>📝 Catatan:</span>
                    <p className={styles.notesText}>{shipment.notes}</p>
                  </div>
                )}
              </div>

              {(canShip(shipment) || canReceive(shipment)) && (
                <div className={styles.cardActions}>
                  {canShip(shipment) && (
                    <button
                      className={`${styles.btn} ${styles.ship}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openShipModal(shipment);
                      }}
                    >
                      🚚 Kirim
                    </button>
                  )}
                  {canReceive(shipment) && (
                    <button
                      className={`${styles.btn} ${styles.receive}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openReceiveModal(shipment);
                      }}
                    >
                      📥 Terima
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ship Modal */}
      {selectedShipment && modalAction === 'ship' && (
        <ShipModal
          shipment={selectedShipment}
          onClose={closeModal}
          onShip={handleShip}
          loading={actionLoading}
        />
      )}

      {/* Receive Modal */}
      {selectedShipment && modalAction === 'receive' && (
        <ReceiveModal
          shipment={selectedShipment}
          onClose={closeModal}
          onReceive={handleReceive}
          loading={actionLoading}
        />
      )}

      {/* Detail Modal */}
      {selectedShipment && modalAction === 'detail' && (
        <DetailModal
          shipment={selectedShipment}
          onClose={closeModal}
          onShip={canShip(selectedShipment) ? () => {
            closeModal();
            setTimeout(() => openShipModal(selectedShipment), 100);
          } : undefined}
          onReceive={canReceive(selectedShipment) ? () => {
            closeModal();
            setTimeout(() => openReceiveModal(selectedShipment), 100);
          } : undefined}
        />
      )}
    </div>
  );
}
