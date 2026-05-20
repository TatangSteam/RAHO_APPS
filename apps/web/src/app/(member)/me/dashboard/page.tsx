'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, Package, Calendar } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { getMemberDashboardApi } from '@/lib/memberApi';
import { getApiErrorMessage } from '@/lib/api';
import type { MemberDashboardData } from '@/lib/memberApi';

export default function MemberDashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MemberDashboardData | null>(null);

  useEffect(() => {
    if (!user) {
      return; // Let layout handle redirect
    }

    async function fetchDashboard() {
      setLoading(true);
      setError(null);

      try {
        const result = await getMemberDashboardApi();
        setData(result);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [user]);

  if (!user) return null;

  // Loading state
  if (loading) {
    return (
      <div className="fade-in">
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Halo 👋</h1>
        <div className="skeleton" style={{ width: 200, height: 16, borderRadius: 4, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 60, height: 32, borderRadius: 6, marginTop: 12 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fade-in">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Welcome Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(59,130,246,0.05))',
        border: '1px solid rgba(59,130,246,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: 32,
      }}>
        <h1 style={{ 
          fontSize: 28, 
          fontWeight: 700, 
          marginBottom: 8,
          background: 'linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Halo, {user.fullName.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Selamat datang kembali di Portal Member Raho ERP
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: 20, 
        marginBottom: 32 
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.05))',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            background: 'rgba(34,197,94,0.1)',
            borderRadius: '50%',
            filter: 'blur(40px)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 10,
              marginBottom: 12,
            }}>
              <div style={{
                width: 40,
                height: 40,
                background: 'rgba(34,197,94,0.2)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e',
              }}>
                <Ticket size={20} />
              </div>
              <span style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Voucher Sisa
              </span>
            </div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700, 
              color: '#22c55e',
              lineHeight: 1,
            }}>
              {data?.voucherSisa ?? 0}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Voucher yang dapat digunakan
            </p>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.05))',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            background: 'rgba(59,130,246,0.1)',
            borderRadius: '50%',
            filter: 'blur(40px)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 10,
              marginBottom: 12,
            }}>
              <div style={{
                width: 40,
                height: 40,
                background: 'rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}>
                <Package size={20} />
              </div>
              <span style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Paket Aktif
              </span>
            </div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700, 
              color: '#3b82f6',
              lineHeight: 1,
            }}>
              {data?.paketAktif ?? 0}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Paket terapi yang sedang berjalan
            </p>
          </div>
        </div>
      </div>

      {/* Sesi Terakhir */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ 
          fontSize: 17, 
          fontWeight: 700, 
          marginBottom: 16, 
          color: 'var(--text-primary)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10,
        }}>
          <div style={{
            width: 36,
            height: 36,
            background: 'rgba(168,85,247,0.15)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a855f7',
          }}>
            <Calendar size={18} />
          </div>
          Sesi Terapi Terakhir
        </h3>
        {data?.sesiTerakhir ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid var(--surface-border)',
            borderRadius: 'var(--radius-md)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
            e.currentTarget.style.borderColor = 'rgba(148,163,184,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
            e.currentTarget.style.borderColor = 'var(--surface-border)';
          }}
          >
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {data.sesiTerakhir.sessionCode}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                <span style={{ 
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  Infus ke-{data.sesiTerakhir.infusKe}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <span className="badge" style={{
                  background: data.sesiTerakhir.pelaksanaan === 'ON_SITE' 
                    ? 'rgba(34,197,94,0.15)' 
                    : 'rgba(59,130,246,0.15)',
                  color: data.sesiTerakhir.pelaksanaan === 'ON_SITE' 
                    ? '#22c55e' 
                    : '#3b82f6',
                  border: `1px solid ${data.sesiTerakhir.pelaksanaan === 'ON_SITE' 
                    ? 'rgba(34,197,94,0.3)' 
                    : 'rgba(59,130,246,0.3)'}`,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {data.sesiTerakhir.pelaksanaan === 'ON_SITE' ? 'Di Klinik' : 'Home Care'}
                </span>
              </div>
            </div>
            <div style={{
              textAlign: 'right',
              padding: '8px 16px',
              background: 'rgba(148,163,184,0.1)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                Tanggal
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {new Date(data.sesiTerakhir.treatmentDate).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: 40,
            background: 'rgba(30, 41, 59, 0.3)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--surface-border)',
          }}>
            <Calendar size={40} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Belum ada sesi terapi yang tercatat
            </p>
          </div>
        )}
      </div>
    </div>
  );
}