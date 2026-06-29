'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ImpersonationProvider } from '@/contexts/ImpersonationContext';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { GlobalLoadingOverlay } from '@/components/ui/GlobalLoadingOverlay';
import { ApiLoadingSetup } from '@/components/providers/ApiLoadingSetup';
import { useManagerInventoryNotifications } from '@/hooks/useManagerInventoryNotifications';
import { useAuthStore } from '@/stores/authStore';
import { devLog } from '@/lib/logger';
import { clsx } from 'clsx';

// Inner component that uses LoadingContext
function StaffLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, accessToken } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const managerNotifications = useManagerInventoryNotifications(
    user?.role === 'ADMIN_MANAGER' && Boolean(accessToken),
    { pollMs: 60000 },
  );

  // Debug log (only in development)
  useEffect(() => {
    devLog('🔍 Staff Layout Debug:', {
      pathname,
      willRenderSidebar: true
    });
  }, [pathname]);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState !== null) {
      setCollapsed(savedState === 'true');
    }
    setMounted(true);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Save collapsed state to localStorage whenever it changes
  const handleToggle = () => {
    setCollapsed((c) => {
      const newState = !c;
      localStorage.setItem('sidebar-collapsed', String(newState));
      return newState;
    });
  };

  const handleMobileMenuToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  // Prevent flash of wrong state
  if (!mounted) {
    return null;
  }

  return (
    <>
      <ApiLoadingSetup />
      <GlobalLoadingOverlay />
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] transition-colors duration-300">
        <ImpersonationBanner />
        <Sidebar 
          collapsed={collapsed} 
          onToggle={handleToggle}
          mobileOpen={mobileOpen}
          onMobileClose={handleMobileClose}
          notificationCounts={managerNotifications.counts}
        />
        <div 
          className={clsx(
            'min-h-screen flex flex-col transition-all duration-300',
            // Desktop: margin based on sidebar state
            // Mobile: no margin (sidebar is overlay)
            'lg:ml-[260px]',
            collapsed && 'lg:ml-[72px]'
          )}
        >
          <Header
            onMobileMenuToggle={handleMobileMenuToggle}
            unreadCount={managerNotifications.counts.total}
          />
          <main className="flex-1 p-4 sm:p-6 animate-in fade-in duration-300">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
}

// Main layout component
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoadingProvider>
      <ImpersonationProvider>
        <StaffLayoutInner>{children}</StaffLayoutInner>
      </ImpersonationProvider>
    </LoadingProvider>
  );
}
