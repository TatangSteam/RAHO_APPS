'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LoadingContextType {
  isGlobalLoading: boolean;
  loadingMessage: string;
  showGlobalLoading: (message?: string) => void;
  hideGlobalLoading: () => void;
  
  // API Loading tracking
  apiLoadingCount: number;
  incrementApiLoading: () => void;
  decrementApiLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Memuat...');
  const [apiLoadingCount, setApiLoadingCount] = useState(0);

  const showGlobalLoading = useCallback((message = 'Memuat...') => {
    setLoadingMessage(message);
    setIsGlobalLoading(true);
  }, []);

  const hideGlobalLoading = useCallback(() => {
    setIsGlobalLoading(false);
  }, []);

  const incrementApiLoading = useCallback(() => {
    setApiLoadingCount((prev) => prev + 1);
  }, []);

  const decrementApiLoading = useCallback(() => {
    setApiLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        isGlobalLoading,
        loadingMessage,
        showGlobalLoading,
        hideGlobalLoading,
        apiLoadingCount,
        incrementApiLoading,
        decrementApiLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
