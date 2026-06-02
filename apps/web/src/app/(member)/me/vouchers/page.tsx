'use client'
import { useEffect, useState } from 'react'
import { meApi, MemberPackage } from '@/lib/api/meApi'
import { Package, Ticket } from 'lucide-react'
import UploadPaymentProofModal from '@/components/members/UploadPaymentProofModal'
import { showToast } from '@/lib/toast'

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:                { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Aktif' },
  PENDINGPAYMENT:        { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: 'Menunggu Pembayaran' },
  WAITING_VERIFICATION:  { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', label: 'Menunggu Verifikasi' },
  EXPIRED:               { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', label: 'Expired' },
  CANCELLED:             { bg: 'rgba(239,68,68,0.15)',  color: '#f87171', label: 'Dibatalkan' },
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export default function MemberVouchersPage() {
  const [packages, setPackages] = useState<MemberPackage[]>([])
  const [loading, setLoading]   = useState(true)
  const [uploadModal, setUploadModal] = useState<{ show: boolean; pkg: MemberPackage | null }>({ show: false, pkg: null })
  const [uploading, setUploading] = useState(false)

  const fetchPackages = () => {
    setLoading(true)
    meApi.getVouchers()
      .then(setPackages)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPackages()
  }, [])

  const handleUploadPaymentProof = async (file: File) => {
    if (!uploadModal.pkg) return
    
    setUploading(true)
    try {
      await meApi.uploadPaymentProof(uploadModal.pkg.id, file)
      showToast.success('Bukti pembayaran berhasil diupload. Menunggu verifikasi admin.')
      setUploadModal({ show: false, pkg: null })
      fetchPackages() // Refresh package list
    } catch (error: any) {
      showToast.error(error.response?.data?.message || 'Gagal mengupload bukti pembayaran')
    } finally {
      setUploading(false)
    }
  }

  const active  = packages.filter(p => p.status === 'ACTIVE')
  const others  = packages.filter(p => p.status !== 'ACTIVE')

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Package size={24} color="var(--color-primary-400)" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Paket & Voucher
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
          Daftar paket terapi yang Anda miliki
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>Memuat paket...</div>
      ) : packages.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48,
          background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
          <p style={{ fontWeight: 600, fontSize: 16 }}>Belum ada paket</p>
          <p style={{ fontSize: 14 }}>Hubungi klinik untuk mendapatkan paket terapi</p>
        </div>
      ) : (
        <div>
          {/* Paket Aktif */}
          {active.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
                🟢 Paket Aktif ({active.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {active.map(pkg => <PackageCard key={pkg.id} pkg={pkg} onUploadProof={setUploadModal} />)}
              </div>
            </div>
          )}

          {/* Paket Lainnya */}
          {others.length > 0 && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Riwayat Paket ({others.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {others.map(pkg => <PackageCard key={pkg.id} pkg={pkg} onUploadProof={setUploadModal} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Payment Proof Modal */}
      <UploadPaymentProofModal
        show={uploadModal.show}
        packageCode={uploadModal.pkg?.packageCode || ''}
        finalPrice={uploadModal.pkg?.finalPrice || 0}
        submitting={uploading}
        onClose={() => setUploadModal({ show: false, pkg: null })}
        onSubmit={handleUploadPaymentProof}
      />
    </div>
  )
}

function PackageCard({ pkg, onUploadProof }: { pkg: MemberPackage; onUploadProof: (modal: { show: boolean; pkg: MemberPackage }) => void }) {
  const st = STATUS_STYLE[pkg.status] ?? STATUS_STYLE.EXPIRED
  const progressPct = pkg.totalSessions > 0
    ? Math.round((pkg.usedSessions / pkg.totalSessions) * 100)
    : 0

  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-lg)', padding: 20,
      borderTop: `3px solid ${st.color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
            {pkg.packageCode}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {pkg.packageType === 'BASIC' ? '💧 Nano Bubble' : `⚡ Booster`}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px',
          borderRadius: 99, background: st.bg, color: st.color,
        }}>
          {st.label}
        </span>
      </div>

      {/* Progress Sesi */}
      {pkg.status === 'ACTIVE' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sesi Terpakai</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {pkg.usedSessions} / {pkg.totalSessions}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`, height: '100%', borderRadius: 99,
              background: `linear-gradient(90deg, var(--color-primary-500), var(--color-primary-400))`,
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ticket size={14} color="#34d399" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>
              {pkg.sisaSessions} sesi tersisa
            </span>
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pkg.branchName}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {pkg.finalPrice > 0 ? `Rp ${pkg.finalPrice.toLocaleString('id-ID')}` : '—'}
          </span>
        </div>

        {/* Upload Payment Proof Button */}
        {pkg.status === 'PENDINGPAYMENT' && (
          <button
            onClick={() => onUploadProof({ show: true, pkg })}
            style={{
              width: '100%',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400))',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            📤 Upload Bukti Pembayaran
          </button>
        )}

        {/* Waiting Verification Badge */}
        {pkg.status === 'WAITING_VERIFICATION' && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            fontSize: 12,
            color: '#60a5fa',
            fontWeight: 600,
          }}>
            ⏳ Menunggu verifikasi admin...
          </div>
        )}

        {/* View Payment Proof */}
        {pkg.paymentProofUrl && pkg.status === 'WAITING_VERIFICATION' && (
          <button
            onClick={() => window.open(pkg.paymentProofUrl!, '_blank')}
            style={{
              width: '100%',
              padding: '6px 12px',
              marginTop: 8,
              background: 'transparent',
              color: 'var(--color-primary-400)',
              border: '1px solid var(--color-primary-400)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--color-primary-400)'
              e.currentTarget.style.color = 'white'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--color-primary-400)'
            }}
          >
            👁️ Lihat Bukti Pembayaran
          </button>
        )}
      </div>
    </div>
  )
}