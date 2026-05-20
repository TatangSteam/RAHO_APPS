'use client';

import { useState } from 'react';

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
  const [pspPreview, setPspPreview] = useState<string | null>(null);
  const [showPspModal, setShowPspModal] = useState(false);

  const handlePspChangeWithPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPspPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // For PDF, create object URL
        setPspPreview(URL.createObjectURL(file));
      }
    }
    onPspChange(e);
  };

  const isPdf = pspFile?.type === 'application/pdf';

  const handleViewPsp = () => {
    if (pspPreview) {
      if (isPdf) {
        // Open PDF in new tab
        window.open(pspPreview, '_blank');
      } else {
        // Show image in modal
        setShowPspModal(true);
      }
    }
  };

  const handleDownloadPsp = () => {
    if (pspFile && pspPreview) {
      const link = document.createElement('a');
      link.href = pspPreview;
      link.download = pspFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

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
          fontSize: '18px',
          flexShrink: 0
        }}>
          C
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Upload Dokumen</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        {/* PSP Upload */}
        <div className="upload-col">
          <label className="form-label">📋 Dokumen PSP</label>
          <div style={{
            border: '2px dashed var(--surface-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            textAlign: 'center',
            background: 'rgba(148,163,184,0.03)',
            transition: 'all var(--transition-fast)',
            cursor: 'pointer',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
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
              handlePspChangeWithPreview(fakeEvent);
            }
          }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg,image/gif,image/bmp,application/pdf"
              onChange={handlePspChangeWithPreview}
              style={{ display: 'none' }}
              id="psp-upload"
            />
            <label htmlFor="psp-upload" style={{ cursor: 'pointer', display: 'block' }}>
              {pspFile ? (
                <div>
                  {isPdf ? (
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                  ) : pspPreview ? (
                    <img
                      src={pspPreview}
                      alt="PSP Preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '120px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        marginBottom: '12px'
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                  )}
                  <p style={{ fontWeight: '600', color: '#22c55e', marginBottom: '4px', wordBreak: 'break-all' }}>{pspFile.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {(pspFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📄</div>
                  <p style={{ fontWeight: '600', marginBottom: '4px' }}>Upload PSP / Informed Consent</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Max 5MB • JPG, PNG, WebP, PDF</p>
                </div>
              )}
            </label>
          </div>
          
          {/* View/Download buttons */}
          {pspFile && pspPreview && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleViewPsp}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, minWidth: '100px' }}
              >
                👁️ Lihat
              </button>
              <button
                type="button"
                onClick={handleDownloadPsp}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, minWidth: '100px' }}
              >
                📥 Download
              </button>
              <button
                type="button"
                onClick={() => {
                  setPspPreview(null);
                  const input = document.getElementById('psp-upload') as HTMLInputElement;
                  if (input) input.value = '';
                  onPspChange({ target: { files: null } } as any);
                }}
                className="btn btn-danger btn-sm"
                style={{ minWidth: '80px' }}
              >
                🗑️ Hapus
              </button>
            </div>
          )}
        </div>

        {/* Photo Upload */}
        <div className="upload-col">
          <label className="form-label">📸 Foto Member</label>
          <div style={{
            border: '2px dashed var(--surface-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            textAlign: 'center',
            background: 'rgba(148,163,184,0.03)',
            transition: 'all var(--transition-fast)',
            cursor: 'pointer',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
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
                  <p style={{ fontWeight: '600', color: '#22c55e', marginBottom: '4px', wordBreak: 'break-all' }}>{photoFile?.name}</p>
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

      {/* PSP Image Modal */}
      {showPspModal && pspPreview && !isPdf && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowPspModal(false)}
        >
          <div 
            style={{
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>📋 Dokumen PSP</h3>
              <button
                type="button"
                onClick={() => setShowPspModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                ✕
              </button>
            </div>
            <img
              src={pspPreview}
              alt="PSP Document"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: '8px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleDownloadPsp}
                className="btn btn-primary"
              >
                📥 Download
              </button>
              <button
                type="button"
                onClick={() => setShowPspModal(false)}
                className="btn btn-secondary"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .upload-col {
          grid-column: span 6;
        }
        @media (max-width: 768px) {
          .upload-col {
            grid-column: span 12;
          }
        }
      `}</style>
    </div>
  );
}
