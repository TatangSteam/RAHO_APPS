import { useEffect, useState } from 'react';
import { BadgePercent } from 'lucide-react';

interface DiscountSectionProps {
  discountPercent: number;
  discountAmount: number;
  discountNote: string;
  notes: string;
  onDiscountPercentChange: (value: number) => void;
  onDiscountAmountChange: (value: number) => void;
  onDiscountNoteChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}

const formatNumberInput = (value: number): string => {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

function NumericTextInput({
  value,
  onChange,
  min = 0,
  max,
  placeholder,
  className,
  format,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  format?: boolean;
}) {
  const [inputValue, setInputValue] = useState(format ? formatNumberInput(value) : String(value));

  useEffect(() => {
    setInputValue(format ? formatNumberInput(value) : String(value));
  }, [format, value]);

  const normalize = (rawValue: string) => (format ? rawValue.replace(/\D/g, '') : rawValue);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={inputValue}
      onChange={(e) => {
        const nextValue = e.target.value;
        const normalized = normalize(nextValue);

        if (nextValue === '' || normalized === '' || /^\d+$/.test(normalized)) {
          setInputValue(format && normalized !== '' ? formatNumberInput(Number(normalized)) : normalized);

          if (normalized !== '') {
            const boundedValue = Math.min(Math.max(Number(normalized), min), max ?? Number.MAX_SAFE_INTEGER);
            onChange(boundedValue);
          }
        }
      }}
      onBlur={() => {
        const normalized = normalize(inputValue);

        if (normalized === '') {
          setInputValue(format ? formatNumberInput(min) : String(min));
          onChange(min);
          return;
        }

        const boundedValue = Math.min(Math.max(Number(normalized), min), max ?? Number.MAX_SAFE_INTEGER);
        setInputValue(format ? formatNumberInput(boundedValue) : String(boundedValue));
        onChange(boundedValue);
      }}
      onFocus={(e) => e.target.select()}
      className={className}
      placeholder={placeholder}
    />
  );
}

export default function DiscountSection({
  discountPercent,
  discountAmount,
  discountNote,
  notes,
  onDiscountPercentChange,
  onDiscountAmountChange,
  onDiscountNoteChange,
  onNotesChange,
}: DiscountSectionProps) {
  return (
    <div className="assign-package-section space-y-3">
      <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
        <BadgePercent className="h-4 w-4" />
        DISKON
      </h4>
      <div className="assign-package-section-box p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
        <div className="assign-package-discount-grid grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">Diskon (%)</label>
            <NumericTextInput
              value={discountPercent}
              onChange={onDiscountPercentChange}
              min={0}
              max={100}
              className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0-100"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">Diskon (Rp)</label>
            <NumericTextInput
              value={discountAmount}
              onChange={onDiscountAmountChange}
              min={0}
              format
              className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nominal diskon"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">Catatan Diskon</label>
          <input
            type="text"
            value={discountNote}
            onChange={(e) => onDiscountNoteChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Contoh: Diskon loyalitas"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            placeholder="Catatan tambahan (opsional)"
          />
        </div>
      </div>
    </div>
  );
}
