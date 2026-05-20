'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { useEffect } from 'react'
import {
  LayoutDashboard, Syringe, Package,
  FileText, LogOut,
} from 'lucide-react'
import { logoutApi } from '@/lib/authApi'
import { Footer } from '@/components/layout/Footer'

const NAV_ITEMS = [
  { href: '/me/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/me/sessions',  label: 'Sesi Terapi',   icon: Syringe },
  { href: '/me/vouchers',  label: 'Paket & Voucher', icon: Package },
  { href: '/me/invoices',  label: 'Invoice',        icon: FileText },
]

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { user, refreshToken, clearAuth } = useAuthStore()

  useEffect(() => {
    if (!user) {
      router.replace('/login')
    }
  }, [user, router])

  const handleLogout = async () => {
    try {
      // Call backend logout API to create audit log
      if (refreshToken) {
        await logoutApi(refreshToken)
      }
    } catch (error) {
      console.error('Logout API error:', error)
      // Continue with logout even if API fails
    } finally {
      // Clear local auth state
      clearAuth()
      
      // Clear auth cookie
      document.cookie = 'raho-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      
      sessionStorage.setItem('logoutMessage', 'Anda telah berhasil logout.')
      
      // Force redirect with window.location for immediate effect
      window.location.href = '/login'
    }
  }

  // Don't render layout if user is not authenticated
  if (!user) {
    return null
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--surface-bg)' }}>
      {/* Navbar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--surface-border)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 24px',
          height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 24,
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800))',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, color: '#fff', fontSize: 14,
            }}>R</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Raho ERP
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>
                Portal Member
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: active ? 'rgba(59,130,246,0.12)' : 'none',
                    color: active ? 'var(--color-primary-400)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 500,
                    fontSize: 13,
                    border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'none'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                    }
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* User + Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Avatar + Name */}
              <button
                onClick={() => router.push('/me/profile')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: 'var(--radius-md)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'none'
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #334155, #1e293b)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, color: '#fff', fontSize: 13, flexShrink: 0,
                }}>
                  {user?.fullName?.[0]?.toUpperCase() ?? 'M'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {user?.fullName ?? 'Member'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>
                    Member
                  </span>
                </div>
              </button>

            {/* Divider */}
            <div style={{ width: 1, height: 24, background: 'var(--surface-border)' }} />

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'none',
                border: '1px solid transparent',
                color: '#f87171',
                fontSize: 13, fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.1)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(248,113,113,0.2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'none'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
              }}
            >
              <LogOut size={14} />
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}