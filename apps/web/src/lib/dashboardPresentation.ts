export type DashboardDateRange = 'today' | 'week' | 'month';

export interface DashboardDateRangeOption {
  value: DashboardDateRange;
  label: string;
  description: string;
}

export const DASHBOARD_DATE_RANGE_OPTIONS: DashboardDateRangeOption[] = [
  { value: 'today', label: 'Hari Ini', description: 'Hari Ini' },
  { value: 'week', label: '7 Hari', description: '7 Hari Terakhir' },
  { value: 'month', label: 'Bulan Ini', description: 'Bulan Ini' },
];

export function getDashboardRangeLabel(range: DashboardDateRange): string {
  return DASHBOARD_DATE_RANGE_OPTIONS.find((option) => option.value === range)?.description ?? 'Bulan Ini';
}

export function getDashboardDateRange(range: DashboardDateRange, now = new Date()) {
  const endDate = new Date(now);
  const startDate = new Date(now);

  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setDate(1);
  }

  return { startDate, endDate };
}

export function getDashboardLoadErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as {
      response?: {
        data?: {
          message?: string;
          error?: {
            message?: string;
          };
        };
      };
    }).response;

    return response?.data?.error?.message || response?.data?.message || 'Gagal memuat dashboard';
  }

  return 'Gagal memuat dashboard';
}

export type DashboardStatColor =
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'pink'
  | 'cyan'
  | 'rose'
  | 'indigo'
  | 'violet'
  | 'red';

export const dashboardStatColorClasses: Record<DashboardStatColor, { card: string; icon: string }> = {
  blue: {
    card: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-500',
    icon: 'bg-blue-500/20',
  },
  emerald: {
    card: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-500',
    icon: 'bg-emerald-500/20',
  },
  amber: {
    card: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-500',
    icon: 'bg-amber-500/20',
  },
  purple: {
    card: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-500',
    icon: 'bg-purple-500/20',
  },
  pink: {
    card: 'from-pink-500/10 to-pink-500/5 border-pink-500/20 text-pink-500',
    icon: 'bg-pink-500/20',
  },
  cyan: {
    card: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 text-cyan-500',
    icon: 'bg-cyan-500/20',
  },
  rose: {
    card: 'from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-500',
    icon: 'bg-rose-500/20',
  },
  indigo: {
    card: 'from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 text-indigo-500',
    icon: 'bg-indigo-500/20',
  },
  violet: {
    card: 'from-violet-500/10 to-violet-500/5 border-violet-500/20 text-violet-500',
    icon: 'bg-violet-500/20',
  },
  red: {
    card: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-500',
    icon: 'bg-red-500/20',
  },
};
