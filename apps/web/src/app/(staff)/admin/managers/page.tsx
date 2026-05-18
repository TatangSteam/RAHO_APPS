'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { AdminManagersTab } from '@/components/admin/AdminManagersTab';
import { showToast } from '@/lib/toast';
import styles from './page.module.css';

export default function AdminManagersPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Only SUPER_ADMIN can access this page
    if (user.role !== 'SUPER_ADMIN') {
      showToast.error('Akses ditolak - Hanya untuk Super Admin');
      router.push('/dashboard');
      return;
    }
  }, [user, router]);

  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}>⏳</div>
        <p>Memuat...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>👥</div>
          <div className={styles.headerText}>
            <h1>Admin Managers</h1>
            <p>Kelola Admin Manager dan assign cabang</p>
          </div>
        </div>
      </div>

      {/* Admin Managers Tab Component */}
      <div className={styles.content}>
        <AdminManagersTab />
      </div>
    </div>
  );
}
