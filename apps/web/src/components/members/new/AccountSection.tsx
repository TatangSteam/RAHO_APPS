'use client';

import type { CreateMemberData } from '@/types/member';

interface AccountSectionProps {
  formData: CreateMemberData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

export default function AccountSection({ formData, onChange }: AccountSectionProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--surface-border)' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700',
          fontSize: '18px'
        }}>
          B
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Akun Member</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div>
          <label className="form-label">
            Email Login <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="email"
            name="memberEmail"
            value={formData.memberEmail}
            onChange={onChange}
            required
            className="form-input"
            placeholder="email.member@example.com"
            autoComplete="off"
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Email untuk login ke aplikasi member</p>
        </div>

        <div>
          <label className="form-label">
            Password <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="password"
            name="memberPassword"
            value={formData.memberPassword}
            onChange={onChange}
            required
            minLength={8}
            className="form-input"
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
          />
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Minimal 8 karakter</p>
        </div>

        <div>
          <label className="form-label">Kode Referral</label>
          <input
            type="text"
            name="referralCode"
            value={formData.referralCode || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Kode referral (opsional)"
            style={{ fontFamily: 'monospace' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius-md)' }}>
          <input
            type="checkbox"
            name="isConsentToPhoto"
            checked={formData.isConsentToPhoto}
            onChange={onChange}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <label style={{ marginLeft: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            📸 Setuju untuk difoto
          </label>
        </div>
      </div>
    </div>
  );
}
