import type { Metadata } from 'next';
import './globals.css';
import './components.css';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { ThemeProvider } from '@/components/layout/ThemeProvider';

export const metadata: Metadata = {
  title: {
    default: 'Raho ERP',
    template: '%s — Raho ERP',
  },
  description: 'Sistem Manajemen Klinik Terapi Infus RAHO',
  robots: { index: false, follow: false },
  icons: {
    icon: '/asset/logo_tab_RAHO.png',
    shortcut: '/asset/logo_tab_RAHO.png',
    apple: '/asset/logo_tab_RAHO.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('raho-theme');
                  if (theme) {
                    var parsed = JSON.parse(theme);
                    if (parsed.state && parsed.state.theme) {
                      document.documentElement.classList.remove('light', 'dark');
                      document.documentElement.classList.add(parsed.state.theme);
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
