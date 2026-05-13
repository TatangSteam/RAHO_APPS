'use client';

interface DocumentUploadSectionProps {
  pspFile: File | null;
  photoFile: File | null;
  photoPreview: string | null;
  onPspChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function DocumentUploadSection({
  pspFile,
  photoFile,
  photoPreview,
  onPspChange,
  onPhotoChange,
}: DocumentUploadSectionProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--surface-border)' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '18px'
        }}>
          C
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Upload Dokumen</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div>
          <label className="form-label">📋 Dokumen PSP</label>
          <div style={{
            border: '2px dashed var(--surface-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            textAlign: 'center',
            background: 'rgba(148,163,184,0.03)',
            transition: 'all var(--transition-fast)',
            cursor: 'pointer'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--color-primary-400)';
            e.currentTarget.style.background = 'rgba(59,130,246,0.05)';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--surface-border)';
            e.currentTarget.style.background = 'rgba(148,163,184,0.03)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--surface-border)';
            e.currentTarget.style.background = 'rgba(148,163,184,0.03)';
            const file = e.dataTransfer.files[0];
            if (file) {
              const fakeEvent = { target: { files: [file] } } as any;
              onPspChange(fakeEvent);
            }
          }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg,image/gif,image/bmp"
              onChange={onPspChange}
              style={{ display: 'none' }}
              id="psp-upload"
            />
            <label htmlFor="psp-upload" style={{ cursor: 'pointer', display: 'block' }}>
              {pspFile ? (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                  <p style={{ fontWeight: '600', color: '#22c55e', marginBottom: '4px' }}>{pspFile.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Klik untuk mengganti file</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                  <p style={{ fontWeight: '600', marginBottom: '4px' }}>Upload PSP / Informed Consent</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Max 5MB • JPG, PNG, WebP (gambar saja)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div>
          <label className="form-label">📸 Foto Member</label>
          <div style={{
            border: '2px dashed var(--surface-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            textAlign: 'center',
            background: 'rgba(148,163,184,0.03)',
            transition: 'all var(--transition-fast)',
            cursor: 'pointer'
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--color-primary-400)';
            e.currentTarget.style.background = 'rgba(59,130,246,0.05)';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--surface-border)';
            e.currentTarget.style.background = 'rgba(148,163,184,0.03)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--surface-border)';
            e.currentTarget.style.background = 'rgba(148,163,184,0.03)';
            const file = e.dataTransfer.files[0];
            if (file) {
              const fakeEvent = { target: { files: [file] } } as any;
              onPhotoChange(fakeEvent);
            }
          }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPhotoChange}
              style={{ display: 'none' }}
              id="photo-upload"
            />
            <label htmlFor="photo-upload" style={{ cursor: 'pointer', display: 'block' }}>
              {photoPreview ? (
                <div>
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{
                      width: '120px',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      margin: '0 auto 12px',
                      border: '3px solid var(--color-primary-400)'
                    }}
                  />
                  <p style={{ fontWeight: '600', color: '#22c55e', marginBottom: '4px' }}>{photoFile?.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Klik untuk mengganti foto</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
                  <p style={{ fontWeight: '600', marginBottom: '4px' }}>Upload Foto Member</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Max 5MB • JPG, PNG, WebP</p>
                </div>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
