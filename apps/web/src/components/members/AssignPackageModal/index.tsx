'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PackagePricing, ExtendedBoosterType, ServiceType, AddOnType } from '@/types/package';
import { usePackageSelection } from './usePackageSelection';
import BasicPackageSection from './BasicPackageSection';
import BoosterPackageSection from './BoosterPackageSection';
import AddOnSection from './AddOnSection';
import DiscountSection from './DiscountSection';
import PreviewSection from './PreviewSection';
import styles from '../AssignPackageModal.module.css';

interface PackageSelection {
  pricingId: string;
  quantity: number;
  boosterType?: ExtendedBoosterType;
  serviceType?: ServiceType;
}

interface AddOnSelection {
  type: AddOnType;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

interface AssignData {
  selectedPackages: PackageSelection[];
  selectedAddOns: AddOnSelection[];
  discountPercent: number;
  discountAmount: number;
  discountNote: string;
  notes: string;
}

interface AssignPackageModalProps {
  show: boolean;
  pricings: PackagePricing[];
  assignData: AssignData;
  submitting: boolean;
  onClose: () => void;
  onAssignDataChange: (data: AssignData) => void;
  onSubmit: () => void;
}

export default function AssignPackageModal({
  show,
  pricings,
  assignData,
  submitting,
  onClose,
  onAssignDataChange,
  onSubmit
}: AssignPackageModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [show]);

  if (!show || !mounted) return null;

  const pricingsList = Array.isArray(pricings) ? pricings : [];

  const {
    isBasicSelected,
    getBasicSelection,
    toggleBasic,
    updateBasicQty,
    isBoosterSelected,
    getBoosterSelection,
    toggleBooster,
    updateBoosterQty,
    updateBoosterServiceType,
    isAddOnSelected,
    getAddOnQuantity,
    toggleAddOn,
    updateAddOnQuantity,
    calculatePreview,
  } = usePackageSelection(assignData, onAssignDataChange, pricingsList);

  const preview = calculatePreview();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>📦 Assign Paket Terapi</h3>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* PAKET BASIC */}
          <BasicPackageSection
            pricingsList={pricingsList}
            isBasicSelected={isBasicSelected}
            getBasicSelection={getBasicSelection}
            toggleBasic={toggleBasic}
            updateBasicQty={updateBasicQty}
          />

          {/* PAKET BOOSTER */}
          <BoosterPackageSection
            pricingsList={pricingsList}
            isBoosterSelected={isBoosterSelected}
            getBoosterSelection={getBoosterSelection}
            toggleBooster={toggleBooster}
            updateBoosterQty={updateBoosterQty}
            updateBoosterServiceType={updateBoosterServiceType}
          />

          {/* ADD-ONS */}
          <AddOnSection
            isAddOnSelected={isAddOnSelected}
            getAddOnQuantity={getAddOnQuantity}
            toggleAddOn={toggleAddOn}
            updateAddOnQuantity={updateAddOnQuantity}
          />

          {/* DISKON */}
          <DiscountSection
            discountPercent={assignData.discountPercent}
            discountAmount={assignData.discountAmount}
            discountNote={assignData.discountNote}
            notes={assignData.notes}
            onDiscountPercentChange={(value) => onAssignDataChange({ ...assignData, discountPercent: value })}
            onDiscountAmountChange={(value) => onAssignDataChange({ ...assignData, discountAmount: value })}
            onDiscountNoteChange={(value) => onAssignDataChange({ ...assignData, discountNote: value })}
            onNotesChange={(value) => onAssignDataChange({ ...assignData, notes: value })}
          />

          {/* PREVIEW */}
          <PreviewSection
            items={preview.items}
            subtotal={preview.subtotal}
            discount={preview.discount}
            total={preview.total}
            discountPercent={assignData.discountPercent}
            discountAmount={assignData.discountAmount}
          />
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Batal</button>
          <button
            onClick={onSubmit}
            disabled={submitting || preview.items.length === 0}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {submitting ? '⏳ Menyimpan...' : '✅ Assign Paket'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
