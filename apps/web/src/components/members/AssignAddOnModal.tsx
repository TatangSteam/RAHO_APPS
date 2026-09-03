'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, RefreshCw, ShoppingBag, X } from 'lucide-react';
import type { AddOnPricing, AddOnType } from '@/types/package';
import type { StaffMember } from '@/lib/usersApi';
import { formatCurrency } from '@/lib/formatNumber';
import AddOnSection from './AssignPackageModal/AddOnSection';

export interface AddOnTransactionSelection {
  type: AddOnType;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

export interface AddOnTransactionData {
  selectedAddOns: AddOnTransactionSelection[];
  transactionDate: string;
  sellerMsoId: string;
  notes: string;
}

interface Props {
  show: boolean;
  branchName?: string;
  msoStaff: StaffMember[];
  loadingMsoStaff: boolean;
  data: AddOnTransactionData;
  submitting: boolean;
  onChange: (data: AddOnTransactionData) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function AssignAddOnModal({
  show,
  branchName,
  msoStaff,
  loadingMsoStaff,
  data,
  submitting,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [show]);

  if (!show || !mounted) return null;

  const isSelected = (code: string) => data.selectedAddOns.some(item => item.code === code);
  const getQuantity = (code: string) => data.selectedAddOns.find(item => item.code === code)?.quantity || 1;
  const toggle = (product: AddOnPricing) => {
    onChange({
      ...data,
      selectedAddOns: isSelected(product.code)
        ? data.selectedAddOns.filter(item => item.code !== product.code)
        : [...data.selectedAddOns, { ...product, quantity: 1 }],
    });
  };
  const updateQuantity = (code: string, quantity: number) => {
    onChange({
      ...data,
      selectedAddOns: data.selectedAddOns.map(item =>
        item.code === code ? { ...item, quantity: Math.max(1, quantity) } : item
      ),
    });
  };
  const total = data.selectedAddOns.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center py-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-addon-title"
          className="w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-700 bg-white shadow-2xl dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-black">
                <ShoppingBag size={22} />
              </div>
              <div>
                <h2 id="assign-addon-title" className="text-xl font-bold text-neutral-950 dark:text-white">
                  Tambah Air Nano & Add-On
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Cabang transaksi: {branchName || 'cabang member'}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup transaksi add-on" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="add-on-transaction-date" className="mb-2 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  Tanggal transaksi <span className="text-red-500">*</span>
                </label>
                <input
                  id="add-on-transaction-date"
                  type="date"
                  value={data.transactionDate}
                  onChange={event => onChange({ ...data, transactionDate: event.target.value })}
                  className="min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="add-on-seller-mso" className="mb-2 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                  MSO yang menjual <span className="text-red-500">*</span>
                </label>
                <select
                  id="add-on-seller-mso"
                  value={data.sellerMsoId}
                  onChange={event => onChange({ ...data, sellerMsoId: event.target.value })}
                  disabled={loadingMsoStaff}
                  className="min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-500 disabled:cursor-wait disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                >
                  <option value="">
                    {loadingMsoStaff ? 'Memuat daftar MSO...' : 'Pilih MSO penjual'}
                  </option>
                  {msoStaff.map(staff => (
                    <option key={staff.userId} value={staff.userId}>
                      {staff.fullName}{staff.staffCode ? ` (${staff.staffCode})` : ''}
                    </option>
                  ))}
                </select>
                {!loadingMsoStaff && msoStaff.length === 0 && (
                  <p className="mt-1.5 text-xs text-red-500">Tidak ada MSO aktif pada cabang ini.</p>
                )}
              </div>
            </div>

            <AddOnSection
              isAddOnSelected={isSelected}
              getAddOnQuantity={getQuantity}
              toggleAddOn={toggle}
              updateAddOnQuantity={updateQuantity}
              title="AIR NANO & ADD-ON"
              description="Pilih produk yang dibeli member. Transaksi ini terpisah dari paket terapi."
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Catatan transaksi
              </label>
              <textarea
                value={data.notes}
                onChange={event => onChange({ ...data, notes: event.target.value })}
                rows={3}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                placeholder="Opsional"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Total transaksi</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="flex gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-5 dark:border-neutral-700 dark:bg-neutral-800/50">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 font-semibold text-neutral-700 dark:border-neutral-600 dark:text-neutral-200">
              Batal
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={
                submitting ||
                data.selectedAddOns.length === 0 ||
                !data.transactionDate ||
                !data.sellerMsoId
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Menyimpan...' : 'Buat Transaksi'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
