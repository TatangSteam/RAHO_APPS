'use client';

import { useState } from 'react';
import { StockRequest } from '../types';
import { showToast } from '@/lib/toast';
import modalStyles from '@/components/members/AssignPackageModal.module.css';

interface UploadPaymentModalProps {
  request: StockRequest;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  loading: boolean;
}

export default function UploadPaymentModal({ 
  request, 
  onClose, 
  onUpload, 
  loading 
}: UploadPaymentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      showToast.error('Hanya file gambar yang diperbolehkan');
      return;
    }
    
    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 5MB');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showToast.error('Pilih file bukti pembayaran terlebih dahulu');
      return;
    }
    await onUpload(file);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  return (
    <div className={modalStyles.modalBackdrop} onClick={onClose}>
      <div className={modalStyles.modalContainer} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        {/* Header */}
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.modalTitle}>📤 Upload Bukti Pembayaran</h2>
          <button className={modalStyles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className={modalStyles.modalBody}>
          {/* Request Info Section */}
          <div className={modalStyles.section}>
            <div className={modalStyles.sectionBox} style={{ 
              background: 'rgba(148, 163, 184, 0.1)', 
              borderColor: 'rgba(148, 163, 184, 0.3)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '4px' }}>{request.requestCode}</p>
                  <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {request.branchName}
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                    }}>
                      PARTNERSHIP
                    </span>
                  </p>
                </div>
                <div style={{ 
                  padding: '6px 12px', 
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                }}>
                  💰 Menunggu Pembayaran
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className={modalStyles.section}>
            <div className={`${modalStyles.sectionBox} ${modalStyles.basicSection}`}>
              <h3 className={`${modalStyles.sectionTitle} ${modalStyles.basicTitle}`}>
                💡 Informasi
              </h3>
              <p style={{ 
                fontSize: '0.875rem', 
                color: 'var(--text-secondary)', 
                margin: 0,
                lineHeight: 1.6,
              }}>
                Upload bukti pembayaran yang dikirimkan oleh Admin Cabang melalui WhatsApp atau Email. 
                Setelah diupload, Anda dapat memverifikasi dan mengkonfirmasi pembayaran.
              </p>
            </div>
          </div>

          {/* Invoice Info */}
          {request.invoice && (
            <div className={modalStyles.section}>
              <div className={`${modalStyles.sectionBox} ${modalStyles.discountSection}`}>
                <h3 className={`${modalStyles.sectionTitle} ${modalStyles.discountTitle}`}>
                  📄 Detail Invoice
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {request.invoice.invoiceNumber}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {request.itemCount} item
                    </p>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: '1.25rem', color: '#22c55e' }}>
                    {formatCurrency(request.invoice.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          <div className={modalStyles.section}>
            <div className={`${modalStyles.sectionBox} ${modalStyles.boosterSection}`}>
              <h3 className={`${modalStyles.sectionTitle} ${modalStyles.boosterTitle}`}>
                📎 File Bukti Pembayaran
              </h3>
              
              {!preview ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragActive ? '#a855f7' : 'rgba(168, 85, 247, 0.4)'}`,
                    borderRadius: '12px',
                    padding: '32px 24px',
                    textAlign: 'center',
                    backgroundColor: dragActive ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.05)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('payment-file-input')?.click()}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📷</div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {dragActive ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk memilih'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Format: JPG, PNG, JPEG (Maks. 5MB)
                  </p>
                  <input
                    id="payment-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ 
                    border: '1px solid rgba(168, 85, 247, 0.3)', 
                    borderRadius: '12px', 
                    overflow: 'hidden',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  }}>
                    <img 
                      src={preview} 
                      alt="Preview"
                      style={{ 
                        width: '100%', 
                        maxHeight: '300px', 
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </div>
                  <div style={{ 
                    marginTop: '12px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderRadius: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.25rem' }}>📎</span>
                      <div>
                        <p style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>
                          {file?.name}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                          {file ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeFile}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      ✕ Hapus
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={modalStyles.modalFooter}>
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: file ? '#a855f7' : 'rgba(168, 85, 247, 0.3)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading || !file ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Mengupload...' : '📤 Upload & Simpan'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgba(148, 163, 184, 0.2)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
