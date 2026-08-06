'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useEffect } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { setLoadingCallbacks } from '@/lib/apiLoadingTracking';

/**
 * Hook to connect API loading state with LoadingContext
 * Call this in a component that is wrapped by LoadingProvider
 */
export function useApiLoading() {
  const { incrementApiLoading, decrementApiLoading } = useLoading();

  useEffect(() => {
    // Set up callbacks for API interceptors
    setLoadingCallbacks({
      onStart: incrementApiLoading,
      onEnd: decrementApiLoading,
    });

    // Cleanup on unmount
    return () => {
      setLoadingCallbacks({});
    };
  }, [incrementApiLoading, decrementApiLoading]);
}

/**
 * Safe version that doesn't throw error if used outside LoadingProvider
 * Use this for optional loading integration
 */
export function useApiLoadingSafe() {
  try {
    useApiLoading();
  } catch (error) {
      assertCaughtError(error);
    // Silently fail if not within LoadingProvider
    // This allows the hook to be used optionally
  }
}
