"use client";

import { useEffect, useState } from 'react';
import { MemberDetail } from '@/types/member';
import { createAuthenticatedObjectUrl } from '@/lib/fileApi';
import { Key, Upload } from 'lucide-react';
import { devError } from '@/lib/logger';

interface MemberHeaderProps {
  member: MemberDetail;
  onBack: () => void;
  onSendNotification: () => void;
  onEdit: () => void;
  onManageCredentials?: () => void;
  onUploadDocuments?: () => void;
  isSuperAdmin: boolean;
  canUploadDocuments?: boolean;
  hasDocuments?: boolean; // Indicates if member has any documents (PSP or Photo)
}

export default function MemberHeader({ 
  member, 
  onBack, 
  onSendNotification, 
  onEdit, 
  onManageCredentials, 
  onUploadDocuments,
  isSuperAdmin,
  canUploadDocuments = false,
  hasDocuments = false
}: MemberHeaderProps) {
  // Get profile photo from documents
  const profilePhoto = member.documents?.find(doc => doc.documentType === 'FOTO_PROFIL');
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <div style={{
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
              {member.user?.isActive && (
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
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>{member.profile?.fullName || 'Nama tidak tersedia'}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{member.memberNo}</span> • 🏢 {member.registrationBranch?.name || 'N/A'}
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onSendNotification} className="btn btn-secondary">
            📧 Kirim Notifikasi
          </button>
          {canUploadDocuments && onUploadDocuments && (
            <button 
              onClick={onUploadDocuments} 
              className="btn btn-secondary"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                background: 'linear-gradient(135deg, #10b98120, #06b6d420)',
                borderColor: '#10b98150',
                color: '#10b981'
              }}
            >
              <Upload size={16} />
              {hasDocuments ? 'Ganti Dokumen' : 'Upload Dokumen'}
            </button>
          )}
          {isSuperAdmin && onManageCredentials && (
            <button 
              onClick={onManageCredentials} 
              className="btn btn-secondary"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                background: 'linear-gradient(135deg, #f59e0b20, #d9770620)',
                borderColor: '#f59e0b50',
                color: '#f59e0b'
              }}
            >
              <Key size={16} />
              Kredensial
            </button>
          )}
          {isSuperAdmin && (
            <button onClick={onEdit} className="btn btn-primary">
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
