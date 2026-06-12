'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getUserBranches, type StaffBranchAssignment } from '@/lib/api/staffBranchApi';
import styles from './BranchSwitcher.module.css';

/**
 * Branch Switcher Component
 * Allows doctors/nurses with multi-branch assignments to switch between branches
 */
export function BranchSwitcher() {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);
  const setAssignedBranches = useAuthStore((s) => s.setAssignedBranches);

  const [branches, setBranches] = useState<StaffBranchAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Load user's assigned branches on mount
  useEffect(() => {
    if (user?.userId && (user.role === 'DOCTOR' || user.role === 'NURSE')) {
      loadUserBranches();
    }
  }, [user?.userId]);

  const loadUserBranches = async () => {
    if (!user?.userId) return;

    try {
      setLoading(true);
      const data = await getUserBranches(user.userId);
      setBranches(data.assignedBranches);
      
      // Update store with assigned branch IDs
      const branchIds = data.assignedBranches.map((b) => b.branchId);
      setAssignedBranches(branchIds);

      // If no active branch is set, use primary branch
      if (!activeBranchId && data.primaryBranch) {
        setActiveBranch(data.primaryBranch.id);
      }
    } catch (err) {
      console.error('Failed to load user branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchBranch = (branchId: string) => {
    setActiveBranch(branchId);
    setOpen(false);
    // Trigger page reload to refresh dashboard data with new branch context
    window.location.reload();
  };

  // Don't show switcher for non-doctors/nurses
  if (!user || (user.role !== 'DOCTOR' && user.role !== 'NURSE')) {
    return null;
  }

  // Don't show switcher if only one branch
  if (branches.length <= 1) {
    return null;
  }

  // Find active branch info
  const activeBranch = branches.find((b) => b.branchId === activeBranchId);

  return (
    <div className={styles.branchSwitcher}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        disabled={loading}
      >
        <span className={styles.icon}>🏥</span>
        <span className={styles.branchName}>
          {loading ? 'Loading...' : activeBranch?.branch.name || 'Pilih Cabang'}
        </span>
        <span className={styles.arrow}>▼</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>Pilih Cabang</div>
            {branches.map((assignment) => (
              <button
                key={assignment.branchId}
                type="button"
                className={`${styles.dropdownItem} ${
                  assignment.branchId === activeBranchId ? styles.active : ''
                }`}
                onClick={() => handleSwitchBranch(assignment.branchId)}
              >
                {assignment.isPrimary && <span className={styles.primaryBadge}>⭐</span>}
                <span>{assignment.branch.name}</span>
                {assignment.branchId === activeBranchId && (
                  <span className={styles.checkmark}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
