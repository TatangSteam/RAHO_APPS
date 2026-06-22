'use client';

import { useState } from 'react';
import { Edit3, Package, Save, X } from 'lucide-react';
import type { UpdateStockRequestInput } from '@/lib/api/inventoryApi';
import type { StockRequest } from '../types';

interface EditRequestModalProps {
  request: StockRequest;
  onClose: () => void;
  onSubmit: (data: UpdateStockRequestInput) => Promise<void>;
  loading?: boolean;
}

export default function EditRequestModal({
  request,
  onClose,
  onSubmit,
  loading = false,
}: EditRequestModalProps) {
  const [notes, setNotes] = useState(request.notes || '');
  const [items, setItems] = useState(
    request.items.map((item) => ({
      masterProductId: item.masterProductId,
      productName: item.productName,
      requestedQty: Number(item.requestedQty || 0),
      unit: item.unit,
      notes: item.notes || '',
    }))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateQty = (masterProductId: string, value: string) => {
    const qty = Number(value);
    setItems((prev) =>
      prev.map((item) =>
        item.masterProductId === masterProductId
          ? { ...item, requestedQty: Number.isNaN(qty) ? 0 : qty }
          : item
      )
    );
  };

  const updateItemNotes = (masterProductId: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.masterProductId === masterProductId
          ? { ...item, notes: value }
          : item
      )
    );
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};

    items.forEach((item) => {
      if (!item.requestedQty || item.requestedQty <= 0) {
        nextErrors[item.masterProductId] = 'Jumlah harus lebih dari 0';
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      notes,
      items: items.map((item) => ({
        masterProductId: item.masterProductId,
        requestedQty: item.requestedQty,
        notes: item.notes.trim() || undefined,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5 dark:border-neutral-700">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <Edit3 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Edit Request Stok</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{request.requestCode}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Catatan Request
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={loading}
                rows={3}
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                placeholder="Catatan request stok"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                <Package className="h-4 w-4 text-amber-500" />
                Item Request
              </div>

              {items.map((item) => (
                <div
                  key={item.masterProductId}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/60"
                >
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-semibold text-neutral-900 dark:text-white">{item.productName}</h3>
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{item.unit}</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        Jumlah
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.requestedQty}
                        onChange={(event) => updateQty(item.masterProductId, event.target.value)}
                        disabled={loading}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      />
                      {errors[item.masterProductId] && (
                        <p className="mt-1 text-xs font-medium text-red-500">{errors[item.masterProductId]}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                        Catatan Item
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(event) => updateItemNotes(item.masterProductId, event.target.value)}
                        disabled={loading}
                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                        placeholder="Opsional"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4 dark:border-neutral-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
