import type { Metadata } from 'next';
import './globals.css';
import './components.css';
import { ToastProvider } from '@/components/providers/ToastProvider';

export const metadata: Metadata = {
  title: {
    default: 'Raho ERP',
    template: '%s — Raho ERP',
  },
  description: 'Sistem Manajemen Klinik Terapi Infus RAHO',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
