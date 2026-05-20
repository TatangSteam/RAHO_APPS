'use client';

import { Shipment } from '@/lib/api/inventoryApi';
import modalStyles from '@/components/members/AssignPackageModal.module.css';

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

interface DetailModalProps {
  shipment: Shipment;
  onClose: () => void;
  onShip?: () => void;
  onReceive?: () => void;
}

export default function DetailModal({ shipment, onClose, onShip, onReceive }: DetailModalProps) {
  const getStatusBadge = (status: string) => {
    const icon = STATUS_ICONS[status] || '📋';
    const label = STATUS_LABELS[status] || status;
    
    let bgColor = 'rgba(148, 163, 184, 0.2)';
    let textColor = 'rgba(148, 163, 184, 0.9)';
    
    switch (status) {
      case 'PREPARING':
        bgColor = 'rgba(251, 191, 36, 0.2)';
        textColor = '#fbbf24';
        break;
      case 'SHIPPED':
        bgColor = 'rgba(59, 130, 246, 0.2)';
        textColor = '#3b82f6';
        break;
      case 'RECEIVED':
        bgColor = 'rgba(34, 197, 94, 0.2)';
        textColor = '#22c55e';
        break;
      case 'RECEIVED_WITH_ISSUE':
        bgColor = 'rgba(249, 115, 22, 0.2)';
        textColor = '#f97316';
        break;
    }

    return (
      <span style={{ 
        padding: '6px 12px', 
        borderRadius: '20px',
        fontSize: '0.875rem',
        fontWeight: 600,
        backgroundColor: bgColor,
        color: textColor,
      }}>
        {icon} {label}
      </span>
    );
  };

  return (
    <div className={modalStyles.modalBackdrop} onClick={onClose}>
      <div className={modalStyles.modalContainer} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        {/* Header */}
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.modalTitle}>📦 Detail Pengiriman</h2>
          <button className={modalStyles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className={modalStyles.modalBody}>
          {/* Shipment Info */}
          <div className={modalStyles.section}>
            <div className={modalStyles.sectionBox} style={{ 
              background: 'rgba(148, 163, 184, 0.1)', 
              borderColor: 'rgba(148, 163, 184, 0.3)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '4px' }}>{shipment.shipmentCode}</p>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {shipment.fromBranchName} → {shipment.toBranchName}
                  </p>
                </div>
                {getStatusBadge(shipment.status)}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className={modalStyles.section}>
            <h3 className={modalStyles.sectionTitle} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
              📅 Timeline
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '12px',
            }}>
              <div style={{ 
                padding: '12px', 
                background: 'rgba(148, 163, 184, 0.1)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.7)', marginBottom: '4px', textTransform: 'uppercase' }}>Dibuat</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {new Date(shipment.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div style={{ 
                padding: '12px', 
                background: shipment.shippedAt 
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'rgba(148, 163, 184, 0.1)',
                border: `1px solid ${shipment.shippedAt ? 'rgba(59, 130, 246, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.7)', marginBottom: '4px', textTransform: 'uppercase' }}>Dikirim</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: shipment.shippedAt ? '#3b82f6' : 'rgba(148, 163, 184, 0.5)' }}>
                  {shipment.shippedAt 
                    ? new Date(shipment.shippedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                    : '-'
                  }
                </div>
              </div>
              <div style={{ 
                padding: '12px', 
                background: shipment.receivedAt 
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(148, 163, 184, 0.1)',
                border: `1px solid ${shipment.receivedAt ? 'rgba(34, 197, 94, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                borderRadius: '8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.7)', marginBottom: '4px', textTransform: 'uppercase' }}>Diterima</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: shipment.receivedAt ? '#22c55e' : 'rgba(148, 163, 184, 0.5)' }}>
                  {shipment.receivedAt 
                    ? new Date(shipment.receivedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                    : '-'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className={modalStyles.section}>
            <div className={`${modalStyles.sectionBox} ${modalStyles.basicSection}`}>
              <h3 className={`${modalStyles.sectionTitle} ${modalStyles.basicTitle}`}>
                📋 Daftar Item ({shipment.items.length})
              </h3>
              
              {shipment.items.map((item, index) => (
                <div key={item.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  marginBottom: index < shipment.items.length - 1 ? '8px' : '0',
                }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.productName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontWeight: 700, 
                      color: 'var(--color-primary-500)',
                      padding: '4px 12px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      borderRadius: '20px',
                      fontSize: '0.875rem',
                    }}>
                      {item.sentQty} {item.unit}
                    </span>
                    {item.receivedQty !== undefined && item.receivedQty !== item.sentQty && (
                      <span style={{ 
                        color: '#ef4444', 
                        fontSize: '0.75rem',
                        padding: '4px 8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        borderRadius: '12px',
                      }}>
                        Diterima: {item.receivedQty}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discrepancies */}
          {shipment.discrepancies && shipment.discrepancies.length > 0 && (
            <div className={modalStyles.section}>
              <div className={modalStyles.sectionBox} style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}>
                <h3 className={modalStyles.sectionTitle} style={{ color: '#ef4444' }}>
                  ⚠️ Ketidaksesuaian ({shipment.discrepancies.length})
                </h3>
                
                {shipment.discrepancies.map((d, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      padding: '10px 12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '6px',
                      marginBottom: index < shipment.discrepancies!.length - 1 ? '8px' : '0',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {d.productName}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(239, 68, 68, 0.9)' }}>
                      {d.discrepancyType === 'SHORTAGE' ? 'Kurang' : 
                       d.discrepancyType === 'DAMAGE' ? 'Rusak' : 
                       d.discrepancyType === 'WRONG_ITEM' ? 'Salah Item' : 'Lainnya'}
                      {d.notes && ` - ${d.notes}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {shipment.notes && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox} ${modalStyles.addonsSection}`}>
                <h3 className={`${modalStyles.sectionTitle} ${modalStyles.addonsTitle}`}>
                  📝 Catatan
                </h3>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontStyle: 'italic',
                  margin: 0,
                }}>
                  {shipment.notes}
                </p>
              </div>
            </div>
          )}

          {/* Stock Request Info - only show if available */}
          {(shipment as any).stockRequest && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox} ${modalStyles.discountSection}`}>
                <h3 className={`${modalStyles.sectionTitle} ${modalStyles.discountTitle}`}>
                  📋 Request Stok Terkait
                </h3>
                <p style={{ 
                  fontWeight: 600, 
                  color: 'var(--text-primary)',
                  margin: 0,
                }}>
                  {(shipment as any).stockRequest.requestCode}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={modalStyles.modalFooter}>
          {onShip && (
            <button
              onClick={onShip}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              🚚 Kirim
            </button>
          )}
          {onReceive && (
            <button
              onClick={onReceive}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              📥 Terima
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgba(148, 163, 184, 0.2)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
