import { useState, useEffect } from 'react';
import { Sparkles, Droplets, Cigarette } from 'lucide-react';
import { AddOnPricing, AIR_NANO_PRICING, ROKOK_KENKOU_PRICING } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';

interface AddOnSectionProps {
  isAddOnSelected: (code: string) => boolean;
  getAddOnQuantity: (code: string) => number;
  toggleAddOn: (addon: AddOnPricing) => void;
  updateAddOnQuantity: (code: string, quantity: number) => void;
}

function AddOnQuantityInput({
  code,
  quantity,
  updateAddOnQuantity,
}: {
  code: string;
  quantity: number;
  updateAddOnQuantity: (code: string, quantity: number) => void;
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
            updateAddOnQuantity(code, parseInt(value));
          }
        }
      }}
      onBlur={() => {
        if (inputValue === '' || parseInt(inputValue) < 1) {
          setInputValue('1');
          updateAddOnQuantity(code, 1);
        }
      }}
      onFocus={(e) => e.target.select()}
      className="w-24 px-3 py-2 text-xs rounded-lg border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
      placeholder="1"
    />
  );
}

export default function AddOnSection({
  isAddOnSelected,
  getAddOnQuantity,
  toggleAddOn,
  updateAddOnQuantity,
}: AddOnSectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        ADD-ONS (Opsional)
      </h4>
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
          Tambahkan produk non-terapi seperti Air Nano atau Rokok Kenkou
        </p>

        {/* Air Nano Section */}
        <div className="mb-4">
          <h5 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
            Air Nano
          </h5>
          <div className="space-y-2">
            {AIR_NANO_PRICING.map((addon) => {
              const isSelected = isAddOnSelected(addon.code);
              return (
                <div key={addon.code}>
                  <label 
                    className={`flex items-center p-2.5 rounded-lg cursor-pointer transition-all border ${
                      isSelected 
                        ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50' 
                        : 'border-transparent hover:bg-amber-100/50 dark:hover:bg-amber-500/10'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={() => toggleAddOn(addon)} 
                      className="w-4 h-4 mr-2.5 rounded border-amber-400 dark:border-amber-500/50 text-amber-600 focus:ring-amber-500 bg-white dark:bg-neutral-800"
                    />
                    <span className="flex-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{addon.name}</span>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(addon.price)}</span>
                  </label>
                  {isSelected && (
                    <div className="ml-9 mt-2 p-2.5 rounded-lg bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                      <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">Jumlah</label>
                      <AddOnQuantityInput
                        code={addon.code}
                        quantity={getAddOnQuantity(addon.code)}
                        updateAddOnQuantity={updateAddOnQuantity}
                      />
                      <p className="text-xs text-neutral-600 dark:text-neutral-500 mt-1.5">
                        Total: {formatCurrency(addon.price * getAddOnQuantity(addon.code))}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rokok Kenkou Section */}
        <div>
          <h5 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1.5">
            <Cigarette className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
            Rokok Kenkou
          </h5>
          <div>
            <label 
              className={`flex items-center p-2.5 rounded-lg cursor-pointer transition-all border ${
                isAddOnSelected(ROKOK_KENKOU_PRICING.code) 
                  ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50' 
                  : 'border-transparent hover:bg-amber-100/50 dark:hover:bg-amber-500/10'
              }`}
            >
              <input 
                type="checkbox" 
                checked={isAddOnSelected(ROKOK_KENKOU_PRICING.code)} 
                onChange={() => toggleAddOn(ROKOK_KENKOU_PRICING)} 
                className="w-4 h-4 mr-2.5 rounded border-amber-400 dark:border-amber-500/50 text-amber-600 focus:ring-amber-500 bg-white dark:bg-neutral-800"
              />
              <span className="flex-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{ROKOK_KENKOU_PRICING.name}</span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(ROKOK_KENKOU_PRICING.price)}</span>
            </label>
            {isAddOnSelected(ROKOK_KENKOU_PRICING.code) && (
              <div className="ml-9 mt-2 p-2.5 rounded-lg bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">Jumlah Bungkus</label>
                <AddOnQuantityInput
                  code={ROKOK_KENKOU_PRICING.code}
                  quantity={getAddOnQuantity(ROKOK_KENKOU_PRICING.code)}
                  updateAddOnQuantity={updateAddOnQuantity}
                />
                <p className="text-xs text-neutral-600 dark:text-neutral-500 mt-1.5">
                  Total: {formatCurrency(ROKOK_KENKOU_PRICING.price * getAddOnQuantity(ROKOK_KENKOU_PRICING.code))}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
