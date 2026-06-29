'use client';

import { useEffect } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { setLoadingCallbacks } from '@/lib/apiLoadingTracking';

/**
 * Component to setup API loading integration with LoadingContext
 * Must be used inside LoadingProvider
 */
export function ApiLoadingSetup() {
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

  // This component doesn't render anything
  return null;
}
