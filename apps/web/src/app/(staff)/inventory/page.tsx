'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { api } from '@/lib/api';
import styles from './page.module.css';

interface InventoryItem {
  id: string;
  masterProductId: string;
  branchId: string;
  stock: number;
  minThreshold: number;
  storageLocation?: string;
  masterProduct: {
    id: string;
    name: string;
    category: string;
    baseUnit: string;
    usageUnit: string;
    conversionFactor: number;
  };
  stockInfo: {
    baseStock: number;
    baseUnit: string;
    usageStock: number;
    usageUnit: string;
    minThresholdBase: number;
    minThresholdUsage: number;
    isLowStock: boolean;
    displayText: string;
    displayShort: string;
  };
}

export default function InventoryPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'LOW_STOCK'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);
  const [modalMounted, setModalMounted] = useState(false);
  
  // Edit stock modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustment, setAdjustment] = useState('');
  const [reason, setReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [conversionFactor, setConversionFactor] = useState('');

  // Check if user can access stock requests and shipments
  const canAccessStockRequests = user?.role && ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'].includes(user.role);
  
  // Admin Cabang can edit stock in their own branch
  const canEditStock = user?.role === 'ADMIN_CABANG';

  useEffect(() => {
    setMounted(true);
    setModalMounted(true);
  }, []);

  // Debug modal state
  useEffect(() => {
    console.log('Modal state changed:', { editModalOpen, selectedItem: selectedItem?.masterProduct?.name });
  }, [editModalOpen, selectedItem]);

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

      if (!user?.branchId) {
        showToast.error('Branch ID tidak ditemukan.');
        return;
      }

      const response = await inventoryApi.getAvailableItems(user.branchId);
      setItems(response.data.data || []);
    } catch (error) {
      showToast.error('Gagal memuat data inventori');
      console.error('Inventory fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      if (!accessToken) {
        showToast.error('Token tidak ditemukan. Silakan login kembali.');
        return;
      }

      const loadingToast = showToast.loading(`Mengunduh file ${format.toUpperCase()}...`);

      const endpoint = format === 'csv' ? '/api/inventory/export/csv' : '/api/inventory/export/excel';
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        showToast.dismiss(loadingToast);
        throw new Error(`HTTP ${response.status}`);
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `inventori-${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast.dismiss(loadingToast);
      showToast.success(`File ${format.toUpperCase()} berhasil diunduh!`);
    } catch (error) {
      showToast.error(`Gagal mengunduh file ${format.toUpperCase()}`);
      console.error('Export error:', error);
    }
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    console.log('Opening edit modal for item:', item);
    setSelectedItem(item);
    setAdjustment('');
    setReason('');
    setConversionFactor(item.masterProduct.conversionFactor.toString());
    setEditModalOpen(true);
    console.log('Modal state set to true');
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setSelectedItem(null);
    setAdjustment('');
    setReason('');
    setConversionFactor('');
  };

  const handleAdjustStock = async () => {
    if (!selectedItem) return;

    const adjustmentNum = parseFloat(adjustment);
    if (isNaN(adjustmentNum) || adjustmentNum === 0) {
      showToast.error('Masukkan jumlah penyesuaian yang valid');
      return;
    }

    if (!reason.trim()) {
      showToast.error('Alasan penyesuaian harus diisi');
      return;
    }

    // Validate conversion factor if changed
    const conversionFactorNum = parseFloat(conversionFactor);
    const hasConversionChange = conversionFactorNum !== selectedItem.masterProduct.conversionFactor;
    
    if (hasConversionChange && (isNaN(conversionFactorNum) || conversionFactorNum <= 0)) {
      showToast.error('Faktor konversi harus berupa angka positif');
      return;
    }

    try {
      setAdjusting(true);
      
      // Update conversion factor if changed
      if (hasConversionChange) {
        await api.patch(`/master-products/${selectedItem.masterProductId}`, {
          conversionFactor: conversionFactorNum,
        });
      }
      
      // Adjust stock
      await inventoryApi.adjustStock(selectedItem.id, {
        adjustment: adjustmentNum,
        reason: reason.trim(),
      });

      showToast.success('Stok berhasil disesuaikan');
      handleCloseEditModal();
      fetchInventoryItems(); // Refresh data
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Gagal menyesuaikan stok';
      showToast.error(errorMessage);
      console.error('Adjust stock error:', error);
    } finally {
      setAdjusting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesFilter = filter === 'ALL' || (filter === 'LOW_STOCK' && item.stockInfo.isLowStock);
    const matchesSearch =
      item.masterProduct.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.masterProduct.category.toLowerCase().includes(searchTerm.toLowerCase());
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
    if (item.stockInfo.isLowStock) {
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
    return Math.min((item.stockInfo.baseStock / Math.max(item.stockInfo.minThresholdBase, 1)) * 100, 100);
  };

  // Calculate statistics
  const totalItems = items.length;
  const lowStockItems = items.filter((i) => i.stockInfo.isLowStock).length;
  const normalStockItems = totalItems - lowStockItems;
  const totalStockValue = items.reduce((sum, item) => sum + item.stockInfo.baseStock, 0);

  // Modal component
  const EditStockModalContent = () => {
    if (!editModalOpen || !selectedItem) return null;

    return (
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999999,
          padding: '20px'
        }}
        onClick={handleCloseEditModal}
      >
        <div 
          style={{
            background: 'var(--surface-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '0',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--surface-border)',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 30px',
            borderBottom: '1px solid var(--surface-border)',
            background: 'var(--surface-input)'
          }}>
            <div>
              <h2 style={{ 
                margin: '0 0 4px 0', 
                fontSize: '20px', 
                fontWeight: '700',
                color: 'var(--text-primary)'
              }}>
                ✏️ Edit Stok
              </h2>
              <p style={{
                margin: '0',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                fontWeight: '500'
              }}>
                {selectedItem.masterProduct.name}
              </p>
            </div>
            <button
              onClick={handleCloseEditModal}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--surface-border)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: '30px' }}>
            {/* Current Stock Info */}
            <div style={{ 
              marginBottom: '24px', 
              padding: '20px', 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(59, 130, 246, 0.1)'
            }}>
              <div style={{ 
                fontSize: '14px', 
                color: 'var(--text-secondary)', 
                marginBottom: '8px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                📦 Stok Saat Ini
              </div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '700', 
                color: 'var(--color-primary-600)',
                marginBottom: '4px'
              }}>
                {selectedItem.stockInfo.baseStock.toFixed(2)} {selectedItem.stockInfo.baseUnit}
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: 'var(--text-secondary)',
                fontWeight: '500'
              }}>
                ({selectedItem.stockInfo.usageStock.toFixed(0)} {selectedItem.stockInfo.usageUnit})
              </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Conversion Factor */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)'
                }}>
                  🔄 Konversi (1 {selectedItem.stockInfo.baseUnit} = ? {selectedItem.stockInfo.usageUnit})
                </label>
                <input
                  type="number"
                  value={conversionFactor}
                  onChange={(e) => setConversionFactor(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    background: 'var(--surface-input)',
                    boxSizing: 'border-box',
                    transition: 'all var(--transition-fast)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary-500)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--surface-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Stock Adjustment */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)'
                }}>
                  📊 Penyesuaian Stok ({selectedItem.stockInfo.baseUnit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  placeholder="Contoh: 10 untuk tambah, -5 untuk kurang"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    background: 'var(--surface-input)',
                    boxSizing: 'border-box',
                    transition: 'all var(--transition-fast)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary-500)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--surface-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Reason */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)'
                }}>
                  📝 Catatan / Alasan *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Koreksi stok fisik, Barang rusak, dll"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                    background: 'var(--surface-input)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    transition: 'all var(--transition-fast)',
                    minHeight: '80px'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary-500)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--surface-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Live Preview */}
              {adjustment && !isNaN(parseFloat(adjustment)) && (
                <div style={{
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(22, 163, 74, 0.05) 100%)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(34, 197, 94, 0.2)'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '4px',
                    fontWeight: '600'
                  }}>
                    📈 Preview Stok Setelah Penyesuaian:
                  </div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    color: 'var(--color-success)'
                  }}>
                    {(selectedItem.stockInfo.baseStock + parseFloat(adjustment)).toFixed(2)} {selectedItem.stockInfo.baseUnit}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '24px 30px',
            borderTop: '1px solid var(--surface-border)',
            background: 'var(--surface-input)'
          }}>
            <button
              onClick={handleCloseEditModal}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: 'var(--surface-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-border)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface-card)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Batal
            </button>
            <button
              onClick={handleAdjustStock}
              disabled={adjusting || !adjustment || !reason.trim()}
              style={{
                flex: 1,
                padding: '12px 24px',
                background: adjusting || !adjustment || !reason.trim() 
                  ? 'var(--surface-border)' 
                  : 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))',
                color: adjusting || !adjustment || !reason.trim() ? 'var(--text-secondary)' : 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: adjusting || !adjustment || !reason.trim() ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: adjusting || !adjustment || !reason.trim() 
                  ? 'none' 
                  : '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!adjusting && adjustment && reason.trim()) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!adjusting && adjustment && reason.trim()) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                }
              }}
            >
              {adjusting ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
              <h1>📦 Inventori Stok</h1>
              <p>Kelola dan monitor stok barang di cabang Anda</p>
            </div>
            {canAccessStockRequests && (
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
            )}
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
            Stok Rendah ({items.filter((i) => i.stockInfo.isLowStock).length})
          </button>
        </div>

        <div className={styles.exportButtons}>
          <button
            className={styles.exportBtn}
            onClick={() => handleExport('csv')}
            title="Export ke CSV"
          >
            📄 CSV
          </button>
          <button
            className={styles.exportBtn}
            onClick={() => handleExport('excel')}
            title="Export ke Excel"
          >
            📊 Excel
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
            <div key={item.id} className={`${styles.itemCard} ${item.stockInfo.isLowStock ? styles.lowStockCard : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.categoryIconWrapper}>
                  <div className={styles.categoryIcon}>{getCategoryBadge(item.masterProduct.category)}</div>
                </div>
                <div className={styles.itemInfo}>
                  <h3>{item.masterProduct.name}</h3>
                  <p className={styles.category}>{getCategoryName(item.masterProduct.category)}</p>
                </div>
                {getStockStatus(item)}
              </div>

              <div className={styles.cardBody}>
                <div className={styles.stockInfo}>
                  <div className={styles.stockRow}>
                    <span className={styles.label}>Stok Saat Ini</span>
                    <span className={`${styles.value} ${item.stockInfo.isLowStock ? styles.lowValue : ''}`}>
                      {item.stockInfo.baseStock.toFixed(2)} {item.stockInfo.baseUnit}
                      <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>
                        ({item.stockInfo.usageStock.toFixed(0)} {item.stockInfo.usageUnit})
                      </span>
                    </span>
                  </div>
                  
                  {/* Conversion Factor Display */}
                  <div className={styles.stockRow} style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                    <span className={styles.label} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Konversi
                    </span>
                    <span className={styles.value} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      1 {item.stockInfo.baseUnit} = {item.masterProduct.conversionFactor} {item.stockInfo.usageUnit}
                    </span>
                  </div>
                </div>

                {item.storageLocation && (
                  <div className={styles.location}>
                    <span className={styles.locationIcon}>📍</span>
                    <span className={styles.locationText}>{item.storageLocation}</span>
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                {item.stockInfo.isLowStock && canAccessStockRequests && (
                  <button
                    className={styles.requestBtn}
                    onClick={() => router.push('/inventory/stock-requests')}
                  >
                    <span>🛒</span>
                    <span>Request Stok</span>
                  </button>
                )}
                {canEditStock && (
                  <button
                    className={styles.editBtn}
                    onClick={() => {
                      console.log('Edit button clicked for item:', item.masterProduct.name);
                      handleOpenEditModal(item);
                    }}
                    style={{ marginLeft: item.stockInfo.isLowStock && canAccessStockRequests ? '8px' : '0' }}
                  >
                    <span>✏️</span>
                    <span>Edit Stok</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Render modal using portal to ensure it's on top */}
      {modalMounted && typeof window !== 'undefined' && createPortal(
        <EditStockModalContent />,
        document.body
      )}
    </>
  );
}
