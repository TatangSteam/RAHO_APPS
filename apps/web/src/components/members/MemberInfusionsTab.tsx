'use client';

import { useState, useEffect } from 'react';
import { infusionApi, InfusionExecution } from '@/lib/infusionApi';
import { showToast } from '@/lib/toast';
import { useRouter } from 'next/navigation';

interface MemberInfusionsTabProps {
  memberId: string;
}

export default function MemberInfusionsTab({ memberId }: MemberInfusionsTabProps) {
  const router = useRouter();
  const [infusions, setInfusions] = useState<InfusionExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInfusions();
  }, [memberId]);

  const loadInfusions = async () => {
    try {
      setLoading(true);
      const data = await infusionApi.getMemberInfusions(memberId);
      setInfusions(data);
    } catch (error: any) {
      showToast.error(error.response?.data?.error?.message || 'Gagal memuat infus aktual');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '64px 24px',
        background: 'rgba(148,163,184,0.05)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div className="spinner" style={{ 
          width: '48px', 
          height: '48px', 
          margin: '0 auto 16px',
          border: '4px solid rgba(59,130,246,0.2)',
          borderTopColor: 'var(--color-primary-500)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Memuat infus aktual...
        </p>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>💧 Infus Aktual</h3>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Total: <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{infusions.length}</span> infus
        </div>
      </div>

      {infusions.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '64px 24px',
          background: 'rgba(148,163,184,0.05)',
          borderRadius: 'var(--radius-lg)',
          border: '2px dashed rgba(148,163,184,0.2)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>💧</div>
          <p style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#e2e8f0', 
            marginBottom: '8px' 
          }}>
            Belum ada infus aktual
          </p>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Infus aktual akan muncul setelah sesi terapi dilakukan
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {infusions.map((infusion) => (
            <div 
              key={infusion.id} 
              className="card" 
              style={{ 
                padding: '24px',
                background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
                border: '2px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-lg)',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onClick={() => router.push(`/sessions/${infusion.treatmentSessionId}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,130,246,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: '16px' 
              }}>
                <div>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '18px', 
                    fontWeight: '700',
                    fontFamily: 'monospace',
                    color: 'var(--text-primary)'
                  }}>
                    🩺 {infusion.sessionCode}
                  </h4>
                  <span 
                    className="badge badge-blue"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                  >
                    💧 Infus Aktual
                  </span>
                </div>
                <div style={{ 
                  textAlign: 'right',
                  fontSize: '13px',
                  color: '#cbd5e1'
                }}>
                  <div style={{ fontWeight: '600' }}>
                    📅 {new Date(infusion.treatmentDate!).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#94a3b8' }}>
                    {new Date(infusion.treatmentDate!).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              {infusion.deviationNotes && (
                <div style={{ 
                  marginBottom: '16px', 
                  padding: '12px 16px',
                  background: 'rgba(251,191,36,0.15)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '4px solid #fbbf24'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    color: '#fbbf24', 
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    ⚠️ Catatan Deviasi
                  </div>
                  <div style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: '1.5' }}>
                    {infusion.deviationNotes}
                  </div>
                </div>
              )}

              <div style={{ 
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'rgba(59,130,246,0.08)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(59,130,246,0.2)'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: 'var(--color-primary-500)', 
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  💉 Dosis Aktual
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                  gap: '10px' 
                }}>
                  {infusion.ifa250 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>IFA + NO 2,5ml</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.ifa250} Botol
                      </span>
                    </div>
                  )}
                  {infusion.ifa500 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>IFA 500ml</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.ifa500} Botol
                      </span>
                    </div>
                  )}
                  {infusion.hho && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>HHO</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.hho} ml
                      </span>
                    </div>
                  )}
                  {infusion.hhoKonsentrat && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>HHO Konsentrat</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.hhoKonsentrat} ml
                      </span>
                    </div>
                  )}
                  {infusion.h2 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>H2</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.h2} ml
                      </span>
                    </div>
                  )}
                  {infusion.no && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>NO</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.no} ml
                      </span>
                    </div>
                  )}
                  {infusion.gaso && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>GASO</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.gaso} ml
                      </span>
                    </div>
                  )}
                  {infusion.o2 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>O2</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.o2} ml
                      </span>
                    </div>
                  )}
                  {infusion.o3 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>O3</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.o3} ml
                      </span>
                    </div>
                  )}
                  {infusion.edta && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>EDTA</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.edta} ml
                      </span>
                    </div>
                  )}
                  {infusion.mb && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>MB</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.mb} ml
                      </span>
                    </div>
                  )}
                  {infusion.h2s && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>H2S</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.h2s} ml
                      </span>
                    </div>
                  )}
                  {infusion.kcl && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>KCL</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.kcl} ml
                      </span>
                    </div>
                  )}
                  {infusion.jmlNb && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(148,163,184,0.2)'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1' }}>JML NB</span>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa' }}>
                        {infusion.jmlNb} ml
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              {(infusion.bottleType || infusion.jenisCairan || infusion.volumeCarrier || infusion.jumlahJarum || infusion.tanggalProduksi) && (
                <div style={{ 
                  padding: '12px 16px',
                  background: 'rgba(148,163,184,0.08)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(148,163,184,0.2)'
                }}>
                  <div style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    color: 'var(--text-muted)', 
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    📋 Informasi Tambahan
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                    {infusion.bottleType && (
                      <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                        <span style={{ color: '#94a3b8' }}>Jenis Botol:</span> <span style={{ fontWeight: '600' }}>{infusion.bottleType}</span>
                      </div>
                    )}
                    {infusion.jenisCairan && (
                      <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                        <span style={{ color: '#94a3b8' }}>Jenis Cairan:</span> <span style={{ fontWeight: '600' }}>{infusion.jenisCairan}</span>
                      </div>
                    )}
                    {infusion.volumeCarrier && (
                      <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                        <span style={{ color: '#94a3b8' }}>Volume Carrier:</span> <span style={{ fontWeight: '600' }}>{infusion.volumeCarrier} ml</span>
                      </div>
                    )}
                    {infusion.jumlahJarum && (
                      <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                        <span style={{ color: '#94a3b8' }}>Jumlah Jarum:</span> <span style={{ fontWeight: '600' }}>{infusion.jumlahJarum}</span>
                      </div>
                    )}
                    {infusion.tanggalProduksi && (
                      <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                        <span style={{ color: '#94a3b8' }}>Tanggal Produksi:</span> <span style={{ fontWeight: '600' }}>
                          {new Date(infusion.tanggalProduksi).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ 
                marginTop: '12px',
                padding: '8px 12px',
                background: 'rgba(59,130,246,0.1)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: '#60a5fa',
                textAlign: 'center',
                fontWeight: '600'
              }}>
                👆 Klik untuk melihat detail sesi
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
