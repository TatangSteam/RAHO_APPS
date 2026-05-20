'use client';

import { useState } from 'react';
import { Shipment } from '@/lib/api/inventoryApi';
import modalStyles from '@/components/members/AssignPackageModal.module.css';

interface ShipModalProps {
  shipment: Shipment;
  onClose: () => void;
  onShip: (notes?: string) => Promise<void>;
  loading: boolean;
}

export default function ShipModal({ shipment, onClose, onShip, loading }: ShipModalProps) {
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    await onShip(notes || undefined);
  };

  return (
    <div className={modalStyles.modalBackdrop} onClick={onClose}>
      <div className={modalStyles.modalContainer} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        {/* Header */}
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.modalTitle}>🚚 Kirim Pengiriman</h2>
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
                <div style={{ 
                  padding: '6px 12px', 
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(251, 191, 36, 0.2)',
                  color: '#fbbf24',
                }}>
                  📦 PREPARING
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className={modalStyles.section}>
            <div className={`${modalStyles.sectionBox} ${modalStyles.basicSection}`}>
              <h3 className={`${modalStyles.sectionTitle} ${modalStyles.basicTitle}`}>
                📦 Items yang akan dikirim ({shipment.items.length} item)
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
                  <span style={{ fontWeight: 500 }}>{item.productName}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary-500)' }}>
                    {item.sentQty} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className={modalStyles.section}>
            <div className={`${modalStyles.sectionBox} ${modalStyles.addonsSection}`}>
              <h3 className={`${modalStyles.sectionTitle} ${modalStyles.addonsTitle}`}>
                📝 Catatan Pengiriman (Opsional)
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan catatan pengiriman..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={modalStyles.modalFooter}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '⏳ Memproses...' : '🚚 Kirim Pengiriman'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgba(148, 163, 184, 0.2)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
