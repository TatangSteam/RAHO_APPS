import { BranchDetail } from './types';
import styles from './page.module.css';

interface StatsCardsProps {
  branch: BranchDetail;
}

export default function StatsCards({ branch }: StatsCardsProps) {
  return (
    <div className={styles.statsGrid}>
      <div className={styles.statCard}>
        <div className={styles.statIcon}>👥</div>
        <div className={styles.statContent}>
          <div className={styles.statValue}>{branch.stats.activeUsers}</div>
          <div className={styles.statLabel}>User Aktif</div>
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statIcon}>🧑‍⚕️</div>
        <div className={styles.statContent}>
          <div className={styles.statValue}>{branch.stats.totalMembers}</div>
          <div className={styles.statLabel}>Total Member</div>
        </div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statIcon}>📦</div>
        <div className={styles.statContent}>
          <div className={styles.statValue}>{branch.stats.activePackages}</div>
          <div className={styles.statLabel}>Paket Aktif</div>
        </div>
      </div>
    </div>
  );
}
