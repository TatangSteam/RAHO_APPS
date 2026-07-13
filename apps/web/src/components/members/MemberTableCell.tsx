'use client';

import type { Member } from '@/types/member';

interface MemberTableCellProps {
  columnId: string;
  member: Member;
  photoUrl?: string;
  onNavigate: () => void;
}

export function MemberTableCell({ columnId, member, photoUrl, onNavigate }: MemberTableCellProps) {
  const memberInitial = (member.fullName || 'M').charAt(0).toUpperCase();

  switch (columnId) {
    case 'memberNo':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>
            {member.memberNo || 'N/A'}
          </span>
          {member.isLintas && (
            <span className="badge badge-cyan">🔗 Lintas</span>
          )}
        </div>
      );

    case 'nameAndBranch':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            fontWeight: '700',
            fontSize: '16px',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            border: '2px solid var(--surface-border)'
          }}>
            <span style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {memberInitial}
            </span>
            {photoUrl && (
              <img
                src={photoUrl}
                alt={member.fullName || 'Member'}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%'
                }}
              />
            )}
            {member.isActive && (
              <span style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                zIndex: 2,
                width: '12px',
                height: '12px',
                background: '#22c55e',
                border: '2px solid var(--surface-card)',
                borderRadius: '50%',
                boxShadow: '0 0 0 2px var(--surface-card)'
              }}></span>
            )}
          </div>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '2px' }}>
              {member.fullName || 'Nama tidak tersedia'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              🏢 {member.registrationBranch || 'N/A'}
            </div>
          </div>
        </div>
      );

    case 'phone':
      return <span style={{ fontSize: '14px' }}>📞 {member.phone || '-'}</span>;

    case 'registrationDate':
      return (
        <span style={{ fontSize: '14px' }}>
          📅 {member.createdAt ? new Date(member.createdAt).toLocaleDateString('id-ID') : '-'}
        </span>
      );

    case 'email':
      return <span style={{ fontSize: '14px' }}>✉️ {member.email || '-'}</span>;

    case 'age':
      return (
        <span style={{ fontSize: '14px' }}>
          {member.age !== null && member.age !== undefined ? `${member.age} tahun` : '-'}
        </span>
      );

    case 'voucherCount':
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '40px',
          padding: '6px 12px',
          background: 'rgba(168,85,247,0.15)',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '16px',
          color: '#a855f7'
        }}>
          {member.voucherCount || 0}
        </div>
      );

    case 'basicPackage':
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.2))',
          border: '2px solid rgba(245,158,11,0.3)',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '18px',
          color: '#f59e0b'
        }}>
          {member.basicPackageCount || 0}
        </div>
      );

    case 'sessionCount':
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '40px',
          padding: '6px 12px',
          background: 'rgba(59,130,246,0.15)',
          border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '15px',
          color: '#3b82f6'
        }}>
          {member.sessionCount !== undefined && member.sessionCount !== null ? member.sessionCount : 0}
        </div>
      );

    case 'lastInfusion':
      if (!member.lastInfusionDate) {
        return (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 12px',
            background: 'rgba(100,116,139,0.1)',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontStyle: 'italic'
          }}>
            Belum ada
          </div>
        );
      }
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          background: 'rgba(16,185,129,0.15)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '500',
          color: '#10b981'
        }}>
          📅 {new Date(member.lastInfusionDate).toLocaleDateString('id-ID', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          })}
        </div>
      );

    case 'diagnosis':
      if (!member.primaryDiagnosis) {
        return (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 12px',
            background: 'rgba(100,116,139,0.1)',
            border: '1px solid rgba(100,116,139,0.2)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontStyle: 'italic'
          }}>
            Belum ada
          </div>
        );
      }
      return (
        <div style={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: '2px',
          padding: '6px 10px',
          background: 'rgba(139,92,246,0.15)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: '8px',
          maxWidth: '200px'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#8b5cf6',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {member.primaryDiagnosis}
          </div>
          {member.primaryDiagnosisIcd && (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'monospace'
            }}>
              {member.primaryDiagnosisIcd}
            </div>
          )}
        </div>
      );

    case 'status':
      if (member.isDeceased) {
        return (
          <span className="badge badge-danger">
            <span style={{ 
              width: '6px', 
              height: '6px', 
              background: '#ef4444', 
              borderRadius: '50%', 
              display: 'inline-block', 
              marginRight: '6px' 
            }}></span>
            Meninggal
          </span>
        );
      } else if (member.isActive) {
        return (
          <span className="badge badge-success">
            <span style={{ 
              width: '6px', 
              height: '6px', 
              background: '#22c55e', 
              borderRadius: '50%', 
              display: 'inline-block', 
              marginRight: '6px' 
            }}></span>
            Aktif
          </span>
        );
      } else {
        return (
          <span className="badge badge-gray">
            <span style={{ 
              width: '6px', 
              height: '6px', 
              background: '#64748b', 
              borderRadius: '50%', 
              display: 'inline-block', 
              marginRight: '6px' 
            }}></span>
            Nonaktif
          </span>
        );
      }

    case 'actions':
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          className="btn btn-sm btn-primary"
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 16px',
            fontWeight: '600'
          }}
          title="Lihat detail member"
        >
          👁️ Lihat Detail
        </button>
      );

    default:
      return <span>-</span>;
  }
}
