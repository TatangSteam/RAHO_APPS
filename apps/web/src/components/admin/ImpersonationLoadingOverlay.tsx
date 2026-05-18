'use client';

import React from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import styles from './ImpersonationLoadingOverlay.module.css';

/**
 * Full-screen loading overlay for impersonation operations
 * Shows when impersonation is starting or stopping
 */
export const ImpersonationLoadingOverlay: React.FC = () => {
  const { loading } = useImpersonation();

  if (!loading) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.spinner}>
          <div className={styles.spinnerRing}></div>
          <div className={styles.spinnerRing}></div>
          <div className={styles.spinnerRing}></div>
        </div>
        <h3 className={styles.title}>Memproses Impersonation</h3>
        <p className={styles.message}>Mohon tunggu sebentar...</p>
      </div>
    </div>
  );
};
