'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { branchesApi } from '@/lib/api/branchesApi';
import { showToast } from '@/lib/toast';
import { Building2, ArrowLeft, Save } from 'lucide-react';

interface Branch {
  id: string;
  branchCode: string;
  name: string;
  type: string;
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    branchCode: '',
    name: '',
    type: 'KLINIK' as 'PUSAT' | 'PREMIERE' | 'PARTNERSHIP' | 'KLINIK' | 'HOMECARE',
    address: '',
    city: '',
    phone: '',
    operatingHours: '',
    isActive: true,
  });

  useEffect(() => {
    loadBranch();
  }, [branchId]);

  const loadBranch = async () => {
    try {
      setLoading(true);
      const response = await branchesApi.getBranch(branchId);
      const branch: Branch = response.data.data;
      
      setFormData({
        branchCode: branch.branchCode,
        name: branch.name,
        type: branch.type as any,
        address: branch.address,
        city: branch.city,
        phone: branch.phone,
        operatingHours: branch.operatingHours || '',
        isActive: branch.isActive,
      });
    } catch (error: any) {
      console.error('Error loading branch:', error);
      showToast.error('Gagal memuat data cabang');
      router.push('/branches');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await branchesApi.updateBranch(branchId, formData);
      showToast.success('Cabang berhasil diperbarui');
      router.push(`/branches/${branchId}`);
    } catch (error: any) {
      console.error('Error updating branch:', error);
      showToast.error(error.response?.data?.message || 'Gagal memperbarui cabang');
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
                Kode Cabang <span className="required">*</span>
              </label>
              <input
                type="text"
                id="branchCode"
                name="branchCode"
                value={formData.branchCode}
                onChange={handleChange}
                placeholder="Contoh: JKT01"
                required
                disabled
                className="form-input"
              />
              <span className="form-hint">Kode cabang tidak dapat diubah</span>
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
                <option value="PREMIERE">Premiere</option>
                <option value="PARTNERSHIP">Partnership</option>
                <option value="KLINIK">Klinik</option>
                <option value="HOMECARE">Homecare</option>
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
              placeholder="Contoh: RAHO Klinik Jakarta Pusat"
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
