'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { lookupMemberApi, grantAccessApi } from '@/lib/membersApi';
import type { MemberLookup } from '@/types/member';
import { Search, X, Phone, Building2, CheckCircle, AlertCircle, UserPlus, Loader2, Info } from 'lucide-react';

interface LookupMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LookupMemberModal({ isOpen, onClose, onSuccess }: LookupMemberModalProps) {
  const [lookupMemberNo, setLookupMemberNo] = useState('');
  const [lookupResult, setLookupResult] = useState<MemberLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

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

  const handleLookup = async () => {
    if (!lookupMemberNo) {
      setError('Nomor member wajib diisi');
      return;
    }

    try {
      setLookupLoading(true);
      setError('');
      const result = await lookupMemberApi(lookupMemberNo);
      setLookupResult(result);
    } catch (error) {
      assertCaughtError(error);
      setError(error.response?.data?.error?.message || 'Member tidak ditemukan');
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!lookupResult) return;

    if (
      !confirm(
        `Berikan akses member ${lookupResult.fullName} (${lookupResult.memberNo}) ke cabang Anda?`
      )
    ) {
      return;
    }

    try {
      setGrantingAccess(true);
      setError('');
      await grantAccessApi(lookupResult.memberNo);
      alert('Akses berhasil diberikan!');
      handleClose();
      onSuccess?.();
    } catch (error) {
      assertCaughtError(error);
      setError(error.response?.data?.error?.message || 'Gagal memberikan akses');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleClose = () => {
    setLookupMemberNo('');
    setLookupResult(null);
    setError('');
    onClose();
  };

  if (!isOpen || !mounted) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Cari Member Lintas Cabang</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Cari dan berikan akses member</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Nomor Member <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="MBR-XXX-XXXX-XXXXX"
                value={lookupMemberNo}
                onChange={(e) => setLookupMemberNo(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                className="flex-1 px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
              <button
                onClick={handleLookup}
                disabled={lookupLoading}
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {lookupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>Cari</span>
              </button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 flex items-center gap-1">
              <span className="text-amber-500">💡</span>
              Contoh: MBR-PST-2604-00043
            </p>
          </div>

          {/* Loading State */}
          {lookupLoading && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 text-orange-500 animate-spin mx-auto mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">Mencari member...</p>
            </div>
          )}

          {/* Result */}
          {!lookupLoading && lookupResult && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {/* Member Info Header */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-orange-500/30">
                    {lookupResult.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                      {lookupResult.fullName}
                    </h4>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 font-mono">
                      {lookupResult.memberNo}
                    </p>
                  </div>
                  {lookupResult.isActive ? (
                    <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Aktif
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold rounded-full flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Nonaktif
                    </span>
                  )}
                </div>
              </div>

              {/* Member Details */}
              <div className="p-4 space-y-4 bg-white dark:bg-neutral-900">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Telepon</p>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{lookupResult.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Cabang Registrasi</p>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{lookupResult.registrationBranch}</p>
                    </div>
                  </div>
                </div>

                {/* Access Status */}
                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Status Akses Cabang Anda</p>
                  {lookupResult.sudahAdaAkses ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Member sudah memiliki akses ke cabang Anda
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Member belum memiliki akses ke cabang Anda
                      </span>
                    </div>
                  )}
                </div>

                {/* Grant Access Button */}
                {!lookupResult.sudahAdaAkses && !lookupResult.isRegistrationBranch && (
                  <button
                    onClick={handleGrantAccess}
                    disabled={grantingAccess}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {grantingAccess ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memberikan Akses...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span>Berikan Akses ke Cabang Ini</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Info Box - Show when no result */}
          {!lookupResult && !lookupLoading && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30">
              <Info className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-700 dark:text-orange-300">
                <p className="font-medium mb-1">Informasi</p>
                <p className="text-orange-600 dark:text-orange-400">
                  Masukkan nomor member untuk mencari member dari cabang lain dan memberikan akses ke cabang Anda.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={handleClose}
            className="w-full px-5 py-2.5 text-sm font-semibold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
