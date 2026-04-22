import { formatCurrency } from '@/lib/formatNumber';
import styles from '../AssignPackageModal.module.css';

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
  return (
    <div className={styles.previewSection}>
      <h4 className={styles.previewTitle}>📊 PREVIEW</h4>
      <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
        {items.length === 0 ? (
          <p className={styles.previewEmpty}>Pilih minimal 1 paket atau add-on</p>
        ) : (
          <>
            {items.map((item, index) => (
              <div key={index} className={styles.previewItem}>
                <div className={styles.previewItemHeader}>
                  <span>{item.type === 'BASIC' ? '📦' : item.type === 'BOOSTER' ? '🚀' : '✨'} {item.name}</span>
                  <span>{formatCurrency(item.price)}</span>
                </div>
                <div className={styles.previewItemDetails}>
                  {item.sessions ? `${item.sessions} sesi` : ''}
                  {item.sessions && item.details ? ' • ' : ''}
                  {item.details || ''}
                </div>
              </div>
            ))}
            {discount > 0 && (
              <div className={styles.previewDiscount}>
                <span>
                  Diskon
                  {discountPercent > 0 && ` ${discountPercent}%`}
                  {discountPercent > 0 && discountAmount > 0 && ' +'}
                  {discountAmount > 0 && ` ${formatCurrency(discountAmount)}`}
                </span>
                <span>- {formatCurrency(Math.round(discount))}</span>
              </div>
            )}
            <div className={styles.previewTotal}>
              <span>TOTAL</span>
              <span>{formatCurrency(Math.round(total))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
