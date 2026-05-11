'use client'
import { useEffect, useState } from 'react'
import { meApi, MemberSession } from '@/lib/api/meApi'
import { Syringe, ChevronLeft, ChevronRight, CheckCircle, Clock } from 'lucide-react'

export default function MemberSessionsPage() {
  const [sessions, setSessions] = useState<MemberSession[]>([])
  const [loading, setLoading]   = useState(true)
  const [page, setPage]         = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  useEffect(() => {
    loadSessions()
  }, [page])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const { data, meta } = await meApi.getSessions(page, limit)
      setSessions(data)
      setTotalPages(meta.totalPages)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Syringe size={24} color="var(--color-primary-400)" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Riwayat Sesi Terapi
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
          Semua sesi terapi yang telah Anda jalani
        </p>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <p>Memuat data sesi...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>💉</div>
            <p style={{ fontWeight: 600, fontSize: 16 }}>Belum ada sesi terapi</p>
            <p style={{ fontSize: 14 }}>Riwayat sesi terapi Anda akan muncul di sini</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.1)' }}>
                {['Kode Sesi', 'Tanggal', 'Infus Ke', 'Jenis', 'Paket', 'Cabang', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.id} style={{
                  borderBottom: '1px solid var(--surface-border)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                }}>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-primary-400)' }}>
                      {s.sessionCode}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                    {formatDate(s.treatmentDate)}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-primary)', textAlign: 'center' }}>
                    #{s.infusKe}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                      background: s.pelaksanaan === 'ONSITE' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)',
                      color: s.pelaksanaan === 'ONSITE' ? '#60a5fa' : '#a78bfa',
                    }}>
                      {s.pelaksanaan}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                      background: s.packageType === 'BASIC' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: s.packageType === 'BASIC' ? '#34d399' : '#fbbf24',
                    }}>
                      {s.packageType}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {s.branchName}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {s.isCompleted ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399', fontSize: 13 }}>
                        <CheckCircle size={14} /> Selesai
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fbbf24', fontSize: 13 }}>
                        <Clock size={14} /> Berlangsung
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '16px', borderTop: '1px solid var(--surface-border)',
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '6px 12px', border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md)', background: 'none',
                color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page === 1 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '6px 12px', border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md)', background: 'none',
                color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page === totalPages ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}