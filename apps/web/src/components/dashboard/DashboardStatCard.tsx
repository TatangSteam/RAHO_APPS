import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { dashboardStatColorClasses, type DashboardStatColor } from '@/lib/dashboardPresentation';

interface DashboardStatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color: DashboardStatColor;
  className?: string;
  valueClassName?: string;
}

export function DashboardStatCard({
  icon,
  label,
  value,
  subtitle,
  color,
  className,
  valueClassName,
}: DashboardStatCardProps) {
  const colorClasses = dashboardStatColorClasses[color];

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5', colorClasses.card, className)}>
      <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-xl', colorClasses.icon)}>
        {icon}
      </div>
      <div className={cn('mb-1 text-2xl font-bold text-neutral-900 dark:text-white md:text-3xl', valueClassName)}>
        {value}
      </div>
      <div className="text-sm text-neutral-600 dark:text-neutral-400">{label}</div>
      {subtitle && <div className="mt-1 text-xs text-neutral-500">{subtitle}</div>}
    </div>
  );
}
