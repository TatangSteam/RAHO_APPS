'use client';

import styles from './RecentTransactions.module.css';
import { formatCurrency } from '@/lib/formatNumber';

interface Transaction {
  invoiceNumber: string;
  memberNo: string;
  memberName: string;
  amount: number;
  paidAt: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>💳 Transaksi Terbaru</h3>
      {transactions.length === 0 ? (
        <div className={styles.empty}>Belum ada transaksi</div>
      ) : (
        <div className={styles.list}>
          {transactions.map((transaction, index) => (
            <div key={index} className={styles.item}>
              <div className={styles.itemIcon}>📄</div>
              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemTitle}>{transaction.memberName}</span>
                  <span className={styles.itemAmount}>{formatCurrency(transaction.amount)}</span>
                </div>
                <div className={styles.itemFooter}>
                  <span className={styles.itemMeta}>{transaction.memberNo}</span>
                  <span className={styles.itemDivider}>•</span>
                  <span className={styles.itemMeta}>{transaction.invoiceNumber}</span>
                  <span className={styles.itemDivider}>•</span>
                  <span className={styles.itemDate}>{formatDate(transaction.paidAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
