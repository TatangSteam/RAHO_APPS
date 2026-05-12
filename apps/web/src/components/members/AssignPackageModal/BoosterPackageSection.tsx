import { PackagePricing, ExtendedBoosterType, ServiceType, SERVICE_TYPE_PRICING, BOOSTER_TYPE_LABELS } from '@/types/package';
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

export default function BoosterPackageSection({
  pricingsList,
  isBoosterSelected,
  getBoosterSelection,
  toggleBooster,
  updateBoosterQty,
  updateBoosterServiceType,
}: BoosterPackageSectionProps) {
  // Group booster pricings by boosterType to avoid duplicates
  const boosterPricings = pricingsList.filter(p => p.packageType === 'BOOSTER');
  
  // Create a map of unique booster types (only keep first occurrence of each type)
  const uniqueBoosterMap = new Map<string, PackagePricing>();
  boosterPricings.forEach(pricing => {
    if (pricing.boosterType && !uniqueBoosterMap.has(pricing.boosterType)) {
      uniqueBoosterMap.set(pricing.boosterType, pricing);
    }
  });
  
  const uniqueBoosters = Array.from(uniqueBoosterMap.values());

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
          {uniqueBoosters.map((pricing) => {
            const boosterType = pricing.boosterType as ExtendedBoosterType;
            if (!boosterType) return null;

            const selected = isBoosterSelected(pricing.id, boosterType);
            const sel = getBoosterSelection(pricing.id, boosterType);
            const serviceType = (sel?.serviceType || 'PM') as ServiceType;
            const serviceConfig = SERVICE_TYPE_PRICING[serviceType];

            return (
              <div
                key={pricing.id}
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
                    onChange={() => toggleBooster(pricing.id, boosterType)}
                    className={styles.packageCheckbox}
                  />
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>
                    {BOOSTER_TYPE_LABELS[boosterType] || boosterType}
                  </span>
                </label>

                {selected && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>Tipe Layanan</label>
                      <select
                        value={serviceType}
                        onChange={(e) => updateBoosterServiceType(pricing.id, boosterType, e.target.value as ServiceType)}
                        className="form-input"
                        style={{ fontSize: '12px', padding: '6px 8px', width: '100%' }}
                      >
                        {Object.entries(SERVICE_TYPE_PRICING).map(([key, config]) => (
                          <option key={key} value={key}>
                            {config.name} — {formatCurrency((config as any).pricePerSession)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>Jumlah</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={sel?.quantity || 1}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Allow only numbers and empty string
                          if (value === '' || /^\d+$/.test(value)) {
                            const numValue = value === '' ? 1 : parseInt(value);
                            if (numValue >= 1) {
                              updateBoosterQty(pricing.id, boosterType, numValue);
                            }
                          }
                        }}
                        onFocus={(e) => {
                          // Select all on focus for easy replacement
                          e.target.select();
                        }}
                        className="form-input"
                        style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                        placeholder="1"
                      />
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span>Harga per sesi:</span>
                        <span>{formatCurrency(serviceConfig.pricePerSession)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span>Total sesi:</span>
                        <span>{pricing.totalSessions * (sel?.quantity || 1)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--color-booster, #a855f7)', marginTop: '6px', fontSize: '12px' }}>
                        <span>Total Harga:</span>
                        <span>{formatCurrency(serviceConfig.pricePerSession * pricing.totalSessions * (sel?.quantity || 1))}</span>
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
