'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

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
  category: 'MEDICINE' | 'DEVICE' | 'CONSUMABLE';
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  description: string | null;
  isActive: boolean;
  usageCount: number; // = number of branches that have this product in inventory
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
  category: 'MEDICINE' | 'DEVICE' | 'CONSUMABLE';
  baseUnit: string;
  usageUnit: string;
  conversionFactor: string;
  description: string;
}

const CATEGORIES = [
  { value: 'MEDICINE', label: 'Obat & Cairan', icon: '💊', color: '#3b82f6' },
  { value: 'DEVICE', label: 'Alat Medis', icon: '🩺', color: '#a855f7' },
  { value: 'CONSUMABLE', label: 'Bahan Habis Pakai', icon: '🧴', color: '#10b981' },
] as const;

// Unit suggestions per category for better UX
const UNIT_SUGGESTIONS: Record<string, { base: string[]; usage: string[] }> = {
  MEDICINE: {
    base: ['botol', 'ampul', 'vial', 'flask', 'box', 'strip'],
    usage: ['ml', 'mg', 'tablet', 'kapsul', 'tetes'],
  },
  DEVICE: {
    base: ['unit', 'set', 'pcs', 'box'],
    usage: ['unit', 'pcs', 'pack'],
  },
  CONSUMABLE: {
    base: ['box', 'pack', 'roll', 'pcs'],
    usage: ['pcs', 'lembar', 'cm', 'gram'],
  },
};

// Quick templates for common items
const QUICK_TEMPLATES: Array<{
  label: string;
  category: 'MEDICINE' | 'DEVICE' | 'CONSUMABLE';
  baseUnit: string;
  usageUnit: string;
  conversionFactor: string;
}> = [
  { label: 'Cairan Infus 500ml', category: 'MEDICINE', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: '500' },
  { label: 'Cairan Infus 100ml', category: 'MEDICINE', baseUnit: 'botol', usageUnit: 'ml', conversionFactor: '100' },
  { label: 'Obat Tablet (1 strip = 10 tablet)', category: 'MEDICINE', baseUnit: 'strip', usageUnit: 'tablet', conversionFactor: '10' },
  { label: 'Alat Sekali Pakai', category: 'DEVICE', baseUnit: 'pcs', usageUnit: 'pcs', conversionFactor: '1' },
  { label: 'Sarung Tangan (1 box = 100 pcs)', category: 'CONSUMABLE', baseUnit: 'box', usageUnit: 'pcs', conversionFactor: '100' },
];

// ───────────────────────────────────────────────────────────
// AUTO-FILL MAPPING — Mirrors the logic in infusion.service.ts
// Products matching these patterns are AUTO-DEDUCTED from stock
// when staff fills out the Infusion form (Step 4/5).
// ───────────────────────────────────────────────────────────
const INFUSION_AUTO_FILL_MAPPING: Array<{
  field: string;
  label: string;
  namePattern: string;
  color: string;
}> = [
  // IFA - Wajib per sesi
  { field: 'ifa', label: 'IFA', namePattern: 'IFA', color: '#3b82f6' },
  // Infus Set - Wajib per sesi (otomatis 1 piece)
  { field: 'infusSet', label: 'Infus Set', namePattern: 'Infus Set', color: '#8b5cf6' },
  // Auto-fill fields (dari form infus aktual)
  { field: 'no', label: 'NO', namePattern: 'NB NO', color: '#ec4899' },
  { field: 'gaso', label: 'GASO', namePattern: 'Gasotransmitter', color: '#f59e0b' },
  { field: 'mb', label: 'MB', namePattern: 'Methyln Blue', color: '#6366f1' },
  { field: 'kcl', label: 'KCL', namePattern: 'KCL', color: '#f97316' },
  { field: 'h2s', label: 'H2S', namePattern: 'Cairan H2S', color: '#84cc16' },
  { field: 'o3', label: 'O3', namePattern: 'Ozone', color: '#14b8a6' },
  { field: 'o2', label: 'O2', namePattern: 'O2 (Oxygen)', color: '#10b981' },
  { field: 'edta', label: 'EDTA', namePattern: 'EDTA', color: '#a855f7' },
  // Manual fields (tetap deduct stock tapi dari form manual)
  { field: 'hho', label: 'HHO', namePattern: 'NB-HHO', color: '#06b6d4' },
];

/**
 * Check if a product name matches any infusion auto-fill pattern.
 * Returns the matched mapping if product is auto-filled from infusion form.
 */
function getAutoFillInfo(productName: string) {
  const lowerName = productName.toLowerCase();
  for (const mapping of INFUSION_AUTO_FILL_MAPPING) {
    if (lowerName.includes(mapping.namePattern.toLowerCase())) {
      return mapping;
    }
  }
  return null;
}

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
    name: '',
    category: 'MEDICINE',
    baseUnit: '',
    usageUnit: '',
    conversionFactor: '1',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Stock edit modal state
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockEditProduct, setStockEditProduct] = useState<MasterProduct | null>(null);

  // Assign to branch modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignProduct, setAssignProduct] = useState<MasterProduct | null>(null);
  const [allBranches, setAllBranches] = useState<Array<{ id: string; branchCode: string; name: string }>>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    if (user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak - Hanya untuk Super Admin');
      router.push('/dashboard');
      return;
    }
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken, categoryFilter, statusFilter]);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  // ESC closes modal
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) handleCloseModal();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      console.error('Error loading products:', error);
      showToast.error(error.message || 'Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (product?: MasterProduct) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        baseUnit: product.baseUnit,
        usageUnit: product.usageUnit,
        conversionFactor: product.conversionFactor.toString(),
        description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        category: 'MEDICINE',
        baseUnit: '',
        usageUnit: '',
        conversionFactor: '1',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setShowModal(false);
    setEditingProduct(null);
  };

  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[number]) => {
    setFormData(prev => ({
      ...prev,
      category: tpl.category,
      baseUnit: tpl.baseUnit,
      usageUnit: tpl.usageUnit,
      conversionFactor: tpl.conversionFactor,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      const url = editingProduct
        ? `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products/${editingProduct.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products`;
      const method = editingProduct ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          conversionFactor: parseFloat(formData.conversionFactor),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error?.message || 'Gagal menyimpan produk');
      }
      showToast.success(editingProduct ? 'Produk berhasil diupdate' : 'Produk berhasil ditambahkan');
      handleCloseModal();
      loadProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      showToast.error(error.message || 'Gagal menyimpan produk');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (product: MasterProduct) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products/${product.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isActive: !product.isActive }),
        }
      );
      if (!response.ok) throw new Error('Gagal mengubah status');
      showToast.success(`Produk ${product.isActive ? 'dinonaktifkan' : 'diaktifkan'}`);
      loadProducts();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal mengubah status');
    }
  };

  const handleDelete = async (product: MasterProduct) => {
    if (!confirm(`Yakin ingin menghapus produk "${product.name}"?\n\nProduk ini tidak digunakan oleh cabang manapun, jadi aman untuk dihapus.`)) return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products/${product.id}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
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

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('');
  };

  // ── Stock edit handlers ───────────────────────────────────
  const openStockModal = (product: MasterProduct) => {
    setStockEditProduct(product);
    setStockModalOpen(true);
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
    setStockEditProduct(null);
  };

  // ── Assign to branch handlers ─────────────────────────────
  const loadAllBranches = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/branches`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (!response.ok) throw new Error('Gagal memuat cabang');
      const result = await response.json();
      setAllBranches(result.data || []);
    } catch (error: any) {
      console.error('Error loading branches:', error);
    }
  };

  const openAssignModal = (product: MasterProduct) => {
    setAssignProduct(product);
    setAssignModalOpen(true);
    if (allBranches.length === 0) {
      loadAllBranches();
    }
  };

  const closeAssignModal = () => {
    setAssignModalOpen(false);
    setAssignProduct(null);
  };

  /**
   * Assign product to a branch by creating inventory item
   */
  const handleAssignToBranch = async (
    branchId: string,
    stock: number,
    minThreshold: number
  ): Promise<boolean> => {
    if (!assignProduct) return false;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/items`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            masterProductId: assignProduct.id,
            branchId,
            stock,
            minThreshold,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || err.message || 'Gagal menambahkan ke cabang');
      }
      showToast.success(`Produk berhasil ditambahkan ke cabang`);
      await loadProducts();
      return true;
    } catch (e: any) {
      showToast.error(e.message || 'Gagal menambahkan ke cabang');
      return false;
    }
  };

  /**
   * Adjust stock for a specific branch's inventory item.
   * Calls existing PATCH /inventory/items/:itemId/adjust-stock
   */
  const handleAdjustStock = async (
    branchInfo: BranchStockInfo,
    inventoryItemId: string,
    newStock: number,
    notes: string
  ): Promise<boolean> => {
    if (newStock < 0) {
      showToast.error('Stok tidak boleh negatif');
      return false;
    }
    const adjustment = newStock - branchInfo.stock;
    if (adjustment === 0) {
      showToast.error('Tidak ada perubahan stok');
      return false;
    }
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/inventory/items/${inventoryItemId}/adjust-stock`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adjustment, notes: notes || undefined }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || err.message || 'Gagal mengubah stok');
      }
      showToast.success(
        `Stok ${branchInfo.branchCode} berhasil diubah: ${branchInfo.stock} → ${newStock} ${stockEditProduct?.baseUnit ?? ''}`
      );
      
      // Reload products and update stockEditProduct with fresh data
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('isActive', statusFilter);
      const refreshResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (refreshResponse.ok) {
        const result = await refreshResponse.json();
        const updatedProducts = result.data.products || [];
        setProducts(updatedProducts);
        
        // Update stockEditProduct with fresh data
        if (stockEditProduct) {
          const updatedProduct = updatedProducts.find((p: MasterProduct) => p.id === stockEditProduct.id);
          if (updatedProduct) {
            setStockEditProduct(updatedProduct);
          }
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
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.baseUnit.toLowerCase().includes(q) ||
      p.usageUnit.toLowerCase().includes(q)
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

  const getCategoryMeta = (category: string) =>
    CATEGORIES.find(c => c.value === category) || CATEGORIES[0];

  const hasActiveFilters = !!(search || categoryFilter || statusFilter);

  // ──────────────────────────────────────────────────────────
  // MODAL
  // ──────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!showModal || !mounted) return null;
    const conv = parseFloat(formData.conversionFactor || '0') || 0;
    const isValidConv = conv > 0;
    const cat = getCategoryMeta(formData.category);
    const suggestions = UNIT_SUGGESTIONS[formData.category] || UNIT_SUGGESTIONS.MEDICINE;

    const modalContent = (
      <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
        <div className={styles.modal}>
          <div className={styles.modalHeader} style={{ borderTopColor: cat.color }}>
            <div>
              <h2>
                <span style={{ marginRight: '8px' }}>{editingProduct ? '✏️' : '➕'}</span>
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <p className={styles.modalSubtitle}>
                {editingProduct
                  ? `Mengubah data produk: ${editingProduct.name}`
                  : 'Buat produk master baru yang bisa dipakai semua cabang'}
              </p>
            </div>
            <button className={styles.closeBtn} onClick={handleCloseModal} aria-label="Tutup">×</button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* QUICK TEMPLATES */}
            {!editingProduct && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>⚡ Template Cepat</div>
                <p className={styles.sectionHint}>Klik untuk auto-isi unit & konversi</p>
                <div className={styles.templateChips}>
                  {QUICK_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={styles.templateChip}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION: BASIC INFO */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>📝 Informasi Dasar</div>

              <div className={styles.formGroup}>
                <label>Nama Produk <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Contoh: Infus NaCl 0.9% (500ml)"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Kategori <span className={styles.required}>*</span></label>
                <div className={styles.categoryPicker}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: c.value })}
                      className={`${styles.categoryOption} ${formData.category === c.value ? styles.categoryOptionActive : ''}`}
                      style={formData.category === c.value ? { borderColor: c.color, background: `${c.color}1a` } : {}}
                    >
                      <span className={styles.categoryIcon}>{c.icon}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION: UNITS */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>📏 Satuan & Konversi</div>
              <p className={styles.sectionHint}>
                Tentukan unit penyimpanan (saat beli) dan unit pemakaian (saat dipakai pasien)
              </p>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Unit Penyimpanan <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={formData.baseUnit}
                    onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                    required
                    placeholder="botol, box, pack..."
                    list="base-unit-suggestions"
                  />
                  <datalist id="base-unit-suggestions">
                    {suggestions.base.map(u => <option key={u} value={u} />)}
                  </datalist>
                  <div className={styles.unitChips}>
                    {suggestions.base.map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setFormData({ ...formData, baseUnit: u })}
                        className={`${styles.unitChip} ${formData.baseUnit === u ? styles.unitChipActive : ''}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Unit Pemakaian <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={formData.usageUnit}
                    onChange={(e) => setFormData({ ...formData, usageUnit: e.target.value })}
                    required
                    placeholder="ml, tablet, gram..."
                    list="usage-unit-suggestions"
                  />
                  <datalist id="usage-unit-suggestions">
                    {suggestions.usage.map(u => <option key={u} value={u} />)}
                  </datalist>
                  <div className={styles.unitChips}>
                    {suggestions.usage.map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setFormData({ ...formData, usageUnit: u })}
                        className={`${styles.unitChip} ${formData.usageUnit === u ? styles.unitChipActive : ''}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Faktor Konversi <span className={styles.required}>*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.conversionFactor}
                  onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                  required
                  placeholder="500"
                />
                <div className={`${styles.conversionPreview} ${isValidConv ? styles.conversionValid : styles.conversionWarning}`}>
                  <span className={styles.conversionIcon}>{isValidConv ? '✅' : '⚠️'}</span>
                  <div>
                    <strong>1 {formData.baseUnit || '...'}</strong>
                    <span className={styles.conversionEqual}>=</span>
                    <strong>{formData.conversionFactor || '?'} {formData.usageUnit || '...'}</strong>
                  </div>
                </div>
                <small className={styles.hint}>
                  💡 Isi <b>1</b> kalau unit penyimpanan = unit pemakaian (mis. alat sekali pakai)
                </small>
              </div>
            </div>

            {/* SECTION: DESCRIPTION */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>💬 Deskripsi (Opsional)</div>
              <div className={styles.formGroup}>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Catatan tambahan, merek, aturan pakai..."
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={handleCloseModal} className={styles.cancelBtn} disabled={submitting}>
                Batal
              </button>
              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? '⏳ Menyimpan...' : (editingProduct ? '💾 Update Produk' : '➕ Tambah Produk')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };

  if (!mounted) return null;

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>📦 Master Produk</h1>
          <p className={styles.subtitle}>Kelola produk master untuk semua cabang</p>
        </div>
        <button className={styles.addButton} onClick={() => handleOpenModal()}>
          ➕ Tambah Produk
        </button>
      </div>

      {/* Info banner about auto-deduct behavior */}
      <div className={styles.infoBanner}>
        <span className={styles.infoBannerIcon}>💡</span>
        <div>
          <strong>Cara kerja stok & sesi terapi:</strong>
          <ul className={styles.infoBannerList}>
            <li>
              📦 Stok dikelola <strong>per cabang</strong>. Klik tombol{' '}
              <span className={styles.infoBadge}>📦 Stok</span> untuk edit manual.
            </li>
            <li>
              🔗 Produk dengan badge <span className={styles.infoBadge} style={{ background: '#3b82f620', color: '#3b82f6' }}>🔗 Auto-fill</span>{' '}
              terhubung ke <strong>form Infus Aktual (Step 4/5)</strong> — stok otomatis
              terpotong saat staff mengisi infus, tanpa perlu input manual.
            </li>
            <li>
              ⚡ Produk dengan badge <span className={styles.infoBadge} style={{ background: '#10b98120', color: '#10b981' }}>⚡ Auto-deduct</span>{' '}
              dipotong saat staff menambah di <strong>Step 6 - Material Usage</strong> secara
              manual.
            </li>
            <li>
              🔴 Cabang dengan <strong>stok habis</strong> tidak bisa pakai produk di sesi —
              perlu top-up stok terlebih dahulu.
            </li>
            <li>
              📜 Setiap perubahan stok (manual & auto-deduct) dicatat di tabel mutasi stok.
            </li>
          </ul>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={`${styles.statCard} ${styles.statTotal}`}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{products.length}</div>
            <div className={styles.statLabel}>Total Produk</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.statActive}`}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statBody}>
            <div className={styles.statValue}>{products.filter(p => p.isActive).length}</div>
            <div className={styles.statLabel}>Aktif</div>
          </div>
        </div>
        {CATEGORIES.map(c => {
          const count = products.filter(p => p.category === c.value).length;
          return (
            <div
              key={c.value}
              className={styles.statCard}
              style={{ borderLeftColor: c.color, cursor: 'pointer' }}
              onClick={() => setCategoryFilter(categoryFilter === c.value ? '' : c.value)}
              title={`Klik untuk filter: ${c.label}`}
            >
              <div className={styles.statIcon} style={{ color: c.color }}>{c.icon}</div>
              <div className={styles.statBody}>
                <div className={styles.statValue} style={{ color: c.color }}>{count}</div>
                <div className={styles.statLabel}>{c.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters & Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Cari produk, deskripsi, atau unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className={styles.clearSearchBtn} aria-label="Hapus pencarian">×</button>
          )}
        </div>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={styles.filterSelect}>
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.filterSelect}>
          <option value="">Semua Status</option>
          <option value="true">✅ Aktif</option>
          <option value="false">⛔ Nonaktif</option>
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={styles.filterSelect}>
          <option value="name">↕ Urut: Nama (A-Z)</option>
          <option value="category">↕ Urut: Kategori</option>
          <option value="usage">↕ Urut: Paling banyak dipakai</option>
          <option value="recent">↕ Urut: Terbaru</option>
        </select>

        <div className={styles.viewToggle} role="group" aria-label="Mode tampilan">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
            title="Tampilan tabel"
          >▤</button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
            title="Tampilan kartu"
          >▦</button>
        </div>
      </div>

      {/* Active filter feedback */}
      {hasActiveFilters && (
        <div className={styles.filterBar}>
          <span className={styles.filterBarLabel}>Filter aktif:</span>
          {search && <span className={styles.filterChip}>🔍 "{search}" <button onClick={() => setSearch('')}>×</button></span>}
          {categoryFilter && (
            <span className={styles.filterChip}>
              {getCategoryMeta(categoryFilter).icon} {getCategoryMeta(categoryFilter).label}
              <button onClick={() => setCategoryFilter('')}>×</button>
            </span>
          )}
          {statusFilter && (
            <span className={styles.filterChip}>
              {statusFilter === 'true' ? '✅ Aktif' : '⛔ Nonaktif'}
              <button onClick={() => setStatusFilter('')}>×</button>
            </span>
          )}
          <button type="button" onClick={clearFilters} className={styles.clearAllBtn}>Bersihkan semua</button>
        </div>
      )}

      {/* Result count */}
      <div className={styles.resultCount}>
        Menampilkan <strong>{filteredProducts.length}</strong> dari <strong>{products.length}</strong> produk
      </div>

      {/* Loading */}
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data produk...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        // Empty state
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>{hasActiveFilters ? '🔍' : '📦'}</div>
          <h3>{hasActiveFilters ? 'Tidak ada hasil' : 'Belum ada produk'}</h3>
          <p>
            {hasActiveFilters
              ? 'Coba ubah kata kunci pencarian atau hapus filter.'
              : 'Mulai dengan menambahkan produk master pertama Anda.'}
          </p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className={styles.cancelBtn}>Bersihkan filter</button>
          ) : (
            <button onClick={() => handleOpenModal()} className={styles.submitBtn}>➕ Tambah Produk Pertama</button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        // TABLE VIEW
        <div className={styles.tableContainer}>
          <table className={styles.table}>
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
                      <div className={styles.productName}>
                        <strong>{product.name}</strong>
                        {product.description && (
                          <span className={styles.productDesc}>{product.description}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={styles.categoryBadge}
                        style={{ background: `${cat.color}1a`, color: cat.color, borderColor: `${cat.color}55` }}
                      >
                        {cat.icon} {cat.label}
                      </span>
                    </td>
                    <td>
                      <div className={styles.conversionCell}>
                        <strong>1 {product.baseUnit}</strong>
                        <span className={styles.conversionEqual}>=</span>
                        <strong>{product.conversionFactor} {product.usageUnit}</strong>
                      </div>
                    </td>
                    <td>
                      <BranchStockSummary product={product} />
                    </td>
                    <td>
                      <SessionUsageBadge product={product} />
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${product.isActive ? styles.active : styles.inactive}`}>
                        {product.isActive ? '✅ Aktif' : '⛔ Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => handleOpenModal(product)} title="Edit produk">✏️</button>
                        <button
                          className={styles.stockBtn}
                          onClick={() => openStockModal(product)}
                          disabled={product.usageCount === 0}
                          title={product.usageCount === 0 ? 'Belum ada cabang yang stok produk ini' : 'Edit stok per cabang'}
                        >
                          📦
                        </button>
                        <button
                          className={styles.stockBtn}
                          onClick={() => openAssignModal(product)}
                          title="Tambahkan ke cabang baru"
                        >
                          ➕
                        </button>
                        <button
                          className={styles.toggleBtn}
                          onClick={() => handleToggleStatus(product)}
                          title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {product.isActive ? '🔴' : '🟢'}
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => product.usageCount === 0 ? handleDelete(product) : showToast.error(`Tidak bisa hapus: digunakan oleh ${product.usageCount} cabang`)}
                          disabled={product.usageCount > 0}
                          title={product.usageCount === 0 ? 'Hapus' : `Tidak bisa hapus - digunakan oleh ${product.usageCount} cabang`}
                        >
                          🗑️
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
        // GRID VIEW
        <div className={styles.grid}>
          {filteredProducts.map(product => {
            const cat = getCategoryMeta(product.category);
            return (
              <div
                key={product.id}
                className={styles.gridCard}
                style={{ borderTopColor: cat.color }}
              >
                <div className={styles.gridCardHeader}>
                  <span
                    className={styles.categoryBadge}
                    style={{ background: `${cat.color}1a`, color: cat.color, borderColor: `${cat.color}55` }}
                  >
                    {cat.icon} {cat.label}
                  </span>
                  <span className={`${styles.statusBadge} ${product.isActive ? styles.active : styles.inactive}`}>
                    {product.isActive ? '✅' : '⛔'}
                  </span>
                </div>
                <h4 className={styles.gridCardTitle}>{product.name}</h4>
                {product.description && <p className={styles.gridCardDesc}>{product.description}</p>}
                <div className={styles.gridCardMeta}>
                  <div className={styles.gridConversion}>
                    <span>1 {product.baseUnit}</span>
                    <span className={styles.conversionEqual}>=</span>
                    <span>{product.conversionFactor} {product.usageUnit}</span>
                  </div>
                </div>
                <div className={styles.gridStockRow}>
                  <BranchStockSummary product={product} />
                  <SessionUsageBadge product={product} />
                </div>
                <div className={styles.gridActions}>
                  <button className={styles.editBtn} onClick={() => handleOpenModal(product)} title="Edit produk">✏️ Edit</button>
                  <button
                    className={styles.stockBtn}
                    onClick={() => openStockModal(product)}
                    disabled={product.usageCount === 0}
                    title={product.usageCount === 0 ? 'Belum ada cabang yang stok produk ini' : 'Edit stok per cabang'}
                  >
                    📦 Stok
                  </button>
                  <button
                    className={styles.stockBtn}
                    onClick={() => openAssignModal(product)}
                    title="Tambahkan ke cabang baru"
                  >
                    ➕ Cabang
                  </button>
                  <button
                    className={styles.toggleBtn}
                    onClick={() => handleToggleStatus(product)}
                    title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {product.isActive ? '🔴' : '🟢'}
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => product.usageCount === 0 ? handleDelete(product) : showToast.error(`Tidak bisa hapus: digunakan oleh ${product.usageCount} cabang`)}
                    disabled={product.usageCount > 0}
                    title={product.usageCount === 0 ? 'Hapus' : `Tidak bisa hapus - digunakan oleh ${product.usageCount} cabang`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderModal()}

      {/* Stock Edit Modal (Super Admin can edit any branch) */}
      {stockModalOpen && stockEditProduct && mounted && createPortal(
        <StockEditModal
          product={stockEditProduct}
          onClose={closeStockModal}
          onAdjust={handleAdjustStock}
        />,
        document.body
      )}

      {/* Assign to Branch Modal */}
      {assignModalOpen && assignProduct && mounted && createPortal(
        <AssignToBranchModal
          product={assignProduct}
          allBranches={allBranches}
          onClose={closeAssignModal}
          onAssign={handleAssignToBranch}
        />,
        document.body
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ───────────────────────────────────────────────────────────

/**
 * Shows total branches that stock the product + warning indicators
 * for low/out-of-stock, plus a hover tooltip with per-branch breakdown.
 */
function BranchStockSummary({ product }: { product: MasterProduct }) {
  const [open, setOpen] = useState(false);

  if (product.usageCount === 0) {
    return (
      <span className={styles.emptyBranchBadge} title="Belum ada cabang yang punya stok produk ini">
        🚫 Belum ada cabang
      </span>
    );
  }

  return (
    <div
      className={styles.branchSummary}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={styles.branchSummaryBtn}
      >
        🏢 <strong>{product.usageCount}</strong> cabang
        <span className={styles.branchTotalStock}>
          ({product.totalStock.toLocaleString('id-ID')} {product.baseUnit})
        </span>
      </button>

      <div className={styles.branchBadgeRow}>
        {product.outOfStockBranches > 0 && (
          <span
            className={`${styles.stockMiniBadge} ${styles.stockOut}`}
            title={`${product.outOfStockBranches} cabang stoknya habis`}
          >
            🔴 {product.outOfStockBranches} habis
          </span>
        )}
        {product.lowStockBranches > 0 && product.lowStockBranches !== product.outOfStockBranches && (
          <span
            className={`${styles.stockMiniBadge} ${styles.stockLow}`}
            title={`${product.lowStockBranches} cabang stoknya menipis (di bawah threshold)`}
          >
            🟡 {product.lowStockBranches} menipis
          </span>
        )}
      </div>

      {open && (
        <div className={styles.branchPopover}>
          <div className={styles.branchPopoverTitle}>📦 Stok per Cabang</div>
          <div className={styles.branchPopoverList}>
            {product.branches.map(b => (
              <div key={b.branchId} className={styles.branchRow}>
                <span className={styles.branchRowName}>
                  <strong>{b.branchCode}</strong> {b.branchName}
                </span>
                <span
                  className={`${styles.branchRowStock} ${
                    b.isOutOfStock ? styles.stockOutText :
                    b.isLowStock ? styles.stockLowText : ''
                  }`}
                >
                  {b.isOutOfStock ? '🔴' : b.isLowStock ? '🟡' : '🟢'}{' '}
                  {b.stock.toLocaleString('id-ID')} {product.baseUnit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shows whether the product is auto-deducted in therapy sessions
 * (based on accumulated MaterialUsage records).
 */
function SessionUsageBadge({ product }: { product: MasterProduct }) {
  const autoFill = getAutoFillInfo(product.name);

  // If product is auto-filled from Infusion form, show special badge
  if (autoFill) {
    const usageCount = product.totalSessionUsage;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span
          className={`${styles.sessionBadge} ${styles.sessionUsed}`}
          title={`🔗 Auto-fill dari form Infus Aktual (Step 4/5)\nField: ${autoFill.label}\nStok otomatis terpotong saat staff mengisi infus.\n\nTotal pemakaian tercatat: ${usageCount}x`}
          style={{
            background: `${autoFill.color}20`,
            color: autoFill.color,
            borderColor: `${autoFill.color}55`,
            border: '1px solid',
          }}
        >
          🔗 Auto-fill: {autoFill.label}
          {usageCount > 0 && (
            <span className={styles.sessionUsageCount}>{usageCount}x</span>
          )}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            fontStyle: 'italic',
            paddingLeft: '4px',
          }}
        >
          dari form Infus
        </span>
      </div>
    );
  }

  // Otherwise show normal Material Usage badge
  if (product.isUsedInSessions) {
    return (
      <span
        className={`${styles.sessionBadge} ${styles.sessionUsed}`}
        title={`Otomatis dipotong dari stok saat dipakai di Step 6 - Material Usage.\nTotal pemakaian tercatat: ${product.totalSessionUsage}x`}
      >
        ⚡ Auto-deduct
        <span className={styles.sessionUsageCount}>{product.totalSessionUsage}x</span>
      </span>
    );
  }
  return (
    <span
      className={`${styles.sessionBadge} ${styles.sessionUnused}`}
      title="Produk siap dipakai di Step 6 - Material Usage. Stok akan otomatis terpotong saat dipilih."
    >
      ⏳ Manual (Step 6)
    </span>
  );
}

// ───────────────────────────────────────────────────────────
// STOCK EDIT MODAL — set new stock per branch with audit trail
// ───────────────────────────────────────────────────────────

function StockEditModal({
  product,
  onClose,
  onAdjust,
}: {
  product: MasterProduct;
  onClose: () => void;
  onAdjust: (
    branchInfo: BranchStockInfo,
    inventoryItemId: string,
    newStock: number,
    notes: string
  ) => Promise<boolean>;
}) {
  // Unit mode: 'base' (e.g., kotak) or 'usage' (e.g., ml)
  const [unitMode, setUnitMode] = useState<'base' | 'usage'>('base');
  
  // Local state: per-branch new value being typed (always stored in base unit)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.branches.forEach(b => { initial[b.inventoryItemId] = String(b.stock); });
    return initial;
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  
  // Get current unit label
  const currentUnit = unitMode === 'base' ? product.baseUnit : product.usageUnit;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const handleSave = async (b: BranchStockInfo) => {
    const draftStr = drafts[b.inventoryItemId];
    const newStock = Number(draftStr);
    if (Number.isNaN(newStock)) return;
    setSubmitting(b.inventoryItemId);
    const ok = await onAdjust(b, b.inventoryItemId, newStock, notes);
    setSubmitting(null);
    // do not close — let user adjust other branches if needed
    if (ok) {
      // Update draft to match new stock so input no longer "dirty"
      setDrafts(prev => ({ ...prev, [b.inventoryItemId]: String(newStock) }));
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} style={{ maxWidth: '720px' }}>
        <div className={styles.modalHeader}>
          <div>
            <h2>📦 Edit Stok — {product.name}</h2>
            <p className={styles.modalSubtitle}>
              Atur stok manual untuk tiap cabang. Perubahan akan dicatat di riwayat mutasi stok.
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">×</button>
        </div>

        <div className={styles.form}>
          {/* Auto-deduct info */}
          <div className={styles.stockInfoBox}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚡</span>
            <div>
              <strong style={{ color: '#10b981' }}>Auto-Deduct Aktif:</strong>{' '}
              Saat produk dipilih di sesi terapi (Step 6), stok cabang akan otomatis berkurang.
              Tidak perlu update manual untuk pemakaian normal — gunakan halaman ini hanya untuk
              koreksi stok (penambahan barang masuk, perbaikan inventory, dll).
            </div>
          </div>

          {/* Notes (shared across all branch edits in this session) */}
          <div className={styles.formGroup}>
            <label>Catatan (opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mis: Stok masuk dari supplier, koreksi inventory bulanan, dll"
            />
            <small className={styles.hint}>
              Catatan ini akan menempel ke setiap perubahan stok yang Anda simpan.
            </small>
          </div>

          {/* Per-branch table */}
          <div className={styles.sectionTitle} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🏢 Stok per Cabang</span>
            {/* Unit Toggle */}
            {product.conversionFactor !== 1 && (
              <div style={{
                display: 'flex',
                background: 'var(--surface-secondary, #1e293b)',
                borderRadius: '6px',
                padding: '2px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => setUnitMode('base')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: unitMode === 'base' ? 'var(--primary, #3b82f6)' : 'transparent',
                    color: unitMode === 'base' ? 'white' : 'var(--text-muted, #94a3b8)',
                    transition: 'all 0.2s'
                  }}
                >
                  dalam {product.baseUnit}
                </button>
                <button
                  type="button"
                  onClick={() => setUnitMode('usage')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: unitMode === 'usage' ? 'var(--primary, #3b82f6)' : 'transparent',
                    color: unitMode === 'usage' ? 'white' : 'var(--text-muted, #94a3b8)',
                    transition: 'all 0.2s'
                  }}
                >
                  dalam {product.usageUnit}
                </button>
              </div>
            )}
          </div>
          <div className={styles.stockEditTable}>
            <div className={styles.stockEditHeader}>
              <span>Cabang</span>
              <span>Stok Saat Ini</span>
              <span>Stok Baru</span>
              <span>Sesi</span>
              <span></span>
            </div>
            {product.branches.map(b => {
              const draft = drafts[b.inventoryItemId];
              const draftNum = Number(draft);
              const isDirty = !Number.isNaN(draftNum) && draftNum !== b.stock;
              // Calculate adjustment in base unit for display
              const adjustmentBase = isDirty ? draftNum - b.stock : 0;
              // Convert adjustment to display unit
              const adjustmentDisplay = unitMode === 'usage' 
                ? Math.round(adjustmentBase * product.conversionFactor) 
                : adjustmentBase;
              const isLoadingThis = submitting === b.inventoryItemId;
              
              // Display values based on unit mode
              const currentStockDisplay = unitMode === 'usage' 
                ? Math.round(b.stock * product.conversionFactor) 
                : b.stock;
              const inputValue = unitMode === 'usage'
                ? (draft === '' ? '' : String(Math.round(Number(draft) * product.conversionFactor)))
                : draft;

              return (
                <div key={b.inventoryItemId} className={styles.stockEditRow}>
                  <span className={styles.stockEditBranch}>
                    <strong>{b.branchCode}</strong>
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{b.branchName}</span>
                  </span>
                  <span
                    className={`${styles.stockEditCurrent} ${
                      b.isOutOfStock ? styles.stockOutText :
                      b.isLowStock ? styles.stockLowText : ''
                    }`}
                    title={`Threshold minimum: ${b.minThreshold} ${product.baseUnit}`}
                  >
                    {b.isOutOfStock ? '🔴' : b.isLowStock ? '🟡' : '🟢'}{' '}
                    {currentStockDisplay} {currentUnit}
                  </span>
                  <span className={styles.stockEditInput}>
                    <input
                      type="number"
                      min="0"
                      step={unitMode === 'usage' ? '1' : '0.01'}
                      value={inputValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setDrafts(prev => ({ ...prev, [b.inventoryItemId]: '' }));
                          return;
                        }
                        const numVal = Number(val);
                        if (Number.isNaN(numVal)) return;
                        // Convert to base unit for storage
                        const baseVal = unitMode === 'usage' 
                          ? numVal / product.conversionFactor 
                          : numVal;
                        setDrafts(prev => ({ ...prev, [b.inventoryItemId]: String(baseVal) }));
                      }}
                      disabled={isLoadingThis}
                    />
                    {isDirty && (
                      <span className={`${styles.adjustmentHint} ${adjustmentDisplay > 0 ? styles.adjustPositive : styles.adjustNegative}`}>
                        {adjustmentDisplay > 0 ? '+' : ''}{adjustmentDisplay}
                      </span>
                    )}
                  </span>
                  <span className={styles.stockEditUsage} title="Total kali produk ini dipotong otomatis di sesi terapi">
                    {b.sessionUsageCount > 0 ? (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>⚡ {b.sessionUsageCount}x</span>
                    ) : (
                      <span style={{ color: '#64748b' }}>—</span>
                    )}
                  </span>
                  <button
                    className={styles.submitBtn}
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                    disabled={!isDirty || isLoadingThis}
                    onClick={() => handleSave(b)}
                  >
                    {isLoadingThis ? '⏳' : '💾 Simpan'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// ASSIGN TO BRANCH MODAL — add product to new branches
// ───────────────────────────────────────────────────────────

function AssignToBranchModal({
  product,
  allBranches,
  onClose,
  onAssign,
}: {
  product: MasterProduct;
  allBranches: Array<{ id: string; branchCode: string; name: string }>;
  onClose: () => void;
  onAssign: (branchId: string, stock: number, minThreshold: number) => Promise<boolean>;
}) {
  // Get branches that don't have this product yet
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

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedBranches(new Set(availableBranches.map(b => b.id)));
  };

  const deselectAll = () => {
    setSelectedBranches(new Set());
  };

  const handleSubmit = async () => {
    if (selectedBranches.size === 0) return;
    setSubmitting(true);
    
    let successCount = 0;
    for (const branchId of Array.from(selectedBranches)) {
      const ok = await onAssign(branchId, stock, minThreshold);
      if (ok) successCount++;
    }
    
    setSubmitting(false);
    if (successCount > 0) {
      onClose();
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} style={{ maxWidth: '600px' }}>
        <div className={styles.modalHeader}>
          <div>
            <h2>➕ Tambahkan ke Cabang — {product.name}</h2>
            <p className={styles.modalSubtitle}>
              Pilih cabang yang ingin ditambahkan produk ini
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">×</button>
        </div>

        <div className={styles.form}>
          {availableBranches.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted, #94a3b8)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <div style={{ fontSize: '16px', fontWeight: 500 }}>
                Produk ini sudah ada di semua cabang
              </div>
            </div>
          ) : (
            <>
              {/* Stock settings */}
              <div className={styles.section}>
                <div className={styles.sectionTitle}>📦 Pengaturan Stok Awal</div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label>Stok Awal ({product.baseUnit})</label>
                    <input
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className={styles.formGroup} style={{ flex: 1 }}>
                    <label>Min. Threshold ({product.baseUnit})</label>
                    <input
                      type="number"
                      min="0"
                      value={minThreshold}
                      onChange={(e) => setMinThreshold(Number(e.target.value) || 0)}
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>

              {/* Branch selection */}
              <div className={styles.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className={styles.sectionTitle} style={{ margin: 0 }}>🏢 Pilih Cabang</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={selectAll}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        background: 'rgba(148, 163, 184, 0.15)',
                        color: '#94a3b8',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Hapus Semua
                    </button>
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '8px',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  padding: '4px'
                }}>
                  {availableBranches.map(branch => (
                    <label
                      key={branch.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: selectedBranches.has(branch.id) 
                          ? 'rgba(34, 197, 94, 0.15)' 
                          : 'var(--surface-secondary, #1e293b)',
                        border: `2px solid ${selectedBranches.has(branch.id) ? '#22c55e' : 'transparent'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBranches.has(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        style={{ width: '18px', height: '18px', accentColor: '#22c55e' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                          {branch.branchCode}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                          {branch.name}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                
                <div style={{ 
                  marginTop: '12px', 
                  fontSize: '13px', 
                  color: 'var(--text-muted, #94a3b8)' 
                }}>
                  {selectedBranches.size} dari {availableBranches.length} cabang dipilih
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={onClose} className={styles.cancelBtn} disabled={submitting}>
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className={styles.submitBtn}
                  disabled={submitting || selectedBranches.size === 0}
                >
                  {submitting ? '⏳ Menambahkan...' : `➕ Tambahkan ke ${selectedBranches.size} Cabang`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
