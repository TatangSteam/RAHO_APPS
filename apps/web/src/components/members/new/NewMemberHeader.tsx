'use client';

interface NewMemberHeaderProps {
  onBack: () => void;
}

export default function NewMemberHeader({ onBack }: NewMemberHeaderProps) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
        ← Kembali
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px'
        }}>
          ➕
        </div>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>Daftarkan Member Baru</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Lengkapi form di bawah untuk mendaftarkan member baru</p>
        </div>
      </div>
    </div>
  );
}
