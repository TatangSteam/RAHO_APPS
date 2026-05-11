'use client'
import { useEffect, useState } from 'react'
import { meApi, MemberProfile } from '@/lib/api/meApi'
import { User, MapPin, Phone, Mail, Calendar, CreditCard, Building2 } from 'lucide-react'

export default function MemberProfilePage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    meApi.getProfile()
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
      Memuat profil...
    </div>
  )

  if (!profile) return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
      Gagal memuat profil.
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <User size={24} color="var(--color-primary-400)" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Profil Saya</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 14 }}>
          Informasi akun dan data keanggotaan Anda
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Avatar & Info Utama */}
        <div style={{
          background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)', padding: 24, gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', gap: 24,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 28, color: '#fff', flexShrink: 0,
          }}>
            {profile.fullName?.[0]?.toUpperCase() ?? 'M'}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              {profile.fullName}
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{profile.email}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
              }}>
                No. Member: {profile.memberNo}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                background: 'rgba(16,185,129,0.15)', color: '#34d399',
              }}>
                🎫 {profile.voucherCount} Voucher
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                background: profile.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                color: profile.isActive ? '#34d399' : '#f87171',
              }}>
                {profile.isActive ? 'Aktif' : 'Tidak Aktif'}
              </span>
            </div>
          </div>
        </div>

        {/* Data Pribadi */}
        <InfoCard title="📋 Data Pribadi">
          <InfoRow icon={<User size={14} />}         label="Nama Lengkap"   value={profile.fullName} />
          <InfoRow icon={<Phone size={14} />}        label="No. Telepon"    value={profile.phone} />
          <InfoRow icon={<Mail size={14} />}         label="Email"          value={profile.email} />
          <InfoRow icon={<Calendar size={14} />}     label="Tanggal Lahir"  value={formatDate(profile.dateOfBirth)} />
          <InfoRow icon={<User size={14} />}         label="Jenis Kelamin"  value={profile.jenisKelamin === 'L' ? 'Laki-laki' : profile.jenisKelamin === 'P' ? 'Perempuan' : '—'} />
          <InfoRow icon={<CreditCard size={14} />}   label="NIK"            value={profile.nik ?? '—'} />
        </InfoCard>

        {/* Data Keanggotaan */}
        <InfoCard title="🏥 Data Keanggotaan">
          <InfoRow icon={<CreditCard size={14} />}   label="No. Member"     value={profile.memberNo} />
          <InfoRow icon={<Building2 size={14} />}    label="Cabang Daftar"  value={profile.registrationBranch?.name} />
          <InfoRow icon={<MapPin size={14} />}       label="Kota"           value={profile.registrationBranch?.city} />
          <InfoRow icon={<Calendar size={14} />}     label="Member Sejak"   value={formatDate(profile.memberSince)} />
        </InfoCard>

        {/* Alamat */}
        {profile.address && (
          <div style={{
            background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-lg)', padding: 20, gridColumn: '1 / -1',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={14} /> Alamat
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.6 }}>
              {profile.address}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-lg)', padding: 20,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{value ?? '—'}</div>
      </div>
    </div>
  )
}