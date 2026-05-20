'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { 
  StockRequest, 
  RequestItem, 
  FilterType, 
  InvoiceItemInput,
  STATUS_LABELS,
  STATUS_ICONS,
} from './types';
import StockRequestCard from './components/StockRequestCard';
import ReviewModal from './components/ReviewModal';
import CreateRequestModal from './components/CreateRequestModal';
import UploadPaymentModal from './components/UploadPaymentModal';
import styles from './page.module.css';

export default function StockRequestsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Create request modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [masterProducts, setMasterProducts] = useState<any[]>([]);

  // Fetch requests
  const fetchRequests = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      const params: any = {};
      
      if (filter !== 'ALL') {
        params.status = filter;
      }

      const response = await inventoryApi.getStockRequests(params);
      // API returns { success: true, data: { data: [...], pagination: {...} } }
      // Axios response.data is the body: { success: true, data: { data: [...], pagination: {...} } }
      const responseBody = response.data;
      
      // Extract the requests array from the nested structure
      let requestsData: StockRequest[] = [];
      
      if (responseBody?.data) {
        // responseBody.data is { data: [...], pagination: {...} }
        if (Array.isArray(responseBody.data)) {
          // Direct array response
          requestsData = responseBody.data;
        } else if (responseBody.data.data && Array.isArray(responseBody.data.data)) {
          // Paginated response: { data: [...], pagination: {...} }
          requestsData = responseBody.data.data;
        }
      }
      
      setRequests(requestsData);
    } catch (error: any) {
      console.error('Failed to fetch requests:', error);
      showToast.error('Gagal memuat data request stok');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

  // Fetch master products for create modal
  const fetchMasterProducts = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const response = await inventoryApi.getMasterProducts();
      // API returns { success: true, data: { products: [...], total: number } }
      const responseBody = response.data;
      
      let productsData: any[] = [];
      
      if (responseBody?.data) {
        if (responseBody.data.products && Array.isArray(responseBody.data.products)) {
          // Expected format: { products: [...], total: number }
          productsData = responseBody.data.products;
        } else if (Array.isArray(responseBody.data)) {
          // Direct array response
          productsData = responseBody.data;
        }
      }
      
      setMasterProducts(productsData);
    } catch (error: any) {
      console.error('Failed to fetch master products:', error);
      setMasterProducts([]);
    }
  }, [accessToken]);

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
  }, [mounted, user, accessToken, router, fetchRequests]);

  useEffect(() => {
    if (showCreateModal && masterProducts.length === 0) {
      fetchMasterProducts();
    }
  }, [showCreateModal, masterProducts.length, fetchMasterProducts]);

  // Create request handler
  const handleCreateRequest = async (requestItems: RequestItem[], requestNotes: string) => {
    if (requestItems.length === 0) {
      showToast.error('Pilih minimal satu item');
      return;
    }

    try {
      setCreateLoading(true);
      
      await inventoryApi.createStockRequest({
        items: requestItems.map(item => ({
          masterProductId: item.masterProductId,
          requestedQty: item.requestedQty,
          notes: item.notes,
        })),
        notes: requestNotes || undefined,
      });
      
      showToast.success('Request stok berhasil dibuat!');
      setShowCreateModal(false);
      fetchRequests();
    } catch (error: any) {
      console.error('Create request error:', error);
      showToast.error(error.response?.data?.message || 'Gagal membuat request stok');
    } finally {
      setCreateLoading(false);
    }
  };

  // Approve Premiere request
  const handleApprovePremiereRequest = async (requestId: string, reviewNotes: string) => {
    try {
      setActionLoading(true);
      const response = await inventoryApi.approvePremiereRequest(requestId, reviewNotes);
      const message = response.data?.data?.message || 'Request stok berhasil di-approve dan stok telah ditambahkan';
      showToast.success(message);
      setShowModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal approve request stok');
    } finally {
      setActionLoading(false);
    }
  };

  // Create Partnership invoice
  const handleCreatePartnershipInvoice = async (requestId: string, items: InvoiceItemInput[], notes?: string) => {
    try {
      setActionLoading(true);
      await inventoryApi.createPartnershipInvoice(requestId, { items, notes });
      showToast.success('Invoice berhasil dibuat');
      setShowModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal membuat invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Upload payment proof
  const handleUploadPaymentProof = async (file: File) => {
    if (!selectedRequest) return;
    
    try {
      setActionLoading(true);
      await inventoryApi.uploadPaymentProof(selectedRequest.id, file);
      showToast.success('Bukti pembayaran berhasil diupload');
      setShowPaymentModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal upload bukti pembayaran');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm payment
  const handleConfirmPayment = async (requestId: string, verificationNotes?: string) => {
    try {
      setActionLoading(true);
      const response = await inventoryApi.confirmPayment(requestId, verificationNotes);
      const message = response.data?.data?.message || 'Pembayaran dikonfirmasi dan stok telah ditambahkan';
      showToast.success(message);
      setShowModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal konfirmasi pembayaran');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject payment
  const handleRejectPayment = async (requestId: string, rejectionReason: string) => {
    try {
      setActionLoading(true);
      await inventoryApi.rejectPayment(requestId, rejectionReason);
      showToast.success('Pembayaran ditolak');
      setShowModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal menolak pembayaran');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject request
  const handleReject = async (requestId: string, reviewNotes: string) => {
    try {
      setActionLoading(true);
      await inventoryApi.rejectRequest(requestId, reviewNotes);
      showToast.success('Request stok berhasil di-reject');
      setShowModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal reject request stok');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewRequest = async (request: StockRequest) => {
    // Fetch full request details to get invoice items
    try {
      const response = await inventoryApi.getStockRequestById(request.id);
      const fullRequest = response.data?.data || request;
      setSelectedRequest(fullRequest);
      setShowModal(true);
    } catch (error) {
      console.error('Failed to fetch request details:', error);
      // Fallback to list data if fetch fails
      setSelectedRequest(request);
      setShowModal(true);
    }
  };

  const handleUploadPayment = (request: StockRequest) => {
    setSelectedRequest(request);
    setShowPaymentModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
  };

  const filterOptions: { value: FilterType; label: string; icon: string }[] = [
    { value: 'ALL', label: 'Semua', icon: '📋' },
    { value: 'PENDING', label: 'Pending', icon: '⏳' },
    { value: 'WAITING_PAYMENT', label: 'Menunggu Bayar', icon: '💳' },
    { value: 'PAYMENT_UPLOADED', label: 'Bukti Diupload', icon: '📤' },
    { value: 'APPROVED', label: 'Disetujui', icon: '✅' },
    { value: 'SHIPPED', label: 'Dikirim', icon: '🚚' },
    { value: 'COMPLETED', label: 'Selesai', icon: '✔️' },
    { value: 'REJECTED', label: 'Ditolak', icon: '❌' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📋 Request Stok</h1>
        <p>Kelola permintaan stok dari cabang</p>
      </div>

      <div className={styles.controls}>
        <div className={styles.filters} style={{ flexWrap: 'wrap', gap: '8px' }}>
          {filterOptions.map((f) => (
            <button
              key={f.value}
              className={`${styles.filterBtn} ${filter === f.value ? styles.active : ''}`}
              onClick={() => setFilter(f.value)}
              data-status={f.value}
              disabled={loading}
            >
              <span className={styles.icon}>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
        
        {user?.role === 'ADMIN_CABANG' && (
          <button 
            className={styles.createBtn}
            onClick={() => setShowCreateModal(true)}
          >
            ➕ Buat Request
          </button>
        )}
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
          <p>Belum ada permintaan stok yang dibuat.</p>
          {user?.role === 'ADMIN_CABANG' && (
            <button 
              className={styles.emptyBtn}
              onClick={() => setShowCreateModal(true)}
            >
              ➕ Buat Request Baru
            </button>
          )}
        </div>
      ) : (
        <div className={styles.requestsList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {requests.map((request) => (
            <StockRequestCard
              key={request.id}
              request={request}
              userRole={user?.role}
              onReview={handleReviewRequest}
              onUploadPayment={handleUploadPayment}
            />
          ))}
        </div>
      )}

      {showModal && selectedRequest && (
        <ReviewModal
          request={selectedRequest}
          userRole={user?.role}
          onClose={handleCloseModal}
          onApprovePremiereRequest={handleApprovePremiereRequest}
          onCreatePartnershipInvoice={handleCreatePartnershipInvoice}
          onConfirmPayment={handleConfirmPayment}
          onRejectPayment={handleRejectPayment}
          onReject={handleReject}
          loading={actionLoading}
        />
      )}

      {showPaymentModal && selectedRequest && (
        <UploadPaymentModal
          request={selectedRequest}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedRequest(null);
          }}
          onUpload={handleUploadPaymentProof}
          loading={actionLoading}
        />
      )}

      <CreateRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        inventoryItems={masterProducts}
        onCreateRequest={handleCreateRequest}
        onRefreshInventory={fetchMasterProducts}
        loading={createLoading}
      />
    </div>
  );
}
