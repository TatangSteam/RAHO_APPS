'use client'
import { useEffect, useState } from 'react'
import { meApi, MemberInvoice } from '@/lib/api/meApi'
import { FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PAID:           { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Lunas' },
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

  useEffect(() => { loadInvoices() }, [page])

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
                {/* Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : inv.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-primary-400)', marginBottom: 2 }}>
                        {inv.invoiceNumber}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {formatDate(inv.createdAt)} · {inv.branchName}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 99, background: st.bg, color: st.color,
                    }}>{st.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Rp {inv.totalAmount.toLocaleString('id-ID')}
                    </span>
                    {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Detail Items */}
                {isOpen && (
                  <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--surface-border)' }}>
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
                            {item.quantity}x Rp {item.pricePerUnit.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          Rp {item.totalAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                    {inv.paidAt && (
                      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                        Dibayar: {formatDate(inv.paidAt)}
                        {inv.paymentMethod && <> · Metode: <strong>{inv.paymentMethod}</strong></>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, paddingTop: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 12px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'center' }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 12px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', background: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}