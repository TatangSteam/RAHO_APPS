import { MemberDetail } from '@/types/member';

interface MemberHeaderProps {
  member: MemberDetail;
  onBack: () => void;
  onSendNotification: () => void;
  onEdit: () => void;
  isSuperAdmin: boolean;
}

export default function MemberHeader({ member, onBack, onSendNotification, onEdit, isSuperAdmin }: MemberHeaderProps) {
  // Get profile photo from documents
  const profilePhoto = member.documents?.find(doc => doc.documentType === 'FOTO_PROFIL');
  
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
              {profilePhoto ? (
                <img
                  src={profilePhoto.fileUrl}
                  alt={member.profile.fullName}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%'
                  }}
                />
              ) : (
                member.profile.fullName.charAt(0).toUpperCase()
              )}
              {member.isActive && (
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
              <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px' }}>{member.profile.fullName}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{member.memberNo}</span> • 🏢 {member.registrationBranch.name}
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onSendNotification} className="btn btn-secondary">
            📧 Kirim Notifikasi
          </button>
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
