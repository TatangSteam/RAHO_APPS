'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Search, RotateCcw, Check } from 'lucide-react';
import type { ColumnConfig } from '@/hooks/useMemberColumns';

interface ColumnConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  onToggleColumn: (columnId: string) => void;
  onReset: () => void;
}

export function ColumnConfigModal({
  isOpen,
  onClose,
  columns,
  onToggleColumn,
  onReset,
}: ColumnConfigModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const filteredColumns = columns.filter(col =>
    col.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const visibleCount = columns.filter(col => col.visible).length;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[99999] p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600"></div>

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-transparent dark:from-gray-800/50 dark:via-gray-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Konfigurasi Kolom Export
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Pilih kolom yang ingin ditampilkan di tabel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-8 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kolom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* Stats Banner */}
        <div className="px-8 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border-b border-blue-200 dark:border-blue-500/20">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-bold text-blue-600 dark:text-blue-400">{visibleCount}</span>
            {' '}dari{' '}
            <span className="font-bold text-blue-600 dark:text-blue-400">{columns.length}</span>
            {' '}kolom ditampilkan
          </p>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto px-8 py-5">
          {filteredColumns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Search className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Tidak ada kolom yang cocok</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredColumns.map((column) => (
                <label
                  key={column.id}
                  className={`
                    flex items-center p-4 rounded-xl border-2 transition-all duration-200 group
                    ${column.required 
                      ? 'cursor-not-allowed opacity-60 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30' 
                      : column.visible
                        ? 'cursor-pointer border-amber-300 dark:border-amber-500/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 hover:shadow-lg hover:border-amber-400 dark:hover:border-amber-500/70'
                        : 'cursor-pointer border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={column.visible}
                    onChange={() => onToggleColumn(column.id)}
                    disabled={column.required}
                    className={`
                      w-5 h-5 rounded border-2 transition-all duration-200
                      ${column.required 
                        ? 'cursor-not-allowed' 
                        : 'cursor-pointer accent-amber-500 hover:accent-amber-600'
                      }
                    `}
                  />
                  <div className="flex-1 ml-4">
                    <div className="font-semibold text-gray-900 dark:text-white mb-0.5">
                      {column.label}
                    </div>
                    {column.required && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Kolom wajib (tidak bisa disembunyikan)
                      </div>
                    )}
                  </div>
                  {column.visible && !column.required && (
                    <div className="ml-3 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-between px-8 py-6 border-t-2 border-gray-200 dark:border-gray-700 bg-gradient-to-t from-gray-50/50 to-transparent dark:from-gray-800/30">
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            Reset ke Default
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Check className="w-4 h-4" />
            Selesai
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
