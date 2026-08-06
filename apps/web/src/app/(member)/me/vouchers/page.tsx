'use client'
import { assertCaughtError } from '@/lib/caughtError';
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
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.message || 'Gagal mengupload bukti pembayaran')
    } finally {
      setUploading(false)
    }
  }

  const active  = packages.filter(p => p.status === 'ACTIVE')
  const others  = packages.filter(p => p.status !== 'ACTIVE')

  return (
    <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <Package size={20} className="sm:w-6 sm:h-6 text-amber-400 flex-shrink-0" />
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-neutral-900 dark:text-white">
            Paket & Voucher
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
          Daftar paket terapi yang Anda miliki
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-neutral-600 dark:text-neutral-400 text-sm">
          Memuat paket...
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg sm:rounded-xl px-4">
          <div className="text-4xl sm:text-5xl mb-2">📦</div>
          <p className="font-semibold text-sm sm:text-base mb-1 text-neutral-900 dark:text-white">Belum ada paket</p>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
            Hubungi klinik untuk mendapatkan paket terapi
          </p>
        </div>
      ) : (
        <div>
          {/* Paket Aktif */}
          {active.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <h2 className="text-sm sm:text-base md:text-lg font-semibold text-neutral-900 dark:text-white mb-3 sm:mb-4">
                🟢 Paket Aktif ({active.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {active.map(pkg => <PackageCard key={pkg.id} pkg={pkg} onUploadProof={setUploadModal} />)}
              </div>
            </div>
          )}

          {/* Paket Lainnya */}
          {others.length > 0 && (
            <div>
              <h2 className="text-sm sm:text-base md:text-lg font-semibold text-neutral-600 dark:text-neutral-400 mb-3 sm:mb-4">
                Riwayat Paket ({others.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
    <div 
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5"
      style={{ borderTop: `3px solid ${st.color}` }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mb-1">
            {pkg.packageCode}
          </div>
          <div className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
            {pkg.packageType === 'BASIC' ? '💧 Nano Bubble' : `⚡ Booster`}
          </div>
        </div>
        <span 
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
      </div>

      {/* Progress Sesi */}
      {pkg.status === 'ACTIVE' && (
        <div className="mb-3">
          <div className="flex justify-between mb-1.5">
            <span className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">Sesi Terpakai</span>
            <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white">
              {pkg.usedSessions} / {pkg.totalSessions}
            </span>
          </div>
          <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Ticket size={14} className="text-green-400" />
            <span className="text-xs sm:text-sm font-semibold text-green-400">
              {pkg.sisaSessions} sesi tersisa
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-[60%]">
            {pkg.branchName}
          </span>
          <span className="text-sm font-bold text-neutral-900 dark:text-white">
            {pkg.finalPrice > 0 ? `Rp ${pkg.finalPrice.toLocaleString('id-ID')}` : '—'}
          </span>
        </div>

        {/* Upload Payment Proof Button */}
        {pkg.status === 'PENDINGPAYMENT' && (
          <button
            onClick={() => onUploadProof({ show: true, pkg })}
            className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-white border-none rounded-lg text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all hover:opacity-90"
          >
            📤 Upload Bukti Pembayaran
          </button>
        )}

        {/* Waiting Verification Badge */}
        {pkg.status === 'WAITING_VERIFICATION' && (
          <div className="px-3 py-2 bg-blue-500/15 border border-blue-500/30 rounded-lg text-center text-xs sm:text-sm text-blue-400 font-semibold">
            ⏳ Menunggu verifikasi admin...
          </div>
        )}

        {/* View Payment Proof */}
        {pkg.paymentProofUrl && pkg.status === 'WAITING_VERIFICATION' && (
          <button
            onClick={() => window.open(pkg.paymentProofUrl!, '_blank')}
            className="w-full px-3 py-1.5 mt-2 bg-transparent text-amber-400 border border-amber-400 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-all hover:bg-amber-400 hover:text-white"
          >
            👁️ Lihat Bukti Pembayaran
          </button>
        )}
      </div>
    </div>
  )
}
