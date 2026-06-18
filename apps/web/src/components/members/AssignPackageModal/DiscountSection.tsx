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
            <input
              type="number"
              value={discountPercent}
              onChange={(e) => onDiscountPercentChange(Math.min(Math.max(parseInt(e.target.value) || 0, 0), 100))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-neutral-800/50 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              min="0"
              max="100"
              placeholder="0-100"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">Diskon (Rp)</label>
            <input
              type="text"
              value={formatNumberInput(discountAmount)}
              onChange={(e) => {
                const numValue = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                onDiscountAmountChange(Math.max(numValue, 0));
              }}
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
