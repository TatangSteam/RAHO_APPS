'use client';

import styles from './TopPackages.module.css';
import { formatCurrency } from '@/lib/formatNumber';

interface TopPackage {
  packageCode: string;
  count: number;
  totalRevenue: number;
}

interface TopPackagesProps {
  packages: TopPackage[];
}

export default function TopPackages({ packages }: TopPackagesProps) {
  const maxCount = Math.max(...packages.map(p => p.count), 1);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>🏆 Paket Terlaris</h3>
      {packages.length === 0 ? (
        <div className={styles.empty}>Belum ada data paket</div>
      ) : (
        <div className={styles.list}>
          {packages.map((pkg, index) => {
            const percentage = (pkg.count / maxCount) * 100;
            
            return (
              <div key={index} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemRank}>#{index + 1}</div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemName}>{pkg.packageCode}</div>
                    <div className={styles.itemStats}>
                      <span>{pkg.count} terjual</span>
                      <span className={styles.itemDivider}>•</span>
                      <span className={styles.itemRevenue}>{formatCurrency(pkg.totalRevenue)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
