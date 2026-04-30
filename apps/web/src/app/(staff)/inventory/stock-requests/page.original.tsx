'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

interface StockRequest {
  id: string;
  requestCode: string;
  branchName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  itemCount: number;
  items: Array<{
    id: string;
    productName: string;
    requestedQty: number;
    unit: string;
    notes?: string;
  }>;
  notes?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  description?: string;
  stock: number;
  minThreshold: number;
  storageLocation?: string;
  isLowStock: boolean;
  masterProductId: string;
  branchId: string;
}

interface RequestItem {
  inventoryItemId: string;
  productName: string;
  requestedQty: number;
  unit: string;
  notes?: string;
}

export default function StockRequestsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Create request modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [requestNotes, setRequestNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW_STOCK' | 'IN_STOCK'>('ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, accessToken, filter]);

  useEffect(() => {
    if (showCreateModal && inventoryItems.length === 0) {
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('Access Token:', accessToken ? 'Present' : 'Missing');
      fetchInventoryItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal]);

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
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, searchQuery]);

  // Filter items based on search and filters
  useEffect(() => {
    let filtered = inventoryItems;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Stock filter
    if (stockFilter === 'LOW_STOCK') {
      filtered = filtered.filter(item => item.isLowStock);
    } else if (stockFilter === 'IN_STOCK') {
      filtered = filtered.filter(item => !item.isLowStock);
    }

    setFilteredItems(filtered);
  }, [inventoryItems, searchQuery, categoryFilter, stockFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      if (!accessToken) {
        showToast.error('Token tidak ditemukan. Silakan login kembali.');
        router.push('/login');
        return;
      }

      const params = new URLSearchParams();
      if (filter !== 'ALL') {
        params.append('status', filter);
      }

      console.log('🔍 Fetching stock requests with filter:', filter);
      const url = `${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-requests?${params}`;
      console.log('URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Stock requests response status:', response.status);
      console.log('Response OK:', response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          showToast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          router.push('/login');
          return;
        }
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Stock requests loaded:', data.data?.length || 0, 'requests');
      
      if (!data.data || !Array.isArray(data.data)) {
        console.error('Invalid data format:', data);
        throw new Error('Format data tidak valid');
      }
      
      setRequests(data.data);
    } catch (error: any) {
      console.error('❌ Stock requests fetch error:', error);
      showToast.error(error.message || 'Gagal memuat request stok');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      console.log('🔍 Fetching inventory items from:', `${process.env.NEXT_PUBLIC_API_URL}/inventory/items`);
      console.log('Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/items`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Inventory items response status:', response.status);
      console.log('Response OK:', response.ok);

      if (!response.ok) {
        if (response.status === 401) {
          showToast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          router.push('/login');
          return;
        }
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Inventory items loaded:', data.data?.length || 0, 'items');
      
      if (!data.data || !Array.isArray(data.data)) {
        console.error('Invalid data format:', data);
        throw new Error('Format data tidak valid');
      }
      
      setInventoryItems(data.data);
      setFilteredItems(data.data);
    } catch (error: any) {
      console.error('❌ Inventory items fetch error:', error);
      showToast.error(error.message || 'Gagal memuat data inventori');
    }
  };

  const handleCreateRequest = async () => {
    if (requestItems.length === 0) {
      showToast.error('Minimal harus ada 1 item yang diminta');
      return;
    }

    // Validate all items have valid quantity
    const invalidItems = requestItems.filter(item => !item.requestedQty || item.requestedQty < 1);
    if (invalidItems.length > 0) {
      showToast.error('Semua item harus memiliki jumlah minimal 1');
      return;
    }

    // Validate quantities don't exceed available stock
    const overStockItems = requestItems.filter(item => {
      const inventoryItem = inventoryItems.find(inv => inv.id === item.inventoryItemId);
      return inventoryItem && item.requestedQty > inventoryItem.stock;
    });

    if (overStockItems.length > 0) {
      const itemNames = overStockItems.map(item => item.productName).join(', ');
      showToast.error(`Quantity melebihi stok tersedia untuk: ${itemNames}`);
      return;
    }

    try {
      setCreateLoading(true);
      
      const requestPayload = {
        items: requestItems.map(item => ({
          inventoryItemId: item.inventoryItemId,
          requestedQty: item.requestedQty,
          notes: item.notes?.trim() || undefined,
        })),
        notes: requestNotes.trim() || undefined,
      };

      // Detailed logging for debugging
      console.group('🔍 CREATE REQUEST DEBUG');
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('Full URL:', `${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-requests`);
      console.log('Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
      console.log('Token Length:', accessToken?.length || 0);
      console.log('User:', user);
      console.log('User Role:', user?.role);
      console.log('User Branch ID:', user?.branchId);
      console.log('Request Payload:', requestPayload);
      console.log('Total Items:', requestItems.length);
      console.log('Total Quantity:', requestItems.reduce((sum, item) => sum + item.requestedQty, 0));
      console.groupEnd();
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('Response Status:', response.status);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const error = await response.json();
          console.error('Error Response:', error);
          errorMessage = error.message || errorMessage;
        } catch (e) {
          console.error('Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Request created successfully:', result);
      
      showToast.success(`Request stok berhasil dibuat! Total ${requestItems.length} item dengan ${requestItems.reduce((sum, item) => sum + item.requestedQty, 0)} unit`);
      setShowCreateModal(false);
      setRequestItems([]);
      setRequestNotes('');
      resetFilters();
      fetchRequests();
    } catch (error: any) {
      console.error('❌ Create request error:', error);
      showToast.error(error.message || 'Gagal membuat request stok');
    } finally {
      setCreateLoading(false);
    }
  };

  const addRequestItem = (item: InventoryItem) => {
    const existingItem = requestItems.find(ri => ri.inventoryItemId === item.id);
    if (existingItem) {
      showToast.error('Item sudah ditambahkan');
      return;
    }

    // Set default quantity based on item type
    let defaultQty = 1;
    if (item.unit.toLowerCase().includes('ml') || item.unit.toLowerCase().includes('liter')) {
      defaultQty = 100; // Default 100ml for liquids
    } else if (item.unit.toLowerCase().includes('tablet') || item.unit.toLowerCase().includes('kapsul')) {
      defaultQty = 10; // Default 10 tablets/capsules
    } else if (item.unit.toLowerCase().includes('box') || item.unit.toLowerCase().includes('pack')) {
      defaultQty = 1; // Default 1 box/pack
    } else {
      defaultQty = 10; // Default 10 for other units
    }

    setRequestItems([...requestItems, {
      inventoryItemId: item.id,
      productName: item.name,
      requestedQty: defaultQty,
      unit: item.unit,
      notes: '',
    }]);
  };

  const updateRequestItem = (inventoryItemId: string, field: keyof RequestItem, value: any) => {
    setRequestItems(requestItems.map(item => {
      if (item.inventoryItemId === inventoryItemId) {
        // If updating quantity, validate against available stock
        if (field === 'requestedQty') {
          const inventoryItem = inventoryItems.find(inv => inv.id === inventoryItemId);
          if (inventoryItem) {
            const maxQty = inventoryItem.stock;
            const validatedQty = Math.max(1, Math.min(value, maxQty));
            
            if (value > maxQty) {
              showToast.error(`Quantity tidak boleh melebihi stok tersedia (${maxQty} ${inventoryItem.unit})`);
            }
            
            return { ...item, [field]: validatedQty };
          }
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeRequestItem = (inventoryItemId: string) => {
    setRequestItems(requestItems.filter(item => item.inventoryItemId !== inventoryItemId));
  };

  // Get unique categories from inventory items
  const getCategories = () => {
    const categories = Array.from(new Set(inventoryItems.map(item => item.category)));
    return categories.sort();
  };

  // Clear search only
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Reset search and filters
  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setStockFilter('ALL');
  };

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

  const handleApprove = async (requestId: string) => {
    if (!reviewNotes.trim()) {
      showToast.error('Catatan review harus diisi');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reviewNotes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve request');
      }

      showToast.success('Request stok berhasil di-approve');
      setShowModal(false);
      setReviewNotes('');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal approve request stok');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!reviewNotes.trim()) {
      showToast.error('Catatan penolakan harus diisi');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/inventory/stock-requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reviewNotes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reject request');
      }

      showToast.success('Request stok berhasil di-reject');
      setShowModal(false);
      setReviewNotes('');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal reject request stok');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className={`${styles.badge} ${styles.pending}`}>⏳ PENDING</span>;
      case 'APPROVED':
        return <span className={`${styles.badge} ${styles.approved}`}>✓ APPROVED</span>;
      case 'REJECTED':
        return <span className={`${styles.badge} ${styles.rejected}`}>✗ REJECTED</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📋 Request Stok</h1>
        <p>Kelola permintaan stok dari cabang</p>
      </div>

      <div className={styles.controls}>
        <div className={styles.filters}>
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
              onClick={() => setFilter(f)}
              data-status={f}
              disabled={loading}
            >
              <span className={styles.icon}>
                {f === 'ALL' ? '📋' : 
                 f === 'PENDING' ? '⏳' : 
                 f === 'APPROVED' ? '✅' : '❌'}
              </span>
              {f === 'ALL' ? 'Semua' : 
               f === 'PENDING' ? 'Pending' : 
               f === 'APPROVED' ? 'Approved' : 'Rejected'}
            </button>
          ))}
        </div>
        
        <button 
          className={styles.createBtn}
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Buat Request
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}>⏳</div>
          <p>Memuat data...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <h3>Belum Ada Request Stok</h3>
          <p>Belum ada permintaan stok yang dibuat. Buat request baru untuk meminta stok dari cabang lain.</p>
          <button 
            className={styles.emptyBtn}
            onClick={() => router.push('/inventory')}
          >
            🛒 Lihat Inventori
          </button>
        </div>
      ) : (
        <div className={styles.requestsList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {requests.map((request) => (
            <div key={request.id} className={styles.requestCard} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <h3>{request.requestCode}</h3>
                  <p className={styles.branch}>{request.branchName}</p>
                </div>
                {getStatusBadge(request.status)}
              </div>

              <div className={styles.cardBody}>
                {/* Bundle Indicator */}
                {request.itemCount > 1 && (
                  <div className={styles.bundleIndicator}>
                    <span className={styles.bundleIcon}>📦</span>
                    <span>Bundle: Semua {request.itemCount} item akan di-approve bersamaan</span>
                  </div>
                )}
                
                <div className={styles.itemsSection}>
                  <div className={styles.itemCount}>
                    <span className={styles.label}>Items</span>
                    <span className={styles.value}>{request.itemCount}</span>
                  </div>

                  <div className={styles.itemsList}>
                    {request.items.slice(0, 2).map((item) => (
                      <div key={item.id} className={styles.itemRow}>
                        <span className={styles.itemName}>{item.productName}</span>
                        <span className={styles.itemQty}>{item.requestedQty} {item.unit}</span>
                      </div>
                    ))}
                    {request.items.length > 2 && (
                      <div className={styles.moreItems}>+{request.items.length - 2} item lainnya</div>
                    )}
                  </div>
                </div>

                {request.notes && (
                  <div className={styles.notesSection}>
                    <span className={styles.label}>Catatan:</span>
                    <p className={styles.noteText}>{request.notes}</p>
                  </div>
                )}

                <div className={styles.footer}>
                  <span className={styles.date}>
                    {new Date(request.createdAt).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {request.status === 'PENDING' && user?.role === 'SUPER_ADMIN' && (
                <div className={styles.cardActions}>
                  <button
                    className={`${styles.actionBtn} ${styles.approve}`}
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowModal(true);
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.reject}`}
                    onClick={() => {
                      setSelectedRequest(request);
                      setShowModal(true);
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && selectedRequest && (
        <div className={styles.modal}>
          <div className={styles.modalOverlay} onClick={() => setShowModal(false)} />
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Review Request Stok</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.requestInfo}>
                <p className={styles.requestCode}>{selectedRequest.requestCode}</p>
                <p className={styles.requestBranch}>{selectedRequest.branchName}</p>
              </div>

              {/* Bundle Indicator in Modal */}
              {selectedRequest.itemCount > 1 && (
                <div className={styles.bundleIndicator}>
                  <span className={styles.bundleIcon}>📦</span>
                  <span>Bundle Approval: Semua {selectedRequest.itemCount} item akan di-approve/reject bersamaan</span>
                </div>
              )}

              <div className={styles.itemsListModal}>
                <h3>Items yang Diminta</h3>
                {selectedRequest.items.map((item) => (
                  <div key={item.id} className={styles.itemRowModal}>
                    <span>{item.productName}</span>
                    <span className={styles.qty}>{item.requestedQty} {item.unit}</span>
                  </div>
                ))}
              </div>

              <div className={styles.formGroup}>
                <label>Catatan Review</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Masukkan catatan review..."
                  rows={4}
                  className={styles.textarea}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={`${styles.modalBtn} ${styles.approve}`}
                onClick={() => handleApprove(selectedRequest.id)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Memproses...' : '✓ Approve'}
              </button>
              <button
                className={`${styles.modalBtn} ${styles.reject}`}
                onClick={() => handleReject(selectedRequest.id)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Memproses...' : '✗ Reject'}
              </button>
              <button
                className={`${styles.modalBtn} ${styles.cancel}`}
                onClick={() => {
                  setShowModal(false);
                  setReviewNotes('');
                  setSelectedRequest(null);
                }}
                disabled={actionLoading}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {showCreateModal && (
        <div className={styles.modal}>
          <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)} />
          <div className={`${styles.modalContent} ${styles.createModal}`}>
            <div className={styles.modalHeader}>
              <h2>Buat Request Stok Baru</h2>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {/* Inventory Items Selection */}
              <div className={styles.inventorySection}>
                <div className={styles.sectionHeader}>
                  <h3>Pilih Item dari Inventori</h3>
                  <div className={styles.itemCount}>
                    {filteredItems.length} dari {inventoryItems.length} item
                  </div>
                </div>

                {/* Search and Filters */}
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
                          onClick={clearSearch}
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
                        {getCategories().map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label>Stok:</label>
                      <select
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value as 'ALL' | 'LOW_STOCK' | 'IN_STOCK')}
                        className={styles.filterSelect}
                      >
                        <option value="ALL">Semua Stok</option>
                        <option value="IN_STOCK">Stok Normal</option>
                        <option value="LOW_STOCK">Stok Rendah</option>
                      </select>
                    </div>

                    <button 
                      className={styles.resetFilters}
                      onClick={resetFilters}
                      type="button"
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>

                <div className={styles.inventoryGrid}>
                  {inventoryItems.length === 0 ? (
                    <div className={styles.emptyInventory}>
                      <p>Memuat data inventori...</p>
                      <button onClick={fetchInventoryItems} className={styles.refreshBtn}>
                        🔄 Refresh
                      </button>
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className={styles.emptyInventory}>
                      <p>Tidak ada item yang sesuai dengan filter</p>
                      <button onClick={resetFilters} className={styles.refreshBtn}>
                        🔄 Reset Filter
                      </button>
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <div key={item.id} className={styles.inventoryItem}>
                        <div className={styles.itemInfo}>
                          <h4>{highlightSearchTerm(item.name, searchQuery)}</h4>
                          <p>Kategori: {highlightSearchTerm(item.category, searchQuery)}</p>
                          <div className={styles.stockInfo}>
                            <span className={`${styles.stockBadge} ${item.isLowStock ? styles.lowStock : styles.normalStock}`}>
                              Stok: {item.stock} {item.unit}
                            </span>
                            <span className={styles.minStock}>Min: {item.minThreshold} {item.unit}</span>
                          </div>
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
                          onClick={() => addRequestItem(item)}
                          disabled={requestItems.some(ri => ri.inventoryItemId === item.id)}
                        >
                          {requestItems.some(ri => ri.inventoryItemId === item.id) ? '✓ Ditambahkan' : '➕ Tambah'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Items */}
              {requestItems.length > 0 && (
                <div className={styles.selectedSection}>
                  <div className={styles.sectionHeader}>
                    <h3>Item yang Diminta</h3>
                    <div className={styles.itemCount}>
                      {requestItems.length} item • Total: {requestItems.reduce((sum, item) => sum + item.requestedQty, 0)} unit
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
                        <button 
                          type="button"
                          className={styles.bulkBtn}
                          onClick={() => {
                            requestItems.forEach(item => {
                              updateRequestItem(item.inventoryItemId, 'requestedQty', 10);
                            });
                          }}
                        >
                          10
                        </button>
                        <button 
                          type="button"
                          className={styles.bulkBtn}
                          onClick={() => {
                            requestItems.forEach(item => {
                              updateRequestItem(item.inventoryItemId, 'requestedQty', 50);
                            });
                          }}
                        >
                          50
                        </button>
                        <button 
                          type="button"
                          className={styles.bulkBtn}
                          onClick={() => {
                            requestItems.forEach(item => {
                              updateRequestItem(item.inventoryItemId, 'requestedQty', 100);
                            });
                          }}
                        >
                          100
                        </button>
                        <button 
                          type="button"
                          className={styles.bulkBtn}
                          onClick={() => {
                            requestItems.forEach(item => {
                              updateRequestItem(item.inventoryItemId, 'requestedQty', 500);
                            });
                          }}
                        >
                          500
                        </button>
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
                                    updateRequestItem(item.inventoryItemId, 'requestedQty', value);
                                  }}
                                  className={`${styles.numberInput} ${isOverStock ? styles.errorInput : ''}`}
                                  placeholder="Masukkan jumlah"
                                />
                                <div className={styles.quickBtns}>
                                  <button 
                                    type="button"
                                    className={styles.quickBtn}
                                    onClick={() => updateRequestItem(item.inventoryItemId, 'requestedQty', Math.min(10, availableStock))}
                                  >
                                    10
                                  </button>
                                  <button 
                                    type="button"
                                    className={styles.quickBtn}
                                    onClick={() => updateRequestItem(item.inventoryItemId, 'requestedQty', Math.min(50, availableStock))}
                                  >
                                    50
                                  </button>
                                  <button 
                                    type="button"
                                    className={styles.quickBtn}
                                    onClick={() => updateRequestItem(item.inventoryItemId, 'requestedQty', Math.min(100, availableStock))}
                                  >
                                    100
                                  </button>
                                </div>
                              </div>
                              <span className={styles.unit}>{item.unit}</span>
                            </div>
                            <div className={styles.notesInput}>
                              <label>Catatan (opsional):</label>
                              <input
                                type="text"
                                value={item.notes || ''}
                                onChange={(e) => updateRequestItem(item.inventoryItemId, 'notes', e.target.value)}
                                placeholder="Catatan untuk item ini..."
                                className={styles.textInput}
                              />
                            </div>
                          </div>
                          <button
                            className={styles.removeBtn}
                            onClick={() => removeRequestItem(item.inventoryItemId)}
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Request Notes */}
              <div className={styles.formGroup}>
                <label>Catatan Request (opsional)</label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Catatan umum untuk request ini..."
                  rows={3}
                  className={styles.textarea}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={`${styles.modalBtn} ${styles.create}`}
                onClick={handleCreateRequest}
                disabled={createLoading || requestItems.length === 0}
              >
                {createLoading ? (
                  <>⏳ Membuat Request...</>
                ) : (
                  <>✓ Buat Request ({requestItems.length} item, {requestItems.reduce((sum, item) => sum + item.requestedQty, 0)} total)</>
                )}
              </button>
              <button
                className={`${styles.modalBtn} ${styles.cancel}`}
                onClick={() => {
                  setShowCreateModal(false);
                  setRequestItems([]);
                  setRequestNotes('');
                  resetFilters();
                }}
                disabled={createLoading}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
