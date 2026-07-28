'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Activity, Package, Boxes,
  Bell, MessageSquare, ChevronLeft, X,
  LogOut, ClipboardList, ClipboardCheck, FileText, Shield, Building2, CreditCard,
  UserCog, Truck, BarChart3, History, ListChecks, Loader2,
  FileSpreadsheet, ShieldCheck, Landmark, ReceiptText, Scale,
  Database, LockKeyhole, Warehouse, PackageCheck, ShoppingCart, BadgeDollarSign,
  ListTree,
  PlugZap,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Role } from '@/types/auth';
import { clsx } from 'clsx';
import { MouseEvent, useEffect, useRef, useState } from 'react';
import { devError } from '@/lib/logger';
import { useLoading } from '@/contexts/LoadingContext';
import { getRoleLabel, getRoleTextColor } from '@/lib/rolePresentation';
import {
  formatNotificationBadge,
  type ManagerNotificationCounts,
} from '@/lib/api/managerNotificationsApi';

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

const ALL_STAFF: Role[] = ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'ADMIN_LOGISTIK', 'DOCTOR', 'NURSE'];

const MENU_GROUPS: MenuGroup[] = [
  {
    items: [
      {
        label: 'Master Inventori',
        href: '/inventory/master-data',
        icon: <Warehouse size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Ledger Stok',
        href: '/inventory/ledger',
        icon: <Database size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG'],
      },
      {
        label: 'Stock Opname',
        href: '/inventory/stock-opnames',
        icon: <ClipboardCheck size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard size={20} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'ADMIN_LOGISTIK', 'DOCTOR', 'NURSE'],
      },
      {
        label: 'Dashboard',
        href: '/admin/super-admin',
        icon: <Shield size={20} />,
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
        icon: <Users size={20} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'ADMIN_LOGISTIK', 'DOCTOR', 'NURSE'],
      },
      {
        label: 'Sesi Terapi',
        href: '/sessions',
        icon: <Activity size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN', 'ADMIN_LOGISTIK', 'DOCTOR', 'NURSE'],
      },
      {
        label: 'Pembayaran',
        href: '/payments',
        icon: <CreditCard size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG', 'ADMIN_LAYANAN'],
      },
    ],
  },
  {
    title: 'Inventori',
    items: [
      {
        label: 'Dashboard Logistik',
        href: '/inventory/dashboard',
        icon: <BarChart3 size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG'],
      },
      {
        label: 'Stok',
        href: '/inventory',
        icon: <Boxes size={20} />,
        roles: ['ADMIN_CABANG', 'ADMIN_LAYANAN', 'DOCTOR', 'NURSE'],
      },
      {
        label: 'Mutasi Stok',
        href: '/inventory/stock-mutations',
        icon: <History size={20} />,
        roles: ALL_STAFF,
      },
      {
        label: 'Adjustment & Opname',
        href: '/inventory/controls',
        icon: <ClipboardCheck size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG'],
      },
      {
        label: 'Riwayat Penggunaan Barang',
        href: '/inventory/material-usage-history',
        icon: <ListChecks size={20} />,
        roles: ALL_STAFF,
      },
      {
        label: 'Request Stok',
        href: '/inventory/stock-requests',
        icon: <ClipboardList size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG'],
      },
      {
        label: 'Reservasi Stok',
        href: '/inventory/stock-reservations',
        icon: <LockKeyhole size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Pengiriman',
        href: '/inventory/shipments',
        icon: <Truck size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG'],
      },
      {
        label: 'Goods Receipt',
        href: '/inventory/goods-receipts',
        icon: <PackageCheck size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'ADMIN_CABANG'],
      },
      {
        label: 'Treatment BOM',
        href: '/inventory/treatment-boms',
        icon: <ListTree size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'ADMIN_CABANG'],
      },
      {
        label: 'Laporan Pengiriman',
        href: '/inventory/shipment-report',
        icon: <FileSpreadsheet size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Tas Homecare',
        href: '/inventory/homecare-bags',
        icon: <Package size={20} />,
        roles: ALL_STAFF,
      },
    ],
  },
  {
    title: 'Komunikasi',
    items: [
      {
        label: 'Notifikasi',
        href: '/notifications',
        icon: <Bell size={20} />,
        roles: ALL_STAFF,
      },
      {
        label: 'Chat',
        href: '/chat',
        icon: <MessageSquare size={20} />,
        roles: ALL_STAFF,
      },
    ],
  },
  {
    title: 'Manajemen',
    items: [
      {
        label: 'Pengaturan Cabang',
        href: '/branches',
        icon: <Building2 size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'],
      },
      {
        label: 'Kelola Staff',
        href: '/staff',
        icon: <UserCog size={20} />,
        roles: ['ADMIN_CABANG'],
      },
      {
        label: 'Kinerja Staff',
        href: '/staff-performance',
        icon: <BarChart3 size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'],
      },
      {
        label: 'Laporan',
        href: '/reports',
        icon: <BarChart3 size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'],
      },
      {
        label: 'Kode Referral',
        href: '/referrals',
        icon: <FileText size={20} />,
        roles: ['ADMIN_MANAGER', 'ADMIN_CABANG'],
      },
      {
        label: 'Harga Paket',
        href: '/admin/package-pricing',
        icon: <Package size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_CABANG'],
      },
      {
        label: 'Import Data',
        href: '/admin/member-import',
        icon: <FileSpreadsheet size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER'],
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Accounting',
        href: '/accounting',
        icon: <Landmark size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Finance Reports',
        href: '/finance-reports',
        icon: <BarChart3 size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Kas & Bank',
        href: '/cash-bank',
        icon: <CreditCard size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG'],
      },
      {
        label: 'Opening Balance',
        href: '/opening-balances',
        icon: <Scale size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER'],
      },
      {
        label: 'Expense',
        href: '/expenses',
        icon: <ReceiptText size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG', 'ADMIN_LAYANAN'],
      },
      {
        label: 'Purchasing & AP',
        href: '/purchasing',
        icon: <ShoppingCart size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'FINANCE_LOGISTICS_CONTROLLER', 'ADMIN_CABANG', 'ADMIN_LOGISTIK'],
      },
      {
        label: 'Deferred Revenue',
        href: '/revenue-recognition',
        icon: <BadgeDollarSign size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Approval Inbox',
        href: '/approvals',
        icon: <ListChecks size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
    ],
  },
  {
    title: 'Manajemen Sistem',
    items: [
      {
        label: 'Admin Managers',
        href: '/admin/managers',
        icon: <UserCog size={20} />,
        roles: ['SUPER_ADMIN'],
      },
      {
        label: 'Master Produk',
        href: '/admin/master-products',
        icon: <Boxes size={20} />,
        roles: ['SUPER_ADMIN'],
      },
      {
        label: 'Permission & Role',
        href: '/admin/permissions',
        icon: <ShieldCheck size={20} />,
        roles: ['SUPER_ADMIN'],
      },
      {
        label: 'Audit Log',
        href: '/admin/audit-logs',
        icon: <ClipboardList size={20} />,
        roles: ['SUPER_ADMIN', 'ADMIN_MANAGER', 'ADMIN_LOGISTIK', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
      {
        label: 'Integrasi Zoho',
        href: '/admin/integrations/zoho',
        icon: <PlugZap size={20} />,
        roles: ['SUPER_ADMIN', 'FINANCE_LOGISTICS_CONTROLLER'],
      },
    ],
  },
];

// ── Role Display ──────────────────────────────────────────────

// ── Props ─────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  notificationCounts?: ManagerNotificationCounts;
}

// ── Component ─────────────────────────────────────────────────

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  notificationCounts,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const { showGlobalLoading, hideGlobalLoading } = useLoading();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayShownRef = useRef(false);

  if (!user) return null;

  const role = user.role as Role;
  const displayedRoleLabel =
    user.roleTemplateName ||
    (user.staffCode?.startsWith('FN-') || user.email.toLowerCase() === 'finance@raho.id'
      ? 'Finance'
      : getRoleLabel(role));
  const isMemberViewOnlyAdminManager =
    role === 'ADMIN_MANAGER' && user.adminManagerAccessScope === 'MEMBER_VIEW_ONLY';

  // Don't render sidebar for MEMBER role
  if (role === 'MEMBER') return null;

  const getItemBadge = (item: MenuItem) => {
    if (role !== 'ADMIN_MANAGER' || !notificationCounts) {
      return item.badge;
    }

    if (item.href === '/notifications' && notificationCounts.total > 0) {
      return formatNotificationBadge(notificationCounts.total);
    }

    if (item.href === '/inventory/stock-requests' && notificationCounts.stockRequests > 0) {
      return formatNotificationBadge(notificationCounts.stockRequests);
    }

    if (item.href === '/inventory/shipments' && notificationCounts.issueShipments > 0) {
      return formatNotificationBadge(notificationCounts.issueShipments);
    }

    return item.badge;
  };

  const handleLogout = async () => {
    try {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        const { logoutApi } = await import('@/lib/authApi');
        await logoutApi(refreshToken);
      }
    } catch (error) {
      devError('Logout API error:', error);
    } finally {
      clearAuth();
      document.cookie = 'raho-auth-token=; path=/; max-age=0';
      window.location.href = '/login';
    }
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    if (href === '/inventory') return pathname === '/inventory';
    if (pathname === href) return true;
    return pathname.startsWith(href + '/');
  };

  useEffect(() => {
    if (!pendingHref) return;

    if (pathname === pendingHref) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  useEffect(() => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }

    if (!pendingHref) {
      if (overlayShownRef.current) {
        hideGlobalLoading();
        overlayShownRef.current = false;
      }

      return;
    }

    loadingTimerRef.current = setTimeout(() => {
      overlayShownRef.current = true;
      showGlobalLoading('Memuat halaman...');
    }, 180);

    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [hideGlobalLoading, pendingHref, showGlobalLoading]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }

      if (overlayShownRef.current) {
        hideGlobalLoading();
      }
    };
  }, [hideGlobalLoading]);

  const shouldSkipNavigationLoading = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    return (
      pathname === href ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0 ||
      event.currentTarget.target === '_blank'
    );
  };

  const handleNavClick = (href: string, event: MouseEvent<HTMLAnchorElement>) => {
    // Close mobile menu when navigating
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }

    if (shouldSkipNavigationLoading(event, href)) {
      return;
    }

    setPendingHref(href);
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className={clsx(
        'flex items-center h-16 flex-shrink-0',
        collapsed ? 'justify-center px-3' : 'justify-between px-4'
      )}>
        <div className={clsx(
          'flex items-center gap-3 overflow-hidden min-w-0',
          collapsed && 'justify-center'
        )}>
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img 
              src="/asset/logo_tab_RAHO.png" 
              alt="RAHO" 
              className="w-full h-full object-cover"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-base font-bold text-neutral-900 dark:text-white tracking-wide whitespace-nowrap">
                RAHO
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                Premier Club
              </span>
            </div>
          )}
        </div>
        
        {/* Desktop collapse button */}
        {!collapsed && (
          <button 
            className={clsx(
              'hidden lg:flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0',
              'bg-neutral-100 dark:bg-neutral-800',
              'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'transition-all duration-200'
            )}
            onClick={onToggle} 
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Mobile close button */}
        <button 
          className={clsx(
            'lg:hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            'bg-neutral-100 dark:bg-neutral-800',
            'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
            'hover:bg-neutral-200 dark:hover:bg-neutral-700',
            'transition-all duration-200'
          )}
          onClick={onMobileClose} 
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Collapsed Toggle Button - Desktop only */}
      {collapsed && (
        <div className="hidden lg:flex justify-center py-3">
          <button 
            className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              'bg-neutral-100 dark:bg-neutral-800',
              'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
              'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              'transition-all duration-200'
            )}
            onClick={onToggle} 
            aria-label="Expand sidebar"
          >
            <ChevronLeft size={18} className="rotate-180" />
          </button>
        </div>
      )}

      {/* User Info - Expanded */}
      {!collapsed && (
        <Link 
          href="/profile"
          onClick={(event) => handleNavClick('/profile', event)}
          className={clsx(
            'flex items-center gap-3 px-4 py-4 flex-shrink-0 transition-colors rounded-xl mx-2',
            pendingHref === '/profile'
              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
          )}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 overflow-hidden">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-bold">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {user.fullName}
            </p>
            <span className={clsx('text-xs font-medium', getRoleTextColor(role))}>
              {displayedRoleLabel}
            </span>
            {user.branchCode && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Cab. {user.branchCode}
              </span>
            )}
          </div>
        </Link>
      )}

      {/* User Info - Collapsed */}
      {collapsed && (
        <Link 
          href="/profile"
          onClick={(event) => handleNavClick('/profile', event)}
          className="hidden lg:flex justify-center py-3 relative cursor-pointer group"
          onMouseEnter={() => setHoveredItem('user-profile')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold overflow-hidden transition-transform duration-200 group-hover:scale-105">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-bold">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {hoveredItem === 'user-profile' && (
            <Tooltip>
              <div className="font-semibold mb-0.5">{user.fullName}</div>
              <div className={clsx('text-xs', getRoleTextColor(role))}>{displayedRoleLabel}</div>
              {user.branchCode && <div className="text-[10px] text-neutral-500">Cab. {user.branchCode}</div>}
              <div className="text-[10px] text-amber-500 mt-1">Klik untuk lihat profil</div>
            </Tooltip>
          )}
        </Link>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 flex flex-col gap-1">
        {MENU_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => (
            item.roles.includes(role) &&
            (!isMemberViewOnlyAdminManager || item.href === '/members')
          ));
          if (visibleItems.length === 0) return null;

          return (
            <div key={gi} className="flex flex-col gap-0.5">
              {!collapsed && group.title && (
                <p className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-3 pt-4 pb-2">
                  {group.title}
                </p>
              )}
              {collapsed && gi > 0 && <div className="hidden lg:block h-px bg-neutral-200 dark:bg-neutral-800 my-2 mx-1" />}
              {visibleItems.map((item) => {
                const badge = getItemBadge(item);
                const pending = pendingHref === item.href;

                return (
                  <div 
                    key={item.href}
                    className="relative"
                    onMouseEnter={() => collapsed && setHoveredItem(item.href)}
                    onMouseLeave={() => collapsed && setHoveredItem(null)}
                  >
                    <Link
                      href={item.href}
                      onClick={(event) => handleNavClick(item.href, event)}
                      className={clsx(
                        'flex items-center gap-3 rounded-xl text-sm font-medium',
                        'transition-all duration-200 relative select-none active:scale-[0.98]',
                        collapsed ? 'lg:justify-center lg:p-3 justify-start px-3 py-2.5' : 'px-3 py-2.5',
                        pending
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-inner cursor-wait'
                          : isActive(item.href)
                          ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
                      )}
                      aria-busy={pending}
                    >
                      <span className="flex items-center justify-center flex-shrink-0">
                        {pending ? <Loader2 size={20} className="animate-spin" /> : item.icon}
                      </span>
                      <span className={clsx(collapsed ? 'lg:hidden' : '')}>
                        {item.label}
                      </span>
                      {pending && !collapsed && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                          Memuat
                          <span className="inline-flex gap-0.5">
                            <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                            <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                            <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                          </span>
                        </span>
                      )}
                      {badge && !collapsed && !pending && (
                        <span className="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto">
                          {badge}
                        </span>
                      )}
                      {badge && collapsed && !pending && (
                        <span className="hidden lg:flex absolute right-1.5 top-1.5 min-w-[16px] h-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                          {badge}
                        </span>
                      )}
                      {(isActive(item.href) || pending) && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[60%] bg-amber-500 rounded-r-full" />
                      )}
                    </Link>
                    {collapsed && hoveredItem === item.href && (
                      <Tooltip>
                        {item.label}
                        {badge && <span className="ml-1.5 text-[10px] opacity-80">({badge})</span>}
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 flex-shrink-0">
        <div 
          className="relative"
          onMouseEnter={() => collapsed && setHoveredItem('logout')}
          onMouseLeave={() => collapsed && setHoveredItem(null)}
        >
          <button 
            className={clsx(
              'flex items-center gap-3 rounded-xl text-sm font-medium w-full',
              'text-neutral-500 dark:text-neutral-400',
              'hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400',
              'transition-all duration-200',
              collapsed ? 'lg:justify-center lg:p-3 justify-start px-3 py-2.5' : 'px-3 py-2.5'
            )}
            onClick={handleLogout} 
            id="btn-logout"
          >
            <span className="flex items-center justify-center flex-shrink-0">
              <LogOut size={20} />
            </span>
            <span className={clsx(collapsed ? 'lg:hidden' : '')}>Keluar</span>
          </button>
          {collapsed && hoveredItem === 'logout' && (
            <Tooltip>Keluar</Tooltip>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-[99] backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      {/* Desktop Sidebar */}
      <aside 
        className={clsx(
          'hidden lg:flex fixed top-0 left-0 bottom-0 z-[100] flex-col',
          'bg-white dark:bg-[#0a0a0a]',
          'border-r border-neutral-200 dark:border-neutral-800',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside 
        className={clsx(
          'lg:hidden fixed top-0 left-0 bottom-0 z-[100] flex flex-col w-[280px]',
          'bg-white dark:bg-[#0a0a0a]',
          'border-r border-neutral-200 dark:border-neutral-800',
          'transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

// ── Tooltip Component ─────────────────────────────────────────

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-[1000] pointer-events-none animate-in fade-in slide-in-from-left-1 duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-medium text-neutral-900 dark:text-white whitespace-nowrap shadow-lg dark:shadow-xl">
        {children}
      </div>
      {/* Arrow */}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-neutral-200 dark:border-r-neutral-700" />
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-white dark:border-r-neutral-900 mr-[-1px]" />
    </div>
  );
}
