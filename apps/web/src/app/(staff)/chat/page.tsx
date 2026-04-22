'use client';

import styles from './page.module.css';

export default function ChatPage() {
  return (
    <div className={styles.container}>
      <div className={styles.constructionCard}>
        <div className={styles.icon}>💬</div>
        <h1 className={styles.title}>Chat</h1>
        <p className={styles.subtitle}>Under Construction</p>
        <p className={styles.message}>
          Fitur chat sedang dalam pengembangan dan akan segera tersedia.
        </p>
        <div className={styles.badge}>Coming Soon</div>
      </div>
    </div>
  );
}
