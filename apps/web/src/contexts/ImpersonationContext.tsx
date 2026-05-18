'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { adminManagersApi } from '@/lib/api/adminManagersApi';
import { AuthUser, Role } from '@/types/auth';

// ── Types ─────────────────────────────────────────────────────

interface ImpersonatedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN_MANAGER' | 'ADMIN_CABANG';
  branchId?: string;
  branches?: string[];
}

interface ImpersonationChainItem {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
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

// ── Context ───────────────────────────────────────────────────

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { user: currentUser, setAccessToken } = useAuthStore();
  
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    originalUser: null,
    impersonatedUser: null,
    impersonationChain: [],
    loading: false,
    error: null,
  });

  // Parse JWT token to extract impersonation data
  const parseToken = useCallback((token: string): { isImpersonating: boolean; chain: ImpersonationChainItem[] } => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Build impersonation chain from nested structure
      const chain: ImpersonationChainItem[] = [];
      let current = payload;
      
      // Add root user
      chain.push({
        userId: current.userId,
        email: current.email,
        fullName: current.fullName || current.email,
        role: current.role,
      });
      
      // Traverse nested impersonation
      while (current.impersonating) {
        current = current.impersonating;
        chain.push({
          userId: current.userId,
          email: current.email,
          fullName: current.fullName || current.email,
          role: current.role,
        });
      }
      
      return {
        isImpersonating: chain.length > 1,
        chain,
      };
    } catch (error) {
      console.error('Failed to parse token:', error);
      return { isImpersonating: false, chain: [] };
    }
  }, []);

  // Initialize state from current token on mount
  useEffect(() => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && currentUser) {
      const { isImpersonating, chain } = parseToken(accessToken);
      
      if (isImpersonating && chain.length > 1) {
        setState({
          isImpersonating: true,
          originalUser: currentUser,
          impersonatedUser: {
            id: chain[chain.length - 1].userId,
            email: chain[chain.length - 1].email,
            fullName: chain[chain.length - 1].fullName,
            role: chain[chain.length - 1].role as 'ADMIN_MANAGER' | 'ADMIN_CABANG',
          },
          impersonationChain: chain,
          loading: false,
          error: null,
        });
      }
    }
  }, [currentUser, parseToken]);

  // Start impersonation
  const startImpersonation = useCallback(async (userId: string, targetRole: 'ADMIN_MANAGER' | 'ADMIN_CABANG') => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await adminManagersApi.impersonateUser(userId, targetRole);
      const { token, user: impersonatedUser } = response.data.data;
      
      // Update token in auth store
      const { refreshToken } = useAuthStore.getState();
      setAccessToken(token, refreshToken || '');
      
      // Parse new token to get chain
      const { chain } = parseToken(token);
      
      // Update state
      setState({
        isImpersonating: true,
        originalUser: currentUser,
        impersonatedUser: {
          id: impersonatedUser.id,
          email: impersonatedUser.email,
          fullName: impersonatedUser.fullName,
          role: impersonatedUser.role,
          branchId: impersonatedUser.branchId,
          branches: impersonatedUser.branches,
        },
        impersonationChain: chain,
        loading: false,
        error: null,
      });
      
      // Redirect based on target role
      if (targetRole === 'ADMIN_MANAGER') {
        router.push('/admin-manager');
      } else if (targetRole === 'ADMIN_CABANG') {
        router.push('/dashboard');
      }
    } catch (error: any) {
      // Extract error message with fallbacks
      let errorMessage = 'Gagal memulai impersonation';
      
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status === 403) {
        errorMessage = 'Anda tidak memiliki izin untuk melakukan impersonation';
      } else if (error.response?.status === 404) {
        errorMessage = 'User yang akan di-impersonate tidak ditemukan';
      } else if (error.response?.status === 400) {
        errorMessage = 'Permintaan impersonation tidak valid';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Terjadi kesalahan server. Silakan coba lagi.';
      } else if (!error.response) {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      
      // Re-throw error for component-level handling
      throw error;
    }
  }, [currentUser, router, setAccessToken, parseToken]);

  // Stop impersonation (go back one level)
  const stopImpersonation = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await adminManagersApi.stopImpersonation();
      const { token } = response.data.data;
      
      // Update token in auth store
      const { refreshToken } = useAuthStore.getState();
      setAccessToken(token, refreshToken || '');
      
      // Parse new token to check if still impersonating
      const { isImpersonating, chain } = parseToken(token);
      
      if (isImpersonating && chain.length > 1) {
        // Still impersonating (went back one level in nested impersonation)
        const newImpersonatedUser = chain[chain.length - 1];
        
        setState({
          isImpersonating: true,
          originalUser: currentUser,
          impersonatedUser: {
            id: newImpersonatedUser.userId,
            email: newImpersonatedUser.email,
            fullName: newImpersonatedUser.fullName,
            role: newImpersonatedUser.role as 'ADMIN_MANAGER' | 'ADMIN_CABANG',
          },
          impersonationChain: chain,
          loading: false,
          error: null,
        });
        
        // Redirect based on new role
        if (newImpersonatedUser.role === 'ADMIN_MANAGER') {
          router.push('/admin-manager');
        } else if (newImpersonatedUser.role === 'ADMIN_CABANG') {
          router.push('/dashboard');
        }
      } else {
        // No longer impersonating (back to original user)
        setState({
          isImpersonating: false,
          originalUser: null,
          impersonatedUser: null,
          impersonationChain: [],
          loading: false,
          error: null,
        });
        
        // Redirect based on original user role
        if (currentUser?.role === 'SUPER_ADMIN') {
          router.push('/admin/super-admin');
        } else if (currentUser?.role === 'ADMIN_MANAGER') {
          router.push('/admin-manager');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (error: any) {
      // Extract error message with fallbacks
      let errorMessage = 'Gagal menghentikan impersonation';
      
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status === 403) {
        errorMessage = 'Anda tidak memiliki izin untuk menghentikan impersonation';
      } else if (error.response?.status === 400) {
        errorMessage = 'Tidak sedang dalam mode impersonation';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Terjadi kesalahan server. Silakan coba lagi.';
      } else if (!error.response) {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      
      // Re-throw error for component-level handling
      throw error;
    }
  }, [currentUser, router, setAccessToken, parseToken]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        ...state,
        startImpersonation,
        stopImpersonation,
        clearError,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────

export const useImpersonation = (): ImpersonationContextType => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within ImpersonationProvider');
  }
  return context;
};
