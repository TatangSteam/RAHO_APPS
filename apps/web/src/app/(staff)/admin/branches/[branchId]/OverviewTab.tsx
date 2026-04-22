import { BranchDetail } from './types';
import styles from './page.module.css';

interface OverviewTabProps {
  branch: BranchDetail;
}

export default function OverviewTab({ branch }: OverviewTabProps) {
  return (
    <div className={styles.overviewSection}>
      <div className={styles.infoCard}>
        <h3>📍 Informasi Lokasi</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Alamat:</span>
            <span className={styles.infoValue}>{branch.address}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Kota:</span>
            <span className={styles.infoValue}>{branch.city}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Telepon:</span>
            <span className={styles.infoValue}>{branch.phone}</span>
          </div>
          {branch.operatingHours && (
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Jam Operasional:</span>
              <span className={styles.infoValue}>{branch.operatingHours}</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.infoCard}>
        <h3>📅 Informasi Sistem</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Dibuat:</span>
            <span className={styles.infoValue}>
              {new Date(branch.createdAt).toLocaleString('id-ID')}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Terakhir Diupdate:</span>
            <span className={styles.infoValue}>
              {new Date(branch.updatedAt).toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
