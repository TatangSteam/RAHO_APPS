'use client'
import { assertCaughtError } from '@/lib/caughtError';
import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { User, Phone, Mail, Building2, Camera, Loader2, Check, Shield, Briefcase, Calendar } from 'lucide-react'
import Image from 'next/image'
import { compressImageWithPreset, formatFileSize, isImageFile } from '@/lib/imageCompressor'
import { devLog, devError } from '@/lib/logger'

interface StaffProfile {
  id: string
  email: string
  role: string
  staffCode: string | null
  branchId: string | null
  isActive: boolean
  lastLoginAt: string | null
  profile: {
    fullName: string | null
    phone: string | null
    avatarUrl: string | null
  } | null
  branch: {
    id: string
    branchCode: string
    name: string
  } | null
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_MANAGER: 'Admin Manager',
  ADMIN_CABANG: 'Admin Cabang',
  ADMIN_LAYANAN: 'Admin Layanan',
  DOCTOR: 'Dokter',
  NURSE: 'Perawat',
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  SUPER_ADMIN: { bg: 'bg-red-500/15', text: 'text-red-400' },
  ADMIN_MANAGER: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  ADMIN_CABANG: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  ADMIN_LAYANAN: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  DOCTOR: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  NURSE: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
}

export default function StaffProfilePage() {
  const { updateUserAvatar } = useAuthStore()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me')
      setProfile(res.data.data)
    } catch (error) {
      assertCaughtError(error);
      devError('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

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
          devLog(`[Profile] Avatar compressed: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)}`)
        } catch (error) {
      assertCaughtError(error);
          devError('Error compressing avatar:', error)
          // Continue with original file
        } finally {
          setCompressing(false)
        }
      }

      setUploading(true)
      const formData = new FormData()
      formData.append('avatar', fileToUpload)
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const newAvatarUrl = res.data.data.avatarUrl
      setProfile(prev => prev ? { 
        ...prev, 
        profile: { 
          ...prev.profile, 
          fullName: prev.profile?.fullName ?? null,
          phone: prev.profile?.phone ?? null,
          avatarUrl: newAvatarUrl 
        } 
      } : null)
      // Update the auth store so Header and Sidebar show the new avatar
      updateUserAvatar(newAvatarUrl)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 2000)
    } catch (error) {
      assertCaughtError(error);
      devError('Error uploading avatar:', error)
      alert('Gagal mengupload foto profil')
    } finally {
      setUploading(false)
    }
  }, [updateUserAvatar])

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

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

  const roleColor = ROLE_COLORS[profile.role] || { bg: 'bg-neutral-500/15', text: 'text-neutral-400' }
  
  // Extract nested values for easier access
  const fullName = profile.profile?.fullName
  const phone = profile.profile?.phone
  const avatarUrl = profile.profile?.avatarUrl
  const branchName = profile.branch?.name
  const branchCode = profile.branch?.branchCode

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
              Informasi akun dan data staff Anda
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
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
                  {avatarUrl ? (
                    <Image
                      key={avatarUrl}
                      src={avatarUrl}
                      alt={fullName || 'Avatar'}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-3xl font-bold">
                      {fullName?.[0]?.toUpperCase() ?? 'S'}
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
                  {fullName || 'Staff'}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">{profile.email}</p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${roleColor.bg} ${roleColor.text}`}>
                    <Shield size={12} />
                    {ROLE_LABELS[profile.role] || profile.role}
                  </span>
                  {branchName && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 flex items-center gap-1.5">
                      <Building2 size={12} />
                      {branchName}
                    </span>
                  )}
                  {profile.staffCode && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-neutral-500/15 text-neutral-400 flex items-center gap-1.5">
                      #{profile.staffCode}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Data Akun */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <User size={16} className="text-amber-500" />
              Data Akun
            </h3>
            <div className="space-y-4">
              <InfoRow icon={<User size={14} />} label="Nama Lengkap" value={fullName} />
              <InfoRow icon={<Mail size={14} />} label="Email" value={profile.email} />
              <InfoRow icon={<Phone size={14} />} label="No. Telepon" value={phone} />
            </div>
          </div>

          {/* Data Pekerjaan */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <Briefcase size={16} className="text-amber-500" />
              Data Pekerjaan
            </h3>
            <div className="space-y-4">
              <InfoRow icon={<Shield size={14} />} label="Role" value={ROLE_LABELS[profile.role] || profile.role} />
              <InfoRow icon={<Building2 size={14} />} label="Cabang" value={branchName || 'Semua Cabang'} />
              {branchCode && (
                <InfoRow icon={<Building2 size={14} />} label="Kode Cabang" value={branchCode} />
              )}
              <InfoRow icon={<Calendar size={14} />} label="Login Terakhir" value={formatDate(profile.lastLoginAt)} />
            </div>
          </div>
        </div>
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
