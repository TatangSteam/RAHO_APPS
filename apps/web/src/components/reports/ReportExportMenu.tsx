'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import type { ReportExportFormat } from '@/lib/reportPresentation';

interface ReportExportMenuProps {
  onExport: (format: ReportExportFormat) => void;
}

export function ReportExportMenu({ onExport }: ReportExportMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-4 text-sm font-semibold hover:border-amber-500 dark:border-neutral-700"
      >
        <Download size={16} />
        Export
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onExport('xlsx');
              setOpen(false);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            Excel
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onExport('csv');
              setOpen(false);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            CSV
          </button>
        </div>
      )}
    </div>
  );
}
