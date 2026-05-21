import { useState, useEffect } from 'react';
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

  // Sync with external quantity changes
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
        // Allow empty string or numbers only
        if (value === '' || /^\d+$/.test(value)) {
          setInputValue(value);
          // Only update parent if valid number >= 1
          if (value !== '' && parseInt(value) >= 1) {
            updateBasicQty(pricingId, parseInt(value));
          }
        }
      }}
      onBlur={() => {
        // On blur, enforce minimum of 1
        if (inputValue === '' || parseInt(inputValue) < 1) {
          setInputValue('1');
          updateBasicQty(pricingId, 1);
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
                  <QuantityInput
                    pricingId={pricing.id}
                    quantity={quantity}
                    updateBasicQty={updateBasicQty}
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
