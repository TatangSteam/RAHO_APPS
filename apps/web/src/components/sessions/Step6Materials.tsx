'use client';

import { useState, useEffect } from 'react';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { inventoryApi, type InventoryItemWithStock } from '@/lib/inventoryApi';
import { materialsApi } from '@/lib/materialsApi';

interface MaterialUsage {
  id: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  recordedBy: string;
  createdAt: string;
  inventoryItem: {
    id: string;
    masterProduct: {
      id: string;
      name: string;
      code: string;
    };
  };
}

interface Step6MaterialsProps {
  sessionId: string;
  materials: MaterialUsage[];
  isLocked: boolean;
  onComplete: () => void;
}

export default function Step6Materials({
  sessionId,
  materials,
  isLocked,
  onComplete,
}: Step6MaterialsProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemWithStock[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInventoryItems();
  }, []);

  const loadInventoryItems = async () => {
    try {
      setLoadingInventory(true);
      // Use getAvailableItems instead to get proper stock info with conversion
      const branchId = user?.branchId;
      if (!branchId) {
        showToast.error('Branch ID tidak ditemukan');
        return;
      }
      const response = await inventoryApi.getAvailableItems(branchId);
      console.log('Loaded inventory items:', response);
      setInventoryItems(response.data);
    } catch (error) {
      console.error('Error loading inventory:', error);
      showToast.error('Gagal memuat data inventory');
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!selectedItemId || !quantity || Number(quantity) <= 0) {
      showToast.error('Pilih item dan masukkan jumlah yang valid');
      return;
    }

    const selectedItem = inventoryItems.find(item => item.id === selectedItemId);
    if (!selectedItem) return;

    setLoading(true);

    try {
      await materialsApi.createMaterial(sessionId, {
        inventoryItemId: selectedItemId,
        quantity: Number(quantity),
        unit: selectedItem.masterProduct.usageUnit,
        recordedBy: user?.userId || '',
      });

      showToast.success('Material berhasil ditambahkan');
      setSelectedItemId('');
      setQuantity('');
      setSearchTerm('');
      // Reload session data to update materials list
      onComplete();
    } catch (error: any) {
      console.error('Error adding material:', error);
      showToast.error(error.message || 'Gagal menambah material');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = inventoryItems.filter(item =>
    item.masterProduct.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLocked) {
    return (
      <div style={{
        padding: '24px',
        background: 'rgba(148,163,184,0.05)',
        border: '2px solid rgba(148,163,184,0.2)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(148,163,184,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontWeight: '700',
            fontSize: '20px'
          }}>
            6
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>
              📦 Material Usage
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Step sebelumnya harus diselesaikan terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasCompletedMaterials = materials.length > 0;

  return (
    <div style={{
      padding: '24px',
      background: hasCompletedMaterials 
        ? 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))'
        : 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
      border: hasCompletedMaterials 
        ? '2px solid rgba(34,197,94,0.3)'
        : '2px solid rgba(59,130,246,0.3)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: hasCompletedMaterials
            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '20px',
          boxShadow: hasCompletedMaterials
            ? '0 4px 12px rgba(34,197,94,0.3)'
            : '0 4px 12px rgba(59,130,246,0.3)'
        }}>
          {hasCompletedMaterials ? '✓' : '6'}
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#f1f5f9' }}>
            📦 Material Usage
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Catat material yang digunakan dalam sesi ini
          </p>
        </div>
      </div>

      {/* Existing Materials */}
      {materials.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#cbd5e1', marginBottom: '12px' }}>
            Material yang Digunakan:
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {materials.map((material) => (
              <div
                key={material.id}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(148,163,184,0.08)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '2px' }}>
                    {material.inventoryItem.masterProduct.name}
                  </p>
                  <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {material.inventoryItem.masterProduct.code}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '16px', fontWeight: '700', color: '#60a5fa' }}>
                    {material.quantity} <span style={{ fontSize: '12px', color: '#94a3b8' }}>{material.unit}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Material Form */}
      <div style={{
        padding: '20px',
        background: 'rgba(15,23,42,0.5)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: 'var(--radius-md)',
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#cbd5e1', marginBottom: '16px' }}>
          Tambah Material:
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '12px', alignItems: 'end' }}>
          {/* Item Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
              Pilih Item
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari material..."
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f1f5f9',
                fontSize: '14px',
                marginBottom: '8px'
              }}
              disabled={loading}
            />
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f1f5f9',
                fontSize: '14px',
              }}
              disabled={loading || loadingInventory}
            >
              <option value="">
                {loadingInventory ? 'Memuat inventory...' : filteredItems.length === 0 ? 'Tidak ada item tersedia' : 'Pilih material...'}
              </option>
              {filteredItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.masterProduct.name} - {item.stockInfo.displayShort}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
              Jumlah
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f1f5f9',
                fontSize: '14px',
              }}
              disabled={loading}
            />
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddMaterial}
            disabled={loading || !selectedItemId || !quantity}
            style={{
              padding: '12px 24px',
              background: loading || !selectedItemId || !quantity
                ? 'rgba(59,130,246,0.3)'
                : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || !selectedItemId || !quantity ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {loading ? '⏳ Menambah...' : '➕ Tambah'}
          </button>
        </div>
      </div>

      {hasCompletedMaterials && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: 'var(--color-success)'
        }}>
          ✓ Material usage telah dicatat. Anda dapat menambah material lain atau klik save untuk melanjutkan.
        </div>
      )}
    </div>
  );
}
