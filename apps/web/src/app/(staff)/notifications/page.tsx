'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
  Truck,
  Upload,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useManagerInventoryNotifications } from '@/hooks/useManagerInventoryNotifications';
import { useAuthStore } from '@/stores/authStore';
import type {
  ManagerNotificationItem,
  ManagerNotificationSeverity,
  ManagerNotificationType,
} from '@/lib/api/managerNotificationsApi';

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

function getSeverityClass(severity: ManagerNotificationSeverity) {
  switch (severity) {
    case 'danger':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
    case 'info':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300';
    case 'warning':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300';
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Menunggu Review',
    PAYMENT_UPLOADED: 'Bukti Pembayaran Diupload',
    RECEIVED_WITH_ISSUE: 'Diterima Bermasalah',
  };

  return labels[status] || status;
}

function NotificationRow({ item }: { item: ManagerNotificationItem }) {
  return (
    <Link
      href={item.href}
      className={clsx(
        'group flex items-start gap-4 rounded-lg border p-4 transition-all',
        'border-neutral-200 bg-white hover:border-amber-300 hover:bg-amber-50/40',
        'dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5',
      )}
    >
      <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', getSeverityClass(item.severity))}>
        {getNotificationIcon(item.type)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
            {item.title}
          </h2>
          <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-semibold', getSeverityClass(item.severity))}>
            {getStatusLabel(item.status)}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {item.message}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-500">
          <span>{item.sourceCode}</span>
          {item.branchName && <span>{item.branchName}</span>}
          <span>{formatDate(item.createdAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-amber-400">
        <span className="hidden sm:inline">{item.actionLabel}</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const isManager = user?.role === 'ADMIN_MANAGER';
  const enabled = mounted && Boolean(accessToken) && isManager;
  const { counts, items, loading, error, refresh } = useManagerInventoryNotifications(enabled, {
    pollMs: 60000,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user || !accessToken) {
      router.push('/login');
    }
  }, [mounted, user, accessToken, router]);

  if (!mounted || !user || !accessToken) {
    return null;
  }

  if (!isManager) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-neutral-950 dark:text-white">Notifikasi</h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Belum ada notifikasi khusus untuk role ini.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Request Stok Baru',
      value: counts.pendingStockRequests,
      icon: <Clock className="h-5 w-5" />,
      className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    },
    {
      label: 'Bukti Pembayaran',
      value: counts.uploadedPaymentRequests,
      icon: <Upload className="h-5 w-5" />,
      className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
    },
    {
      label: 'Pengiriman Bermasalah',
      value: counts.issueShipments,
      icon: <AlertTriangle className="h-5 w-5" />,
      className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            <Bell className="h-4 w-4" />
            <span>{counts.total} perlu ditindaklanjuti</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-neutral-950 dark:text-white">
            Notifikasi Admin Manager
          </h1>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className={clsx(
            'inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors',
            'border-neutral-200 bg-white text-neutral-700 hover:border-amber-300 hover:text-amber-700',
            'dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-amber-500/40 dark:hover:text-amber-400',
            loading && 'cursor-not-allowed opacity-70',
          )}
        >
          <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-950 dark:text-white">{card.value}</p>
              </div>
              <span className={clsx('flex h-10 w-10 items-center justify-center rounded-lg border', card.className)}>
                {card.icon}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-busy={loading}>
        {loading && items.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Memuat notifikasi...
            </div>
          </div>
        ) : items.length > 0 ? (
          items.map((item) => <NotificationRow key={item.id} item={item} />)
        ) : (
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
        )}
      </section>
    </div>
  );
}
