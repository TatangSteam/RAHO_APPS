'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { adminManagersApi } from '@/lib/api/adminManagersApi';
import { showToast } from '@/lib/toast';
import { getDefaultRoute, type AdminManagerAccessScope, type Role } from '@/types/auth';

// Types
interface AuthUser {
  id: string;
  email: string;
  role: string;
  adminManagerAccessScope?: AdminManagerAccessScope | null;
  fullName?: string;
  branchId?: string | null;
}

interface ImpersonatedUser {
  id: string;
  email: string;
  role: string;
  adminManagerAccessScope?: AdminManagerAccessScope | null;
  fullName?: string;
  branchId?: string | null;
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

// Helper to extract error message
function extractErrorMessage(error: any): string {
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
      const currentToken = localStorage.getItem('accessToken');
      const currentUser = localStorage.getItem('user');
      
      // Save original user info if not already impersonating
      let originalUser = state.originalUser;
      let chain = [...state.impersonationChain];
      
      if (!state.isImpersonating && currentUser) {
        originalUser = JSON.parse(currentUser);
        chain = [];
      }
      
      // Add current user to chain
      if (currentUser) {
        const current = JSON.parse(currentUser);
        chain.push({
          userId: current.id,
          email: current.email,
          role: current.role,
          fullName: current.fullName,
        });
      }
      
      // Update localStorage with new token
      localStorage.setItem('accessToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.targetUser));
      const cookiePayload = btoa(
        JSON.stringify({
          role: response.targetUser.role,
          userId: response.targetUser.id,
          adminManagerAccessScope: response.targetUser.adminManagerAccessScope,
        }),
      );
      document.cookie = `raho-auth-token=${cookiePayload}; path=/; max-age=28800; SameSite=Lax`;
      
      // Store impersonation data
      const impersonationData = {
        originalUser,
        impersonatedUser: response.targetUser,
        chain,
        previousToken: currentToken,
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
      
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      showToast.error(errorMessage);
      throw error;
    }
  }, [router, state.isImpersonating, state.originalUser, state.impersonationChain]);

  // Stop impersonation
  const stopImpersonation = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await adminManagersApi.stopImpersonation();
      
      // Get impersonation data
      const impersonationData = localStorage.getItem('impersonation');
      let originalUser = state.originalUser;
      
      if (impersonationData) {
        const data = JSON.parse(impersonationData);
        originalUser = data.originalUser;
      }
      
      // Restore original token
      localStorage.setItem('accessToken', response.accessToken);
      
      if (originalUser) {
        localStorage.setItem('user', JSON.stringify(originalUser));
      }
      
      // Clear impersonation data
      localStorage.removeItem('impersonation');
      
      // Update state
      setState({
        isImpersonating: false,
        originalUser: null,
        impersonatedUser: null,
        impersonationChain: [],
        loading: false,
        error: null,
      });
      
      showToast.success('Berhasil kembali ke akun asli');
      
      // Redirect to admin managers page
      router.push('/admin/managers');
      
      // Force page reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error: any) {
      const errorMessage = extractErrorMessage(error);
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      showToast.error(errorMessage);
      throw error;
    }
  }, [router, state.originalUser]);

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
