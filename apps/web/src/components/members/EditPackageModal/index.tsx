'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PackagePricing, ExtendedBoosterType, ServiceType, AddOnType, MemberPackage } from '@/types/package';
import { usePackageSelection } from '../AssignPackageModal/usePackageSelection';
import BasicPackageSection from '../AssignPackageModal/BasicPackageSection';
import BoosterPackageSection from '../AssignPackageModal/BoosterPackageSection';
import DiscountSection from '../AssignPackageModal/DiscountSection';
import PreviewSection from '../AssignPackageModal/PreviewSection';
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

interface EditData {
  selectedPackages: PackageSelection[];
  selectedAddOns: AddOnSelection[];
  discountPercent: number;
  discountAmount: number;
  discountNote: string;
  notes: string;
}

interface EditPackageModalProps {
  show: boolean;
  pricings: PackagePricing[];
  editData: EditData;
  existingPackages: MemberPackage[];
  submitting: boolean;
  onClose: () => void;
  onEditDataChange: (data: EditData) => void;
  onSubmit: () => void;
}

export default function EditPackageModal({
  show,
  pricings,
  editData,
  existingPackages,
  submitting,
  onClose,
  onEditDataChange,
  onSubmit
}: EditPackageModalProps) {
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
    calculatePreview,
  } = usePackageSelection(editData, onEditDataChange, pricingsList);

  const preview = calculatePreview();

  if (!show || !mounted) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const modalContent = (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>✏️ Edit Pembelian Paket</h3>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">✕</button>
        </div>

        <div className={styles.modalBody}>
          {/* Warning */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--text-primary)'
          }}>
            💡 <strong>Info:</strong> Anda dapat mengubah paket, jumlah sesi, booster, dan diskon. Transaksi Add-On baru dibuat dari tab Air Nano &amp; Add-On.
          </div>

          {existingPackages.some((pkg) => pkg.usedSessions > 0) && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: 'var(--text-primary)'
            }}>
              <strong>Sesi terpakai tetap dipertahankan.</strong> Jumlah paket/sesi boleh ditambah,
              tetapi paket yang sudah dipakai tidak dapat dihapus atau diganti tipe.
              <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                {existingPackages.filter((pkg) => pkg.usedSessions > 0).map((pkg) => (
                  <span key={pkg.packageId}>
                    {pkg.packageName || pkg.packageCode}: <strong>{pkg.usedSessions} terpakai</strong>
                    {' '}· {pkg.remainingSessions} tersisa dari {pkg.totalSessions}
                  </span>
                ))}
              </div>
            </div>
          )}

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

          {/* DISKON */}
          <DiscountSection
            discountPercent={editData.discountPercent}
            discountAmount={editData.discountAmount}
            discountNote={editData.discountNote}
            notes={editData.notes}
            onDiscountPercentChange={(value) => onEditDataChange({ ...editData, discountPercent: value })}
            onDiscountAmountChange={(value) => onEditDataChange({ ...editData, discountAmount: value })}
            onDiscountNoteChange={(value) => onEditDataChange({ ...editData, discountNote: value })}
            onNotesChange={(value) => onEditDataChange({ ...editData, notes: value })}
          />

          {/* PREVIEW */}
          <PreviewSection
            items={preview.items}
            subtotal={preview.subtotal}
            discount={preview.discount}
            total={preview.total}
            discountPercent={editData.discountPercent}
            discountAmount={editData.discountAmount}
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
            {submitting ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
