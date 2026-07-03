import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BranchModal } from './BranchModal';

afterEach(cleanup);

describe('BranchModal', () => {
  it('renders branch-specific title, subtitle, fields, and actions', () => {
    render(
      <BranchModal
        open
        title="Tambah Cabang"
        subtitle="Buat cabang baru"
        submitting={false}
        submitText="Buat Cabang"
        submittingText="Membuat..."
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      >
        <label htmlFor="branch-name">Nama Cabang</label>
        <input id="branch-name" />
      </BranchModal>,
    );

    expect(screen.getByRole('dialog', { name: 'Tambah Cabang' })).toBeVisible();
    expect(screen.getByText('Buat cabang baru')).toBeVisible();
    expect(screen.getByLabelText('Nama Cabang')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Buat Cabang' })).toBeVisible();
  });

  it('submits through the shared footer and locks close actions while submitting', () => {
    const onSubmit = jest.fn((event) => event.preventDefault());
    const { rerender } = render(
      <BranchModal
        open
        title="Edit Cabang"
        subtitle="JKT - Jakarta"
        submitting={false}
        submitText="Simpan Perubahan"
        submittingText="Menyimpan..."
        onClose={jest.fn()}
        onSubmit={onSubmit}
      >
        Form cabang
      </BranchModal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <BranchModal
        open
        title="Edit Cabang"
        subtitle="JKT - Jakarta"
        submitting
        submitText="Simpan Perubahan"
        submittingText="Menyimpan..."
        onClose={jest.fn()}
        onSubmit={onSubmit}
      >
        Form cabang
      </BranchModal>,
    );

    expect(screen.getByRole('button', { name: 'Menyimpan...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tutup modal' })).toBeDisabled();
  });
});
