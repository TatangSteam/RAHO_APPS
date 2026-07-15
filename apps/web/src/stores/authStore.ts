'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AuthUser, TokenPair } from '@/types/auth';

// Import token expiry checker
let startTokenExpiryCheck: (() => void) | null = null;
let stopTokenExpiryCheck: (() => void) | null = null;

// Dynamically import to avoid circular dependency
if (typeof window !== 'undefined') {
  import('@/lib/api').then((module) => {
    startTokenExpiryCheck = module.startTokenExpiryCheck;
    stopTokenExpiryCheck = module.stopTokenExpiryCheck;
  });
}

// ── State Shape ───────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  activeBranchId: string | null; // Currently active branch for multi-branch users
  assignedBranches: string[]; // All branch IDs user has access to
}

interface AuthActions {
  setAuth: (user: AuthUser, tokens: TokenPair) => void;
  setAccessToken: (accessToken: string, refreshToken: string) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  updateUserAvatar: (avatarUrl: string | null) => void;
  setActiveBranch: (branchId: string) => void;
  setAssignedBranches: (branchIds: string[]) => void;
  clearAuth: () => void;
}

type AuthStore = AuthState & AuthActions;

// ── Initial State ─────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  activeBranchId: null,
  assignedBranches: [],
};

// ── Store ─────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      setAuth: (user, tokens) => {
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
          activeBranchId: user.branchId, // Initialize with primary branch
          assignedBranches: user.branchId ? [user.branchId] : [],
        });
        
        // Start token expiry check when user logs in
        if (startTokenExpiryCheck) {
          startTokenExpiryCheck();
        }
      },

      setAccessToken: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      updateUserAvatar: (avatarUrl) =>
        set((state) => ({
          user: state.user ? { ...state.user, avatarUrl } : null,
        })),

      setActiveBranch: (branchId) => {
        set({ activeBranchId: branchId });
        // Persist active branch selection
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeBranchId', branchId);
        }
      },

      setAssignedBranches: (branchIds) => {
        set({ assignedBranches: branchIds });
      },

      clearAuth: () => {
        set(initialState);
        
        // Clear active branch from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('activeBranchId');
        }
        
        // Stop token expiry check when user logs out
        if (stopTokenExpiryCheck) {
          stopTokenExpiryCheck();
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist everything including active branch
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        activeBranchId: state.activeBranchId,
        assignedBranches: state.assignedBranches,
      }),
      // Start token check when store is rehydrated (page refresh)
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && startTokenExpiryCheck) {
          startTokenExpiryCheck();
        }
      },
    },
  ),
);

// ── Selectors (stable references) ────────────────────────────

export const selectUser = (s: AuthStore) => s.user;
export const selectAccessToken = (s: AuthStore) => s.accessToken;
export const selectRefreshToken = (s: AuthStore) => s.refreshToken;
export const selectIsAuthenticated = (s: AuthStore) => s.isAuthenticated;
export const selectActiveBranchId = (s: AuthStore) => s.activeBranchId;
export const selectAssignedBranches = (s: AuthStore) => s.assignedBranches;
