'use client';

import React from 'react';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { ImpersonateButton } from './ImpersonateButton';
import { ImpersonationErrorDisplay } from './ImpersonationErrorDisplay';
import { ImpersonationLoadingOverlay } from './ImpersonationLoadingOverlay';
import styles from './ImpersonationDemo.module.css';

/**
 * Demo component showing all impersonation features
 * This demonstrates error handling and loading states
 * 
 * Usage: Add this to a page to test impersonation features
 */
export const ImpersonationDemo: React.FC = () => {
  const {
    isImpersonating,
    loading,
    error,
    impersonationChain,
    startImpersonation,
    stopImpersonation,
    clearError,
  } = useImpersonation();

  // Mock data for demonstration
  const mockManagers = [
    { id: 'manager-1', fullName: 'John Doe', email: 'john@raho.id' },
    { id: 'manager-2', fullName: 'Jane Smith', email: 'jane@raho.id' },
  ];

  const mockBranchAdmins = [
    { id: 'admin-1', fullName: 'Admin Jakarta', email: 'admin.jkt@raho.id' },
    { id: 'admin-2', fullName: 'Admin Bandung', email: 'admin.bdg@raho.id' },
  ];

  return (
    <div className={styles.demo}>
      <h2>🔄 Impersonation Demo</h2>
      <p className={styles.description}>
        This demo shows error handling and loading states for impersonation
      </p>

      {/* Loading Overlay */}
      <ImpersonationLoadingOverlay />

      {/* Error Display */}
      <ImpersonationErrorDisplay />

      {/* Current State */}
      <div className={styles.statePanel}>
        <h3>Current State</h3>
        <div className={styles.stateGrid}>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Impersonating:</span>
            <span className={styles.stateValue}>
              {isImpersonating ? '✅ Yes' : '❌ No'}
            </span>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Loading:</span>
            <span className={styles.stateValue}>
              {loading ? '⏳ Yes' : '✅ No'}
            </span>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Error:</span>
            <span className={styles.stateValue}>
              {error ? `⚠️ ${error}` : '✅ None'}
            </span>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Chain Length:</span>
            <span className={styles.stateValue}>
              {impersonationChain.length}
            </span>
          </div>
        </div>

        {impersonationChain.length > 0 && (
          <div className={styles.chainDisplay}>
            <h4>Impersonation Chain:</h4>
            <div className={styles.chain}>
              {impersonationChain.map((item, index) => (
                <React.Fragment key={item.userId}>
                  {index > 0 && <span className={styles.arrow}>→</span>}
                  <div className={styles.chainItem}>
                    <div className={styles.chainRole}>{item.role}</div>
                    <div className={styles.chainName}>{item.fullName}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admin Managers Section */}
      <div className={styles.section}>
        <h3>👥 Admin Managers</h3>
        <p className={styles.sectionDesc}>
          Click "Masuk Sebagai" to impersonate an Admin Manager
        </p>
        <div className={styles.userList}>
          {mockManagers.map((manager) => (
            <div key={manager.id} className={styles.userCard}>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{manager.fullName}</div>
                <div className={styles.userEmail}>{manager.email}</div>
              </div>
              <ImpersonateButton
                userId={manager.id}
                userName={manager.fullName}
                targetRole="ADMIN_MANAGER"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Branch Admins Section */}
      <div className={styles.section}>
        <h3>🏢 Branch Admins</h3>
        <p className={styles.sectionDesc}>
          Click "Masuk Sebagai" to impersonate a Branch Admin
        </p>
        <div className={styles.userList}>
          {mockBranchAdmins.map((admin) => (
            <div key={admin.id} className={styles.userCard}>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{admin.fullName}</div>
                <div className={styles.userEmail}>{admin.email}</div>
              </div>
              <ImpersonateButton
                userId={admin.id}
                userName={admin.fullName}
                targetRole="ADMIN_CABANG"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Manual Controls */}
      <div className={styles.section}>
        <h3>🎮 Manual Controls</h3>
        <div className={styles.controls}>
          <button
            onClick={() => startImpersonation('test-user', 'ADMIN_MANAGER')}
            disabled={loading}
            className={styles.controlBtn}
          >
            Test Start Impersonation
          </button>
          <button
            onClick={stopImpersonation}
            disabled={loading || !isImpersonating}
            className={styles.controlBtn}
          >
            Test Stop Impersonation
          </button>
          <button
            onClick={clearError}
            disabled={!error}
            className={styles.controlBtn}
          >
            Clear Error
          </button>
        </div>
      </div>

      {/* Error Simulation */}
      <div className={styles.section}>
        <h3>⚠️ Error Simulation</h3>
        <p className={styles.sectionDesc}>
          These buttons will trigger errors to test error handling
        </p>
        <div className={styles.controls}>
          <button
            onClick={() => startImpersonation('invalid-user', 'ADMIN_MANAGER')}
            disabled={loading}
            className={styles.errorBtn}
          >
            Trigger 404 Error
          </button>
          <button
            onClick={() => startImpersonation('forbidden-user', 'ADMIN_MANAGER')}
            disabled={loading}
            className={styles.errorBtn}
          >
            Trigger 403 Error
          </button>
        </div>
      </div>
    </div>
  );
};
