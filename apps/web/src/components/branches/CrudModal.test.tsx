import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Package } from 'lucide-react';
import { CrudModal } from './CrudModal';

afterEach(cleanup);

describe('CrudModal', () => {
  it('renders the shared CRUD shell and forwards close actions', () => {
    const onClose = jest.fn();

    render(
      <CrudModal
        icon={<Package data-testid="crud-icon" />}
        open
        title="Tambah Item"
        onClose={onClose}
      >
        <form aria-label="Form item">Fields</form>
      </CrudModal>,
    );

    expect(screen.getByRole('dialog', { name: 'Tambah Item' })).toBeVisible();
    expect(screen.getByTestId('crud-icon')).toBeVisible();
    expect(screen.getByRole('form', { name: 'Form item' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Tutup modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
