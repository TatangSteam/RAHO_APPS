'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Modal, type ModalClassNames } from '@/components/ui/Modal';
import styles from '@/styles/crud-modal.module.css';

const crudModalClassNames: ModalClassNames = {
  modalOverlay: styles.modalOverlay,
  modalContent: styles.modalContent,
  modalHeader: styles.modalHeader,
  modalBody: styles.modalForm,
  modalFooter: styles.modalActions,
  closeButton: styles.closeButton,
};

interface CrudModalProps {
  children: ReactNode;
  contentStyle?: CSSProperties;
  icon: ReactNode;
  open: boolean;
  title: ReactNode;
  onClose: () => void;
}

export function CrudModal({
  children,
  contentStyle,
  icon,
  open,
  title,
  onClose,
}: CrudModalProps) {
  return (
    <Modal
      classNames={crudModalClassNames}
      contentStyle={contentStyle}
      headerIcon={icon}
      open={open}
      title={title}
      titleContainerClassName={styles.modalTitle}
      wrapBody={false}
      onClose={onClose}
    >
      {children}
    </Modal>
  );
}
