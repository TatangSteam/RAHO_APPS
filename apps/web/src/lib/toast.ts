import toast from 'react-hot-toast';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
      },
    });
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
      position: 'top-right',
      style: {
        background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        color: '#991b1b',
        border: '2px solid #ef4444',
        borderLeft: '6px solid #dc2626',
        padding: '16px 20px',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
        maxWidth: '420px',
        minWidth: '320px',
      },
      icon: '⚠️',
      iconTheme: {
        primary: '#ef4444',
        secondary: '#fff',
      },
    });
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--surface-border)',
      },
    });
  },

  dismiss: (toastId: string) => {
    toast.dismiss(toastId);
  },
};
