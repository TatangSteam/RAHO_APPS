'use client';

import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ShipmentIssueDecision } from '@/lib/api/inventoryApi';
import { ShipmentModal } from './ShipmentModal';

interface NotesModalProps {
  decision: ShipmentIssueDecision;
  onClose: () => void;
  onSubmit: (notes: string) => Promise<void>;
  loading: boolean;
}

export default function NotesModal({ decision, onClose, onSubmit, loading }: NotesModalProps) {
  const [notes, setNotes] = useState('');

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

  return (
    <ShipmentModal
      bodyClassName="px-6 py-6"
      closeDisabled={loading}
      icon={<MessageSquare className="h-6 w-6 text-white" />}
      iconClassName="from-amber-400 to-amber-600 shadow-amber-500/30"
      open
      size="lg"
      subtitle={getDescription()}
      title={getTitle()}
      footer={(
        <>
            <Button
              unstyled
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Batal
            </Button>
            <Button
              unstyled
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
            </Button>
        </>
      )}
      onClose={onClose}
    >
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
    </ShipmentModal>
  );
}
