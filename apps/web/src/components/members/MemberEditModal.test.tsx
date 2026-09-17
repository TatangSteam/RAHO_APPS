import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MemberEditModal from './MemberEditModal';
import { updateMemberApi } from '@/lib/membersApi';

jest.mock('@/lib/membersApi', () => ({ updateMemberApi: jest.fn(), createMemberApi: jest.fn() }));
jest.mock('@/lib/api/referralsApi', () => ({ getActiveReferrals: jest.fn().mockResolvedValue({ data: { data: [] } }) }));
jest.mock('@/lib/toast', () => ({ showToast: { success: jest.fn(), error: jest.fn() } }));

describe('Admin Manager member name editing', () => {
  const stored = { user: { email: 'legacy.member@example.test', phone: '081234567890' }, profile: { fullName: 'Nama Lama', phone: '081234567890', birthDate: '1990-01-15T00:00:00.000Z', gender: 'L' as const, address: 'Alamat lama', emergencyContact: 'Keluarga - 081234567899' } };
  beforeEach(() => { jest.clearAllMocks(); (updateMemberApi as jest.Mock).mockResolvedValue({ fullName: 'Nama Baru' }); });

  it('saves a corrected name without resending locked legacy username or other populated fields', async () => {
    const onSuccess = jest.fn(); const onClose = jest.fn();
    render(<MemberEditModal isOpen action="edit" userRole="ADMIN_MANAGER" branchId="branch-1" memberId="member-1" memberData={stored} onSuccess={onSuccess} onClose={onClose} />);
    const name = screen.getByPlaceholderText('Masukkan nama lengkap');
    expect(name).toBeEnabled();
    expect(screen.getByPlaceholderText('contoh: budi.santoso')).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Nama Baru' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(updateMemberApi).toHaveBeenCalledWith('member-1', { fullName: 'Nama Baru' }));
    expect(onSuccess).toHaveBeenCalledTimes(1); expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('also saves the name when an unchanged legacy phone is shorter than current phone validation', async () => {
    const legacy = { ...stored, user: { ...stored.user, phone: '08123' }, profile: { ...stored.profile, phone: '08123' } };
    render(<MemberEditModal isOpen action="edit" userRole="ADMIN_MANAGER" branchId="branch-1" memberId="member-1" memberData={legacy} onSuccess={jest.fn()} onClose={jest.fn()} />);
    const name = screen.getByPlaceholderText('Masukkan nama lengkap');
    fireEvent.change(name, { target: { value: 'Nama Baru' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(updateMemberApi).toHaveBeenCalledWith('member-1', { fullName: 'Nama Baru' }));
  });
});
