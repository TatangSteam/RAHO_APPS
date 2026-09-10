import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CoordinatorAssignmentManager } from './CoordinatorAssignmentManager';
import { usersApi } from '@/lib/usersApi';

jest.mock('@/lib/usersApi', () => ({
  usersApi: {
    getChsCoordinatorAssignments: jest.fn(),
    getChsCoordinatorAssignmentOptions: jest.fn(),
    createChsCoordinatorBranchAssignments: jest.fn(),
    createChsCoordinatorAssignment: jest.fn(),
    updateChsCoordinatorAssignment: jest.fn(),
    deactivateChsCoordinatorAssignment: jest.fn(),
  },
}));

jest.mock('@/lib/toast', () => ({
  showToast: { success: jest.fn(), error: jest.fn() },
}));

const mockUsersApi = usersApi as jest.Mocked<typeof usersApi>;

describe('CoordinatorAssignmentManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersApi.getChsCoordinatorAssignments.mockResolvedValue([]);
    mockUsersApi.getChsCoordinatorAssignmentOptions.mockResolvedValue({
      staff: [{
        id: 'user-1',
        fullName: 'Koordinator Utama',
        email: 'koordinator@raho.id',
        staffCode: 'STF-001',
        role: 'NURSE',
      }],
      branches: [
        { id: 'branch-1', branchCode: 'JKT', name: 'Cabang Jakarta' },
        { id: 'branch-2', branchCode: 'BDG', name: 'Cabang Bandung' },
      ],
      teams: [],
    });
    mockUsersApi.createChsCoordinatorBranchAssignments.mockResolvedValue([]);
  });

  it('selects a coordinator first and assigns that person to multiple branches', async () => {
    const onChanged = jest.fn();
    render(<CoordinatorAssignmentManager month="2026-09" onChanged={onChanged} />);

    await waitFor(() => expect(screen.getByText('Koordinator Utama (NURSE)')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('combobox', { name: 'Koordinator CHS' }), {
      target: { value: 'user-1' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Cabang Jakarta/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cabang Bandung/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tetapkan 2 cabang' }));

    await waitFor(() => {
      expect(mockUsersApi.createChsCoordinatorBranchAssignments).toHaveBeenCalledWith({
        coordinatorUserId: 'user-1',
        branchIds: ['branch-1', 'branch-2'],
        effectiveFrom: '2026-09-01',
        effectiveUntil: undefined,
        notes: undefined,
      });
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
