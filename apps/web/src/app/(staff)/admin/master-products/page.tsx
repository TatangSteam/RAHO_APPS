'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

interface MasterProduct {
  id: string;
  name: string;
  category: 'MEDICINE' | 'DEVICE' | 'CONSUMABLE';
  baseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  description: string | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
  name: string;
  category: string;
  baseUnit: string;
  usageUnit: string;
  conversionFactor: string;
  description: string;
}

const CATEGORIES = [
  { value: 'MEDICINE', label: 'Obat & Cairan' },
  { value: 'DEVICE', label: 'Alat Medis' },
  { value: 'CONSUMABLE', label: 'Bahan Habis Pakai' },
];

export default function MasterProductsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
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

  // Control body overflow when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('isActive', statusFilter);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
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
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
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
        throw new Error(error.message || 'Gagal menyimpan produk');
      }

      showToast.success(
        editingProduct ? 'Produk berhasil diupdate' : 'Produk berhasil ditambahkan'
      );
      handleCloseModal();
      loadProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      showToast.error(error.message || 'Gagal menyimpan produk');
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
          body: JSON.stringify({
            isActive: !product.isActive,
          }),
        }
      );

      if (!response.ok) throw new Error('Gagal mengubah status');

      showToast.success(`Produk ${product.isActive ? 'dinonaktifkan' : 'diaktifkan'}`);
      loadProducts();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      showToast.error(error.message || 'Gagal mengubah status');
    }
  };

  const handleDelete = async (product: MasterProduct) => {
    if (!confirm(`Yakin ingin menghapus produk "${product.name}"?`)) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/master-products/${product.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Gagal menghapus produk');
      }

      showToast.success('Produk berhasil dihapus');
      loadProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      showToast.error(error.message || 'Gagal menghapus produk');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.description?.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  // Modal content component
  const renderModal = () => {
    if (!showModal || !mounted) return null;

    const modalContent = (
      <div className={styles.modalOverlay} onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseModal();
        }
      }}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2>{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
            <button className={styles.closeBtn} onClick={handleCloseModal}>×</button>
          </div>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Nama Produk *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Contoh: Infus NaCl 0.9% (500ml)"
              />
            </div>

            <div className={styles.formGroup}>
              <label>Kategori *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Unit Penyimpanan *</label>
                <input
                  type="text"
                  value={formData.baseUnit}
                  onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                  required
                  placeholder="botol, box, pack"
                />
              </div>

              <div className={styles.formGroup}>
                <label>Unit Pemakaian *</label>
                <input
                  type="text"
                  value={formData.usageUnit}
                  onChange={(e) => setFormData({ ...formData, usageUnit: e.target.value })}
                  required
                  placeholder="ml, tablet, gram"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Faktor Konversi *</label>
              <input
                type="number"
                step="0.01"
                value={formData.conversionFactor}
                onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                required
                placeholder="500"
              />
              <small className={styles.hint}>
                1 {formData.baseUnit || 'unit penyimpanan'} = {formData.conversionFactor || '?'} {formData.usageUnit || 'unit pemakaian'}
              </small>
            </div>

            <div className={styles.formGroup}>
              <label>Deskripsi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Deskripsi produk (opsional)"
              />
            </div>

            <div className={styles.formActions}>
              <button type="button" onClick={handleCloseModal} className={styles.cancelBtn}>
                Batal
              </button>
              <button type="submit" className={styles.submitBtn}>
                {editingProduct ? 'Update' : 'Tambah'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data produk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>📦 Master Product</h1>
          <p className={styles.subtitle}>Kelola produk master untuk semua cabang</p>
        </div>
        <button className={styles.addButton} onClick={() => handleOpenModal()}>
          + Tambah Produk
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Semua Kategori</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Semua Status</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{products.length}</div>
          <div className={styles.statLabel}>Total Produk</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {products.filter(p => p.isActive).length}
          </div>
          <div className={styles.statLabel}>Aktif</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {products.filter(p => p.category === 'MEDICINE').length}
          </div>
          <div className={styles.statLabel}>Obat & Cairan</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>
            {products.filter(p => p.category === 'DEVICE').length}
          </div>
          <div className={styles.statLabel}>Alat Medis</div>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nama Produk</th>
              <th>Kategori</th>
              <th>Unit Penyimpanan</th>
              <th>Unit Pemakaian</th>
              <th>Konversi</th>
              <th>Digunakan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyState}>
                  Tidak ada produk ditemukan
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
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
                    <span className={`${styles.categoryBadge} ${styles[product.category.toLowerCase()]}`}>
                      {getCategoryLabel(product.category)}
                    </span>
                  </td>
                  <td>{product.baseUnit}</td>
                  <td>{product.usageUnit}</td>
                  <td>1 {product.baseUnit} = {product.conversionFactor} {product.usageUnit}</td>
                  <td>
                    <span className={styles.usageCount}>
                      {product.usageCount} cabang
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${product.isActive ? styles.active : styles.inactive}`}>
                      {product.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => handleOpenModal(product)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className={styles.toggleBtn}
                        onClick={() => handleToggleStatus(product)}
                        title={product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {product.isActive ? '🔴' : '🟢'}
                      </button>
                      {product.usageCount === 0 && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(product)}
                          title="Hapus"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal using createPortal */}
      {renderModal()}
    </div>
  );
}
