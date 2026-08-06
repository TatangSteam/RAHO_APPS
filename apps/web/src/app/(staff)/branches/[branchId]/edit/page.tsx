'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { branchesApi, type UpdateBranchData } from '@/lib/api/branchesApi';
import { wilayahApi, type WilayahItem } from '@/lib/api/wilayahApi';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { Building2, ArrowLeft, Save } from 'lucide-react';

interface Branch {
  id: string;
  branchCode: string;
  name: string;
  type: 'PUSAT' | 'PREMIER' | 'PARTNERSHIP';
  address: string;
  city: string;
  phone: string;
  operatingHours?: string;
  isActive: boolean;
}

export default function EditBranchPage() {
  const router = useRouter();
  const params = useParams();
  const branchId = params.branchId as string;
  const { user } = useAuthStore();
  const canEditBranchCode = user?.role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalBranchCode, setOriginalBranchCode] = useState('');
  const [autoGenerateBranchCode, setAutoGenerateBranchCode] = useState(false);
  const [provinceCode, setProvinceCode] = useState('');
  const [regencyCode, setRegencyCode] = useState('');
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [formData, setFormData] = useState({
    branchCode: '',
    name: '',
    type: 'PREMIER' as 'PUSAT' | 'PREMIER' | 'PARTNERSHIP',
    address: '',
    city: '',
    phone: '',
    operatingHours: '',
    isActive: true,
  });

  useEffect(() => {
    if (canEditBranchCode && autoGenerateBranchCode && provinces.length === 0) {
      loadProvinces();
    }
  }, [canEditBranchCode, autoGenerateBranchCode, provinces.length]);

  useEffect(() => {
    if (!autoGenerateBranchCode || !provinceCode) {
      setRegencies([]);
      return;
    }

    loadRegencies(provinceCode);
  }, [autoGenerateBranchCode, provinceCode]);

  const loadBranch = useCallback(async () => {
    try {
      setLoading(true);
      const response = await branchesApi.getBranch(branchId);
      const branch: Branch = response.data.data;
      setOriginalBranchCode(branch.branchCode);
      
      setFormData({
        branchCode: branch.branchCode,
        name: branch.name,
        type: branch.type,
        address: branch.address,
        city: branch.city,
        phone: branch.phone,
        operatingHours: branch.operatingHours || '',
        isActive: branch.isActive,
      });
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading branch:', error);
      showToast.error('Gagal memuat data cabang');
      router.push('/branches');
    } finally {
      setLoading(false);
    }
  }, [branchId, router]);

  useEffect(() => {
    void loadBranch();
  }, [loadBranch]);

  const loadProvinces = async () => {
    try {
      setLoadingProvinces(true);
      setProvinces(await wilayahApi.getProvinces());
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading provinces:', error);
      showToast.error('Gagal memuat data provinsi');
    } finally {
      setLoadingProvinces(false);
    }
  };

  const loadRegencies = async (selectedProvinceCode: string) => {
    try {
      setLoadingRegencies(true);
      setRegencies(await wilayahApi.getRegencies(selectedProvinceCode));
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading regencies:', error);
      setRegencies([]);
      showToast.error('Gagal memuat data kota/kabupaten');
    } finally {
      setLoadingRegencies(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const { branchCode, ...updateData } = formData;
      const payload: UpdateBranchData = updateData;

      if (canEditBranchCode) {
        if (autoGenerateBranchCode) {
          payload.autoGenerateBranchCode = true;
          payload.provinceCode = provinceCode;
          payload.regencyCode = regencyCode;
        } else {
          const normalizedCode = branchCode.trim().toUpperCase();
          if (normalizedCode !== originalBranchCode) {
            payload.branchCode = normalizedCode;
          }
        }
      }

      await branchesApi.updateBranch(branchId, payload);
      showToast.success('Cabang berhasil diperbarui');
      router.push(`/branches/${branchId}`);
    } catch (error) {
      assertCaughtError(error);
      devError('Error updating branch:', error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Memuat data cabang...</p>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            gap: 16px;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--surface-border);
            border-top: 3px solid var(--color-primary-500);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="edit-branch-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => router.push(`/branches/${branchId}`)}>
          <ArrowLeft size={20} />
        </button>
        
        <div className="header-title">
          <Building2 size={32} color="var(--color-primary-500)" />
          <div>
            <h1>Edit Cabang</h1>
            <p>Perbarui informasi cabang</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="branch-form">
        <div className="form-section">
          <h3>Informasi Dasar</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="branchCode">
                Kode Cabang
              </label>
              <input
                type="text"
                id="branchCode"
                name="branchCode"
                value={formData.branchCode}
                onChange={handleChange}
                placeholder="Contoh: JKT01"
                required
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9]+"
                disabled={!canEditBranchCode || autoGenerateBranchCode || saving}
                className="form-input"
              />
              <span className="form-hint">
                {canEditBranchCode
                  ? 'Gunakan 3-20 huruf/angka, atau aktifkan pembuatan otomatis.'
                  : 'Hanya Super Admin yang dapat mengubah kode cabang.'}
              </span>
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

          {canEditBranchCode && (
            <div className="form-group auto-code-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoGenerateBranchCode}
                  onChange={(event) => {
                    setAutoGenerateBranchCode(event.target.checked);
                    setProvinceCode('');
                    setRegencyCode('');
                  }}
                  disabled={saving}
                />
                <span>Buat kode otomatis sesuai kode wilayah baru</span>
              </label>

              {autoGenerateBranchCode && (
                <>
                  <div className="form-row auto-code-fields">
                    <div className="form-group">
                      <label htmlFor="provinceCode">
                        Provinsi <span className="required">*</span>
                      </label>
                      <select
                        id="provinceCode"
                        value={provinceCode}
                        onChange={(event) => {
                          setProvinceCode(event.target.value);
                          setRegencyCode('');
                        }}
                        required
                        disabled={saving || loadingProvinces}
                        className="form-input"
                      >
                        <option value="">
                          {loadingProvinces ? 'Memuat provinsi...' : 'Pilih provinsi'}
                        </option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.code}>{province.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="regencyCode">
                        Kabupaten/Kota <span className="required">*</span>
                      </label>
                      <select
                        id="regencyCode"
                        value={regencyCode}
                        onChange={(event) => setRegencyCode(event.target.value)}
                        required
                        disabled={saving || loadingRegencies || !provinceCode}
                        className="form-input"
                      >
                        <option value="">
                          {loadingRegencies ? 'Memuat kabupaten/kota...' : 'Pilih kabupaten/kota'}
                        </option>
                        {regencies.map((regency) => (
                          <option key={regency.code} value={regency.code}>{regency.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="auto-code-preview">
                    <span>Kode wilayah + urutan cabang</span>
                    <strong>{regencyCode ? `${regencyCode.replace(/\D/g, '')}xx` : 'Pilih kota'}</strong>
                  </div>
                </>
              )}
            </div>
          )}

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
              <label htmlFor="city">
                Kota <span className="required">*</span>
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Contoh: Jakarta"
                required
                className="form-input"
              />
            </div>

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
            onClick={() => router.push(`/branches/${branchId}`)}
            disabled={saving}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="spinner" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .edit-branch-page {
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

        /* Form */
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

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 12px 16px;
          background: var(--surface-input);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 14px;
          font-family: inherit;
          transition: all var(--transition-fast);
        }

        .form-group input:disabled {
          background: rgba(148, 163, 184, 0.1);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--color-primary-500);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-hint {
          font-size: 12px;
          color: var(--text-muted);
        }

        .auto-code-section {
          margin-top: 20px;
          padding: 16px;
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          background: var(--surface-input);
        }

        .auto-code-fields {
          margin-top: 16px;
        }

        .auto-code-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
          padding: 12px 16px;
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: var(--radius-md);
          background: rgba(245, 158, 11, 0.08);
          color: var(--text-muted);
          font-size: 13px;
        }

        .auto-code-preview strong {
          color: #f59e0b;
          font-size: 15px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
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

        /* Form Actions */
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 8px;
        }

        .btn-primary,
        .btn-secondary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border: none;
          border-radius: var(--radius-md);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-primary {
          background: var(--color-primary-500);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-600);
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          color: var(--text-secondary);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .btn-primary,
          .btn-secondary {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
