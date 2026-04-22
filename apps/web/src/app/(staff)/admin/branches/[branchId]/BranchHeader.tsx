import { BranchDetail } from './types';
import styles from './page.module.css';

interface BranchHeaderProps {
  branch: BranchDetail;
  onBack: () => void;
}

export default function BranchHeader({ branch, onBack }: BranchHeaderProps) {
  return (
    <div className={styles.header}>
      <button onClick={onBack} className={styles.backBtn}>
        ← Kembali
      </button>
      <div className={styles.headerInfo}>
        <div>
          <h1>{branch.name}</h1>
          <p className={styles.branchCode}>{branch.branchCode}</p>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.typeBadge} ${styles[branch.type.toLowerCase()]}`}>
            {branch.type === 'KLINIK' ? '🏥 Klinik' : 
             branch.type === 'HOMECARE' ? '🏠 Homecare' :
             branch.type === 'PREMIERE' ? '⭐ Premiere' : '🤝 Partnership'}
          </span>
          <span className={`${styles.statusBadge} ${branch.isActive ? styles.active : styles.inactive}`}>
            {branch.isActive ? '✓ Aktif' : '✗ Nonaktif'}
          </span>
        </div>
      </div>
    </div>
  );
}
