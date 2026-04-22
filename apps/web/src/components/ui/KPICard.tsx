'use client';

import { clsx } from 'clsx';

interface KPICardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan';
  badge?: string;
  onClick?: () => void;
}

const COLOR_MAP = {
  blue: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)', text: '#60a5fa' },
  green: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.25)', text: '#4ade80' },
  amber: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', text: '#fbbf24' },
  red: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)', text: '#f87171' },
  purple: { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.25)', text: '#c084fc' },
  cyan: { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.25)', text: '#22d3ee' },
};

export function KPICard({ label, value, icon, color = 'blue', badge, onClick }: KPICardProps) {
  const colors = COLOR_MAP[color];

  return (
    <div
      className={clsx('card', onClick && 'clickable')}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {label}
        </p>
        {icon && (
          <div style={{
            width: 36,
            height: 36,
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.text,
          }}>
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <p style={{ fontSize: 32, fontWeight: 700, color: colors.text }}>
          {value}
        </p>
        {badge && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            background: color === 'red' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            color: color === 'red' ? '#f87171' : '#4ade80',
            borderRadius: 99,
            border: `1px solid ${color === 'red' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}