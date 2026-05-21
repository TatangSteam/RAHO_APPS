import { useState, useEffect } from 'react';
import { Rocket } from 'lucide-react';
import { PackagePricing, ExtendedBoosterType, ServiceType } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';

interface BoosterPackageSectionProps {
  pricingsList: PackagePricing[];
  isBoosterSelected: (pricingId: string, boosterType: ExtendedBoosterType) => boolean;
  getBoosterSelection: (pricingId: string, boosterType: ExtendedBoosterType) => any;
  toggleBooster: (pricingId: string, boosterType: ExtendedBoosterType) => void;
  updateBoosterQty: (pricingId: string, boosterType: ExtendedBoosterType, quantity: number) => void;
  updateBoosterServiceType: (pricingId: string, boosterType: ExtendedBoosterType, serviceType: ServiceType) => void;
}

const SERVICE_TYPE_NAMES: Record<string, string> = {
  PM: 'Premier',
  PS: 'Partnership',
  PTY: 'Partnership Attiya',
  PDA: 'Partnership Dr. Abhi',
  PHC: 'Partnership Homecare',
};

function BoosterQuantityInput({
  pricingId,
  boosterType,
  quantity,
  updateBoosterQty,
}: {
  pricingId: string;
  boosterType: ExtendedBoosterType;
  quantity: number;
  updateBoosterQty: (pricingId: string, boosterType: ExtendedBoosterType, quantity: number) => void;
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
            updateBoosterQty(pricingId, boosterType, parseInt(value));
          }
        }
      }}
      onBlur={() => {
        if (inputValue === '' || parseInt(inputValue) < 1) {
          setInputValue('1');
          updateBoosterQty(pricingId, boosterType, 1);
        }
      }}
      onFocus={(e) => e.target.select()}
      className="w-full px-3 py-2 text-xs rounded-lg border border-purple-300 dark:border-purple-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
      placeholder="1"
    />
  );
}

export default function BoosterPackageSection({
  pricingsList,
  isBoosterSelected,
  getBoosterSelection,
  toggleBooster,
  updateBoosterQty,
  updateBoosterServiceType,
}: BoosterPackageSectionProps) {
  const boosterPricings = pricingsList.filter(p => p.packageType === 'BOOSTER' && p.isActive);

  const boosterMap = new Map<string, PackagePricing[]>();
  boosterPricings.forEach(pricing => {
    if (!pricing.boosterType) return;
    const list = boosterMap.get(pricing.boosterType) || [];
    list.push(pricing);
    boosterMap.set(pricing.boosterType, list);
  });

  const uniqueBoosters = Array.from(boosterMap.entries()).map(([boosterType, pricings]) => ({
    boosterType,
    label: boosterType,
    pricings,
  }));

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
        <Rocket className="h-4 w-4" />
        PAKET BOOSTER
      </h4>
      <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
        {uniqueBoosters.length === 0 && (
          <p className="text-sm text-neutral-600 dark:text-neutral-500">Tidak ada paket booster tersedia.</p>
        )}

        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
          Pilih tipe booster yang diinginkan. Harga akan disesuaikan dengan tipe layanan yang dipilih.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {uniqueBoosters.map(({ boosterType, label, pricings: typePricings }) => {
            const anchor = typePricings[0];
            if (!anchor) return null;

            const selected = isBoosterSelected(anchor.id, boosterType as ExtendedBoosterType);
            const sel = getBoosterSelection(anchor.id, boosterType as ExtendedBoosterType);
            const selectedServiceType = (sel?.serviceType || typePricings[0].serviceType || 'PM') as string;
            const selectedPricing = typePricings.find(p => p.serviceType === selectedServiceType) || typePricings[0];
            const pricePerSession = selectedPricing.price;

            return (
              <div
                key={boosterType}
                className={`p-3 rounded-xl border-2 transition-all ${
                  selected 
                    ? 'border-purple-400 dark:border-purple-500 bg-purple-100 dark:bg-purple-500/15' 
                    : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/30 hover:border-purple-300 dark:hover:border-purple-500/50'
                }`}
              >
                <label className={`flex items-center gap-2 cursor-pointer ${selected ? 'mb-3' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleBooster(anchor.id, boosterType as ExtendedBoosterType)}
                    className="w-4 h-4 rounded border-purple-400 dark:border-purple-500/50 text-purple-600 focus:ring-purple-500 bg-white dark:bg-neutral-800"
                  />
                  <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">{label}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-500">({typePricings.length} layanan)</span>
                </label>

                {selected && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">Tipe Layanan</label>
                      <select
                        value={selectedServiceType}
                        onChange={(e) => updateBoosterServiceType(anchor.id, boosterType as ExtendedBoosterType, e.target.value as ServiceType)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-purple-300 dark:border-purple-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {typePricings.map(p => {
                          const stCode = p.serviceType || '';
                          const stName = SERVICE_TYPE_NAMES[stCode] || stCode;
                          return (
                            <option key={p.id} value={stCode}>
                              {stName} — {formatCurrency(p.price)}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">Jumlah</label>
                      <BoosterQuantityInput
                        pricingId={anchor.id}
                        boosterType={boosterType as ExtendedBoosterType}
                        quantity={sel?.quantity || 1}
                        updateBoosterQty={updateBoosterQty}
                      />
                    </div>

                    <div className="text-xs text-neutral-600 dark:text-neutral-400 border-t border-purple-200 dark:border-purple-500/20 pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Harga per sesi:</span>
                        <span>{formatCurrency(pricePerSession)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total sesi:</span>
                        <span>{selectedPricing.totalSessions * (sel?.quantity || 1)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-purple-600 dark:text-purple-400 text-sm pt-1">
                        <span>Total Harga:</span>
                        <span>{formatCurrency(pricePerSession * selectedPricing.totalSessions * (sel?.quantity || 1))}</span>
                      </div>
                    </div>
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
