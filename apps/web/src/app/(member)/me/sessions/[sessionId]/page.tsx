'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { meApi, MemberSessionDetail } from '@/lib/api/meApi'
import { api } from '@/lib/api'
import {
  ArrowLeft,
  Syringe,
  Calendar,
  MapPin,
  Package,
  CheckCircle,
  Clock,
  User,
  Stethoscope,
  Heart,
  FileText,
  Droplets,
  Camera,
  ClipboardList,
  Activity,
  ImageOff,
  RefreshCw,
} from 'lucide-react'
import { devError } from '@/lib/logger'
import TherapyPlanDoseTable from '@/components/therapy-plan/TherapyPlanDoseTable'

// ── Helper Components ──────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: { 
  icon: React.ElementType; title: string; children: React.ReactNode 
}) {
  return (
    <div style={{
      background: 'var(--surface-card)', border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: 'rgba(245,158,11,0.15)', display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={18} color="var(--color-primary-400)" />
        </div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function VitalItem({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px 0' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
        {value ?? '—'}
      </p>
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>{unit}</p>
    </div>
  )
}

const IFA_LABELS: Record<string, string> = {
  ifa250: 'IFA 250', ifa500: 'IFA 500', hho: 'HHO', h2: 'H₂', no: 'NO',
  gaso: 'GASO', o2: 'O₂', o3: 'O₃', edta: 'EDTA', mb: 'MB',
  h2s: 'H₂S', kcl: 'KCl', jmlNb: 'Jml NB'
}

function IFAGrid({ data, title }: { 
  data: Record<string, any> | null; title: string 
}) {
  if (!data) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data {title.toLowerCase()}</p>
  
  const ifaKeys = Object.keys(IFA_LABELS)
  const hasAnyValue = ifaKeys.some(k => {
    const val = data[k]
    return val != null && val !== 0
  })
  
  if (!hasAnyValue) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data {title.toLowerCase()}</p>
  }
  
  return (
    <div style={{ 
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 
    }}>
      {ifaKeys.map(key => {
        const val = data[key]
        if (val == null || val === 0) return null
        return (
          <div key={key} style={{
            background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)',
            padding: '8px 6px', textAlign: 'center'
          }}>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px 0' }}>
              {IFA_LABELS[key]}
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary-400)', margin: 0 }}>
              {val}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function MemberSessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [detail, setDetail] = useState<MemberSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [photoLoading, setPhotoLoading] = useState<Record<string, boolean>>({})
  const [photoErrors, setPhotoErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadSessionDetail()
  }, [sessionId])

  const loadSessionDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await meApi.getSessionDetail(sessionId)
      setDetail(data)
    } catch (e: any) {
      devError(e)
      setError(e.response?.data?.message || 'Gagal memuat detail sesi')
    } finally {
      setLoading(false)
    }
  }

  // Load photo with authentication
  const loadPhoto = useCallback(async (photoId: string, url: string) => {
    try {
      setPhotoLoading(prev => ({ ...prev, [photoId]: true }))
      setPhotoErrors(prev => ({ ...prev, [photoId]: false }))
      
      // Extract the path from the URL
      let filePath = url
      
      // Handle full URLs
      if (url.startsWith('http')) {
        const urlObj = new URL(url)
        filePath = urlObj.pathname
      }
      
      // Remove various prefixes to get clean path
      filePath = filePath
        .replace(/^\/api\/v1\/files\//, '')
        .replace(/^\/files\//, '')
        .replace(/^api\/v1\/files\//, '')
        .replace(/^files\//, '')
      
      // Fetch with authentication
      const response = await api.get(`/files/${filePath}`, {
        responseType: 'blob',
      })
      
      const blobUrl = URL.createObjectURL(response.data)
      setPhotoUrls(prev => ({ ...prev, [photoId]: blobUrl }))
    } catch (e: any) {
      devError('Failed to load photo:', e)
      setPhotoErrors(prev => ({ ...prev, [photoId]: true }))
    } finally {
      setPhotoLoading(prev => ({ ...prev, [photoId]: false }))
    }
  }, [])

  // Load photo when detail is available
  useEffect(() => {
    if (detail?.photo?.photoUrl) {
      loadPhoto('main', detail.photo.photoUrl)
    }
    return () => {
      // Cleanup blob URLs
      Object.values(photoUrls).forEach(url => URL.revokeObjectURL(url))
    }
  }, [detail?.photo?.photoUrl])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 40, height: 40, border: '4px solid var(--color-primary-400)', 
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 16px'
          }} />
          <p style={{ color: 'var(--text-secondary)' }}>Memuat detail sesi...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Error state
  if (error || !detail) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 64, height: 64, borderRadius: '50%', 
            background: 'rgba(239,68,68,0.15)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Syringe size={32} color="#f87171" />
          </div>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Gagal Memuat Data</p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{error}</p>
          <button
            onClick={() => router.back()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', fontSize: 14, fontWeight: 500,
              color: '#fff', background: 'var(--color-primary-500)',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        </div>
      </div>
    )
  }

  const { session, staff, diagnosis, therapyPlan, vitalSignsBefore, vitalSignsAfter, infusion, materials, photo, evaluation } = detail

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 14, color: 'var(--text-secondary)',
          background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 16, padding: 0
        }}
      >
        <ArrowLeft size={16} /> Kembali ke Riwayat Sesi
      </button>

      {/* Header Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
        borderRadius: 'var(--radius-lg)', padding: 24, color: '#fff', marginBottom: 24
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, opacity: 0.9 }}>
              <Syringe size={18} />
              <span style={{ fontSize: 13 }}>Detail Sesi Terapi</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>{session.sessionCode}</h1>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, opacity: 0.9 }}>
              <Calendar size={16} /> {formatDate(session.treatmentDate)}
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ 
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 500,
              background: 'rgba(255,255,255,0.2)'
            }}>
              <Droplets size={14} /> Infus ke-{session.infusKe}
            </span>
            <span style={{ 
              padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 500,
              background: session.pelaksanaan === 'ONSITE' ? 'rgba(59,130,246,0.3)' : 'rgba(139,92,246,0.3)'
            }}>
              {session.pelaksanaan}
            </span>
            <span style={{ 
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 500,
              background: session.isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'
            }}>
              {session.isCompleted ? <><CheckCircle size={14} /> Selesai</> : <><Clock size={14} /> Berlangsung</>}
            </span>
          </div>
        </div>

        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16,
          marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div>
            <p style={{ fontSize: 11, opacity: 0.8, margin: '0 0 4px 0' }}>Cabang</p>
            <p style={{ margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} /> {session.branchName}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, opacity: 0.8, margin: '0 0 4px 0' }}>Paket</p>
            <p style={{ margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={14} /> {session.packageType}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, opacity: 0.8, margin: '0 0 4px 0' }}>Kode Paket</p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 13 }}>{session.packageCode}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, opacity: 0.8, margin: '0 0 4px 0' }}>Kode Cabang</p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 13 }}>{session.branchCode}</p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        
        {/* Staff Info */}
        <SectionCard icon={User} title="Tim Medis">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Admin Layanan</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {staff.adminLayanan || '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Dokter</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {staff.doctor || '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Perawat</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {staff.nurse || '—'}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* Diagnosis */}
        <SectionCard icon={Stethoscope} title="Diagnosis">
          {diagnosis ? (
            <div>
              <div style={{ 
                display: 'inline-block', padding: '4px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(245,158,11,0.15)', marginBottom: 12
              }}>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-primary-400)' }}>
                  {diagnosis.diagnosisCode}
                </span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                {diagnosis.diagnosa}
              </p>
              {(diagnosis.kategoriDiagnosaList?.length || diagnosis.kategoriDiagnosa) && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Kategori: {(diagnosis.kategoriDiagnosaList?.length
                    ? diagnosis.kategoriDiagnosaList
                    : [diagnosis.kategoriDiagnosa]
                  ).filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data diagnosis</p>
          )}
        </SectionCard>

        {/* Therapy Plan */}
        <SectionCard icon={FileText} title="Rencana Terapi">
          {therapyPlan ? (
            <div>
              <div style={{ 
                display: 'inline-block', padding: '4px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(245,158,11,0.15)', marginBottom: 12
              }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary-400)' }}>
                  Terapi #{therapyPlan.planNumber || '-'}
                </span>
              </div>
              {therapyPlan.keterangan && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                  {therapyPlan.keterangan}
                </p>
              )}
              <TherapyPlanDoseTable plan={therapyPlan} compact />
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada rencana terapi</p>
          )}
        </SectionCard>

        {/* Vital Signs Before */}
        <SectionCard icon={Heart} title="Tanda Vital (Sebelum)">
          {vitalSignsBefore ? (
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 
            }}>
              <VitalItem label="Sistol" value={vitalSignsBefore.sistol} unit="mmHg" />
              <VitalItem label="Diastol" value={vitalSignsBefore.diastol} unit="mmHg" />
              <VitalItem label="HR" value={vitalSignsBefore.hr} unit="bpm" />
              <VitalItem label="SpO₂" value={vitalSignsBefore.saturasi} unit="%" />
              <VitalItem label="PI" value={vitalSignsBefore.pi} unit="%" />
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data vital sebelum</p>
          )}
        </SectionCard>

        {/* Vital Signs After */}
        <SectionCard icon={Activity} title="Tanda Vital (Sesudah)">
          {vitalSignsAfter ? (
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 
            }}>
              <VitalItem label="Sistol" value={vitalSignsAfter.sistol} unit="mmHg" />
              <VitalItem label="Diastol" value={vitalSignsAfter.diastol} unit="mmHg" />
              <VitalItem label="HR" value={vitalSignsAfter.hr} unit="bpm" />
              <VitalItem label="SpO₂" value={vitalSignsAfter.saturasi} unit="%" />
              <VitalItem label="PI" value={vitalSignsAfter.pi} unit="%" />
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data vital sesudah</p>
          )}
        </SectionCard>

        {/* Infusion */}
        <SectionCard icon={Droplets} title="Pelaksanaan Infus">
          {infusion ? (
            <div>
              {/* Infusion Details */}
              <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 
              }}>
                {infusion.bottleType && (
                  <div style={{ 
                    background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)', padding: 10 
                  }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px 0' }}>Tipe Botol</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                      {infusion.bottleType}
                    </p>
                  </div>
                )}
                {infusion.jenisCairan && (
                  <div style={{ 
                    background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)', padding: 10 
                  }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px 0' }}>Jenis Cairan</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                      {infusion.jenisCairan}
                    </p>
                  </div>
                )}
                {infusion.volumeCarrier != null && (
                  <div style={{ 
                    background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)', padding: 10 
                  }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px 0' }}>Volume Carrier</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                      {infusion.volumeCarrier} ml
                    </p>
                  </div>
                )}
                {infusion.jumlahJarum != null && (
                  <div style={{ 
                    background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)', padding: 10 
                  }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px 0' }}>Jumlah Jarum</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                      {infusion.jumlahJarum}
                    </p>
                  </div>
                )}
              </div>
              
              {/* IFA Values */}
              <IFAGrid data={infusion} title="IFA Infus" />
              
              {/* Deviation Notes */}
              {infusion.deviationNotes && (
                <div style={{ 
                  marginTop: 12, padding: 10, borderRadius: 'var(--radius-md)',
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)'
                }}>
                  <p style={{ fontSize: 11, color: 'var(--color-primary-400)', margin: '0 0 4px 0', fontWeight: 500 }}>
                    Catatan Deviasi
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                    {infusion.deviationNotes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada data infus</p>
          )}
        </SectionCard>

        {/* Materials */}
        <SectionCard icon={Package} title="Material Terpakai">
          {materials && materials.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {materials.map((mat, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: 'var(--surface-ground)',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{mat.productName}</span>
                  <span style={{ 
                    fontSize: 13, fontWeight: 600, color: 'var(--color-primary-400)',
                    background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: 99
                  }}>
                    {mat.quantity} {mat.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada material tercatat</p>
          )}
        </SectionCard>

        {/* Photo */}
        <SectionCard icon={Camera} title="Foto Dokumentasi">
          {photo ? (
            <div>
              {photoLoading['main'] ? (
                <div style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 200, background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <RefreshCw size={24} color="var(--color-primary-400)" style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>Memuat foto...</p>
                  </div>
                </div>
              ) : photoErrors['main'] ? (
                <div style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 200, background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)'
                }}>
                  <ImageOff size={32} color="var(--text-muted)" />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Gagal memuat foto</p>
                  <button
                    onClick={() => loadPhoto('main', photo.photoUrl)}
                    style={{
                      marginTop: 8, padding: '6px 12px', fontSize: 12,
                      background: 'var(--color-primary-500)', color: '#fff',
                      border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer'
                    }}
                  >
                    Coba Lagi
                  </button>
                </div>
              ) : photoUrls['main'] ? (
                <img
                  src={photoUrls['main']}
                  alt={photo.fileName}
                  style={{
                    width: '100%', maxHeight: 300, objectFit: 'contain',
                    borderRadius: 'var(--radius-md)', background: 'var(--surface-ground)'
                  }}
                />
              ) : (
                <div style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 200, background: 'var(--surface-ground)', borderRadius: 'var(--radius-md)'
                }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Memuat foto...</p>
                </div>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                {photo.fileName}
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada foto dokumentasi</p>
          )}
        </SectionCard>

        {/* Evaluation (SOAP) */}
        <SectionCard icon={ClipboardList} title="Evaluasi Dokter (SOAP)">
          {evaluation ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ 
                display: 'inline-block', padding: '4px 10px', borderRadius: 'var(--radius-md)',
                background: 'rgba(245,158,11,0.15)', marginBottom: 4, alignSelf: 'flex-start'
              }}>
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-primary-400)' }}>
                  {evaluation.evaluationCode}
                </span>
              </div>
              
              {evaluation.subjective && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary-400)', margin: '0 0 4px 0' }}>
                    S - Subjective
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {evaluation.subjective}
                  </p>
                </div>
              )}
              
              {evaluation.objective && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary-400)', margin: '0 0 4px 0' }}>
                    O - Objective
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {evaluation.objective}
                  </p>
                </div>
              )}
              
              {evaluation.assessment && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary-400)', margin: '0 0 4px 0' }}>
                    A - Assessment
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {evaluation.assessment}
                  </p>
                </div>
              )}
              
              {evaluation.plan && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-primary-400)', margin: '0 0 4px 0' }}>
                    P - Plan
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                    {evaluation.plan}
                  </p>
                </div>
              )}
              
              {evaluation.generalNotes && (
                <div style={{ 
                  marginTop: 8, padding: 10, borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-ground)', borderLeft: '3px solid var(--color-primary-400)'
                }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px 0' }}>Catatan Umum</p>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                    {evaluation.generalNotes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tidak ada evaluasi dokter</p>
          )}
        </SectionCard>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
