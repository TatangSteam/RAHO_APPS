'use client';

import { assertCaughtError } from '@/lib/caughtError';
import React, { useState } from 'react';
import { adminManagersApi } from '@/lib/api/adminManagersApi';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { getDefaultRoute, type Role } from '@/types/auth';
import { UserCog } from 'lucide-react';
import styles from './ImpersonateButton.module.css';

interface ImpersonateButtonProps {
  userId: string;
  userName: string;
  targetRole: string;
  disabled?: boolean;
  className?: string;
}

export const ImpersonateButton: React.FC<ImpersonateButtonProps> = ({
  userId,
  userName,
  targetRole,
  disabled = false,
  className = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleImpersonate = async () => {
    try {
      setLoading(true);
      
      // Call API to start impersonation
      const response = await adminManagersApi.startImpersonation(userId);
      
      // Update auth store with new token
      const { setAccessToken } = useAuthStore.getState();
      setAccessToken(response.token, response.token);
      
      // Set cookie for middleware (same format as login)
      const cookiePayload = btoa(
        JSON.stringify({ 
          role: response.targetUser.role, 
          userId: response.targetUser.id,
          adminManagerAccessScope: response.targetUser.adminManagerAccessScope,
        })
      );
      document.cookie = `raho-auth-token=${cookiePayload}; path=/; max-age=28800; SameSite=Lax`;
      
      // Redirect based on target role
      const targetUrl = getDefaultRoute(
        response.targetUser.role as Role,
        response.targetUser.adminManagerAccessScope,
      );
      window.location.replace(targetUrl);
      
    } catch (error) {
      assertCaughtError(error);
      devError('Error impersonating user:', error);
      const message = error.response?.data?.message || 'Gagal melakukan impersonation';
      showToast.error(message);
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={`${styles.impersonateBtn} ${className}`}
        onClick={() => setShowConfirm(true)}
        disabled={disabled || loading}
        title={`Impersonate sebagai ${userName}`}
      >
        <UserCog size={16} />
        <span>Impersonate</span>
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <UserCog size={32} />
            </div>
            <h3>Konfirmasi Impersonation</h3>
            <p>
              Anda akan login sebagai <strong>{userName}</strong> dengan role{' '}
              <strong>{targetRole}</strong>.
            </p>
            <p className={styles.warning}>
              ⚠️ Semua aksi yang dilakukan akan tercatat atas nama user ini.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Batal
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleImpersonate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner}>⏳</span>
                    Memproses...
                  </>
                ) : (
                  <>
                    <UserCog size={18} />
                    Ya, Impersonate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
