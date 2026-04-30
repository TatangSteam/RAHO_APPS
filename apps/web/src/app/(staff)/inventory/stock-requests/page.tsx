'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { StockRequest, RequestItem, FilterType } from './types';
import { useStockRequests } from './hooks/useStockRequests';
import { useInventoryItems } from './hooks/useInventoryItems';
import StockRequestCard from './components/StockRequestCard';
import ReviewModal from './components/ReviewModal';
import CreateRequestModal from './components/CreateRequestModal';
import styles from './page.module.css';

export default function StockRequestsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Create request modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Custom hooks
  const { requests, loading, refetch } = useStockRequests(accessToken, filter);
  const { inventoryItems, fetchInventoryItems } = useInventoryItems(accessToken);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
  }, [mounted, user, accessToken, router]);

  useEffect(() => {
    if (showCreateModal && inventoryItems.length === 0) {
      console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
      console.log('Access Token:', accessToken ? 'Present' : 'Missing');
      fetchInventoryItems();
    }
  }, [showCreateModal, inventoryItems.length, fetchInventoryItems, accessToken]);

  const handleCreateRequest = async (requestItems: RequestItem[], requestNotes: string) => {
    // Allow empty requests - no minimum item validation

    // Validate all items have valid quantity (only for items that exist)
    const invalidItems = requestItems.filter(item => item.requestedQty && item.requestedQty < 1);
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
      refetch();
    } catch (error: any) {
      console.error('❌ Create request error:', error);
      showToast.error(error.message || 'Gagal membuat request stok');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApprove = async (requestId: string, reviewNotes: string) => {
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
      setSelectedRequest(null);
      refetch();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal approve request stok');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: string, reviewNotes: string) => {
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
      setSelectedRequest(null);
      refetch();
    } catch (error: any) {
      showToast.error(error.message || 'Gagal reject request stok');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewRequest = (request: StockRequest) => {
    setSelectedRequest(request);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
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
            <StockRequestCard
              key={request.id}
              request={request}
              userRole={user?.role}
              onReview={handleReviewRequest}
            />
          ))}
        </div>
      )}

      {showModal && selectedRequest && (
        <ReviewModal
          request={selectedRequest}
          onClose={handleCloseModal}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={actionLoading}
        />
      )}

      <CreateRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        inventoryItems={inventoryItems}
        onCreateRequest={handleCreateRequest}
        onRefreshInventory={fetchInventoryItems}
        loading={createLoading}
      />
    </div>
  );
}