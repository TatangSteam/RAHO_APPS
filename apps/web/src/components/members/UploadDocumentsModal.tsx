'use client';

import AppImage from '@/components/ui/AppImage';
import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Image as ImageIcon, Check, File } from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/toast';

interface UploadDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
  hasDocuments?: boolean; // Indicates if member has any documents
}

export default function UploadDocumentsModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  onSuccess,
  hasDocuments = false,
}: UploadDocumentsModalProps) {
  const [activeTab, setActiveTab] = useState<'psp' | 'photo'>('psp');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('psp');
      setFile(null);
      setPreview(null);
      setUploading(false);
    }
  }, [isOpen]);

  // Clean up preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      console.log('Selected file:', {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size
      });
      
      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
      const validPdfTypes = ['application/pdf'];
      const allValidTypes = activeTab === 'psp' 
        ? [...validImageTypes, ...validPdfTypes]
        : validImageTypes;
      
      if (!allValidTypes.includes(selectedFile.type)) {
        alert(`Format file tidak didukung: ${selectedFile.type}\nFormat yang diizinkan: ${activeTab === 'psp' ? 'JPG, PNG, WebP, GIF, BMP, PDF' : 'JPG, PNG, WebP, GIF, BMP'}`);
        e.target.value = ''; // Reset input
        return;
      }
      
      // Validate file size (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        alert(`Ukuran file terlalu besar: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB\nMaksimal: 5MB`);
        e.target.value = ''; // Reset input
        return;
      }
      
      setFile(selectedFile);
      
      // Create preview URL for images
      if (selectedFile.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(selectedFile);
        setPreview(previewUrl);
      } else if (selectedFile.type === 'application/pdf') {
        // For PDF, we'll show a placeholder icon
        setPreview('pdf');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      console.log('Uploading file:', {
        name: file.name,
        type: file.type,
        size: file.size,
        documentType: activeTab === 'psp' ? 'PERSETUJUAN_SETELAH_PENJELASAN' : 'FOTO_PROFIL'
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', 
        activeTab === 'psp' ? 'PERSETUJUAN_SETELAH_PENJELASAN' : 'FOTO_PROFIL'
      );

      const response = await api.post(`/members/${memberId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Upload success:', response.data);
      showToast.success(`${activeTab === 'psp' ? 'Informed consent' : 'Foto profil'} berhasil diunggah.`);
      setFile(null);
      setPreview(null);
      onSuccess();
      onClose();
    } catch (err) {
      assertCaughtError(err);
      console.error('Upload error:', err);
      console.error('Error response:', err.response?.data);
      
      const errorMessage = err.response?.data?.error?.message || err.message || 'Gagal upload file';
      const errorCode = err.response?.data?.error?.code || 'UNKNOWN_ERROR';
      
      showToast.error(`${errorMessage} (${errorCode})`);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-2xl rounded-2xl shadow-2xl"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--surface-border)'
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-6 py-5"
            style={{ borderBottom: '1px solid var(--surface-border)' }}
          >
            <div>
              <h2 
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {hasDocuments ? 'Ganti Dokumen Member' : 'Upload Dokumen Member'}
              </h2>
              <p 
                className="text-sm mt-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {memberName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div 
            className="flex"
            style={{ borderBottom: '1px solid var(--surface-border)' }}
          >
            <button
              onClick={() => {
                setActiveTab('psp');
                setFile(null);
                setPreview(null);
              }}
              className="flex-1 py-4 text-sm font-semibold transition-colors"
              style={{
                color: activeTab === 'psp' ? 'var(--color-primary-400)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'psp' ? '2px solid var(--color-primary-500)' : '2px solid transparent'
              }}
            >
              <FileText className="h-5 w-5 inline-block mr-2" />
              Informed Consent (PSP)
            </button>
            <button
              onClick={() => {
                setActiveTab('photo');
                setFile(null);
                setPreview(null);
              }}
              className="flex-1 py-4 text-sm font-semibold transition-colors"
              style={{
                color: activeTab === 'photo' ? 'var(--color-primary-400)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'photo' ? '2px solid var(--color-primary-500)' : '2px solid transparent'
              }}
            >
              <ImageIcon className="h-5 w-5 inline-block mr-2" />
              Foto Profil
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {!file ? (
              // Upload area (no file selected)
              <div 
                className="border-2 border-dashed rounded-xl p-8 text-center"
                style={{ borderColor: 'var(--surface-border)' }}
              >
                <Upload 
                  className="h-12 w-12 mx-auto mb-4"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                
                <input
                  type="file"
                  accept={activeTab === 'psp' ? 'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,application/pdf' : 'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp'}
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: 'var(--color-primary-500)',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-600)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-primary-500)'}
                >
                  Pilih File
                </label>
                
                <p 
                  className="text-sm mt-4"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {activeTab === 'psp' 
                    ? 'Format: JPG, PNG, WebP, GIF, BMP, PDF (Maks 5MB)'
                    : 'Format: JPG, PNG, WebP, GIF, BMP (Maks 5MB)'}
                </p>
              </div>
            ) : (
              // Preview area (file selected)
              <div className="space-y-4">
                {/* File info */}
                <div 
                  className="p-3 rounded-lg flex items-center gap-3"
                  style={{
                    background: 'var(--color-success-100)',
                    border: '1px solid var(--color-success-300)'
                  }}
                >
                  <Check 
                    className="h-5 w-5 flex-shrink-0"
                    style={{ color: 'var(--color-success-600)' }}
                  />
                  <span 
                    className="text-sm font-medium flex-1 truncate"
                    style={{ color: 'var(--color-success-700)' }}
                  >
                    {file.name}
                  </span>
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--color-success-600)' }}
                  >
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>

                {/* Preview */}
                <div 
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--surface-ground)',
                    border: '1px solid var(--surface-border)'
                  }}
                >
                  {preview === 'pdf' ? (
                    // PDF placeholder
                    <div className="flex flex-col items-center justify-center py-12">
                      <File 
                        className="h-24 w-24 mb-4"
                        style={{ color: 'var(--color-primary-400)' }}
                      />
                      <p 
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {file.name}
                      </p>
                      <p 
                        className="text-xs mt-1"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        PDF Document
                      </p>
                    </div>
                  ) : preview ? (
                    // Image preview
                    <AppImage
                      src={preview}
                      alt="Preview"
                      className="w-full h-auto max-h-[400px] object-contain"
                    />
                  ) : null}
                </div>

                {/* Change file button */}
                <div className="text-center">
                  <label
                    htmlFor="file-upload"
                    className="inline-block px-4 py-2 rounded-lg cursor-pointer transition-colors text-sm"
                    style={{
                      background: 'var(--surface-hover)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--surface-border)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-border)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                  >
                    Ganti File
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div 
            className="flex items-center justify-end gap-3 px-6 py-4"
            style={{
              borderTop: '1px solid var(--surface-border)',
              background: 'var(--surface-ground)'
            }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{
                color: 'var(--text-primary)',
                background: 'transparent',
                border: '1px solid var(--surface-border)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              disabled={uploading}
            >
              Batal
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: file && !uploading ? 'var(--color-primary-500)' : 'var(--surface-border)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                if (file && !uploading) {
                  e.currentTarget.style.background = 'var(--color-primary-600)';
                }
              }}
              onMouseLeave={(e) => {
                if (file && !uploading) {
                  e.currentTarget.style.background = 'var(--color-primary-500)';
                }
              }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
