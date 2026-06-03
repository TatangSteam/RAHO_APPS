'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, Info, HelpCircle, X, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'default';

export interface ConfirmOptions {
  title: string;
  message: string;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  icon?: React.ReactNode;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

// ═══════════════════════════════════════════════════════════════
// CONFIRM STORE
// ═══════════════════════════════════════════════════════════════

type ConfirmListener = (state: ConfirmState) => void;

class ConfirmStore {
  private state: ConfirmState = {
    isOpen: false,
    title: '',
    message: '',
    variant: 'default',
    resolve: null,
  };
  private listeners: Set<ConfirmListener> = new Set();

  subscribe(listener: ConfirmListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  show(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.state = {
        ...options,
        isOpen: true,
        resolve,
      };
      this.notify();
    });
  }

  confirm() {
    if (this.state.resolve) {
      this.state.resolve(true);
    }
    this.close();
  }

  cancel() {
    if (this.state.resolve) {
      this.state.resolve(false);
    }
    this.close();
  }

  private close() {
    this.state = {
      ...this.state,
      isOpen: false,
      resolve: null,
    };
    this.notify();
  }
}

export const confirmStore = new ConfirmStore();

// ═══════════════════════════════════════════════════════════════
// CONFIRM API (Public interface)
// ═══════════════════════════════════════════════════════════════

export const confirm = {
  show: (options: ConfirmOptions) => confirmStore.show(options),
  
  delete: (itemName: string) => confirmStore.show({
    title: 'Konfirmasi Hapus',
    message: `Apakah Anda yakin ingin menghapus "${itemName}"? Tindakan ini tidak dapat dibatalkan.`,
    variant: 'danger',
    confirmText: 'Hapus',
    cancelText: 'Batal',
    icon: <Trash2 size={24} />,
  }),

  warning: (title: string, message: string) => confirmStore.show({
    title,
    message,
    variant: 'warning',
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
  }),

  info: (title: string, message: string) => confirmStore.show({
    title,
    message,
    variant: 'info',
    confirmText: 'OK',
    cancelText: 'Batal',
  }),

  action: (title: string, message: string, confirmText: string = 'Konfirmasi') => confirmStore.show({
    title,
    message,
    variant: 'default',
    confirmText,
    cancelText: 'Batal',
  }),
};

// ═══════════════════════════════════════════════════════════════
// CONFIRM DIALOG COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'default',
    resolve: null,
  });
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = confirmStore.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, []);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 150));
    setIsClosing(true);
    setTimeout(() => {
      confirmStore.confirm();
      setIsClosing(false);
      setLoading(false);
    }, 200);
  }, []);

  const handleCancel = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      confirmStore.cancel();
      setIsClosing(false);
    }, 200);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen, handleCancel]);

  if (!mounted || !state.isOpen) return null;

  const variantConfig = {
    danger: {
      icon: state.icon || <Trash2 size={24} />,
      iconBg: 'bg-red-100 dark:bg-red-500/15',
      iconColor: 'text-red-600 dark:text-red-400',
      confirmBtnClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: state.icon || <AlertTriangle size={24} />,
      iconBg: 'bg-amber-100 dark:bg-amber-500/15',
      iconColor: 'text-amber-600 dark:text-amber-400',
      confirmBtnClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
    },
    info: {
      icon: state.icon || <Info size={24} />,
      iconBg: 'bg-blue-100 dark:bg-blue-500/15',
      iconColor: 'text-blue-600 dark:text-blue-400',
      confirmBtnClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
    default: {
      icon: state.icon || <HelpCircle size={24} />,
      iconBg: 'bg-neutral-100 dark:bg-neutral-700',
      iconColor: 'text-neutral-600 dark:text-neutral-400',
      confirmBtnClass: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500',
    },
  };

  const config = variantConfig[state.variant || 'default'];

  return createPortal(
    <div 
      className={`
        fixed inset-0 z-[99999] flex items-center justify-center p-4
        transition-all duration-200
        ${isClosing ? 'opacity-0' : 'opacity-100'}
      `}
      onClick={handleCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
      
      {/* Dialog */}
      <div 
        className={`
          relative bg-white dark:bg-neutral-900 
          border border-neutral-200 dark:border-neutral-800
          rounded-2xl shadow-2xl
          w-full max-w-md
          transform transition-all duration-200
          ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-full ${config.iconBg} ${config.iconColor} flex items-center justify-center mx-auto mb-4`}>
            {config.icon}
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white text-center mb-2">
            {state.title}
          </h3>

          {/* Message */}
          <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center leading-relaxed">
            {state.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 pt-0">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all disabled:opacity-50"
          >
            {state.cancelText || 'Batal'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-neutral-900 disabled:opacity-70 flex items-center justify-center gap-2 ${state.confirmButtonClass || config.confirmBtnClass}`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              state.confirmText || 'Konfirmasi'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmDialog;
