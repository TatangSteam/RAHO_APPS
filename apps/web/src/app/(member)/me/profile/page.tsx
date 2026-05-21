'use client'
import { useEffect, useState, useRef } from 'react'
import { meApi, MemberProfile } from '@/lib/api/meApi'
import { useAuthStore } from '@/stores/authStore'
import { User, MapPin, Phone, Mail, Calendar, CreditCard, Building2, Camera, Loader2, Check } from 'lucide-react'
import Image from 'next/image'

export default function MemberProfilePage() {
  const { updateUserAvatar } = useAuthStore()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    meApi.getProfile()
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Hanya file gambar yang diperbolehkan')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB')
      return
    }

    try {
      setUploading(true)
      const result = await meApi.uploadAvatar(file)
      setProfile(prev => prev ? { ...prev, avatarUrl: result.avatarUrl } : null)
      // Update the auth store so Header shows the new avatar
      updateUserAvatar(result.avatarUrl)
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 2000)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Gagal mengupload foto profil')
    } finally {
      setUploading(false)
    }
  }

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
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt={profile.fullName || 'Avatar'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-3xl font-bold">
                    {profile.fullName?.[0]?.toUpperCase() ?? 'M'}
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : uploadSuccess ? (
                    <Check className="h-6 w-6 text-green-400" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center mt-2">
                Klik untuk ubah foto
              </p>
            </div>

            {/* Info */}
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">
                {profile.fullName}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">{profile.email}</p>
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
            <InfoRow icon={<Mail size={14} />} label="Email" value={profile.email} />
            <InfoRow icon={<Calendar size={14} />} label="Tanggal Lahir" value={formatDate(profile.dateOfBirth)} />
            <InfoRow icon={<User size={14} />} label="Jenis Kelamin" value={profile.jenisKelamin === 'L' ? 'Laki-laki' : profile.jenisKelamin === 'P' ? 'Perempuan' : '—'} />
            <InfoRow icon={<CreditCard size={14} />} label="NIK" value={profile.nik ?? '—'} />
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
