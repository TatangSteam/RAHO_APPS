import { MemberDetail } from '@/types/member';
import { PackageDisplay } from '@/types/package';
import { getMemberVoucherTotals } from './memberStatusPresentation';

interface MemberStatusCardsProps {
  member: MemberDetail;
  packages: PackageDisplay[];
}

export default function MemberStatusCards({ member, packages }: MemberStatusCardsProps) {
  const voucherTotals = getMemberVoucherTotals(packages);

  return (
    <div className="dashboard-grid" style={{ marginBottom: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>Voucher BASIC</span>
          <span style={{ fontSize: '32px' }}>📦</span>
        </div>
        <p style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{voucherTotals.basic}</p>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', border: 'none', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>Voucher BOOSTER</span>
          <span style={{ fontSize: '32px' }}>🚀</span>
        </div>
        <p style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{voucherTotals.booster}</p>
      </div>

      <div className="card" style={{ background: member.isActive ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #64748b, #475569)', border: 'none', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>Status Akun</span>
          <span style={{ fontSize: '32px' }}>{member.isActive ? '✅' : '❌'}</span>
        </div>
        <p style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{member.isActive ? 'Aktif' : 'Nonaktif'}</p>
      </div>

      <div className="card" style={{ background: member.isDeceased ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #14b8a6, #0f766e)', border: 'none', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>Status Meninggal</span>
          <span style={{ fontSize: '32px' }}>{member.isDeceased ? '!' : 'OK'}</span>
        </div>
        <p style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{member.isDeceased ? 'Ya' : 'Tidak'}</p>
      </div>

      <div className="card" style={{ background: member.isConsentToPhoto ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #64748b, #475569)', border: 'none', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>Consent Foto</span>
          <span style={{ fontSize: '32px' }}>📸</span>
        </div>
        <p style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>{member.isConsentToPhoto ? 'Ya' : 'Tidak'}</p>
      </div>
    </div>
  );
}
