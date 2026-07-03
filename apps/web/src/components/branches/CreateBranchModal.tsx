'use client';

import { useState, useEffect } from 'react';
import { branchesApi, type CreateBranchData } from '@/lib/api/branchesApi';
import { wilayahApi, type WilayahItem } from '@/lib/api/wilayahApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { BranchModal } from './BranchModal';
import styles from './BranchModal.module.css';

interface Props {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateBranchModal({ show, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateBranchData>({
    name: '',
    address: '',
    city: '',
    provinceCode: '',
    regencyCode: '',
    phone: '',
    type: 'PREMIER',
    operatingHours: '',
  });
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (show) {
      // Reset form
      setFormData({
        name: '',
        address: '',
        city: '',
        provinceCode: '',
        regencyCode: '',
        phone: '',
        type: 'PREMIER',
        operatingHours: '',
      });
      setErrors({});
      loadProvinces();
    }
  }, [show]);

  useEffect(() => {
    if (!show || !formData.provinceCode) {
      setRegencies([]);
      return;
    }

    loadRegencies(formData.provinceCode);
  }, [show, formData.provinceCode]);

  if (!show) return null;

  async function loadProvinces() {
    try {
      setLoadingProvinces(true);
      const data = await wilayahApi.getProvinces();
      setProvinces(data);
    } catch (error) {
      devError('Error loading provinces:', error);
      showToast.error('Gagal memuat data provinsi');
    } finally {
      setLoadingProvinces(false);
    }
  }

  async function loadRegencies(provinceCode: string) {
    try {
      setLoadingRegencies(true);
      const data = await wilayahApi.getRegencies(provinceCode);
      setRegencies(data);
    } catch (error) {
      devError('Error loading regencies:', error);
      showToast.error('Gagal memuat data kota/kabupaten');
      setRegencies([]);
    } finally {
      setLoadingRegencies(false);
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) {
      newErrors.name = 'Nama cabang harus diisi';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Nama cabang minimal 3 karakter';
    }

    if (!formData.address) {
      newErrors.address = 'Alamat harus diisi';
    }

    if (!formData.provinceCode) {
      newErrors.provinceCode = 'Provinsi harus dipilih';
    }

    if (!formData.regencyCode) {
      newErrors.regencyCode = 'Kabupaten/kota harus dipilih';
    }

    if (!formData.phone) {
      newErrors.phone = 'Telepon harus diisi';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = 'Format nomor telepon tidak valid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast.error('Mohon perbaiki kesalahan pada form');
      return;
    }

    try {
      setLoading(true);
      await branchesApi.createBranch(formData);
      showToast.success(`Cabang ${formData.name} berhasil dibuat`);
      onSuccess();
    } catch (error: any) {
      devError('Error creating branch:', error);
      showToast.error(error.message || 'Gagal membuat cabang');
    } finally {
      setLoading(false);
    }
  };

  const handleProvinceChange = (provinceCode: string) => {
    setFormData({
      ...formData,
      provinceCode,
      regencyCode: '',
      city: '',
    });
  };

  const handleRegencyChange = (regencyCode: string) => {
    const selectedRegency = regencies.find((regency) => regency.code === regencyCode);
    setFormData({
      ...formData,
      regencyCode,
      city: selectedRegency?.name || '',
    });
  };

  const branchCodePreview = formData.regencyCode
    ? `${formData.regencyCode.replace(/\D/g, '')}xx`
    : 'Pilih kota';

  return (
    <BranchModal
      open={show}
      title="🏢 Tambah Cabang Baru"
      subtitle="Buat cabang baru"
      submitting={loading}
      submitText="✓ Buat Cabang"
      submittingText="⏳ Membuat..."
      onClose={onClose}
      onSubmit={handleSubmit}
    >
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Kode Cabang</label>
              <div className={styles.autoCodeCard}>
                <span className={styles.autoCodeValue}>{branchCodePreview}</span>
                <span className={styles.hint}>Kode wilayah + nomor urut</span>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Tipe Cabang <span className={styles.required}>*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className={styles.input}
                disabled={loading}
              >
                <option value="PUSAT">Pusat</option>
                <option value="PREMIER">Premier</option>
                <option value="PARTNERSHIP">Partnership</option>
              </select>
            </div>

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>
                Nama Cabang <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                placeholder="Contoh: Raho Premier Jakarta Pusat"
                disabled={loading}
              />
              {errors.name && <span className={styles.errorText}>{errors.name}</span>}
            </div>

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>
                Alamat <span className={styles.required}>*</span>
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={`${styles.textarea} ${errors.address ? styles.inputError : ''}`}
                placeholder="Alamat lengkap cabang"
                disabled={loading}
                rows={3}
              />
              {errors.address && <span className={styles.errorText}>{errors.address}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Provinsi <span className={styles.required}>*</span>
              </label>
              <select
                value={formData.provinceCode}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className={`${styles.input} ${errors.provinceCode ? styles.inputError : ''}`}
                disabled={loading || loadingProvinces}
              >
                <option value="">{loadingProvinces ? 'Memuat provinsi...' : 'Pilih provinsi'}</option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.code} - {province.name}
                  </option>
                ))}
              </select>
              {errors.provinceCode && <span className={styles.errorText}>{errors.provinceCode}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Kabupaten/Kota <span className={styles.required}>*</span>
              </label>
              <select
                value={formData.regencyCode}
                onChange={(e) => handleRegencyChange(e.target.value)}
                className={`${styles.input} ${errors.regencyCode ? styles.inputError : ''}`}
                disabled={loading || !formData.provinceCode || loadingRegencies}
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
              {errors.regencyCode && <span className={styles.errorText}>{errors.regencyCode}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                Telepon <span className={styles.required}>*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                placeholder="021-12345678"
                disabled={loading}
              />
              {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
            </div>

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Jam Operasional</label>
              <input
                type="text"
                value={formData.operatingHours}
                onChange={(e) => setFormData({ ...formData, operatingHours: e.target.value })}
                className={styles.input}
                placeholder="Contoh: Senin-Jumat 08:00-17:00"
                disabled={loading}
              />
            </div>
          </div>
    </BranchModal>
  );
}
