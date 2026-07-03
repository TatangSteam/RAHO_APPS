'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalClassNames {
  modalOverlay: string;
  modalContent: string;
  modalHeader: string;
  modalBody: string;
  modalFooter: string;
  closeButton: string;
}

export interface ModalProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  classNames: ModalClassNames;
  footer?: ReactNode;
  closeLabel?: string;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  classNames,
  footer,
  closeLabel = 'Tutup modal',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className={classNames.modalOverlay} onClick={onClose}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={classNames.modalContent}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={classNames.modalHeader}>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            aria-label={closeLabel}
            className={classNames.closeButton}
            onClick={onClose}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div className={classNames.modalBody}>{children}</div>

        {footer && <div className={classNames.modalFooter}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
