'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, FileText, CreditCard, Check, AlertCircle, Download, RefreshCw, Clock, Building2, MessageSquare, Upload, ImageIcon, Trash2, CheckCircle2 } from 'lucide-react';
import { StockRequest, InvoiceItemInput, STATUS_LABELS, STATUS_ICONS } from '../types';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { generateStockRequestInvoicePDF } from '@/lib/stockRequestInvoicePdf';
import { useAuthStore } from '@/stores/authStore';
import { compressImageWithPreset, formatFileSize, isImageFile } from '@/lib/imageCompressor';
import { inventoryApi } from '@/lib/api/inventoryApi';

interface ReviewModalProps {
  request: StockRequest;
  userRole?: string;
  onClose: () => void;
  /** @deprecated No longer used - both Premier and Partnership use onCreatePartnershipInvoice */
  onApprovePremierRequest?: (requestId: string, reviewNotes: string) => Promise<void>;
  onCreatePartnershipInvoice: (
    requestId: string,
    items: InvoiceItemInput[],
    notes?: string,
    paymentMode?: 'NORMAL' | 'DEBT'
  ) => Promise<void>;
  onMarkPaymentAsDebt: (requestId: string, notes?: string) => Promise<void>;
  onConfirmPayment: (requestId: string, verificationNotes?: string) => Promise<void>;
  onRejectPayment: (requestId: string, rejectionReason: string) => Promise<void>;
  onReject: (requestId: string, reviewNotes: string) => Promise<void>;
  onRefresh?: () => void;
  loading: boolean;
}

export default function ReviewModal({ 
  request, 
  userRole,
  onClose, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onApprovePremierRequest, // Deprecated - kept for backward compatibility
  onCreatePartnershipInvoice,
  onMarkPaymentAsDebt,
  onConfirmPayment,
  onRejectPayment,
  onReject,
  onRefresh,
  loading 
}: ReviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [notesError, setNotesError] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'invoice' | 'payment'>('items');
  const [paymentProofBlobUrls, setPaymentProofBlobUrls] = useState<Record<string, string>>({});
  const [loadingPaymentProofIds, setLoadingPaymentProofIds] = useState<string[]>([]);
  const [failedPaymentProofIds, setFailedPaymentProofIds] = useState<string[]>([]);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Total price for Partnership (single input instead of per-item)
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState<string>('');
  
  // Upload payment proof states
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; compressed: number } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [uploadingPayment, setUploadingPayment] = useState(false);

  const { accessToken } = useAuthStore();
  const isManager = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER';

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const paymentHistory = request.invoice?.payments?.length
    ? request.invoice.payments
    : request.paymentProofUrl
      ? [{
          id: 'legacy-payment-proof',
          amount: request.invoice?.totalAmount ?? 0,
          proofFileUrl: request.paymentProofUrl,
          proofFileName: request.paymentProofFileName ?? 'Bukti pembayaran',
          proofFileSize: request.paymentProofFileSize ?? 0,
          proofMimeType: request.paymentProofMimeType ?? 'image/*',
          notes: undefined,
          uploadedBy: request.paymentUploadedBy ?? '',
          uploadedAt: request.paymentUploadedAt ?? request.updatedAt ?? request.createdAt,
          verifiedBy: request.paymentVerifiedBy,
          verifiedAt: request.paymentVerifiedAt,
          verificationNotes: request.paymentVerificationNotes,
          rejectionReason: request.paymentRejectionReason,
        }]
      : [];
  const paymentHistoryKey = paymentHistory
    .map((payment) => `${payment.id}:${payment.proofFileUrl}`)
    .join('|');

  // Auto-switch to payment tab when payment proof exists
  useEffect(() => {
    if (request.status === 'PAYMENT_UPLOADED' && paymentHistory.length > 0) {
      setActiveTab('payment');
    }
  }, [request.status, paymentHistory.length]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Fetch a payment proof image with authentication
  const fetchPaymentProof = useCallback(async (paymentId: string, proofFileUrl: string) => {
    if (!proofFileUrl || !accessToken) return;

    setLoadingPaymentProofIds((current) => (
      current.includes(paymentId) ? current : [...current, paymentId]
    ));
    setFailedPaymentProofIds((current) => current.filter((id) => id !== paymentId));

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      
      let apiUrl: string;
      if (proofFileUrl.startsWith('http')) {
        apiUrl = proofFileUrl;
      } else if (proofFileUrl.startsWith('/api/v1/')) {
        apiUrl = apiBaseUrl + proofFileUrl.replace('/api/v1', '');
      } else if (proofFileUrl.startsWith('/')) {
        apiUrl = apiBaseUrl + proofFileUrl;
      } else {
        apiUrl = `${apiBaseUrl}/${proofFileUrl}`;
      }
      
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (!response.ok) {
        throw new Error(`Gagal memuat bukti pembayaran (${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPaymentProofBlobUrls((current) => {
        if (current[paymentId]) {
          URL.revokeObjectURL(current[paymentId]);
        }
        return { ...current, [paymentId]: blobUrl };
      });
    } catch (error) {
      devError('Error fetching payment proof:', error);
      setFailedPaymentProofIds((current) => (
        current.includes(paymentId) ? current : [...current, paymentId]
      ));
    } finally {
      setLoadingPaymentProofIds((current) => current.filter((id) => id !== paymentId));
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    paymentHistory.forEach((payment) => {
      fetchPaymentProof(payment.id, payment.proofFileUrl);
    });

    return () => {
      setPaymentProofBlobUrls((current) => {
        Object.values(current).forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
        return {};
      });
    }
    // paymentHistoryKey intentionally represents the proof list without
    // depending on a newly-created array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, fetchPaymentProof, paymentHistoryKey]);

  // Build invoice items from total amount (distribute evenly)
  const buildInvoiceItems = (): InvoiceItemInput[] => {
    const total = parseFloat(totalInvoiceAmount) || 0;
    
    const totalQty = request.items.reduce((sum, item) => sum + item.requestedQty, 0);
    const pricePerUnit = totalQty > 0 ? Math.round(total / totalQty) : 0;
    
    return request.items.map(item => ({
      masterProductId: item.masterProductId,
      quantity: item.requestedQty,
      pricePerUnit: pricePerUnit,
    }));
  };

  const handleApprove = async () => {
    const invoiceItems = buildInvoiceItems();
    await onCreatePartnershipInvoice(request.id, invoiceItems, reviewNotes);
  };

  const handleApproveDebt = async () => {
    const total = parseFloat(totalInvoiceAmount) || 0;
    if (total <= 0) {
      showToast.error('Masukkan total harga lebih dari 0 untuk pembayaran utang');
      return;
    }

    const invoiceItems = buildInvoiceItems();
    await onCreatePartnershipInvoice(request.id, invoiceItems, reviewNotes, 'DEBT');
  };

  const handleMarkDebt = async () => {
    await onMarkPaymentAsDebt(request.id, reviewNotes);
  };

  const handleConfirmPayment = async () => {
    await onConfirmPayment(request.id, reviewNotes);
  };

  const handleRejectPayment = async () => {
    if (!reviewNotes.trim()) {
      setNotesError(true);
      showToast.error('Alasan penolakan pembayaran harus diisi');
      return;
    }
    setNotesError(false);
    await onRejectPayment(request.id, reviewNotes);
  };

  const handleReject = async () => {
    if (!reviewNotes.trim()) {
      setNotesError(true);
      showToast.error('Catatan penolakan harus diisi sebelum reject');
      return;
    }
    setNotesError(false);
    await onReject(request.id, reviewNotes);
  };

  const handleClose = () => {
    setReviewNotes('');
    Object.values(paymentProofBlobUrls).forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDownloadInvoice = async () => {
    if (!request.invoice) {
      showToast.error('Invoice tidak ditemukan');
      return;
    }
    
    setDownloadingPdf(true);
    try {
      let invoiceItems = request.invoice.items;
      
      if (!invoiceItems || invoiceItems.length === 0) {
        const totalQty = request.items.reduce((sum, i) => sum + i.requestedQty, 0);
        const pricePerUnit = totalQty > 0 ? Math.round(request.invoice.totalAmount / totalQty) : 0;
        
        invoiceItems = request.items.map(item => ({
          id: item.id,
          masterProductId: item.masterProductId,
          productName: item.productName,
          quantity: item.requestedQty,
          pricePerUnit: pricePerUnit,
          subtotal: pricePerUnit * item.requestedQty,
        }));
      }
      
      const invoiceWithItems = {
        ...request,
        invoice: { ...request.invoice, items: invoiceItems },
      };
      
      await generateStockRequestInvoicePDF(invoiceWithItems);
      showToast.success('Invoice PDF berhasil didownload');
    } catch (error) {
      devError('Error generating invoice PDF:', error);
      showToast.error('Gagal membuat PDF invoice');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // File upload handlers
  const processFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      showToast.error('Hanya file gambar yang diperbolehkan');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 10MB');
      return;
    }

    if (isImageFile(selectedFile)) {
      setCompressing(true);
      try {
        const result = await compressImageWithPreset(selectedFile, 'paymentProof');
        setUploadFile(result.file);
        setUploadPreview(URL.createObjectURL(result.blob));
        setCompressionInfo({
          original: result.originalSize,
          compressed: result.compressedSize
        });
      } catch (error) {
        devError('Error compressing image:', error);
        setUploadFile(selectedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setUploadPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
        setCompressionInfo(null);
      } finally {
        setCompressing(false);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const removeUploadFile = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setCompressionInfo(null);
  };

  const handleUploadPayment = async () => {
    if (!uploadFile) {
      showToast.error('Pilih file bukti pembayaran terlebih dahulu');
      return;
    }

    const amount = paymentAmount.replace(/\./g, '');
    const numAmount = Number(amount);
    
    // For debt invoices, amount is required and must be valid
    if (isDebtInvoice) {
      if (!amount || !Number.isFinite(numAmount) || numAmount <= 0) {
        showToast.error('Masukkan jumlah pembayaran yang valid');
        return;
      }
      
      if (numAmount > remainingDebtAmount) {
        showToast.error(`Jumlah pembayaran melebihi sisa utang ${formatCurrency(remainingDebtAmount)}`);
        return;
      }
    }

    setUploadingPayment(true);
    try {
      await inventoryApi.uploadPaymentProof(
        request.id, 
        uploadFile, 
        isDebtInvoice && numAmount > 0 ? numAmount : undefined, 
        paymentNotes.trim() || undefined
      );
      showToast.success('Bukti pembayaran berhasil diupload');
      setShowUploadSection(false);
      setUploadFile(null);
      setUploadPreview(null);
      setPaymentAmount('');
      setPaymentNotes('');
      setCompressionInfo(null);
      if (uploadPreview) {
        URL.revokeObjectURL(uploadPreview);
      }
      // Refresh the data instead of full page reload
      handleClose();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal upload bukti pembayaran');
    } finally {
      setUploadingPayment(false);
    }
  };

  const canApprove = isManager && request.status === 'PENDING';
  const existingInvoiceTotal = request.invoice?.totalAmount ?? 0;
  const isDebtInvoice = request.invoice?.status === 'DEBT';
  const hasPaymentProof = Boolean(request.paymentProofUrl || request.invoice?.paymentProofUrl);
  const remainingDebtAmount = request.invoice?.remainingAmount ?? Math.max(0, existingInvoiceTotal - (request.invoice?.paidAmount ?? 0));
  const isFreeWaitingPayment = request.status === 'WAITING_PAYMENT' && existingInvoiceTotal <= 0;
  const canMarkDebt = isManager && request.status === 'WAITING_PAYMENT' && Boolean(request.invoice) && existingInvoiceTotal > 0 && !isDebtInvoice;
  const canConfirmPayment = isManager && (request.status === 'PAYMENT_UPLOADED' || isFreeWaitingPayment || (isDebtInvoice && hasPaymentProof && remainingDebtAmount <= 0));
  const canRejectUploadedPayment = isManager && request.status === 'PAYMENT_UPLOADED';
  const canReject = isManager && ['PENDING', 'WAITING_PAYMENT', 'PAYMENT_UPLOADED'].includes(request.status);
  const invoiceTotal = parseFloat(totalInvoiceAmount) || 0;
  const isFreeInvoice = (canApprove && invoiceTotal <= 0) || isFreeWaitingPayment;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'APPROVED': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'WAITING_PAYMENT': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'PAYMENT_UPLOADED': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PAYMENT_CONFIRMED': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'REJECTED': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'SHIPPED': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'COMPLETED': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
    }
  };

  const getInvoiceStatusLabel = (status: string) => {
    switch (status) {
      case 'DEBT':
        return 'Utang';
      case 'PAID':
        return 'Lunas';
      case 'PENDING_PAYMENT':
        return 'Menunggu Pembayaran';
      case 'OVERDUE':
        return 'Jatuh Tempo';
      case 'CANCELLED':
        return 'Dibatalkan';
      default:
        return status;
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transform transition-all dark:bg-neutral-900"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Review Request Stok
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {request.requestCode}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-6">
            {/* Request Info Card */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{request.branchName}</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                      request.branchType === 'PREMIER' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {request.branchType === 'PREMIER' ? 'Premier (Cabang)' : request.branchType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(request.createdAt).toLocaleString('id-ID')}</span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${getStatusColor(request.status)}`}>
                  {STATUS_ICONS[request.status]} {STATUS_LABELS[request.status]}
                </div>
              </div>
            </div>

            {/* Request Notes - Prominent Display */}
            {request.notes && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-amber-400 mb-1">Catatan Request</h4>
                    <p className="text-neutral-700 dark:text-neutral-200 text-sm leading-relaxed whitespace-pre-wrap">
                      {request.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            {(request.branchType === 'PARTNERSHIP' || request.branchType === 'PREMIER') && (request.invoice || paymentHistory.length > 0) && (
              <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700 pb-3">
                <button
                  onClick={() => setActiveTab('items')}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'items'
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                      : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Package className="h-4 w-4 inline mr-2" />
                  Items
                </button>
                {request.invoice && (
                  <button
                    onClick={() => setActiveTab('invoice')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === 'invoice'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <FileText className="h-4 w-4 inline mr-2" />
                    Invoice
                  </button>
                )}
                {paymentHistory.length > 0 && (
                  <button
                    onClick={() => setActiveTab('payment')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === 'payment'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 inline mr-2" />
                    Bukti Bayar ({paymentHistory.length})
                  </button>
                )}
              </div>
            )}

            {/* Items Tab */}
            {activeTab === 'items' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-500" />
                  Items yang Diminta ({request.itemCount} item)
                </h3>
                
                <div className="space-y-2">
                  {request.items.map((item) => {
                    const hasOverstock = item.overstockDeducted && item.overstockDeducted > 0;
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border ${
                          hasOverstock 
                            ? 'bg-purple-500/10 border-purple-500/20' 
                            : 'bg-blue-500/10 border-blue-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-white">{item.productName}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.productCategory}</p>
                          </div>
                          <div className="text-right">
                            {hasOverstock ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-neutral-400 line-through">{item.requestedQty}</span>
                                  <span className="text-lg font-bold text-amber-500">{item.finalQty}</span>
                                  <span className="text-sm text-neutral-500 dark:text-neutral-400">{item.unit}</span>
                                </div>
                                <p className="text-xs text-purple-400 mt-1">
                                  Overstock: -{item.overstockDeducted} {item.unit}
                                </p>
                              </>
                            ) : (
                              <>
                                <span className="text-lg font-bold text-amber-500">{item.requestedQty}</span>
                                <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-1">{item.unit}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {item.notes && (
                          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 italic">
                            Catatan: {item.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Total Price Input for PENDING requests - Single Total Amount */}
                {isManager && (request.branchType === 'PARTNERSHIP' || request.branchType === 'PREMIER') && request.status === 'PENDING' && (
                  <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Total Harga Invoice
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-500 dark:text-neutral-400 font-medium">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={totalInvoiceAmount ? Number(totalInvoiceAmount).toLocaleString('id-ID') : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                          setTotalInvoiceAmount(rawValue);
                        }}
                        placeholder="Masukkan total harga (0 untuk gratis)"
                        className="flex-1 px-4 py-3 text-lg font-semibold rounded-xl border border-emerald-500/30 bg-neutral-800/50 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      Masukkan 0 atau kosongkan untuk approve gratis tanpa bukti pembayaran.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Invoice Tab */}
            {activeTab === 'invoice' && request.invoice && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-emerald-400">{request.invoice.invoiceNumber}</h4>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                        Status: {getInvoiceStatusLabel(request.invoice.status)}
                      </p>
                      {isDebtInvoice && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-400">
                          <CreditCard className="h-3.5 w-3.5" />
                          Pembayaran utang, bukti wajib diupload kemudian
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(request.invoice.totalAmount)}
                      </p>
                    </div>
                  </div>
                  
                  {request.invoice.items && request.invoice.items.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h5 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Detail Items
                      </h5>
                      {request.invoice.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10"
                        >
                          <span className="text-sm text-neutral-700 dark:text-neutral-200">
                            {item.productName} × {item.quantity}
                          </span>
                          <span className="font-semibold text-emerald-400">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={handleDownloadInvoice}
                    disabled={downloadingPdf}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30"
                  >
                    {downloadingPdf ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Membuat PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download Invoice PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && paymentHistory.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Riwayat Pembayaran
                  </h4>
                  <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                    {paymentHistory.length} transaksi
                  </span>
                </div>

                {paymentHistory.map((payment, index) => {
                  const isLoading = loadingPaymentProofIds.includes(payment.id);
                  const hasFailed = failedPaymentProofIds.includes(payment.id);
                  const blobUrl = paymentProofBlobUrls[payment.id];
                  const isRejected = Boolean(payment.rejectionReason);
                  const isVerified = Boolean(payment.verifiedAt) && !isRejected;

                  return (
                    <div
                      key={payment.id}
                      className="overflow-hidden rounded-xl border border-purple-500/30 bg-purple-500/10"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-purple-500/20 p-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                            Pembayaran #{paymentHistory.length - index}
                          </p>
                          <p className="mt-1 text-xl font-bold text-emerald-400">
                            {formatCurrency(payment.amount)}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          isRejected
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : isVerified
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                        }`}>
                          {isRejected ? 'Ditolak' : isVerified ? 'Terverifikasi' : 'Menunggu Verifikasi'}
                        </span>
                      </div>

                      <div className="p-4">
                        <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-xl border border-purple-500/20 bg-neutral-900/50">
                          {isLoading ? (
                            <div className="py-16 text-center">
                              <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-purple-400" />
                              <p className="text-neutral-400">Memuat gambar...</p>
                            </div>
                          ) : blobUrl ? (
                            <img
                              src={blobUrl}
                              alt={`Bukti pembayaran ${paymentHistory.length - index}`}
                              className="max-h-[400px] w-full object-contain"
                            />
                          ) : (
                            <div className="py-16 text-center">
                              <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
                              <p className="mb-3 text-red-400">
                                {hasFailed ? 'Gagal memuat gambar' : 'Bukti pembayaran tidak tersedia'}
                              </p>
                              <button
                                onClick={() => fetchPaymentProof(payment.id, payment.proofFileUrl)}
                                className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600"
                              >
                                <RefreshCw className="mr-2 inline h-4 w-4" />
                                Coba Lagi
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-neutral-500 dark:text-neutral-400 sm:grid-cols-2">
                          <p className="flex items-center gap-2">
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{payment.proofFileName}</span>
                          </p>
                          <p className="flex items-center gap-2 sm:justify-end">
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            {new Date(payment.uploadedAt).toLocaleString('id-ID')}
                          </p>
                          {payment.proofFileSize > 0 && (
                            <p className="text-xs">{formatFileSize(payment.proofFileSize)}</p>
                          )}
                        </div>

                        {payment.notes && (
                          <div className="mt-3 rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                              Catatan Pembayaran
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{payment.notes}</p>
                          </div>
                        )}

                        {(payment.verificationNotes || payment.rejectionReason) && (
                          <div className={`mt-3 rounded-lg border p-3 ${
                            isRejected
                              ? 'border-red-500/20 bg-red-500/10'
                              : 'border-emerald-500/20 bg-emerald-500/10'
                          }`}>
                            <p className={`text-xs font-semibold uppercase tracking-wider ${
                              isRejected ? 'text-red-400' : 'text-emerald-400'
                            }`}>
                              {isRejected ? 'Alasan Penolakan' : 'Catatan Verifikasi'}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">
                              {payment.rejectionReason || payment.verificationNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Existing Review Notes - Show when request has been reviewed */}
            {request.reviewNotes && (
              <div className={`p-4 rounded-xl border ${
                request.status === 'REJECTED' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    request.status === 'REJECTED' ? 'bg-red-500/20' : 'bg-emerald-500/20'
                  }`}>
                    {request.status === 'REJECTED' ? (
                      <X className="h-5 w-5 text-red-400" />
                    ) : (
                      <Check className="h-5 w-5 text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-sm font-semibold mb-1 ${
                      request.status === 'REJECTED' ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {request.status === 'REJECTED' ? 'Alasan Penolakan' : 'Catatan Review'}
                    </h4>
                    <p className="text-neutral-700 dark:text-neutral-200 text-sm leading-relaxed whitespace-pre-wrap">
                      {request.reviewNotes}
                    </p>
                    {request.reviewedAt && (
                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Direview: {new Date(request.reviewedAt).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Upload Payment Proof Section - Show for WAITING_PAYMENT status */}
            {isManager && request.status === 'WAITING_PAYMENT' && request.invoice && existingInvoiceTotal > 0 && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Bukti Pembayaran
                  </h4>
                  {!showUploadSection && (
                    <button
                      onClick={() => setShowUploadSection(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
                    >
                      Tampilkan Form
                    </button>
                  )}
                </div>

                {showUploadSection && (
                  <div className="space-y-3 mt-4">
                    {/* Payment Amount Input with Rupiah Formatting */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-400">
                        Jumlah Pembayaran {isDebtInvoice && <span className="text-red-400">*</span>}
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-500 dark:text-neutral-400 font-medium">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={paymentAmount ? Number(paymentAmount.replace(/\./g, '')).toLocaleString('id-ID') : ''}
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                            setPaymentAmount(rawValue);
                          }}
                          placeholder="0"
                          className="flex-1 px-4 py-3 text-lg font-semibold rounded-xl border border-blue-500/30 bg-neutral-800/50 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      {isDebtInvoice && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Sisa utang: {formatCurrency(remainingDebtAmount)}
                        </p>
                      )}
                    </div>

                    {/* Payment Notes Input */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-neutral-400">Catatan Pembayaran</label>
                      <textarea
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        rows={2}
                        placeholder="Opsional"
                        className="w-full resize-none rounded-xl border border-blue-500/30 bg-neutral-800/50 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* File Upload Area */}
                    {!uploadPreview ? (
                      <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => !compressing && document.getElementById('upload-payment-file-input')?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                          compressing
                            ? 'border-blue-500 bg-blue-500/10'
                            : dragActive 
                              ? 'border-blue-500 bg-blue-500/10' 
                              : 'border-neutral-700 bg-neutral-800/30 hover:border-blue-500/50 hover:bg-neutral-800/50'
                        }`}
                      >
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
                          {compressing ? (
                            <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
                          ) : (
                            <ImageIcon className="w-7 h-7 text-neutral-500" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-neutral-300 mb-1">
                          {compressing 
                            ? 'Mengkompresi gambar...' 
                            : dragActive 
                              ? 'Lepaskan file di sini' 
                              : 'Drag & drop atau klik untuk memilih'}
                        </p>
                        <p className="text-xs text-neutral-500">
                          JPG, PNG, JPEG • Maks. 10MB (akan dikompresi otomatis)
                        </p>
                        <input
                          id="upload-payment-file-input"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={compressing}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden bg-neutral-900 border border-blue-500/20">
                          <img 
                            src={uploadPreview} 
                            alt="Preview"
                            className="w-full max-h-48 object-contain"
                          />
                          <div className="absolute top-2 right-2">
                            <button
                              onClick={removeUploadFile}
                              className="p-2 rounded-lg bg-red-500/90 hover:bg-red-500 text-white transition-all shadow-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-200 truncate">{uploadFile?.name}</p>
                            <p className="text-xs text-neutral-500">
                              {uploadFile ? formatFileSize(uploadFile.size) : ''}
                              {compressionInfo && (
                                <span className="text-emerald-400 ml-2">
                                  (dikompresi dari {formatFileSize(compressionInfo.original)})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Upload Button */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => {
                          setShowUploadSection(false);
                          setUploadFile(null);
                          setUploadPreview(null);
                          setPaymentAmount('');
                          setPaymentNotes('');
                        }}
                        disabled={uploadingPayment}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all disabled:opacity-50"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleUploadPayment}
                        disabled={uploadingPayment || !uploadFile}
                        className={`flex-1 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                          uploadFile
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-lg shadow-blue-500/25'
                            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                        }`}
                      >
                        {uploadingPayment ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Mengupload...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload & Simpan
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes Input - Only show for managers */}
            {isManager && (canApprove || canMarkDebt || canConfirmPayment || canReject) && (
              <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  {canMarkDebt ? 'Catatan Utang' : isFreeWaitingPayment ? 'Catatan Approve Gratis' : canConfirmPayment ? 'Catatan Verifikasi' : 'Catatan Review'}
                  {(canApprove || canReject) && !canConfirmPayment && (
                    <span className="text-red-500">*</span>
                  )}
                </h4>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => {
                    setReviewNotes(e.target.value);
                    if (e.target.value.trim()) setNotesError(false);
                  }}
                  placeholder={canMarkDebt ? 'Catatan alasan utang (opsional)...' : isFreeWaitingPayment ? 'Catatan approve gratis (opsional)...' : canConfirmPayment ? 'Catatan verifikasi pembayaran (opsional)...' : 'Masukkan catatan review (wajib diisi)...'}
                  rows={3}
                  className={`w-full px-4 py-3 text-sm rounded-xl border bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none transition-all ${
                    notesError ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                />
                {notesError && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Catatan wajib diisi
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
            {/* Approve/Create Invoice Button */}
            {canApprove && (
              <>
                {!isFreeInvoice && (
                  <button
                    onClick={handleApproveDebt}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Approve Utang
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {isFreeInvoice ? 'Approve Gratis' : 'Buat Invoice'}
                    </>
                  )}
                </button>
              </>
            )}

            {/* Mark Existing Invoice as Debt */}
            {canMarkDebt && (
              <button
                onClick={handleMarkDebt}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Jadikan Utang
                  </>
                )}
              </button>
            )}

            {/* Confirm Payment Button */}
            {canConfirmPayment && (
              <>
                <button
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {isFreeWaitingPayment ? 'Approve Gratis' : isDebtInvoice ? 'Konfirmasi Pelunasan' : 'Konfirmasi Pembayaran'}
                    </>
                  )}
                </button>
                {canRejectUploadedPayment && (
                  <button
                    onClick={handleRejectPayment}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Tolak Pembayaran'}
                  </button>
                )}
              </>
            )}

            {/* Reject Button */}
            {canReject && request.status !== 'PAYMENT_UPLOADED' && (
              <button
                onClick={handleReject}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Reject
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
