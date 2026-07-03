import { Modal, type ModalClassNames, type ModalProps } from '@/components/ui/Modal';
import styles from './PackageActionModal.module.css';

const modalClassNames: ModalClassNames = {
  modalOverlay: styles.modalOverlay,
  modalContent: styles.modalContent,
  modalHeader: styles.modalHeader,
  modalBody: styles.modalBody,
  modalFooter: styles.modalFooter,
  closeButton: styles.closeButton,
};

type PackageActionModalProps = Omit<ModalProps, 'classNames'>;

export function PackageActionModal(props: PackageActionModalProps) {
  return <Modal {...props} classNames={modalClassNames} />;
}
