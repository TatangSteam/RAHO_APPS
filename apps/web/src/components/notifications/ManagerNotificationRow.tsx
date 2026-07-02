'use client';

import Link from 'next/link';
import { ChevronRight, ClipboardList, Truck, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import type {
  ManagerNotificationItem,
  ManagerNotificationType,
} from '@/lib/api/managerNotificationsApi';
import {
  formatManagerNotificationDate,
  getManagerNotificationSeverityClass,
  getManagerNotificationStatusLabel,
} from '@/lib/managerNotificationPresentation';

function getNotificationIcon(type: ManagerNotificationType) {
  switch (type) {
    case 'STOCK_PAYMENT_UPLOADED':
      return <Upload className="h-5 w-5" />;
    case 'SHIPMENT_ISSUE':
      return <Truck className="h-5 w-5" />;
    case 'STOCK_REQUEST_PENDING':
    default:
      return <ClipboardList className="h-5 w-5" />;
  }
}

export function ManagerNotificationRow({ item }: { item: ManagerNotificationItem }) {
  const severityClass = getManagerNotificationSeverityClass(item.severity);

  return (
    <Link
      href={item.href}
      className={clsx(
        'group flex items-start gap-4 rounded-lg border p-4 transition-all',
        'border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50/40',
        'dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5',
      )}
    >
      <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', severityClass)}>
        {getNotificationIcon(item.type)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
            {item.title}
          </h2>
          <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-semibold', severityClass)}>
            {getManagerNotificationStatusLabel(item.status)}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {item.message}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-500">
          <span>{item.sourceCode}</span>
          {item.branchName && <span>{item.branchName}</span>}
          <span>{formatManagerNotificationDate(item.createdAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-400">
        <span className="hidden sm:inline">{item.actionLabel}</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}
