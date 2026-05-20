'use client';

import { useState, useEffect } from 'react';
import { Shipment, ReceiveShipmentInput } from '@/lib/api/inventoryApi';
import modalStyles from '@/components/members/AssignPackageModal.module.css';

type DiscrepancyType = 'SHORTAGE' | 'DAMAGE' | 'WRONG_ITEM' | 'OTHER';

interface ReceiveModalProps {
  shipment: Shipment;
  onClose: () => void;
  onReceive: (input: ReceiveShipmentInput) => Promise<void>;
  loading: boolean;
}

export default function ReceiveModal({ shipment, onClose, onReceive, loading }: ReceiveModalProps) {
  const [notes, setNotes] = useState('');
  const [receivedItems, setReceivedItems] = useState<Array<{ masterProductId: string; receivedQty: number }>>([]);
  const [discrepancies, setDiscrepancies] = useState<Array<{
    masterProductId: string;
    expectedQty: number;
    receivedQty: number;
    discrepancyType: DiscrepancyType;
    notes: string;
  }>>([]);
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);

  // Initialize received items
  useEffect(() => {
    setReceivedItems(
      shipment.items.map(item => ({
        masterProductId: item.masterProductId,
        receivedQty: item.sentQty,
      }))
    );
    setDiscrepancies([]);
    setHasDiscrepancy(false);
  }, [shipment]);

  const updateReceivedQty = (masterProductId: string, qty: number) => {
    setReceivedItems(prev => 
      prev.map(item => 
        item.masterProductId === masterProductId 
          ? { ...item, receivedQty: qty }
          : item
      )
    );

    const originalItem = shipment.items.find(i => i.masterProductId === masterProductId);
    if (originalItem && qty !== originalItem.sentQty) {
      // Add or update discrepancy
      setDiscrepancies(prev => {
        const existing = prev.find(d => d.masterProductId === masterProductId);
        if (existing) {
          return prev.map(d => 
            d.masterProductId === masterProductId 
              ? { ...d, receivedQty: qty }
              : d
          );
        } else {
          return [...prev, {
            masterProductId,
            expectedQty: originalItem.sentQty,
            receivedQty: qty,
            discrepancyType: 'SHORTAGE' as DiscrepancyType,
            notes: '',
          }];
        }
      });
      setHasDiscrepancy(true);
    } else {
      // Remove discrepancy if qty matches
      const newDiscrepancies = discrepancies.filter(d => d.masterProductId !== masterProductId);
      setDiscrepancies(newDiscrepancies);
      setHasDiscrepancy(newDiscrepancies.length > 0);
    }
  };

  const updateDiscrepancy = (masterProductId: string, field: string, value: any) => {
    setDiscrepancies(prev => 
      prev.map(d => 
        d.masterProductId === masterProductId 
          ? { ...d, [field]: value }
          : d
      )
    );
  };

  const handleSubmit = async () => {
    const input: ReceiveShipmentInput = {
      receivedItems,
      notes: notes || undefined,
    };

    if (hasDiscrepancy && discrepancies.length > 0) {
      input.discrepancies = discrepancies.filter(d => d.discrepancyType);
    }

    await onReceive(input);
  };

  return (
    <div className={modalStyles.modalBackdrop} onClick={onClose}>
      <div className={modalStyles.modalContainer} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
        {/* Header */}
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.modalTitle}>📥 Terima Pengiriman</h2>
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
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  color: '#3b82f6',
                }}>
                  🚚 SHIPPED
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className={modalStyles.section}>
            <div className={`${modalStyles.sectionBox} ${modalStyles.basicSection}`}>
              <h3 className={`${modalStyles.sectionTitle} ${modalStyles.basicTitle}`}>
                📦 Konfirmasi Jumlah Diterima ({shipment.items.length} item)
              </h3>
              
              {shipment.items.map((item, index) => {
                const receivedItem = receivedItems.find(r => r.masterProductId === item.masterProductId);
                const hasIssue = receivedItem && receivedItem.receivedQty !== item.sentQty;
                
                return (
                  <div 
                    key={item.id} 
                    style={{ 
                      padding: '14px',
                      backgroundColor: hasIssue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                      border: hasIssue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
                      borderRadius: '8px',
                      marginBottom: index < shipment.items.length - 1 ? '10px' : '0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.productName}</span>
                      <span style={{ color: 'rgba(148, 163, 184, 0.8)', fontSize: '0.875rem' }}>
                        Dikirim: {item.sentQty} {item.unit}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{ fontSize: '0.875rem', color: 'rgba(148, 163, 184, 0.8)', minWidth: '70px' }}>Diterima:</label>
                      <input
                        type="number"
                        min="0"
                        value={receivedItem?.receivedQty || 0}
                        onChange={(e) => updateReceivedQty(item.masterProductId, Number(e.target.value))}
                        style={{
                          width: '100px',
                          padding: '8px 12px',
                          border: hasIssue ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)',
                          borderRadius: '6px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                        }}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'rgba(148, 163, 184, 0.8)' }}>{item.unit}</span>
                      {hasIssue && (
                        <span style={{ 
                          color: '#ef4444', 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          ⚠️ Tidak sesuai
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discrepancy Details */}
          {hasDiscrepancy && discrepancies.length > 0 && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox}`} style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}>
                <h3 className={modalStyles.sectionTitle} style={{ color: '#ef4444' }}>
                  ⚠️ Detail Ketidaksesuaian
                </h3>
                
                {discrepancies.map((d, index) => {
                  const item = shipment.items.find(i => i.masterProductId === d.masterProductId);
                  return (
                    <div 
                      key={d.masterProductId} 
                      style={{ 
                        padding: '12px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '8px',
                        marginBottom: index < discrepancies.length - 1 ? '10px' : '0',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                        {item?.productName}
                        <span style={{ fontWeight: 400, color: 'rgba(148, 163, 184, 0.8)', marginLeft: '8px', fontSize: '0.875rem' }}>
                          (Dikirim: {d.expectedQty}, Diterima: {d.receivedQty})
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <select
                          value={d.discrepancyType}
                          onChange={(e) => updateDiscrepancy(d.masterProductId, 'discrepancyType', e.target.value)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            background: 'rgba(0, 0, 0, 0.2)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <option value="SHORTAGE">Kurang</option>
                          <option value="DAMAGE">Rusak</option>
                          <option value="WRONG_ITEM">Salah Item</option>
                          <option value="OTHER">Lainnya</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={d.notes}
                        onChange={(e) => updateDiscrepancy(d.masterProductId, 'notes', e.target.value)}
                        placeholder="Catatan ketidaksesuaian..."
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className={modalStyles.section}>
            <div className={`${modalStyles.sectionBox} ${modalStyles.addonsSection}`}>
              <h3 className={`${modalStyles.sectionTitle} ${modalStyles.addonsTitle}`}>
                📝 Catatan Penerimaan (Opsional)
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan catatan penerimaan..."
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
              backgroundColor: hasDiscrepancy ? '#f59e0b' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
              boxShadow: hasDiscrepancy 
                ? '0 4px 15px rgba(245, 158, 11, 0.3)' 
                : '0 4px 15px rgba(34, 197, 94, 0.3)',
            }}
          >
            {loading ? '⏳ Memproses...' : hasDiscrepancy ? '⚠️ Terima dengan Catatan' : '✅ Terima Pengiriman'}
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
