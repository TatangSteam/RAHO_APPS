'use client';

import { useState, useEffect, useMemo } from 'react';
import { Package, Hash, MapPin, AlertTriangle, Save, Loader2, Search, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { devLog, devError } from '@/lib/logger';
import { CrudModal } from './CrudModal';
import styles from '@/styles/crud-modal.module.css';

interface InventoryCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'create' | 'edit' | 'delete';
  branchId: string;
  inventoryData?: any;
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

interface InventoryFormData {
  masterProductId: string;
  stock: number;
  usageStock: number;
  minThreshold: number;
  minThresholdUsage: number;
  storageLocation: string;
}

interface EditFormData {
  name: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  stock: number;
  usageStock: number;
  minThreshold: number;
  minThresholdUsage: number;
  storageLocation: string;
  conversionFactor: number;
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

export default function InventoryCrudModal({
  isOpen,
  onClose,
  onSuccess,
  action,
  branchId,
  inventoryData,
  existingProductIds = []
}: InventoryCrudModalProps) {
  const [loading, setLoading] = useState(false);
  const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Unit mode for edit: 'base' (e.g., botol) or 'usage' (e.g., ml)
  const [stockUnitMode, setStockUnitMode] = useState<'base' | 'usage'>('base');
  const [thresholdUnitMode, setThresholdUnitMode] = useState<'base' | 'usage'>('base');
  
  const [formData, setFormData] = useState<InventoryFormData>({
    masterProductId: '',
    stock: 0,
    usageStock: 0,
    minThreshold: 10,
    minThresholdUsage: 10,
    storageLocation: ''
  });

  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: '',
    category: 'INFUSION_MATERIAL',
    baseUnit: 'PCS',
    usageUnit: 'PCS',
    stock: 0,
    usageStock: 0,
    minThreshold: 10,
    minThresholdUsage: 10,
    storageLocation: '',
    conversionFactor: 1
  });

  useEffect(() => {
    if (isOpen && action === 'create') {
      loadMasterProducts();
    }
  }, [isOpen, action]);

  useEffect(() => {
    if (action === 'edit' && inventoryData) {
      setEditFormData({
        name: inventoryData.name || '',
        category: inventoryData.category || 'INFUSION_MATERIAL',
        baseUnit: inventoryData.baseUnit || 'PCS',
        usageUnit: inventoryData.usageUnit || 'PCS',
        stock: inventoryData.stock || 0,
        usageStock: inventoryData.usageStock || 0,
        minThreshold: inventoryData.minThreshold || 10,
        minThresholdUsage: inventoryData.minThresholdUsage || 10,
        storageLocation: inventoryData.storageLocation || '',
        conversionFactor: inventoryData.conversionFactor || 1
      });
    }
  }, [action, inventoryData]);

  const loadMasterProducts = async () => {
    try {
      setLoadingProducts(true);
      // Load all active products from inventory endpoint (accessible by ADMIN_ROLES)
      const response = await api.get('/inventory/master-products', {
        params: { limit: 1000, isActive: 'true' }
      });
      
      devLog('🔍 [InventoryModal] Master products response:', response.data);
      
      const data = response.data.data;
      const products = data?.products || data || [];
      
      devLog('🔍 [InventoryModal] Products loaded:', products.length);
      
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

  // Get available products (excluding already added ones)
  const availableProducts = useMemo(() => {
    return masterProducts.filter(product => !existingProductIds.includes(product.id));
  }, [masterProducts, existingProductIds]);

  // Filter products based on search and category, excluding already added products
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

  const handleProductSelect = (product: MasterProduct) => {
    setSelectedProduct(product);
    setFormData(prev => ({
      ...prev,
      masterProductId: product.id
    }));
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (action === 'create') {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
      }));
    } else {
      setEditFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
      }));
    }
  };

  // Handle stock change with unit conversion
  const handleStockChange = (value: number, mode: 'base' | 'usage') => {
    const conversionFactor = editFormData.conversionFactor;
    
    if (mode === 'base') {
      // Input is in base unit (e.g., botol), calculate usage stock
      setEditFormData(prev => ({
        ...prev,
        stock: value,
        usageStock: value * conversionFactor
      }));
    } else {
      // Input is in usage unit (e.g., ml), calculate base stock
      const baseStock = value / conversionFactor;
      setEditFormData(prev => ({
        ...prev,
        stock: baseStock,
        usageStock: value
      }));
    }
  };

  // Handle threshold change with unit conversion
  const handleThresholdChange = (value: number, mode: 'base' | 'usage') => {
    const conversionFactor = editFormData.conversionFactor;
    
    if (mode === 'base') {
      // Input is in base unit (e.g., botol), calculate usage threshold
      setEditFormData(prev => ({
        ...prev,
        minThreshold: value,
        minThresholdUsage: value * conversionFactor
      }));
    } else {
      // Input is in usage unit (e.g., ml), calculate base threshold
      const baseThreshold = value / conversionFactor;
      setEditFormData(prev => ({
        ...prev,
        minThreshold: baseThreshold,
        minThresholdUsage: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (action === 'create') {
        if (!formData.masterProductId) {
          showToast.error('Pilih produk terlebih dahulu');
          setLoading(false);
          return;
        }

        const createData = {
          masterProductId: formData.masterProductId,
          branchId: branchId,
          stock: formData.stock,
          usageStock: formData.usageStock,
          minThreshold: formData.minThreshold,
          minThresholdUsage: formData.minThresholdUsage,
          storageLocation: formData.storageLocation || null
        };
        
        await api.post('/inventory/items', createData);
        showToast.success('Item inventori berhasil ditambahkan');
      } else if (action === 'edit') {
        const updateData = {
          stock: editFormData.stock,
          usageStock: editFormData.usageStock,
          minThreshold: editFormData.minThreshold,
          minThresholdUsage: editFormData.minThresholdUsage,
          storageLocation: editFormData.storageLocation || null
        };
        
        await api.patch(`/inventory/items/${inventoryData.id}`, updateData);
        showToast.success('Item inventori berhasil diperbarui');
      }
      
      onSuccess();
    } catch (error: any) {
      devError('Error saving inventory item:', error);
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || `Gagal ${action === 'create' ? 'menambahkan' : 'memperbarui'} item inventori`;
      showToast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <CrudModal
      contentStyle={{
        maxWidth: action === 'create' ? '750px' : '600px',
        overflow: 'auto',
      }}
      icon={<Package size={24} />}
      open={isOpen}
      title={action === 'create' ? 'Tambah Item Inventori' : 'Edit Item Inventori'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className={styles.modalForm}>
          {action === 'create' ? (
            <>
              {/* Product Selection - Improved UI */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginBottom: '12px', 
                  fontWeight: 600,
                  fontSize: '14px'
                }}>
                  <Package size={16} />
                  Pilih Produk dari Master *
                </label>
                
                {/* Selected Product Display or Dropdown Trigger */}
                <div 
                  onClick={() => setShowDropdown(!showDropdown)}
                  style={{
                    padding: '12px 16px',
                    background: selectedProduct ? 'rgba(34, 197, 94, 0.1)' : 'var(--surface-card)',
                    border: `2px solid ${selectedProduct ? 'rgba(34, 197, 94, 0.5)' : 'var(--surface-border)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s'
                  }}
                >
                  {selectedProduct ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: `${CATEGORY_COLORS[selectedProduct.category] || '#6b7280'}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Check size={18} style={{ color: '#22c55e' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {selectedProduct.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {CATEGORY_LABELS[selectedProduct.category] || selectedProduct.category} • 
                          {selectedProduct.baseUnit} → {selectedProduct.usageUnit} • 
                          Konversi: {selectedProduct.conversionFactor}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>
                      Klik untuk memilih produk...
                    </span>
                  )}
                  <ChevronDown 
                    size={20} 
                    style={{ 
                      color: 'var(--text-muted)',
                      transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }} 
                  />
                </div>

                {/* Dropdown Panel */}
                {showDropdown && (
                  <div style={{
                    marginTop: '8px',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                  }}>
                    {/* Search and Filter */}
                    <div style={{ 
                      padding: '12px', 
                      borderBottom: '1px solid var(--surface-border)',
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap'
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
                          onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
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
                    </div>

                    {/* Product Count */}
                    <div style={{
                      padding: '8px 16px',
                      background: 'var(--surface-secondary)',
                      fontSize: '12px',
                      color: 'var(--text-muted)'
                    }}>
                      Menampilkan {filteredProducts.length} dari {availableProducts.length} produk tersedia
                      {existingProductIds.length > 0 && ` (${existingProductIds.length} sudah ada di inventori)`}
                    </div>

                    {/* Product List */}
                    <div style={{
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {loadingProducts ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                          <div>Memuat produk...</div>
                        </div>
                      ) : filteredProducts.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <Package size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                          <div>{searchQuery || selectedCategory ? 'Tidak ada produk yang cocok' : 'Tidak ada produk tersedia'}</div>
                        </div>
                      ) : (
                        Object.entries(groupedProducts).map(([category, products]) => (
                          <div key={category}>
                            {/* Category Header */}
                            <div style={{
                              padding: '8px 16px',
                              background: 'var(--surface-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: CATEGORY_COLORS[category] || 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              position: 'sticky',
                              top: 0,
                              zIndex: 1
                            }}>
                              {CATEGORY_LABELS[category] || category} ({products.length})
                            </div>
                            
                            {/* Products in Category */}
                            {products.map(product => (
                              <div
                                key={product.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProductSelect(product);
                                }}
                                style={{
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--surface-border)',
                                  background: selectedProduct?.id === product.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedProduct?.id !== product.id) {
                                    e.currentTarget.style.background = 'var(--surface-hover)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedProduct?.id !== product.id) {
                                    e.currentTarget.style.background = 'transparent';
                                  }
                                }}
                              >
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '6px',
                                  background: `${CATEGORY_COLORS[product.category] || '#6b7280'}15`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <Package size={16} style={{ color: CATEGORY_COLORS[product.category] || '#6b7280' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
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
                                {selectedProduct?.id === product.id && (
                                  <Check size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                                )}
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Settings - Only show when product is selected */}
              {selectedProduct && (
                <div style={{
                  padding: '16px',
                  background: 'var(--surface-secondary)',
                  borderRadius: '10px',
                  marginBottom: '16px'
                }}>
                  <h4 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: '14px', 
                    fontWeight: 600,
                    color: 'var(--text-primary)'
                  }}>
                    Pengaturan Stok untuk {selectedProduct.name}
                  </h4>
                  
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="storageLocation">
                        <MapPin size={16} />
                        Lokasi Penyimpanan
                      </label>
                      <input
                        type="text"
                        id="storageLocation"
                        name="storageLocation"
                        value={formData.storageLocation}
                        onChange={handleInputChange}
                        placeholder="Rak A1, Lemari B2, dll"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="stock">
                        Stok Awal ({selectedProduct.baseUnit})
                      </label>
                      <input
                        type="number"
                        id="stock"
                        name="stock"
                        value={formData.stock}
                        onChange={handleInputChange}
                        min="0"
                        placeholder="0"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="minThreshold">
                        <AlertTriangle size={16} />
                        Min. Stok ({selectedProduct.baseUnit})
                      </label>
                      <input
                        type="number"
                        id="minThreshold"
                        name="minThreshold"
                        value={formData.minThreshold}
                        onChange={handleInputChange}
                        min="0"
                        placeholder="10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            // EDIT MODE
            <div className={styles.formGrid}>
              <div className={styles.formGroupFull}>
                <label>
                  <Package size={16} />
                  Nama Item
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
                <small style={{ color: 'var(--text-muted)' }}>Nama item tidak dapat diubah</small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="storageLocation">
                  <MapPin size={16} />
                  Lokasi Penyimpanan
                </label>
                <input
                  type="text"
                  id="storageLocation"
                  name="storageLocation"
                  value={editFormData.storageLocation}
                  onChange={handleInputChange}
                  placeholder="Rak A1, Lemari B2, dll"
                />
              </div>

              <div className={styles.formGroup}>
                <label>
                  <Hash size={16} />
                  Faktor Konversi
                </label>
                <input
                  type="number"
                  value={editFormData.conversionFactor}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  1 {editFormData.baseUnit} = {editFormData.conversionFactor} {editFormData.usageUnit}
                </small>
              </div>

              {/* Stock Input with Unit Toggle */}
              <div className={styles.formGroupFull}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={16} />
                    Stok Saat Ini
                  </span>
                  {/* Unit Toggle */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--surface-secondary)',
                    borderRadius: '6px',
                    padding: '2px',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setStockUnitMode('base')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: stockUnitMode === 'base' ? 'var(--primary)' : 'transparent',
                        color: stockUnitMode === 'base' ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      dalam {editFormData.baseUnit}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockUnitMode('usage')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: stockUnitMode === 'usage' ? 'var(--primary)' : 'transparent',
                        color: stockUnitMode === 'usage' ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      dalam {editFormData.usageUnit}
                    </button>
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={stockUnitMode === 'base' 
                      ? editFormData.stock 
                      : editFormData.usageStock}
                    onChange={(e) => handleStockChange(parseFloat(e.target.value) || 0, stockUnitMode)}
                    min="0"
                    step={stockUnitMode === 'base' ? '0.01' : '1'}
                    placeholder="0"
                    style={{ flex: 1 }}
                  />
                </div>
                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  {stockUnitMode === 'base' 
                    ? `= ${editFormData.usageStock.toFixed(0)} ${editFormData.usageUnit}`
                    : `= ${editFormData.stock.toFixed(2)} ${editFormData.baseUnit}`
                  }
                </small>
              </div>

              {/* Min Threshold Input with Unit Toggle */}
              <div className={styles.formGroupFull}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} />
                    Minimum Stok (Peringatan)
                  </span>
                  {/* Unit Toggle */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--surface-secondary)',
                    borderRadius: '6px',
                    padding: '2px',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setThresholdUnitMode('base')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: thresholdUnitMode === 'base' ? 'var(--primary)' : 'transparent',
                        color: thresholdUnitMode === 'base' ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      dalam {editFormData.baseUnit}
                    </button>
                    <button
                      type="button"
                      onClick={() => setThresholdUnitMode('usage')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: thresholdUnitMode === 'usage' ? 'var(--primary)' : 'transparent',
                        color: thresholdUnitMode === 'usage' ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s'
                      }}
                    >
                      dalam {editFormData.usageUnit}
                    </button>
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={thresholdUnitMode === 'base' 
                      ? editFormData.minThreshold 
                      : editFormData.minThresholdUsage}
                    onChange={(e) => handleThresholdChange(parseFloat(e.target.value) || 0, thresholdUnitMode)}
                    min="0"
                    step={thresholdUnitMode === 'base' ? '0.01' : '1'}
                    placeholder="10"
                    style={{ flex: 1 }}
                  />
                </div>
                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  {thresholdUnitMode === 'base' 
                    ? `= ${editFormData.minThresholdUsage.toFixed(0)} ${editFormData.usageUnit}`
                    : `= ${editFormData.minThreshold.toFixed(2)} ${editFormData.baseUnit}`
                  }
                </small>
              </div>

              {/* Current Stock Summary */}
              <div className={styles.formGroupFull}>
                <div style={{
                  padding: '12px 16px',
                  background: editFormData.stock <= editFormData.minThreshold 
                    ? 'rgba(239, 68, 68, 0.1)' 
                    : 'rgba(34, 197, 94, 0.1)',
                  border: `1px solid ${editFormData.stock <= editFormData.minThreshold 
                    ? 'rgba(239, 68, 68, 0.3)' 
                    : 'rgba(34, 197, 94, 0.3)'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      Ringkasan Stok
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {editFormData.stock.toFixed(2)} {editFormData.baseUnit} ({editFormData.usageStock.toFixed(0)} {editFormData.usageUnit})
                    </div>
                  </div>
                  {editFormData.stock <= editFormData.minThreshold && (
                    <span style={{
                      padding: '4px 10px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      Stok Rendah
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={styles.modalActions}>
            <Button
              unstyled
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              unstyled
              type="submit"
              className={styles.saveButton}
              disabled={loading || (action === 'create' && !selectedProduct)}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {action === 'create' ? 'Tambah Item' : 'Simpan Perubahan'}
                </>
              )}
            </Button>
          </div>
      </form>
    </CrudModal>
  );
}
