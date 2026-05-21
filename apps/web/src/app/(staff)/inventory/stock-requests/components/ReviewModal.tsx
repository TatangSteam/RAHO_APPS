'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, FileText, CreditCard, Check, AlertCircle, Download, RefreshCw, Clock, Building2, MessageSquare } from 'lucide-react';
import { StockRequest, InvoiceItemInput, STATUS_LABELS, STATUS_ICONS } from '../types';
import { showToast } from '@/lib/toast';
import { generateStockRequestInvoicePDF } from '@/lib/stockRequestInvoicePdf';
import { useAuthStore } from '@/stores/authStore';

interface ReviewModalProps {
  request: StockRequest;
  userRole?: string;
  onClose: () => void;
  onApprovePremierRequest: (requestId: string, reviewNotes: string) => Promise<void>;
  onCreatePartnershipInvoice: (requestId: string, items: InvoiceItemInput[], notes?: string) => Promise<void>;
  onConfirmPayment: (requestId: string, verificationNotes?: string) => Promise<void>;
  onRejectPayment: (requestId: string, rejectionReason: string) => Promise<void>;
  onReject: (requestId: string, reviewNotes: string) => Promise<void>;
  loading: boolean;
}

export default function ReviewModal({ 
  request, 
  userRole,
  onClose, 
  onApprovePremierRequest,
  onCreatePartnershipInvoice,
  onConfirmPayment,
  onRejectPayment,
  onReject, 
  loading 
}: ReviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [notesError, setNotesError] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'invoice' | 'payment'>('items');
  const [paymentProofBlobUrl, setPaymentProofBlobUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Total price for Partnership (single input instead of per-item)
  const [totalInvoiceAmount, setTotalInvoiceAmount] = useState<string>('');

  const { accessToken } = useAuthStore();
  const isManager = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER';

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Auto-switch to payment tab when status is PAYMENT_UPLOADED
  useEffect(() => {
    if (request.status === 'PAYMENT_UPLOADED' && request.paymentProofUrl) {
      setActiveTab('payment');
    }
  }, [request]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Fetch payment proof image with authentication
  const fetchPaymentProof = useCallback(async () => {
    if (!request.paymentProofUrl || !accessToken) return;
    
    setLoadingImage(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      
      let apiUrl: string;
      if (request.paymentProofUrl.startsWith('http')) {
        apiUrl = request.paymentProofUrl;
      } else if (request.paymentProofUrl.startsWith('/api/v1/')) {
        apiUrl = apiBaseUrl + request.paymentProofUrl.replace('/api/v1', '');
      } else if (request.paymentProofUrl.startsWith('/')) {
        apiUrl = apiBaseUrl + request.paymentProofUrl;
      } else {
        apiUrl = `${apiBaseUrl}/${request.paymentProofUrl}`;
      }
      
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setPaymentProofBlobUrl(blobUrl);
      }
    } catch (error) {
      console.error('Error fetching payment proof:', error);
    } finally {
      setLoadingImage(false);
    }
  }, [request.paymentProofUrl, accessToken]);

  useEffect(() => {
    if (request.paymentProofUrl && accessToken) {
      fetchPaymentProof();
    }
    return () => {
      if (paymentProofBlobUrl) {
        URL.revokeObjectURL(paymentProofBlobUrl);
      }
    };
  }, [request.paymentProofUrl, accessToken, fetchPaymentProof]);

  // Build invoice items from total amount (distribute evenly)
  const buildInvoiceItems = (): InvoiceItemInput[] => {
    const total = parseFloat(totalInvoiceAmount) || 0;
    if (total <= 0) return [];
    
    const totalQty = request.items.reduce((sum, item) => sum + item.requestedQty, 0);
    const pricePerUnit = totalQty > 0 ? Math.round(total / totalQty) : 0;
    
    return request.items.map(item => ({
      masterProductId: item.masterProductId,
      quantity: item.requestedQty,
      pricePerUnit: pricePerUnit,
    }));
  };

  const handleApprove = async () => {
    if (request.branchType === 'PREMIER') {
      if (!reviewNotes.trim()) {
        setNotesError(true);
        showToast.error('Catatan review harus diisi sebelum approve');
        return;
      }
      setNotesError(false);
      await onApprovePremierRequest(request.id, reviewNotes);
    } else {
      const total = parseFloat(totalInvoiceAmount) || 0;
      if (total <= 0) {
        showToast.error('Total harga invoice harus diisi');
        return;
      }
      const invoiceItems = buildInvoiceItems();
      await onCreatePartnershipInvoice(request.id, invoiceItems, reviewNotes);
    }
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
    if (paymentProofBlobUrl) {
      URL.revokeObjectURL(paymentProofBlobUrl);
    }
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
      console.error('Error generating invoice PDF:', error);
      showToast.error('Gagal membuat PDF invoice');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const canApprove = isManager && request.status === 'PENDING';
  const canConfirmPayment = isManager && request.status === 'PAYMENT_UPLOADED';
  const canReject = isManager && ['PENDING', 'WAITING_PAYMENT', 'PAYMENT_UPLOADED'].includes(request.status);

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
          className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all max-h-[90vh] flex flex-col"
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                      {request.branchType}
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
            {request.branchType === 'PARTNERSHIP' && (request.invoice || request.paymentProofUrl) && (
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
                {request.paymentProofUrl && (
                  <button
                    onClick={() => setActiveTab('payment')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === 'payment'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 inline mr-2" />
                    Bukti Bayar
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
                  {request.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
                    >
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-white">{item.productName}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.productCategory}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-amber-500">{item.requestedQty}</span>
                        <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-1">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Price Input for Partnership PENDING - Single Total Amount */}
                {isManager && request.branchType === 'PARTNERSHIP' && request.status === 'PENDING' && (
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
                        placeholder="Masukkan total harga"
                        className="flex-1 px-4 py-3 text-lg font-semibold rounded-xl border border-emerald-500/30 bg-neutral-800/50 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </div>
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
                        Status: {request.invoice.status}
                      </p>
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
            {activeTab === 'payment' && request.paymentProofUrl && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Bukti Pembayaran
                  </h4>
                  
                  <div className="rounded-xl overflow-hidden bg-neutral-900/50 border border-purple-500/20 min-h-[200px] flex items-center justify-center">
                    {loadingImage ? (
                      <div className="py-16 text-center">
                        <RefreshCw className="h-8 w-8 text-purple-400 animate-spin mx-auto mb-3" />
                        <p className="text-neutral-400">Memuat gambar...</p>
                      </div>
                    ) : paymentProofBlobUrl ? (
                      <img 
                        src={paymentProofBlobUrl} 
                        alt="Bukti Pembayaran"
                        className="w-full max-h-[400px] object-contain"
                      />
                    ) : (
                      <div className="py-16 text-center">
                        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
                        <p className="text-red-400 mb-3">Gagal memuat gambar</p>
                        <button
                          onClick={fetchPaymentProof}
                          className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors"
                        >
                          <RefreshCw className="h-4 w-4 inline mr-2" />
                          Coba Lagi
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {request.paymentProofFileName && (
                    <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {request.paymentProofFileName}
                    </p>
                  )}
                  {request.paymentUploadedAt && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Diupload: {new Date(request.paymentUploadedAt).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>
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

            {/* Notes Input - Only show for managers */}
            {isManager && (canApprove || canConfirmPayment || canReject) && (
              <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  {canConfirmPayment ? 'Catatan Verifikasi' : 'Catatan Review'}
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
                  placeholder={canConfirmPayment ? 'Catatan verifikasi pembayaran (opsional)...' : 'Masukkan catatan review (wajib diisi)...'}
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
                    {request.branchType === 'PREMIER' ? 'Approve Request' : 'Buat Invoice'}
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
                      Konfirmasi Pembayaran
                    </>
                  )}
                </button>
                <button
                  onClick={handleRejectPayment}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Tolak Pembayaran'}
                </button>
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
