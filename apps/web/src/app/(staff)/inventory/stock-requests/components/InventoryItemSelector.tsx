'use client';

import { InventoryItem, MasterProduct, RequestItem } from '../types';
import styles from '../page.module.css';

interface InventoryItemSelectorProps {
  inventoryItems: InventoryItem[] | MasterProduct[];
  filteredItems: InventoryItem[] | MasterProduct[];
  requestItems: RequestItem[];
  searchQuery: string;
  onAddItem: (item: InventoryItem | MasterProduct) => void;
  onRefreshInventory: () => void;
  onResetFilters: () => void;
}

// Type guard to check if item is InventoryItem
function isInventoryItem(item: InventoryItem | MasterProduct): item is InventoryItem {
  return 'stock' in item;
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

  const isItemAdded = (itemId: string) => {
    return requestItems.some(ri => ri.masterProductId === itemId || ri.inventoryItemId === itemId);
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
              
              {/* Stock display for InventoryItem */}
              {isInventoryItem(item) && (
                <>
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
                </>
              )}

              {/* Unit display for MasterProduct */}
              {!isInventoryItem(item) && (
                <div className={styles.stockInfo}>
                  <span className={styles.stockBadge}>
                    Unit: {item.baseUnit}
                  </span>
                </div>
              )}

              {item.description && (
                <p className={styles.description}>
                  {highlightSearchTerm(item.description, searchQuery)}
                </p>
              )}
              {isInventoryItem(item) && item.storageLocation && (
                <p className={styles.location}>📍 {item.storageLocation}</p>
              )}
            </div>
            <button
              className={styles.addItemBtn}
              onClick={() => onAddItem(item)}
              disabled={isItemAdded(item.id)}
            >
              {isItemAdded(item.id) ? '✓ Ditambahkan' : '➕ Tambah'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
