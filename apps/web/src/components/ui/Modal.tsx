'use client';

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

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
  closeDisabled?: boolean;
  contentStyle?: CSSProperties;
  headerIcon?: ReactNode;
  subtitle?: ReactNode;
  titleContainerClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  wrapBody?: boolean;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  classNames,
  footer,
  closeLabel = 'Tutup modal',
  closeDisabled = false,
  contentStyle,
  headerIcon,
  subtitle,
  titleContainerClassName,
  titleClassName,
  subtitleClassName,
  wrapBody = true,
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
      if (event.key === 'Escape' && !closeDisabled) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDisabled, onClose, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={classNames.modalOverlay}
      onClick={closeDisabled ? undefined : onClose}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={classNames.modalContent}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        style={contentStyle}
      >
        <div className={classNames.modalHeader}>
          <div className={titleContainerClassName}>
            {headerIcon}
            <div>
              <h2 className={titleClassName} id={titleId}>{title}</h2>
              {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
            </div>
          </div>
          <Button
            unstyled
            type="button"
            aria-label={closeLabel}
            className={classNames.closeButton}
            disabled={closeDisabled}
            onClick={onClose}
          >
            <X aria-hidden="true" size={20} />
          </Button>
        </div>

        {wrapBody ? <div className={classNames.modalBody}>{children}</div> : children}

        {footer && <div className={classNames.modalFooter}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
