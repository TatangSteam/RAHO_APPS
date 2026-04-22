import { PackagePricing, ExtendedBoosterType, ServiceType, SERVICE_TYPE_PRICING, BOOSTER_TYPE_LABELS } from '@/types/package';
import { formatCurrency } from '@/lib/formatNumber';
import styles from '../AssignPackageModal.module.css';

const boosterKey = (pricingId: string, boosterType: ExtendedBoosterType) => `${pricingId}::${boosterType}`;

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
  const boosterPricings = pricingsList.filter(p => p.packageType === 'BOOSTER');
  const boosterTypes = Object.keys(BOOSTER_TYPE_LABELS) as ExtendedBoosterType[];

  return (
    <div className={styles.section}>
      <h4 className={`${styles.sectionTitle} ${styles.boosterTitle}`}>🚀 PAKET BOOSTER</h4>
      <div className={`${styles.sectionBox} ${styles.boosterSection}`}>
        {boosterPricings.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Tidak ada paket booster tersedia.</p>
        )}
        {boosterPricings.map((pricing) => (
          <div key={pricing.id} style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {pricing.name} — {pricing.totalSessions} sesi
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {boosterTypes.map((bt) => {
                const selected = isBoosterSelected(pricing.id, bt);
                const sel = getBoosterSelection(pricing.id, bt);
                const serviceType = (sel?.serviceType || 'PM') as ServiceType;
                const serviceConfig = SERVICE_TYPE_PRICING[serviceType];

                return (
                  <div
                    key={boosterKey(pricing.id, bt)}
                    style={{
                      border: selected ? '2px solid var(--color-booster, #a855f7)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px',
                      background: selected ? 'rgba(168,85,247,0.08)' : 'var(--bg-card)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: selected ? '10px' : '0' }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleBooster(pricing.id, bt)}
                        className={styles.packageCheckbox}
                      />
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>
                        {BOOSTER_TYPE_LABELS[bt]}
                      </span>
                    </label>

                    {selected && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px' }}>Tipe Layanan</label>
                          <select
                            value={serviceType}
                            onChange={(e) => updateBoosterServiceType(pricing.id, bt, e.target.value as ServiceType)}
                            className="form-input"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          >
                            {Object.entries(SERVICE_TYPE_PRICING).map(([key, config]) => (
                              <option key={key} value={key}>
                                {config.name} — {formatCurrency((config as any).pricePerSession)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="form-label" style={{ fontSize: '11px', marginBottom: '0', whiteSpace: 'nowrap' }}>Qty</label>
                          <input
                            type="number"
                            value={sel?.quantity || 1}
                            onChange={(e) => updateBoosterQty(pricing.id, bt, parseInt(e.target.value) || 1)}
                            className="form-input"
                            min="1"
                            style={{ width: '70px', fontSize: '12px', padding: '4px 8px' }}
                          />
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Per sesi:</span>
                            <span>{formatCurrency(serviceConfig.pricePerSession)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Total sesi:</span>
                            <span>{pricing.totalSessions * (sel?.quantity || 1)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--color-booster, #a855f7)', marginTop: '2px' }}>
                            <span>Total:</span>
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
        ))}
      </div>
    </div>
  );
}
