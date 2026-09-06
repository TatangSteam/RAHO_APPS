'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MemberPackage, PackageType } from '@/types/package';
import { Button } from '@/components/ui/Button';
import { PackageActionModal } from './PackageActionModal';
import styles from './PackageActionModal.module.css';

interface VoucherBalanceEditModalProps {
  show: boolean;
  packageType: PackageType;
  packages: MemberPackage[];
  onClose: () => void;
  onSubmit: (packageId: string, remainingSessions: number, reason: string) => Promise<void>;
}

export default function VoucherBalanceEditModal({
  show,
  packageType,
  packages,
  onClose,
  onSubmit,
}: VoucherBalanceEditModalProps) {
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [remainingSessions, setRemainingSessions] = useState('0');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedPackage = useMemo(
    () => packages.find((item) => item.packageId === selectedPackageId),
    [packages, selectedPackageId],
  );

  useEffect(() => {
    if (!show) return;
    const firstPackage = packages[0];
    setSelectedPackageId(firstPackage?.packageId || '');
    setRemainingSessions(String(firstPackage?.remainingSessions ?? 0));
    setReason('');
    setErrorMessage('');
  }, [show, packages]);

  const selectPackage = (packageId: string) => {
    const nextPackage = packages.find((item) => item.packageId === packageId);
    setSelectedPackageId(packageId);
    setRemainingSessions(String(nextPackage?.remainingSessions ?? 0));
    setErrorMessage('');
  };

  const parsedRemainingSessions = Number(remainingSessions);
  const isValid = Boolean(
    selectedPackage &&
    Number.isInteger(parsedRemainingSessions) &&
    parsedRemainingSessions >= 0 &&
    reason.trim().length >= 5,
  );

  const handleSubmit = async () => {
    if (!isValid || !selectedPackage) return;
    try {
      setSubmitting(true);
      setErrorMessage('');
      await onSubmit(selectedPackage.packageId, parsedRemainingSessions, reason.trim());
      onClose();
    } catch (error) {
      const apiMessage = (
        error as { response?: { data?: { error?: { message?: string } } }; message?: string }
      ).response?.data?.error?.message;
      setErrorMessage(apiMessage || (error as Error).message || `Gagal mengubah voucher ${packageType}.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <PackageActionModal
      open={show}
      title={`Edit Voucher ${packageType}`}
      onClose={submitting ? () => undefined : onClose}
      footer={(
        <>
          <Button unstyled onClick={onClose} className={styles.btnSecondary} disabled={submitting}>
            Batal
          </Button>
          <Button
            unstyled
            onClick={handleSubmit}
            className={styles.btnPrimary}
            disabled={submitting || !isValid}
          >
            {submitting ? 'Menyimpan...' : 'Simpan Voucher'}
          </Button>
        </>
      )}
    >
      <div className={styles.infoBox}>
        <p>
          Pilih paket {packageType} yang ingin disesuaikan. Sesi yang sudah terpakai tetap
          tersimpan dan harga atau invoice tidak berubah.
        </p>
      </div>

      {packages.length === 0 ? (
        <div className={styles.warningBox}>
          <p>Tidak ada paket {packageType} aktif yang dapat diubah.</p>
        </div>
      ) : (
        <>
          <div className={styles.formGroup}>
            <label htmlFor={`${packageType.toLowerCase()}-voucher-package`}>Paket {packageType}</label>
            <select
              id={`${packageType.toLowerCase()}-voucher-package`}
              value={selectedPackageId}
              onChange={(event) => selectPackage(event.target.value)}
              className={styles.input}
              disabled={submitting}
            >
              {packages.map((item) => (
                <option key={item.packageId} value={item.packageId}>
                  {item.packageName || item.packageCode} — sisa {item.remainingSessions} sesi
                </option>
              ))}
            </select>
          </div>

          {selectedPackage && (
            <div className={styles.infoBox}>
              <p><strong>Kode paket:</strong> {selectedPackage.packageCode}</p>
              <p><strong>Sesi terpakai:</strong> {selectedPackage.usedSessions}</p>
              <p><strong>Sisa saat ini:</strong> {selectedPackage.remainingSessions}</p>
              <p><strong>Total sesi setelah disimpan:</strong> {selectedPackage.usedSessions + (Number.isInteger(parsedRemainingSessions) && parsedRemainingSessions >= 0 ? parsedRemainingSessions : 0)}</p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor={`${packageType.toLowerCase()}-voucher-remaining`}>
              Sisa voucher baru <span className={styles.required}>*</span>
            </label>
            <input
              id={`${packageType.toLowerCase()}-voucher-remaining`}
              type="number"
              min="0"
              step="1"
              value={remainingSessions}
              onChange={(event) => setRemainingSessions(event.target.value)}
              className={styles.input}
              disabled={submitting}
            />
            <span className={styles.hint}>Masukkan jumlah sesi yang masih dapat digunakan.</span>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor={`${packageType.toLowerCase()}-voucher-reason`}>
              Alasan perubahan <span className={styles.required}>*</span>
            </label>
            <textarea
              id={`${packageType.toLowerCase()}-voucher-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: koreksi saldo voucher sesuai bukti transaksi"
              rows={3}
              maxLength={500}
              className={styles.textarea}
              disabled={submitting}
            />
            <span className={styles.hint}>Minimal 5 karakter. Alasan dicatat pada audit log.</span>
          </div>

          {errorMessage && (
            <div className={styles.warningBox} role="alert">
              <p>{errorMessage}</p>
            </div>
          )}
        </>
      )}
    </PackageActionModal>
  );
}
