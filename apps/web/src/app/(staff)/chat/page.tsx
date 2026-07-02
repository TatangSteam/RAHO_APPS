import Link from 'next/link';
import { Bell, Clock3, MessageSquare } from 'lucide-react';

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 dark:bg-[#0a0a0a] md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-center justify-center">
        <section
          aria-labelledby="chat-title"
          className="w-full rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:p-8"
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
            <MessageSquare className="h-7 w-7 text-amber-500" />
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
            <Clock3 className="h-3.5 w-3.5" />
            Belum Aktif
          </div>

          <h1 id="chat-title" className="text-2xl font-bold text-neutral-900 dark:text-white">
            Chat
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Modul komunikasi internal belum diaktifkan. Gunakan notifikasi untuk memantau update operasional.
          </p>

          <div className="mt-6 flex justify-center">
            <Link
              href="/notifications"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
            >
              <Bell className="h-4 w-4" />
              Buka Notifikasi
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
