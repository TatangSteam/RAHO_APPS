'use client';

import type { StandaloneAddOn } from '@/types/package';
import { ShoppingBag } from 'lucide-react';
import PackageCard from './PackageCard';
import styles from './MemberPackagesTab.module.css';

interface Props {
  addOns: StandaloneAddOn[];
  loading: boolean;
  onVerifyPayment?: (
    addOnId: string,
    status: string,
    proofUrl?: string,
    proofFileName?: string,
  ) => void;
}

export default function MemberAddOnsTab({ addOns, loading, onVerifyPayment }: Props) {
  if (loading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.loadingText}>Memuat transaksi Air Nano & Add-On...</div>
      </div>
    );
  }

  if (addOns.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">
          <ShoppingBag size={32} />
        </div>
        <div className={styles.emptyTitle}>Belum ada transaksi Add-On</div>
        <div className={styles.emptyDescription}>
          Transaksi Air Nano dan produk tambahan member akan tampil di sini.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.packagesGrid}>
      {addOns.map(addOn => (
        <PackageCard
          key={addOn.addOnId}
          pkg={addOn}
          onVerifyPayment={onVerifyPayment}
        />
      ))}
    </div>
  );
}
