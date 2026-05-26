'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateBranch, type Branch, type UpdateBranchInput } from '@/lib/branchesApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import styles from './BranchModal.module.css';

interface Props {
  show: boolean;
  branch: Branch;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditBranchModal({ show, branch, onClose, onSuccess }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateBranchInput>({
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
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
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
      setErrors({});
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [show, branch]);

  if (!show || !mounted) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name && formData.name.length < 3) {
      newErrors.name = 'Nama cabang minimal 3 karakter';
    }

    if (formData.phone && !/^[0-9+\-\s()]+$/.test(formData.phone)) {
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
      await updateBranch(branch.id, formData);
      showToast.success(`Cabang ${formData.name} berhasil diupdate`);
      onSuccess();
    } catch (error: any) {
      devError('Error updating branch:', error);
      showToast.error(error.message || 'Gagal mengupdate cabang');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>✏️ Edit Cabang</h3>
            <p className={styles.modalSubtitle}>{branch.branchCode} - {branch.name}</p>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Kode Cabang</label>
              <input
                type="text"
                value={branch.branchCode}
                className={styles.input}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <span className={styles.hint}>Kode cabang tidak dapat diubah</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Tipe Cabang</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className={styles.input}
                disabled={loading}
              >
                <option value="PREMIER">⭐ Premier</option>
                <option value="PARTNERSHIP">🤝 Partnership</option>
              </select>
            </div>

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

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={loading}
            >
              {loading ? '⏳ Menyimpan...' : '✓ Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
