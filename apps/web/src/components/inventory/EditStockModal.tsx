'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect } from 'react';
import { devLog, devError } from '@/lib/logger';

interface InventoryItem {
  id: string;
  masterProductId: string;
  masterProduct: {
    name: string;
    conversionFactor: number;
  };
  stockInfo: {
    baseStock: number;
    baseUnit: string;
    usageStock: number;
    usageUnit: string;
  };
}

interface EditStockModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (data: { adjustment: number; reason: string; conversionFactor?: number }) => Promise<void>;
}

export default function EditStockModal({ isOpen, item, onClose, onSave }: EditStockModalProps) {
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [conversionFactor, setConversionFactor] = useState('');
  const [saving, setSaving] = useState(false);

  devLog('EditStockModal render:', { isOpen, hasItem: !!item, itemName: item?.masterProduct?.name });

  useEffect(() => {
    if (item) {
      setConversionFactor(item.masterProduct.conversionFactor.toString());
    }
  }, [item]);

  if (!isOpen || !item) {
    devLog('Modal not rendering because:', { isOpen, hasItem: !!item });
    return null;
  }

  devLog('Modal SHOULD be visible now!');

  const handleSave = async () => {
    const adjustmentNum = parseFloat(adjustment);
    const conversionFactorNum = parseFloat(conversionFactor);
    
    if (isNaN(adjustmentNum) || adjustmentNum === 0) {
      alert('Masukkan jumlah penyesuaian yang valid');
      return;
    }

    if (!reason.trim()) {
      alert('Alasan penyesuaian harus diisi');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        adjustment: adjustmentNum,
        reason: reason.trim(),
        conversionFactor: conversionFactorNum !== item.masterProduct.conversionFactor ? conversionFactorNum : undefined,
      });
      setAdjustment('');
      setReason('');
      onClose();
    } catch (error) {
      assertCaughtError(error);
      devError('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#1e293b',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    flex: 1,
  };

  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
            Edit Stok - {item.masterProduct.name}
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#64748b'
            }}
          >
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Current Stock */}
          <div style={{ padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px' }}>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', margin: 0 }}>Stok Saat Ini:</p>
            <p style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
              {item.stockInfo.baseStock.toFixed(2)} {item.stockInfo.baseUnit}
              <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: '8px', fontWeight: 'normal' }}>
                ({item.stockInfo.usageStock.toFixed(0)} {item.stockInfo.usageUnit})
              </span>
            </p>
          </div>

          {/* Conversion Factor */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>
              Konversi (1 {item.stockInfo.baseUnit} = ? {item.stockInfo.usageUnit})
            </label>
            <input
              type="number"
              step="1"
              value={conversionFactor}
              onChange={(e) => setConversionFactor(e.target.value)}
              placeholder={`Contoh: ${item.masterProduct.conversionFactor}`}
              style={inputStyle}
              disabled={saving}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', margin: '4px 0 0 0' }}>
              Saat ini: 1 {item.stockInfo.baseUnit} = {item.masterProduct.conversionFactor} {item.stockInfo.usageUnit}
            </p>
          </div>

          {/* Adjustment */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>
              Penyesuaian Stok ({item.stockInfo.baseUnit}) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="Contoh: 10 untuk tambah, -5 untuk kurang"
              style={inputStyle}
              disabled={saving}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', margin: '4px 0 0 0' }}>
              Gunakan angka positif untuk menambah, negatif untuk mengurangi
            </p>
          </div>

          {/* Preview */}
          {adjustment && !isNaN(parseFloat(adjustment)) && (
            <div style={{ padding: '16px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px' }}>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', margin: 0 }}>Stok Setelah Penyesuaian:</p>
              <p style={{ fontSize: '20px', fontWeight: '600', color: '#22c55e', margin: 0 }}>
                {(item.stockInfo.baseStock + parseFloat(adjustment)).toFixed(2)} {item.stockInfo.baseUnit}
                <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: '8px', fontWeight: 'normal' }}>
                  ({((item.stockInfo.baseStock + parseFloat(adjustment)) * (parseFloat(conversionFactor) || item.masterProduct.conversionFactor)).toFixed(0)} {item.stockInfo.usageUnit})
                </span>
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>
              Catatan / Alasan Penyesuaian <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Koreksi stok fisik, Barang rusak, Stok opname, dll"
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              disabled={saving}
            />
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', margin: '4px 0 0 0' }}>
              Catatan ini akan tersimpan di riwayat mutasi stok
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                ...buttonStyle,
                backgroundColor: '#f1f5f9',
                color: '#475569'
              }}
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !adjustment || !reason.trim()}
              style={{
                ...buttonStyle,
                backgroundColor: saving || !adjustment || !reason.trim() ? '#cbd5e1' : '#3b82f6',
                color: 'white'
              }}
            >
              {saving ? 'Menyimpan...' : 'Simpan Penyesuaian'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
