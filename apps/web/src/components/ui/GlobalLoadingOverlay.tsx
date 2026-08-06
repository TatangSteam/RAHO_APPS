'use client';

import { useLoading } from '@/contexts/LoadingContext';

export function GlobalLoadingOverlay() {
  const { isGlobalLoading, loadingMessage, apiLoadingCount } = useLoading();

  // Show overlay if global loading or if there are active API calls
  const shouldShow = isGlobalLoading || apiLoadingCount > 0;

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4 bg-white dark:bg-neutral-900 rounded-2xl p-8 shadow-2xl border border-neutral-200 dark:border-neutral-800">
        {/* Dual Ring Spinner */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-200 dark:border-amber-900 border-t-amber-500 rounded-full animate-spin" />
          <div className="absolute inset-2 w-12 h-12 border-4 border-amber-200 dark:border-amber-900 border-b-amber-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
          <div className="absolute inset-0 w-16 h-16 border-4 border-amber-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        
        {/* Loading Text */}
        <div className="text-center">
          <p className="text-lg font-semibold text-amber-500 mb-1">{loadingMessage}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-1">
            Mohon tunggu sebentar
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </p>
          {apiLoadingCount > 1 && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
              {apiLoadingCount} proses berjalan
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
