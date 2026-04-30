'use client';

import styles from './StatCard.module.css';

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient: string;
}

export default function StatCard({ icon, label, value, subtitle, trend, gradient }: StatCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.iconWrapper} style={{ background: gradient }}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={styles.content}>
        <p className={styles.label}>{label}</p>
        <h3 className={styles.value}>{value}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {trend && (
          <div className={`${styles.trend} ${trend.isPositive ? styles.positive : styles.negative}`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
