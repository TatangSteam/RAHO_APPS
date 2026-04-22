'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minThreshold: number;
  isLowStock: boolean;
  storageLocation?: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'LOW_STOCK'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    fetchInventoryItems();
  }, [mounted, user, accessToken]);

  const fetchInventoryItems = async () => {
    try {
      setLoading(true);
      
      if (!accessToken) {
        showToast.error('Token tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return;
      }

      const response = await fetch('/api/inventory/items', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          showToast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          router.push('/login');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setItems(data.data || []);
    } catch (error) {
      showToast.error('Gagal memuat data inventori');
      console.error('Inventory fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesFilter = filter === 'ALL' || (filter === 'LOW_STOCK' && item.isLowStock);
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getCategoryBadge = (category: string) => {
    const categoryMap: Record<string, string> = {
      MEDICINE: '💊',
      DEVICE: '🔧',
      CONSUMABLE: '📦',
    };
    return categoryMap[category] || '📦';
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.isLowStock) {
      return <span className={`${styles.stockStatus} ${styles.low}`}>⚠️ Stok Rendah</span>;
    }
    return <span className={`${styles.stockStatus} ${styles.normal}`}>✓ Normal</span>;
  };

  const getCategoryName = (category: string) => {
    const categoryNames: Record<string, string> = {
      MEDICINE: 'Obat',
      DEVICE: 'Alat',
      CONSUMABLE: 'Konsumabel',
    };
    return categoryNames[category] || category;
  };

  const getStockPercentage = (item: InventoryItem) => {
    return Math.min((item.stock / Math.max(item.minThreshold, 1)) * 100, 100);
  };

  // Calculate statistics
  const totalItems = items.length;
  const lowStockItems = items.filter((i) => i.isLowStock).length;
  const normalStockItems = totalItems - lowStockItems;
  const totalStockValue = items.reduce((sum, item) => sum + item.stock, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerText}>
            <h1>📦 Inventori Stok</h1>
            <p>Kelola dan monitor stok barang di cabang Anda</p>
          </div>
          <div className={styles.headerActions}>
            <button 
              className={styles.actionBtn}
              onClick={() => router.push('/inventory/stock-requests')}
            >
              📋 Request Stok
            </button>
            <button 
              className={styles.actionBtn}
              onClick={() => router.push('/inventory/shipments')}
            >
              🚚 Pengiriman
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            📦
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>Total Item</p>
            <h3 className={styles.statValue}>{totalItems}</h3>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            ⚠️
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>Stok Rendah</p>
            <h3 className={styles.statValue}>{lowStockItems}</h3>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            ✓
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>Stok Normal</p>
            <h3 className={styles.statValue}>{normalStockItems}</h3>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
            📊
          </div>
          <div className={styles.statContent}>
            <p className={styles.statLabel}>Total Unit</p>
            <h3 className={styles.statValue}>{totalStockValue}</h3>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <button
            className={`${styles.filterBtn} ${filter === 'ALL' ? styles.active : ''}`}
            onClick={() => setFilter('ALL')}
          >
            Semua ({items.length})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'LOW_STOCK' ? styles.active : ''}`}
            onClick={() => setFilter('LOW_STOCK')}
          >
            Stok Rendah ({items.filter((i) => i.isLowStock).length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data inventori...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📦</div>
          <h3>{searchTerm ? 'Tidak Ditemukan' : 'Belum Ada Item'}</h3>
          <p>
            {searchTerm 
              ? `Tidak ada item yang cocok dengan pencarian "${searchTerm}"`
              : 'Belum ada item inventori yang terdaftar di sistem'}
          </p>
          {searchTerm && (
            <button 
              className={styles.emptyBtn}
              onClick={() => setSearchTerm('')}
            >
              🔄 Reset Pencarian
            </button>
          )}
        </div>
      ) : (
        <div className={styles.itemsGrid}>
          {filteredItems.map((item) => (
            <div key={item.id} className={`${styles.itemCard} ${item.isLowStock ? styles.lowStockCard : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.categoryIconWrapper}>
                  <div className={styles.categoryIcon}>{getCategoryBadge(item.category)}</div>
                </div>
                <div className={styles.itemInfo}>
                  <h3>{item.name}</h3>
                  <p className={styles.category}>{getCategoryName(item.category)}</p>
                </div>
                {getStockStatus(item)}
              </div>

              <div className={styles.cardBody}>
                <div className={styles.stockInfo}>
                  <div className={styles.stockRow}>
                    <span className={styles.label}>Stok Saat Ini</span>
                    <span className={`${styles.value} ${item.isLowStock ? styles.lowValue : ''}`}>
                      {item.stock} {item.unit}
                    </span>
                  </div>
                  <div className={styles.stockRow}>
                    <span className={styles.label}>Minimum</span>
                    <span className={styles.value}>{item.minThreshold} {item.unit}</span>
                  </div>
                </div>

                <div className={styles.progressWrapper}>
                  <div className={styles.progressBar}>
                    <div
                      className={`${styles.progress} ${item.isLowStock ? styles.lowProgress : ''}`}
                      style={{
                        width: `${getStockPercentage(item)}%`,
                      }}
                    />
                  </div>
                  <span className={styles.progressLabel}>
                    {Math.round(getStockPercentage(item))}%
                  </span>
                </div>

                {item.storageLocation && (
                  <div className={styles.location}>
                    <span className={styles.locationIcon}>📍</span>
                    <span className={styles.locationText}>{item.storageLocation}</span>
                  </div>
                )}
              </div>

              {item.isLowStock && (
                <div className={styles.cardFooter}>
                  <button
                    className={styles.requestBtn}
                    onClick={() => router.push('/inventory/stock-requests')}
                  >
                    <span>🛒</span>
                    <span>Request Stok</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
