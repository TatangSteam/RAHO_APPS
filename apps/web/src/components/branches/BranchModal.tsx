import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal, type ModalClassNames } from '@/components/ui/Modal';
import styles from './BranchModal.module.css';

const modalClassNames: ModalClassNames = {
  modalOverlay: styles.modalBackdrop,
  modalContent: styles.modalContainer,
  modalHeader: styles.modalHeader,
  modalBody: styles.modalBody,
  modalFooter: styles.modalFooter,
  closeButton: styles.closeButton,
};

interface BranchModalProps {
  open: boolean;
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
  submitting: boolean;
  submitText: string;
  submittingText: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function BranchModal({
  open,
  title,
  subtitle,
  children,
  submitting,
  submitText,
  submittingText,
  onClose,
  onSubmit,
}: BranchModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      closeDisabled={submitting}
      classNames={modalClassNames}
      titleClassName={styles.modalTitle}
      subtitleClassName={styles.modalSubtitle}
      wrapBody={false}
    >
      <form onSubmit={onSubmit} className={styles.modalBody}>
        {children}

        <div className={styles.modalFooter}>
          <Button
            unstyled
            type="button"
            onClick={onClose}
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            unstyled
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={submitting}
          >
            {submitting ? submittingText : submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
