'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import {
  Package, Plus, Search, Grid3X3, List, Edit2, Trash2, Power, X,
  Building2, Pill, Stethoscope, Droplets, AlertCircle,
  Zap, Link2, Clock, Info, Save, Loader2, Box,
} from 'lucide-react';
import { devError } from '@/lib/logger';
import styles from './page.module.css';
import { PageLoading } from '@/components/ui/LoadingSpinner';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface BranchStockInfo {
  inventoryItemId: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  stock: number;
  minThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  sessionUsageCount: number;
}

interface MasterProduct {
  id: string;
  name: string;
  sku?: string;
  category: 'MEDICINE' | 'DEVICE' | 'CONSUMABLE';
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  description: string | null;
  isActive: boolean;
  usageCount: number;
  totalStock: number;
  totalSessionUsage: number;
  isUsedInSessions: boolean;
  lowStockBranches: number;
  outOfStockBranches: number;
  branches: BranchStockInfo[];
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
  name: string;
  sku: string;
  category: 'MEDICINE' | 'DEVICE' | 'CONSUMABLE';
  baseUnit: string;
  usageUnit: string;
  conversionFactor: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  { value: 'MEDICINE', label: 'Obat & Cairan', icon: Pill, emoji: '💊' },
  { value: 'DEVICE', label: 'Alat Medis', icon: Stethoscope, emoji: '🩺' },
  { value: 'CONSUMABLE', label: 'Bahan Habis Pakai', icon: Droplets, emoji: '🧴' },
] as const;

const UNIT_SUGGESTIONS: Record<string, { base: string[]; usage: string[] }> = {
  MEDICINE: { base: ['botol', 'ampul', 'vial', 'flask', 'box', 'strip'], usage: ['ml', 'mg', 'tablet', 'kapsul', 'tetes'] },
  DEVICE: { base: ['unit', 'set', 'pcs', 'box'], usage: ['unit', 'pcs', 'pack'] },
  CONSUMABLE: { base: ['box', 'pack', 'roll', 'pcs'], usage: ['pcs', 'lembar', 'cm', 'gram'] },
};

const QUICK_TEMPLATES = [
  { label: 'Cairan Infus 500ml', category: 'MEDICINE' as const, baseUnit: 'botol', usageUnit: 'ml', conversionFactor: '500' },
  { label: 'Cairan Infus 100ml', category: 'MEDICINE' as const, baseUnit: 'botol', usageUnit: 'ml', conversionFactor: '100' },
  { label: 'Obat Tablet (1 strip = 10)', category: 'MEDICINE' as const, baseUnit: 'strip', usageUnit: 'tablet', conversionFactor: '10' },
  { label: 'Alat Sekali Pakai', category: 'DEVICE' as const, baseUnit: 'pcs', usageUnit: 'pcs', conversionFactor: '1' },
  { label: 'Sarung Tangan (1 box = 100)', category: 'CONSUMABLE' as const, baseUnit: 'box', usageUnit: 'pcs', conversionFactor: '100' },
];

const INFUSION_AUTO_FILL_MAPPING = [
  { field: 'ifa', label: 'IFA', namePattern: 'IFA' },
  { field: 'infusSet', label: 'Infus Set', namePattern: 'Infus Set' },
  { field: 'no', label: 'NO', namePattern: 'NB NO' },
  { field: 'gaso', label: 'GASO', namePattern: 'Gasotransmitter' },
  { field: 'mb', label: 'MB', namePattern: 'Methyln Blue' },
  { field: 'kcl', label: 'KCL', namePattern: 'KCL' },
  { field: 'h2s', label: 'H2S', namePattern: 'Cairan H2S' },
  { field: 'o3', label: 'O3', namePattern: 'Ozone' },
  { field: 'o2', label: 'O2', namePattern: 'O2 (Oxygen)' },
  { field: 'edta', label: 'EDTA', namePattern: 'EDTA' },
  { field: 'hho', label: 'HHO', namePattern: 'NB-HHO' },
  { field: 'hhoKonsentrat', label: 'HHO Konsentrat', namePattern: 'HHO Konsentrat' },
];

function getAutoFillInfo(productName: string) {
  const lowerName = productName.toLowerCase();
  for (const mapping of INFUSION_AUTO_FILL_MAPPING) {
    if (lowerName.includes(mapping.namePattern.toLowerCase())) {
      return mapping;
    }
  }
  return null;
}

function getCategoryStyle(category: string) {
  switch (category) {
    case 'MEDICINE': return { badge: styles.categoryMEDICINE, border: styles.gridCardMEDICINE, option: styles.categoryOptionBlue, header: styles.modalHeaderBorderBlue };
    case 'DEVICE': return { badge: styles.categoryDEVICE, border: styles.gridCardDEVICE, option: styles.categoryOptionPurple, header: styles.modalHeaderBorderPurple };
    case 'CONSUMABLE': return { badge: styles.categoryCONSUMABLE, border: styles.gridCardCONSUMABLE, option: styles.categoryOptionGreen, header: styles.modalHeaderBorderGreen };
    default: return { badge: styles.categoryMEDICINE, border: styles.gridCardMEDICINE, option: styles.categoryOptionBlue, header: styles.modalHeaderBorderBlue };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MasterProductsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Filters & view
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'usage' | 'recent'>('name');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '', sku: '', category: 'MEDICINE', baseUnit: '', usageUnit: '', conversionFactor: '1', description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Stock edit modal state
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockEditProduct, setStockEditProduct] = useState<MasterProduct | null>(null);

  // Assign to branch modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignProduct, setAssignProduct] = useState<MasterProduct | null>(null);
  const [allBranches, setAllBranches] = useState<Array<{ id: string; branchCode: string; name: string }>>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user || !accessToken) { router.push('/login'); return; }
    if (user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak - Hanya untuk Super Admin');
      router.push('/dashboard');
      return;
    }
    loadProducts();
  }, [mounted, user, accessToken, categoryFilter, statusFilter]);

  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && showModal) handleCloseModal(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [showModal]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('isActive', statusFilter);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!response.ok) throw new Error('Gagal memuat produk');
      const result = await response.json();
      setProducts(result.data.products || []);
    } catch (error: any) {
      devError('Error loading products:', error);
      showToast.error(error.message || 'Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: MasterProduct) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name, sku: product.sku || '', category: product.category, baseUnit: product.baseUnit,
        usageUnit: product.usageUnit, conversionFactor: product.conversionFactor.toString(), description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', sku: '', category: 'MEDICINE', baseUnit: '', usageUnit: '', conversionFactor: '1', description: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => { if (submitting) return; setShowModal(false); setEditingProduct(null); };

  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[number]) => {
    setFormData(prev => ({ ...prev, category: tpl.category, baseUnit: tpl.baseUnit, usageUnit: tpl.usageUnit, conversionFactor: tpl.conversionFactor }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      const url = editingProduct
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products/${editingProduct.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products`;
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, conversionFactor: parseFloat(formData.conversionFactor) }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error?.message || 'Gagal menyimpan produk');
      }
      showToast.success(editingProduct ? 'Produk berhasil diupdate' : 'Produk berhasil ditambahkan');
      handleCloseModal();
      loadProducts();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal menyimpan produk');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: MasterProduct) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master-products/${product.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      if (!response.ok) throw new Error('Gagal mengubah status');
      showToast.success(`Produk ${product.isActive ? 'dinonaktifkan' : 'diaktifkan'}`);
      loadProducts();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal mengubah status');
    }
  };

  const handleDelete = async (product: MasterProduct) => {
    if (!confirm(`Yakin ingin menghapus produk "${product.name}"?`)) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master-products/${product.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Gagal menghapus produk');
      }
      showToast.success('Produk berhasil dihapus');
      loadProducts();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal menghapus produk');
    }
  };

  const clearFilters = () => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); };

  const openStockModal = (product: MasterProduct) => { setStockEditProduct(product); setStockModalOpen(true); };
  const closeStockModal = () => { setStockModalOpen(false); setStockEditProduct(null); };

  const loadAllBranches = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/branches`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error('Gagal memuat cabang');
      const result = await response.json();
      setAllBranches(result.data || []);
    } catch (error: any) {
      devError('Error loading branches:', error);
    }
  };

  const openAssignModal = (product: MasterProduct) => {
    setAssignProduct(product);
    setAssignModalOpen(true);
    if (allBranches.length === 0) loadAllBranches();
  };
  const closeAssignModal = () => { setAssignModalOpen(false); setAssignProduct(null); };

  const handleAssignToBranch = async (branchId: string, stock: number, minThreshold: number): Promise<boolean> => {
    if (!assignProduct) return false;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/items`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterProductId: assignProduct.id, branchId, stock, minThreshold }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || err.message || 'Gagal menambahkan ke cabang');
      }
      showToast.success('Produk berhasil ditambahkan ke cabang');
      await loadProducts();
      return true;
    } catch (e: any) {
      showToast.error(e.message || 'Gagal menambahkan ke cabang');
      return false;
    }
  };

  const handleAdjustStock = async (branchInfo: BranchStockInfo, inventoryItemId: string, newStock: number, notes: string): Promise<boolean> => {
    if (newStock < 0) { showToast.error('Stok tidak boleh negatif'); return false; }
    const adjustment = newStock - branchInfo.stock;
    if (adjustment === 0) { showToast.error('Tidak ada perubahan stok'); return false; }
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/items/${inventoryItemId}/adjust-stock`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment, notes: notes || undefined }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || err.message || 'Gagal mengubah stok');
      }
      showToast.success(`Stok ${branchInfo.branchCode} berhasil diubah: ${branchInfo.stock} → ${newStock} ${stockEditProduct?.baseUnit ?? ''}`);
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('isActive', statusFilter);
      const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/master-products?${params.toString()}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
      if (refreshResponse.ok) {
        const result = await refreshResponse.json();
        const updatedProducts = result.data.products || [];
        setProducts(updatedProducts);
        if (stockEditProduct) {
          const updatedProduct = updatedProducts.find((p: MasterProduct) => p.id === stockEditProduct.id);
          if (updatedProduct) setStockEditProduct(updatedProduct);
        }
      }
      return true;
    } catch (e: any) {
      showToast.error(e.message || 'Gagal mengubah stok');
      return false;
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter(p =>
      !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) ||
      p.baseUnit.toLowerCase().includes(q) || p.usageUnit.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'category': return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case 'usage': return b.usageCount - a.usageCount;
        case 'recent': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default: return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [products, search, sortBy]);

  const getCategoryMeta = (category: string) => CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  const hasActiveFilters = !!(search || categoryFilter || statusFilter);

  if (!mounted) return null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📦</div>
          <div>
            <h1 className={styles.headerTitle}>Master Produk</h1>
            <p className={styles.headerSubtitle}>Kelola produk master untuk semua cabang</p>
          </div>
        </div>
        <button className={styles.addButton} onClick={() => handleOpenModal()}>
          <Plus size={18} /> Tambah Produk
        </button>
      </div>

      {/* Info Banner */}
      <div className={styles.infoBanner}>
        <div className={styles.infoBannerIcon}>💡</div>
        <div className={styles.infoBannerContent}>
          <h3>Cara kerja stok & sesi terapi:</h3>
          <ul className={styles.infoBannerList}>
            <li>
              <Box size={14} />
              <span>Stok dikelola <strong>per cabang</strong>. Klik tombol <span className={styles.infoBadge}><Box size={10} /> Stok</span> untuk edit manual.</span>
            </li>
            <li>
              <Link2 size={14} />
              <span>Produk dengan badge <span className={`${styles.infoBadge} ${styles.infoBadgeBlue}`}><Link2 size={10} /> Auto-fill</span> terhubung ke <strong>form Infus Aktual (Step 4/5)</strong>.</span>
            </li>
            <li>
              <Zap size={14} />
              <span>Produk dengan badge <span className={`${styles.infoBadge} ${styles.infoBadgeGreen}`}><Zap size={10} /> Auto-deduct</span> dipotong saat staff menambah di <strong>Step 6</strong>.</span>
            </li>
            <li>
              <AlertCircle size={14} />
              <span>Cabang dengan <strong>stok habis</strong> tidak bisa pakai produk di sesi — perlu top-up stok terlebih dahulu.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconBlue}`}>📦</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{products.length}</div>
            <div className={styles.statLabel}>Total Produk</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconGreen}`}>✅</div>
          <div className={styles.statContent}>
            <div className={`${styles.statValue} ${styles.statValueGreen}`}>{products.filter(p => p.isActive).length}</div>
            <div className={styles.statLabel}>Aktif</div>
          </div>
        </div>
        {CATEGORIES.map(cat => {
          const count = products.filter(p => p.category === cat.value).length;
          const isActive = categoryFilter === cat.value;
          return (
            <div
              key={cat.value}
              className={`${styles.statCard} ${styles.statCardClickable} ${isActive ? styles.statCardActive : ''}`}
              onClick={() => setCategoryFilter(isActive ? '' : cat.value)}
            >
              <div className={`${styles.statIcon} ${cat.value === 'MEDICINE' ? styles.statIconBlue : cat.value === 'DEVICE' ? styles.statIconPurple : styles.statIconEmerald}`}>
                {cat.emoji}
              </div>
              <div className={styles.statContent}>
                <div className={`${styles.statValue} ${cat.value === 'MEDICINE' ? styles.statValueBlue : cat.value === 'DEVICE' ? styles.statValuePurple : styles.statValueEmerald}`}>
                  {count}
                </div>
                <div className={styles.statLabel}>{cat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Cari produk, deskripsi, SKU, atau unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search && (
              <button onClick={() => setSearch('')} className={styles.clearSearchBtn}>
                <X size={14} />
              </button>
            )}
          </div>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={styles.filterSelect}>
            <option value="">Semua Kategori</option>
            {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.emoji} {cat.label}</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.filterSelect}>
            <option value="">Semua Status</option>
            <option value="true">✅ Aktif</option>
            <option value="false">⛔ Nonaktif</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={styles.filterSelect}>
            <option value="name">↕ Urut: Nama (A-Z)</option>
            <option value="category">↕ Urut: Kategori</option>
            <option value="usage">↕ Urut: Paling Dipakai</option>
            <option value="recent">↕ Urut: Terbaru</option>
          </select>

          <div className={styles.viewToggle}>
            <button onClick={() => setViewMode('table')} className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}>
              <List size={18} />
            </button>
            <button onClick={() => setViewMode('grid')} className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}>
              <Grid3X3 size={18} />
            </button>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className={styles.filterBar}>
            <span className={styles.filterBarLabel}>Filter aktif:</span>
            {search && (
              <span className={styles.filterChip}>
                <Search size={12} /> "{search}"
                <button onClick={() => setSearch('')}><X size={12} /></button>
              </span>
            )}
            {categoryFilter && (
              <span className={styles.filterChip}>
                {getCategoryMeta(categoryFilter).emoji} {getCategoryMeta(categoryFilter).label}
                <button onClick={() => setCategoryFilter('')}><X size={12} /></button>
              </span>
            )}
            {statusFilter && (
              <span className={styles.filterChip}>
                {statusFilter === 'true' ? '✅ Aktif' : '⛔ Nonaktif'}
                <button onClick={() => setStatusFilter('')}><X size={12} /></button>
              </span>
            )}
            <button onClick={clearFilters} className={styles.clearAllBtn}>Bersihkan semua</button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <PageLoading text="Memuat data produk" />
      ) : filteredProducts.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>{hasActiveFilters ? '🔍' : '📦'}</div>
          <h3>{hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada produk'}</h3>
          <p>{hasActiveFilters ? 'Coba ubah kata kunci pencarian atau hapus filter.' : 'Mulai dengan menambahkan produk master pertama Anda.'}</p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className={`${styles.emptyBtn} ${styles.emptyBtnSecondary}`}>Bersihkan filter</button>
          ) : (
            <button onClick={() => handleOpenModal()} className={styles.emptyBtn}><Plus size={18} /> Tambah Produk Pertama</button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className={styles.tableContainer}>
          <table className={styles.productsTable}>
            <thead>
              <tr>
                <th>Nama Produk</th>
                <th>Kategori</th>
                <th>Konversi</th>
                <th>Stok per Cabang</th>
                <th>Sesi Terapi</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const cat = getCategoryMeta(product.category);
                return (
                  <tr key={product.id}>
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.productInfo}>
                          <span className={styles.productName}>{product.name}</span>
                          {product.sku && <span className={styles.productSku}>SKU: {product.sku}</span>}
                          {product.description && <span className={styles.productDesc}>{product.description}</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.categoryBadge} ${styles[`category${product.category}`]}`}>
                        {cat.emoji} {cat.label}
                      </span>
                    </td>
                    <td>
                      <div className={styles.conversionBox}>
                        <span className={styles.conversionValue}>1 {product.baseUnit}</span>
                        <span className={styles.conversionEquals}>=</span>
                        <span className={styles.conversionValue}>{product.conversionFactor} {product.usageUnit}</span>
                      </div>
                    </td>
                    <td>
                      <BranchStockSummary product={product} />
                    </td>
                    <td>
                      <SessionUsageBadge product={product} />
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${product.isActive ? styles.statusActive : styles.statusInactive}`}>
                        {product.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button 
                          onClick={() => handleOpenModal(product)} 
                          className={`${styles.actionBtn} ${styles.editBtn}`}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => openStockModal(product)} 
                          disabled={product.usageCount === 0}
                          className={`${styles.actionBtn} ${styles.stockBtn}`}
                          title="Edit Stok"
                        >
                          <Box size={16} />
                        </button>
                        <button 
                          onClick={() => openAssignModal(product)} 
                          className={`${styles.actionBtn} ${styles.assignBtn}`}
                          title="Tambah ke Cabang"
                        >
                          <Plus size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(product)} 
                          className={`${styles.actionBtn} ${styles.toggleBtn}`}
                          title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          <Power size={16} />
                        </button>
                        <button 
                          onClick={() => product.usageCount === 0 ? handleDelete(product) : showToast.error(`Tidak bisa hapus: digunakan oleh ${product.usageCount} cabang`)} 
                          disabled={product.usageCount > 0}
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (

        /* GRID VIEW */
        <div className={styles.gridContainer}>
          {filteredProducts.map(product => {
            const cat = getCategoryMeta(product.category);
            return (
              <div key={product.id} className={`${styles.gridCard} ${styles[`gridCard${product.category}`]}`}>
                <div className={styles.gridCardHeader}>
                  <span className={`${styles.categoryBadge} ${styles[`category${product.category}`]}`}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span className={`${styles.statusBadge} ${product.isActive ? styles.statusActive : styles.statusInactive}`}>
                    {product.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className={styles.gridCardBody}>
                  <h4 className={styles.gridCardTitle}>{product.name}</h4>
                  {product.sku && <p className={styles.gridCardSku}>SKU: {product.sku}</p>}
                  {product.description && <p className={styles.gridCardDesc}>{product.description}</p>}
                </div>
                <div className={styles.gridCardMeta}>
                  <div className={styles.conversionBox}>
                    <span className={styles.conversionValue}>1 {product.baseUnit}</span>
                    <span className={styles.conversionEquals}>=</span>
                    <span className={styles.conversionValue}>{product.conversionFactor} {product.usageUnit}</span>
                  </div>
                </div>
                <div className={styles.gridCardStock}>
                  <BranchStockSummary product={product} />
                  <SessionUsageBadge product={product} />
                </div>
                <div className={styles.gridCardActions}>
                  <button onClick={() => handleOpenModal(product)} className={`${styles.actionBtn} ${styles.editBtn}`}>
                    <Edit2 size={14} /> Edit
                  </button>
                  <button onClick={() => openStockModal(product)} disabled={product.usageCount === 0} className={`${styles.actionBtn} ${styles.stockBtn}`}>
                    <Box size={14} /> Stok
                  </button>
                  <button onClick={() => openAssignModal(product)} className={`${styles.actionBtn} ${styles.assignBtn}`}>
                    <Plus size={14} />
                  </button>
                  <button onClick={() => handleToggleStatus(product)} className={`${styles.actionBtn} ${styles.toggleBtn}`}>
                    <Power size={14} />
                  </button>
                  <button onClick={() => product.usageCount === 0 ? handleDelete(product) : showToast.error(`Tidak bisa hapus: digunakan oleh ${product.usageCount} cabang`)} disabled={product.usageCount > 0} className={`${styles.actionBtn} ${styles.deleteBtn}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showModal && mounted && createPortal(
        <ProductModal formData={formData} setFormData={setFormData} editingProduct={editingProduct} submitting={submitting} onClose={handleCloseModal} onSubmit={handleSubmit} applyTemplate={applyTemplate} />,
        document.body
      )}
      {stockModalOpen && stockEditProduct && mounted && createPortal(
        <StockEditModal product={stockEditProduct} onClose={closeStockModal} onAdjust={handleAdjustStock} />,
        document.body
      )}
      {assignModalOpen && assignProduct && mounted && createPortal(
        <AssignToBranchModal product={assignProduct} allBranches={allBranches} onClose={closeAssignModal} onAssign={handleAssignToBranch} />,
        document.body
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function BranchStockSummary({ product }: { product: MasterProduct }) {
  const [open, setOpen] = useState(false);

  if (product.usageCount === 0) {
    return (
      <span className={styles.emptyBranchBadge}>
        <Building2 size={14} /> Belum ada cabang
      </span>
    );
  }

  return (
    <div className={styles.branchSummary} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(o => !o)} className={styles.branchSummaryBtn}>
        <Building2 size={14} />
        <strong>{product.usageCount}</strong> cabang
        <span className={styles.branchTotalStock}>({product.totalStock.toLocaleString('id-ID')} {product.baseUnit})</span>
      </button>
      
      <div className={styles.branchBadgeRow}>
        {product.outOfStockBranches > 0 && (
          <span className={`${styles.stockMiniBadge} ${styles.stockOut}`}>
            🔴 {product.outOfStockBranches} habis
          </span>
        )}
        {product.lowStockBranches > 0 && product.lowStockBranches !== product.outOfStockBranches && (
          <span className={`${styles.stockMiniBadge} ${styles.stockLow}`}>
            🟡 {product.lowStockBranches} menipis
          </span>
        )}
      </div>

      {open && (
        <div className={styles.branchPopover}>
          <div className={styles.branchPopoverHeader}>
            <h4><Box size={14} /> Stok per Cabang</h4>
          </div>
          <div className={styles.branchPopoverList}>
            {product.branches.map(b => (
              <div key={b.branchId} className={styles.branchRow}>
                <span className={styles.branchRowName}>
                  <strong>{b.branchCode}</strong> {b.branchName}
                </span>
                <span className={`${styles.branchRowStock} ${b.isOutOfStock ? styles.stockRed : b.isLowStock ? styles.stockYellow : styles.stockGreen}`}>
                  {b.isOutOfStock ? '🔴' : b.isLowStock ? '🟡' : '🟢'} {b.stock.toLocaleString('id-ID')} {product.baseUnit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionUsageBadge({ product }: { product: MasterProduct }) {
  const autoFill = getAutoFillInfo(product.name);

  if (autoFill) {
    return (
      <div className={styles.sessionBadgeWrapper}>
        <span className={`${styles.sessionBadge} ${styles.sessionAutoFill}`} title={`Auto-fill dari form Infus Aktual - Field: ${autoFill.label}`}>
          <Link2 size={14} /> Auto-fill: {autoFill.label}
          {product.totalSessionUsage > 0 && <span className={styles.sessionUsageCount}>{product.totalSessionUsage}x</span>}
        </span>
        <p className={styles.sessionSubtext}>dari form Infus</p>
      </div>
    );
  }

  if (product.isUsedInSessions) {
    return (
      <span className={`${styles.sessionBadge} ${styles.sessionAutoDeduct}`} title="Otomatis dipotong dari stok saat dipakai di Step 6">
        <Zap size={14} /> Auto-deduct
        <span className={styles.sessionUsageCount}>{product.totalSessionUsage}x</span>
      </span>
    );
  }

  return (
    <span className={`${styles.sessionBadge} ${styles.sessionManual}`} title="Produk siap dipakai di Step 6 - Material Usage">
      <Clock size={14} /> Manual (Step 6)
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function ProductModal({ formData, setFormData, editingProduct, submitting, onClose, onSubmit, applyTemplate }: {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  editingProduct: MasterProduct | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  applyTemplate: (tpl: typeof QUICK_TEMPLATES[number]) => void;
}) {
  const conv = parseFloat(formData.conversionFactor || '0') || 0;
  const isValidConv = conv > 0;
  const catStyle = getCategoryStyle(formData.category);
  const suggestions = UNIT_SUGGESTIONS[formData.category] || UNIT_SUGGESTIONS.MEDICINE;

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={`${styles.modalHeader} ${catStyle.header}`}>
          <div>
            <h2 className={styles.modalTitle}>
              {editingProduct ? <><Edit2 size={20} /> Edit Produk</> : <><Plus size={20} /> Tambah Produk Baru</>}
            </h2>
            <p className={styles.modalSubtitle}>
              {editingProduct ? `Mengubah data produk: ${editingProduct.name}` : 'Buat produk master baru yang bisa dipakai semua cabang'}
            </p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          {/* Quick Templates */}
          {!editingProduct && (
            <div className={styles.formSection}>
              <h3 className={styles.formSectionTitle}><Zap size={16} /> Template Cepat</h3>
              <p className={styles.formSectionHint}>Klik untuk auto-isi unit & konversi</p>
              <div className={styles.templateChips}>
                {QUICK_TEMPLATES.map((tpl, i) => (
                  <button key={i} type="button" onClick={() => applyTemplate(tpl)} className={styles.templateChip}>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}><Package size={16} /> Informasi Dasar</h3>
            <div className={styles.formRow}>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label>Nama Produk <span className={styles.required}>*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Contoh: Infus NaCl 0.9% (500ml)" />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>SKU (Opsional)</label>
                <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="Contoh: MED-001" style={{ fontFamily: 'monospace' }} />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Kategori <span className={styles.required}>*</span></label>
              <div className={styles.categoryPicker}>
                {CATEGORIES.map(c => {
                  const isSelected = formData.category === c.value;
                  const optStyle = getCategoryStyle(c.value);
                  return (
                    <button key={c.value} type="button" onClick={() => setFormData({ ...formData, category: c.value })} className={`${styles.categoryOption} ${isSelected ? `${styles.categoryOptionActive} ${optStyle.option}` : ''}`}>
                      <span className={styles.categoryIcon}>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Units & Conversion */}
          <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}>📏 Satuan & Konversi</h3>
            <p className={styles.formSectionHint}>Tentukan unit penyimpanan (saat beli) dan unit pemakaian (saat dipakai pasien)</p>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Unit Penyimpanan <span className={styles.required}>*</span></label>
                <input type="text" value={formData.baseUnit} onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })} required placeholder="botol, box, pack..." />
                <div className={styles.unitChips}>
                  {suggestions.base.map(u => (
                    <button key={u} type="button" onClick={() => setFormData({ ...formData, baseUnit: u })} className={`${styles.unitChip} ${formData.baseUnit === u ? styles.unitChipActive : ''}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Unit Pemakaian <span className={styles.required}>*</span></label>
                <input type="text" value={formData.usageUnit} onChange={(e) => setFormData({ ...formData, usageUnit: e.target.value })} required placeholder="ml, tablet, gram..." />
                <div className={styles.unitChips}>
                  {suggestions.usage.map(u => (
                    <button key={u} type="button" onClick={() => setFormData({ ...formData, usageUnit: u })} className={`${styles.unitChip} ${formData.usageUnit === u ? styles.unitChipActive : ''}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Faktor Konversi <span className={styles.required}>*</span></label>
              <input type="number" step="0.01" min="0.01" value={formData.conversionFactor} onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })} required placeholder="500" />
              <div className={`${styles.conversionPreview} ${isValidConv ? styles.conversionValid : styles.conversionWarning}`}>
                <span className={styles.conversionIcon}>{isValidConv ? '✅' : '⚠️'}</span>
                <div>
                  <strong>1 {formData.baseUnit || '...'}</strong>
                  <span className={styles.conversionEqual}> = </span>
                  <strong>{formData.conversionFactor || '?'} {formData.usageUnit || '...'}</strong>
                </div>
              </div>
              <p className={styles.hint}>💡 Isi <strong>1</strong> kalau unit penyimpanan = unit pemakaian (mis. alat sekali pakai)</p>
            </div>
          </div>

          {/* Description */}
          <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}><Info size={16} /> Deskripsi (Opsional)</h3>
            <div className={styles.formGroup}>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Catatan tambahan, merek, aturan pakai..." />
            </div>
          </div>
        </form>

        <div className={styles.formActions}>
          <button type="button" onClick={onClose} disabled={submitting} className={styles.cancelBtn}>Batal</button>
          <button type="submit" onClick={onSubmit} disabled={submitting} className={styles.submitBtn}>
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16} /> {editingProduct ? 'Update Produk' : 'Tambah Produk'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function StockEditModal({ product, onClose, onAdjust }: {
  product: MasterProduct;
  onClose: () => void;
  onAdjust: (branchInfo: BranchStockInfo, inventoryItemId: string, newStock: number, notes: string) => Promise<boolean>;
}) {
  const [unitMode, setUnitMode] = useState<'base' | 'usage'>('base');
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.branches.forEach(b => { initial[b.inventoryItemId] = String(b.stock); });
    return initial;
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const currentUnit = unitMode === 'base' ? product.baseUnit : product.usageUnit;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const newDrafts: Record<string, string> = {};
    product.branches.forEach(b => { newDrafts[b.inventoryItemId] = String(b.stock); });
    setDrafts(newDrafts);
  }, [product]);

  const handleSave = async (b: BranchStockInfo) => {
    const draftStr = drafts[b.inventoryItemId];
    const newStock = Number(draftStr);
    if (Number.isNaN(newStock)) return;
    setSubmitting(b.inventoryItemId);
    const ok = await onAdjust(b, b.inventoryItemId, newStock, notes);
    setSubmitting(null);
    if (ok) setDrafts(prev => ({ ...prev, [b.inventoryItemId]: String(newStock) }));
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} style={{ maxWidth: '720px' }}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}><Box size={20} /> Edit Stok — {product.name}</h2>
            <p className={styles.modalSubtitle}>Atur stok manual untuk tiap cabang. Perubahan akan dicatat di riwayat mutasi stok.</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <div className={styles.form}>
          <div className={styles.stockInfoBox}>
            <span>⚡</span>
            <div>
              <strong>Auto-Deduct Aktif:</strong> Saat produk dipilih di sesi terapi (Step 6), stok cabang akan otomatis berkurang. Gunakan halaman ini hanya untuk koreksi stok (penambahan barang masuk, perbaikan inventory, dll).
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Catatan (opsional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mis: Stok masuk dari supplier, koreksi inventory bulanan, dll" />
            <p className={styles.hint}>Catatan ini akan menempel ke setiap perubahan stok yang Anda simpan.</p>
          </div>

          <div className={styles.stockEditHeader}>
            <h3 className={styles.formSectionTitle}><Building2 size={16} /> Stok per Cabang</h3>
            {product.conversionFactor !== 1 && (
              <div className={styles.unitToggle}>
                <button type="button" onClick={() => setUnitMode('base')} className={`${styles.unitToggleBtn} ${unitMode === 'base' ? styles.unitToggleBtnActive : ''}`}>
                  dalam {product.baseUnit}
                </button>
                <button type="button" onClick={() => setUnitMode('usage')} className={`${styles.unitToggleBtn} ${unitMode === 'usage' ? styles.unitToggleBtnActive : ''}`}>
                  dalam {product.usageUnit}
                </button>
              </div>
            )}
          </div>

          <div className={styles.stockEditTableHeader}>
            <span>Cabang</span>
            <span>Stok Saat Ini</span>
            <span>Stok Baru</span>
            <span>Sesi</span>
            <span></span>
          </div>

          <div className={styles.stockEditTable}>
            {product.branches.map(b => {
              const draft = drafts[b.inventoryItemId];
              const draftNum = Number(draft);
              const isDirty = !Number.isNaN(draftNum) && draftNum !== b.stock;
              const adjustmentBase = isDirty ? draftNum - b.stock : 0;
              const adjustmentDisplay = unitMode === 'usage' ? Math.round(adjustmentBase * product.conversionFactor) : adjustmentBase;
              const isLoadingThis = submitting === b.inventoryItemId;
              const currentStockDisplay = unitMode === 'usage' ? Math.round(b.stock * product.conversionFactor) : b.stock;
              const inputValue = unitMode === 'usage' ? (draft === '' ? '' : String(Math.round(Number(draft) * product.conversionFactor))) : draft;

              return (
                <div key={b.inventoryItemId} className={styles.stockEditRow}>
                  <div className={styles.stockEditBranch}>
                    <strong>{b.branchCode}</strong>
                    <span>{b.branchName}</span>
                  </div>
                  <div className={`${styles.stockEditCurrent} ${b.isOutOfStock ? styles.stockRed : b.isLowStock ? styles.stockYellow : styles.stockGreen}`}>
                    {b.isOutOfStock ? '🔴' : b.isLowStock ? '🟡' : '🟢'} {currentStockDisplay} {currentUnit}
                  </div>
                  <div className={styles.stockEditInput}>
                    <input
                      type="number"
                      min="0"
                      step={unitMode === 'usage' ? '1' : '0.01'}
                      value={inputValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') { setDrafts(prev => ({ ...prev, [b.inventoryItemId]: '' })); return; }
                        const numVal = Number(val);
                        if (Number.isNaN(numVal)) return;
                        const baseVal = unitMode === 'usage' ? numVal / product.conversionFactor : numVal;
                        setDrafts(prev => ({ ...prev, [b.inventoryItemId]: String(baseVal) }));
                      }}
                      disabled={isLoadingThis}
                    />
                    {isDirty && (
                      <span className={`${styles.adjustmentHint} ${adjustmentDisplay > 0 ? styles.adjustPositive : styles.adjustNegative}`}>
                        {adjustmentDisplay > 0 ? '+' : ''}{adjustmentDisplay}
                      </span>
                    )}
                  </div>
                  <div className={styles.stockEditUsage}>
                    {b.sessionUsageCount > 0 ? <span className={styles.stockGreen}><Zap size={14} /> {b.sessionUsageCount}x</span> : <span>—</span>}
                  </div>
                  <button onClick={() => handleSave(b)} disabled={!isDirty || isLoadingThis} className={styles.stockEditSaveBtn}>
                    {isLoadingThis ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.formActions}>
          <button onClick={onClose} className={styles.cancelBtn}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN TO BRANCH MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function AssignToBranchModal({ product, allBranches, onClose, onAssign }: {
  product: MasterProduct;
  allBranches: Array<{ id: string; branchCode: string; name: string }>;
  onClose: () => void;
  onAssign: (branchId: string, stock: number, minThreshold: number) => Promise<boolean>;
}) {
  const existingBranchIds = new Set(product.branches.map(b => b.branchId));
  const availableBranches = allBranches.filter(b => !existingBranchIds.has(b.id));
  
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [stock, setStock] = useState(0);
  const [minThreshold, setMinThreshold] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const selectAll = () => setSelectedBranches(new Set(availableBranches.map(b => b.id)));
  const deselectAll = () => setSelectedBranches(new Set());

  const handleSubmit = async () => {
    if (selectedBranches.size === 0) return;
    setSubmitting(true);
    let successCount = 0;
    for (const branchId of Array.from(selectedBranches)) {
      const ok = await onAssign(branchId, stock, minThreshold);
      if (ok) successCount++;
    }
    setSubmitting(false);
    if (successCount > 0) onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} style={{ maxWidth: '600px' }}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}><Plus size={20} /> Tambahkan ke Cabang</h2>
            <p className={styles.modalSubtitle}>{product.name}</p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}><X size={20} /></button>
        </div>

        <div className={styles.form}>
          {availableBranches.length === 0 ? (
            <div className={styles.assignComplete}>
              <div className={styles.assignCompleteIcon}>✅</div>
              <p>Produk ini sudah ada di semua cabang</p>
            </div>
          ) : (
            <>
              <div className={styles.formSection}>
                <h3 className={styles.formSectionTitle}><Box size={16} /> Pengaturan Stok Awal</h3>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Stok Awal ({product.baseUnit})</label>
                    <input type="number" min="0" value={stock} onChange={(e) => setStock(Number(e.target.value) || 0)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Min. Threshold ({product.baseUnit})</label>
                    <input type="number" min="0" value={minThreshold} onChange={(e) => setMinThreshold(Number(e.target.value) || 0)} />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <div className={styles.branchSelectionHeader}>
                  <h3 className={styles.formSectionTitle}><Building2 size={16} /> Pilih Cabang</h3>
                  <div className={styles.branchSelectionActions}>
                    <button type="button" onClick={selectAll} className={`${styles.branchSelectBtn} ${styles.branchSelectAll}`}>Pilih Semua</button>
                    <button type="button" onClick={deselectAll} className={`${styles.branchSelectBtn} ${styles.branchSelectNone}`}>Hapus Semua</button>
                  </div>
                </div>

                <div className={styles.branchGrid}>
                  {availableBranches.map(branch => (
                    <label key={branch.id} className={`${styles.branchCheckbox} ${selectedBranches.has(branch.id) ? styles.branchCheckboxSelected : ''}`}>
                      <input type="checkbox" checked={selectedBranches.has(branch.id)} onChange={() => toggleBranch(branch.id)} />
                      <div className={styles.branchCheckboxInfo}>
                        <span className={styles.branchCheckboxCode}>{branch.branchCode}</span>
                        <span className={styles.branchCheckboxName}>{branch.name}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <p className={styles.branchSelectionCount}>{selectedBranches.size} dari {availableBranches.length} cabang dipilih</p>
              </div>
            </>
          )}
        </div>

        {availableBranches.length > 0 && (
          <div className={styles.formActions}>
            <button onClick={onClose} disabled={submitting} className={styles.cancelBtn}>Batal</button>
            <button onClick={handleSubmit} disabled={submitting || selectedBranches.size === 0} className={styles.submitBtn}>
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Menambahkan...</> : <><Plus size={16} /> Tambahkan ke {selectedBranches.size} Cabang</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
