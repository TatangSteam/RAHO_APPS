'use client';

import { useState, useEffect } from 'react';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { useAuthStore } from '@/stores/authStore';
import styles from './page.module.css';

interface StockMutation {
  id: string;
  type: string;
  quantity: string;
  stockBefore: string;
  stockAfter: string;
  notes: string | null;
  createdAt: string;
  inventoryItem: {
    id: string;
    masterProduct: {
      name: string;
      sku: string;
      category: string;
    };
    branch: {
      name: string;
    };
  };
  referenceInfo: {
    type: 'session' | 'shipment';
    id: string;
    sessionCode?: string;
    memberName?: string;
    treatmentDate?: string;
    shipmentCode?: string;
    from?: string;
    to?: string;
  } | null;
  createdByName: string;
}

const MUTATION_TYPES = [
  { value: '', label: 'Semua Tipe' },
  { value: 'USED', label: 'Digunakan' },
  { value: 'RECEIVED', label: 'Diterima' },
  { value: 'ADJUSTED', label: 'Penyesuaian' },
  { value: 'RETURNED', label: 'Dikembalikan' },
];

const TYPE_LABELS: Record<string, string> = {
  USED: 'Digunakan',
  RECEIVED: 'Diterima',
  ADJUSTED: 'Penyesuaian',
  RETURNED: 'Dikembalikan',
};

const TYPE_COLORS: Record<string, string> = {
  USED: 'red',
  RECEIVED: 'green',
  ADJUSTED: 'blue',
  RETURNED: 'orange',
};

export default function StockMutationsPage() {
  const { user } = useAuthStore();
  const [mutations, setMutations] = useState<StockMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });

  // Load mutations
  useEffect(() => {
    loadMutations();
  }, [filters]);

  const loadMutations = async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.getStockMutations(filters);
      setMutations(response.data.data);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to load mutations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters]) {
        params.append(key, String(filters[key as keyof typeof filters]));
      }
    });
    
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-mutations/export?${params}`, '_blank');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatQuantity = (type: string, quantity: string) => {
    const num = Number(quantity);
    if (type === 'USED') {
      return `-${num}`;
    } else {
      return `+${num}`;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>📊 Riwayat Mutasi Stok</h1>
          <p className={styles.subtitle}>
            Lihat semua pergerakan stok material
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Tipe:</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
            className={styles.select}
          >
            {MUTATION_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>Dari Tanggal:</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
            className={styles.input}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>Sampai Tanggal:</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
            className={styles.input}
          />
        </div>

        <button onClick={handleExport} className={styles.exportButton}>
          📥 Export Excel
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.loading}>Memuat data...</div>
      ) : mutations.length === 0 ? (
        <div className={styles.empty}>
          <p>Tidak ada data mutasi stok</p>
        </div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Item</th>
                  <th>Cabang</th>
                  <th>Tipe</th>
                  <th>Jumlah</th>
                  <th>Stok Sebelum → Sesudah</th>
                  <th>Referensi</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {mutations.map((mutation) => (
                  <tr key={mutation.id}>
                    <td>{formatDate(mutation.createdAt)}</td>
                    <td>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemName}>
                          {mutation.inventoryItem.masterProduct.name}
                        </div>
                        <div className={styles.itemSku}>
                          {mutation.inventoryItem.masterProduct.sku}
                        </div>
                      </div>
                    </td>
                    <td>{mutation.inventoryItem.branch.name}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`badge${TYPE_COLORS[mutation.type]}`]}`}>
                        {TYPE_LABELS[mutation.type]}
                      </span>
                    </td>
                    <td className={mutation.type === 'USED' ? styles.negative : styles.positive}>
                      {formatQuantity(mutation.type, mutation.quantity)}
                    </td>
                    <td>
                      {Number(mutation.stockBefore).toFixed(0)} → {Number(mutation.stockAfter).toFixed(0)}
                    </td>
                    <td>
                      {mutation.referenceInfo ? (
                        mutation.referenceInfo.type === 'session' ? (
                          <a
                            href={`/sessions/${mutation.referenceInfo.id}`}
                            className={styles.link}
                          >
                            {mutation.referenceInfo.sessionCode}
                            <br />
                            <small>{mutation.referenceInfo.memberName}</small>
                          </a>
                        ) : (
                          <div className={styles.shipmentRef}>
                            {mutation.referenceInfo.shipmentCode}
                            <br />
                            <small>
                              {mutation.referenceInfo.from} → {mutation.referenceInfo.to}
                            </small>
                          </div>
                        )
                      ) : (
                        <span className={styles.noRef}>-</span>
                      )}
                    </td>
                    <td>{mutation.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className={styles.pageButton}
            >
              ← Sebelumnya
            </button>
            <span className={styles.pageInfo}>
              Halaman {pagination.page} dari {pagination.totalPages} 
              ({pagination.total} total mutasi)
            </span>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page >= pagination.totalPages}
              className={styles.pageButton}
            >
              Selanjutnya →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
