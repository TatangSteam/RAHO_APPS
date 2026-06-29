'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullPage?: boolean;
  variant?: 'default' | 'primary' | 'amber' | 'blue' | 'green';
}

export function LoadingSpinner({
  size = 'md',
  text,
  fullPage = false,
  variant = 'primary',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const variantColors = {
    default: 'text-neutral-600 dark:text-neutral-400',
    primary: 'text-amber-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    green: 'text-emerald-500',
  };

  const ringColors = {
    default: 'border-neutral-300 dark:border-neutral-600 border-t-neutral-600 dark:border-t-neutral-300',
    primary: 'border-amber-200 dark:border-amber-900 border-t-amber-500',
    amber: 'border-amber-200 dark:border-amber-900 border-t-amber-500',
    blue: 'border-blue-200 dark:border-blue-900 border-t-blue-500',
    green: 'border-emerald-200 dark:border-emerald-900 border-t-emerald-500',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Dual Ring Spinner */}
      <div className="relative">
        {/* Outer ring */}
        <div
          className={`${sizeClasses[size]} rounded-full border-3 ${ringColors[variant]} animate-spin`}
        />
        {/* Inner ring */}
        <div
          className={`absolute inset-1 ${size === 'xl' ? 'inset-2' : 'inset-1'} rounded-full border-2 ${ringColors[variant]} animate-spin`}
          style={{ animationDuration: '1.5s' }}
        />
        {/* Ping effect */}
        <div
          className={`absolute inset-0 ${sizeClasses[size]} rounded-full border-2 ${variant === 'default' ? 'border-neutral-300 dark:border-neutral-600' : `border-${variant === 'primary' || variant === 'amber' ? 'amber' : variant}-500/20`} animate-ping`}
          style={{ animationDuration: '2s' }}
        />
      </div>
      
      {/* Loading Text */}
      {text && (
        <div className="text-center">
          <p
            className={`font-semibold ${
              size === 'xl' ? 'text-lg' : size === 'lg' ? 'text-base' : 'text-sm'
            } ${variantColors[variant]}`}
          >
            {text}
          </p>
          {/* Animated Dots */}
          <div className="flex items-center justify-center gap-1 mt-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                variant === 'default'
                  ? 'bg-neutral-400'
                  : `bg-${variant === 'primary' || variant === 'amber' ? 'amber' : variant}-500`
              } animate-bounce`}
              style={{ animationDelay: '0ms' }}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                variant === 'default'
                  ? 'bg-neutral-400'
                  : `bg-${variant === 'primary' || variant === 'amber' ? 'amber' : variant}-500`
              } animate-bounce`}
              style={{ animationDelay: '150ms' }}
            />
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                variant === 'default'
                  ? 'bg-neutral-400'
                  : `bg-${variant === 'primary' || variant === 'amber' ? 'amber' : variant}-500`
              } animate-bounce`}
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Button Loading Spinner Component
interface ButtonLoadingProps {
  text?: string;
  size?: 'sm' | 'md';
}

export function ButtonLoading({ text = 'Memproses', size = 'md' }: ButtonLoadingProps) {
  const iconSize = size === 'sm' ? 16 : 20;
  
  return (
    <>
      {/* Dual Ring Spinner */}
      <div className="relative">
        <div className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} border-2 border-white/20 border-t-white rounded-full animate-spin`} />
        <div
          className={`absolute ${size === 'sm' ? 'inset-0.5 w-3 h-3' : 'inset-1 w-3 h-3'} border-2 border-white/30 border-b-white rounded-full animate-spin`}
          style={{ animationDuration: '1.5s' }}
        />
      </div>
      {/* Animated Dots Text */}
      <span className="flex items-center gap-1">
        {text}
        <span className="inline-flex gap-0.5 ml-0.5">
          <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </span>
    </>
  );
}

// Page Loading Component
interface PageLoadingProps {
  text?: string;
}

export function PageLoading({ text = 'Memuat data' }: PageLoadingProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-20 text-center">
      <LoadingSpinner size="xl" text={text} variant="primary" />
    </div>
  );
}

export default LoadingSpinner;
