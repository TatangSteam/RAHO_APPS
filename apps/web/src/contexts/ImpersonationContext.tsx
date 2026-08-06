'use client';

import { assertCaughtError, type CaughtError } from '@/lib/caughtError';
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { adminManagersApi } from '@/lib/api/adminManagersApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import {
  getDefaultRoute,
  type AdminManagerAccessScope,
  type AuthUser,
  type Role,
} from '@/types/auth';

// Types
interface ImpersonatedUser {
  id: string;
  email: string;
  role: string;
  adminManagerAccessScope?: AdminManagerAccessScope | null;
  fullName?: string;
  branchId?: string | null;
  branchCode?: string | null;
}

interface ImpersonationChainItem {
  userId: string;
  email: string;
  role: string;
  fullName?: string;
}

interface ImpersonationState {
  isImpersonating: boolean;
  originalUser: AuthUser | null;
  impersonatedUser: ImpersonatedUser | null;
  impersonationChain: ImpersonationChainItem[];
  loading: boolean;
  error: string | null;
}

interface ImpersonationContextType extends ImpersonationState {
  startImpersonation: (userId: string, targetRole: 'ADMIN_MANAGER' | 'ADMIN_CABANG') => Promise<void>;
  stopImpersonation: () => Promise<void>;
  clearError: () => void;
}

// Create context
const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

function toAuthUser(user: ImpersonatedUser): AuthUser {
  return {
    userId: user.id,
    id: user.id,
    email: user.email,
    role: user.role as Role,
    branchId: user.branchId ?? null,
    branchCode: user.branchCode ?? null,
    adminManagerAccessScope: user.adminManagerAccessScope ?? null,
    fullName: user.fullName || user.email,
    staffCode: null,
  };
}

function toChainItem(user: AuthUser | ImpersonatedUser): ImpersonationChainItem {
  return {
    userId: 'userId' in user ? user.userId : user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  };
}

function setAuthCookie(user: ImpersonatedUser): void {
  const cookiePayload = btoa(JSON.stringify({
    role: user.role,
    userId: user.id,
    adminManagerAccessScope: user.adminManagerAccessScope,
  }));
  document.cookie = `raho-auth-token=${cookiePayload}; path=/; max-age=28800; SameSite=Lax`;
}

// Helper to extract error message
function extractErrorMessage(error: CaughtError): string {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error?.response?.status) {
    switch (error.response.status) {
      case 403:
        return 'Anda tidak memiliki izin untuk melakukan impersonation';
      case 404:
        return 'User yang akan di-impersonate tidak ditemukan';
      case 400:
        return 'Permintaan impersonation tidak valid';
      default:
        if (error.response.status >= 500) {
          return 'Terjadi kesalahan server. Silakan coba lagi.';
        }
    }
  }
  
  if (error?.message?.includes('Network Error')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  }
  
  return error?.message || 'Terjadi kesalahan yang tidak diketahui';
}

// Provider component
export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const {
    user: authUser,
    accessToken,
    refreshToken,
    setAuth,
  } = useAuthStore();
  
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    originalUser: null,
    impersonatedUser: null,
    impersonationChain: [],
    loading: false,
    error: null,
  });

  // Check for existing impersonation on mount
  useEffect(() => {
    const checkImpersonation = () => {
      const impersonationData = localStorage.getItem('impersonation');
      if (impersonationData) {
        try {
          const data = JSON.parse(impersonationData);
          setState(prev => ({
            ...prev,
            isImpersonating: true,
            originalUser: data.originalUser || null,
            impersonatedUser: data.impersonatedUser || null,
            impersonationChain: data.chain || [],
          }));
        } catch (e) {
      assertCaughtError(e);
          // Silent fail - impersonation data was corrupted
          localStorage.removeItem('impersonation');
        }
      }
    };
    
    checkImpersonation();
  }, []);

  // Start impersonation
  const startImpersonation = useCallback(async (
    userId: string,
    targetRole: 'ADMIN_MANAGER' | 'ADMIN_CABANG'
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await adminManagersApi.impersonateUser(userId, targetRole);
      
      // Store new token
      // Save original user info if not already impersonating
      let originalUser = state.originalUser;
      let chain = [...state.impersonationChain];

      if (!state.isImpersonating && authUser) {
        originalUser = authUser;
        chain = [toChainItem(authUser)];
      }

      const targetChainItem = toChainItem(response.targetUser);
      if (chain.at(-1)?.userId !== targetChainItem.userId) {
        chain.push(targetChainItem);
      }

      setAuth(toAuthUser(response.targetUser), {
        accessToken: response.token,
        refreshToken: refreshToken || '',
      });
      setAuthCookie(response.targetUser);
      
      // Store impersonation data
      const impersonationData = {
        originalUser,
        impersonatedUser: response.targetUser,
        chain,
        previousToken: accessToken,
      };
      localStorage.setItem('impersonation', JSON.stringify(impersonationData));
      
      // Update state
      setState(prev => ({
        ...prev,
        isImpersonating: true,
        originalUser,
        impersonatedUser: response.targetUser,
        impersonationChain: chain,
        loading: false,
        error: null,
      }));
      
      showToast.success(`Berhasil masuk sebagai ${response.targetUser.fullName || response.targetUser.email}`);
      
      router.push(getDefaultRoute(
        response.targetUser.role as Role,
        response.targetUser.adminManagerAccessScope,
      ));
      
      // Force page reload to update auth state
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      assertCaughtError(error);
      const errorMessage = extractErrorMessage(error);
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      showToast.error(errorMessage);
      throw error;
    }
  }, [
    accessToken,
    authUser,
    refreshToken,
    router,
    setAuth,
    state.isImpersonating,
    state.originalUser,
    state.impersonationChain,
  ]);

  // Stop impersonation
  const stopImpersonation = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await adminManagersApi.stopImpersonation();
      
      const returnedUser = response.user as ImpersonatedUser;
      const nextChain = state.impersonationChain.slice(0, -1);
      const stillImpersonating = nextChain.length > 1;

      setAuth(toAuthUser(returnedUser), {
        accessToken: response.token,
        refreshToken: refreshToken || '',
      });
      setAuthCookie(returnedUser);

      if (stillImpersonating) {
        localStorage.setItem('impersonation', JSON.stringify({
          originalUser: state.originalUser,
          impersonatedUser: returnedUser,
          chain: nextChain,
          previousToken: accessToken,
        }));
      } else {
        localStorage.removeItem('impersonation');
      }

      setState({
        isImpersonating: stillImpersonating,
        originalUser: stillImpersonating ? state.originalUser : null,
        impersonatedUser: stillImpersonating ? returnedUser : null,
        impersonationChain: stillImpersonating ? nextChain : [],
        loading: false,
        error: null,
      });

      showToast.success(stillImpersonating
        ? `Berhasil kembali sebagai ${returnedUser.fullName || returnedUser.email}`
        : 'Berhasil kembali ke akun asli');

      router.push(getDefaultRoute(
        returnedUser.role as Role,
        returnedUser.adminManagerAccessScope,
      ));
      
      // Force page reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      assertCaughtError(error);
      const errorMessage = extractErrorMessage(error);
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      showToast.error(errorMessage);
      throw error;
    }
  }, [
    accessToken,
    refreshToken,
    router,
    setAuth,
    state.impersonationChain,
    state.originalUser,
  ]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const value: ImpersonationContextType = {
    ...state,
    startImpersonation,
    stopImpersonation,
    clearError,
  };

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

// Hook to use impersonation context
export function useImpersonation(): ImpersonationContextType {
  const context = useContext(ImpersonationContext);
  
  if (context === undefined) {
    throw new Error('useImpersonation must be used within ImpersonationProvider');
  }
  
  return context;
}
