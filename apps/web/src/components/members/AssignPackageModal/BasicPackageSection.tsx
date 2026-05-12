import { PackagePricing } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';
import styles from '../AssignPackageModal.module.css';

interface BasicPackageSectionProps {
  pricingsList: PackagePricing[];
  isBasicSelected: (pricingId: string) => boolean;
  getBasicSelection: (pricingId: string) => any;
  toggleBasic: (pricingId: string) => void;
  updateBasicQty: (pricingId: string, quantity: number) => void;
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
    <div className={styles.section}>
      <h4 className={`${styles.sectionTitle} ${styles.basicTitle}`}>📦 PAKET BASIC</h4>
      <div className={`${styles.sectionBox} ${styles.basicSection}`}>
        {basicPricings.map((pricing) => {
          const selection = getBasicSelection(pricing.id);
          const quantity = selection?.quantity || 1;
          
          return (
            <div key={pricing.id} className={styles.packageItem}>
              <label className={`${styles.packageLabel} ${isBasicSelected(pricing.id) ? styles.packageLabelBasicSelected : styles.packageLabelBasic}`}>
                <input
                  type="checkbox"
                  checked={isBasicSelected(pricing.id)}
                  onChange={() => toggleBasic(pricing.id)}
                  className={styles.packageCheckbox}
                />
                <span className={styles.packageName}>{pricing.name}</span>
                <span className={`${styles.packagePrice} ${styles.packagePriceBasic}`}>
                  {formatCurrency(pricing.price)}
                </span>
              </label>
              {isBasicSelected(pricing.id) && (
                <div className={styles.packageDetails}>
                  <label className="form-label" style={{ fontSize: '13px' }}>Jumlah Paket (Qty)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow only numbers and empty string
                      if (value === '' || /^\d+$/.test(value)) {
                        const numValue = value === '' ? 1 : parseInt(value);
                        if (numValue >= 1) {
                          updateBasicQty(pricing.id, numValue);
                        }
                      }
                    }}
                    onFocus={(e) => {
                      // Select all on focus for easy replacement
                      e.target.select();
                    }}
                    className="form-input"
                    style={{ width: '120px' }}
                    placeholder="1"
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Total: {pricing.totalSessions * quantity} sesi
                    = {formatCurrency(pricing.price * quantity)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
