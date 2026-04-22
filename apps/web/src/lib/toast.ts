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
      duration: 4000,
      position: 'top-right',
      style: {
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
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
