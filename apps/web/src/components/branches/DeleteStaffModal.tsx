'use client';

import { AlertTriangle, X, Trash2, Users, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface DeleteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  staff: {
    id: string;
    fullName: string;
    role: string;
    email: string;
  };
}

export default function DeleteStaffModal({
  isOpen,
  onClose,
  onConfirm,
  staff,
}: DeleteStaffModalProps) {
  const [loading, setLoading] = useState(false);
  const [sessionStats, setSessionStats] = useState<{
    active: number;
    completed: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen && staff.id) {
      loadSessionStats();
    }
  }, [isOpen, staff.id]);

  const loadSessionStats = async () => {
    try {
      // Check for active and completed sessions
      const response = await api.get(`/users/performance/${staff.id}/history`, {
        params: { position: 'all', page: 1, limit: 1 }
      });
      
      const data = response.data.data;
      setSessionStats({
        active: data.activeSessions || 0,
        completed: data.total || 0,
      });
    } catch (error) {
      console.error('Error loading session stats:', error);
      setSessionStats({ active: 0, completed: 0 });
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error deleting staff:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-lg w-full border-2 border-red-500/30 dark:border-red-500/40 overflow-hidden">
        
        {/* Header - Red Warning */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AlertTriangle size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Konfirmasi Hapus Staff</h2>
              <p className="text-red-100 text-sm">Tindakan ini tidak dapat dibatalkan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-white/80 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          
          {/* Staff Info */}
          <div className="bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Users size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-red-600 dark:text-red-400 font-semibold mb-1">
                  Staff yang akan dihapus:
                </p>
                <p className="text-base font-bold text-neutral-900 dark:text-white">
                  {staff.fullName}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {staff.email}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                  Role: <span className="font-semibold">{staff.role}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Session Statistics Warning */}
          {sessionStats && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Activity size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                    Data Riwayat Terapi:
                  </p>
                  <div className="space-y-1.5">
                    {sessionStats.active > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-amber-700 dark:text-amber-400">Sesi Aktif:</span>
                        <span className="font-bold text-red-600 dark:text-red-400">{sessionStats.active} sesi</span>
                      </div>
                    )}
                    {sessionStats.completed > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-amber-700 dark:text-amber-400">Sesi Selesai:</span>
                        <span className="font-bold text-amber-900 dark:text-amber-300">{sessionStats.completed} sesi</span>
                      </div>
                    )}
                  </div>
                  {sessionStats.completed > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 leading-relaxed">
                      Data riwayat terapi akan tetap tersimpan untuk keperluan audit dan laporan.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning Message */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              ⚠️ Yang akan terjadi:
            </p>
            <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">•</span>
                <span>Staff akan <strong className="text-red-600 dark:text-red-400">dinonaktifkan</strong> dan tidak dapat login</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>Data historis terapi tetap tersimpan</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 font-bold">•</span>
                <span>Staff dapat diaktifkan kembali jika diperlukan</span>
              </li>
            </ul>
          </div>

          {/* Critical Warning */}
          <div className="bg-red-500/10 border-2 border-red-500/30 rounded-xl p-4">
            <p className="text-sm text-red-700 dark:text-red-400 font-semibold text-center">
              🔒 Pastikan Anda benar-benar ingin menghapus staff ini!
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-neutral-50 dark:bg-neutral-800/50 px-6 py-4 flex gap-3 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-5 py-3 bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 font-semibold rounded-lg border-2 border-neutral-300 dark:border-neutral-600 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (sessionStats?.active || 0) > 0}
            className="flex-1 px-5 py-3 bg-red-500 hover:bg-red-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-bold rounded-lg transition-colors disabled:cursor-not-allowed shadow-lg shadow-red-500/20 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 size={18} />
                <span>Ya, Hapus Staff</span>
              </>
            )}
          </button>
        </div>

        {/* Block deletion if active sessions */}
        {sessionStats && sessionStats.active > 0 && (
          <div className="bg-red-50 dark:bg-red-500/10 px-6 py-3 border-t-2 border-red-200 dark:border-red-500/30">
            <p className="text-xs text-red-700 dark:text-red-400 font-semibold text-center">
              ⛔ Tidak dapat menghapus staff dengan sesi terapi aktif. Selesaikan sesi terlebih dahulu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
