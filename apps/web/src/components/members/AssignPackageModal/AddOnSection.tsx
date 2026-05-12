import { AddOnPricing, AIR_NANO_PRICING, ROKOK_KENKOU_PRICING } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';
import styles from '../AssignPackageModal.module.css';

interface AddOnSectionProps {
  isAddOnSelected: (code: string) => boolean;
  getAddOnQuantity: (code: string) => number;
  toggleAddOn: (addon: AddOnPricing) => void;
  updateAddOnQuantity: (code: string, quantity: number) => void;
}

export default function AddOnSection({
  isAddOnSelected,
  getAddOnQuantity,
  toggleAddOn,
  updateAddOnQuantity,
}: AddOnSectionProps) {
  return (
    <div className={styles.section}>
      <h4 className={`${styles.sectionTitle} ${styles.addonsTitle}`}>✨ ADD-ONS (Opsional)</h4>
      <div className={`${styles.sectionBox} ${styles.addonsSection}`}>
        <p className={styles.addonsDescription}>Tambahkan produk non-terapi seperti Air Nano atau Rokok Kenkou</p>

        <div style={{ marginBottom: '16px' }}>
          <h5 className={styles.addonsSubtitle}>💧 Air Nano</h5>
          <div style={{ display: 'grid', gap: '8px' }}>
            {AIR_NANO_PRICING.map((addon) => (
              <div key={addon.code} className={styles.addonItem}>
                <label className={`${styles.addonLabel} ${isAddOnSelected(addon.code) ? styles.addonLabelSelected : styles.addonLabelDefault}`}>
                  <input type="checkbox" checked={isAddOnSelected(addon.code)} onChange={() => toggleAddOn(addon)} className={styles.addonCheckbox} />
                  <span className={styles.addonName}>{addon.name}</span>
                  <span className={styles.addonPrice}>{formatCurrency(addon.price)}</span>
                </label>
                {isAddOnSelected(addon.code) && (
                  <div className={styles.addonDetails}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Jumlah</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={getAddOnQuantity(addon.code) || 1}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow only numbers and empty string
                        if (value === '' || /^\d+$/.test(value)) {
                          const numValue = value === '' ? 1 : parseInt(value);
                          if (numValue >= 1) {
                            updateAddOnQuantity(addon.code, numValue);
                          }
                        }
                      }}
                      onFocus={(e) => {
                        // Select all on focus for easy replacement
                        e.target.select();
                      }}
                      className={`form-input ${styles.addonQuantityInput}`}
                      placeholder="1"
                    />
                    <p className={styles.addonTotal}>Total: {formatCurrency(addon.price * getAddOnQuantity(addon.code))}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <h5 className={styles.addonsSubtitle}>🚬 Rokok Kenkou</h5>
          <div className={styles.addonItem}>
            <label className={`${styles.addonLabel} ${isAddOnSelected(ROKOK_KENKOU_PRICING.code) ? styles.addonLabelSelected : styles.addonLabelDefault}`}>
              <input type="checkbox" checked={isAddOnSelected(ROKOK_KENKOU_PRICING.code)} onChange={() => toggleAddOn(ROKOK_KENKOU_PRICING)} className={styles.addonCheckbox} />
              <span className={styles.addonName}>{ROKOK_KENKOU_PRICING.name}</span>
              <span className={styles.addonPrice}>{formatCurrency(ROKOK_KENKOU_PRICING.price)}</span>
            </label>
            {isAddOnSelected(ROKOK_KENKOU_PRICING.code) && (
              <div className={styles.addonDetails}>
                <label className="form-label" style={{ fontSize: '12px' }}>Jumlah Bungkus</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={getAddOnQuantity(ROKOK_KENKOU_PRICING.code) || 1}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers and empty string
                    if (value === '' || /^\d+$/.test(value)) {
                      const numValue = value === '' ? 1 : parseInt(value);
                      if (numValue >= 1) {
                        updateAddOnQuantity(ROKOK_KENKOU_PRICING.code, numValue);
                      }
                    }
                  }}
                  onFocus={(e) => {
                    // Select all on focus for easy replacement
                    e.target.select();
                  }}
                  className={`form-input ${styles.addonQuantityInput}`}
                  placeholder="1"
                />
                <p className={styles.addonTotal}>Total: {formatCurrency(ROKOK_KENKOU_PRICING.price * getAddOnQuantity(ROKOK_KENKOU_PRICING.code))}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
