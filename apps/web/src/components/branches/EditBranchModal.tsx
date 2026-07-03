'use client';

import { useState, useEffect } from 'react';
import { branchesApi, type Branch, type UpdateBranchData } from '@/lib/api/branchesApi';
import { wilayahApi, type WilayahItem } from '@/lib/api/wilayahApi';
import { getApiErrorMessage } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { BranchModal } from './BranchModal';
import styles from './BranchModal.module.css';

interface Props {
  show: boolean;
  branch: Branch;
  canEditBranchCode?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditBranchModal({
  show,
  branch,
  canEditBranchCode = false,
  onClose,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [manualBranchCode, setManualBranchCode] = useState(branch.branchCode);
  const [autoGenerateBranchCode, setAutoGenerateBranchCode] = useState(false);
  const [provinceCode, setProvinceCode] = useState('');
  const [regencyCode, setRegencyCode] = useState('');
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [formData, setFormData] = useState<UpdateBranchData>({
    name: branch.name,
    address: branch.address,
    city: branch.city,
    phone: branch.phone,
    type: branch.type,
    operatingHours: branch.operatingHours || '',
    isActive: branch.isActive,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (show) {
      // Reset form with branch data
      setFormData({
        name: branch.name,
        address: branch.address,
        city: branch.city,
        phone: branch.phone,
        type: branch.type,
        operatingHours: branch.operatingHours || '',
        isActive: branch.isActive,
      });
      setManualBranchCode(branch.branchCode);
      setAutoGenerateBranchCode(false);
      setProvinceCode('');
      setRegencyCode('');
      setRegencies([]);
      setErrors({});
    }
  }, [show, branch]);

  useEffect(() => {
    if (show && canEditBranchCode && autoGenerateBranchCode && provinces.length === 0) {
      loadProvinces();
    }
  }, [show, canEditBranchCode, autoGenerateBranchCode, provinces.length]);

  useEffect(() => {
    if (!show || !autoGenerateBranchCode || !provinceCode) {
      setRegencies([]);
      return;
    }

    loadRegencies(provinceCode);
  }, [show, autoGenerateBranchCode, provinceCode]);

  if (!show) return null;

  async function loadProvinces() {
    try {
      setLoadingProvinces(true);
      setProvinces(await wilayahApi.getProvinces());
    } catch (error) {
      devError('Error loading provinces:', error);
      showToast.error('Gagal memuat data provinsi');
    } finally {
      setLoadingProvinces(false);
    }
  }

  async function loadRegencies(selectedProvinceCode: string) {
    try {
      setLoadingRegencies(true);
      setRegencies(await wilayahApi.getRegencies(selectedProvinceCode));
    } catch (error) {
      devError('Error loading regencies:', error);
      setRegencies([]);
      showToast.error('Gagal memuat data kota/kabupaten');
    } finally {
      setLoadingRegencies(false);
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name && formData.name.length < 3) {
      newErrors.name = 'Nama cabang minimal 3 karakter';
    }

    if (formData.phone && !/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = 'Format nomor telepon tidak valid';
    }

    if (canEditBranchCode) {
      if (autoGenerateBranchCode) {
        if (!provinceCode) newErrors.provinceCode = 'Provinsi harus dipilih';
        if (!regencyCode) newErrors.regencyCode = 'Kabupaten/kota harus dipilih';
      } else {
        const normalizedCode = manualBranchCode.trim();
        if (normalizedCode.length < 3 || normalizedCode.length > 20) {
          newErrors.branchCode = 'Kode cabang harus 3-20 karakter';
        } else if (!/^[a-zA-Z0-9]+$/.test(normalizedCode)) {
          newErrors.branchCode = 'Kode cabang hanya boleh berisi huruf dan angka';
        }
      }
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
      const payload: UpdateBranchData = { ...formData };

      if (canEditBranchCode) {
        if (autoGenerateBranchCode) {
          payload.autoGenerateBranchCode = true;
          payload.provinceCode = provinceCode;
          payload.regencyCode = regencyCode;
        } else {
          const normalizedCode = manualBranchCode.trim().toUpperCase();
          if (normalizedCode !== branch.branchCode) {
            payload.branchCode = normalizedCode;
          }
        }
      }

      await branchesApi.updateBranch(branch.id, payload);
      showToast.success(`Cabang ${formData.name} berhasil diupdate`);
      onSuccess();
    } catch (error) {
      devError('Error updating branch:', error);
      showToast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <BranchModal
      open={show}
      title="✏️ Edit Cabang"
      subtitle={`${branch.branchCode} - ${branch.name}`}
      submitting={loading}
      submitText="✓ Simpan Perubahan"
      submittingText="⏳ Menyimpan..."
      onClose={onClose}
      onSubmit={handleSubmit}
    >
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="edit-branch-code">Kode Cabang</label>
              <input
                id="edit-branch-code"
                type="text"
                value={canEditBranchCode ? manualBranchCode : branch.branchCode}
                onChange={(event) => setManualBranchCode(event.target.value)}
                className={`${styles.input} ${errors.branchCode ? styles.inputError : ''}`}
                disabled={loading || !canEditBranchCode || autoGenerateBranchCode}
                maxLength={20}
              />
              {errors.branchCode && <span className={styles.errorText}>{errors.branchCode}</span>}
              <span className={styles.hint}>
                {canEditBranchCode
                  ? 'Gunakan 3-20 huruf/angka, atau aktifkan pembuatan otomatis.'
                  : 'Hanya Super Admin yang dapat mengubah kode cabang.'}
              </span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Tipe Cabang</label>
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

            {canEditBranchCode && (
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={autoGenerateBranchCode}
                    onChange={(event) => {
                      setAutoGenerateBranchCode(event.target.checked);
                      setProvinceCode('');
                      setRegencyCode('');
                      setErrors((current) => ({
                        ...current,
                        branchCode: '',
                        provinceCode: '',
                        regencyCode: '',
                      }));
                    }}
                    disabled={loading}
                  />
                  <span>Buat kode otomatis sesuai kode wilayah baru</span>
                </label>
              </div>
            )}

            {canEditBranchCode && autoGenerateBranchCode && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="edit-branch-province">Provinsi</label>
                  <select
                    id="edit-branch-province"
                    value={provinceCode}
                    onChange={(event) => {
                      setProvinceCode(event.target.value);
                      setRegencyCode('');
                    }}
                    className={`${styles.input} ${errors.provinceCode ? styles.inputError : ''}`}
                    disabled={loading || loadingProvinces}
                  >
                    <option value="">
                      {loadingProvinces ? 'Memuat provinsi...' : 'Pilih provinsi'}
                    </option>
                    {provinces.map((province) => (
                      <option key={province.code} value={province.code}>{province.name}</option>
                    ))}
                  </select>
                  {errors.provinceCode && <span className={styles.errorText}>{errors.provinceCode}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="edit-branch-regency">Kabupaten/Kota</label>
                  <select
                    id="edit-branch-regency"
                    value={regencyCode}
                    onChange={(event) => setRegencyCode(event.target.value)}
                    className={`${styles.input} ${errors.regencyCode ? styles.inputError : ''}`}
                    disabled={loading || loadingRegencies || !provinceCode}
                  >
                    <option value="">
                      {loadingRegencies ? 'Memuat kabupaten/kota...' : 'Pilih kabupaten/kota'}
                    </option>
                    {regencies.map((regency) => (
                      <option key={regency.code} value={regency.code}>{regency.name}</option>
                    ))}
                  </select>
                  {errors.regencyCode && <span className={styles.errorText}>{errors.regencyCode}</span>}
                </div>

                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Pratinjau Kode Otomatis</label>
                  <div className={styles.autoCodeCard}>
                    <span className={styles.hint}>Kode wilayah + urutan cabang</span>
                    <span className={styles.autoCodeValue}>
                      {regencyCode ? `${regencyCode.replace(/\D/g, '')}xx` : 'Pilih kota'}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Nama Cabang</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                disabled={loading}
              />
              {errors.name && <span className={styles.errorText}>{errors.name}</span>}
            </div>

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Alamat</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={`${styles.textarea} ${errors.address ? styles.inputError : ''}`}
                disabled={loading}
                rows={3}
              />
              {errors.address && <span className={styles.errorText}>{errors.address}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Kota</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className={`${styles.input} ${errors.city ? styles.inputError : ''}`}
                disabled={loading}
              />
              {errors.city && <span className={styles.errorText}>{errors.city}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Telepon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
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
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  disabled={loading}
                />
                <span>Cabang Aktif</span>
              </label>
            </div>
          </div>
    </BranchModal>
  );
}
