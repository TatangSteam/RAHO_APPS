import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardLoadingColor = 'blue' | 'amber' | 'violet';

const spinnerClasses: Record<DashboardLoadingColor, string> = {
  blue: 'text-blue-500',
  amber: 'text-amber-500',
  violet: 'text-violet-500',
};

interface DashboardLoadingStateProps {
  text?: string;
  color?: DashboardLoadingColor;
}

export function DashboardLoadingState({ text, color = 'amber' }: DashboardLoadingStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-[#0a0a0a] md:p-6">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className={cn('h-10 w-10 animate-spin', spinnerClasses[color])} />
        {text && <p className="text-neutral-500 dark:text-neutral-400">{text}</p>}
      </div>
    </div>
  );
}
