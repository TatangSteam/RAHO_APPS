import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { PackagePricing } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';
import type { PackageSelection } from './usePackageSelection';

const SOCIAL_PROGRAM_PRODUCT_CODE = 'SRV-TNB-TRP-PS-001';

interface BasicPackageSectionProps {
  pricingsList: PackagePricing[];
  isBasicSelected: (pricingId: string) => boolean;
  getBasicSelection: (pricingId: string) => PackageSelection | undefined;
  toggleBasic: (pricingId: string) => void;
  updateBasicQty: (pricingId: string, quantity: number) => void;
}

// Separate component for quantity input to manage local state
function QuantityInput({
  pricingId,
  quantity,
  updateBasicQty,
}: {
  pricingId: string;
  quantity: number;
  updateBasicQty: (pricingId: string, quantity: number) => void;
}) {
  const [inputValue, setInputValue] = useState(String(quantity));

  useEffect(() => {
    setInputValue(String(quantity));
  }, [quantity]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={inputValue}
      onChange={(e) => {
        const value = e.target.value;
        if (value === '' || /^\d+$/.test(value)) {
          setInputValue(value);
          if (value !== '' && parseInt(value) >= 1) {
            updateBasicQty(pricingId, parseInt(value));
          }
        }
      }}
      onBlur={() => {
        if (inputValue === '' || parseInt(inputValue) < 1) {
          setInputValue('1');
          updateBasicQty(pricingId, 1);
        }
      }}
      onFocus={(e) => e.target.select()}
      className="assign-package-qty-input w-28 px-3 py-2 text-sm rounded-lg border border-blue-300 dark:border-blue-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="1"
    />
  );
}

export default function BasicPackageSection({
  pricingsList,
  isBasicSelected,
  getBasicSelection,
  toggleBasic,
  updateBasicQty,
}: BasicPackageSectionProps) {
  const basicPricings = pricingsList.filter(p =>
    p.packageType === 'BASIC' && p.isActive
  );

  return (
    <div className="assign-package-section space-y-3">
      <div className="assign-package-section-heading flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
          <Package className="h-4 w-4" />
          PAKET BASIC
        </h4>
        <span className="assign-package-section-count text-xs text-neutral-500 dark:text-neutral-400">
          {basicPricings.length} pilihan
        </span>
      </div>
      <div className="assign-package-section-box p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
        {basicPricings.length === 0 && (
          <p className="text-sm text-neutral-600 dark:text-neutral-500">Tidak ada paket BASIC aktif pada scope ini.</p>
        )}
        <div className="space-y-3">
          {basicPricings.map((pricing) => {
            const requiresSocialApproval = pricing.productCode === SOCIAL_PROGRAM_PRODUCT_CODE;
            const selection = getBasicSelection(pricing.id);
            const quantity = selection?.quantity || 1;
            const isSelected = !requiresSocialApproval && isBasicSelected(pricing.id);
            
            return (
              <div key={pricing.id} className="space-y-2">
                <label
                  title={requiresSocialApproval ? 'Paket Program Sosial diassign melalui Approval Inbox' : undefined}
                  className={`assign-package-option flex items-center p-3 rounded-lg transition-all ${
                    requiresSocialApproval
                      ? 'cursor-not-allowed opacity-70 border border-dashed border-blue-300 dark:border-blue-500/30'
                      : 'cursor-pointer'
                  } ${
                    isSelected 
                      ? 'bg-blue-100 dark:bg-blue-500/25 border border-blue-300 dark:border-blue-500/50' 
                      : requiresSocialApproval
                        ? ''
                        : 'hover:bg-blue-100/50 dark:hover:bg-blue-500/10 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={requiresSocialApproval}
                    onChange={() => toggleBasic(pricing.id)}
                    className="assign-package-option-checkbox w-4 h-4 rounded border-blue-400 dark:border-blue-500/50 text-blue-600 focus:ring-blue-500 bg-white dark:bg-neutral-800"
                  />
                  <span className="assign-package-option-copy">
                    <span className="assign-package-option-name font-medium text-sm text-neutral-800 dark:text-neutral-200">
                      {pricing.name}
                    </span>
                    <span className="assign-package-option-meta text-xs text-neutral-500 dark:text-neutral-400">
                      {pricing.totalSessions} sesi terapi
                      {requiresSocialApproval && ' • melalui Approval Inbox'}
                    </span>
                  </span>
                  <span className="assign-package-option-price font-bold text-sm text-blue-600 dark:text-blue-400">
                    {pricing.price === 0 ? 'Gratis' : formatCurrency(pricing.price)}
                  </span>
                </label>
                
                {isSelected && (
                  <div className="assign-package-option-details ml-10 p-3 rounded-lg bg-blue-100/50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                    <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-2">Jumlah Paket (Qty)</label>
                    <QuantityInput
                      pricingId={pricing.id}
                      quantity={quantity}
                      updateBasicQty={updateBasicQty}
                    />
                    <p className="text-xs text-neutral-600 dark:text-neutral-500 mt-2">
                      Total: {pricing.totalSessions * quantity} sesi = {formatCurrency(pricing.price * quantity)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
