'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

// ═══════════════════════════════════════════════════════════════
// ALERT COMPONENT
// ═══════════════════════════════════════════════════════════════

export function Alert({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className = '',
  icon,
}: AlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const config = {
    success: {
      icon: icon || <CheckCircle2 size={18} />,
      containerClass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      titleClass: 'text-emerald-800 dark:text-emerald-300',
      textClass: 'text-emerald-700 dark:text-emerald-400',
    },
    error: {
      icon: icon || <XCircle size={18} />,
      containerClass: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
      iconClass: 'text-red-600 dark:text-red-400',
      titleClass: 'text-red-800 dark:text-red-300',
      textClass: 'text-red-700 dark:text-red-400',
    },
    warning: {
      icon: icon || <AlertTriangle size={18} />,
      containerClass: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
      iconClass: 'text-amber-600 dark:text-amber-400',
      titleClass: 'text-amber-800 dark:text-amber-300',
      textClass: 'text-amber-700 dark:text-amber-400',
    },
    info: {
      icon: icon || <Info size={18} />,
      containerClass: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
      iconClass: 'text-blue-600 dark:text-blue-400',
      titleClass: 'text-blue-800 dark:text-blue-300',
      textClass: 'text-blue-700 dark:text-blue-400',
    },
  };

  const { icon: defaultIcon, containerClass, iconClass, titleClass, textClass } = config[variant];

  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${containerClass} ${className}`} role="alert">
      <div className={`flex-shrink-0 mt-0.5 ${iconClass}`}>
        {defaultIcon}
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`font-semibold text-sm mb-1 ${titleClass}`}>
            {title}
          </h4>
        )}
        <div className={`text-sm ${textClass}`}>
          {children}
        </div>
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${iconClass}`}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INLINE ALERT VARIANTS (Convenience components)
// ═══════════════════════════════════════════════════════════════

export function SuccessAlert(props: Omit<AlertProps, 'variant'>) {
  return <Alert variant="success" {...props} />;
}

export function ErrorAlert(props: Omit<AlertProps, 'variant'>) {
  return <Alert variant="error" {...props} />;
}

export function WarningAlert(props: Omit<AlertProps, 'variant'>) {
  return <Alert variant="warning" {...props} />;
}

export function InfoAlert(props: Omit<AlertProps, 'variant'>) {
  return <Alert variant="info" {...props} />;
}

export default Alert;
