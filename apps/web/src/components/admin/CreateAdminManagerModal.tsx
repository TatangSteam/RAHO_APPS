'use client';

import React, { useState, useEffect } from 'react';
import { adminManagersApi, Branch, CreateAdminManagerData } from '@/lib/api/adminManagersApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import { X, Eye, EyeOff, Building2 } from 'lucide-react';
import type { AdminManagerAccessScope } from '@/types/auth';
import styles from './CreateAdminManagerModal.module.css';

interface CreateAdminManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateAdminManagerModal: React.FC<CreateAdminManagerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // State
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchAccessScopes, setBranchAccessScopes] = useState<Record<string, AdminManagerAccessScope>>({});
  
  const [formData, setFormData] = useState<CreateAdminManagerData>({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    branchIds: [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateAdminManagerData, string>>>({});

  // Load branches
  useEffect(() => {
    if (isOpen) {
      loadBranches();
    }
  }, [isOpen]);

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const response = await adminManagersApi.getBranches();
      setBranches(response.data.filter(b => b.isActive));
    } catch (error: any) {
      devError('Error loading branches:', error);
      showToast.error('Gagal memuat data cabang');
    } finally {
      setLoadingBranches(false);
    }
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateAdminManagerData, string>> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }

    if (!formData.password) {
      newErrors.password = 'Password wajib diisi';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password minimal 8 karakter';
    }

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Nama lengkap wajib diisi';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Nomor telepon wajib diisi';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Format nomor telepon tidak valid';
    }

    if (formData.branchIds.length === 0) {
      newErrors.branchIds = 'Pilih minimal 1 cabang';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handlers
  const handleInputChange = (field: keyof CreateAdminManagerData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBranchToggle = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter(id => id !== branchId)
        : [...prev.branchIds, branchId],
    }));
    setBranchAccessScopes(prev => {
      if (formData.branchIds.includes(branchId)) {
        const next = { ...prev };
        delete next[branchId];
        return next;
      }

      return { ...prev, [branchId]: prev[branchId] || 'FULL' };
    });
    // Clear error when user selects
    if (errors.branchIds) {
      setErrors(prev => ({ ...prev, branchIds: undefined }));
    }
  };

  const handleBranchScopeChange = (branchId: string, accessScope: AdminManagerAccessScope) => {
    setBranchAccessScopes(prev => ({ ...prev, [branchId]: accessScope }));
  };

  const handleSelectAllBranches = () => {
    if (formData.branchIds.length === branches.length) {
      setFormData(prev => ({ ...prev, branchIds: [] }));
      setBranchAccessScopes({});
    } else {
      setFormData(prev => ({ ...prev, branchIds: branches.map(b => b.id) }));
      setBranchAccessScopes(prev => Object.fromEntries(
        branches.map((branch) => [branch.id, prev[branch.id] || 'FULL']),
      ));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast.error('Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    try {
      setLoading(true);
      await adminManagersApi.createAdminManager({
        ...formData,
        branchAssignments: formData.branchIds.map((branchId) => ({
          branchId,
          accessScope: branchAccessScopes[branchId] || 'FULL',
        })),
      });
      showToast.success('Admin Manager berhasil dibuat');
      onSuccess();
      handleClose();
    } catch (error: any) {
      devError('Error creating admin manager:', error);
      const message = error.response?.data?.message || 'Gagal membuat Admin Manager';
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      phoneNumber: '',
      branchIds: [],
    });
    setBranchAccessScopes({});
    setErrors({});
    setShowPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2>Tambah Admin Manager</h2>
            <p>Buat akun Admin Manager baru dan assign cabang</p>
          </div>
          <button className={styles.closeButton} onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Personal Information */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Informasi Personal</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="fullName">
                Nama Lengkap <span className={styles.required}>*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                placeholder="Masukkan nama lengkap"
                className={errors.fullName ? styles.inputError : ''}
              />
              {errors.fullName && <span className={styles.errorText}>{errors.fullName}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">
                Email <span className={styles.required}>*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="admin@example.com"
                className={errors.email ? styles.inputError : ''}
              />
              {errors.email && <span className={styles.errorText}>{errors.email}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phoneNumber">
                Nomor Telepon <span className={styles.required}>*</span>
              </label>
              <input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="+62 812 3456 7890"
                className={errors.phoneNumber ? styles.inputError : ''}
              />
              {errors.phoneNumber && <span className={styles.errorText}>{errors.phoneNumber}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">
                Password <span className={styles.required}>*</span>
              </label>
              <div className={styles.passwordInput}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className={errors.password ? styles.inputError : ''}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className={styles.errorText}>{errors.password}</span>}
            </div>
          </div>

          {/* Branch Assignment */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                Assign Cabang <span className={styles.required}>*</span>
              </h3>
              <button
                type="button"
                className={styles.selectAllBtn}
                onClick={handleSelectAllBranches}
              >
                {formData.branchIds.length === branches.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {loadingBranches ? (
              <div className={styles.loadingBranches}>
                <div className={styles.spinner}>⏳</div>
                <p>Memuat cabang...</p>
              </div>
            ) : branches.length === 0 ? (
              <div className={styles.noBranches}>
                <Building2 size={32} />
                <p>Tidak ada cabang tersedia</p>
              </div>
            ) : (
              <div className={styles.branchGrid}>
                {branches.map((branch) => (
                  <label key={branch.id} className={styles.branchCard}>
                    <input
                      type="checkbox"
                      checked={formData.branchIds.includes(branch.id)}
                      onChange={() => handleBranchToggle(branch.id)}
                    />
                    <div className={styles.branchInfo}>
                      <div className={styles.branchIcon}>
                        <Building2 size={20} />
                      </div>
                      <div className={styles.branchDetails}>
                        <span className={styles.branchCode}>{branch.branchCode}</span>
                        <span className={styles.branchName}>{branch.name}</span>
                        <span className={styles.branchType}>{branch.type}</span>
                        {formData.branchIds.includes(branch.id) && (
                          <select
                            className={styles.branchScopeSelect}
                            value={branchAccessScopes[branch.id] || 'FULL'}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => handleBranchScopeChange(
                              branch.id,
                              e.target.value as AdminManagerAccessScope,
                            )}
                            aria-label={`Scope akses ${branch.name}`}
                          >
                            <option value="FULL">Akses Penuh</option>
                            <option value="MEMBER_VIEW_ONLY">Hanya Lihat Member</option>
                          </select>
                        )}
                      </div>
                    </div>
                    <div className={styles.checkmark}>
                      {formData.branchIds.includes(branch.id) && '✓'}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {errors.branchIds && <span className={styles.errorText}>{errors.branchIds}</span>}
          </div>

          {/* Summary */}
          {formData.branchIds.length > 0 && (
            <div className={styles.summary}>
              <Building2 size={18} />
              <span>
                {formData.branchIds.length} cabang dipilih
              </span>
            </div>
          )}

          {/* Actions */}
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading || loadingBranches}
            >
              {loading ? (
                <>
                  <span className={styles.spinner}>⏳</span>
                  Membuat...
                </>
              ) : (
                'Buat Admin Manager'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
