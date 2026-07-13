"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { MemberDetail } from '@/types/member';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { Key, Loader2, Trash2, Upload } from 'lucide-react';
import { devError } from '@/lib/logger';

interface MemberHeaderProps {
  member: MemberDetail;
  onBack: () => void;
  onSendNotification: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onManageCredentials?: () => void;
  onUploadDocuments?: () => void;
  isSuperAdmin: boolean;
  canDelete?: boolean;
  isDeleting?: boolean;
  canUploadDocuments?: boolean;
  hasDocuments?: boolean; // Indicates if member has any documents (PSP or Photo)
}

type HeaderActionTone = 'success' | 'warning' | 'danger';

interface HeaderIconActionProps {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  tone: HeaderActionTone;
  disabled?: boolean;
}

const headerActionBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const headerActionToneStyles: Record<HeaderActionTone, CSSProperties> = {
  success: {
    background: 'linear-gradient(135deg, #10b98120, #06b6d420)',
    borderColor: '#10b98150',
    color: '#10b981',
  },
  warning: {
    background: 'linear-gradient(135deg, #f59e0b20, #d9770620)',
    borderColor: '#f59e0b50',
    color: '#f59e0b',
  },
  danger: {
    background: 'linear-gradient(135deg, #ef444420, #dc262620)',
    borderColor: '#ef444450',
    color: '#ef4444',
  },
};

const disabledActionStyle: CSSProperties = {
  opacity: 0.7,
  cursor: 'not-allowed',
};

function HeaderIconAction({ children, icon, onClick, tone, disabled = false }: HeaderIconActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn btn-secondary member-detail-action-button"
      style={{
        ...headerActionBaseStyle,
        ...headerActionToneStyles[tone],
        ...(disabled ? disabledActionStyle : undefined),
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export default function MemberHeader({ 
  member, 
  onBack, 
  onSendNotification, 
  onEdit, 
  onDelete,
  onManageCredentials, 
  onUploadDocuments,
  isSuperAdmin,
  canDelete = false,
  isDeleting = false,
  canUploadDocuments = false,
  hasDocuments = false
}: MemberHeaderProps) {
  // Get profile photo from documents
  const profilePhoto = member.documents?.find(doc => doc.documentType === 'FOTO_PROFIL');
  const hasInformedConsent = member.documents?.some(
    doc => doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN'
  );
  const missingWarnings = [
    !member.profile?.phone?.trim() ? 'No HP belum terisi' : null,
    !hasInformedConsent ? 'Inform consent belum terisi' : null,
  ].filter(Boolean) as string[];
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfilePhoto = async () => {
      if (!profilePhoto?.fileUrl) {
        setProfilePhotoUrl(null);
        return;
      }

      try {
        const url = await createAuthenticatedObjectUrl(profilePhoto.fileUrl);
        if (!cancelled) {
          setProfilePhotoUrl(url);
        }
      } catch (error) {
        devError('Failed to load member profile photo:', error);
        if (!cancelled) {
          setProfilePhotoUrl(null);
        }
      }
    };

    loadProfilePhoto();

    return () => {
      cancelled = true;
    };
  }, [profilePhoto?.fileUrl]);

  useEffect(() => {
    return () => {
      if (profilePhotoUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(profilePhotoUrl);
      }
    };
  }, [profilePhotoUrl]);
  
  return (
    <div style={{ marginBottom: '24px' }}>
      <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ marginBottom: '16px' }}>
        ← Kembali
      </button>
      <div className="member-detail-header">
        <div className="member-detail-profile-wrap">
          <div className="member-detail-profile">
            <div className="member-detail-avatar" style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: profilePhoto ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '700',
              fontSize: '32px',
              position: 'relative',
              overflow: 'visible',
              border: '3px solid var(--surface-border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              {profilePhoto && profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt={member.profile?.fullName || 'Member'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                />
              ) : (
                (member.profile?.fullName || 'M').charAt(0).toUpperCase()
              )}
              {member.user?.isActive && !member.isDeceased && (
                <span style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '20px',
                  height: '20px',
                  background: '#22c55e',
                  border: '3px solid var(--surface-card)',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 2px var(--surface-card)'
                }}></span>
              )}
            </div>
            <div className="member-detail-identity">
              <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>{member.profile?.fullName || 'Nama tidak tersedia'}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{member.memberNo}</span> • 🏢 {member.registrationBranch?.name || 'N/A'}
              </p>
              {member.isDeceased && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginTop: '8px',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  Status: Meninggal
                </span>
              )}
              {missingWarnings.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {missingWarnings.map((warning) => (
                    <span
                      key={warning}
                      title={warning}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        background: 'rgba(245, 158, 11, 0.14)',
                        color: '#f59e0b',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {warning}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="member-detail-actions">
          <button onClick={onSendNotification} className="btn btn-secondary member-detail-action-button">
            📧 Kirim Notifikasi
          </button>
          {canUploadDocuments && onUploadDocuments && (
            <HeaderIconAction
              onClick={onUploadDocuments} 
              tone="success"
              icon={<Upload size={16} />}
            >
              {hasDocuments ? 'Ganti Dokumen' : 'Upload Dokumen'}
            </HeaderIconAction>
          )}
          {isSuperAdmin && onManageCredentials && (
            <HeaderIconAction
              onClick={onManageCredentials} 
              tone="warning"
              icon={<Key size={16} />}
            >
              Kredensial
            </HeaderIconAction>
          )}
          {isSuperAdmin && (
            <button onClick={onEdit} className="btn btn-primary member-detail-action-button">
              ✏️ Edit
            </button>
          )}
          {canDelete && onDelete && (
            <HeaderIconAction
              onClick={onDelete} 
              disabled={isDeleting}
              tone="danger"
              icon={isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            >
              {isDeleting ? 'Menghapus...' : 'Hapus Member'}
            </HeaderIconAction>
          )}
        </div>
      </div>
    </div>
  );
}
