import type { Metadata } from 'next';
import './globals.css';
import './components.css';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { PreventNumberInputWheel } from '@/components/providers/PreventNumberInputWheel';

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
          <PreventNumberInputWheel />
          {children}
        </ThemeProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
