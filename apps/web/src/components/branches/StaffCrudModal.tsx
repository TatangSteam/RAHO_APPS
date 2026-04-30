'use client';

import { useState, useEffect } from 'react';
import { X, UserCog, Mail, Phone, User, Shield, Save, Loader2 } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { api } from '@/lib/api';
import styles from '@/styles/crud-modal.module.css';

interface StaffCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'create' | 'edit' | 'delete';
  branchId: string;
  staffData?: any;
}

interface StaffFormData {
  email: string;
  password?: string;
  role: 'ADMIN_LAYANAN' | 'DOCTOR' | 'NURSE';
  fullName: string;
  phone: string;
  isActive: boolean;
}

const ROLE_OPTIONS = [
  { value: 'ADMIN_LAYANAN', label: 'Admin Layanan' },
  { value: 'DOCTOR', label: 'Dokter' },
  { value: 'NURSE', label: 'Perawat' }
];

export default function StaffCrudModal({
  isOpen,
  onClose,
  onSuccess,
  action,
  branchId,
  staffData
}: StaffCrudModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<StaffFormData>({
    email: '',
    password: '',
    role: 'ADMIN_LAYANAN',
    fullName: '',
    phone: '',
    isActive: true
  });

  useEffect(() => {
    if (action === 'edit' && staffData) {
      console.log('🔍 [StaffCrudModal] Setting form data from staffData:', staffData);
      setFormData({
        email: staffData.email || '',
        role: staffData.role || 'ADMIN_LAYANAN',
        fullName: staffData.profile?.fullName || '',
        phone: staffData.profile?.phone || '',
        isActive: staffData.isActive ?? true
      });
      console.log('🔍 [StaffCrudModal] Form data set successfully');
    }
  }, [action, staffData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log('🔍 [StaffCrudModal] Submit attempt:', { action, formData, staffData });

    try {
      if (action === 'create') {
        const createData = {
          email: formData.email,
          password: formData.password,
          role: formData.role,
          fullName: formData.fullName,
          phone: formData.phone,
          branchId: branchId
        };
        
        console.log('🔍 [StaffCrudModal] Creating staff with data:', createData);
        await api.post('/users', createData);
        showToast.success('Staff berhasil ditambahkan');
      } else if (action === 'edit') {
        const updateData = {
          role: formData.role,
          fullName: formData.fullName,
          phone: formData.phone,
          isActive: formData.isActive
        };
        
        console.log('🔍 [StaffCrudModal] Updating staff:', staffData.id, 'with data:', updateData);
        await api.patch(`/users/${staffData.id}`, updateData);
        showToast.success('Staff berhasil diperbarui');
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('❌ [StaffCrudModal] Error saving staff:', error);
      console.error('❌ [StaffCrudModal] Error response:', error.response?.data);
      console.error('❌ [StaffCrudModal] Error status:', error.response?.status);
      console.error('❌ [StaffCrudModal] Error message:', error.response?.data?.error?.message);
      console.error('❌ [StaffCrudModal] Error code:', error.response?.data?.error?.code);
      console.error('❌ [StaffCrudModal] Full error details:', JSON.stringify(error.response?.data, null, 2));
      
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || `Gagal ${action === 'create' ? 'menambahkan' : 'memperbarui'} staff`;
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <UserCog size={24} />
            <h2>{action === 'create' ? 'Tambah Staff Baru' : 'Edit Staff'}</h2>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="fullName">
                <User size={16} />
                Nama Lengkap *
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                required
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">
                <Mail size={16} />
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={action === 'edit'}
                placeholder="staff@example.com"
              />
            </div>

            {action === 'create' && (
              <div className={styles.formGroup}>
                <label htmlFor="password">
                  <Shield size={16} />
                  Password *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="phone">
                <Phone size={16} />
                Nomor Telepon
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="role">
                <Shield size={16} />
                Role *
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
              >
                {ROLE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroupFull}>
              <div className={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                <label htmlFor="isActive">Staff Aktif</label>
              </div>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {action === 'create' ? 'Tambah Staff' : 'Simpan Perubahan'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}