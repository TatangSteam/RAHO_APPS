'use client';

interface ErrorAlertProps {
  message: string;
}

export default function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div style={{
      padding: '16px 20px',
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 'var(--radius-lg)',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <span style={{ fontSize: '24px' }}>⚠️</span>
      <span style={{ color: '#ef4444', fontWeight: '500' }}>{message}</span>
    </div>
  );
}
