'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare, Send } from 'lucide-react';
import { ShipmentIssueDecision } from '@/lib/api/inventoryApi';

interface NotesModalProps {
  decision: ShipmentIssueDecision;
  onClose: () => void;
  onSubmit: (notes: string) => Promise<void>;
  loading: boolean;
}

export default function NotesModal({ decision, onClose, onSubmit, loading }: NotesModalProps) {
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const getTitle = () => {
    switch (decision) {
      case 'SEND_SHORTAGE':
        return 'Catatan Kirim Kekurangan Barang';
      case 'CLOSE_CASE':
        return 'Catatan Penutupan Kasus';
      case 'COMPLETE_CASE':
        return 'Catatan Penyelesaian Kasus';
      default:
        return 'Catatan Review';
    }
  };

  const getDescription = () => {
    switch (decision) {
      case 'SEND_SHORTAGE':
        return 'Masukkan catatan untuk pengiriman barang yang kurang';
      case 'CLOSE_CASE':
        return 'Masukkan alasan penutupan kasus';
      case 'COMPLETE_CASE':
        return 'Masukkan catatan penyelesaian kasus';
      default:
        return 'Masukkan catatan review';
    }
  };

  const handleSubmit = async () => {
    if (!notes.trim()) return;
    await onSubmit(notes.trim());
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {getTitle()}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {getDescription()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 dark:hover:text-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Catatan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                placeholder="Masukkan catatan..."
                rows={6}
                className="w-full px-4 py-3 text-sm border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                autoFocus
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {notes.length} karakter
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 rounded-b-2xl">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !notes.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Kirim
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
