import { InventoryItem, RequestItem } from '../types';
import styles from '../page.module.css';

interface InventoryItemSelectorProps {
  inventoryItems: InventoryItem[];
  filteredItems: InventoryItem[];
  requestItems: RequestItem[];
  searchQuery: string;
  onAddItem: (item: InventoryItem) => void;
  onRefreshInventory: () => void;
  onResetFilters: () => void;
}

export default function InventoryItemSelector({
  inventoryItems,
  filteredItems,
  requestItems,
  searchQuery,
  onAddItem,
  onRefreshInventory,
  onResetFilters
}: InventoryItemSelectorProps) {
  // Highlight search terms in text
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className={styles.highlight}>{part}</mark>
      ) : part
    );
  };

  return (
    <div className={styles.inventoryGrid}>
      {inventoryItems.length === 0 ? (
        <div className={styles.emptyInventory}>
          <p>Memuat data inventori...</p>
          <button onClick={onRefreshInventory} className={styles.refreshBtn}>
            🔄 Refresh
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyInventory}>
          <p>Tidak ada item yang sesuai dengan filter</p>
          <button onClick={onResetFilters} className={styles.refreshBtn}>
            🔄 Reset Filter
          </button>
        </div>
      ) : (
        filteredItems.map((item) => (
          <div key={item.id} className={styles.inventoryItem}>
            <div className={styles.itemInfo}>
              <h4>{highlightSearchTerm(item.name, searchQuery)}</h4>
              <p>Kategori: {highlightSearchTerm(item.category, searchQuery)}</p>
              
              {/* Enhanced stock display with unit conversion */}
              <div className={styles.stockInfo}>
                <span className={`${styles.stockBadge} ${item.isLowStock ? styles.lowStock : styles.normalStock}`}>
                  Stok: {item.stockDisplay}
                </span>
                <span className={styles.minStock}>Min: {item.thresholdDisplay}</span>
              </div>

              {/* Show conversion info if different units */}
              {item.baseUnit !== item.usageUnit && (
                <div className={styles.conversionInfo}>
                  <span className={styles.conversionLabel}>
                    💡 1 {item.baseUnit} = {item.conversionFactor} {item.usageUnit}
                  </span>
                </div>
              )}

              {item.description && (
                <p className={styles.description}>
                  {highlightSearchTerm(item.description, searchQuery)}
                </p>
              )}
              {item.storageLocation && (
                <p className={styles.location}>📍 {item.storageLocation}</p>
              )}
            </div>
            <button
              className={styles.addItemBtn}
              onClick={() => onAddItem(item)}
              disabled={requestItems.some(ri => ri.inventoryItemId === item.id)}
            >
              {requestItems.some(ri => ri.inventoryItemId === item.id) ? '✓ Ditambahkan' : '➕ Tambah'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}