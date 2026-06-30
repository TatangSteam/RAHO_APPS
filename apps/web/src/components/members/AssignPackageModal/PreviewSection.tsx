import { BarChart3, Package, Rocket, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/formatNumber';

interface PreviewItem {
  name: string;
  sessions?: number;
  price: number;
  type: string;
  details?: string;
}

interface PreviewSectionProps {
  items: PreviewItem[];
  subtotal: number;
  discount: number;
  total: number;
  discountPercent: number;
  discountAmount: number;
}

export default function PreviewSection({
  items,
  subtotal,
  discount,
  total,
  discountPercent,
  discountAmount,
}: PreviewSectionProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'BASIC':
        return <Package className="h-3.5 w-3.5 text-blue-400" />;
      case 'BOOSTER':
        return <Rocket className="h-3.5 w-3.5 text-purple-400" />;
      default:
        return <Sparkles className="h-3.5 w-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="assign-package-preview p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 border-2 border-neutral-300 dark:border-neutral-600/50">
      <h4 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        PREVIEW
      </h4>
      
      <div className="text-sm space-y-2">
        {items.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-500 text-center py-4">
            Pilih minimal 1 paket
          </p>
        ) : (
          <>
            {items.map((item, index) => (
              <div key={index} className="space-y-0.5">
                <div className="assign-package-preview-row flex items-center justify-between">
                  <span className="assign-package-preview-name flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
                    {getIcon(item.type)}
                    {item.name}
                  </span>
                  <span className="assign-package-preview-price font-semibold text-neutral-800 dark:text-neutral-200">{formatCurrency(item.price)}</span>
                </div>
                {(item.sessions || item.details) && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-500 pl-6">
                    {item.sessions ? `${item.sessions} sesi` : ''}
                    {item.sessions && item.details ? ' • ' : ''}
                    {item.details || ''}
                  </div>
                )}
              </div>
            ))}
            
            {discount > 0 && (
              <div className="assign-package-preview-row flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold pt-2">
                <span>
                  Diskon
                  {discountPercent > 0 && ` ${discountPercent}%`}
                  {discountPercent > 0 && discountAmount > 0 && ' +'}
                  {discountAmount > 0 && ` ${formatCurrency(discountAmount)}`}
                </span>
                <span>- {formatCurrency(Math.round(discount))}</span>
              </div>
            )}
            
            <div className="assign-package-preview-row flex justify-between text-base font-bold text-amber-600 dark:text-amber-400 pt-3 mt-2 border-t-2 border-neutral-300 dark:border-neutral-600/50">
              <span>TOTAL</span>
              <span>{formatCurrency(Math.round(total))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
