import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MemberPackage } from '@/types/package';
import VoucherBalanceEditModal from './VoucherBalanceEditModal';

describe('VoucherBalanceEditModal', () => {
  it('submits a corrected BOOSTER balance while displaying used sessions', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const boosterPackage = {
      packageId: 'booster-1',
      packageCode: 'PKG-BOOSTER-001',
      packageName: 'Booster NO 1X',
      packageType: 'BOOSTER',
      totalSessions: 17,
      usedSessions: 7,
      remainingSessions: 10,
      finalPrice: 17_000_000,
      status: 'ACTIVE',
      assignedBy: 'Admin',
      createdAt: '2026-09-04T00:00:00.000Z',
    } satisfies MemberPackage;

    render(
      <VoucherBalanceEditModal
        show
        packageType="BOOSTER"
        packages={[boosterPackage]}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Voucher BOOSTER' })).toBeVisible();
    expect(screen.getByText('Sesi terpakai:').closest('p')).toHaveTextContent('Sesi terpakai: 7');

    fireEvent.change(screen.getByLabelText(/Sisa voucher baru/i), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText(/Alasan perubahan/i), {
      target: { value: 'Koreksi saldo booster' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Voucher' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('booster-1', 12, 'Koreksi saldo booster');
    });
  });
});
