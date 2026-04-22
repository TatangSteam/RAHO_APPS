import { formatNumberWithDots } from '@/lib/formatNumber';
import styles from '../AssignPackageModal.module.css';

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
    <div className={styles.section}>
      <h4 className={`${styles.sectionTitle} ${styles.discountTitle}`}>💰 DISKON</h4>
      <div className={`${styles.sectionBox} ${styles.discountSection}`}>
        <div className={styles.discountGrid}>
          <div>
            <label className="form-label" style={{ fontSize: '13px' }}>Diskon (%)</label>
            <input
              type="number"
              value={discountPercent}
              onChange={(e) => onDiscountPercentChange(Math.min(Math.max(parseInt(e.target.value) || 0, 0), 100))}
              className="form-input"
              min="0"
              max="100"
              placeholder="0-100"
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '13px' }}>Diskon (Rp)</label>
            <input
              type="text"
              value={formatNumberInput(discountAmount)}
              onChange={(e) => {
                const numValue = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                onDiscountAmountChange(Math.max(numValue, 0));
              }}
              className="form-input"
              placeholder="Nominal diskon"
            />
          </div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label className="form-label" style={{ fontSize: '13px' }}>Catatan Diskon</label>
          <input
            type="text"
            value={discountNote}
            onChange={(e) => onDiscountNoteChange(e.target.value)}
            className="form-input"
            placeholder="Contoh: Diskon loyalitas"
          />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: '13px' }}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            className="form-input"
            placeholder="Catatan tambahan (opsional)"
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
}
