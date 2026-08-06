'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Mail, Phone, Save, UserPen, X } from 'lucide-react';
import * as referralsApi from '@/lib/api/referralsApi';
import { getApiErrorMessage } from '@/lib/api';
import { REFERRER_TYPE_OPTIONS, type ReferrerType } from '@/lib/referralUtils';

interface EditReferralModalProps {
  referral: referralsApi.ReferralCode;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditReferralModal({
  referral,
  onClose,
  onSuccess,
}: EditReferralModalProps) {
  const [formData, setFormData] = useState<referralsApi.UpdateReferralInput>({
    referrerName: referral.referrerName,
    referrerType: referral.referrerType,
    phone: referral.phone || '',
    email: referral.email || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateFormData = <K extends keyof referralsApi.UpdateReferralInput>(
    key: K,
    value: referralsApi.UpdateReferralInput[K],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const referrerName = formData.referrerName?.trim();
    if (!referrerName) {
      setError('Nama referrer harus diisi');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await referralsApi.updateReferral(referral.id, {
        referrerName,
        referrerType: formData.referrerType,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
      });
      onSuccess();
    } catch (error) {
      assertCaughtError(error);
      setError(getApiErrorMessage(error) || 'Gagal mengupdate kode referral');
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
        aria-labelledby="edit-referral-title"
        className="relative w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500 text-white">
              <UserPen className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-referral-title" className="text-lg font-bold text-neutral-900 dark:text-white">
                Edit Kode Referral
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {referral.code} - {referral.branch?.name || 'Cabang'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-60 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Tutup modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Nama Referrer <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.referrerName || ''}
              onChange={(event) => updateFormData('referrerName', event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              placeholder="Masukkan nama referrer"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Tipe Referrer <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.referrerType}
                onChange={(event) => updateFormData('referrerType', event.target.value as ReferrerType)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              >
                {REFERRER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                No. Telepon
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(event) => updateFormData('phone', event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-11 pr-4 text-neutral-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="email"
                value={formData.email || ''}
                onChange={(event) => updateFormData('email', event.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-11 pr-4 text-neutral-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-purple-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
