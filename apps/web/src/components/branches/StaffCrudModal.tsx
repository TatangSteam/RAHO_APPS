'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserCog, Mail, Phone, User, Shield, Save, Loader2, Info } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { api } from '@/lib/api';

interface StaffCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  action: 'create' | 'edit' | 'delete';
  branchId: string;
  staffData?: any;
  callerRole?: string; // Role of the user opening the modal
}

interface StaffFormData {
  email: string;
  password?: string;
  role: 'ADMIN_CABANG' | 'ADMIN_LAYANAN' | 'DOCTOR' | 'NURSE';
  fullName: string;
  phone: string;
  isActive: boolean;
}

// Role options for ADMIN_CABANG - can only create ADMIN_LAYANAN, DOCTOR, NURSE
const ROLE_OPTIONS_ADMIN_CABANG = [
  { value: 'ADMIN_LAYANAN', label: 'Admin Layanan' },
  { value: 'DOCTOR', label: 'Dokter' },
  { value: 'NURSE', label: 'Perawat' }
];

// Role options for SUPER_ADMIN/ADMIN_MANAGER - can also create ADMIN_CABANG
const ROLE_OPTIONS_MANAGER = [
  { value: 'ADMIN_CABANG', label: 'Admin Cabang' },
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
  staffData,
  callerRole
}: StaffCrudModalProps) {
  // Determine which role options to show based on caller's role
  const roleOptions = (callerRole === 'SUPER_ADMIN' || callerRole === 'ADMIN_MANAGER') 
    ? ROLE_OPTIONS_MANAGER 
    : ROLE_OPTIONS_ADMIN_CABANG;
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<StaffFormData>({
    email: '',
    password: '',
    role: 'ADMIN_LAYANAN',
    fullName: '',
    phone: '',
    isActive: true
  });

  // Handle mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock/unlock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

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
    } else if (action === 'create') {
      // Reset form for create
      setFormData({
        email: '',
        password: '',
        role: 'ADMIN_LAYANAN',
        fullName: '',
        phone: '',
        isActive: true
      });
    }
    setError('');
  }, [action, staffData, isOpen]);

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
    setError('');

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
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || `Gagal ${action === 'create' ? 'menambahkan' : 'memperbarui'} staff`;
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
              <UserCog className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {action === 'create' ? 'Tambah Staff Baru' : 'Edit Staff'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {action === 'create' ? 'Buat akun staff baru untuk cabang ini' : 'Perbarui informasi staff'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Nama & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  placeholder="Masukkan nama lengkap"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={action === 'edit'}
                  placeholder="staff@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Password & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {action === 'create' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    placeholder="Minimal 8 karakter"
                    minLength={8}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            <div className={action === 'edit' ? 'md:col-span-1' : ''}>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Nomor Telepon
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {action === 'edit' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                >
                  {roleOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Role (for create) */}
          {action === 'create' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              >
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Checkbox */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="w-5 h-5 rounded border-neutral-300 dark:border-neutral-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 dark:bg-neutral-700"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
              Staff Aktif
            </label>
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30">
            <Info className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-700 dark:text-orange-300">
              <p className="font-medium mb-1">Informasi</p>
              <p className="text-orange-600 dark:text-orange-400">
                {action === 'create' 
                  ? 'Staff akan menerima email dengan kredensial login setelah akun dibuat.'
                  : 'Perubahan role akan mempengaruhi akses staff ke fitur sistem.'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {action === 'create' ? 'Tambah Staff' : 'Simpan Perubahan'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
