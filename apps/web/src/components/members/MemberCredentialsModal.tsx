'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useCallback, useState, useEffect } from 'react';
import { X, Eye, EyeOff, Key, UserRound, Building2, Copy, Check, RefreshCw } from 'lucide-react';
import { showToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface MemberCredentials {
  id: string;
  memberNo: string;
  userId: string;
  username: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  registrationBranch: {
    id: string;
    branchCode: string;
    name: string;
  } | null;
}

interface MemberCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  onSuccess?: () => void;
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

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

export default function MemberCredentialsModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  onSuccess,
}: MemberCredentialsModalProps) {
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<MemberCredentials | null>(null);
  
  // Edit states
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  
  // Password reset states
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Copy states
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset states when modal closes
      setEditingUsername(false);
      setShowPasswordReset(false);
      setNewPassword('');
      setShowPassword(false);
    }
  }, [isOpen]);

  const loadCredentials = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/members/${memberId}/credentials`);
      setCredentials(response.data.data);
      setNewUsername(response.data.data.username || response.data.data.email);
    } catch (error) {
      assertCaughtError(error);
      devError('Error loading credentials:', error);
      showToast.error('Gagal memuat data kredensial');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [memberId, onClose]);

  useEffect(() => {
    if (isOpen && memberId) {
      void loadCredentials();
    }
  }, [isOpen, loadCredentials, memberId]);

  const handleSaveUsername = async () => {
    const normalizedUsername = newUsername.trim().toLowerCase();
    if (!normalizedUsername) {
      showToast.error('Username tidak boleh kosong');
      return;
    }

    if (!/^[a-zA-Z0-9._-]{4,30}$/.test(normalizedUsername)) {
      showToast.error('Username harus 4-30 karakter dan hanya boleh berisi huruf, angka, titik, _ atau -');
      return;
    }

    try {
      setSavingUsername(true);
      await api.patch(`/members/${memberId}/username`, { username: normalizedUsername });
      showToast.success('Username berhasil diubah');
      setEditingUsername(false);
      await loadCredentials();
      onSuccess?.();
    } catch (error) {
      assertCaughtError(error);
      devError('Error updating username:', error);
      showToast.error(error.response?.data?.error?.message || 'Gagal mengubah username');
    } finally {
      setSavingUsername(false);
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
      await api.post(`/members/${memberId}/reset-password`, { newPassword });
      showToast.success('Password berhasil di-reset');
      setShowPasswordReset(false);
      setNewPassword('');
    } catch (error) {
      assertCaughtError(error);
      devError('Error resetting password:', error);
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

  const copyToClipboard = async (text: string, type: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'username') {
        setCopiedUsername(true);
        setTimeout(() => setCopiedUsername(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
      showToast.success(`${type === 'username' ? 'Username' : 'Password'} disalin ke clipboard`);
    } catch (error) {
      assertCaughtError(error);
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
                {memberName}
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
              {/* Member Info Card */}
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
                      <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                        Member
                      </span>
                      <span className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        {credentials.memberNo}
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
                {credentials.registrationBranch && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                      <Building2 size={12} className="sm:hidden flex-shrink-0" />
                      <Building2 size={14} className="hidden sm:block flex-shrink-0" />
                      <span className="truncate">Cabang: <strong className="text-neutral-900 dark:text-white">{credentials.registrationBranch.name}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Username Section */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    <UserRound size={14} className="sm:hidden text-amber-500" />
                    <UserRound size={16} className="hidden sm:block text-amber-500" />
                    Username
                  </label>
                  {!editingUsername && (
                    <button
                      onClick={() => setEditingUsername(true)}
                      className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                    >
                      Ubah Username
                    </button>
                  )}
                </div>
                
                {editingUsername ? (
                  <div className="space-y-2 sm:space-y-3">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all"
                      placeholder="contoh: budi.santoso"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveUsername}
                        disabled={savingUsername}
                        className="flex-1 px-3 sm:px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        {savingUsername ? 'Menyimpan...' : 'Simpan'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingUsername(false);
                          setNewUsername(credentials.username);
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
                      {credentials.username}
                    </div>
                    <button
                      onClick={() => copyToClipboard(credentials.username, 'username')}
                      className="p-2 sm:p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 transition-colors flex-shrink-0"
                      title="Salin username"
                    >
                      {copiedUsername ? <Check size={16} className="sm:hidden text-emerald-500" /> : <Copy size={16} className="sm:hidden" />}
                      {copiedUsername ? <Check size={18} className="hidden sm:block text-emerald-500" /> : <Copy size={18} className="hidden sm:block" />}
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
                      Masukkan password baru untuk member ini.
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
                  <span className="text-neutral-500 dark:text-neutral-400">Terdaftar</span>
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
