import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { adminManagersApi } from '@/lib/api/adminManagersApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { ImpersonationProvider, useImpersonation } from '../ImpersonationContext';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/api/adminManagersApi', () => ({
  adminManagersApi: {
    impersonateUser: jest.fn(),
    stopImpersonation: jest.fn(),
  },
}));
jest.mock('@/lib/toast', () => ({
  showToast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));

describe('ImpersonationContext', () => {
  const originalUser = {
    userId: 'super-admin-id',
    id: 'super-admin-id',
    email: 'superadmin@raho.id',
    fullName: 'Super Admin',
    role: 'SUPER_ADMIN' as const,
    branchId: null,
    branchCode: null,
    staffCode: null,
  };
  const manager = {
    id: 'manager-id',
    email: 'manager@raho.id',
    fullName: 'Admin Manager',
    role: 'ADMIN_MANAGER',
    branchId: null,
    branchCode: null,
    adminManagerAccessScope: 'FULL' as const,
  };
  const branchAdmin = {
    id: 'branch-admin-id',
    email: 'branch@raho.id',
    fullName: 'Admin Cabang',
    role: 'ADMIN_CABANG',
    branchId: 'branch-1',
    branchCode: 'B001',
  };
  const setAuth = jest.fn();
  const router = { push: jest.fn() };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ImpersonationProvider>{children}</ImpersonationProvider>
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
    document.cookie = 'raho-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    (useRouter as jest.Mock).mockReturnValue(router);
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: originalUser,
      accessToken: 'original-access-token',
      refreshToken: 'refresh-token',
      setAuth,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts with an empty impersonation state', () => {
    const { result } = renderHook(() => useImpersonation(), { wrapper });

    expect(result.current).toMatchObject({
      isImpersonating: false,
      originalUser: null,
      impersonatedUser: null,
      impersonationChain: [],
      loading: false,
      error: null,
    });
  });

  it('restores a valid persisted impersonation state', async () => {
    localStorage.setItem('impersonation', JSON.stringify({
      originalUser,
      impersonatedUser: manager,
      chain: [
        { userId: originalUser.userId, email: originalUser.email, role: originalUser.role },
        { userId: manager.id, email: manager.email, role: manager.role },
      ],
    }));

    const { result } = renderHook(() => useImpersonation(), { wrapper });

    await waitFor(() => expect(result.current.isImpersonating).toBe(true));
    expect(result.current.impersonatedUser).toEqual(manager);
    expect(result.current.impersonationChain).toHaveLength(2);
  });

  it('removes corrupted persisted state', () => {
    localStorage.setItem('impersonation', '{invalid-json');

    renderHook(() => useImpersonation(), { wrapper });

    expect(localStorage.getItem('impersonation')).toBeNull();
  });

  it('starts single-level impersonation using the canonical API response', async () => {
    (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
      token: 'manager-token',
      targetUser: manager,
    });
    const { result } = renderHook(() => useImpersonation(), { wrapper });

    await act(async () => {
      await result.current.startImpersonation(manager.id, 'ADMIN_MANAGER');
    });

    expect(adminManagersApi.impersonateUser).toHaveBeenCalledWith(manager.id, 'ADMIN_MANAGER');
    expect(setAuth).toHaveBeenCalledWith(
      expect.objectContaining({ userId: manager.id, role: manager.role }),
      { accessToken: 'manager-token', refreshToken: 'refresh-token' },
    );
    expect(result.current.impersonationChain.map((item) => item.role)).toEqual([
      'SUPER_ADMIN',
      'ADMIN_MANAGER',
    ]);
    expect(result.current.impersonatedUser).toEqual(manager);
    expect(result.current.isImpersonating).toBe(true);
    expect(router.push).toHaveBeenCalledWith('/dashboard');
    expect(showToast.success).toHaveBeenCalledWith('Berhasil masuk sebagai Admin Manager');
    expect(document.cookie).toContain('raho-auth-token=');

    const persisted = JSON.parse(localStorage.getItem('impersonation') || '{}');
    expect(persisted.chain).toHaveLength(2);
    expect(persisted.previousToken).toBe('original-access-token');
  });

  it('tracks nested impersonation without duplicating the current user', async () => {
    (adminManagersApi.impersonateUser as jest.Mock)
      .mockResolvedValueOnce({ token: 'manager-token', targetUser: manager })
      .mockResolvedValueOnce({ token: 'branch-token', targetUser: branchAdmin });
    const { result } = renderHook(() => useImpersonation(), { wrapper });

    await act(async () => {
      await result.current.startImpersonation(manager.id, 'ADMIN_MANAGER');
    });
    await act(async () => {
      await result.current.startImpersonation(branchAdmin.id, 'ADMIN_CABANG');
    });

    expect(result.current.impersonationChain.map((item) => item.role)).toEqual([
      'SUPER_ADMIN',
      'ADMIN_MANAGER',
      'ADMIN_CABANG',
    ]);
    expect(result.current.impersonatedUser).toEqual(branchAdmin);
  });

  it('stops nested impersonation one level at a time', async () => {
    (adminManagersApi.impersonateUser as jest.Mock)
      .mockResolvedValueOnce({ token: 'manager-token', targetUser: manager })
      .mockResolvedValueOnce({ token: 'branch-token', targetUser: branchAdmin });
    (adminManagersApi.stopImpersonation as jest.Mock).mockResolvedValue({
      token: 'back-to-manager-token',
      user: manager,
    });
    const { result } = renderHook(() => useImpersonation(), { wrapper });

    await act(async () => {
      await result.current.startImpersonation(manager.id, 'ADMIN_MANAGER');
    });
    await act(async () => {
      await result.current.startImpersonation(branchAdmin.id, 'ADMIN_CABANG');
    });
    await act(async () => {
      await result.current.stopImpersonation();
    });

    expect(setAuth).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: manager.id, role: manager.role }),
      { accessToken: 'back-to-manager-token', refreshToken: 'refresh-token' },
    );
    expect(result.current.isImpersonating).toBe(true);
    expect(result.current.impersonatedUser).toEqual(manager);
    expect(result.current.impersonationChain).toHaveLength(2);
    expect(localStorage.getItem('impersonation')).not.toBeNull();
  });

  it('clears impersonation after returning to the original user', async () => {
    (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
      token: 'manager-token',
      targetUser: manager,
    });
    (adminManagersApi.stopImpersonation as jest.Mock).mockResolvedValue({
      token: 'original-token',
      user: { ...originalUser, id: originalUser.userId },
    });
    const { result } = renderHook(() => useImpersonation(), { wrapper });

    await act(async () => {
      await result.current.startImpersonation(manager.id, 'ADMIN_MANAGER');
    });
    await act(async () => {
      await result.current.stopImpersonation();
    });

    expect(setAuth).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: originalUser.userId, role: originalUser.role }),
      { accessToken: 'original-token', refreshToken: 'refresh-token' },
    );
    expect(result.current.isImpersonating).toBe(false);
    expect(result.current.impersonationChain).toEqual([]);
    expect(localStorage.getItem('impersonation')).toBeNull();
    expect(showToast.success).toHaveBeenCalledWith('Berhasil kembali ke akun asli');
  });

  it('exposes loading while an impersonation request is pending', async () => {
    let resolveRequest!: (value: unknown) => void;
    const request = new Promise((resolve) => { resolveRequest = resolve; });
    (adminManagersApi.impersonateUser as jest.Mock).mockReturnValue(request);
    const { result } = renderHook(() => useImpersonation(), { wrapper });
    let startPromise!: Promise<void>;

    act(() => {
      startPromise = result.current.startImpersonation(manager.id, 'ADMIN_MANAGER');
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveRequest({ token: 'manager-token', targetUser: manager });
      await startPromise;
    });
    expect(result.current.loading).toBe(false);
  });

  it('surfaces API errors and allows them to be cleared', async () => {
    const apiError = {
      response: { data: { message: 'Impersonation ditolak' } },
    };
    (adminManagersApi.impersonateUser as jest.Mock).mockRejectedValue(apiError);
    const { result } = renderHook(() => useImpersonation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.startImpersonation(manager.id, 'ADMIN_MANAGER'),
      ).rejects.toBe(apiError);
    });

    expect(result.current.error).toBe('Impersonation ditolak');
    expect(showToast.error).toHaveBeenCalledWith('Impersonation ditolak');

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
