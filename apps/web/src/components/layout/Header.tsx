'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Bell, Menu, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { BranchSwitcher } from './BranchSwitcher';
import { Role } from '@/types/auth';
import { api } from '@/lib/api';
import { formatNotificationBadge } from '@/lib/api/managerNotificationsApi';
import { getRoleLabel, getRoleTextColor } from '@/lib/rolePresentation';
import { clsx } from 'clsx';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  unreadCount?: number;
}

export function Header({ onMobileMenuToggle, unreadCount = 0 }: HeaderProps) {
  const { user, updateUser, updateUserAvatar } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  
  // Fetch avatar on mount if not already loaded
  useEffect(() => {
    if (user && (!user.avatarUrl || user.role === 'ADMIN_MANAGER')) {
      api.get('/auth/me')
        .then((res) => {
          const me = res.data.data;
          const avatarUrl = me?.profile?.avatarUrl;
          if (avatarUrl && avatarUrl !== user.avatarUrl) {
            updateUserAvatar(avatarUrl);
          }
          if (
            user.role === 'ADMIN_MANAGER' &&
            me?.adminManagerAccessScope &&
            me.adminManagerAccessScope !== user.adminManagerAccessScope
          ) {
            updateUser({ adminManagerAccessScope: me.adminManagerAccessScope });
            const cookiePayload = btoa(
              JSON.stringify({
                role: user.role,
                userId: user.userId || user.id,
                adminManagerAccessScope: me.adminManagerAccessScope,
              }),
            );
            document.cookie = `raho-auth-token=${cookiePayload}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
          }
        })
        .catch(() => {
          // Silently fail - avatar is optional
        });
    }
  }, [user, updateUser, updateUserAvatar]);
  
  if (!user) return null;

  const role = user.role as Role;

  return (
    <header className="sticky top-0 z-40 box-border flex h-16 w-full max-w-[100vw] items-center justify-between gap-4 overflow-x-hidden border-b border-neutral-200 bg-white px-4 transition-colors duration-300 dark:border-neutral-800 dark:bg-[#0a0a0a] sm:px-6">
      {/* Left */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile menu button */}
        <button
          className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Branch Switcher (for doctors/nurses with multi-branch) */}
        <BranchSwitcher />
        
        {/* Theme Toggle */}
        <button 
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200',
            'text-neutral-500 dark:text-neutral-400',
            'hover:text-amber-600 dark:hover:text-amber-400',
            'hover:bg-amber-50 dark:hover:bg-amber-500/10'
          )}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications */}
        <Link 
          href="/notifications"
          className={clsx(
            'relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200',
            'text-neutral-500 dark:text-neutral-400',
            'hover:text-amber-600 dark:hover:text-amber-400',
            'hover:bg-amber-50 dark:hover:bg-amber-500/10'
          )}
          aria-label="Notifikasi" 
          id="btn-notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-[#0a0a0a]">
              {formatNotificationBadge(unreadCount)}
            </span>
          )}
        </Link>

        {/* User Chip - Links to Profile */}
        <Link 
          href={role === 'MEMBER' ? '/me/profile' : '/profile'}
          className="flex items-center gap-2 sm:gap-2.5 py-1.5 pl-1.5 pr-2 sm:pr-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200 group"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md shadow-amber-500/25 group-hover:shadow-amber-500/35 transition-shadow">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-sm font-bold text-black">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="hidden sm:flex flex-col gap-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight truncate max-w-[120px] lg:max-w-[160px]">
              {user.fullName}
            </p>
            <p className={clsx('text-xs leading-tight', getRoleTextColor(role))}>
              {getRoleLabel(role)}
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
