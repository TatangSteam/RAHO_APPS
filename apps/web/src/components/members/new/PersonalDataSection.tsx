'use client';

import type { CreateMemberData } from '@/types/member';

interface PersonalDataSectionProps {
  formData: CreateMemberData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

export default function PersonalDataSection({ formData, onChange }: PersonalDataSectionProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid var(--surface-border)' }}>
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
          fontSize: '18px'
        }}>
          A
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Data Pribadi</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">
            Nama Lengkap <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={onChange}
            required
            className="form-input"
            placeholder="Masukkan nama lengkap"
          />
        </div>

        <div>
          <label className="form-label">NIK</label>
          <input
            type="text"
            name="nik"
            value={formData.nik || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Nomor Induk Kependudukan"
          />
        </div>

        <div>
          <label className="form-label">
            Nomor Telepon <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={onChange}
            required
            className="form-input"
            placeholder="08xxxxxxxxxx"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="form-label">Tempat Lahir</label>
          <input
            type="text"
            name="birthPlace"
            value={formData.birthPlace || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Kota kelahiran"
          />
        </div>

        <div>
          <label className="form-label">Tanggal Lahir</label>
          <input
            type="date"
            name="birthDate"
            value={formData.birthDate || ''}
            onChange={onChange}
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">Jenis Kelamin</label>
          <select
            name="gender"
            value={formData.gender || ''}
            onChange={onChange}
            className="form-input"
          >
            <option value="">Pilih jenis kelamin</option>
            <option value="L">👨 Laki-laki</option>
            <option value="P">👩 Perempuan</option>
          </select>
        </div>

        <div>
          <label className="form-label">Email Pribadi</label>
          <input
            type="email"
            name="email"
            value={formData.email || ''}
            onChange={onChange}
            className="form-input"
            placeholder="email@example.com"
            autoComplete="off"
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Alamat</label>
          <textarea
            name="address"
            value={formData.address || ''}
            onChange={onChange}
            rows={3}
            className="form-input"
            placeholder="Alamat lengkap"
            style={{ resize: 'vertical', minHeight: '80px' }}
          />
        </div>

        <div>
          <label className="form-label">Pekerjaan</label>
          <input
            type="text"
            name="occupation"
            value={formData.occupation || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Pekerjaan saat ini"
          />
        </div>

        <div>
          <label className="form-label">Status Pernikahan</label>
          <input
            type="text"
            name="maritalStatus"
            value={formData.maritalStatus || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Belum Menikah / Menikah / Cerai"
          />
        </div>

        <div>
          <label className="form-label">Kontak Darurat</label>
          <input
            type="text"
            name="emergencyContact"
            value={formData.emergencyContact || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Nama kontak darurat"
          />
        </div>

        <div>
          <label className="form-label">Telepon Kontak Darurat</label>
          <input
            type="tel"
            name="emergencyContactPhone"
            value={formData.emergencyContactPhone || ''}
            onChange={onChange}
            className="form-input"
            placeholder="08xxxxxxxxxx"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="form-label">Sumber Info RAHO</label>
          <input
            type="text"
            name="infoSource"
            value={formData.infoSource || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Dari mana Anda tahu RAHO?"
          />
        </div>

        <div>
          <label className="form-label">Kode Pos</label>
          <input
            type="text"
            name="postalCode"
            value={formData.postalCode || ''}
            onChange={onChange}
            className="form-input"
            placeholder="12345"
          />
        </div>
      </div>
    </div>
  );
}
