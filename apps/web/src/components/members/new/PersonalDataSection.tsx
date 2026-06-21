'use client';

import type { CreateMemberData } from '@/types/member';

interface PersonalDataSectionProps {
  formData: CreateMemberData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

function calculateAge(birthDate?: string): string {
  if (!birthDate) return '';

  const parsedDate = new Date(birthDate);
  if (isNaN(parsedDate.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - parsedDate.getFullYear();
  const monthDelta = today.getMonth() - parsedDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < parsedDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} tahun` : '';
}

export default function PersonalDataSection({ formData, onChange }: PersonalDataSectionProps) {
  const identityType = formData.identityType || 'NIK';
  const autoIdentityTypes = ['VIP', 'SPECIAL', 'FOREIGN_AUTO', 'NO_NIK'];
  const isAutoIdentity = autoIdentityTypes.includes(identityType);
  const identityLabel =
    identityType === 'PASSPORT'
      ? 'Nomor Paspor'
      : identityType === 'KITAS'
        ? 'Nomor KITAS/KITAP'
        : 'NIK';
  const identityPlaceholder =
    identityType === 'PASSPORT'
      ? 'Masukkan nomor paspor'
      : identityType === 'KITAS'
        ? 'Masukkan nomor KITAS/KITAP'
        : 'Nomor Induk Kependudukan';
  const ageLabel = calculateAge(formData.birthDate);

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
          fontSize: '18px',
          flexShrink: 0
        }}>
          A
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Data Pribadi</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
        {/* Nama Lengkap - Full width */}
        <div style={{ gridColumn: 'span 12' }}>
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

        {/* Jenis Identitas - 6 cols on desktop, full on mobile */}
        <div className="form-col-6">
          <label className="form-label">
            Jenis Identitas <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            name="identityType"
            value={identityType}
            onChange={onChange}
            required
            className="form-input"
          >
            <option value="NIK">NIK / KTP</option>
            <option value="PASSPORT">Paspor - Manca Negara</option>
            <option value="KITAS">KITAS / KITAP - Manca Negara</option>
            <option value="VIP">Pelanggan VIP - Kode Otomatis</option>
            <option value="SPECIAL">Pelanggan Spesial - Kode Otomatis</option>
            <option value="FOREIGN_AUTO">Manca Negara Tanpa Nomor - Kode Otomatis</option>
            <option value="NO_NIK">Tidak Memiliki NIK - Kode Otomatis</option>
          </select>
        </div>

        {/* Nomor Identitas - 6 cols on desktop, full on mobile */}
        <div className="form-col-6">
          <label className="form-label">
            {identityLabel} {!isAutoIdentity && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <input
            type="text"
            name="nik"
            value={formData.nik || ''}
            onChange={onChange}
            required={!isAutoIdentity}
            disabled={isAutoIdentity}
            className="form-input"
            placeholder={isAutoIdentity ? 'Akan dibuat otomatis saat member disimpan' : identityPlaceholder}
            maxLength={identityType === 'NIK' ? 16 : 32}
          />
          <p style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {isAutoIdentity
              ? 'Sistem akan mengisi kode unik otomatis di database, tidak memengaruhi nomor member.'
              : identityType === 'NIK'
                ? 'Isi 16 digit NIK. Untuk member tanpa NIK, pilih opsi kode otomatis.'
                : 'Nomor identitas ini disimpan sebagai pengganti NIK.'}
          </p>
        </div>

        {/* Nomor Telepon - 6 cols on desktop, full on mobile */}
        <div className="form-col-6">
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

        {/* Tempat Lahir - 4 cols on desktop */}
        <div className="form-col-4">
          <label className="form-label">
            Tempat Lahir <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            name="birthPlace"
            value={formData.birthPlace || ''}
            onChange={onChange}
            required
            className="form-input"
            placeholder="Kota kelahiran"
          />
        </div>

        {/* Tanggal Lahir - 4 cols on desktop */}
        <div className="form-col-4">
          <label className="form-label">
            Tanggal Lahir <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="date"
            name="birthDate"
            value={formData.birthDate || ''}
            onChange={onChange}
            required
            className="form-input"
          />
        </div>

        {/* Umur - otomatis dari tanggal lahir */}
        <div className="form-col-4">
          <label className="form-label">Umur</label>
          <input
            type="text"
            value={ageLabel}
            readOnly
            className="form-input"
            placeholder="Otomatis"
            style={{ opacity: ageLabel ? 1 : 0.75 }}
          />
        </div>

        {/* Jenis Kelamin - 4 cols on desktop */}
        <div className="form-col-4">
          <label className="form-label">
            Jenis Kelamin <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            name="gender"
            value={formData.gender || ''}
            onChange={onChange}
            required
            className="form-input"
          >
            <option value="">Pilih jenis kelamin</option>
            <option value="L">👨 Laki-laki</option>
            <option value="P">👩 Perempuan</option>
          </select>
        </div>

        {/* Agama - 4 cols on desktop */}
        <div className="form-col-4">
          <label className="form-label">Agama</label>
          <select
            name="religion"
            value={formData.religion || ''}
            onChange={onChange}
            className="form-input"
          >
            <option value="">Pilih agama</option>
            <option value="Islam">Islam</option>
            <option value="Kristen">Kristen</option>
            <option value="Katolik">Katolik</option>
            <option value="Hindu">Hindu</option>
            <option value="Buddha">Buddha</option>
            <option value="Konghucu">Konghucu</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>

        {/* Email Pribadi - 4 cols (OPTIONAL) */}
        <div className="form-col-4">
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

        {/* Pekerjaan - 6 cols */}
        <div className="form-col-6">
          <label className="form-label">Pekerjaan</label>
          <input
            type="text"
            name="occupation"
            value={formData.occupation || ''}
            onChange={onChange}
            className="form-input"
            placeholder="Opsional"
          />
        </div>

        {/* Status meninggal */}
        <div className="form-col-6">
          <label className="form-label">Status Meninggal</label>
          <select
            name="isDeceased"
            value={formData.isDeceased ? 'true' : 'false'}
            onChange={onChange}
            className="form-input"
          >
            <option value="false">Tidak</option>
            <option value="true">Ya</option>
          </select>
        </div>

        {/* Alamat - Full width */}
        <div style={{ gridColumn: 'span 12' }}>
          <label className="form-label">
            Alamat <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            name="address"
            value={formData.address || ''}
            onChange={onChange}
            required
            rows={3}
            className="form-input"
            placeholder="Alamat lengkap"
            style={{ resize: 'vertical', minHeight: '80px' }}
          />
        </div>

        {/* Kode Pos - 4 cols */}
        <div className="form-col-4">
          <label className="form-label">
            Kode Pos
          </label>
          <input
            type="text"
            name="postalCode"
            value={formData.postalCode || ''}
            onChange={onChange}
            className="form-input"
            placeholder="12345 (opsional)"
            maxLength={5}
          />
        </div>

        {/* Status Pernikahan - 4 cols (OPTIONAL) */}
        <div className="form-col-4">
          <label className="form-label">Status Pernikahan</label>
          <select
            name="maritalStatus"
            value={formData.maritalStatus || ''}
            onChange={onChange}
            className="form-input"
          >
            <option value="">Pilih status</option>
            <option value="Belum Menikah">Belum Menikah</option>
            <option value="Menikah">Menikah</option>
            <option value="Cerai">Cerai</option>
          </select>
        </div>

        {/* Sumber Info RAHO - 4 cols (OPTIONAL) */}
        <div className="form-col-4">
          <label className="form-label">Sumber Info RAHO</label>
          <select
            name="infoSource"
            value={formData.infoSource || ''}
            onChange={onChange}
            className="form-input"
          >
            <option value="">Pilih sumber info</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
            <option value="TikTok">TikTok</option>
            <option value="Google">Google</option>
            <option value="Teman/Keluarga">Teman/Keluarga</option>
            <option value="Dokter">Dokter</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>

        {/* Kontak Darurat - 6 cols (OPTIONAL) */}
        <div className="form-col-6">
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

        {/* Telepon Kontak Darurat - 6 cols (OPTIONAL) */}
        <div className="form-col-6">
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
      </div>

      <style jsx>{`
        .form-col-4 {
          grid-column: span 4;
        }
        .form-col-6 {
          grid-column: span 6;
        }
        @media (max-width: 768px) {
          .form-col-4,
          .form-col-6 {
            grid-column: span 12;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .form-col-4 {
            grid-column: span 6;
          }
        }
      `}</style>
    </div>
  );
}
