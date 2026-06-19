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
              (function(){var _0x=['%c🥚 ','%c Made with ❤️ by ','%c Jovan Prabowo Kuncoro ','%c\\nhttps://github.com/Etherlyvan','color:#f59e0b;font-size:20px;','color:#888;font-size:12px;','color:#22c55e;font-size:14px;font-weight:bold;','color:#3b82f6;font-size:11px;'];setTimeout(function(){console.log(_0x[0]+_0x[1]+_0x[2]+_0x[3],_0x[4],_0x[5],_0x[6],_0x[7]);},3000);})();
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
