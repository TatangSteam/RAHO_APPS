'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Activity, Package, Boxes,
  ShoppingCart, Bell, MessageSquare, ChevronLeft,
  LogOut, ClipboardList, FileText, Shield, Building2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types/auth';
import { clsx } from 'clsx';
import { useState } from 'react';

// ── Menu Item Type ────────────────────────────────────────────

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
  badge?: string;
}

interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

// ── Menu Config ───────────────────────────────────────────────

const ALL_STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'];

const MENU_GROUPS: MenuGroup[] = [
  {
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard size={18} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'],
      },
      {
        label: 'Dashboard',
        href: '/admin/super-admin',
        icon: <Shield size={18} />,
        roles: ['SUPER_ADMIN'],
      },
    ],
  },
  {
    title: 'Klinik',
    items: [
      {
        label: 'Member',
        href: '/members',
        icon: <Users size={18} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'],
      },
      {
        label: 'Sesi Terapi',
        href: '/sessions',
        icon: <Activity size={18} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'],
      },
    ],
  },
  {
    title: 'Inventori',
    items: [
      {
        label: 'Stok',
        href: '/inventory',
        icon: <Boxes size={18} />,
        roles: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'],
      },
      {
        label: 'Request Stok',
        href: '/inventory/stock-requests',
        icon: <ClipboardList size={18} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG'],
      },
    ],
  },
  {
    title: 'Komunikasi',
    items: [
      {
        label: 'Notifikasi',
        href: '/notifications',
        icon: <Bell size={18} />,
        roles: ALL_STAFF,
      },
      {
        label: 'Chat',
        href: '/chat',
        icon: <MessageSquare size={18} />,
        roles: ALL_STAFF,
      },
    ],
  },
  {
    title: 'Manajemen',
    items: [
      {
        label: 'Kelola User',
        href: '/admin/users',
        icon: <Shield size={18} />,
        roles: ['SUPER_ADMIN', 'ADMIN_CABANG'],
      },
      {
        label: 'Pengaturan Cabang',
        href: '/branches',
        icon: <Building2 size={18} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER'],
      },
      {
        label: 'Kode Referral',
        href: '/referrals',
        icon: <FileText size={18} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG'],
      },
      {
        label: 'Harga Paket',
        href: '/admin/package-pricing',
        icon: <Package size={18} />,
        roles: ['SUPER_ADMIN', 'ADMIN_CABANG'],
      },
    ],
  },
  {
    title: 'Super Admin',
    items: [
      {
        label: 'Master Produk',
        href: '/admin/master-products',
        icon: <Boxes size={18} />,
        roles: ['SUPER_ADMIN'],
      },
      {
        label: 'Audit Log',
        href: '/admin/audit-logs',
        icon: <ClipboardList size={18} />,
        roles: ['SUPER_ADMIN'],
      },
    ],
  },
];

// ── Role Display ──────────────────────────────────────────────

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_MANAGER: 'Admin Manager',
  ADMIN_CABANG: 'Admin Cabang',
  ADMIN_LAYANAN: 'Admin Layanan',
  DOCTOR: 'Dokter',
  NURSE: 'Nakes',
  MEMBER: 'Member',
};

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN:   '#f43f5e',
  ADMIN_MANAGER: '#a855f7',
  ADMIN_CABANG:  '#f59e0b',
  ADMIN_LAYANAN: '#22c55e',
  DOCTOR:        '#3b82f6',
  NURSE:         '#06b6d4',
  MEMBER:        '#64748b',
};

// ── Props ─────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ── Component ─────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  if (!user) return null;

  const role = user.role as Role;

  // Don't render sidebar for MEMBER role
  if (role === 'MEMBER') return null;

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

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    
    // For inventory routes, use exact matching to prevent conflicts
    if (href === '/inventory') {
      return pathname === '/inventory';
    }
    
    // For sub-routes, check exact match or proper sub-path
    if (pathname === href) {
      return true;
    }
    
    // Only consider it active if it's a proper sub-path (with trailing slash)
    return pathname.startsWith(href + '/');
  };

  return (
    <aside className={clsx('sidebar', collapsed && 'sidebar-collapsed')}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">R</div>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">RAHO</span>
              <span className="sidebar-brand-desc">Klinik System</span>
            </div>
          )}
        </div>
        <button className="sidebar-collapse-btn" onClick={onToggle} aria-label="Toggle sidebar">
          <ChevronLeft size={16} className={clsx('collapse-icon', collapsed && 'rotated')} />
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user.fullName}</p>
            <span
              className="sidebar-user-role"
              style={{ color: ROLE_COLORS[role] }}
            >
              {ROLE_LABELS[role]}
            </span>
            {user.branchCode && (
              <span className="sidebar-user-branch">Cab. {user.branchCode}</span>
            )}
          </div>
        </div>
      )}

      {collapsed && (
        <div 
          className="sidebar-user-mini"
          onMouseEnter={() => setHoveredItem('user-profile')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div className="sidebar-user-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
          {hoveredItem === 'user-profile' && (
            <div className="sidebar-tooltip">
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{user.fullName}</div>
              <div style={{ fontSize: 11, color: ROLE_COLORS[role] }}>{ROLE_LABELS[role]}</div>
              {user.branchCode && <div style={{ fontSize: 10, opacity: 0.7 }}>Cab. {user.branchCode}</div>}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {MENU_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) =>
            item.roles.includes(role),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={gi} className="sidebar-group">
              {!collapsed && group.title && (
                <p className="sidebar-group-title">{group.title}</p>
              )}
              {visibleItems.map((item) => (
                <div 
                  key={item.href}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => collapsed && setHoveredItem(item.href)}
                  onMouseLeave={() => collapsed && setHoveredItem(null)}
                >
                  <Link
                    href={item.href}
                    className={clsx('sidebar-item', isActive(item.href) && 'active', collapsed && 'sidebar-item-collapsed')}
                  >
                    <span className="sidebar-item-icon">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="sidebar-item-label">{item.label}</span>
                        {item.badge && (
                          <span className="sidebar-item-badge">{item.badge}</span>
                        )}
                      </>
                    )}
                    {isActive(item.href) && <span className="sidebar-item-indicator" />}
                  </Link>
                  {collapsed && hoveredItem === item.href && (
                    <div className="sidebar-tooltip">
                      {item.label}
                      {item.badge && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.8 }}>({item.badge})</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div 
          style={{ position: 'relative' }}
          onMouseEnter={() => collapsed && setHoveredItem('logout')}
          onMouseLeave={() => collapsed && setHoveredItem(null)}
        >
          <button 
            className={clsx('sidebar-item sidebar-logout', collapsed && 'sidebar-item-collapsed')} 
            onClick={handleLogout} 
            id="btn-logout"
          >
            <span className="sidebar-item-icon"><LogOut size={18} /></span>
            {!collapsed && <span className="sidebar-item-label">Keluar</span>}
          </button>
          {collapsed && hoveredItem === 'logout' && (
            <div className="sidebar-tooltip">Keluar</div>
          )}
        </div>
      </div>

      <style>{`
        .sidebar {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: var(--sidebar-width);
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: width var(--transition-normal);
          overflow: hidden;
        }
        .sidebar.sidebar-collapsed { width: var(--sidebar-width-collapsed); }

        /* Header */
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 16px 16px;
          border-bottom: 1px solid var(--sidebar-border);
          flex-shrink: 0;
        }
        .sidebar-collapsed .sidebar-header {
          flex-direction: column;
          gap: 12px;
          padding: 16px 12px;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          overflow: hidden;
          min-width: 0;
        }
        .sidebar-collapsed .sidebar-brand {
          justify-content: center;
        }
        .sidebar-logo {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-800));
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 800; color: #fff;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(37,99,235,0.35);
        }
        .sidebar-brand-text { 
          display: flex; 
          flex-direction: column; 
          overflow: hidden;
          opacity: 1;
          max-width: 200px;
          transition: all var(--transition-fast);
        }
        .sidebar-collapsed .sidebar-brand-text {
          opacity: 0;
          max-width: 0;
        }
        .sidebar-brand-name {
          font-size: 15px; font-weight: 700; color: var(--text-primary);
          letter-spacing: 0.03em; white-space: nowrap;
        }
        .sidebar-brand-desc { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

        .sidebar-collapse-btn {
          width: 28px; height: 28px;
          background: rgba(148,163,184,0.08);
          border: 1px solid var(--sidebar-border);
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--text-muted);
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }
        .sidebar-collapse-btn:hover { background: rgba(148,163,184,0.15); color: var(--text-primary); }
        .collapse-icon { transition: transform var(--transition-normal); }
        .collapse-icon.rotated { transform: rotate(180deg); }

        /* User */
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--sidebar-border);
          flex-shrink: 0;
          overflow: hidden;
        }
        .sidebar-user-mini {
          display: flex;
          justify-content: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--sidebar-border);
          flex-shrink: 0;
          position: relative;
          cursor: pointer;
        }
        .sidebar-user-mini:hover .sidebar-user-avatar {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .sidebar-user-avatar {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #334155, #1e293b);
          border: 2px solid var(--surface-border);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 600; color: var(--text-primary);
          flex-shrink: 0;
          transition: all var(--transition-fast);
        }
        .sidebar-user-info { display: flex; flex-direction: column; gap: 1px; overflow: hidden; min-width: 0; }
        .sidebar-user-name {
          font-size: 13px; font-weight: 600; color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sidebar-user-role { font-size: 11px; font-weight: 500; }
        .sidebar-user-branch { font-size: 11px; color: var(--text-muted); }

        /* Nav */
        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sidebar-group { display: flex; flex-direction: column; gap: 1px; }
        .sidebar-group + .sidebar-group { margin-top: 8px; }
        .sidebar-group-title {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 8px 10px 4px;
          white-space: nowrap;
        }

        /* Nav Item */
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: none;
          text-decoration: none;
          width: 100%;
          position: relative;
          transition: all var(--transition-fast);
          white-space: nowrap;
          overflow: hidden;
          user-select: none;
        }
        .sidebar-item-collapsed {
          justify-content: center;
          padding: 10px;
        }
        .sidebar-item:hover {
          background: rgba(59, 130, 246, 0.08);
          color: var(--text-primary);
        }
        .sidebar-item.active {
          background: rgba(59, 130, 246, 0.12);
          color: var(--color-primary-400);
          font-weight: 600;
        }
        .sidebar-item-icon {
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; width: 18px;
        }
        .sidebar-item-label { flex: 1; }
        .sidebar-item-badge {
          background: rgba(239,68,68,0.2);
          color: #f87171;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 99px;
          border: 1px solid rgba(239,68,68,0.3);
        }
        .sidebar-item-indicator {
          position: absolute;
          left: 0; top: 50%;
          transform: translateY(-50%);
          width: 3px; height: 60%;
          background: var(--color-primary-500);
          border-radius: 0 3px 3px 0;
        }

        /* Logout */
        .sidebar-logout { color: var(--text-muted) !important; }
        .sidebar-logout:hover { background: rgba(239,68,68,0.08) !important; color: #f87171 !important; }

        /* Footer */
        .sidebar-footer {
          padding: 8px;
          border-top: 1px solid var(--sidebar-border);
          flex-shrink: 0;
        }

        /* Tooltip */
        .sidebar-tooltip {
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          pointer-events: none;
          animation: tooltipFadeIn 0.15s ease-out;
        }
        .sidebar-tooltip::before {
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 6px solid transparent;
          border-right-color: var(--surface-border);
        }
        .sidebar-tooltip::after {
          content: '';
          position: absolute;
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-right-color: var(--surface-card);
          margin-right: -1px;
        }
        @keyframes tooltipFadeIn {
          from { opacity: 0; transform: translateY(-50%) translateX(-4px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
      `}</style>
    </aside>
  );
}
