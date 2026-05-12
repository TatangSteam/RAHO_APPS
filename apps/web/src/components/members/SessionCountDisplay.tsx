import React from 'react';
import type { Session } from '@/types/session';

interface SessionCountDisplayProps {
  session: Session;
}

export default function SessionCountDisplay({ session }: SessionCountDisplayProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
      {/* Total Therapy Count (Global) - WAJIB */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(59,130,246,0.2)',
        border: '1px solid rgba(59,130,246,0.3)',
      }}>
        <span style={{ fontSize: '16px' }}>🌍</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '10px', fontWeight: '600', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total
          </span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#60a5fa' }}>
            Terapi #{session.infusKe}
          </span>
        </div>
      </div>

      {/* Branch-Specific Therapy Count - WAJIB */}
      {session.branchInfusKe && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(168,85,247,0.2)',
          border: '1px solid rgba(168,85,247,0.3)',
        }}>
          <span style={{ fontSize: '16px' }}>📍</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {session.branchName || 'Cabang'}
            </span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#c084fc' }}>
              Terapi #{session.branchInfusKe}
            </span>
          </div>
        </div>
      )}

      {/* Other Branches (if multi-branch) - OPTIONAL */}
      {session.branchSessionCounts && session.branchSessionCounts.length > 1 && (
        session.branchSessionCounts
          .filter(b => b.branchId !== session.branchId)
          .map((branchCount) => (
            <div
              key={branchCount.branchId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(148,163,184,0.15)',
                border: '1px solid rgba(148,163,184,0.3)',
              }}
            >
              <span style={{ fontSize: '16px' }}>🏥</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {branchCount.branchName}
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>
                  Terapi #{branchCount.sessionCount}
                </span>
              </div>
            </div>
          ))
      )}
    </div>
  );
}
