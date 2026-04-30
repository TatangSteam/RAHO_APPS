import { useState, useEffect } from 'react';
import { InventoryItem, RequestItem, StockFilterType } from '../types';
import SearchFilters from './SearchFilters';
import InventoryItemSelector from './InventoryItemSelector';
import RequestItemsList from './RequestItemsList';
import styles from '../page.module.css';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
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
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('ALL');

  // Filter items based on search and filters
  useEffect(() => {
    let filtered = inventoryItems;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Stock filter
    if (stockFilter === 'LOW_STOCK') {
      filtered = filtered.filter(item => item.isLowStock);
    } else if (stockFilter === 'IN_STOCK') {
      filtered = filtered.filter(item => !item.isLowStock);
    }

    setFilteredItems(filtered);
  }, [inventoryItems, searchQuery, categoryFilter, stockFilter]);

  // Get unique categories from inventory items
  const getCategories = () => {
    const categories = Array.from(new Set(inventoryItems.map(item => item.category)));
    return categories.sort();
  };

  const addRequestItem = (item: InventoryItem) => {
    const existingItem = requestItems.find(ri => ri.inventoryItemId === item.id);
    if (existingItem) {
      return; // Already added
    }

    // Set default quantity based on item type
    let defaultQty = 1;
    if (item.unit.toLowerCase().includes('ml') || item.unit.toLowerCase().includes('liter')) {
      defaultQty = 100; // Default 100ml for liquids
    } else if (item.unit.toLowerCase().includes('tablet') || item.unit.toLowerCase().includes('kapsul')) {
      defaultQty = 10; // Default 10 tablets/capsules
    } else if (item.unit.toLowerCase().includes('box') || item.unit.toLowerCase().includes('pack')) {
      defaultQty = 1; // Default 1 box/pack
    } else {
      defaultQty = 10; // Default 10 for other units
    }

    setRequestItems([...requestItems, {
      inventoryItemId: item.id,
      productName: item.name,
      requestedQty: defaultQty,
      unit: item.unit,
      notes: '',
    }]);
  };

  const updateRequestItem = (inventoryItemId: string, field: keyof RequestItem, value: any) => {
    setRequestItems(requestItems.map(item => {
      if (item.inventoryItemId === inventoryItemId) {
        // If updating quantity, validate against available stock
        if (field === 'requestedQty') {
          const inventoryItem = inventoryItems.find(inv => inv.id === inventoryItemId);
          if (inventoryItem) {
            const maxQty = inventoryItem.stock;
            const validatedQty = Math.max(1, Math.min(value, maxQty));
            return { ...item, [field]: validatedQty };
          }
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeRequestItem = (inventoryItemId: string) => {
    setRequestItems(requestItems.filter(item => item.inventoryItemId !== inventoryItemId));
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setStockFilter('ALL');
  };

  const handleSubmit = async () => {
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
      <div className={`${styles.modalContent} ${styles.createModal}`}>
        <div className={styles.modalHeader}>
          <h2>Buat Request Stok Baru</h2>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* Inventory Items Selection */}
          <div className={styles.inventorySection}>
            <div className={styles.sectionHeader}>
              <h3>Pilih Item dari Inventori</h3>
              <div className={styles.itemCount}>
                {filteredItems.length} dari {inventoryItems.length} item
              </div>
            </div>

            <SearchFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              stockFilter={stockFilter}
              setStockFilter={setStockFilter}
              categories={getCategories()}
              onClearSearch={clearSearch}
              onResetFilters={resetFilters}
              showCreateModal={isOpen}
            />

            <InventoryItemSelector
              inventoryItems={inventoryItems}
              filteredItems={filteredItems}
              requestItems={requestItems}
              searchQuery={searchQuery}
              onAddItem={addRequestItem}
              onRefreshInventory={onRefreshInventory}
              onResetFilters={resetFilters}
            />
          </div>

          <RequestItemsList
            requestItems={requestItems}
            inventoryItems={inventoryItems}
            onUpdateItem={updateRequestItem}
            onRemoveItem={removeRequestItem}
          />

          {/* Request Notes - Always show */}
          <div className={styles.notesSection}>
              <div className={styles.formGroup}>
                <label>Catatan Request (opsional)</label>
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
            className={`${styles.modalBtn} ${styles.primary}`}
            onClick={handleSubmit}
            disabled={loading}
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