'use client';

import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Key, Mail, Shield, Copy, Check, RefreshCw } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { api } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface StaffCredentials {
  id: string;
  email: string;
  role: string;
  staffCode: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  branch: {
    id: string;
    branchCode: string;
    name: string;
  } | null;
}

interface StaffCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
  onSuccess?: () => void;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN_MANAGER: 'Admin Manager',
    ADMIN_CABANG: 'Admin Cabang',
    ADMIN_LAYANAN: 'Admin Layanan',
    DOCTOR: 'Dokter',
    NURSE: 'Nakes',
    MEMBER: 'Member',
  };
  return labels[role] || role;
};

const generateRandomPassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@#$%&*!';
  const all = uppercase + lowercase + numbers + special;
  
  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StaffCredentialsModal({
  isOpen,
  onClose,
  staffId,
  staffName,
  onSuccess,
}: StaffCredentialsModalProps) {
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<StaffCredentials | null>(null);
  
  // Edit states
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  
  // Password reset states
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Copy states
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => {
    if (isOpen && staffId) {
      loadCredentials();
    }
  }, [isOpen, staffId]);

  useEffect(() => {
    if (!isOpen) {
      // Reset states when modal closes
      setEditingEmail(false);
      setShowPasswordReset(false);
      setNewPassword('');
      setShowPassword(false);
    }
  }, [isOpen]);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${staffId}/credentials`);
      setCredentials(response.data.data);
      setNewEmail(response.data.data.email);
    } catch (error: any) {
      console.error('Error loading credentials:', error);
      showToast.error('Gagal memuat data kredensial');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!newEmail.trim()) {
      showToast.error('Email tidak boleh kosong');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showToast.error('Format email tidak valid');
      return;
    }

    try {
      setSavingEmail(true);
      await api.patch(`/users/${staffId}/email`, { email: newEmail });
      showToast.success('Email berhasil diubah');
      setEditingEmail(false);
      await loadCredentials();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating email:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengubah email');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      showToast.error('Password tidak boleh kosong');
      return;
    }

    if (newPassword.length < 6) {
      showToast.error('Password minimal 6 karakter');
      return;
    }

    try {
      setSavingPassword(true);
      await api.post(`/users/${staffId}/reset-password`, { newPassword });
      showToast.success('Password berhasil di-reset');
      setShowPasswordReset(false);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal reset password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateRandomPassword(12);
    setNewPassword(generated);
    setShowPassword(true);
  };

  const copyToClipboard = async (text: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
      showToast.success(`${type === 'email' ? 'Email' : 'Password'} disalin ke clipboard`);
    } catch (error) {
      showToast.error('Gagal menyalin ke clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-amber-500/10 to-transparent flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
              <Key size={16} className="sm:hidden text-white" />
              <Key size={20} className="hidden sm:block text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white truncate">
                Kelola Kredensial
              </h2>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 truncate">
                {staffName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
          >
            <X size={18} className="sm:hidden" />
            <X size={20} className="hidden sm:block" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="w-8 h-8 border-4 border-neutral-300 dark:border-neutral-700 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : credentials ? (
            <div className="space-y-4 sm:space-y-6">
              {/* User Info Card */}
              <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm sm:text-lg flex-shrink-0">
                    {credentials.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-900 dark:text-white text-sm sm:text-base truncate">
                      {credentials.fullName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                      <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                        {getRoleLabel(credentials.role)}
                      </span>
                      <span className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        {credentials.staffCode}
                      </span>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full flex-shrink-0 ${
                    credentials.isActive 
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                  }`}>
                    {credentials.isActive ? 'Aktif' : 'Nonaktif'}
                  </div>
                </div>
                {credentials.branch && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                      <Shield size={12} className="sm:hidden flex-shrink-0" />
                      <Shield size={14} className="hidden sm:block flex-shrink-0" />
                      <span className="truncate">Cabang: <strong className="text-neutral-900 dark:text-white">{credentials.branch.name}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Email Section */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    <Mail size={14} className="sm:hidden text-amber-500" />
                    <Mail size={16} className="hidden sm:block text-amber-500" />
                    Email
                  </label>
                  {!editingEmail && (
                    <button
                      onClick={() => setEditingEmail(true)}
                      className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                    >
                      Ubah Email
                    </button>
                  )}
                </div>
                
                {editingEmail ? (
                  <div className="space-y-2 sm:space-y-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                      placeholder="email@example.com"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEmail}
                        disabled={savingEmail}
                        className="flex-1 px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {savingEmail ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingEmail(false);
                          setNewEmail(credentials.email);
                        }}
                        className="px-3 sm:px-4 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-sm font-medium rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-mono text-xs sm:text-sm truncate">
                      {credentials.email}
                    </div>
                    <button
                      onClick={() => copyToClipboard(credentials.email, 'email')}
                      className="p-2 sm:p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 transition-colors flex-shrink-0"
                      title="Salin email"
                    >
                      {copiedEmail ? <Check size={16} className="sm:hidden text-emerald-500" /> : <Copy size={16} className="sm:hidden" />}
                      {copiedEmail ? <Check size={18} className="hidden sm:block text-emerald-500" /> : <Copy size={18} className="hidden sm:block" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Password Section */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    <Key size={14} className="sm:hidden text-amber-500" />
                    <Key size={16} className="hidden sm:block text-amber-500" />
                    Password
                  </label>
                  {!showPasswordReset && (
                    <button
                      onClick={() => setShowPasswordReset(true)}
                      className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                    >
                      Reset Password
                    </button>
                  )}
                </div>

                {showPasswordReset ? (
                  <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                    <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                      Masukkan password baru untuk user ini.
                    </p>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 pr-20 sm:pr-24 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all font-mono"
                        placeholder="Min. 6 karakter"
                      />
                      <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex gap-0.5 sm:gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1 sm:p-1.5 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
                          title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                        >
                          {showPassword ? <EyeOff size={14} className="sm:hidden" /> : <Eye size={14} className="sm:hidden" />}
                          {showPassword ? <EyeOff size={16} className="hidden sm:block" /> : <Eye size={16} className="hidden sm:block" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="p-1 sm:p-1.5 rounded text-neutral-400 hover:text-amber-500"
                          title="Generate password acak"
                        >
                          <RefreshCw size={14} className="sm:hidden" />
                          <RefreshCw size={16} className="hidden sm:block" />
                        </button>
                      </div>
                    </div>
                    {newPassword && (
                      <button
                        onClick={() => copyToClipboard(newPassword, 'password')}
                        className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        {copiedPassword ? <Check size={12} className="sm:hidden" /> : <Copy size={12} className="sm:hidden" />}
                        {copiedPassword ? <Check size={14} className="hidden sm:block" /> : <Copy size={14} className="hidden sm:block" />}
                        {copiedPassword ? 'Tersalin!' : 'Salin password'}
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleResetPassword}
                        disabled={savingPassword || !newPassword.trim()}
                        className="flex-1 px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {savingPassword ? 'Menyimpan...' : 'Reset'}
                      </button>
                      <button
                        onClick={() => {
                          setShowPasswordReset(false);
                          setNewPassword('');
                        }}
                        className="px-3 sm:px-4 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-sm font-medium rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm">
                    ••••••••••••
                    <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs">(Hanya bisa di-reset)</span>
                  </div>
                )}
              </div>

              {/* Last Login Info */}
              <div className="pt-3 sm:pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Login Terakhir</span>
                  <span className="text-neutral-700 dark:text-neutral-300 text-right">
                    {credentials.lastLoginAt 
                      ? new Date(credentials.lastLoginAt).toLocaleString('id-ID', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Belum pernah'
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">Dibuat</span>
                  <span className="text-neutral-700 dark:text-neutral-300 text-right">
                    {new Date(credentials.createdAt).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8 text-neutral-500 dark:text-neutral-400 text-sm">
              Data tidak ditemukan
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 sm:py-2.5 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-sm font-medium rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
