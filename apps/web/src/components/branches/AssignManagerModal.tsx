'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Search, UserPlus, Loader2, Check } from 'lucide-react';
import { branchesApi } from '@/lib/api/branchesApi';
import { showToast } from '@/lib/toast';
import { devError } from '@/lib/logger';

interface AvailableManager {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

interface AssignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
  branchName: string;
}

export default function AssignManagerModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
  branchName,
}: AssignManagerModalProps) {
  const [managers, setManagers] = useState<AvailableManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAvailableManagers();
      setSelectedManagerId(null);
      setSearchTerm('');
    }
  }, [isOpen, branchId]);

  const loadAvailableManagers = async () => {
    try {
      setLoading(true);
      const response = await branchesApi.getAvailableManagers(branchId);
      setManagers(response.data.data || []);
    } catch (error: any) {
      devError('Error loading available managers:', error);
      showToast.error('Gagal memuat daftar Admin Manager');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedManagerId) {
      showToast.error('Pilih Admin Manager terlebih dahulu');
      return;
    }
    try {
      setSubmitting(true);
      await branchesApi.assignManager(branchId, selectedManagerId);
      showToast.success('Admin Manager berhasil di-assign ke cabang');
      onSuccess();
      onClose();
    } catch (error: any) {
      devError('Error assigning manager:', error);
      showToast.error(error.response?.data?.message || 'Gagal assign Admin Manager');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredManagers = managers.filter(
    (m) =>
      m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/75 flex items-center justify-center z-[9999] p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500" />
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <Shield size={22} className="text-purple-500" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Assign Admin Manager</h2>
          </div>
          <button className="w-9 h-9 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="px-4 py-3 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-lg text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Pilih Admin Manager untuk di-assign ke cabang <strong className="text-purple-600 dark:text-purple-400">{branchName}</strong>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
            <input type="text" placeholder="Cari berdasarkan nama atau email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full py-2.5 pl-11 pr-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500" />
          </div>

          {/* Manager List */}
          {loading ? (
            <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800/30 rounded-xl">
              <Loader2 size={36} className="text-purple-500 animate-spin mx-auto" />
              <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Memuat daftar Admin Manager...</p>
            </div>
          ) : filteredManagers.length === 0 ? (
            <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700 rounded-xl">
              <Shield size={48} className="text-neutral-400 dark:text-neutral-500 mx-auto mb-4" />
              <h4 className="text-base font-semibold text-neutral-700 dark:text-neutral-200 mb-2">
                {searchTerm ? 'Tidak Ditemukan' : 'Tidak Ada Admin Manager'}
              </h4>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {searchTerm ? 'Tidak ada Admin Manager yang cocok dengan pencarian.' : 'Semua Admin Manager sudah di-assign ke cabang ini atau belum ada Admin Manager yang dibuat.'}
              </p>
            </div>
          ) : (
            <div className="max-h-[280px] overflow-y-auto border-2 border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800/50">
              {filteredManagers.map((manager, index) => (
                <div key={manager.id} onClick={() => setSelectedManagerId(manager.id)} className={`flex items-center gap-3.5 px-4 py-3.5 cursor-pointer transition-all ${index < filteredManagers.length - 1 ? 'border-b border-neutral-200 dark:border-neutral-700' : ''} ${selectedManagerId === manager.id ? 'bg-purple-50 dark:bg-purple-500/10 border-l-[3px] border-l-purple-500' : 'border-l-[3px] border-l-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}>
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${selectedManagerId === manager.id ? 'bg-purple-200 dark:bg-purple-500/25 text-purple-600 dark:text-purple-400' : 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400'}`}>
                    {manager.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-neutral-900 dark:text-white mb-0.5">{manager.fullName}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{manager.email}</div>
                    {manager.phone && <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{manager.phone}</div>}
                  </div>
                  {selectedManagerId === manager.id && (
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 px-6 py-5 border-t-2 border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button type="button" onClick={onClose} disabled={submitting} className="px-6 py-2.5 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-sm font-semibold hover:border-neutral-300 dark:hover:border-neutral-600 transition-all disabled:opacity-50">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={!selectedManagerId || submitting} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-sm font-semibold transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20">
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Assign Manager</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
