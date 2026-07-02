'use client';

import { X } from 'lucide-react';

interface ReportEmailDialogProps {
  onClose: () => void;
  onSend: () => void;
}

export function ReportEmailDialog({ onClose, onSend }: ReportEmailDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-email-dialog-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="report-email-dialog-title" className="text-xl font-bold">Email Laporan</h2>
          <button type="button" aria-label="Tutup" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="grid gap-4">
          <div>
            <label htmlFor="email-recipients" className="mb-2 block text-sm font-medium">
              Penerima
            </label>
            <input id="email-recipients" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
          </div>
          <div>
            <label htmlFor="email-subject" className="mb-2 block text-sm font-medium">
              Subject
            </label>
            <input id="email-subject" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
          </div>
          <div>
            <label htmlFor="email-message" className="mb-2 block text-sm font-medium">
              Pesan
            </label>
            <textarea id="email-message" rows={4} className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
          </div>
          <button
            type="button"
            onClick={onSend}
            className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
          >
            Kirim Email
          </button>
        </div>
      </div>
    </div>
  );
}
