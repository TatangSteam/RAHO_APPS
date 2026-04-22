'use client';

import styles from './page.module.css';

export default function NotificationsPage() {
  return (
    <div className={styles.container}>
      <div className={styles.constructionCard}>
        <div className={styles.icon}>🔔</div>
        <h1 className={styles.title}>Notifikasi</h1>
        <p className={styles.subtitle}>Under Construction</p>
        <p className={styles.message}>
          Fitur notifikasi sedang dalam pengembangan dan akan segera tersedia.
        </p>
        <div className={styles.badge}>Coming Soon</div>
      </div>
    </div>
  );
}
