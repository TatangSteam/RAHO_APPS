import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UnfinishedSessionReminderModal } from './UnfinishedSessionReminderModal';
import { sessionApi } from '@/lib/sessionApi';
import { useAuthStore } from '@/stores/authStore';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/sessionApi', () => ({
  sessionApi: {
    getUnfinishedSessionReminders: jest.fn(),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  devError: jest.fn(),
}));

describe('UnfinishedSessionReminderModal', () => {
  beforeEach(() => {
    push.mockReset();
    sessionStorage.clear();
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: {
        userId: 'admin-service-1',
        role: 'ADMIN_LAYANAN',
      },
      accessToken: 'token',
    });
    (sessionApi.getUnfinishedSessionReminders as jest.Mock).mockResolvedValue({
      total: 1,
      items: [{
        sessionId: 'session-1',
        sessionCode: 'SES-JKT-001',
        treatmentDate: '2026-08-21T03:00:00.000Z',
        kind: 'OPERATIONAL_STEPS',
        missingSteps: [{ key: 'VITAL_AFTER', label: 'Vital sign sesudah terapi' }],
        branch: { id: 'branch-1', name: 'Premier Jakarta', branchCode: 'JKT' },
        member: { memberId: 'member-1', memberNo: 'MBR-001', fullName: 'Siti Aminah' },
      }],
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('shows assigned unfinished work and opens the selected session', async () => {
    render(<UnfinishedSessionReminderModal />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Sesi terapi belum selesai')).toBeInTheDocument();
    expect(screen.getByText('Vital sign sesudah terapi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Siti Aminah/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/sessions/session-1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
