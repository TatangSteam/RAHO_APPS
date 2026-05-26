'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';
import styles from './CreateStaffModal.module.css';

interface Props {
  show: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accessToken: string;
  branchId: string | null; // null for ADMIN_MANAGER
  userRole: string;
}

export default function CreateStaffModal({ show, onClose, onSuccess, accessToken, branchId, userRole }: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Array<{ id: string; branchCode: string; name: string }>>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'NURSE' as 'ADMIN_CABANG' | 'DOCTOR' | 'NURSE' | 'ADMIN_LAYANAN',
    fullName: '',
    phone: '',
    selectedBranchId: branchId || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isAdminManager = userRole === 'ADMIN_MANAGER';

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch branches for ADMIN_MANAGER
  useEffect(() => {
    if (show && isAdminManager) {
      loadBranches();
    }
  }, [show, isAdminManager]);

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/branches/all`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load branches');

      const result = await response.json();
      setBranches(result.data || []);
    } catch (error) {
      devError('Error loading branches:', error);
      showToast.error('Gagal memuat data cabang');
    } finally {
      setLoadingBranches(false);
    }
  };

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
      // Reset form when modal opens
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        role: isAdminManager ? 'ADMIN_CABANG' : 'NURSE',
        fullName: '',
        phone: '',
        selectedBranchId: branchId || '',
      });
      setErrors({});
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [show, branchId, isAdminManager]);

  if (!show || !mounted) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Branch validation for ADMIN_MANAGER
    if (isAdminManager && !formData.selectedBranchId) {
      newErrors.selectedBranchId = 'Cabang harus dipilih';
    }

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email harus diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password harus diisi';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password minimal 8 karakter';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password harus mengandung huruf besar, huruf kecil, dan angka';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Konfirmasi password harus diisi';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Password tidak cocok';
    }

    // Full name validation
    if (!formData.fullName) {
      newErrors.fullName = 'Nama lengkap harus diisi';
    } else if (formData.fullName.length < 2) {
      newErrors.fullName = 'Nama minimal 2 karakter';
    }

    // Phone validation (optional but if filled must be valid)
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

      const payload = {
        email: formData.email,
        password: formData.password,
        role: formData.role,
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        branchId: isAdminManager ? formData.selectedBranchId : branchId,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Gagal membuat staff');
      }

      const result = await response.json();
      showToast.success(`User ${result.data.profile.fullName} berhasil dibuat dengan kode ${result.data.staffCode}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      devError('Error creating staff:', error);
      showToast.error(error.message || 'Gagal membuat user');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      ADMIN_CABANG: 'Admin Cabang',
      DOCTOR: 'Dokter',
      NURSE: 'Perawat',
      ADMIN_LAYANAN: 'Admin Layanan',
    };
    return roleMap[role] || role;
  };

  const getRoleDescription = (role: string) => {
    const descMap: Record<string, string> = {
      ADMIN_CABANG: 'Mengelola cabang, staff, dan operasional cabang',
      DOCTOR: 'Dapat melakukan diagnosis, evaluasi, dan mengelola terapi pasien',
      NURSE: 'Dapat melakukan vital signs, infusion, dan material usage',
      ADMIN_LAYANAN: 'Dapat mengelola sesi terapi dan administrasi layanan',
    };
    return descMap[role] || '';
  };

  const getAvailableRoles = () => {
    if (isAdminManager) {
      return ['ADMIN_CABANG', 'DOCTOR', 'NURSE', 'ADMIN_LAYANAN'] as const;
    }
    return ['DOCTOR', 'NURSE', 'ADMIN_LAYANAN'] as const;
  };

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>👤 Tambah User Baru</h3>
            <p className={styles.modalSubtitle}>Buat akun user untuk cabang Anda</p>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {/* Role Selection */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>1. Pilih Role {isAdminManager ? 'User' : 'Staff'}</h4>
            <div className={styles.roleGrid}>
              {getAvailableRoles().map((role) => (
                <div
                  key={role}
                  className={`${styles.roleCard} ${formData.role === role ? styles.roleCardActive : ''}`}
                  onClick={() => setFormData({ ...formData, role })}
                >
                  <div className={styles.roleIcon}>
                    {role === 'ADMIN_CABANG' ? '👨‍💼' : role === 'DOCTOR' ? '👨‍⚕️' : role === 'NURSE' ? '👩‍⚕️' : '👔'}
                  </div>
                  <div className={styles.roleInfo}>
                    <h5 className={styles.roleName}>{getRoleLabel(role)}</h5>
                    <p className={styles.roleDesc}>{getRoleDescription(role)}</p>
                  </div>
                  <div className={styles.roleCheck}>
                    {formData.role === role && '✓'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Branch Selection for ADMIN_MANAGER */}
          {isAdminManager && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>2. Pilih Cabang</h4>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Cabang <span className={styles.required}>*</span>
                </label>
                <select
                  value={formData.selectedBranchId}
                  onChange={(e) => setFormData({ ...formData, selectedBranchId: e.target.value })}
                  className={`${styles.input} ${errors.selectedBranchId ? styles.inputError : ''}`}
                  disabled={loading || loadingBranches}
                >
                  <option value="">-- Pilih Cabang --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.branchCode} - {branch.name}
                    </option>
                  ))}
                </select>
                {errors.selectedBranchId && <span className={styles.errorText}>{errors.selectedBranchId}</span>}
                {loadingBranches && <span className={styles.hint}>Memuat data cabang...</span>}
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>{isAdminManager ? '3' : '2'}. Informasi Personal</h4>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Nama Lengkap <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={`${styles.input} ${errors.fullName ? styles.inputError : ''}`}
                  placeholder="Masukkan nama lengkap"
                  disabled={loading}
                />
                {errors.fullName && <span className={styles.errorText}>{errors.fullName}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nomor Telepon</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                  placeholder="08xxxxxxxxxx"
                  disabled={loading}
                />
                {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>{isAdminManager ? '4' : '3'}. Informasi Akun</h4>
            <div className={styles.formGrid}>
              <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>
                  Email <span className={styles.required}>*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  placeholder="email@example.com"
                  disabled={loading}
                />
                {errors.email && <span className={styles.errorText}>{errors.email}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Password <span className={styles.required}>*</span>
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                    placeholder="Minimal 8 karakter"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.password && <span className={styles.errorText}>{errors.password}</span>}
                <span className={styles.hint}>Harus mengandung huruf besar, kecil, dan angka</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Konfirmasi Password <span className={styles.required}>*</span>
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
                    placeholder="Ulangi password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
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
              {loading ? '⏳ Membuat User...' : '✓ Buat User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
