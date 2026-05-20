'use client';

import { useState, useEffect } from 'react';
import { MasterProduct, RequestItem, StockFilterType } from '../types';
import styles from '../page.module.css';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: MasterProduct[]; // Now using MasterProduct
  onCreateRequest: (items: RequestItem[], notes: string) => Promise<void>;
  onRefreshInventory: () => void;
  loading: boolean;
}

export default function CreateRequestModal({
  isOpen,
  onClose,
  inventoryItems,
  onCreateRequest,
  onRefreshInventory,
  loading
}: CreateRequestModalProps) {
  const [filteredItems, setFilteredItems] = useState<MasterProduct[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Filter items based on search and filters
  useEffect(() => {
    let filtered = inventoryItems.filter(item => item.isActive);

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    setFilteredItems(filtered);
  }, [inventoryItems, searchQuery, categoryFilter]);

  // Get unique categories from inventory items
  const getCategories = () => {
    const categories = Array.from(new Set(inventoryItems.map(item => item.category)));
    return categories.sort();
  };

  const addRequestItem = (item: MasterProduct) => {
    const existingItem = requestItems.find(ri => ri.masterProductId === item.id);
    if (existingItem) {
      return; // Already added
    }

    // Set default quantity based on item type
    let defaultQty = 1;
    const unit = item.baseUnit.toLowerCase();
    if (unit.includes('ml') || unit.includes('liter')) {
      defaultQty = 100;
    } else if (unit.includes('tablet') || unit.includes('kapsul')) {
      defaultQty = 10;
    } else if (unit.includes('box') || unit.includes('pack')) {
      defaultQty = 1;
    } else {
      defaultQty = 10;
    }

    setRequestItems([...requestItems, {
      masterProductId: item.id,
      productName: item.name,
      requestedQty: defaultQty,
      unit: item.baseUnit,
      notes: '',
    }]);
  };

  const updateRequestItem = (masterProductId: string, field: keyof RequestItem, value: any) => {
    setRequestItems(requestItems.map(item => {
      if (item.masterProductId === masterProductId) {
        if (field === 'requestedQty') {
          const validatedQty = Math.max(1, value);
          return { ...item, [field]: validatedQty };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeRequestItem = (masterProductId: string) => {
    setRequestItems(requestItems.filter(item => item.masterProductId !== masterProductId));
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
  };

  const handleSubmit = async () => {
    if (requestItems.length === 0) {
      return;
    }
    await onCreateRequest(requestItems, requestNotes);
  };

  const handleClose = () => {
    setRequestItems([]);
    setRequestNotes('');
    resetFilters();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={handleClose} />
      <div className={`${styles.modalContent} ${styles.createModal}`} style={{ maxWidth: '900px', maxHeight: '90vh' }}>
        <div className={styles.modalHeader}>
          <h2>Buat Request Stok Baru</h2>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.modalBody} style={{ display: 'flex', gap: '24px', overflow: 'hidden' }}>
          {/* Left: Product Selection */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '1rem', fontWeight: 600 }}>
                Pilih Produk
              </h3>
              
              {/* Search and Filter */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari produk..."
                  className={styles.searchField}
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="ALL">Semua Kategori</option>
                  {getCategories().map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {(searchQuery || categoryFilter !== 'ALL') && (
                  <button
                    onClick={resetFilters}
                    className={styles.resetFilters}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.8)', marginBottom: '8px' }}>
                {filteredItems.length} dari {inventoryItems.length} produk
              </div>
            </div>

            {/* Product List */}
            <div className={styles.inventoryGrid} style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'block',
              maxHeight: 'none',
            }}>
              {filteredItems.length === 0 ? (
                <div className={styles.emptyInventory}>
                  {inventoryItems.length === 0 ? (
                    <>
                      <p>Tidak ada produk tersedia</p>
                      <button
                        onClick={onRefreshInventory}
                        className={styles.refreshBtn}
                        style={{ marginTop: '8px' }}
                      >
                        Muat Ulang
                      </button>
                    </>
                  ) : (
                    <p>Tidak ada produk yang cocok dengan filter</p>
                  )}
                </div>
              ) : (
                <div style={{ padding: '8px' }}>
                  {filteredItems.map((item) => {
                    const isAdded = requestItems.some(ri => ri.masterProductId === item.id);
                    return (
                      <div
                        key={item.id}
                        className={styles.itemRow}
                        style={{
                          border: isAdded ? '2px solid rgba(16, 185, 129, 0.6)' : undefined,
                          marginBottom: '6px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className={styles.itemName}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.7)' }}>
                            {item.category} • {item.baseUnit}
                            {item.sku && ` • SKU: ${item.sku}`}
                          </div>
                        </div>
                        <button
                          onClick={() => addRequestItem(item)}
                          disabled={isAdded}
                          className={isAdded ? styles.addItemBtn : styles.addItemBtn}
                          style={{
                            background: isAdded 
                              ? 'linear-gradient(145deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.3) 100%)'
                              : undefined,
                            color: isAdded ? 'rgb(16, 185, 129)' : undefined,
                            border: isAdded ? '1px solid rgba(16, 185, 129, 0.3)' : undefined,
                          }}
                        >
                          {isAdded ? '✓ Ditambahkan' : '+ Tambah'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Items */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ marginBottom: '12px', fontSize: '1rem', fontWeight: 600 }}>
                Item yang Diminta ({requestItems.length})
              </h3>
            </div>

            {/* Selected Items List */}
            <div className={styles.selectedSection} style={{ 
              flex: 1, 
              overflowY: 'auto', 
              marginBottom: '16px',
              padding: '0',
            }}>
              {requestItems.length === 0 ? (
                <div className={styles.emptyInventory} style={{ padding: '24px' }}>
                  <p>Belum ada item yang dipilih</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '4px', color: 'rgba(148, 163, 184, 0.7)' }}>
                    Pilih produk dari daftar di sebelah kiri
                  </p>
                </div>
              ) : (
                <div style={{ padding: '8px' }}>
                  {requestItems.map((item) => (
                    <div
                      key={item.masterProductId}
                      className={styles.selectedItem}
                      style={{ marginBottom: '8px' }}
                    >
                      <div className={styles.itemDetails} style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0 }}>{item.productName}</h4>
                          <button
                            onClick={() => removeRequestItem(item.masterProductId)}
                            className={styles.removeBtn}
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            ✕ Hapus
                          </button>
                        </div>
                        
                        <div className={styles.qtyControls}>
                          <label style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.8)' }}>Jumlah:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.requestedQty}
                            onChange={(e) => updateRequestItem(item.masterProductId, 'requestedQty', Number(e.target.value))}
                            className={styles.numberInput}
                            style={{ width: '80px' }}
                          />
                          <span className={styles.unit}>{item.unit}</span>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => updateRequestItem(item.masterProductId, 'notes', e.target.value)}
                            placeholder="Catatan item (opsional)"
                            className={styles.textInput}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Request Notes */}
            <div className={styles.formGroup}>
              <label>
                Catatan Request (opsional)
              </label>
              <textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Catatan umum untuk request ini..."
                rows={3}
                className={styles.textarea}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={`${styles.modalBtn} ${styles.create}`}
            onClick={handleSubmit}
            disabled={loading || requestItems.length === 0}
            style={{
              opacity: requestItems.length === 0 ? 0.5 : 1,
              cursor: requestItems.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Membuat...' : `Buat Request (${requestItems.length} item)`}
          </button>
          <button
            className={`${styles.modalBtn} ${styles.cancel}`}
            onClick={handleClose}
            disabled={loading}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
