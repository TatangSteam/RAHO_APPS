import { InventoryItem, RequestItem } from '../types';
import styles from '../page.module.css';

interface RequestItemsListProps {
  requestItems: RequestItem[];
  inventoryItems: InventoryItem[];
  onUpdateItem: (inventoryItemId: string, field: keyof RequestItem, value: any) => void;
  onRemoveItem: (inventoryItemId: string) => void;
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
                    onUpdateItem(item.inventoryItemId, 'requestedQty', qty);
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
          const inventoryItem = inventoryItems.find(inv => inv.id === item.inventoryItemId);
          const availableStock = inventoryItem?.stock || 0;
          const isOverStock = item.requestedQty > availableStock;
          
          return (
            <div key={item.inventoryItemId} className={styles.selectedItem}>
              <div className={styles.itemDetails}>
                <h4>{item.productName}</h4>
                <div className={styles.stockIndicator}>
                  <span className={`${styles.stockBadge} ${availableStock <= (inventoryItem?.minThreshold || 0) ? styles.lowStock : styles.normalStock}`}>
                    Tersedia: {availableStock} {item.unit}
                  </span>
                  {isOverStock && (
                    <span className={styles.errorBadge}>
                      ⚠️ Melebihi stok!
                    </span>
                  )}
                </div>
                <div className={styles.qtyInput}>
                  <label>Jumlah:</label>
                  <div className={styles.qtyControls}>
                    <input
                      type="number"
                      min="1"
                      max={availableStock}
                      step="1"
                      value={item.requestedQty}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        onUpdateItem(item.inventoryItemId, 'requestedQty', value);
                      }}
                      className={`${styles.numberInput} ${isOverStock ? styles.errorInput : ''}`}
                      placeholder="Masukkan jumlah"
                    />
                    <div className={styles.quickBtns}>
                      {[10, 50, Math.min(100, availableStock)].map(qty => (
                        <button 
                          key={qty}
                          type="button"
                          className={styles.quickBtn}
                          onClick={() => onUpdateItem(item.inventoryItemId, 'requestedQty', Math.min(qty, availableStock))}
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
                    onChange={(e) => onUpdateItem(item.inventoryItemId, 'notes', e.target.value)}
                    placeholder="Catatan untuk item ini..."
                    rows={2}
                    className={styles.textarea}
                  />
                </div>
              </div>
              <button
                className={styles.removeItemBtn}
                onClick={() => onRemoveItem(item.inventoryItemId)}
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