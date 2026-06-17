interface SendNotificationModalProps {
  show: boolean;
  title: string;
  message: string;
  sending: boolean;
  onClose: () => void;
  onTitleChange: (title: string) => void;
  onMessageChange: (message: string) => void;
  onSubmit: () => void;
}

export default function SendNotificationModal({
  show,
  title,
  message,
  sending,
  onClose,
  onTitleChange,
  onMessageChange,
  onSubmit
}: SendNotificationModalProps) {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.86)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '80px 24px 24px',
      overflowY: 'auto'
    }}>
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
          animation: 'fadeIn 0.2s',
          background: 'var(--surface-card)',
          border: '1px solid rgba(148,163,184,0.28)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.72)',
          color: 'var(--text-primary)',
        }}
      >
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>📧 Kirim Notifikasi</h3>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label">Judul</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="form-input"
            placeholder="Masukkan judul notifikasi"
          />
        </div>
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Pesan</label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={4}
            className="form-input"
            placeholder="Masukkan pesan notifikasi"
            style={{ resize: 'vertical', minHeight: '100px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={sending}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {sending ? '⏳ Mengirim...' : '📤 Kirim'}
          </button>
        </div>
      </div>
    </div>
  );
}
