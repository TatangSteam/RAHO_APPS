'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgeDollarSign,
  Building2,
  ClipboardList,
  Eye,
  EyeOff,
  HeartPulse,
  PackageCheck,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

type CreatableStaffRole =
  | 'ADMIN_LOGISTIK'
  | 'FINANCE_LOGISTICS_CONTROLLER'
  | 'ADMIN_CABANG'
  | 'DOCTOR'
  | 'NURSE'
  | 'ADMIN_LAYANAN';

const GLOBAL_STAFF_ROLES: CreatableStaffRole[] = [
  'ADMIN_LOGISTIK',
  'FINANCE_LOGISTICS_CONTROLLER',
];

const SUPER_ADMIN_CREATABLE_ROLES: CreatableStaffRole[] = [
  'ADMIN_LOGISTIK',
  'FINANCE_LOGISTICS_CONTROLLER',
  'ADMIN_CABANG',
  'DOCTOR',
  'NURSE',
  'ADMIN_LAYANAN',
];

const ADMIN_MANAGER_CREATABLE_ROLES: CreatableStaffRole[] = [
  'ADMIN_CABANG',
  'DOCTOR',
  'NURSE',
  'ADMIN_LAYANAN',
];

const BRANCH_CREATABLE_ROLES: CreatableStaffRole[] = ['DOCTOR', 'NURSE', 'ADMIN_LAYANAN'];

const STAFF_ROLE_META: Record<CreatableStaffRole, {
  label: string;
  description: string;
  icon: LucideIcon;
}> = {
  ADMIN_LOGISTIK: {
    label: 'Admin Logistik',
    description: 'Mengelola stok pusat, pengiriman, dan proses logistik',
    icon: PackageCheck,
  },
  FINANCE_LOGISTICS_CONTROLLER: {
    label: 'Finance & Logistik',
    description: 'Mengelola Finance dan Logistik seluruh cabang dengan kontrol approval',
    icon: BadgeDollarSign,
  },
  ADMIN_CABANG: {
    label: 'Admin Cabang',
    description: 'Mengelola cabang, staff, dan operasional cabang',
    icon: Building2,
  },
  DOCTOR: {
    label: 'Dokter',
    description: 'Dapat melakukan diagnosis, evaluasi, dan mengelola terapi pasien',
    icon: Stethoscope,
  },
  NURSE: {
    label: 'Perawat',
    description: 'Dapat melakukan vital signs, infusion, dan material usage',
    icon: HeartPulse,
  },
  ADMIN_LAYANAN: {
    label: 'Admin Layanan',
    description: 'Dapat mengelola sesi terapi dan administrasi layanan',
    icon: ClipboardList,
  },
};

function getCreatableRoles(userRole: string): CreatableStaffRole[] {
  if (userRole === 'SUPER_ADMIN') return SUPER_ADMIN_CREATABLE_ROLES;
  if (userRole === 'ADMIN_MANAGER') return ADMIN_MANAGER_CREATABLE_ROLES;
  return BRANCH_CREATABLE_ROLES;
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
    role: 'NURSE' as CreatableStaffRole,
    fullName: '',
    phone: '',
    selectedBranchId: branchId || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const canSelectBranch = userRole === 'ADMIN_MANAGER' || userRole === 'SUPER_ADMIN';
  const showBranchSelection = canSelectBranch && !GLOBAL_STAFF_ROLES.includes(formData.role);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const loadBranches = useCallback(async () => {
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
      assertCaughtError(error);
      devError('Error loading branches:', error);
      showToast.error('Gagal memuat data cabang');
    } finally {
      setLoadingBranches(false);
    }
  }, [accessToken]);

  // Fetch branches for global staff creators
  useEffect(() => {
    if (show && canSelectBranch) {
      void loadBranches();
    }
  }, [canSelectBranch, loadBranches, show]);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
      // Reset form when modal opens
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        role: canSelectBranch ? 'ADMIN_CABANG' : 'NURSE',
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
  }, [show, branchId, canSelectBranch]);

  if (!show || !mounted) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (showBranchSelection && !formData.selectedBranchId) {
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
        branchId: GLOBAL_STAFF_ROLES.includes(formData.role)
          ? null
          : canSelectBranch
            ? formData.selectedBranchId
            : branchId,
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
    } catch (error) {
      assertCaughtError(error);
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

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}><UserPlus size={22} /> Tambah User Baru</h3>
            <p className={styles.modalSubtitle}>Buat akun user beserta hak aksesnya</p>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
            disabled={loading}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {/* Role Selection */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>1. Pilih Role {canSelectBranch ? 'User' : 'Staff'}</h4>
            <div className={styles.roleGrid}>
              {getCreatableRoles(userRole).map((role) => {
                const roleMeta = STAFF_ROLE_META[role];
                const RoleIcon = roleMeta.icon;
                return (
                  <button
                    type="button"
                    key={role}
                    className={`${styles.roleCard} ${formData.role === role ? styles.roleCardActive : ''}`}
                    onClick={() => setFormData({ ...formData, role })}
                    aria-pressed={formData.role === role}
                    disabled={loading}
                  >
                    <div className={styles.roleIcon}>
                      <RoleIcon size={26} />
                    </div>
                    <div className={styles.roleInfo}>
                      <h5 className={styles.roleName}>{roleMeta.label}</h5>
                      <p className={styles.roleDesc}>{roleMeta.description}</p>
                    </div>
                    <div className={styles.roleCheck}>
                      {formData.role === role && <span aria-hidden="true">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Branch Selection for branch-scoped roles */}
          {showBranchSelection && (
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
            <h4 className={styles.sectionTitle}>{showBranchSelection ? '3' : '2'}. Informasi Personal</h4>
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
            <h4 className={styles.sectionTitle}>{showBranchSelection ? '4' : '3'}. Informasi Akun</h4>
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
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                    title={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
