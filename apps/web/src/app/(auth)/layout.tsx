import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Raho Premier Club',
  description: 'Masuk ke sistem manajemen Raho Premier Club - Reverse Aging & Homeostasis',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      {children}
    </main>
  );
}
