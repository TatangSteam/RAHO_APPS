'use client';

import { useAuthStore } from '@/stores/authStore';
import { LogOut } from 'lucide-react';

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      // Get refresh token before clearing auth
      const { refreshToken } = useAuthStore.getState();
      
      // Call logout API to create audit log
      if (refreshToken) {
        const { logoutApi } = await import('@/lib/authApi');
        await logoutApi(refreshToken);
      }
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear local state and redirect
      clearAuth();
      document.cookie = 'raho-auth-token=; path=/; max-age=0';
      window.location.href = '/login';
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--surface-bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--surface-border)',
        padding: '0 24px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        {/* Logo */}
        <div style={{
          width: 40, 
          height: 40,
          background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800))',
          borderRadius: 'var(--radius-md)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontWeight: 800, 
          color: '#fff', 
          fontSize: 18,
          boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
        }}>
          R
        </div>

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            RAHO Klinik
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Portal Member
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User Info */}
        {user && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            padding: '8px 16px',
            background: 'rgba(30,41,59,0.5)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--surface-border)',
          }}>
            <div style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #334155, #1e293b)',
              border: '2px solid var(--surface-border)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.fullName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Member
              </span>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
          }}
        >
          <LogOut size={16} />
          Keluar
        </button>
      </header>

      {/* Main Content */}
      <main style={{ 
        flex: 1, 
        padding: '32px 24px',
        maxWidth: 1400,
        width: '100%',
        margin: '0 auto',
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '20px 24px',
        borderTop: '1px solid var(--surface-border)',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}>
        © 2026 RAHO Klinik. All rights reserved.
      </footer>
    </div>
  );
}
