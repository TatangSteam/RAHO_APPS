'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

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
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />
      <div className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Header />
        <main className="app-content fade-in">{children}</main>
      </div>
    </div>
  );
}
