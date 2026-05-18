'use client';

import React, { useEffect } from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import styles from './ImpersonationErrorDisplay.module.css';

/**
 * Component to display impersonation errors inline
 * Automatically clears errors after a timeout
 */
export const ImpersonationErrorDisplay: React.FC = () => {
  const { error, clearError } = useImpersonation();

  useEffect(() => {
    if (error) {
      // Auto-clear error after 10 seconds
      const timer = setTimeout(() => {
        clearError();
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!error) return null;

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent}>
        <span className={styles.errorIcon}>⚠️</span>
        <div className={styles.errorMessage}>
          <strong>Impersonation Error:</strong>
          <p>{error}</p>
        </div>
        <button
          onClick={clearError}
          className={styles.closeButton}
          aria-label="Tutup pesan error"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
