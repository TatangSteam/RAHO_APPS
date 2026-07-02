import type { ManagerNotificationSeverity } from '@/lib/api/managerNotificationsApi';

export function formatManagerNotificationDate(value: string): string {
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

export function getManagerNotificationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'Menunggu Review',
    PAYMENT_UPLOADED: 'Bukti Pembayaran Diupload',
    RECEIVED_WITH_ISSUE: 'Diterima Bermasalah',
  };

  return labels[status] || status;
}

export function getManagerNotificationSeverityClass(
  severity: ManagerNotificationSeverity,
): string {
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
