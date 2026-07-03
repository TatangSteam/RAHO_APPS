import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal, type ModalClassNames } from './Modal';

const classNames: ModalClassNames = {
  modalOverlay: 'modal-overlay',
  modalContent: 'modal-content',
  modalHeader: 'modal-header',
  modalBody: 'modal-body',
  modalFooter: 'modal-footer',
  closeButton: 'close-button',
};

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('does not render dialog content while closed', () => {
    render(
      <Modal open={false} title="Edit Paket" onClose={jest.fn()} classNames={classNames}>
        Konten modal
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, content, and footer in a portal while locking body scroll', () => {
    render(
      <Modal
        open
        title="Edit Paket"
        onClose={jest.fn()}
        classNames={classNames}
        footer={<button type="button">Simpan</button>}
      >
        Konten modal
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Edit Paket' })).toBeVisible();
    expect(screen.getByText('Konten modal')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeVisible();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes from the close button, backdrop, and Escape key', () => {
    const onClose = jest.fn();
    render(
      <Modal open title="Edit Paket" onClose={onClose} classNames={classNames}>
        Konten modal
      </Modal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tutup modal' }));
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
