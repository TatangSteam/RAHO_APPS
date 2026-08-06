'use client';

import { assertCaughtError } from '@/lib/caughtError';
import React, { useEffect } from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { showToast } from '@/lib/toast';
import styles from './ImpersonationBanner.module.css';
import { devError } from '@/lib/logger';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonationChain, stopImpersonation, loading, error, clearError } = useImpersonation();

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      showToast.error(error);
      // Clear error after showing toast
      const timer = setTimeout(() => {
        clearError();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!isImpersonating || impersonationChain.length < 2) {
    return null;
  }

  // Build chain display (e.g., "Super Admin → Admin Manager → Admin Cabang")
  const chainDisplay = impersonationChain.map(item => {
    const roleDisplay = {
      SUPER_ADMIN: 'Super Admin',
      ADMIN_MANAGER: 'Admin Manager',
      ADMIN_CABANG: 'Admin Cabang',
      ADMIN_LAYANAN: 'Admin Layanan',
      DOCTOR: 'Doctor',
      NURSE: 'Nurse',
      MEMBER: 'Member',
    }[item.role] || item.role;
    
    return `${roleDisplay} (${item.fullName})`;
  }).join(' → ');

  // Determine previous role for button text
  const previousRole = impersonationChain.length > 2 
    ? impersonationChain[impersonationChain.length - 2].role 
    : impersonationChain[0].role;
  
  const previousRoleDisplay = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN_MANAGER: 'Admin Manager',
    ADMIN_CABANG: 'Admin Cabang',
    ADMIN_LAYANAN: 'Admin Layanan',
    DOCTOR: 'Doctor',
    NURSE: 'Nurse',
    MEMBER: 'Member',
  }[previousRole] || previousRole;

  const handleStopImpersonation = async () => {
    if (loading) return;
    
    try {
      await stopImpersonation();
    } catch (error) {
      assertCaughtError(error);
      devError('Failed to stop impersonation:', error);
      // Error is handled in context, just log here
    }
  };

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.icon}>👤</span>
        <div className={styles.textContainer}>
          <span className={styles.label}>Anda sedang masuk sebagai:</span>
          <span className={styles.chain}>{chainDisplay}</span>
        </div>
      </div>
      <button 
        className={styles.exitButton}
        onClick={handleStopImpersonation}
        disabled={loading}
      >
        {loading ? 'Memproses...' : `← Kembali ke ${previousRoleDisplay}`}
      </button>
    </div>
  );
};
