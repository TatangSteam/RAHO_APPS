import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { PackagePricing } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';

interface BasicPackageSectionProps {
  pricingsList: PackagePricing[];
  isBasicSelected: (pricingId: string) => boolean;
  getBasicSelection: (pricingId: string) => any;
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
      className="w-28 px-3 py-2 text-sm rounded-lg border border-blue-300 dark:border-blue-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
  const basicPricings = pricingsList.filter(p => p.packageType === 'BASIC');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
        <Package className="h-4 w-4" />
        PAKET BASIC
      </h4>
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
        <div className="space-y-3">
          {basicPricings.map((pricing) => {
            const selection = getBasicSelection(pricing.id);
            const quantity = selection?.quantity || 1;
            const isSelected = isBasicSelected(pricing.id);
            
            return (
              <div key={pricing.id} className="space-y-2">
                <label 
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-blue-100 dark:bg-blue-500/25 border border-blue-300 dark:border-blue-500/50' 
                      : 'hover:bg-blue-100/50 dark:hover:bg-blue-500/10 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleBasic(pricing.id)}
                    className="w-4 h-4 mr-3 rounded border-blue-400 dark:border-blue-500/50 text-blue-600 focus:ring-blue-500 bg-white dark:bg-neutral-800"
                  />
                  <span className="flex-1 font-medium text-sm text-neutral-800 dark:text-neutral-200">
                    {pricing.name}
                  </span>
                  <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                    {formatCurrency(pricing.price)}
                  </span>
                </label>
                
                {isSelected && (
                  <div className="ml-10 p-3 rounded-lg bg-blue-100/50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
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
