'use client';

import { useEffect, useState } from 'react';
import { Loader2, Phone, Save, X } from 'lucide-react';
import { assertCaughtError } from '@/lib/caughtError';
import { updateMemberApi } from '@/lib/membersApi';
import { showToast } from '@/lib/toast';

interface MemberPhoneEditModalProps {
  isOpen: boolean;
  memberId: string;
  memberName: string;
  currentPhone?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MemberPhoneEditModal({
  isOpen,
  memberId,
  memberName,
  currentPhone,
  onClose,
  onSuccess,
}: MemberPhoneEditModalProps) {
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setPhone(currentPhone || '');
  }, [currentPhone, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedPhone = phone.trim();

    if (normalizedPhone && normalizedPhone.replace(/\D/g, '').length < 10) {
      showToast.error('Nomor telepon minimal 10 digit');
      return;
    }

    if (normalizedPhone === (currentPhone || '').trim()) {
      showToast.info('Nomor telepon tidak berubah');
      return;
    }

    setSubmitting(true);
    try {
      await updateMemberApi(memberId, { phone: normalizedPhone });
      showToast.success('Nomor telepon member berhasil diperbarui');
      onSuccess();
      onClose();
    } catch (error) {
      assertCaughtError(error);
      showToast.error(error.response?.data?.error?.message || 'Gagal memperbarui nomor telepon');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Tutup modal"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Phone size={20} />
            </span>
            <div>
              <h2 className="font-bold text-neutral-900 dark:text-white">Edit Nomor Telepon</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{memberName}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 px-5 py-5">
          <label htmlFor="member-phone" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Nomor Telepon
          </label>
          <input
            id="member-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={submitting}
            autoFocus
            placeholder="08xxxxxxxxxx"
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Boleh dikosongkan. Jika diisi, minimal 10 digit.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4 dark:border-neutral-700 dark:bg-neutral-800/50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
}
