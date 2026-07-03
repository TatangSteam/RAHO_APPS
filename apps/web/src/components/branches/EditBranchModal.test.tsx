import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditBranchModal from './EditBranchModal';
import { branchesApi, type Branch } from '@/lib/api/branchesApi';
import { wilayahApi } from '@/lib/api/wilayahApi';

jest.mock('@/lib/api/branchesApi', () => ({
  branchesApi: {
    updateBranch: jest.fn(),
  },
}));

jest.mock('@/lib/api/wilayahApi', () => ({
  wilayahApi: {
    getProvinces: jest.fn(),
    getRegencies: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  getApiErrorMessage: jest.fn(() => 'Gagal mengupdate cabang'),
}));

jest.mock('@/lib/toast', () => ({
  showToast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  devError: jest.fn(),
}));

const branch: Branch = {
  id: 'branch-1',
  branchCode: 'PST',
  name: 'Cabang Pusat',
  address: 'Jalan Utama 1',
  city: 'Jakarta',
  phone: '02112345678',
  type: 'PUSAT',
  operatingHours: '08:00-17:00',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const defaultProps = {
  show: true,
  branch,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
};

describe('EditBranchModal branch code access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (branchesApi.updateBranch as jest.Mock).mockResolvedValue({});
    (wilayahApi.getProvinces as jest.Mock).mockResolvedValue([
      { code: '31', name: 'DKI Jakarta' },
    ]);
    (wilayahApi.getRegencies as jest.Mock).mockResolvedValue([
      { code: '31.71', name: 'Kota Jakarta Selatan' },
    ]);
  });

  afterEach(cleanup);

  it('keeps the branch code read-only for an admin manager', () => {
    render(<EditBranchModal {...defaultProps} canEditBranchCode={false} />);

    expect(screen.getByLabelText('Kode Cabang')).toBeDisabled();
    expect(screen.queryByLabelText('Buat kode otomatis sesuai kode wilayah baru')).not.toBeInTheDocument();
  });

  it('submits a manual branch-code change for a super admin', async () => {
    render(<EditBranchModal {...defaultProps} canEditBranchCode />);

    fireEvent.change(screen.getByLabelText('Kode Cabang'), {
      target: { value: 'jkt01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/ }));

    await waitFor(() => {
      expect(branchesApi.updateBranch).toHaveBeenCalledWith(
        'branch-1',
        expect.objectContaining({ branchCode: 'JKT01' })
      );
    });
  });

  it('submits the selected regional code in automatic mode', async () => {
    render(<EditBranchModal {...defaultProps} canEditBranchCode />);

    fireEvent.click(screen.getByLabelText('Buat kode otomatis sesuai kode wilayah baru'));

    await waitFor(() => expect(wilayahApi.getProvinces).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Provinsi'), { target: { value: '31' } });

    await waitFor(() => expect(wilayahApi.getRegencies).toHaveBeenCalledWith('31'));
    fireEvent.change(screen.getByLabelText('Kabupaten/Kota'), {
      target: { value: '31.71' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Simpan Perubahan/ }));

    await waitFor(() => {
      expect(branchesApi.updateBranch).toHaveBeenCalledWith(
        'branch-1',
        expect.objectContaining({
          autoGenerateBranchCode: true,
          provinceCode: '31',
          regencyCode: '31.71',
        })
      );
    });
  });
});
