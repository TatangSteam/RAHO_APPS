import { renderHook, act, waitFor } from '@testing-library/react';
import { ImpersonationProvider, useImpersonation } from '../ImpersonationContext';
import { useAuthStore } from '@/stores/authStore';
import { adminManagersApi } from '@/lib/api/adminManagersApi';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/api/adminManagersApi', () => ({
  adminManagersApi: {
    impersonateUser: jest.fn(),
    stopImpersonation: jest.fn(),
  },
}));

describe('ImpersonationContext - State Management', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  const mockAuthStore = {
    user: {
      id: 'super-admin-id',
      email: 'superadmin@raho.id',
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
    accessToken: null,
    refreshToken: 'refresh-token',
    setAccessToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuthStore as unknown as jest.Mock).mockReturnValue(mockAuthStore);
    (useAuthStore as any).getState = jest.fn().mockReturnValue(mockAuthStore);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ImpersonationProvider>{children}</ImpersonationProvider>
  );

  describe('Initial State', () => {
    it('should have correct initial state structure', () => {
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

    it('should have all required state fields', () => {
      const { result } = renderHook(() => useImpersonation(), { wrapper });

      // Verify all required fields exist
      expect(result.current).toHaveProperty('isImpersonating');
      expect(result.current).toHaveProperty('originalUser');
      expect(result.current).toHaveProperty('impersonatedUser');
      expect(result.current).toHaveProperty('impersonationChain');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
    });
  });

  describe('Single Level Impersonation (Super Admin → Admin Manager)', () => {
    it('should update state correctly when starting impersonation', async () => {
      const mockToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: mockToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1', 'branch-2'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Verify state updates
      expect(result.current.isImpersonating).toBe(true);
      expect(result.current.originalUser).toEqual(mockAuthStore.user);
      expect(result.current.impersonatedUser).toMatchObject({
        id: 'manager-id',
        email: 'manager@raho.id',
        fullName: 'Admin Manager',
        role: 'ADMIN_MANAGER',
      });
      expect(result.current.impersonationChain).toHaveLength(2);
      expect(result.current.impersonationChain[0].role).toBe('SUPER_ADMIN');
      expect(result.current.impersonationChain[1].role).toBe('ADMIN_MANAGER');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)', () => {
    it('should track nested impersonation chain correctly', async () => {
      // First level: Super Admin → Admin Manager
      const firstLevelToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            token: firstLevelToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1', 'branch-2'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      // Start first level impersonation
      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      expect(result.current.impersonationChain).toHaveLength(2);

      // Second level: Admin Manager → Admin Cabang
      const secondLevelToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1', 'branch-2'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            fullName: 'Admin Cabang',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1',
          },
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            token: secondLevelToken,
            user: {
              id: 'admin-cabang-id',
              email: 'admincabang@raho.id',
              fullName: 'Admin Cabang',
              role: 'ADMIN_CABANG',
              branchId: 'branch-1',
            },
          },
        },
      });

      // Start second level impersonation
      await act(async () => {
        await result.current.startImpersonation('admin-cabang-id', 'ADMIN_CABANG');
      });

      // Verify nested chain
      expect(result.current.isImpersonating).toBe(true);
      expect(result.current.impersonationChain).toHaveLength(3);
      expect(result.current.impersonationChain[0].role).toBe('SUPER_ADMIN');
      expect(result.current.impersonationChain[1].role).toBe('ADMIN_MANAGER');
      expect(result.current.impersonationChain[2].role).toBe('ADMIN_CABANG');
      expect(result.current.impersonatedUser?.role).toBe('ADMIN_CABANG');
    });

    it('should go back one level when stopping nested impersonation', async () => {
      // Setup: Already in nested impersonation (Super Admin → Admin Manager → Admin Cabang)
      const nestedToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            fullName: 'Admin Cabang',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1',
          },
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: nestedToken,
            user: {
              id: 'admin-cabang-id',
              email: 'admincabang@raho.id',
              fullName: 'Admin Cabang',
              role: 'ADMIN_CABANG',
              branchId: 'branch-1',
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      // Start nested impersonation
      await act(async () => {
        await result.current.startImpersonation('admin-cabang-id', 'ADMIN_CABANG');
      });

      expect(result.current.impersonationChain).toHaveLength(3);

      // Stop impersonation (go back one level)
      const backOneLevelToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.stopImpersonation as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: backOneLevelToken,
          },
        },
      });

      await act(async () => {
        await result.current.stopImpersonation();
      });

      // Verify went back one level
      expect(result.current.isImpersonating).toBe(true);
      expect(result.current.impersonationChain).toHaveLength(2);
      expect(result.current.impersonatedUser?.role).toBe('ADMIN_MANAGER');
    });
  });

  describe('Stop Impersonation', () => {
    it('should clear impersonation state when returning to original user', async () => {
      // Setup: Single level impersonation
      const impersonationToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: impersonationToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      expect(result.current.isImpersonating).toBe(true);

      // Stop impersonation completely
      const originalToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
      });

      (adminManagersApi.stopImpersonation as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: originalToken,
          },
        },
      });

      await act(async () => {
        await result.current.stopImpersonation();
      });

      // Verify state is cleared
      expect(result.current.isImpersonating).toBe(false);
      expect(result.current.originalUser).toBeNull();
      expect(result.current.impersonatedUser).toBeNull();
      expect(result.current.impersonationChain).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should set error state when impersonation fails', async () => {
      const errorMessage = 'Unauthorized to impersonate';
      (adminManagersApi.impersonateUser as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: {
              message: errorMessage,
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        try {
          await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.loading).toBe(false);
      expect(result.current.isImpersonating).toBe(false);
    });

    it('should clear error when clearError is called', async () => {
      const errorMessage = 'Test error';
      (adminManagersApi.impersonateUser as jest.Mock).mockRejectedValue({
        response: {
          data: {
            error: {
              message: errorMessage,
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        try {
          await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBe(errorMessage);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading State', () => {
    it('should set loading to true during impersonation start', async () => {
      let resolveImpersonation: any;
      const impersonationPromise = new Promise((resolve) => {
        resolveImpersonation = resolve;
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockReturnValue(impersonationPromise);

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      act(() => {
        result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Should be loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Resolve the promise
      const mockToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          role: 'ADMIN_MANAGER',
          branches: [],
        },
      });

      await act(async () => {
        resolveImpersonation({
          data: {
            data: {
              token: mockToken,
              user: {
                id: 'manager-id',
                email: 'manager@raho.id',
                fullName: 'Admin Manager',
                role: 'ADMIN_MANAGER',
                branches: [],
              },
            },
          },
        });
      });

      // Should no longer be loading
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Token Storage and Updates', () => {
    it('should store token in auth store when starting impersonation', async () => {
      const mockToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: mockToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Verify setAccessToken was called with new token
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledWith(mockToken, 'refresh-token');
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledTimes(1);
    });

    it('should update token in auth store when stopping impersonation', async () => {
      // Setup: Start impersonation first
      const impersonationToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: impersonationToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Clear mock calls from start impersonation
      mockAuthStore.setAccessToken.mockClear();

      // Stop impersonation
      const originalToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
      });

      (adminManagersApi.stopImpersonation as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: originalToken,
          },
        },
      });

      await act(async () => {
        await result.current.stopImpersonation();
      });

      // Verify setAccessToken was called with original token
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledWith(originalToken, 'refresh-token');
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledTimes(1);
    });

    it('should preserve refresh token when starting impersonation', async () => {
      const mockToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: mockToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Verify refresh token is preserved (passed as second argument)
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledWith(
        expect.any(String),
        'refresh-token'
      );
    });

    it('should preserve refresh token when stopping impersonation', async () => {
      // Setup: Start impersonation first
      const impersonationToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: impersonationToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      mockAuthStore.setAccessToken.mockClear();

      // Stop impersonation
      const originalToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
      });

      (adminManagersApi.stopImpersonation as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: originalToken,
          },
        },
      });

      await act(async () => {
        await result.current.stopImpersonation();
      });

      // Verify refresh token is preserved
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledWith(
        expect.any(String),
        'refresh-token'
      );
    });

    it('should trigger state changes when token is updated during impersonation start', async () => {
      const mockToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: mockToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      // Capture initial state
      const initialState = {
        isImpersonating: result.current.isImpersonating,
        impersonatedUser: result.current.impersonatedUser,
      };

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Verify state changed after token update
      expect(result.current.isImpersonating).not.toBe(initialState.isImpersonating);
      expect(result.current.impersonatedUser).not.toBe(initialState.impersonatedUser);
      expect(result.current.isImpersonating).toBe(true);
      expect(result.current.impersonatedUser).toBeTruthy();
    });

    it('should trigger state changes when token is updated during impersonation stop', async () => {
      // Setup: Start impersonation first
      const impersonationToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: impersonationToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Capture state during impersonation
      const impersonatingState = {
        isImpersonating: result.current.isImpersonating,
        impersonatedUser: result.current.impersonatedUser,
      };

      expect(impersonatingState.isImpersonating).toBe(true);

      // Stop impersonation
      const originalToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
      });

      (adminManagersApi.stopImpersonation as jest.Mock).mockResolvedValue({
        data: {
          data: {
            token: originalToken,
          },
        },
      });

      await act(async () => {
        await result.current.stopImpersonation();
      });

      // Verify state changed after token update
      expect(result.current.isImpersonating).not.toBe(impersonatingState.isImpersonating);
      expect(result.current.impersonatedUser).not.toBe(impersonatingState.impersonatedUser);
      expect(result.current.isImpersonating).toBe(false);
      expect(result.current.impersonatedUser).toBeNull();
    });

    it('should handle token updates in nested impersonation', async () => {
      // First level: Super Admin → Admin Manager
      const firstLevelToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            token: firstLevelToken,
            user: {
              id: 'manager-id',
              email: 'manager@raho.id',
              fullName: 'Admin Manager',
              role: 'ADMIN_MANAGER',
              branches: ['branch-1'],
            },
          },
        },
      });

      const { result } = renderHook(() => useImpersonation(), { wrapper });

      await act(async () => {
        await result.current.startImpersonation('manager-id', 'ADMIN_MANAGER');
      });

      // Verify first token update
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledWith(firstLevelToken, 'refresh-token');

      mockAuthStore.setAccessToken.mockClear();

      // Second level: Admin Manager → Admin Cabang
      const secondLevelToken = createMockToken({
        userId: 'super-admin-id',
        email: 'superadmin@raho.id',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        impersonating: {
          userId: 'manager-id',
          email: 'manager@raho.id',
          fullName: 'Admin Manager',
          role: 'ADMIN_MANAGER',
          branches: ['branch-1'],
          impersonating: {
            userId: 'admin-cabang-id',
            email: 'admincabang@raho.id',
            fullName: 'Admin Cabang',
            role: 'ADMIN_CABANG',
            branchId: 'branch-1',
          },
        },
      });

      (adminManagersApi.impersonateUser as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            token: secondLevelToken,
            user: {
              id: 'admin-cabang-id',
              email: 'admincabang@raho.id',
              fullName: 'Admin Cabang',
              role: 'ADMIN_CABANG',
              branchId: 'branch-1',
            },
          },
        },
      });

      await act(async () => {
        await result.current.startImpersonation('admin-cabang-id', 'ADMIN_CABANG');
      });

      // Verify second token update
      expect(mockAuthStore.setAccessToken).toHaveBeenCalledWith(secondLevelToken, 'refresh-token');
      
      // Verify state reflects nested impersonation
      expect(result.current.impersonationChain).toHaveLength(3);
      expect(result.current.impersonatedUser?.role).toBe('ADMIN_CABANG');
    });
  });
});

// Helper function to create mock JWT tokens
function createMockToken(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'mock-signature';
  return `${header}.${body}.${signature}`;
}
