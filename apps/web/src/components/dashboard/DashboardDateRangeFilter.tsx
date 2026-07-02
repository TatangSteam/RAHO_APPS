import { DASHBOARD_DATE_RANGE_OPTIONS, type DashboardDateRange } from '@/lib/dashboardPresentation';
import { cn } from '@/lib/utils';

type DateRangeAccent = 'blue' | 'violet';

const activeClasses: Record<DateRangeAccent, string> = {
  blue: 'bg-blue-500 text-white shadow-sm',
  violet: 'bg-violet-500 text-white shadow-sm',
};

interface DashboardDateRangeFilterProps {
  value: DashboardDateRange;
  onChange: (range: DashboardDateRange) => void;
  accent?: DateRangeAccent;
}

export function DashboardDateRangeFilter({
  value,
  onChange,
  accent = 'blue',
}: DashboardDateRangeFilterProps) {
  return (
    <div className="flex gap-2 rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
      {DASHBOARD_DATE_RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-all',
            value === option.value
              ? activeClasses[accent]
              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
