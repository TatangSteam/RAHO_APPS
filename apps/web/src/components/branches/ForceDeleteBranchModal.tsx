'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Branch } from '@/lib/api/branchesApi';
import { api } from '@/lib/api';

interface ForceDeleteBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch | null;
  onConfirm: () => Promise<void>;
}

interface BranchStats {
  totalMembers: number;
  activeUsers: number;
  activePackages: number;
}

export default function ForceDeleteBranchModal({
  isOpen,
  onClose,
  branch,
  onConfirm,
}: ForceDeleteBranchModalProps) {
  const [step, setStep] = useState(1);
  const [branchNameInput, setBranchNameInput] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<BranchStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch branch stats when modal opens
  useEffect(() => {
    if (isOpen && branch) {
      fetchBranchStats();
    }
  }, [isOpen, branch]);

  const fetchBranchStats = async () => {
    if (!branch) return;
    
    try {
      setLoadingStats(true);
      const response = await api.get(`/branches/${branch.id}`, {
        params: { _t: Date.now() }
      });
      setStats(response.data.data?.stats || null);
    } catch (error) {
      console.error('Error fetching branch stats:', error);
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  if (!isOpen || !branch || !mounted) return null;

  const resetModal = () => {
    setStep(1);
    setBranchNameInput('');
    setUnderstood(false);
    setDeleteConfirmInput('');
    setIsDeleting(false);
  };

  const handleClose = () => {
    if (!isDeleting) {
      resetModal();
      onClose();
    }
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      resetModal();
      onClose();
    } catch (error) {
      setIsDeleting(false);
    }
  };

  const canProceedToStep2 = step === 1;
  const canProceedToStep3 = step === 2 && branchNameInput === branch.name;
  const canProceedToStep4 = step === 3 && understood;
  const canDelete = step === 4 && deleteConfirmInput === 'DELETE';

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white dark:bg-neutral-900 shadow-2xl border-2 border-red-600">
        {/* Header - Extra Dangerous */}
        <div className="border-b-4 border-red-600 bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">⚠️ FORCE DELETE - PERMANENT</h2>
              <p className="text-sm text-red-100">
                Tindakan ini TIDAK BISA dibatalkan! Langkah {step}/4
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Step 1: Warning */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
                <h3 className="mb-3 text-lg font-bold text-red-900">
                  🚨 PERINGATAN KERAS - BACA DENGAN TELITI!
                </h3>
                <p className="mb-4 font-semibold text-red-800">
                  Anda akan menghapus PERMANEN cabang: <span className="text-xl font-bold">{branch.branchCode} - {branch.name}</span>
                </p>
                <div className="space-y-2 text-sm text-red-900">
                  <p className="font-bold">Force Delete akan menghapus SEMUA data berikut:</p>
                  <ul className="ml-6 space-y-1 list-disc">
                    <li><strong>Semua Member</strong> dan data pribadi mereka</li>
                    <li><strong>Therapy Plans, Diagnoses, Lab Results</strong> - semua rekam medis</li>
                    <li><strong>Encounters & Treatment Sessions</strong> - riwayat terapi lengkap</li>
                    <li><strong>Invoices & Payments</strong> - semua transaksi keuangan</li>
                    <li><strong>Inventory</strong> - stock, mutations, requests, shipments</li>
                    <li><strong>Staff & Users</strong> - account yang terikat ke cabang ini</li>
                    <li><strong>Package Pricing & Referral Codes</strong></li>
                    <li><strong>Notifications & Chat History</strong></li>
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-4">
                <h4 className="mb-2 font-bold text-orange-900">📋 Gunakan HANYA untuk:</h4>
                <ul className="ml-6 space-y-1 text-sm text-orange-800 list-disc">
                  <li>Menghapus cabang testing/dummy</li>
                  <li>Cleanup data error yang fatal</li>
                  <li>Cabang yang belum operasional sama sekali</li>
                </ul>
              </div>

              <div className="rounded-lg border-2 border-red-500 bg-red-100 p-4">
                <p className="text-center text-sm font-bold text-red-900">
                  ⚠️ TIDAK ADA cara untuk mengembalikan data setelah dihapus! ⚠️
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Type Branch Name */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-300">
                <h3 className="mb-3 text-lg font-bold text-gray-900">
                  Langkah 2: Konfirmasi Nama Cabang
                </h3>
                <p className="mb-4 text-sm text-gray-700">
                  Ketik nama cabang dengan tepat untuk melanjutkan:
                </p>
                <p className="mb-2 rounded bg-amber-100 dark:bg-amber-900 p-3 text-center font-mono text-xl font-bold text-amber-900 dark:text-amber-100 border-2 border-amber-300 dark:border-amber-700">
                  {branch.name}
                </p>
                <input
                  type="text"
                  value={branchNameInput}
                  onChange={(e) => setBranchNameInput(e.target.value)}
                  placeholder="Ketik nama cabang di sini"
                  className="w-full rounded border-2 border-gray-300 px-4 py-2 focus:border-red-500 focus:outline-none"
                  autoFocus
                  disabled={isDeleting}
                />
                {branchNameInput && branchNameInput !== branch.name && (
                  <p className="mt-2 text-sm text-red-600">❌ Nama cabang tidak sesuai</p>
                )}
                {branchNameInput === branch.name && (
                  <p className="mt-2 text-sm text-green-600">✅ Nama cabang sesuai</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Checkbox Understanding */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 p-4 border-2 border-red-400">
                <h3 className="mb-3 text-lg font-bold text-gray-900">
                  Langkah 3: Pernyataan Pemahaman
                </h3>
                <div className="space-y-4">
                  <div className="rounded bg-white dark:bg-neutral-800 p-4 border-2 border-red-400 dark:border-red-600">
                    <h4 className="mb-3 font-bold text-red-900 dark:text-red-300">
                      Ringkasan Data yang Akan Dihapus:
                      {loadingStats && <span className="ml-2 text-sm text-gray-500">(Memuat...)</span>}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded bg-red-100 dark:bg-red-950 p-3 border border-red-300 dark:border-red-700">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">Members:</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                          {loadingStats ? '...' : (stats?.totalMembers ?? 0)}
                        </p>
                      </div>
                      <div className="rounded bg-red-100 dark:bg-red-950 p-3 border border-red-300 dark:border-red-700">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">Staff:</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                          {loadingStats ? '...' : (stats?.activeUsers ?? 0)}
                        </p>
                      </div>
                      <div className="rounded bg-red-100 dark:bg-red-950 p-3 border border-red-300 dark:border-red-700">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">Active Packages:</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                          {loadingStats ? '...' : (stats?.activePackages ?? 0)}
                        </p>
                      </div>
                      <div className="rounded bg-red-100 dark:bg-red-950 p-3 border border-red-300 dark:border-red-700">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">Status:</p>
                        <p className="text-xl font-bold text-red-700 dark:text-red-400">
                          SEMUA HILANG
                        </p>
                      </div>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded border-2 border-red-500 bg-white p-4 hover:bg-red-50">
                    <input
                      type="checkbox"
                      checked={understood}
                      onChange={(e) => setUnderstood(e.target.checked)}
                      className="mt-1 h-5 w-5"
                      disabled={isDeleting}
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      Saya memahami bahwa semua data member, terapi, invoice, dan inventory akan
                      <span className="text-red-600"> DIHAPUS PERMANEN</span> dan{' '}
                      <span className="text-red-600">TIDAK BISA DIKEMBALIKAN</span>. Saya bertanggung
                      jawab penuh atas tindakan ini.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Final Confirmation */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 p-4 border-4 border-red-600">
                <h3 className="mb-3 text-lg font-bold text-red-900">
                  🔴 Langkah 4: Konfirmasi Akhir
                </h3>
                <p className="mb-4 text-sm font-semibold text-red-800">
                  Ini adalah kesempatan terakhir untuk membatalkan!
                </p>
                <div className="mb-4 rounded border-4 border-red-500 bg-red-50 dark:bg-red-950 p-5">
                  <p className="text-center font-mono text-2xl font-bold text-red-700 dark:text-red-300">
                    {branch.branchCode} - {branch.name}
                  </p>
                  <p className="mt-2 text-center text-base font-semibold text-red-600 dark:text-red-400">
                    akan dihapus PERMANEN bersama SEMUA datanya
                  </p>
                </div>
                <p className="mb-2 text-sm font-bold text-gray-900">
                  Ketik <span className="rounded bg-red-600 px-2 py-1 text-white">DELETE</span> untuk
                  konfirmasi:
                </p>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value.toUpperCase())}
                  placeholder="Ketik DELETE (huruf besar)"
                  className="w-full rounded border-2 border-red-500 px-4 py-2 font-mono text-lg font-bold focus:border-red-600 focus:outline-none"
                  autoFocus
                  disabled={isDeleting}
                />
                {deleteConfirmInput && deleteConfirmInput !== 'DELETE' && (
                  <p className="mt-2 text-sm text-red-600">❌ Harus mengetik "DELETE" (huruf besar)</p>
                )}
                {deleteConfirmInput === 'DELETE' && (
                  <p className="mt-2 text-sm text-red-600 font-bold animate-pulse">
                    ⚠️ Siap untuk dihapus permanen!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 border-t border-red-200 bg-red-50/50 dark:bg-neutral-800 dark:border-neutral-700 px-6 py-4">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="rounded-lg border-2 border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-6 py-2 font-semibold text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === 1 ? 'Batal' : 'Kembali'}
          </button>

          <div className="flex gap-3">
            {step > 1 && step < 4 && (
              <button
                onClick={() => setStep(step - 1)}
                disabled={isDeleting}
                className="rounded-lg border-2 border-gray-400 bg-gray-100 px-6 py-2 font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ← Kembali
              </button>
            )}

            {step < 4 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={
                  isDeleting ||
                  (step === 2 && !canProceedToStep3) ||
                  (step === 3 && !canProceedToStep4)
                }
                className="rounded-lg bg-orange-600 px-6 py-2 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {step === 1 && 'Saya Paham, Lanjutkan →'}
                {step === 2 && (canProceedToStep3 ? 'Lanjut ke Step 3 →' : 'Isi Nama Cabang')}
                {step === 3 && (canProceedToStep4 ? 'Lanjut ke Konfirmasi Final →' : 'Centang Pernyataan')}
              </button>
            )}

            {step === 4 && (
              <button
                onClick={handleConfirm}
                disabled={!canDelete || isDeleting}
                className="rounded-lg bg-red-600 px-6 py-2 font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400 animate-pulse"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Menghapus...
                  </span>
                ) : canDelete ? (
                  '🔴 HAPUS PERMANEN SEKARANG'
                ) : (
                  'Ketik DELETE untuk Melanjutkan'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
