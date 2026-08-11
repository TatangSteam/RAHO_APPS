import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { sessionApi } from '@/lib/sessionApi';
import { confirm, showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import type { SessionDetail } from '@/types/session';
import MemberSessionsTab from './MemberSessionsTab';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/sessionApi', () => ({
  sessionApi: {
    getMemberSessions: jest.fn(),
    deleteSession: jest.fn(),
  },
}));

jest.mock('@/lib/toast', () => ({
  confirm: { show: jest.fn() },
  showToast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  devError: jest.fn(),
}));

jest.mock('@/components/sessions/CreateSessionModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/members/SessionCountDisplay', () => ({
  __esModule: true,
  default: () => <div>Nomor sesi</div>,
}));

const mockedRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;
const mockedGetMemberSessions = sessionApi.getMemberSessions as jest.MockedFunction<typeof sessionApi.getMemberSessions>;
const mockedDeleteSession = sessionApi.deleteSession as jest.MockedFunction<typeof sessionApi.deleteSession>;
const mockedConfirm = confirm.show as jest.MockedFunction<typeof confirm.show>;
const mockedToastSuccess = showToast.success as jest.MockedFunction<typeof showToast.success>;

const pendingSession = {
  session: {
    sessionId: 'session-1',
    sessionCode: 'SES-001',
    treatmentDate: '2026-08-11T08:00:00.000Z',
    pelaksanaan: 'HOME_CARE',
    isCompleted: false,
    member: { memberId: 'member-1', memberNo: 'MBR-001', fullName: 'Member Test' },
    memberPackage: { packageId: 'basic-1', packageCode: 'BSC-001', packageType: 'BASIC' },
    boosterPackage: { packageId: 'booster-1', packageCode: 'BST-001', boosterType: 'HHO' },
    adminLayanan: { userId: 'admin-1', fullName: 'Admin Test' },
  },
  diagnosis: null,
  therapyPlan: null,
  vitalSigns: [],
  infusion: null,
  materials: [],
  evaluation: null,
} as unknown as SessionDetail;

describe('MemberSessionsTab session deletion', () => {
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    mockedUseAuthStore.mockReturnValue({
      user: { role: 'SUPER_ADMIN', adminManagerAccessScope: 'FULL' },
    });
    mockedGetMemberSessions
      .mockResolvedValueOnce([pendingSession])
      .mockResolvedValueOnce([]);
    mockedConfirm.mockResolvedValue(true);
    mockedDeleteSession.mockResolvedValue({
      sessionId: 'session-1',
      sessionCode: 'SES-001',
      restoredStockItems: 2,
      restoredStockQuantity: 2,
      restoredVouchers: { basic: 1, booster: 1 },
      message: 'Sesi berhasil dihapus',
    });
  });

  it('confirms deletion, returns vouchers and stock, then reloads the member sessions', async () => {
    const onDeleted = jest.fn().mockResolvedValue(undefined);
    render(
      <MemberSessionsTab
        memberId="member-1"
        memberNo="MBR-001"
        memberName="Member Test"
        onDeleted={onDeleted}
      />
    );

    const deleteButton = await screen.findByRole('button', { name: 'Hapus sesi SES-001' });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockedDeleteSession).toHaveBeenCalledWith('session-1');
    });
    expect(mockedConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Hapus Sesi Terapi',
      confirmText: 'Hapus & Kembalikan',
    }));
    expect(mockedGetMemberSessions).toHaveBeenCalledTimes(2);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(mockedToastSuccess).toHaveBeenCalledWith(
      'Sesi berhasil dihapus. voucher Basic dan Booster serta stok telah dikembalikan.'
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('does not offer deletion to member-view-only managers', async () => {
    mockedUseAuthStore.mockReturnValue({
      user: { role: 'ADMIN_MANAGER', adminManagerAccessScope: 'MEMBER_VIEW_ONLY' },
    });
    mockedGetMemberSessions.mockReset();
    mockedGetMemberSessions.mockResolvedValue([pendingSession]);

    render(
      <MemberSessionsTab
        memberId="member-1"
        memberNo="MBR-001"
        memberName="Member Test"
      />
    );

    await screen.findByText('SES-001');
    expect(screen.queryByRole('button', { name: 'Hapus sesi SES-001' })).not.toBeInTheDocument();
  });
});
