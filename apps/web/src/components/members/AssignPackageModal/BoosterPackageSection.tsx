import { useState, useEffect } from 'react';
import { PackagePricing, ExtendedBoosterType, ServiceType } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';
import styles from '../AssignPackageModal.module.css';

interface BoosterPackageSectionProps {
  pricingsList: PackagePricing[];
  isBoosterSelected: (pricingId: string, boosterType: ExtendedBoosterType) => boolean;
  getBoosterSelection: (pricingId: string, boosterType: ExtendedBoosterType) => any;
  toggleBooster: (pricingId: string, boosterType: ExtendedBoosterType) => void;
  updateBoosterQty: (pricingId: string, boosterType: ExtendedBoosterType, quantity: number) => void;
  updateBoosterServiceType: (pricingId: string, boosterType: ExtendedBoosterType, serviceType: ServiceType) => void;
}

// Built-in service type labels (fallback names if pricing.name doesn't include it)
const SERVICE_TYPE_NAMES: Record<string, string> = {
  PM: 'Premiere',
  PS: 'Partnership',
  PTY: 'Partnership Attiya',
  PDA: 'Partnership Dr. Abhi',
  PHC: 'Partnership Homecare',
};

// Separate component for quantity input to manage local state
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
            updateBoosterQty(pricingId, boosterType, parseInt(value));
          }
        }
      }}
      onBlur={() => {
        // On blur, enforce minimum of 1
        if (inputValue === '' || parseInt(inputValue) < 1) {
          setInputValue('1');
          updateBoosterQty(pricingId, boosterType, 1);
        }
      }}
      onFocus={(e) => e.target.select()}
      className="form-input"
      style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
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
  // All booster pricings from database
  const boosterPricings = pricingsList.filter(p => p.packageType === 'BOOSTER' && p.isActive);

  // Group pricings by booster type → list of available service types
  const boosterMap = new Map<string, PackagePricing[]>();
  boosterPricings.forEach(pricing => {
    if (!pricing.boosterType) return;
    const list = boosterMap.get(pricing.boosterType) || [];
    list.push(pricing);
    boosterMap.set(pricing.boosterType, list);
  });

  // Convert to array of { boosterType, name, pricings (one per service type) }
  const uniqueBoosters = Array.from(boosterMap.entries()).map(([boosterType, pricings]) => ({
    boosterType,
    // Use the first pricing's name (without the "- service" suffix) as label
    label: boosterType,
    pricings, // All pricings for this booster type (one per service type)
  }));

  return (
    <div className={styles.section}>
      <h4 className={`${styles.sectionTitle} ${styles.boosterTitle}`}>🚀 PAKET BOOSTER</h4>
      <div className={`${styles.sectionBox} ${styles.boosterSection}`}>
        {uniqueBoosters.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Tidak ada paket booster tersedia.</p>
        )}

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Pilih tipe booster yang diinginkan. Harga akan disesuaikan dengan tipe layanan yang dipilih.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {uniqueBoosters.map(({ boosterType, label, pricings: typePricings }) => {
            // Use the first pricing as "anchor" for the booster checkbox
            const anchor = typePricings[0];
            if (!anchor) return null;

            const selected = isBoosterSelected(anchor.id, boosterType as ExtendedBoosterType);
            const sel = getBoosterSelection(anchor.id, boosterType as ExtendedBoosterType);

            // Get current selected service type, default to first available
            const selectedServiceType = (sel?.serviceType || typePricings[0].serviceType || 'PM') as string;

            // Find the pricing for the selected service type
            const selectedPricing = typePricings.find(p => p.serviceType === selectedServiceType) || typePricings[0];
            const pricePerSession = selectedPricing.price;
            const serviceTypeName = SERVICE_TYPE_NAMES[selectedServiceType] || selectedServiceType;

            return (
              <div
                key={boosterType}
                style={{
                  border: selected ? '2px solid var(--color-booster, #a855f7)' : '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '12px',
                  background: selected ? 'rgba(168,85,247,0.08)' : 'var(--bg-card)',
                  transition: 'all 0.15s',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: selected ? '12px' : '0' }}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleBooster(anchor.id, boosterType as ExtendedBoosterType)}
                    className={styles.packageCheckbox}
                  />
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>
                    {label}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ({typePricings.length} layanan)
                  </span>
                </label>

                {selected && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>Tipe Layanan</label>
                      <select
                        value={selectedServiceType}
                        onChange={(e) => updateBoosterServiceType(anchor.id, boosterType as ExtendedBoosterType, e.target.value as ServiceType)}
                        className="form-input"
                        style={{ fontSize: '12px', padding: '6px 8px', width: '100%' }}
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
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>Jumlah</label>
                      <BoosterQuantityInput
                        pricingId={anchor.id}
                        boosterType={boosterType as ExtendedBoosterType}
                        quantity={sel?.quantity || 1}
                        updateBoosterQty={updateBoosterQty}
                      />
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span>Harga per sesi:</span>
                        <span>{formatCurrency(pricePerSession)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span>Total sesi:</span>
                        <span>{selectedPricing.totalSessions * (sel?.quantity || 1)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--color-booster, #a855f7)', marginTop: '6px', fontSize: '12px' }}>
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
