'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--surface-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          fontSize: '14px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        },
        success: {
          iconTheme: {
            primary: '#22c55e',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#ffffff',
          },
        },
      }}
    />
  );
}
