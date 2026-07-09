'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Loader2, Mail, Phone, Plus, UserPlus, X } from 'lucide-react';
import * as referralsApi from '@/lib/api/referralsApi';
import { getApiErrorMessage } from '@/lib/api';
import { REFERRER_TYPE_OPTIONS, type ReferrerType } from '@/lib/referralUtils';

export interface ReferralBranchOption {
  id: string;
  name: string;
  branchCode: string;
}

interface CreateReferralModalProps {
  branches: ReferralBranchOption[];
  isAdminCabang: boolean;
  userBranchId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateReferralModal({
  branches,
  isAdminCabang,
  userBranchId,
  onClose,
  onSuccess,
}: CreateReferralModalProps) {
  const [formData, setFormData] = useState<referralsApi.CreateReferralInput>({
    referrerName: '',
    referrerType: 'SALES',
    branchId: isAdminCabang && userBranchId ? userBranchId : '',
    phone: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateFormData = <K extends keyof referralsApi.CreateReferralInput>(
    key: K,
    value: referralsApi.CreateReferralInput[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.referrerName.trim()) {
      setError('Nama referrer harus diisi');
      return;
    }

    if (!formData.branchId) {
      setError('Cabang harus dipilih');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await referralsApi.createReferral({
        ...formData,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
      });
      onSuccess();
    } catch (error) {
      setError(getApiErrorMessage(error) || 'Gagal membuat kode referral');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-referral-title"
        className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/30">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 id="create-referral-title" className="text-lg font-bold text-neutral-900 dark:text-white">
                Tambah Kode Referral
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Buat kode referral baru untuk sales/dokter/member</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Nama Referrer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.referrerName}
              onChange={(e) => updateFormData('referrerName', e.target.value)}
              placeholder="Masukkan nama referrer"
              className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Tipe Referrer <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.referrerType}
                onChange={(e) => updateFormData('referrerType', e.target.value as ReferrerType)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                {REFERRER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => updateFormData('branchId', e.target.value)}
                disabled={isAdminCabang}
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Pilih Cabang</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">No. Telepon</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => updateFormData('phone', e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  placeholder="email@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
            <Info className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-700 dark:text-purple-300">
              <p className="font-medium mb-1">Informasi Insentif</p>
              <p className="text-purple-600 dark:text-purple-400">
                Kode referral akan otomatis di-generate. Insentif akan dihitung berdasarkan paket yang dibeli member menggunakan kode ini.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Simpan
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
