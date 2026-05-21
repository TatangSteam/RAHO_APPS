'use client';

import { useState, useEffect, useCallback } from 'react';
import { StockRequest, InvoiceItemInput, STATUS_LABELS, STATUS_ICONS } from '../types';
import { showToast } from '@/lib/toast';
import { generateStockRequestInvoicePDF } from '@/lib/stockRequestInvoicePdf';
import { useAuthStore } from '@/stores/authStore';
import modalStyles from '@/components/members/AssignPackageModal.module.css';

interface ReviewModalProps {
  request: StockRequest;
  userRole?: string;
  onClose: () => void;
  onApprovePremiereRequest: (requestId: string, reviewNotes: string) => Promise<void>;
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
  onApprovePremiereRequest,
  onCreatePartnershipInvoice,
  onConfirmPayment,
  onRejectPayment,
  onReject, 
  loading 
}: ReviewModalProps) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [notesError, setNotesError] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'invoice' | 'payment'>('items');
  const [paymentProofBlobUrl, setPaymentProofBlobUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Invoice items for Partnership
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemInput[]>([]);

  // Get access token for authenticated image fetch
  const { accessToken } = useAuthStore();

  // Check if user is manager (can approve/reject)
  const isManager = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_MANAGER';

  // Initialize invoice items from request items
  useEffect(() => {
    if (request.branchType === 'PARTNERSHIP' && request.status === 'PENDING') {
      setInvoiceItems(
        request.items.map(item => ({
          masterProductId: item.masterProductId,
          quantity: item.requestedQty,
          pricePerUnit: 0,
        }))
      );
    }
    
    // Auto-switch to payment tab when status is PAYMENT_UPLOADED
    if (request.status === 'PAYMENT_UPLOADED' && request.paymentProofUrl) {
      setActiveTab('payment');
    }
  }, [request]);

  // Fetch payment proof image with authentication
  const fetchPaymentProof = useCallback(async () => {
    if (!request.paymentProofUrl || !accessToken) return;
    
    setLoadingImage(true);
    try {
      // The paymentProofUrl is stored as /api/v1/files/uploads/stock-requests/...
      // NEXT_PUBLIC_API_URL is http://localhost:4000/api/v1
      // So we need to build: http://localhost:4000/api/v1/files/uploads/...
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      
      let apiUrl: string;
      if (request.paymentProofUrl.startsWith('http')) {
        // Already a full URL
        apiUrl = request.paymentProofUrl;
      } else if (request.paymentProofUrl.startsWith('/api/v1/')) {
        // Stored as /api/v1/files/... - need to replace with full API URL
        apiUrl = apiBaseUrl + request.paymentProofUrl.replace('/api/v1', '');
      } else if (request.paymentProofUrl.startsWith('/')) {
        // Stored as /files/... - append to API URL
        apiUrl = apiBaseUrl + request.paymentProofUrl;
      } else {
        // Relative path - append to API URL
        apiUrl = `${apiBaseUrl}/${request.paymentProofUrl}`;
      }
      
      console.log('Fetching payment proof from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setPaymentProofBlobUrl(blobUrl);
      } else {
        console.error('Failed to fetch payment proof:', response.status, await response.text());
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

    // Cleanup blob URL on unmount
    return () => {
      if (paymentProofBlobUrl) {
        URL.revokeObjectURL(paymentProofBlobUrl);
      }
    };
  }, [request.paymentProofUrl, accessToken, fetchPaymentProof]);

  const handleApprove = async () => {
    if (request.branchType === 'PREMIERE') {
      if (!reviewNotes.trim()) {
        setNotesError(true);
        showToast.error('Catatan review harus diisi sebelum approve');
        return;
      }
      setNotesError(false);
      await onApprovePremiereRequest(request.id, reviewNotes);
    } else {
      const invalidItems = invoiceItems.filter(item => item.pricePerUnit <= 0);
      if (invalidItems.length > 0) {
        showToast.error('Semua item harus memiliki harga');
        return;
      }
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

  const updateInvoiceItemPrice = (masterProductId: string, price: number) => {
    setInvoiceItems(prev => 
      prev.map(item => 
        item.masterProductId === masterProductId 
          ? { ...item, pricePerUnit: price }
          : item
      )
    );
  };

  const calculateTotal = () => {
    return invoiceItems.reduce((sum, item) => sum + (item.quantity * item.pricePerUnit), 0);
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
      // Create invoice data with items from request if invoice.items is empty
      let invoiceItems = request.invoice.items;
      
      if (!invoiceItems || invoiceItems.length === 0) {
        // Fallback: calculate items from request items
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
        invoice: {
          ...request.invoice,
          items: invoiceItems,
        }
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

  return (
    <div className={modalStyles.modalBackdrop} onClick={handleClose}>
      <div className={modalStyles.modalContainer} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        {/* Header */}
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.modalTitle}>Review Request Stok</h2>
          <button className={modalStyles.closeButton} onClick={handleClose}>×</button>
        </div>

        {/* Body */}
        <div className={modalStyles.modalBody}>
          {/* Request Info Section */}
          <div className={modalStyles.section}>
            <div className={modalStyles.sectionBox} style={{ 
              background: 'rgba(148, 163, 184, 0.1)', 
              borderColor: 'rgba(148, 163, 184, 0.3)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '4px' }}>{request.requestCode}</p>
                  <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {request.branchName}
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: request.branchType === 'PREMIERE' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: request.branchType === 'PREMIERE' ? '#3b82f6' : '#f59e0b',
                    }}>
                      {request.branchType}
                    </span>
                  </p>
                </div>
                <div style={{ 
                  padding: '6px 12px', 
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: request.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : 
                                 request.status === 'PAYMENT_UPLOADED' ? 'rgba(59, 130, 246, 0.2)' : 
                                 request.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                  color: request.status === 'PENDING' ? '#f59e0b' : 
                         request.status === 'PAYMENT_UPLOADED' ? '#3b82f6' : 
                         request.status === 'APPROVED' ? '#22c55e' : 'var(--text-secondary)',
                }}>
                  {STATUS_ICONS[request.status]} {STATUS_LABELS[request.status]}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          {request.branchType === 'PARTNERSHIP' && (request.invoice || request.paymentProofUrl) && (
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginBottom: '20px', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
              paddingBottom: '12px' 
            }}>
              <button
                onClick={() => setActiveTab('items')}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: activeTab === 'items' ? 'var(--color-primary-500)' : 'transparent',
                  color: activeTab === 'items' ? 'white' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                }}
              >
                📦 Items
              </button>
              {request.invoice && (
                <button
                  onClick={() => setActiveTab('invoice')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    background: activeTab === 'invoice' ? 'var(--color-primary-500)' : 'transparent',
                    color: activeTab === 'invoice' ? 'white' : 'var(--text-secondary)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  📄 Invoice
                </button>
              )}
              {request.paymentProofUrl && (
                <button
                  onClick={() => setActiveTab('payment')}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    background: activeTab === 'payment' ? 'var(--color-primary-500)' : 'transparent',
                    color: activeTab === 'payment' ? 'white' : 'var(--text-secondary)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s',
                  }}
                >
                  💳 Bukti Bayar
                </button>
              )}
            </div>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox} ${modalStyles.basicSection}`}>
                <h3 className={`${modalStyles.sectionTitle} ${modalStyles.basicTitle}`}>
                  📦 Items yang Diminta ({request.itemCount} item)
                </h3>
                
                {request.items.map((item, index) => (
                  <div key={item.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    marginBottom: index < request.items.length - 1 ? '8px' : '0',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{item.productName}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '8px' }}>
                        ({item.productCategory})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary-500)' }}>
                        {item.requestedQty} {item.unit}
                      </span>
                      {/* Price input for Partnership PENDING */}
                      {isManager && request.branchType === 'PARTNERSHIP' && request.status === 'PENDING' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Rp</span>
                          <input
                            type="number"
                            min="0"
                            value={invoiceItems.find(i => i.masterProductId === item.masterProductId)?.pricePerUnit || ''}
                            onChange={(e) => updateInvoiceItemPrice(item.masterProductId, Number(e.target.value))}
                            placeholder="Harga/unit"
                            style={{
                              width: '120px',
                              padding: '8px 12px',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              background: 'var(--surface-secondary)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Total for Partnership PENDING */}
                {isManager && request.branchType === 'PARTNERSHIP' && request.status === 'PENDING' && (
                  <div style={{ 
                    marginTop: '16px', 
                    padding: '12px 16px', 
                    backgroundColor: 'rgba(34, 197, 94, 0.15)', 
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }}>
                    <span style={{ fontWeight: 600, color: '#22c55e' }}>Total Invoice:</span>
                    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#22c55e' }}>
                      {formatCurrency(calculateTotal())}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoice Tab */}
          {activeTab === 'invoice' && request.invoice && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox} ${modalStyles.discountSection}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 className={`${modalStyles.sectionTitle} ${modalStyles.discountTitle}`} style={{ marginBottom: '4px' }}>
                      📄 {request.invoice.invoiceNumber}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      Status: {request.invoice.status}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700, fontSize: '1.5rem', color: '#22c55e' }}>
                      {formatCurrency(request.invoice.totalAmount)}
                    </p>
                  </div>
                </div>
                
                {/* Invoice Items */}
                {request.invoice.items && request.invoice.items.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Detail Items:
                    </h4>
                    {request.invoice.items.map((item, index) => (
                      <div key={item.id} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderRadius: '6px',
                        marginBottom: index < request.invoice!.items!.length - 1 ? '6px' : '0',
                      }}>
                        <span>{item.productName} × {item.quantity}</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Download Button */}
                <button
                  onClick={handleDownloadInvoice}
                  disabled={downloadingPdf}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: downloadingPdf ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: downloadingPdf ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {downloadingPdf ? '⏳ Membuat PDF...' : '📥 Download Invoice PDF'}
                </button>
              </div>
            </div>
          )}

          {/* Payment Tab */}
          {activeTab === 'payment' && request.paymentProofUrl && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox} ${modalStyles.boosterSection}`}>
                <h3 className={`${modalStyles.sectionTitle} ${modalStyles.boosterTitle}`}>
                  💳 Bukti Pembayaran
                </h3>
                
                <div style={{ 
                  border: '1px solid rgba(168, 85, 247, 0.3)', 
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  minHeight: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {loadingImage ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
                      <p>Memuat gambar...</p>
                    </div>
                  ) : paymentProofBlobUrl ? (
                    <img 
                      src={paymentProofBlobUrl} 
                      alt="Bukti Pembayaran"
                      style={{ 
                        width: '100%', 
                        maxHeight: '400px', 
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
                      <p style={{ color: '#ef4444', marginBottom: '8px' }}>Gagal memuat gambar</p>
                      <button
                        onClick={fetchPaymentProof}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#a855f7',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        🔄 Coba Lagi
                      </button>
                    </div>
                  )}
                </div>
                
                {request.paymentProofFileName && (
                  <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    📎 File: {request.paymentProofFileName}
                  </p>
                )}
                {request.paymentUploadedAt && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    🕐 Diupload: {new Date(request.paymentUploadedAt).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Existing Review Notes - Show when request has been reviewed */}
          {request.reviewNotes && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox}`} style={{
                background: request.status === 'REJECTED' 
                  ? 'rgba(239, 68, 68, 0.1)' 
                  : 'rgba(34, 197, 94, 0.1)',
                borderColor: request.status === 'REJECTED' 
                  ? 'rgba(239, 68, 68, 0.3)' 
                  : 'rgba(34, 197, 94, 0.3)',
              }}>
                <h3 className={modalStyles.sectionTitle} style={{
                  color: request.status === 'REJECTED' ? '#ef4444' : '#22c55e',
                }}>
                  {request.status === 'REJECTED' ? '❌ Alasan Penolakan' : '✅ Catatan Review'}
                </h3>
                <p style={{ 
                  color: 'var(--text-primary)', 
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                }}>
                  {request.reviewNotes}
                </p>
                {request.reviewedAt && (
                  <p style={{ 
                    color: 'var(--text-muted)', 
                    fontSize: '0.8rem', 
                    marginTop: '8px' 
                  }}>
                    🕐 Direview: {new Date(request.reviewedAt).toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notes Input - Only show for managers */}
          {isManager && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox} ${modalStyles.addonsSection}`}>
                <h3 className={`${modalStyles.sectionTitle} ${modalStyles.addonsTitle}`}>
                  📝 {canConfirmPayment ? 'Catatan Verifikasi' : 'Catatan Review'}
                  {(canApprove || canReject) && !canConfirmPayment && <span style={{ color: '#ef4444' }}> *</span>}
                </h3>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => {
                    setReviewNotes(e.target.value);
                    if (e.target.value.trim()) setNotesError(false);
                  }}
                  placeholder={canConfirmPayment ? 'Catatan verifikasi pembayaran (opsional)...' : 'Masukkan catatan review (wajib diisi)...'}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: notesError ? '2px solid #ef4444' : '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                  }}
                />
                {notesError && (
                  <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '4px' }}>
                    Catatan wajib diisi
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={modalStyles.modalFooter}>
          {/* Approve/Create Invoice Button */}
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '⏳ Memproses...' : 
                request.branchType === 'PREMIERE' ? '✓ Approve Request' : '📄 Buat Invoice'}
            </button>
          )}

          {/* Confirm Payment Button */}
          {canConfirmPayment && (
            <>
              <button
                onClick={handleConfirmPayment}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '⏳ Memproses...' : '✓ Konfirmasi Pembayaran'}
              </button>
              <button
                onClick={handleRejectPayment}
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '⏳' : '↩ Tolak'}
              </button>
            </>
          )}

          {/* Reject Button */}
          {canReject && request.status !== 'PAYMENT_UPLOADED' && (
            <button
              onClick={handleReject}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '⏳ Memproses...' : '✗ Reject'}
            </button>
          )}

          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgba(148, 163, 184, 0.2)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
