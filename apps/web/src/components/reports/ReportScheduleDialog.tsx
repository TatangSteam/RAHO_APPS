'use client';

import { X } from 'lucide-react';
import { REPORT_FREQUENCIES, type ReportFrequency } from '@/lib/reportPresentation';
import { ReportDropdown } from './ReportDropdown';

interface ReportScheduleDialogProps {
  frequency: ReportFrequency;
  onFrequencyChange: (frequency: ReportFrequency) => void;
  onClose: () => void;
  onSave: () => void;
}

export function ReportScheduleDialog({
  frequency,
  onFrequencyChange,
  onClose,
  onSave,
}: ReportScheduleDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-schedule-dialog-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="report-schedule-dialog-title" className="text-xl font-bold">Jadwal Laporan</h2>
          <button type="button" aria-label="Tutup" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="grid gap-4">
          <ReportDropdown label="Frekuensi" value={frequency} options={REPORT_FREQUENCIES} onChange={onFrequencyChange} />
          <div>
            <label htmlFor="schedule-time" className="mb-2 block text-sm font-medium">
              Waktu
            </label>
            <input id="schedule-time" type="time" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
          </div>
          <div>
            <label htmlFor="schedule-recipients" className="mb-2 block text-sm font-medium">
              Penerima
            </label>
            <input id="schedule-recipients" className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder="manager@example.com" />
          </div>
          <button
            type="button"
            onClick={onSave}
            className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400"
          >
            Simpan Jadwal
          </button>
        </div>
      </div>
    </div>
  );
}
