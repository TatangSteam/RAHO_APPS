'use client'
import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { meApi, MemberSession } from '@/lib/api/meApi'
import { Syringe, ChevronLeft, ChevronRight, CheckCircle, Clock, Eye, MapPin, Package, Calendar } from 'lucide-react'
import { devError } from '@/lib/logger'

export default function MemberSessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<MemberSession[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      const { data, meta } = await meApi.getSessions(page, limit)
      setSessions(data)
      setTotalPages(meta.totalPages)
    } catch (e) {
      assertCaughtError(e);
      devError(e)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

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

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
          <div style={{ 
            width: 32, height: 32, border: '3px solid var(--color-primary-400)', 
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 12px'
          }} />
          Memuat data sesi...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48,
          background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>💉</div>
          <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>Belum ada sesi terapi</p>
          <p style={{ fontSize: 14 }}>Riwayat sesi terapi Anda akan muncul di sini</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onView={() => router.push(`/me/sessions/${s.id}`)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--surface-border)'
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', fontSize: 13, fontWeight: 500,
              background: page === 1 ? 'var(--surface-ground)' : 'var(--surface-card)',
              color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)',
              cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1
            }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', fontSize: 13, fontWeight: 500,
              background: page === totalPages ? 'var(--surface-ground)' : 'var(--surface-card)',
              color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)',
              cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}


// ── Session Card Component ─────────────────────────────────────

function SessionCard({ session: s, onView }: { session: MemberSession; onView: () => void }) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })

  const statusStyle = s.isCompleted
    ? { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Selesai' }
    : { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Berlangsung' }

  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-lg)', padding: 20,
      borderTop: `3px solid ${statusStyle.color}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
            {s.sessionCode}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            💧 Sesi Terapi #{s.infusKe}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px',
          borderRadius: 99, background: statusStyle.bg, color: statusStyle.color,
          display: 'inline-flex', alignItems: 'center', gap: 4
        }}>
          {s.isCompleted ? <CheckCircle size={12} /> : <Clock size={12} />}
          {statusStyle.label}
        </span>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ 
          background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)', padding: 10 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Calendar size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tanggal</span>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            {formatDate(s.treatmentDate)}
          </p>
        </div>
        <div style={{ 
          background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)', padding: 10 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <MapPin size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cabang</span>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            {s.branchName}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
          background: s.pelaksanaan === 'ONSITE' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)',
          color: s.pelaksanaan === 'ONSITE' ? '#60a5fa' : '#a78bfa'
        }}>
          {s.pelaksanaan}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
          background: s.packageType === 'BASIC' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
          color: s.packageType === 'BASIC' ? '#34d399' : '#fbbf24',
          display: 'inline-flex', alignItems: 'center', gap: 4
        }}>
          <Package size={10} /> {s.packageType}
        </span>
      </div>

      {/* Footer */}
      <div style={{ 
        borderTop: '1px solid var(--surface-border)', paddingTop: 12, 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {s.packageCode}
        </span>
        <button
          onClick={onView}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            background: 'var(--color-primary-500)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer'
          }}
        >
          <Eye size={14} /> Lihat Detail
        </button>
      </div>
    </div>
  )
}
