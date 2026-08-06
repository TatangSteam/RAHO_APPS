'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect } from 'react';
import { getConsentDocumentsApi } from '@/lib/membersApi';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { showToast } from '@/lib/toast';
import { devLog, devError } from '@/lib/logger';
import styles from './ConsentDocumentsSection.module.css';

interface ConsentDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

interface Props {
  memberId: string;
  // Optional external state management for caching
  documents?: ConsentDocument[];
  loading?: boolean;
  error?: string | null;
  onLoadDocuments?: () => void;
}

export default function ConsentDocumentsSection({ 
  memberId,
  documents: externalDocuments,
  loading: externalLoading,
  error: externalError,
  onLoadDocuments
}: Props) {
  // Internal state (used only when external state is not provided)
  const [internalDocuments, setInternalDocuments] = useState<ConsentDocument[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Use external state if provided, otherwise use internal state
  const documents = externalDocuments !== undefined ? externalDocuments : internalDocuments;
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const error = externalError !== undefined ? externalError : internalError;

  const loadDocuments = async () => {
    // If external handler is provided, use it (for parent-managed state)
    if (onLoadDocuments) {
      onLoadDocuments();
      return;
    }

    // Otherwise, use internal loading logic (for standalone usage)
    try {
      setInternalLoading(true);
      setInternalError(null);
      devLog('🔍 [ConsentDocumentsSection] Loading documents for memberId:', memberId);
      const data = await getConsentDocumentsApi(memberId);
      devLog('✅ [ConsentDocumentsSection] Documents count:', data.documents?.length || 0);
      setInternalDocuments(data.documents);
    } catch (err) {
      assertCaughtError(err);
      devError('❌ [ConsentDocumentsSection] Error loading documents:', err);
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;
      
      // Map error codes to user-friendly Indonesian messages
      switch (errorCode) {
        case 'MEMBER_NOT_FOUND':
          setInternalError('Member tidak ditemukan');
          break;
        case 'BRANCH_ACCESS_DENIED':
          setInternalError('Anda tidak memiliki akses ke member ini');
          break;
        case 'STORAGE_UNAVAILABLE':
          setInternalError('Layanan penyimpanan tidak tersedia. Silakan coba lagi.');
          break;
        case 'DOCUMENT_NOT_FOUND':
          setInternalError('Dokumen tidak ditemukan');
          break;
        case 'FILE_NOT_FOUND':
          setInternalError('File tidak ditemukan');
          break;
        default:
          // Fallback to generic error message
          setInternalError(errorMessage || 'Gagal memuat dokumen');
      }
      
      devError('Failed to load consent documents:', err);
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    // Only load if using internal state and documents haven't been loaded yet
    if (externalDocuments === undefined && internalDocuments.length === 0 && !internalError) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const handleView = async (fileUrl: string) => {
    try {
      const blobUrl = await createAuthenticatedObjectUrl(fileUrl);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      assertCaughtError(err);
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;
      
      // Map error codes to user-friendly Indonesian messages
      switch (errorCode) {
        case 'DOCUMENT_NOT_FOUND':
          showToast.error('Dokumen tidak ditemukan');
          break;
        case 'FILE_NOT_FOUND':
          showToast.error('File tidak ditemukan');
          break;
        case 'STORAGE_UNAVAILABLE':
          showToast.error('Layanan penyimpanan tidak tersedia. Silakan coba lagi.');
          break;
        case 'BRANCH_ACCESS_DENIED':
          showToast.error('Anda tidak memiliki akses ke member ini');
          break;
        default:
          showToast.error(errorMessage || 'Gagal membuka dokumen');
      }
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const blobUrl = await createAuthenticatedObjectUrl(fileUrl);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.click();
    } catch (err) {
      assertCaughtError(err);
      const errorCode = err.response?.data?.error?.code;
      const errorMessage = err.response?.data?.error?.message;
      
      // Map error codes to user-friendly Indonesian messages
      switch (errorCode) {
        case 'DOCUMENT_NOT_FOUND':
          showToast.error('Dokumen tidak ditemukan');
          break;
        case 'FILE_NOT_FOUND':
          showToast.error('File tidak ditemukan');
          break;
        case 'STORAGE_UNAVAILABLE':
          showToast.error('Layanan penyimpanan tidak tersedia. Silakan coba lagi.');
          break;
        case 'BRANCH_ACCESS_DENIED':
          showToast.error('Anda tidak memiliki akses ke member ini');
          break;
        default:
          showToast.error(errorMessage || 'Gagal mengunduh dokumen');
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <p className={styles.loadingText}>⏳ Memuat dokumen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <p className={styles.errorText}>❌ {error}</p>
          <button
            type="button"
            onClick={loadDocuments}
            className={styles.retryButton}
            aria-label="Coba lagi memuat dokumen"
          >
            🔄 Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>📭 Belum ada dokumen persetujuan</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.documentsGrid} role="list">
        {documents.map((doc) => (
          <div key={doc.id} className={styles.documentCard} role="listitem">
            <div className={styles.documentInfo}>
              <p className={styles.fileName}>
                📄 {doc.fileName}
              </p>
              <div className={styles.metadataList}>
                <p className={styles.metadataItem}>
                  📅 {formatDate(doc.createdAt)}
                </p>
                <p className={styles.metadataItem}>
                  💾 {formatFileSize(doc.fileSize)}
                </p>
                <p className={styles.metadataItem}>
                  👤 {doc.uploadedBy || '—'}
                </p>
              </div>
            </div>
            <div className={styles.actionButtons}>
              <button
                type="button"
                onClick={() => handleView(doc.fileUrl)}
                className={`${styles.actionButton} ${styles.view}`}
                aria-label={`View document ${doc.fileName}`}
                title={`View ${doc.fileName}`}
              >
                👁️ Lihat
              </button>
              <button
                type="button"
                onClick={() => handleDownload(doc.fileUrl, doc.fileName)}
                className={`${styles.actionButton} ${styles.download}`}
                aria-label={`Download document ${doc.fileName}`}
                title={`Download ${doc.fileName}`}
              >
                ⬇️ Unduh
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
