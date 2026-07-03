'use client';

import type { ReactNode } from 'react';
import { Modal, type ModalClassNames } from '@/components/ui/Modal';

const sizeClasses = {
  lg: 'max-w-lg',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
} as const;

interface ShipmentModalProps {
  children: ReactNode;
  icon: ReactNode;
  iconClassName: string;
  open: boolean;
  subtitle: ReactNode;
  title: ReactNode;
  onClose: () => void;
  bodyClassName?: string;
  closeDisabled?: boolean;
  footer?: ReactNode;
  footerClassName?: string;
  size?: keyof typeof sizeClasses;
  wrapBody?: boolean;
}

export function ShipmentModal({
  bodyClassName = 'flex-1 overflow-y-auto p-6 space-y-5',
  children,
  closeDisabled = false,
  footer,
  footerClassName = 'flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0',
  icon,
  iconClassName,
  open,
  size = '3xl',
  subtitle,
  title,
  wrapBody = true,
  onClose,
}: ShipmentModalProps) {
  const classNames: ModalClassNames = {
    modalOverlay: 'fixed inset-0 z-[9999] overflow-hidden flex min-h-full items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity',
    modalContent: `relative w-full ${sizeClasses[size]} bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all max-h-[90vh] overflow-hidden flex flex-col`,
    modalHeader: 'flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0',
    modalBody: bodyClassName,
    modalFooter: footerClassName,
    closeButton: 'rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed',
  };

  return (
    <Modal
      classNames={classNames}
      closeDisabled={closeDisabled}
      headerIcon={(
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${iconClassName}`}>
          {icon}
        </div>
      )}
      open={open}
      subtitle={subtitle}
      subtitleClassName="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5"
      title={title}
      titleClassName="text-xl font-bold text-neutral-900 dark:text-white"
      titleContainerClassName="flex items-center gap-4"
      wrapBody={wrapBody}
      footer={footer}
      onClose={onClose}
    >
      {children}
    </Modal>
  );
}
