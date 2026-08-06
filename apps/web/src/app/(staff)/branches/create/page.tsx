'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { branchesApi } from '@/lib/api/branchesApi';
import { wilayahApi, type WilayahItem } from '@/lib/api/wilayahApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { Building2, ArrowLeft, Save } from 'lucide-react';

export default function CreateBranchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'PREMIER' as 'PUSAT' | 'PREMIER' | 'PARTNERSHIP',
    address: '',
    city: '',
    provinceCode: '',
    regencyCode: '',
    phone: '',
    operatingHours: '',
    isActive: true,
  });
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingRegencies, setLoadingRegencies] = useState(false);

  useEffect(() => {
    loadProvinces();
  }, []);

  useEffect(() => {
    if (!formData.provinceCode) {
      setRegencies([]);
      return;
    }

    loadRegencies(formData.provinceCode);
  }, [formData.provinceCode]);

  const loadProvinces = async () => {
    try {
      setLoadingProvinces(true);
      const data = await wilayahApi.getProvinces();
      setProvinces(data);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading provinces:', error);
      showToast.error('Gagal memuat data provinsi');
    } finally {
      setLoadingProvinces(false);
    }
  };

  const loadRegencies = async (provinceCode: string) => {
    try {
      setLoadingRegencies(true);
      const data = await wilayahApi.getRegencies(provinceCode);
      setRegencies(data);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading regencies:', error);
      showToast.error('Gagal memuat data kota/kabupaten');
      setRegencies([]);
    } finally {
      setLoadingRegencies(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await branchesApi.createBranch(formData);
      showToast.success('Cabang berhasil dibuat');
      router.push('/branches');
    } catch (error) {
      assertCaughtError(error);
      devError('Error creating branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal membuat cabang');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (name === 'provinceCode') {
      setFormData(prev => ({
        ...prev,
        provinceCode: value,
        regencyCode: '',
        city: '',
      }));
      return;
    }

    if (name === 'regencyCode') {
      const selectedRegency = regencies.find((regency) => regency.code === value);
      setFormData(prev => ({
        ...prev,
        regencyCode: value,
        city: selectedRegency?.name || '',
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const branchCodePreview = formData.regencyCode
    ? `${formData.regencyCode.replace(/\D/g, '')}xx`
    : 'Pilih kota';

  return (
    <div className="create-branch-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => router.push('/branches')}>
          <ArrowLeft size={20} />
        </button>
        
        <div className="header-title">
          <Building2 size={32} color="var(--color-primary-500)" />
          <div>
            <h1>Tambah Cabang Baru</h1>
            <p>Buat cabang baru</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="branch-form">
        <div className="form-section">
          <h3>Informasi Dasar</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>Kode Cabang</label>
              <div className="auto-code-card">
                <span className="auto-code-value">{branchCodePreview}</span>
                <span className="auto-code-note">Kode wilayah + nomor urut</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="type">
                Tipe Cabang <span className="required">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="PUSAT">Pusat</option>
                <option value="PREMIER">Premier</option>
                <option value="PARTNERSHIP">Partnership</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="name">
              Nama Cabang <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Contoh: Raho ERP Jakarta Pusat"
              required
              className="form-input"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Lokasi & Kontak</h3>
          
          <div className="form-group">
            <label htmlFor="address">
              Alamat Lengkap <span className="required">*</span>
            </label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Jl. Contoh No. 123, Kelurahan, Kecamatan"
              rows={3}
              required
              className="form-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="provinceCode">
                Provinsi <span className="required">*</span>
              </label>
              <select
                id="provinceCode"
                name="provinceCode"
                value={formData.provinceCode}
                onChange={handleChange}
                disabled={loadingProvinces}
                required
                className="form-input"
              >
                <option value="">{loadingProvinces ? 'Memuat provinsi...' : 'Pilih provinsi'}</option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.code} - {province.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="regencyCode">
                Kabupaten/Kota <span className="required">*</span>
              </label>
              <select
                id="regencyCode"
                name="regencyCode"
                value={formData.regencyCode}
                onChange={handleChange}
                disabled={!formData.provinceCode || loadingRegencies}
                required
                className="form-input"
              >
                <option value="">
                  {loadingRegencies ? 'Memuat kota/kabupaten...' : 'Pilih kabupaten/kota'}
                </option>
                {regencies.map((regency) => (
                  <option key={regency.code} value={regency.code}>
                    {regency.code} - {regency.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">
                Telepon <span className="required">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Contoh: 021-12345678"
                required
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="operatingHours">
              Jam Operasional
            </label>
            <input
              type="text"
              id="operatingHours"
              name="operatingHours"
              value={formData.operatingHours}
              onChange={handleChange}
              placeholder="Contoh: Senin-Jumat 08:00-17:00, Sabtu 08:00-12:00"
              className="form-input"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Status</h3>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              <span>Cabang Aktif</span>
            </label>
            <span className="form-hint">Cabang aktif dapat digunakan untuk operasional</span>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push('/branches')}
            disabled={loading}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Simpan Cabang</span>
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .create-branch-page {
          max-width: 900px;
          margin: 0 auto;
          padding: 32px;
        }

        .page-header {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
        }

        .back-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          flex-shrink: 0;
        }

        .back-btn:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
          border-color: var(--color-primary-300);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-title h1 {
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 4px 0;
        }

        .header-title p {
          font-size: 14px;
          color: var(--text-secondary);
          margin: 0;
        }

        .branch-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .form-section {
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: 24px;
        }

        .form-section h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 20px 0;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .required {
          color: var(--color-danger);
        }

        .form-hint {
          font-size: 12px;
          color: var(--text-muted);
        }

        .auto-code-card {
          min-height: 46px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: var(--radius-md);
        }

        .auto-code-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-primary-500);
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .auto-code-note {
          font-size: 12px;
          color: var(--text-muted);
          text-align: right;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 500;
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 8px;
        }

        @media (max-width: 768px) {
          .create-branch-page {
            padding: 20px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
