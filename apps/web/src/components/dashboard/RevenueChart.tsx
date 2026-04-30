'use client';

import styles from './RevenueChart.module.css';
import { formatCurrency } from '@/lib/formatNumber';

interface RevenueChartProps {
  data: Array<{
    date: string;
    amount: number;
  }>;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.title}>📈 Grafik Revenue</h3>
        <div className={styles.empty}>Tidak ada data untuk ditampilkan</div>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount));
  const minAmount = Math.min(...data.map(d => d.amount));
  const range = maxAmount - minAmount || 1;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>📈 Grafik Revenue Harian</h3>
      <div className={styles.chart}>
        {data.map((item, index) => {
          const height = ((item.amount - minAmount) / range) * 100;
          const date = new Date(item.date);
          const day = date.getDate();
          
          return (
            <div key={index} className={styles.bar}>
              <div className={styles.barWrapper}>
                <div 
                  className={styles.barFill}
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${day}: ${formatCurrency(item.amount)}`}
                />
              </div>
              <div className={styles.barLabel}>{day}</div>
            </div>
          );
        })}
      </div>
      <div className={styles.legend}>
        <span>Tanggal</span>
      </div>
    </div>
  );
}
