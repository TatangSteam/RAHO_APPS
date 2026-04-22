import { MemberDetail } from '@/types/member';

interface MemberProfileTabProps {
  member: MemberDetail;
}

export default function MemberProfileTab({ member }: MemberProfileTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>📝 Data Pribadi</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>NIK</p>
            <p style={{ fontWeight: '600', fontFamily: 'monospace' }}>{member.nik || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tempat, Tanggal Lahir</p>
            <p style={{ fontWeight: '600' }}>
              {member.tempatLahir || '-'}
              {member.dateOfBirth && `, ${new Date(member.dateOfBirth).toLocaleDateString('id-ID')}`}
            </p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Jenis Kelamin</p>
            <p style={{ fontWeight: '600' }}>
              {member.jenisKelamin === 'L' ? '👨 Laki-laki' : member.jenisKelamin === 'P' ? '👩 Perempuan' : '-'}
            </p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Telepon</p>
            <p style={{ fontWeight: '600' }}>📞 {member.profile.phone}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Email</p>
            <p style={{ fontWeight: '600', wordBreak: 'break-all' }}>📧 {member.user.email}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Pekerjaan</p>
            <p style={{ fontWeight: '600' }}>💼 {member.pekerjaan || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)', gridColumn: '1 / -1' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Alamat</p>
            <p style={{ fontWeight: '600' }}>🏠 {member.address || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status Nikah</p>
            <p style={{ fontWeight: '600' }}>💍 {member.statusNikah || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kontak Darurat</p>
            <p style={{ fontWeight: '600' }}>🚨 {member.emergencyContact || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Sumber Info</p>
            <p style={{ fontWeight: '600' }}>ℹ️ {member.sumberInfoRaho || '-'}</p>
          </div>
          <div style={{ padding: '12px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kode Pos</p>
            <p style={{ fontWeight: '600' }}>📮 {member.postalCode || '-'}</p>
          </div>
        </div>
      </div>

      {member.referralCode && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>🎁 Referral</h3>
          <div style={{ padding: '16px', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Kode: <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#a855f7' }}>{member.referralCode.code}</span></p>
            <p style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>{member.referralCode.referrerName}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{member.referralCode.referrerType}</p>
          </div>
        </div>
      )}

      {member.documents.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>📄 Dokumen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {member.documents.map((doc) => (
              <div key={doc.id} className="card card-sm">
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '600' }}>
                  {doc.documentType === 'PERSETUJUAN_SETELAH_PENJELASAN' ? '📋 Dokumen PSP' : '📸 Foto Member'}
                </p>
                {doc.mimeType.startsWith('image/') && (
                  <img
                    src={doc.fileUrl}
                    alt={doc.fileName}
                    style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}
                  />
                )}
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', wordBreak: 'break-all' }}>{doc.fileName}</p>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-primary btn-full"
                >
                  👁️ Lihat File
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {member.branchAccess && member.branchAccess.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)' }}>🔗 Akses Lintas Cabang</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {member.branchAccess.map((access) => (
              <div key={access.branchId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontWeight: '600' }}>🏢 {access.branchName}</span>
                <span className="badge badge-cyan">
                  {new Date(access.grantedAt).toLocaleDateString('id-ID')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
