'use client';

import { InventoryItem, MasterProduct, RequestItem } from '../types';
import styles from '../page.module.css';

interface RequestItemsListProps {
  requestItems: RequestItem[];
  inventoryItems: InventoryItem[] | MasterProduct[];
  onUpdateItem: (itemId: string, field: keyof RequestItem, value: any) => void;
  onRemoveItem: (itemId: string) => void;
}

// Type guard to check if item is InventoryItem
function isInventoryItem(item: InventoryItem | MasterProduct): item is InventoryItem {
  return 'stock' in item;
}

export default function RequestItemsList({
  requestItems,
  inventoryItems,
  onUpdateItem,
  onRemoveItem
}: RequestItemsListProps) {
  if (requestItems.length === 0) {
    return null;
  }

  const totalQuantity = requestItems.reduce((sum, item) => sum + item.requestedQty, 0);

  const getItemId = (item: RequestItem) => item.masterProductId || item.inventoryItemId || '';

  const findInventoryItem = (itemId: string) => {
    return inventoryItems.find(inv => inv.id === itemId);
  };

  return (
    <div className={styles.selectedSection}>
      <div className={styles.sectionHeader}>
        <h3>Item yang Diminta</h3>
        <div className={styles.itemCount}>
          {requestItems.length} item • Total: {totalQuantity} unit
        </div>
      </div>
      
      {/* Bundle Info */}
      {requestItems.length > 1 && (
        <div className={styles.bundleIndicator}>
          <span className={styles.bundleIcon}>📦</span>
          <span>Semua item akan menjadi satu bundle dan di-approve bersamaan</span>
        </div>
      )}
      
      {/* Bulk Actions */}
      {requestItems.length > 1 && (
        <div className={styles.bulkActions}>
          <span>Set semua quantity:</span>
          <div className={styles.bulkBtns}>
            {[10, 50, 100, 500].map(qty => (
              <button 
                key={qty}
                type="button"
                className={styles.bulkBtn}
                onClick={() => {
                  requestItems.forEach(item => {
                    onUpdateItem(getItemId(item), 'requestedQty', qty);
                  });
                }}
              >
                {qty}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className={styles.selectedItems}>
        {requestItems.map((item) => {
          const itemId = getItemId(item);
          const inventoryItem = findInventoryItem(itemId);
          const availableStock = inventoryItem && isInventoryItem(inventoryItem) ? inventoryItem.stock : Infinity;
          const isOverStock = availableStock !== Infinity && item.requestedQty > availableStock;
          
          return (
            <div key={itemId} className={styles.selectedItem}>
              <div className={styles.itemDetails}>
                <h4>{item.productName}</h4>
                {inventoryItem && isInventoryItem(inventoryItem) && (
                  <div className={styles.stockIndicator}>
                    <span className={`${styles.stockBadge} ${availableStock <= (inventoryItem.minThreshold || 0) ? styles.lowStock : styles.normalStock}`}>
                      Tersedia: {availableStock} {item.unit}
                    </span>
                    {isOverStock && (
                      <span className={styles.errorBadge}>
                        ⚠️ Melebihi stok!
                      </span>
                    )}
                  </div>
                )}
                <div className={styles.qtyInput}>
                  <label>Jumlah:</label>
                  <div className={styles.qtyControls}>
                    <input
                      type="number"
                      min="1"
                      max={availableStock !== Infinity ? availableStock : undefined}
                      step="1"
                      value={item.requestedQty}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        onUpdateItem(itemId, 'requestedQty', value);
                      }}
                      className={`${styles.numberInput} ${isOverStock ? styles.errorInput : ''}`}
                      placeholder="Masukkan jumlah"
                    />
                    <div className={styles.quickBtns}>
                      {[10, 50, availableStock !== Infinity ? Math.min(100, availableStock) : 100].map(qty => (
                        <button 
                          key={qty}
                          type="button"
                          className={styles.quickBtn}
                          onClick={() => onUpdateItem(itemId, 'requestedQty', availableStock !== Infinity ? Math.min(qty, availableStock) : qty)}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.notesInput}>
                  <label>Catatan (opsional):</label>
                  <textarea
                    value={item.notes || ''}
                    onChange={(e) => onUpdateItem(itemId, 'notes', e.target.value)}
                    placeholder="Catatan untuk item ini..."
                    rows={2}
                    className={styles.textarea}
                  />
                </div>
              </div>
              <button
                className={styles.removeItemBtn}
                onClick={() => onRemoveItem(itemId)}
                title="Hapus item"
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
