'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 focus:ring-amber-500',
      secondary: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 focus:ring-neutral-500',
      danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 focus:ring-red-500',
      success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 focus:ring-emerald-500',
      outline: 'bg-transparent border-2 border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 focus:ring-amber-500',
      ghost: 'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:ring-neutral-500',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const loadingVariants = {
      primary: 'bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 bg-[length:200%_100%] animate-shimmer cursor-wait',
      secondary: 'cursor-wait',
      danger: 'bg-gradient-to-r from-red-600 via-red-400 to-red-600 bg-[length:200%_100%] animate-shimmer cursor-wait',
      success: 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 bg-[length:200%_100%] animate-shimmer cursor-wait',
      outline: 'cursor-wait',
      ghost: 'cursor-wait',
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          loading && loadingVariants[variant],
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <>
            {/* Dual Ring Spinner */}
            <div className="relative">
              <div className={cn(
                'border-2 rounded-full animate-spin',
                size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4',
                variant === 'primary' || variant === 'danger' || variant === 'success'
                  ? 'border-white/20 border-t-white'
                  : 'border-neutral-400/20 border-t-neutral-600 dark:border-neutral-600/20 dark:border-t-neutral-300'
              )} />
              <div className={cn(
                'absolute border-2 rounded-full animate-spin',
                size === 'sm' ? 'inset-0.5 w-2 h-2' : size === 'lg' ? 'inset-1 w-3 h-3' : 'inset-0.5 w-3 h-3',
                variant === 'primary' || variant === 'danger' || variant === 'success'
                  ? 'border-white/30 border-b-white'
                  : 'border-neutral-400/30 border-b-neutral-600 dark:border-neutral-600/30 dark:border-b-neutral-300'
              )} style={{ animationDuration: '1.5s' }} />
            </div>
            {/* Loading Text with Animated Dots */}
            <span className="flex items-center gap-1">
              {loadingText || children}
              <span className="inline-flex gap-0.5">
                <span className={cn(
                  'rounded-full animate-bounce',
                  size === 'sm' ? 'w-0.5 h-0.5' : 'w-1 h-1',
                  variant === 'primary' || variant === 'danger' || variant === 'success'
                    ? 'bg-white'
                    : 'bg-neutral-600 dark:bg-neutral-300'
                )} style={{ animationDelay: '0ms' }} />
                <span className={cn(
                  'rounded-full animate-bounce',
                  size === 'sm' ? 'w-0.5 h-0.5' : 'w-1 h-1',
                  variant === 'primary' || variant === 'danger' || variant === 'success'
                    ? 'bg-white'
                    : 'bg-neutral-600 dark:bg-neutral-300'
                )} style={{ animationDelay: '150ms' }} />
                <span className={cn(
                  'rounded-full animate-bounce',
                  size === 'sm' ? 'w-0.5 h-0.5' : 'w-1 h-1',
                  variant === 'primary' || variant === 'danger' || variant === 'success'
                    ? 'bg-white'
                    : 'bg-neutral-600 dark:bg-neutral-300'
                )} style={{ animationDelay: '300ms' }} />
              </span>
            </span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
            {children}
            {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
