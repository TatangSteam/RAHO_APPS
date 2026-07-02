import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardErrorActionColor = 'blue' | 'amber' | 'violet';

const buttonClasses: Record<DashboardErrorActionColor, string> = {
  blue: 'bg-blue-500 text-white hover:bg-blue-600',
  amber: 'bg-amber-500 text-black hover:bg-amber-600',
  violet: 'bg-violet-500 text-white hover:bg-violet-600',
};

interface DashboardErrorStateProps {
  message: string;
  onRetry: () => void;
  actionColor?: DashboardErrorActionColor;
}

export function DashboardErrorState({
  message,
  onRetry,
  actionColor = 'amber',
}: DashboardErrorStateProps) {
  return (
    <div className="min-h-screen bg-neutral-50 p-4 dark:bg-[#0a0a0a] md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <p className="mb-4 text-neutral-500">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className={cn('rounded-xl px-4 py-2 font-medium transition-colors', buttonClasses[actionColor])}
          >
            <RefreshCw className="mr-2 inline h-4 w-4" />
            Coba Lagi
          </button>
        </div>
      </div>
    </div>
  );
}
