'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ImpersonationProvider } from '@/contexts/ImpersonationContext';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Debug log
  useEffect(() => {
    console.log('🔍 Staff Layout Debug:', {
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

  // Save collapsed state to localStorage whenever it changes
  const handleToggle = () => {
    setCollapsed((c) => {
      const newState = !c;
      localStorage.setItem('sidebar-collapsed', String(newState));
      return newState;
    });
  };

  // Prevent flash of wrong state
  if (!mounted) {
    return null;
  }

  return (
    <ImpersonationProvider>
      <div className="app-layout">
        <ImpersonationBanner />
        <Sidebar collapsed={collapsed} onToggle={handleToggle} />
        <div className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
          <Header />
          <main className="app-content fade-in">{children}</main>
          <Footer className="staff-footer" />
        </div>
      </div>
    </ImpersonationProvider>
  );
}
