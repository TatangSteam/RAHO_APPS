import { useEffect } from 'react';
import { StockFilterType } from '../types';
import styles from '../page.module.css';

interface SearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  stockFilter: StockFilterType;
  setStockFilter: (filter: StockFilterType) => void;
  categories: string[];
  onClearSearch: () => void;
  onResetFilters: () => void;
  showCreateModal: boolean;
}

export default function SearchFilters({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  stockFilter,
  setStockFilter,
  categories,
  onClearSearch,
  onResetFilters,
  showCreateModal
}: SearchFiltersProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showCreateModal) return;
      
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector(`.${styles.searchField}`) as HTMLInputElement;
        searchInput?.focus();
      }
      
      // Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        onClearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, searchQuery, onClearSearch]);

  return (
    <div className={styles.searchFilters}>
      <div className={styles.searchBox}>
        <div className={styles.searchInput}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Cari nama item, kategori, atau deskripsi... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchField}
          />
          {searchQuery && (
            <button 
              className={styles.clearSearch}
              onClick={onClearSearch}
              type="button"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <label>Kategori:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Stok:</label>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilterType)}
            className={styles.filterSelect}
          >
            <option value="ALL">Semua Stok</option>
            <option value="IN_STOCK">Stok Normal</option>
            <option value="LOW_STOCK">Stok Rendah</option>
          </select>
        </div>

        <button 
          className={styles.resetFilters}
          onClick={onResetFilters}
          type="button"
        >
          🔄 Reset
        </button>
      </div>
    </div>
  );
}