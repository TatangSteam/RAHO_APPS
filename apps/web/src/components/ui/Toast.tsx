'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastData {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const TOAST_DURATION_MS: Record<Exclude<ToastType, 'loading'>, number> = {
  success: 6000,
  error: 9000,
  warning: 9000,
  info: 6000,
};

// ═══════════════════════════════════════════════════════════════
// TOAST STORE (Simple state management)
// ═══════════════════════════════════════════════════════════════

type ToastListener = (toasts: ToastData[]) => void;

class ToastStore {
  private toasts: ToastData[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }

  add(toast: Omit<ToastData, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastData = {
      id,
      dismissible: true,
      duration: toast.type === 'loading' ? 0 : TOAST_DURATION_MS[toast.type],
      ...toast,
    };
    this.toasts = [...this.toasts, newToast];
    this.notify();

    // Auto dismiss
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => this.dismiss(id), newToast.duration);
    }

    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  dismissAll() {
    this.toasts = [];
    this.notify();
  }

  update(id: string, updates: Partial<Omit<ToastData, 'id'>>) {
    this.toasts = this.toasts.map(t => 
      t.id === id ? { ...t, ...updates } : t
    );
    this.notify();
  }
}

export const toastStore = new ToastStore();

// ═══════════════════════════════════════════════════════════════
// TOAST API (Public interface)
// ═══════════════════════════════════════════════════════════════

export const showToast = {
  success: (message: string, title?: string) => {
    return toastStore.add({ type: 'success', message, title });
  },
  error: (message: string, title?: string) => {
    return toastStore.add({ type: 'error', message, title: title || 'Error' });
  },
  warning: (message: string, title?: string) => {
    return toastStore.add({ type: 'warning', message, title: title || 'Peringatan' });
  },
  info: (message: string, title?: string) => {
    return toastStore.add({ type: 'info', message, title });
  },
  loading: (message: string, title?: string) => {
    return toastStore.add({ type: 'loading', message, title, dismissible: false, duration: 0 });
  },
  dismiss: (id: string) => {
    toastStore.dismiss(id);
  },
  dismissAll: () => {
    toastStore.dismissAll();
  },
  update: (id: string, updates: Partial<Omit<ToastData, 'id'>>) => {
    toastStore.update(id, updates);
  },
  promise: async <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ): Promise<T> => {
    const id = showToast.loading(messages.loading);
    try {
      const result = await promise;
      toastStore.update(id, { type: 'success', message: messages.success, duration: TOAST_DURATION_MS.success, dismissible: true });
      setTimeout(() => toastStore.dismiss(id), TOAST_DURATION_MS.success);
      return result;
    } catch (error) {
      toastStore.update(id, { type: 'error', message: messages.error, duration: TOAST_DURATION_MS.error, dismissible: true });
      setTimeout(() => toastStore.dismiss(id), TOAST_DURATION_MS.error);
      throw error;
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// TOAST ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const config = {
    success: {
      icon: CheckCircle2,
      bgClass: 'bg-emerald-50 dark:bg-emerald-950',
      borderClass: 'border-emerald-200 dark:border-emerald-700',
      iconClass: 'text-emerald-500',
      titleClass: 'text-emerald-800 dark:text-emerald-200',
      messageClass: 'text-emerald-700 dark:text-emerald-100',
      progressClass: 'bg-emerald-500',
    },
    error: {
      icon: XCircle,
      bgClass: 'bg-red-50 dark:bg-red-950',
      borderClass: 'border-red-200 dark:border-red-700',
      iconClass: 'text-red-500',
      titleClass: 'text-red-800 dark:text-red-200',
      messageClass: 'text-red-700 dark:text-red-100',
      progressClass: 'bg-red-500',
    },
    warning: {
      icon: AlertTriangle,
      bgClass: 'bg-amber-50 dark:bg-amber-950',
      borderClass: 'border-amber-200 dark:border-amber-700',
      iconClass: 'text-amber-500',
      titleClass: 'text-amber-800 dark:text-amber-200',
      messageClass: 'text-amber-700 dark:text-amber-100',
      progressClass: 'bg-amber-500',
    },
    info: {
      icon: Info,
      bgClass: 'bg-blue-50 dark:bg-blue-950',
      borderClass: 'border-blue-200 dark:border-blue-700',
      iconClass: 'text-blue-500',
      titleClass: 'text-blue-800 dark:text-blue-200',
      messageClass: 'text-blue-700 dark:text-blue-100',
      progressClass: 'bg-blue-500',
    },
    loading: {
      icon: Loader2,
      bgClass: 'bg-neutral-50 dark:bg-neutral-800',
      borderClass: 'border-neutral-200 dark:border-neutral-700',
      iconClass: 'text-amber-500 animate-spin',
      titleClass: 'text-neutral-800 dark:text-neutral-200',
      messageClass: 'text-neutral-600 dark:text-neutral-400',
      progressClass: 'bg-amber-500',
    },
  };

  const { icon: Icon, bgClass, borderClass, iconClass, titleClass, messageClass, progressClass } = config[toast.type];

  return (
    <div
      className={`
        relative overflow-hidden w-[380px] max-w-[calc(100vw-2rem)]
        ${bgClass} border ${borderClass}
        rounded-xl shadow-lg dark:shadow-2xl
        transform transition-all duration-200 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`flex-shrink-0 mt-0.5 ${iconClass}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className={`font-semibold text-sm mb-0.5 ${titleClass}`}>
              {toast.title}
            </h4>
          )}
          <p className={`text-sm ${messageClass}`}>
            {toast.message}
          </p>
        </div>
        {toast.dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X size={16} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" />
          </button>
        )}
      </div>
      
      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5">
          <div 
            className={`h-full ${progressClass} opacity-60`}
            style={{
              animation: `shrink ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOAST CONTAINER COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = toastStore.subscribe(setToasts);
    return () => {
      unsubscribe();
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div 
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-3"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onDismiss={(id) => toastStore.dismiss(id)} 
          />
        ))}
      </div>
    </>,
    document.body
  );
}

export default ToastContainer;
