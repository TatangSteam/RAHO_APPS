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
}

interface AuthActions {
  setAuth: (user: AuthUser, tokens: TokenPair) => void;
  setAccessToken: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

type AuthStore = AuthState & AuthActions;

// ── Initial State ─────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
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
        });
        
        // Start token expiry check when user logs in
        if (startTokenExpiryCheck) {
          startTokenExpiryCheck();
        }
      },

      setAccessToken: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      clearAuth: () => {
        set(initialState);
        
        // Stop token expiry check when user logs out
        if (stopTokenExpiryCheck) {
          stopTokenExpiryCheck();
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist tokens; user can be re-fetched on restore
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
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
