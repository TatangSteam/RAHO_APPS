'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, Search, Loader2, Check, CheckSquare, Square, Layers, Save } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import styles from '@/styles/crud-modal.module.css';

interface InventoryBatchAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
  existingProductIds?: string[]; // IDs of products already in inventory
}

interface MasterProduct {
  id: string;
  name: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  description?: string;
}

interface SelectedProduct extends MasterProduct {
  stock: number;
  minThreshold: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  'INFUSION_MATERIAL': 'Bahan Infus',
  'MEDICAL_EQUIPMENT': 'Alat Medis',
  'CONSUMABLES': 'Bahan Habis Pakai',
  'MEDICATION': 'Obat-obatan',
  'SUPPLEMENTS': 'Suplemen',
  'MEDICINE': 'Obat & Cairan',
  'DEVICE': 'Alat Medis',
  'CONSUMABLE': 'Bahan Habis Pakai',
  'OTHER': 'Lainnya'
};

const CATEGORY_COLORS: Record<string, string> = {
  'INFUSION_MATERIAL': '#3b82f6',
  'MEDICAL_EQUIPMENT': '#8b5cf6',
  'CONSUMABLES': '#f59e0b',
  'MEDICATION': '#ef4444',
  'SUPPLEMENTS': '#22c55e',
  'MEDICINE': '#3b82f6',
  'DEVICE': '#8b5cf6',
  'CONSUMABLE': '#f59e0b',
  'OTHER': '#6b7280'
};

export default function InventoryBatchAddModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
  existingProductIds = []
}: InventoryBatchAddModalProps) {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<Map<string, SelectedProduct>>(new Map());
  const [defaultStock, setDefaultStock] = useState(0);
  const [defaultMinThreshold, setDefaultMinThreshold] = useState(10);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadMasterProducts();
      // Reset selections when modal opens
      setSelectedProducts(new Map());
      setSearchQuery('');
      setSelectedCategory('');
    }
  }, [isOpen]);

  const loadMasterProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await api.get('/inventory/master-products', {
        params: { limit: 1000, isActive: 'true' }
      });
      
      const data = response.data.data;
      const products = data?.products || data || [];
      
      setMasterProducts(Array.isArray(products) ? products : []);
    } catch (error: any) {
      devError('Error loading master products:', error);
      showToast.error('Gagal memuat daftar produk');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Get unique categories from products
  const categories = useMemo(() => {
    const cats = new Set(masterProducts.map(p => p.category));
    return Array.from(cats).sort();
  }, [masterProducts]);

  // Filter products - exclude already existing ones
  const availableProducts = useMemo(() => {
    return masterProducts.filter(product => !existingProductIds.includes(product.id));
  }, [masterProducts, existingProductIds]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return availableProducts.filter(product => {
      const matchesSearch = !searchQuery || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [availableProducts, searchQuery, selectedCategory]);

  // Group products by category for display
  const groupedProducts = useMemo(() => {
    const groups: Record<string, MasterProduct[]> = {};
    filteredProducts.forEach(product => {
      if (!groups[product.category]) {
        groups[product.category] = [];
      }
      groups[product.category].push(product);
    });
    return groups;
  }, [filteredProducts]);

  const toggleProductSelection = (product: MasterProduct) => {
    const newSelected = new Map(selectedProducts);
    if (newSelected.has(product.id)) {
      newSelected.delete(product.id);
    } else {
      newSelected.set(product.id, {
        ...product,
        stock: defaultStock,
        minThreshold: defaultMinThreshold
      });
    }
    setSelectedProducts(newSelected);
  };

  const selectAllFiltered = () => {
    const newSelected = new Map(selectedProducts);
    filteredProducts.forEach(product => {
      if (!newSelected.has(product.id)) {
        newSelected.set(product.id, {
          ...product,
          stock: defaultStock,
          minThreshold: defaultMinThreshold
        });
      }
    });
    setSelectedProducts(newSelected);
  };

  const deselectAllFiltered = () => {
    const newSelected = new Map(selectedProducts);
    filteredProducts.forEach(product => {
      newSelected.delete(product.id);
    });
    setSelectedProducts(newSelected);
  };

  const selectByCategory = (category: string) => {
    const newSelected = new Map(selectedProducts);
    availableProducts
      .filter(p => p.category === category)
      .forEach(product => {
        if (!newSelected.has(product.id)) {
          newSelected.set(product.id, {
            ...product,
            stock: defaultStock,
            minThreshold: defaultMinThreshold
          });
        }
      });
    setSelectedProducts(newSelected);
  };

  const updateProductStock = (productId: string, stock: number) => {
    const newSelected = new Map(selectedProducts);
    const product = newSelected.get(productId);
    if (product) {
      newSelected.set(productId, { ...product, stock });
      setSelectedProducts(newSelected);
    }
  };

  const updateProductMinThreshold = (productId: string, minThreshold: number) => {
    const newSelected = new Map(selectedProducts);
    const product = newSelected.get(productId);
    if (product) {
      newSelected.set(productId, { ...product, minThreshold });
      setSelectedProducts(newSelected);
    }
  };

  const applyDefaultsToAll = () => {
    const newSelected = new Map(selectedProducts);
    newSelected.forEach((product, id) => {
      newSelected.set(id, {
        ...product,
        stock: defaultStock,
        minThreshold: defaultMinThreshold
      });
    });
    setSelectedProducts(newSelected);
  };

  const handleSubmit = async () => {
    if (selectedProducts.size === 0) {
      showToast.error('Pilih minimal satu produk');
      return;
    }

    setLoading(true);

    try {
      const items = Array.from(selectedProducts.values()).map(product => ({
        masterProductId: product.id,
        stock: product.stock,
        minThreshold: product.minThreshold
      }));

      const response = await api.post('/inventory/items/batch', {
        branchId,
        items
      });

      const result = response.data.data;
      showToast.success(`Berhasil menambahkan ${result.created} item inventori`);
      
      if (result.skipped > 0) {
        showToast.success(`${result.skipped} item dilewati (sudah ada)`);
      }
      
      onSuccess();
    } catch (error: any) {
      devError('Error batch adding inventory items:', error);
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Gagal menambahkan item inventori';
      showToast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const isAllFilteredSelected = filteredProducts.length > 0 && 
    filteredProducts.every(p => selectedProducts.has(p.id));

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div 
      className={styles.modalOverlay} 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)'
      }}
    >
      <div 
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 10000,
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Layers size={24} />
            <h2>Tambah Item Batch</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Default Settings */}
          <div style={{
            padding: '16px 24px',
            background: 'var(--surface-secondary)',
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-end',
            flexWrap: 'wrap'
          }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Stok Awal Default
              </label>
              <input
                type="number"
                value={defaultStock}
                onChange={(e) => setDefaultStock(parseInt(e.target.value) || 0)}
                min="0"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '6px',
                  background: 'var(--surface-card)',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Min. Stok Default
              </label>
              <input
                type="number"
                value={defaultMinThreshold}
                onChange={(e) => setDefaultMinThreshold(parseInt(e.target.value) || 0)}
                min="0"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '6px',
                  background: 'var(--surface-card)',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>
            <button
              type="button"
              onClick={applyDefaultsToAll}
              disabled={selectedProducts.size === 0}
              style={{
                padding: '8px 16px',
                background: selectedProducts.size > 0 ? 'var(--primary)' : 'var(--surface-border)',
                color: selectedProducts.size > 0 ? 'white' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                cursor: selectedProducts.size > 0 ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Terapkan ke Semua
            </button>
          </div>

          {/* Search and Filter */}
          <div style={{ 
            padding: '12px 24px', 
            borderBottom: '1px solid var(--surface-border)',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <div style={{ 
              flex: 1,
              minWidth: '200px',
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              padding: '8px 12px',
              background: 'var(--surface-secondary)',
              borderRadius: '8px'
            }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--surface-secondary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="">Semua Kategori</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={isAllFilteredSelected ? deselectAllFiltered : selectAllFiltered}
              style={{
                padding: '8px 16px',
                background: 'var(--surface-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--surface-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isAllFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              {isAllFilteredSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
            </button>
          </div>

          {/* Stats Bar */}
          <div style={{
            padding: '8px 24px',
            background: 'var(--surface-secondary)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>
              Menampilkan {filteredProducts.length} dari {availableProducts.length} produk tersedia
              {existingProductIds.length > 0 && ` (${existingProductIds.length} sudah ada di inventori)`}
            </span>
            <span style={{ 
              color: selectedProducts.size > 0 ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 600
            }}>
              {selectedProducts.size} dipilih
            </span>
          </div>

          {/* Product List */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
            {loadingProducts ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                <div>Memuat produk...</div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <div>{searchQuery || selectedCategory ? 'Tidak ada produk yang cocok' : 'Semua produk sudah ada di inventori'}</div>
              </div>
            ) : (
              Object.entries(groupedProducts).map(([category, products]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div style={{
                    padding: '10px 24px',
                    background: 'var(--surface-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: CATEGORY_COLORS[category] || 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{CATEGORY_LABELS[category] || category} ({products.length})</span>
                    <button
                      type="button"
                      onClick={() => selectByCategory(category)}
                      style={{
                        padding: '4px 10px',
                        background: 'transparent',
                        color: CATEGORY_COLORS[category] || 'var(--text-muted)',
                        border: `1px solid ${CATEGORY_COLORS[category] || 'var(--surface-border)'}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 500
                      }}
                    >
                      Pilih Semua
                    </button>
                  </div>
                  
                  {/* Products in Category */}
                  {products.map(product => {
                    const isSelected = selectedProducts.has(product.id);
                    const selectedData = selectedProducts.get(product.id);
                    
                    return (
                      <div
                        key={product.id}
                        style={{
                          padding: '12px 24px',
                          borderBottom: '1px solid var(--surface-border)',
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        {/* Checkbox */}
                        <div
                          onClick={() => toggleProductSelection(product)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--surface-border)'}`,
                            background: isSelected ? 'var(--primary)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          {isSelected && <Check size={14} style={{ color: 'white' }} />}
                        </div>

                        {/* Product Info */}
                        <div 
                          onClick={() => toggleProductSelection(product)}
                          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                        >
                          <div style={{ 
                            fontWeight: 500, 
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {product.name}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: 'var(--text-muted)',
                            marginTop: '2px'
                          }}>
                            {product.baseUnit} → {product.usageUnit} • Konversi: {product.conversionFactor}
                          </div>
                        </div>

                        {/* Stock Input (only when selected) */}
                        {isSelected && selectedData && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                                Stok
                              </label>
                              <input
                                type="number"
                                value={selectedData.stock}
                                onChange={(e) => updateProductStock(product.id, parseInt(e.target.value) || 0)}
                                min="0"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '70px',
                                  padding: '4px 8px',
                                  border: '1px solid var(--surface-border)',
                                  borderRadius: '4px',
                                  background: 'var(--surface-card)',
                                  color: 'var(--text-primary)',
                                  fontSize: '13px',
                                  textAlign: 'center'
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                                Min
                              </label>
                              <input
                                type="number"
                                value={selectedData.minThreshold}
                                onChange={(e) => updateProductMinThreshold(product.id, parseInt(e.target.value) || 0)}
                                min="0"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '70px',
                                  padding: '4px 8px',
                                  border: '1px solid var(--surface-border)',
                                  borderRadius: '4px',
                                  background: 'var(--surface-card)',
                                  color: 'var(--text-primary)',
                                  fontSize: '13px',
                                  textAlign: 'center'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface-card)'
        }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            {selectedProducts.size > 0 ? (
              <span>
                <strong style={{ color: 'var(--primary)' }}>{selectedProducts.size}</strong> produk akan ditambahkan
              </span>
            ) : (
              <span>Pilih produk untuk ditambahkan ke inventori</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSubmit}
              disabled={loading || selectedProducts.size === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Tambah {selectedProducts.size} Item
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
