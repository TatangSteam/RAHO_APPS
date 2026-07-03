'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { meApi, MemberProfile } from '@/lib/api/meApi'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { User, MapPin, Phone, Calendar, CreditCard, Building2, Camera, Loader2, Check } from 'lucide-react'
import { compressImageWithPreset, formatFileSize, isImageFile } from '@/lib/imageCompressor'
import { devLog, devError } from '@/lib/logger'

export default function MemberProfilePage() {
  const { updateUserAvatar } = useAuthStore()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load avatar with authentication
  const loadAvatar = useCallback(async (avatarUrl: string) => {
    try {
      setAvatarLoading(true)
      
      // Extract file path from URL
      let filePath = avatarUrl
      if (avatarUrl.startsWith('http')) {
        const urlObj = new URL(avatarUrl)
        filePath = urlObj.pathname
      }
      // Clean up the path - handle various URL formats
      // Remove leading slash
      filePath = filePath.replace(/^\//, '')
      // Remove api/v1/files/ prefix
      filePath = filePath.replace(/^api\/v1\/files\//, '')
      // Remove files/ prefix
      filePath = filePath.replace(/^files\//, '')
      // If path starts with a bucket name (not 'uploads'), remove it
      // MinIO URLs: /bucket-name/uploads/... -> uploads/...
      if (!filePath.startsWith('uploads/') && !filePath.startsWith('session-photos/')) {
        const parts = filePath.split('/')
        if (parts.length > 1 && (parts[1] === 'uploads' || parts[1] === 'session-photos')) {
          filePath = parts.slice(1).join('/')
        }
      }
      
      const response = await api.get(`/files/${filePath}`, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(response.data)
      setAvatarBlobUrl(blobUrl)
    } catch (error) {
      devError('Failed to load avatar:', error)
      setAvatarBlobUrl(null)
    } finally {
      setAvatarLoading(false)
    }
  }, [])

  useEffect(() => {
    meApi.getProfile()
      .then((data) => {
        setProfile(data)
        if (data.avatarUrl) {
          loadAvatar(data.avatarUrl)
        }
      })
      .finally(() => setLoading(false))
  }, [loadAvatar])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (avatarBlobUrl) {
        URL.revokeObjectURL(avatarBlobUrl)
      }
    }
  }, [avatarBlobUrl])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Hanya file gambar yang diperbolehkan')
      return
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file maksimal 10MB')
      return
    }

    try {
      let fileToUpload = file

      // Compress the image first
      if (isImageFile(file)) {
        setCompressing(true)
        try {
          const result = await compressImageWithPreset(file, 'profilePhoto')
          fileToUpload = result.file
          devLog(`[MemberProfile] Avatar compressed: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)}`)
        } catch (error) {
          devError('Error compressing avatar:', error)
          // Continue with original file
        } finally {
          setCompressing(false)
        }
      }

      setUploading(true)
      const result = await meApi.uploadAvatar(fileToUpload)
      setProfile(prev => prev ? { ...prev, avatarUrl: result.avatarUrl } : null)
      // Update the auth store so Header shows the new avatar
      updateUserAvatar(result.avatarUrl)
      // Load the new avatar
      if (result.avatarUrl) {
        // Revoke old blob URL
        if (avatarBlobUrl) {
          URL.revokeObjectURL(avatarBlobUrl)
        }
        loadAvatar(result.avatarUrl)
      }
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 2000)
    } catch (error) {
      devError('Error uploading avatar:', error)
      alert('Gagal mengupload foto profil')
    } finally {
      setUploading(false)
    }
  }, [updateUserAvatar, loadAvatar, avatarBlobUrl])

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  const calculateAge = (d: string | null) => {
    if (!d) return null
    const birthDate = new Date(d)
    if (isNaN(birthDate.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDelta = today.getMonth() - birthDate.getMonth()

    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1
    }

    return age >= 0 ? age : null
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  )

  if (!profile) return (
    <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
      Gagal memuat profil.
    </div>
  )

  const age = profile.age ?? calculateAge(profile.dateOfBirth)

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Profil Saya</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Informasi akun dan data keanggotaan Anda
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avatar & Info Utama */}
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar with upload */}
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div 
                onClick={handleAvatarClick}
                className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer ring-4 ring-amber-500/20 hover:ring-amber-500/40 transition-all"
              >
                {avatarLoading ? (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                  </div>
                ) : avatarBlobUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarBlobUrl}
                    alt={profile.fullName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-3xl font-bold">
                    {profile.fullName?.[0]?.toUpperCase() ?? 'M'}
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {compressing ? (
                    <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                  ) : uploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : uploadSuccess ? (
                    <Check className="h-6 w-6 text-green-400" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center mt-2">
                {compressing ? 'Mengkompresi...' : 'Klik untuk ubah foto'}
              </p>
            </div>

            {/* Info */}
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                {profile.fullName}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">@{profile.username || profile.email}</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/15 text-blue-400">
                  No. Member: {profile.memberNo}
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                  🎫 {profile.voucherCount} Voucher
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  profile.isActive 
                    ? 'bg-emerald-500/15 text-emerald-400' 
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {profile.isActive ? '✓ Aktif' : '✗ Tidak Aktif'}
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  profile.isDeceased
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-teal-500/15 text-teal-400'
                }`}>
                  {profile.isDeceased ? 'Meninggal' : 'Tidak Meninggal'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Pribadi */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            📋 Data Pribadi
          </h3>
          <div className="space-y-4">
            <InfoRow icon={<User size={14} />} label="Nama Lengkap" value={profile.fullName} />
            <InfoRow icon={<Phone size={14} />} label="No. Telepon" value={profile.phone} />
            <InfoRow icon={<User size={14} />} label="Username Login" value={profile.username || profile.email} />
            <InfoRow icon={<Calendar size={14} />} label="Tanggal Lahir" value={formatDate(profile.dateOfBirth)} />
            <InfoRow icon={<Calendar size={14} />} label="Umur" value={age !== null ? `${age} tahun` : '--'} />
            <InfoRow icon={<User size={14} />} label="Jenis Kelamin" value={profile.jenisKelamin === 'L' ? 'Laki-laki' : profile.jenisKelamin === 'P' ? 'Perempuan' : '—'} />
            <InfoRow icon={<CreditCard size={14} />} label="Identitas" value={profile.nik ?? '—'} />
          </div>
        </div>

        {/* Data Keanggotaan */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            🏥 Data Keanggotaan
          </h3>
          <div className="space-y-4">
            <InfoRow icon={<CreditCard size={14} />} label="No. Member" value={profile.memberNo} />
            <InfoRow icon={<Building2 size={14} />} label="Cabang Daftar" value={profile.registrationBranch?.name} />
            <InfoRow icon={<MapPin size={14} />} label="Kota" value={profile.registrationBranch?.city} />
            <InfoRow icon={<Calendar size={14} />} label="Member Sejak" value={formatDate(profile.memberSince)} />
          </div>
        </div>

        {/* Alamat */}
        {profile.address && (
          <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-3 flex items-center gap-2">
              <MapPin size={14} /> Alamat
            </h3>
            <p className="text-sm text-neutral-900 dark:text-white leading-relaxed">
              {profile.address}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-neutral-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-0.5">{label}</div>
        <div className="text-sm text-neutral-900 dark:text-white">{value ?? '—'}</div>
      </div>
    </div>
  )
}
