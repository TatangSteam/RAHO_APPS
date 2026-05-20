'use client';

import { Bell, Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types/auth';

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_MANAGER: 'Admin Manager',
  ADMIN_CABANG: 'Admin Cabang',
  ADMIN_LAYANAN: 'Admin Layanan',
  DOCTOR: 'Dokter',
  NURSE: 'Nakes',
  MEMBER: 'Member',
};

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  unreadCount?: number;
}

export function Header({ onMobileMenuToggle, unreadCount = 0 }: HeaderProps) {
  const { user } = useAuthStore();
  if (!user) return null;

  const role = user.role as Role;

  return (
    <header className="app-header">
      {/* Left */}
      <div className="header-left">
        <button
          className="btn-icon mobile-menu-btn"
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right */}
      <div className="header-right">
        {/* Notifications */}
        <button className="btn-icon header-notif" aria-label="Notifikasi" id="btn-notifications">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notif-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Chip */}
        <div className="header-user-chip">
          <div className="header-avatar">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="header-user-info">
            <p className="header-user-name">{user.fullName}</p>
            <p className="header-user-role">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </div>

      <style>{`
        .app-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--surface-border);
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          gap: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .mobile-menu-btn { display: none; }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .header-notif { position: relative; }
        .notif-badge {
          position: absolute;
          top: 2px; right: 2px;
          min-width: 17px; height: 17px;
          background: var(--color-danger);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          border-radius: 99px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px;
          border: 2px solid var(--surface-bg);
          line-height: 1;
        }

        .header-user-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 12px 6px 6px;
          background: rgba(30,41,59,0.6);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .header-user-chip:hover {
          background: rgba(30,41,59,0.9);
          border-color: rgba(148,163,184,0.2);
        }
        .header-avatar {
          width: 32px; height: 32px;
          background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800));
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }
        .header-user-info { display: flex; flex-direction: column; gap: 1px; }
        .header-user-name {
          font-size: 13px; font-weight: 600; color: var(--text-primary);
          white-space: nowrap; line-height: 1.2;
        }
        .header-user-role { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

        @media (max-width: 1024px) {
          .mobile-menu-btn { display: flex; }
          .header-user-info { display: none; }
        }

        @media (max-width: 640px) {
          .app-header { padding: 0 16px; }
        }
      `}</style>
    </header>
  );
}
