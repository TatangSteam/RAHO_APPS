'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    // Apply theme class to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
