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
        {basicPricings.map((pricing) => (
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
                  type="number"
                  value={getBasicSelection(pricing.id)?.quantity || 1}
                  onChange={(e) => updateBasicQty(pricing.id, parseInt(e.target.value) || 1)}
                  className="form-input"
                  min="1"
                  style={{ width: '120px' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Total: {pricing.totalSessions * (getBasicSelection(pricing.id)?.quantity || 1)} sesi
                  = {formatCurrency(pricing.price * (getBasicSelection(pricing.id)?.quantity || 1))}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
