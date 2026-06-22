'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { inventoryApi } from '@/lib/api/inventoryApi';
import { devLog, devError } from '@/lib/logger';
import { 
  ClipboardList, 
  Plus, 
  Clock, 
  CreditCard, 
  Upload, 
  CheckCircle, 
  Truck, 
  CheckCheck, 
  XCircle,
  Package,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { 
  StockRequest, 
  RequestItem, 
  FilterType, 
  InvoiceItemInput,
} from './types';
import StockRequestCard from './components/StockRequestCard';
import ReviewModal from './components/ReviewModal';
import CreateRequestModal from './components/CreateRequestModal';
import UploadPaymentModal from './components/UploadPaymentModal';

const filterOptions: { value: FilterType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'ALL', label: 'Semua', icon: <ClipboardList className="w-4 h-4" />, color: 'bg-neutral-500' },
  { value: 'PENDING', label: 'Pending', icon: <Clock className="w-4 h-4" />, color: 'bg-amber-500' },
  { value: 'WAITING_PAYMENT', label: 'Menunggu Bayar', icon: <CreditCard className="w-4 h-4" />, color: 'bg-purple-500' },
  { value: 'PAYMENT_UPLOADED', label: 'Bukti Diupload', icon: <Upload className="w-4 h-4" />, color: 'bg-blue-500' },
  { value: 'APPROVED', label: 'Disetujui', icon: <CheckCircle className="w-4 h-4" />, color: 'bg-emerald-500' },
  { value: 'SHIPPED', label: 'Dikirim', icon: <Truck className="w-4 h-4" />, color: 'bg-indigo-500' },
  { value: 'COMPLETED', label: 'Selesai', icon: <CheckCheck className="w-4 h-4" />, color: 'bg-green-500' },
  { value: 'REJECTED', label: 'Ditolak', icon: <XCircle className="w-4 h-4" />, color: 'bg-red-500' },
];

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
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [masterProducts, setMasterProducts] = useState<any[]>([]);

  const fetchRequests = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      const params: any = {};
      if (filter !== 'ALL') params.status = filter;

      const response = await inventoryApi.getStockRequests(params);
      const responseBody = response.data;
      
      let requestsData: StockRequest[] = [];
      if (responseBody?.data) {
        if (Array.isArray(responseBody.data)) {
          requestsData = responseBody.data;
        } else if (responseBody.data.data && Array.isArray(responseBody.data.data)) {
          requestsData = responseBody.data.data;
        }
      }
      
      setRequests(requestsData);
    } catch (error: any) {
      devError('Failed to fetch requests:', error);
      showToast.error('Gagal memuat data request stok');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

  const fetchMasterProducts = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      const response = await inventoryApi.getMasterProducts();
      const responseBody = response.data;
      
      let productsData: any[] = [];
      if (responseBody?.data) {
        if (responseBody.data.products && Array.isArray(responseBody.data.products)) {
          productsData = responseBody.data.products;
        } else if (Array.isArray(responseBody.data)) {
          productsData = responseBody.data;
        }
      }
      
      setMasterProducts(productsData);
    } catch (error: any) {
      devError('Failed to fetch master products:', error);
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

  const handleCreateRequest = async (requestItems: RequestItem[], requestNotes: string) => {
    if (requestItems.length === 0) {
      showToast.error('Pilih minimal satu item');
      return;
    }

    if (!requestNotes || requestNotes.trim() === '') {
      showToast.error('Keterangan request wajib diisi');
      return;
    }

    // Prepare request data
    const requestData = {
      items: requestItems.map(item => ({
        masterProductId: item.masterProductId,
        requestedQty: item.requestedQty,
        notes: item.notes || undefined,
      })),
      notes: requestNotes.trim(),
    };

    // Debug logging
    devLog('=== CREATE STOCK REQUEST DEBUG ===');
    devLog('User:', { userId: user?.userId, role: user?.role, branchId: user?.branchId });
    devLog('Request data:', JSON.stringify(requestData, null, 2));

    try {
      setCreateLoading(true);
      await inventoryApi.createStockRequest(requestData);
      
      showToast.success('Request stok berhasil dibuat!');
      setShowCreateModal(false);
      fetchRequests();
    } catch (error: any) {
      devError('=== CREATE REQUEST ERROR ===');
      devError('Error:', error);
      devError('Response status:', error.response?.status);
      devError('Response data:', JSON.stringify(error.response?.data, null, 2));
      
      // Extract error message from response
      const errorData = error.response?.data;
      let errorMessage = 'Gagal membuat request stok';
      
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.error?.code) {
        // Map error codes to user-friendly messages
        const errorCodes: Record<string, string> = {
          'INSUFFICIENT_PERMISSIONS': 'Anda tidak memiliki izin untuk membuat request stok',
          'BRANCH_MISMATCH': 'Anda hanya dapat membuat request untuk cabang Anda sendiri',
          'BRANCH_NOT_FOUND': 'Cabang tidak ditemukan',
          'ITEMS_REQUIRED': 'Minimal satu item harus dipilih',
          'NOTES_REQUIRED': 'Keterangan request wajib diisi',
          'PRODUCT_NOT_FOUND': 'Beberapa produk tidak ditemukan atau tidak aktif',
          'INVALID_QUANTITY': 'Jumlah yang diminta harus lebih dari 0',
          'PENDING_SHIPMENT_EXISTS': 'Masih ada pengiriman yang belum selesai. Harap terima pengiriman terlebih dahulu.',
          'PENDING_REQUEST_EXISTS': 'Masih ada request yang belum selesai. Harap selesaikan request sebelumnya terlebih dahulu.',
        };
        errorMessage = errorCodes[errorData.error.code] || errorData.error.code;
      }
      
      showToast.error(errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleApprovePremierRequest = async (requestId: string, reviewNotes: string) => {
    try {
      setActionLoading(true);
      const response = await inventoryApi.approvePremierRequest(requestId, reviewNotes);
      const message = response.data?.data?.message || 'Request stok berhasil di-approve';
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

  const handleCreatePartnershipInvoice = async (requestId: string, items: InvoiceItemInput[], notes?: string) => {
    try {
      setActionLoading(true);
      const response = await inventoryApi.createPartnershipInvoice(requestId, { items, notes });
      const message = response.data?.data?.message || 'Invoice berhasil dibuat';
      showToast.success(message);
      setShowModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal membuat invoice');
    } finally {
      setActionLoading(false);
    }
  };

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

  const handleConfirmPayment = async (requestId: string, verificationNotes?: string) => {
    try {
      setActionLoading(true);
      const response = await inventoryApi.confirmPayment(requestId, verificationNotes);
      const message = response.data?.data?.message || 'Pembayaran dikonfirmasi';
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
    try {
      const response = await inventoryApi.getStockRequestById(request.id);
      const fullRequest = response.data?.data || request;
      setSelectedRequest(fullRequest);
      setShowModal(true);
    } catch (error) {
      devError('Failed to fetch request details:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            Request Stok
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Kelola permintaan stok dari cabang
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchRequests()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {user?.role === 'ADMIN_CABANG' && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 transition-all"
            >
              <Plus className="h-4 w-4" />
              Buat Request
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              filter === f.value
                ? `${f.color} text-white shadow-lg`
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">Memuat data...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-700">
          <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center mb-4">
            <Package className="w-10 h-10 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            Belum Ada Request Stok
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-center max-w-md">
            {filter === 'ALL' 
              ? 'Belum ada permintaan stok yang dibuat.'
              : `Tidak ada request dengan status "${filterOptions.find(f => f.value === filter)?.label}".`
            }
          </p>
          {user?.role === 'ADMIN_CABANG' && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 transition-all"
            >
              <Plus className="h-4 w-4" />
              Buat Request Baru
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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

      {/* Modals */}
      {showModal && selectedRequest && (
        <ReviewModal
          request={selectedRequest}
          userRole={user?.role}
          onClose={handleCloseModal}
          onApprovePremierRequest={handleApprovePremierRequest}
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
