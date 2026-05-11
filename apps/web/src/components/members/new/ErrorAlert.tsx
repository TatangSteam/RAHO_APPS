'use client';

interface ErrorAlertProps {
  message: string;
}

export default function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div 
      className="error-alert-banner"
      style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        border: '2px solid #ef4444',
        borderLeft: '6px solid #dc2626',
        borderRadius: '0',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
        animation: 'errorSlideDown 0.3s ease-out'
      }}
    >
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
      }}>
        <span style={{ fontSize: '28px' }}>⚠️</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ 
          color: '#991b1b', 
          fontWeight: '700',
          fontSize: '16px',
          marginBottom: '4px'
        }}>
          Error
        </div>
        <div style={{ 
          color: '#dc2626', 
          fontWeight: '600',
          fontSize: '15px',
          lineHeight: '1.5'
        }}>
          {message}
        </div>
      </div>
    </div>
  );
}
