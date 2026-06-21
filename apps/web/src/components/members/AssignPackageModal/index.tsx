'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, RefreshCw, CheckCircle2 } from 'lucide-react';
import { PackagePricing, ExtendedBoosterType, ServiceType, AddOnType } from '@/types/package';
import { usePackageSelection } from './usePackageSelection';
import BasicPackageSection from './BasicPackageSection';
import BoosterPackageSection from './BoosterPackageSection';
import AddOnSection from './AddOnSection';
import DiscountSection from './DiscountSection';
import PreviewSection from './PreviewSection';

interface PackageSelection {
  pricingId: string;
  quantity: number;
  boosterType?: ExtendedBoosterType;
  serviceType?: ServiceType;
}

interface AddOnSelection {
  type: AddOnType;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

interface AssignData {
  selectedPackages: PackageSelection[];
  selectedAddOns: AddOnSelection[];
  discountPercent: number;
  discountAmount: number;
  discountNote: string;
  notes: string;
  paymentPlan: {
    type: 'FULL_PAYMENT' | 'INSTALLMENT';
    installmentCount: number;
    installments: Array<{
      installmentNumber: number;
      amount: number;
      dueDate?: string;
    }>;
  };
}

interface AssignPackageModalProps {
  show: boolean;
  pricings: PackagePricing[];
  assignData: AssignData;
  submitting: boolean;
  onClose: () => void;
  onAssignDataChange: (data: AssignData) => void;
  onSubmit: () => void;
}

export default function AssignPackageModal({
  show,
  pricings,
  assignData,
  submitting,
  onClose,
  onAssignDataChange,
  onSubmit
}: AssignPackageModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [show]);

  if (!show || !mounted) return null;

  const pricingsList = Array.isArray(pricings) ? pricings : [];

  const {
    isBasicSelected,
    getBasicSelection,
    toggleBasic,
    updateBasicQty,
    isBoosterSelected,
    getBoosterSelection,
    toggleBooster,
    updateBoosterQty,
    updateBoosterServiceType,
    isAddOnSelected,
    getAddOnQuantity,
    toggleAddOn,
    updateAddOnQuantity,
    calculatePreview,
  } = usePackageSelection(assignData, onAssignDataChange, pricingsList);

  const preview = calculatePreview();
  const paymentPlan = assignData.paymentPlan || {
    type: 'FULL_PAYMENT' as const,
    installmentCount: 2,
    installments: [],
  };

  const buildInstallments = (count: number, total: number) => {
    if (count <= 0) return [];

    const baseAmount = Math.floor(total / count);
    let remaining = total;

    return Array.from({ length: count }, (_, index) => {
      const isLast = index === count - 1;
      const amount = isLast ? remaining : baseAmount;
      remaining -= amount;

      return {
        installmentNumber: index + 1,
        amount,
      };
    });
  };

  const updatePaymentPlanType = (type: 'FULL_PAYMENT' | 'INSTALLMENT') => {
    const installmentCount = paymentPlan.installmentCount || 2;
    onAssignDataChange({
      ...assignData,
      paymentPlan: {
        type,
        installmentCount,
        installments: type === 'INSTALLMENT'
          ? buildInstallments(installmentCount, preview.total)
          : [],
      },
    });
  };

  const updateInstallmentCount = (count: number) => {
    const safeCount = Math.max(2, Math.min(24, count || 2));
    onAssignDataChange({
      ...assignData,
      paymentPlan: {
        type: 'INSTALLMENT',
        installmentCount: safeCount,
        installments: buildInstallments(safeCount, preview.total),
      },
    });
  };

  const updateInstallmentAmount = (installmentNumber: number, amount: number) => {
    const installments = paymentPlan.installments.length > 0
      ? paymentPlan.installments
      : buildInstallments(paymentPlan.installmentCount || 2, preview.total);

    onAssignDataChange({
      ...assignData,
      paymentPlan: {
        type: 'INSTALLMENT',
        installmentCount: paymentPlan.installmentCount || 2,
        installments: installments.map((installment) => (
          installment.installmentNumber === installmentNumber
            ? { ...installment, amount: Math.max(0, Math.round(amount || 0)) }
            : installment
        )),
      },
    });
  };

  const activeInstallments = paymentPlan.type === 'INSTALLMENT'
    ? (paymentPlan.installments.length > 0
      ? paymentPlan.installments
      : buildInstallments(paymentPlan.installmentCount || 2, preview.total))
    : [];
  const installmentTotal = activeInstallments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const installmentDiff = installmentTotal - preview.total;

  const modalContent = (
    <div className="assign-package-modal-root fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="assign-package-modal-viewport flex min-h-full items-start justify-center p-4 pt-8 pb-8 overflow-y-auto">
        <div
          className="assign-package-modal-panel relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all flex flex-col my-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="assign-package-modal-header flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0 sticky top-0 bg-white dark:bg-neutral-900 rounded-t-2xl z-10">
            <div className="assign-package-modal-title-row flex items-center gap-4">
              <div className="assign-package-modal-icon flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="assign-package-modal-title-copy">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Assign Paket Terapi
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Pilih paket untuk member
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="assign-package-modal-close rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="assign-package-modal-body flex-1 overflow-y-auto p-6 space-y-5 max-h-[calc(100vh-220px)]">
            {/* PAKET BASIC */}
            <BasicPackageSection
              pricingsList={pricingsList}
              isBasicSelected={isBasicSelected}
              getBasicSelection={getBasicSelection}
              toggleBasic={toggleBasic}
              updateBasicQty={updateBasicQty}
            />

            {/* PAKET BOOSTER */}
            <BoosterPackageSection
              pricingsList={pricingsList}
              isBoosterSelected={isBoosterSelected}
              getBoosterSelection={getBoosterSelection}
              toggleBooster={toggleBooster}
              updateBoosterQty={updateBoosterQty}
              updateBoosterServiceType={updateBoosterServiceType}
            />

            {/* ADD-ONS */}
            <AddOnSection
              isAddOnSelected={isAddOnSelected}
              getAddOnQuantity={getAddOnQuantity}
              toggleAddOn={toggleAddOn}
              updateAddOnQuantity={updateAddOnQuantity}
            />

            {/* DISKON */}
            <DiscountSection
              discountPercent={assignData.discountPercent}
              discountAmount={assignData.discountAmount}
              discountNote={assignData.discountNote}
              notes={assignData.notes}
              onDiscountPercentChange={(value) => onAssignDataChange({ ...assignData, discountPercent: value })}
              onDiscountAmountChange={(value) => onAssignDataChange({ ...assignData, discountAmount: value })}
              onDiscountNoteChange={(value) => onAssignDataChange({ ...assignData, discountNote: value })}
              onNotesChange={(value) => onAssignDataChange({ ...assignData, notes: value })}
            />

            {/* PREVIEW */}
            <PreviewSection
              items={preview.items}
              subtotal={preview.subtotal}
              discount={preview.discount}
              total={preview.total}
              discountPercent={assignData.discountPercent}
              discountAmount={assignData.discountAmount}
            />

            {/* PAYMENT PLAN */}
            <div className="assign-package-payment-plan p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Metode Pembayaran
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Pilih lunas atau termin. Untuk termin, member bisa mulai treatment setelah termin pertama valid.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updatePaymentPlanType('FULL_PAYMENT')}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    paymentPlan.type === 'FULL_PAYMENT'
                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  <div className="text-sm font-bold">Lunas</div>
                  <div className="text-xs opacity-75">1 invoice full amount</div>
                </button>
                <button
                  type="button"
                  onClick={() => updatePaymentPlanType('INSTALLMENT')}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    paymentPlan.type === 'INSTALLMENT'
                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                  }`}
                >
                  <div className="text-sm font-bold">Termin / Cicilan</div>
                  <div className="text-xs opacity-75">Invoice per termin</div>
                </button>
              </div>

              {paymentPlan.type === 'INSTALLMENT' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                      Jumlah Termin
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={24}
                      value={paymentPlan.installmentCount || 2}
                      onChange={(e) => updateInstallmentCount(Number(e.target.value))}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    {activeInstallments.map((installment) => (
                      <div
                        key={installment.installmentNumber}
                        className="grid grid-cols-[96px_1fr] items-center gap-3"
                      >
                        <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                          Termin {installment.installmentNumber}
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={installment.amount}
                          onChange={(e) => updateInstallmentAmount(installment.installmentNumber, Number(e.target.value))}
                          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                      </div>
                    ))}
                  </div>

                  <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    installmentDiff === 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                  }`}>
                    Total termin: Rp {installmentTotal.toLocaleString('id-ID')} dari Rp {preview.total.toLocaleString('id-ID')}
                    {installmentDiff !== 0 && (
                      <span> ({installmentDiff > 0 ? 'lebih' : 'kurang'} Rp {Math.abs(installmentDiff).toLocaleString('id-ID')})</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="assign-package-modal-footer flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/50 flex-shrink-0 rounded-b-2xl">
            <button
              onClick={onClose}
              className="assign-package-modal-action px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex-1"
            >
              Batal
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting || preview.items.length === 0 || (paymentPlan.type === 'INSTALLMENT' && installmentDiff !== 0)}
              className="assign-package-modal-action px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 flex items-center gap-2 flex-1 justify-center"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Assign Paket
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
