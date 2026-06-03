'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { inventoryApi, type InventoryItemWithStock } from '@/lib/api/inventoryApi';
import { materialsApi } from '@/lib/materialsApi';
import { devError } from '@/lib/logger';

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

// Helper: Categorize material based on name
function categorizeMaterial(name: string): { category: string; icon: string; order: number } {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('ifa') || lowerName.includes('a+mg')) {
    return { category: 'Cairan Infus Utama', icon: '💧', order: 1 };
  }
  if (
    lowerName.includes('hho') ||
    lowerName.includes('h2 ') ||
    lowerName.includes('hydrogen') ||
    lowerName.includes('no ') ||
    lowerName.includes('nitric') ||
    lowerName.includes('o2') ||
    lowerName.includes('o3') ||
    lowerName.includes('ozone') ||
    lowerName.includes('oxygen') ||
    lowerName.includes('gaso') ||
    lowerName.includes('edta') ||
    lowerName.includes('mb ') ||
    lowerName.includes('methylene') ||
    lowerName.includes('h2s') ||
    lowerName.includes('kcl') ||
    lowerName.includes('koktail') ||
    lowerName.includes('jml') ||
    lowerName.includes('nb ')
  ) {
    return { category: 'Booster & Tambahan', icon: '⚡', order: 2 };
  }
  if (
    lowerName.includes('infus set') ||
    lowerName.includes('jarum') ||
    lowerName.includes('syringe') ||
    lowerName.includes('tourniquet') ||
    lowerName.includes('oximeter') ||
    lowerName.includes('tensi') ||
    lowerName.includes('safety box')
  ) {
    return { category: 'Alat Medis', icon: '🩺', order: 3 };
  }
  if (
    lowerName.includes('handscoon') ||
    lowerName.includes('swab') ||
    lowerName.includes('alkohol') ||
    lowerName.includes('plester') ||
    lowerName.includes('plestrin') ||
    lowerName.includes('kapas') ||
    lowerName.includes('kantong') ||
    lowerName.includes('baterai')
  ) {
    return { category: 'Bahan Habis Pakai', icon: '📦', order: 4 };
  }

  return { category: 'Lainnya', icon: '📋', order: 5 };
}

// Helper: Get stock status color and label
function getStockStatus(stock: number, minThreshold: number) {
  if (stock <= 0) {
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Habis', icon: '🔴' };
  }
  if (stock <= minThreshold) {
    return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Stok Rendah', icon: '🟡' };
  }
  return { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Tersedia', icon: '🟢' };
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
  const [selectedItem, setSelectedItem] = useState<InventoryItemWithStock | null>(null);
  const [quantity, setQuantity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInventoryItems();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadInventoryItems = async () => {
    try {
      setLoadingInventory(true);
      const branchId = user?.branchId;
      if (!branchId) {
        showToast.error('Branch ID tidak ditemukan');
        return;
      }
      const response = await inventoryApi.getAvailableItems(branchId);
      // API returns { success: true, data: items }, so we need response.data.data
      setInventoryItems(response.data?.data || response.data || []);
    } catch (error) {
      devError('Error loading inventory:', error);
      showToast.error('Gagal memuat data inventory');
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleAddMaterial = async () => {
    if (!selectedItem || !quantity || Number(quantity) <= 0) {
      showToast.error('Pilih item dan masukkan jumlah yang valid');
      return;
    }

    setLoading(true);

    try {
      await materialsApi.createMaterial(sessionId, {
        inventoryItemId: selectedItem.id,
        quantity: Number(quantity),
        unit: selectedItem.masterProduct.usageUnit,
        recordedBy: user?.userId || '',
      });

      showToast.success('Material berhasil ditambahkan');
      setSelectedItem(null);
      setQuantity('');
      setSearchTerm('');
      onComplete();
    } catch (error: any) {
      devError('Error adding material:', error);
      showToast.error(error.message || 'Gagal menambah material');
    } finally {
      setLoading(false);
    }
  };

  // Group items by category and apply search filter
  const groupedItems = useMemo(() => {
    const filtered = inventoryItems.filter((item) =>
      item.masterProduct.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, { icon: string; order: number; items: InventoryItemWithStock[] }> =
      {};

    filtered.forEach((item) => {
      const { category, icon, order } = categorizeMaterial(item.masterProduct.name);
      if (!groups[category]) {
        groups[category] = { icon, order, items: [] };
      }
      groups[category].items.push(item);
    });

    // Sort categories by order, items by name within category
    return Object.entries(groups)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([name, data]) => ({
        name,
        icon: data.icon,
        items: data.items.sort((a, b) =>
          a.masterProduct.name.localeCompare(b.masterProduct.name)
        ),
      }));
  }, [inventoryItems, searchTerm]);

  const totalFiltered = groupedItems.reduce((sum, g) => sum + g.items.length, 0);

  if (isLocked) {
    return (
      <div
        style={{
          padding: '24px',
          background: 'rgba(148,163,184,0.05)',
          border: '2px solid rgba(148,163,184,0.2)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(148,163,184,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontWeight: '700',
              fontSize: '20px',
            }}
          >
            6
          </div>
          <div>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#94a3b8',
                marginBottom: '4px',
              }}
            >
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
    <div
      style={{
        padding: '24px',
        background: hasCompletedMaterials
          ? 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))'
          : 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
        border: hasCompletedMaterials
          ? '2px solid rgba(34,197,94,0.3)'
          : '2px solid rgba(59,130,246,0.3)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
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
              : '0 4px 12px rgba(59,130,246,0.3)',
          }}
        >
          {hasCompletedMaterials ? '✓' : '6'}
        </div>
        <div>
          <h3
            style={{
              fontSize: '20px',
              fontWeight: '700',
              marginBottom: '4px',
              color: '#f1f5f9',
            }}
          >
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
          <h4
            style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#cbd5e1',
              marginBottom: '12px',
            }}
          >
            Material yang Digunakan ({materials.length}):
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {materials.map((material) => {
              const cat = categorizeMaterial(material.inventoryItem.masterProduct.name);
              return (
                <div
                  key={material.id}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(148,163,184,0.08)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                    <div>
                      <p
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#f1f5f9',
                          marginBottom: '2px',
                        }}
                      >
                        {material.inventoryItem.masterProduct.name}
                      </p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>{cat.category}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '16px', fontWeight: '700', color: '#60a5fa' }}>
                      {material.quantity}{' '}
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{material.unit}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Material Form */}
      <div
        style={{
          padding: '20px',
          background: 'rgba(15,23,42,0.5)',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <h4
          style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#cbd5e1',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>➕</span> Tambah Material
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '12px', alignItems: 'end' }}>
          {/* Custom Dropdown with Search */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#cbd5e1',
                marginBottom: '8px',
              }}
            >
              Pilih Material
            </label>

            {/* Selected/Search Input */}
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={loading || loadingInventory}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(15,23,42,0.7)',
                border: `1px solid ${isDropdownOpen ? '#3b82f6' : 'rgba(148,163,184,0.3)'}`,
                borderRadius: 'var(--radius-md)',
                color: '#f1f5f9',
                fontSize: '14px',
                cursor: loading || loadingInventory ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'left',
                transition: 'border-color 0.2s',
              }}
            >
              {selectedItem ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '18px' }}>
                    {categorizeMaterial(selectedItem.masterProduct.name).icon}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedItem.masterProduct.name}
                  </span>
                </div>
              ) : (
                <span style={{ color: '#64748b' }}>
                  {loadingInventory
                    ? '⏳ Memuat material...'
                    : inventoryItems.length === 0
                    ? '⚠️ Tidak ada material tersedia'
                    : '🔍 Pilih atau cari material...'}
                </span>
              )}
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                {isDropdownOpen ? '▲' : '▼'}
              </span>
            </button>

            {/* Dropdown Panel */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#0f172a',
                  border: '1px solid rgba(148,163,184,0.3)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  zIndex: 100,
                  maxHeight: '420px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Search Box */}
                <div
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid rgba(148,163,184,0.2)',
                  }}
                >
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="🔍 Cari material..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(148,163,184,0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#f1f5f9',
                      fontSize: '14px',
                    }}
                  />
                  {searchTerm && (
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '6px',
                      }}
                    >
                      Ditemukan {totalFiltered} material
                    </p>
                  )}
                </div>

                {/* Grouped Items */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {totalFiltered === 0 ? (
                    <div
                      style={{
                        padding: '32px 16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '14px',
                      }}
                    >
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                      Tidak ada material yang cocok
                    </div>
                  ) : (
                    groupedItems.map((group) => (
                      <div key={group.name}>
                        {/* Category Header */}
                        <div
                          style={{
                            padding: '10px 16px',
                            background: 'rgba(59,130,246,0.1)',
                            borderBottom: '1px solid rgba(148,163,184,0.1)',
                            position: 'sticky',
                            top: 0,
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          <span style={{ fontSize: '16px' }}>{group.icon}</span>
                          <span>{group.name}</span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              padding: '2px 8px',
                              background: 'rgba(59,130,246,0.2)',
                              borderRadius: '12px',
                              color: '#60a5fa',
                            }}
                          >
                            {group.items.length}
                          </span>
                        </div>

                        {/* Items */}
                        {group.items.map((item) => {
                          const stock = Number(item.stockInfo?.usageStock ?? 0);
                          const minThreshold = Number(
                            item.stockInfo?.minThresholdUsage ?? 0
                          );
                          const status = getStockStatus(stock, minThreshold);
                          const isSelected = selectedItem?.id === item.id;
                          const isOutOfStock = stock <= 0;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                if (!isOutOfStock) {
                                  setSelectedItem(item);
                                  setIsDropdownOpen(false);
                                  setSearchTerm('');
                                }
                              }}
                              disabled={isOutOfStock}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: isSelected
                                  ? 'rgba(59,130,246,0.15)'
                                  : 'transparent',
                                border: 'none',
                                borderBottom: '1px solid rgba(148,163,184,0.08)',
                                color: '#f1f5f9',
                                fontSize: '14px',
                                cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                opacity: isOutOfStock ? 0.5 : 1,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'background 0.15s',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                if (!isOutOfStock && !isSelected) {
                                  e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#f1f5f9',
                                    marginBottom: '4px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.masterProduct.name}
                                </p>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '12px',
                                  }}
                                >
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      background: status.bg,
                                      color: status.color,
                                      borderRadius: '4px',
                                      fontWeight: '600',
                                    }}
                                  >
                                    {status.icon} {stock.toFixed(0)}{' '}
                                    {item.masterProduct.usageUnit}
                                  </span>
                                  {item.stockInfo?.baseStock != null && (
                                    <span style={{ color: '#64748b' }}>
                                      ({Number(item.stockInfo.baseStock).toFixed(2)}{' '}
                                      {item.masterProduct.baseUnit})
                                    </span>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <span
                                  style={{
                                    color: '#3b82f6',
                                    fontSize: '18px',
                                    fontWeight: '700',
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '700',
                color: '#cbd5e1',
                marginBottom: '8px',
              }}
            >
              Jumlah {selectedItem && `(${selectedItem.masterProduct.usageUnit})`}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
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
              disabled={loading || !selectedItem}
            />
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddMaterial}
            disabled={loading || !selectedItem || !quantity}
            style={{
              padding: '12px 24px',
              background:
                loading || !selectedItem || !quantity
                  ? 'rgba(59,130,246,0.3)'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || !selectedItem || !quantity ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Menambah...' : '➕ Tambah'}
          </button>
        </div>

        {/* Selected Item Info */}
        {selectedItem && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>ℹ️</span>
            <span>
              Stok tersedia:{' '}
              <strong style={{ color: '#60a5fa' }}>
                {Number(selectedItem.stockInfo?.usageStock ?? 0).toFixed(0)}{' '}
                {selectedItem.masterProduct.usageUnit}
              </strong>
            </span>
          </div>
        )}
      </div>

      {hasCompletedMaterials && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: 'var(--color-success)',
          }}
        >
          ✓ Material usage telah dicatat. Anda dapat menambah material lain atau klik save untuk
          melanjutkan.
        </div>
      )}
    </div>
  );
}
