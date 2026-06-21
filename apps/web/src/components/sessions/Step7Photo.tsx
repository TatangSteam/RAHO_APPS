'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { photoApi, type SessionPhoto } from '@/lib/photoApi';
import {
  uploadSupportingPhoto,
  getSupportingPhotosBySession,
  deleteSupportingPhoto,
  type SupportingPhoto
} from '@/lib/api/supportingPhotoApi';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { compressImageWithPreset, isImageFile } from '@/lib/imageCompressor';
import { devError } from '@/lib/logger';

interface Step7PhotoProps {
  sessionId: string;
  photo: SessionPhoto | null;
  isLocked: boolean;
  onComplete: () => void;
}

export default function Step7Photo({
  sessionId,
  photo,
  isLocked,
  onComplete,
}: Step7PhotoProps) {
  const { user } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; compressed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supporting photos state
  const [supportingPhotos, setSupportingPhotos] = useState<SupportingPhoto[]>([]);
  const [supportingPhotoPreviews, setSupportingPhotoPreviews] = useState<Record<string, string>>({});
  const [uploadingSupportingPhoto, setUploadingSupportingPhoto] = useState(false);
  const supportingPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      if (!photo?.fileUrl) {
        setPreview(null);
        return;
      }

      // Keep local previews (data URLs) as-is when uploading a new file.
      if (photo.fileUrl.startsWith('data:') || photo.fileUrl.startsWith('blob:')) {
        setPreview(photo.fileUrl);
        return;
      }

      try {
        const objectUrl = await createAuthenticatedObjectUrl(photo.fileUrl);
        if (!cancelled) {
          setPreview(objectUrl);
        }
      } catch (error) {
        devError('Failed to load session photo URL:', error);
        if (!cancelled) {
          setPreview(null);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [photo?.fileUrl]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // Load supporting photos
  useEffect(() => {
    if (!sessionId || isLocked) return;

    const loadSupportingPhotos = async () => {
      try {
        const photos = await getSupportingPhotosBySession(sessionId);
        setSupportingPhotos(photos);
      } catch (error) {
        devError('Failed to load supporting photos:', error);
      }
    };

    loadSupportingPhotos();
  }, [sessionId, isLocked]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    const loadSupportingPhotoPreviews = async () => {
      if (supportingPhotos.length === 0) {
        setSupportingPhotoPreviews({});
        return;
      }

      const previews: Record<string, string> = {};

      await Promise.all(
        supportingPhotos.map(async (supportingPhoto) => {
          if (!supportingPhoto.fileUrl) return;

          if (supportingPhoto.fileUrl.startsWith('data:') || supportingPhoto.fileUrl.startsWith('blob:')) {
            previews[supportingPhoto.id] = supportingPhoto.fileUrl;
            return;
          }

          try {
            const objectUrl = await createAuthenticatedObjectUrl(supportingPhoto.fileUrl);
            objectUrls.push(objectUrl);
            previews[supportingPhoto.id] = objectUrl;
          } catch (error) {
            devError('Failed to load supporting photo URL:', error);
          }
        })
      );

      if (!cancelled) {
        setSupportingPhotoPreviews(previews);
      } else {
        objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      }
    };

    loadSupportingPhotoPreviews();

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [supportingPhotos]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast.error('File harus berupa gambar');
      return;
    }

    // Validate file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 10MB');
      return;
    }

    // Compress the image first
    if (isImageFile(file)) {
      setCompressing(true);
      try {
        const result = await compressImageWithPreset(file, 'sessionPhoto');
        setPreview(URL.createObjectURL(result.blob));
        setCompressionInfo({
          original: result.originalSize,
          compressed: result.compressedSize
        });
        // Upload the compressed file
        await uploadPhoto(result.file);
      } catch (error) {
        devError('Error compressing image:', error);
        // Fallback to original file
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setCompressionInfo(null);
        await uploadPhoto(file);
      } finally {
        setCompressing(false);
      }
    }
  }, [sessionId, user?.userId, onComplete]);

  const uploadPhoto = async (file: File) => {
    setUploading(true);

    try {
      await photoApi.uploadPhoto(sessionId, file, user?.userId || '');
      showToast.success('Foto berhasil diupload');
      onComplete();
    } catch (error: any) {
      devError('Error uploading photo:', error);
      showToast.error(error.message || 'Gagal upload foto');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!photo) return;

    if (!confirm('Apakah Anda yakin ingin menghapus foto ini?')) return;

    try {
      await photoApi.deletePhoto(sessionId);
      showToast.success('Foto berhasil dihapus');
      setPreview(null);
      setCompressionInfo(null);
      onComplete();
    } catch (error: any) {
      devError('Error deleting photo:', error);
      showToast.error(error.message || 'Gagal menghapus foto');
    }
  };

  // Supporting photo handlers
  const handleUploadSupportingPhoto = () => {
    supportingPhotoInputRef.current?.click();
  };

  const handleSupportingPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast.error('File harus berupa gambar');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 10MB');
      e.target.value = '';
      return;
    }

    setUploadingSupportingPhoto(true);
    try {
      const newPhoto = await uploadSupportingPhoto({
        sessionId,
        file,
        description: '',
      });
      setSupportingPhotos((current) => [newPhoto, ...current]);
      showToast.success('Foto penunjang berhasil diupload');
    } catch (error: any) {
      devError('Error uploading supporting photo:', error);
      showToast.error(error.message || 'Gagal upload foto penunjang');
    } finally {
      setUploadingSupportingPhoto(false);
      e.target.value = '';
    }
  };

  const handleDeleteSupportingPhoto = async (photoId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus foto penunjang ini?')) return;

    try {
      await deleteSupportingPhoto(photoId);
      setSupportingPhotos((current) => current.filter((p) => p.id !== photoId));
      showToast.success('Foto penunjang berhasil dihapus');
    } catch (error: any) {
      devError('Error deleting supporting photo:', error);
      showToast.error(error.message || 'Gagal menghapus foto penunjang');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLocked) {
    return (
      <div style={{
        padding: '24px',
        background: 'rgba(148,163,184,0.05)',
        border: '2px solid rgba(148,163,184,0.2)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(148,163,184,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            fontWeight: '700',
            fontSize: '20px'
          }}>
            7
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#94a3b8', marginBottom: '4px' }}>
              📸 Upload Foto
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b' }}>
              Step sebelumnya harus diselesaikan terlebih dahulu
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      background: photo
        ? 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(22,163,74,0.05))'
        : 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(147,51,234,0.05))',
      border: photo
        ? '2px solid rgba(34,197,94,0.3)'
        : '2px solid rgba(59,130,246,0.3)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: photo
            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : 'linear-gradient(135deg, #3b82f6, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '20px',
          boxShadow: photo
            ? '0 4px 12px rgba(34,197,94,0.3)'
            : '0 4px 12px rgba(59,130,246,0.3)'
        }}>
          {photo ? '✓' : '7'}
        </div>
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#f1f5f9' }}>
            📸 Upload Foto Sesi
          </h3>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Upload foto dokumentasi sesi terapi (opsional)
          </p>
        </div>
      </div>

      {/* Photo Preview/Upload Area */}
      <div style={{
        padding: '24px',
        background: 'rgba(15,23,42,0.5)',
        border: '2px dashed rgba(148,163,184,0.3)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center'
      }}>
        {preview ? (
          <div>
            <div style={{
              position: 'relative',
              maxWidth: '600px',
              margin: '0 auto',
              marginBottom: '16px'
            }}>
              <img
                src={preview}
                alt="Session photo"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '400px',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(148,163,184,0.2)'
                }}
              />
            </div>

            {photo && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#94a3b8',
                flexWrap: 'wrap'
              }}>
                <span>📄 {photo.fileName}</span>
                <span>•</span>
                <span>📦 {formatFileSize(photo.fileSize)}</span>
                {compressionInfo && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#22c55e' }}>
                      ✓ Dikompresi dari {formatFileSize(compressionInfo.original)}
                    </span>
                  </>
                )}
                <span>•</span>
                <span>🕐 {new Date(photo.createdAt).toLocaleString('id-ID')}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || compressing}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: uploading || compressing ? 'not-allowed' : 'pointer',
                  opacity: uploading || compressing ? 0.5 : 1
                }}
              >
                {compressing ? '⏳ Mengkompresi...' : '🔄 Ganti Foto'}
              </button>

              {photo && (
                <button
                  onClick={handleDeletePhoto}
                  disabled={uploading || compressing}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: uploading || compressing ? 'not-allowed' : 'pointer',
                    opacity: uploading || compressing ? 0.5 : 1
                  }}
                >
                  🗑️ Hapus Foto
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 16px',
              background: compressing ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px'
            }}>
              {compressing ? '⏳' : '📸'}
            </div>

            <p style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9', marginBottom: '8px' }}>
              {compressing ? 'Mengkompresi Gambar...' : 'Upload Foto Sesi'}
            </p>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
              Format: JPG, PNG, GIF • Maksimal 10MB (akan dikompresi otomatis)
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || compressing}
              style={{
                padding: '12px 32px',
                background: uploading || compressing
                  ? 'rgba(59,130,246,0.3)'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: uploading || compressing ? 'not-allowed' : 'pointer',
                boxShadow: uploading || compressing ? 'none' : '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              {uploading ? '⏳ Mengupload...' : compressing ? '⏳ Mengkompresi...' : '📤 Pilih Foto'}
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={uploading || compressing}
        />
      </div>

      {photo && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: 'var(--color-success)'
        }}>
          ✓ Foto sesi telah diupload
        </div>
      )}

      {!photo && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: '#fbbf24',
          textAlign: 'center'
        }}>
          ℹ️ Upload foto bersifat opsional. Anda dapat melewati step ini dan klik save untuk melanjutkan.
        </div>
      )}

      {/* Supporting Photos Section */}
      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px dashed rgba(148,163,184,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9' }}>
            📷 Foto Penunjang ({supportingPhotos.length})
          </h4>
          <button
            onClick={handleUploadSupportingPhoto}
            disabled={uploadingSupportingPhoto}
            style={{
              padding: '8px 16px',
              background: uploadingSupportingPhoto
                ? 'rgba(139,92,246,0.3)'
                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: uploadingSupportingPhoto ? 'not-allowed' : 'pointer',
              opacity: uploadingSupportingPhoto ? 0.5 : 1
            }}
          >
            {uploadingSupportingPhoto ? '⏳ Mengupload...' : '➕ Upload Foto Penunjang'}
          </button>
          <input
            ref={supportingPhotoInputRef}
            type="file"
            accept="image/*"
            onChange={handleSupportingPhotoSelect}
            style={{ display: 'none' }}
            disabled={uploadingSupportingPhoto}
          />
        </div>

        {supportingPhotos.length === 0 ? (
          <div style={{
            padding: '32px',
            background: 'rgba(15,23,42,0.3)',
            border: '2px dashed rgba(148,163,184,0.2)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>
              Belum ada foto penunjang. Klik tombol di atas untuk menambahkan.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {supportingPhotos.map((supportingPhoto) => {
              const previewUrl = supportingPhotoPreviews[supportingPhoto.id];

              return (
                <div
                  key={supportingPhoto.id}
                  style={{
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    transition: 'transform 0.2s'
                  }}
                >
                  <div style={{ position: 'relative', paddingBottom: '75%', background: '#0f172a' }}>
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={supportingPhoto.description || 'Supporting photo'}
                        style={{
                          position: 'absolute',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                        fontSize: '13px',
                        textAlign: 'center',
                        padding: '12px'
                      }}>
                        Memuat preview...
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px' }}>
                    {supportingPhoto.description && (
                      <p style={{
                        fontSize: '13px',
                        color: '#f1f5f9',
                        marginBottom: '8px',
                        wordBreak: 'break-word'
                      }}>
                        {supportingPhoto.description}
                      </p>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: '#64748b',
                      marginBottom: '8px'
                    }}>
                      <span>{formatFileSize(supportingPhoto.fileSize)}</span>
                      <span>{new Date(supportingPhoto.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteSupportingPhoto(supportingPhoto.id)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
