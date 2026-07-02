'use client';

import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface NotificationSummaryCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  className: string;
}

export function NotificationSummaryCard({
  label,
  value,
  icon,
  className,
}: NotificationSummaryCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950 dark:text-white">{value}</p>
        </div>
        <span className={clsx('flex h-10 w-10 items-center justify-center rounded-lg border', className)}>
          {icon}
        </span>
      </div>
    </div>
  );
}
