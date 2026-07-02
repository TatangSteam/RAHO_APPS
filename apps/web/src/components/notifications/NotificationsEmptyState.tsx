'use client';

import { CheckCircle2 } from 'lucide-react';

export function NotificationsEmptyState() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-950">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-neutral-950 dark:text-white">
        Tidak ada notifikasi inventori
      </h2>
      <p className="mt-1 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
        Semua request stok dan pengiriman bermasalah untuk cabang yang dikelola sudah tertangani.
      </p>
    </div>
  );
}
