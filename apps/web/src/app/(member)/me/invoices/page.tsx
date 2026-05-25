'use client'
import { useEffect, useState, useCallback } from 'react'
import { meApi, MemberInvoice } from '@/lib/api/meApi'
import { api } from '@/lib/api'
import { generateInvoicePDF } from '@/lib/pdfGenerator'
import { 
  FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, 
  Download, Image as ImageIcon, X, RefreshCw, ImageOff, Loader2 
} from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PAID:           { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Lunas' },
  PENDING_PAYMENT: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Menunggu Pembayaran' },
  PENDINGPAYMENT: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Menunggu Pembayaran' },
  DRAFT:          { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Draft' },
  CANCELLED:      { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'Dibatalkan' },
  OVERDUE:        { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'Jatuh Tempo' },
}

export default function MemberInvoicesPage() {
  const [invoices, setInvoices]   = useState<MemberInvoice[]>([])
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Payment proof modal
  const [proofModal, setProofModal] = useState<{ url: string; fileName: string } | null>(null)
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [proofError, setProofError] = useState(false)
  
  // PDF download loading state
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  useEffect(() => { loadInvoices() }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const { data, meta } = await meApi.getInvoices(page, 10)
      setInvoices(data)
      setTotalPages(meta.totalPages)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  const formatNumber = (n: number) => n.toLocaleString('id-ID')

  // Load payment proof image with authentication
  const loadProofImage = useCallback(async (url: string) => {
    try {
      setProofLoading(true)
      setProofError(false)
      
      let filePath = url
      if (url.startsWith('http')) {
        const urlObj = new URL(url)
        filePath = urlObj.pathname
      }
      filePath = filePath
        .replace(/^\/api\/v1\/files\//, '')
        .replace(/^\/files\//, '')
        .replace(/^api\/v1\/files\//, '')
        .replace(/^files\//, '')
      
      const response = await api.get(`/files/${filePath}`, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(response.data)
      setProofImageUrl(blobUrl)
    } catch (e) {
      console.error('Failed to load payment proof:', e)
      setProofError(true)
    } finally {
      setProofLoading(false)
    }
  }, [])

  const openProofModal = (url: string, fileName: string) => {
    setProofModal({ url, fileName })
    loadProofImage(url)
  }

  const closeProofModal = () => {
    if (proofImageUrl) URL.revokeObjectURL(proofImageUrl)
    setProofModal(null)
    setProofImageUrl(null)
    setProofError(false)
  }

  // Download PDF using the same generator as admin
  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      setPdfLoading(invoiceId)
      // Fetch full invoice detail
      const fullInvoice = await meApi.getInvoiceDetail(invoiceId)
      // Generate PDF using the same function as admin
      await generateInvoicePDF(fullInvoice)
    } catch (error) {
      console.error('Failed to generate PDF:', error)
      alert('Gagal membuat PDF. Silakan coba lagi.')
    } finally {
      setPdfLoading(null)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <FileText size={24} color="var(--color-primary-400)" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Invoice</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
          Riwayat transaksi dan pembayaran Anda
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>Memuat invoice...</div>
      ) : invoices.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48,
          background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🧾</div>
          <p style={{ fontWeight: 600, fontSize: 16 }}>Belum ada invoice</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {invoices.map(inv => {
            const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE.DRAFT
            const isOpen = expanded === inv.id
            return (
              <div key={inv.id} style={{
                background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              }}>
                {/* Row Header */}
                <div
                  onClick={() => setExpanded(isOpen ? null : inv.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-primary-400)', marginBottom: 2 }}>
                      {inv.invoiceNumber}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDate(inv.createdAt)} · {inv.branchName}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 99, background: st.bg, color: st.color,
                    }}>{st.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Rp {formatNumber(inv.totalAmount)}
                    </span>
                    {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isOpen && (
                  <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--surface-border)' }}>
                    {/* Items */}
                    <div style={{ paddingTop: 12, marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Rincian Item
                    </div>
                    {inv.items.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '8px 0', borderBottom: i < inv.items.length - 1 ? '1px solid var(--surface-border)' : 'none',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.description}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {item.quantity}x Rp {formatNumber(item.pricePerUnit)}
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Rp {formatNumber(item.totalAmount)}
                        </span>
                      </div>
                    ))}
                    
                    {/* Payment Info */}
                    {inv.paidAt && (
                      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                        Dibayar: {formatDate(inv.paidAt)}
                        {inv.paymentMethod && <> · Metode: <strong>{inv.paymentMethod}</strong></>}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ 
                      display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, 
                      borderTop: '1px solid var(--surface-border)' 
                    }}>
                      {/* Download PDF */}
                      <button
                        onClick={() => handleDownloadPDF(inv.id)}
                        disabled={pdfLoading === inv.id}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', fontSize: 12, fontWeight: 500,
                          background: pdfLoading === inv.id ? 'var(--surface-ground)' : 'var(--color-primary-500)', 
                          color: pdfLoading === inv.id ? 'var(--text-muted)' : '#fff',
                          border: 'none', borderRadius: 'var(--radius-md)', 
                          cursor: pdfLoading === inv.id ? 'not-allowed' : 'pointer',
                          opacity: pdfLoading === inv.id ? 0.7 : 1,
                        }}
                      >
                        {pdfLoading === inv.id ? (
                          <>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Memuat...
                          </>
                        ) : (
                          <>
                            <Download size={14} /> Download PDF
                          </>
                        )}
                      </button>
                      
                      {/* View Payment Proof */}
                      {inv.paymentProofUrl && (
                        <button
                          onClick={() => openProofModal(inv.paymentProofUrl!, inv.paymentProofFileName || 'Bukti Pembayaran')}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', fontSize: 12, fontWeight: 500,
                            background: 'var(--surface-ground)', color: 'var(--text-primary)',
                            border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer'
                          }}
                          aria-label="Lihat bukti pembayaran"
                        >
                          <ImageIcon size={14} aria-hidden="true" /> Lihat Bukti Bayar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, paddingTop: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ 
                  padding: '6px 12px', border: '1px solid var(--surface-border)', 
                  borderRadius: 'var(--radius-md)', background: 'none', cursor: 'pointer', 
                  color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                  opacity: page === 1 ? 0.5 : 1
                }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ 
                  padding: '6px 12px', border: '1px solid var(--surface-border)', 
                  borderRadius: 'var(--radius-md)', background: 'none', cursor: 'pointer', 
                  color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                  opacity: page === totalPages ? 0.5 : 1
                }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payment Proof Modal */}
      {proofModal && (
        <div 
          onClick={closeProofModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)',
              maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', borderBottom: '1px solid var(--surface-border)'
            }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Bukti Pembayaran
              </h3>
              <button onClick={closeProofModal} style={{ 
                background: 'none', border: 'none', cursor: 'pointer', padding: 4 
              }}>
                <X size={18} color="var(--text-muted)" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{ padding: 16, textAlign: 'center' }}>
              {proofLoading ? (
                <div style={{ padding: 48 }}>
                  <RefreshCw size={32} color="var(--color-primary-400)" style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 13 }}>Memuat gambar...</p>
                </div>
              ) : proofError ? (
                <div style={{ padding: 48 }}>
                  <ImageOff size={48} color="var(--text-muted)" />
                  <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>Gagal memuat gambar</p>
                  <button
                    onClick={() => loadProofImage(proofModal.url)}
                    style={{
                      marginTop: 12, padding: '8px 16px', fontSize: 12,
                      background: 'var(--color-primary-500)', color: '#fff',
                      border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer'
                    }}
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : proofImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={proofImageUrl} 
                  alt={proofModal.fileName}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
                />
              ) : null}
              <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>{proofModal.fileName}</p>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
