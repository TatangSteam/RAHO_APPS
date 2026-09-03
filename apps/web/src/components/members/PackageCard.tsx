'use client';

import { useState } from 'react';
import type { PackageDisplay, MemberPackage, StandaloneAddOn } from '@/types/package';
import ViewInvoiceButton from '../invoices/ViewInvoiceButton';
import ViewPaymentProofButton from './ViewPaymentProofButton';
import { formatCurrency } from '@/lib/formatNumber';
import { getAggregatePackageStatus } from './memberStatusPresentation';
import {
  findActiveInstallmentTarget,
  findPendingPaymentTarget,
  groupMemberPackagesForDisplay,
} from './packageCard.helpers';
import styles from './MemberPackagesTab.module.css';

interface PackageCardProps {
  pkg: PackageDisplay;
  onVerifyPayment?: (packageId: string, packageStatus: string, proofUrl?: string, proofFileName?: string) => void;
  onRefundPackage?: (packageId: string, packageCode: string, finalPrice: number) => void;
  onCancelPackage?: (packageId: string, packageCode: string) => void;
  onEditPackage?: (purchaseGroupId: string, packages: MemberPackage[], addOns: StandaloneAddOn[], discount: number, discountPercent: number, discountNote: string, notes: string) => void;
  canEditWaitingVerification?: boolean;
  canEditVerified?: boolean;
  onViewRefundDetail?: (refundData: {
    packageCode: string;
    refundAmount: number;
    refundReason: string;
    refundedBy?: string;
    refundedAt?: string;
    refundProofUrl?: string;
    refundProofFileName?: string;
  }) => void;
}

function isStandaloneAddOn(item: MemberPackage | StandaloneAddOn): item is StandaloneAddOn {
  return 'addOnId' in item;
}

// Helper function to get therapy name from product code
const getTherapyName = (productCode: string | undefined, packageCode: string, packageType: string): string => {
  // ALWAYS use productCode if available
  if (productCode && productCode.trim() !== '') {
    if (packageType === 'BASIC') {
      // Product code format: TNB-P{sessions}-{serviceType}
      const parts = productCode.split('-');
      if (parts[0] === 'TNB' && parts.length >= 2) {
        const sessionMatch = parts[1].match(/P(\d+)/);
        const sessions = sessionMatch ? sessionMatch[1] : '1';
        
        // Only show service type if it exists in product code
        if (parts.length >= 3) {
          const serviceType = parts[2];
          const serviceNames: Record<string, string> = {
            'PM': 'Premier',
            'PS': 'Partnership',
            'PTY': 'Partnership Attiya',
            'PDA': 'Partnership Dr. Abhi',
            'PHC': 'Partnership Homecare'
          };
          
          const serviceName = serviceNames[serviceType];
          return serviceName 
            ? `Terapi Nano Bubble ${sessions}X ${serviceName}`
            : `Terapi Nano Bubble ${sessions}X`;
        }
        
        // No service type in product code
        return `Terapi Nano Bubble ${sessions}X`;
      }
    } else {
      // BOOSTER: BST-{boosterType}-P1-{serviceType}
      const parts = productCode.split('-');
      if (parts[0] === 'BST' && parts.length >= 2) {
        const boosterType = parts[1];
        
        // Use short codes for display, except HK which uses full name
        const boosterDisplayNames: Record<string, string> = {
          'NO': 'NO',
          'GT': 'GT',
          'MB': 'MB',
          'KCL': 'KCL',
          'H2S': 'H2S',
          'HK': 'H2S Konsentrat',  // Only HK uses full name per List Harga
          'O3': 'O3',
          'HHO': 'HHO',
          'PST': 'NO',
          'NO2': 'NO'
        };
        
        const displayName = boosterDisplayNames[boosterType] || boosterType;
        
        // Only show service type if it exists in product code (length >= 4)
        if (parts.length >= 4) {
          const serviceType = parts[3];
          
          const serviceNames: Record<string, string> = {
            'PM': 'Premier',
            'PS': 'Partnership',
            'PTY': 'Partnership Attiya',
            'PDA': 'Partnership Dr. Abhi',
            'PHC': 'Partnership Homecare'
          };
          
          const serviceName = serviceNames[serviceType];
          return serviceName
            ? `Booster ${displayName} 1X ${serviceName}`
            : `Booster ${displayName} 1X`;
        }
        
        // No service type in product code
        return `Booster ${displayName} 1X`;
      }
    }
  }
  
  // Fallback: show package code as-is
  return packageCode;
};

const getPackageDisplayName = (pkg: MemberPackage): string => (
  pkg.packageName?.trim()
  || getTherapyName(pkg.productCode, pkg.packageCode, pkg.packageType)
);

const formatPackageCodes = (codes: string[]): string => (
  `${codes[0]}${codes.length > 1 ? ` (+${codes.length - 1} lainnya)` : ''}`
);

export default function PackageCard({
  pkg,
  onVerifyPayment,
  onRefundPackage,
  onCancelPackage,
  onEditPackage,
  canEditWaitingVerification = false,
  canEditVerified = false,
  onViewRefundDetail,
}: PackageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING_PAYMENT: 'pending',
      WAITING_VERIFICATION: 'waiting',
      ACTIVE: 'active',
      EXPIRED: 'expired',
      CANCELLED: 'cancelled'
    };
    
    const statusText: Record<string, string> = {
      PENDING_PAYMENT: 'Pending Payment',
      WAITING_VERIFICATION: 'Waiting Verification',
      ACTIVE: 'Active',
      EXPIRED: 'Expired',
      CANCELLED: 'Cancelled'
    };
    
    const statusClass = statusMap[status] || 'default';
    
    return (
      <span className={`${styles.badge} ${styles[statusClass]}`}>
        {statusText[status] || status}
      </span>
    );
  };

  const getRefundBadge = (pkg: MemberPackage) => {
    if (pkg.status === 'CANCELLED' && pkg.refundReason) {
      return (
        <span 
          className={`${styles.badge} ${styles.refund}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onViewRefundDetail) {
              onViewRefundDetail({
                packageCode: pkg.packageCode,
                refundAmount: pkg.refundAmount || 0,
                refundReason: pkg.refundReason || '-',
                refundedBy: pkg.refundedBy,
                refundedAt: pkg.refundedAt,
                refundProofUrl: pkg.refundProofUrl,
                refundProofFileName: pkg.refundProofFileName,
              });
            }
          }}
          style={{ cursor: 'pointer' }}
          title="Klik untuk melihat detail refund"
        >
          📝 [REFUND] {pkg.refundReason}
        </span>
      );
    }
    return null;
  };

  const getPaymentPlanInfo = (item: MemberPackage | StandaloneAddOn, totalPrice: number) => {
    if (item?.paymentPlanType !== 'INSTALLMENT') return null;

    const paid = Number(item.totalVerifiedPaid || 0);
    const installmentTotal = item.installmentTotal || '-';
    const planStatus = item.paymentPlanStatus === 'PAID'
      ? 'Lunas semua termin'
      : 'Aktif - cicilan berjalan';

    return (
      <div className={styles.discountInfo}>
        Termin {installmentTotal}x • {planStatus} • Terverifikasi {formatCurrency(paid)} / {formatCurrency(totalPrice)}
      </div>
    );
  };

  const isGroup = 'isGroup' in pkg && pkg.isGroup;
  const isAddOn = 'isAddOn' in pkg && pkg.isAddOn;
  const canEditPackageStatus = (status?: string) => (
    status === 'PENDING_PAYMENT' ||
    (canEditWaitingVerification && status === 'WAITING_VERIFICATION') ||
    (canEditVerified && status === 'ACTIVE')
  );

  // Standalone Add-On
  if (isAddOn && !isGroup) {
    const addon = pkg as StandaloneAddOn;
    return (
      <div className={styles.packageCard}>
        {/* Compact Header - Always Visible */}
        <div 
          className={styles.compactHeader}
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.compactLeft}>
            <span className={styles.packageIcon}>✨</span>
            <div>
              <div className={styles.compactTitle}>
                {addon.notes?.split('(')[0]?.trim() || addon.addOnCode}
              </div>
              <div className={styles.compactSubtitle}>
                {addon.addOnCode} • Qty: {addon.quantity}
              </div>
            </div>
          </div>
        <div className={styles.compactRight}>
          <div className={styles.compactPrice}>{formatCurrency(addon.totalPrice)}</div>
          {getStatusBadge(addon.status)}
          <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
        </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className={styles.expandedContent}>
            <div className={styles.sessionInfo}>
              <span className={styles.sessionBadge}>Qty: {addon.quantity}</span>
              <span className={styles.sessionDivider}>•</span>
              <span className={styles.sessionUsed}>@ {formatCurrency(addon.pricePerUnit)}</span>
            </div>

            {addon.notes && (
              <div className={styles.bundleNotesSection}>
                <div className={styles.packageNotes}>📝 {addon.notes}</div>
              </div>
            )}

            <div className={styles.metaInfo}>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>📍</span>
                {addon.branchName}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>👤</span>
                {addon.assignedBy}
              </div>
              {addon.paidAt && (
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon}>💳</span>
                  {new Date(addon.paidAt).toLocaleDateString('id-ID')}
                </div>
              )}
            </div>

            {(addon.status === 'PENDING_PAYMENT' || addon.status === 'WAITING_VERIFICATION') && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                <ViewInvoiceButton
                  packageId={addon.addOnId}
                  packageCode={addon.addOnCode}
                  status={addon.status}
                  documentLabel={addon.paymentPlanType === 'INSTALLMENT' && addon.paymentPlanStatus === 'ACTIVE_INSTALLMENT' ? 'Lihat Invoice' : undefined}
                />
                {onVerifyPayment && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyPayment(addon.addOnId, addon.status, addon.paymentProofUrl, addon.paymentProofFileName);
                  }}
                  className={styles.verifyButton}
                  style={{ marginTop: 0 }}
                >
                  ✅ Verify Payment
                </button>
                )}
              </div>
            )}
            
            {(addon.status === 'ACTIVE' || addon.status === 'EXPIRED') && (
              <div className={styles.invoiceButtonWrapper}>
                <ViewInvoiceButton
                  packageId={addon.addOnId}
                  packageCode={addon.addOnCode}
                  status={addon.status}
                  documentLabel={addon.paymentPlanType === 'INSTALLMENT' && addon.paymentPlanStatus === 'ACTIVE_INSTALLMENT' ? 'Lihat Invoice' : undefined}
                />
                <ViewPaymentProofButton
                  packageId={addon.addOnId}
                  packageCode={addon.addOnCode}
                  status={addon.status}
                />
                {onVerifyPayment && addon.paymentPlanType === 'INSTALLMENT' && addon.paymentPlanStatus === 'ACTIVE_INSTALLMENT' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerifyPayment(addon.addOnId, addon.status, addon.paymentProofUrl, addon.paymentProofFileName);
                    }}
                    className={styles.verifyButton}
                    style={{ marginTop: 0 }}
                  >
                    ✅ Verify Termin Berikutnya
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isGroup) {
    // Bundle Package
    const basics = pkg.basics || (pkg.basic ? [pkg.basic] : []);
    const boosters = pkg.boosters || (pkg.booster ? [pkg.booster] : []);
    const basicDisplayGroups = groupMemberPackagesForDisplay(basics);
    const boosterDisplayGroups = groupMemberPackagesForDisplay(boosters);
    const groupAddOns = pkg.addOns || [];
    const groupStatus = getAggregatePackageStatus([...basics, ...boosters, ...groupAddOns]);
    const addOnStatus = getAggregatePackageStatus(groupAddOns);
    const paymentItems = [...basics, ...boosters, ...groupAddOns];
    const pendingPaymentTarget = findPendingPaymentTarget(paymentItems);
    const activeInstallmentTarget = findActiveInstallmentTarget(paymentItems);
    const anyPending = Boolean(pendingPaymentTarget);
    const anyActive = basics.some(p => p?.status === 'ACTIVE') || boosters.some(p => p?.status === 'ACTIVE') || groupAddOns.some(a => a?.status === 'ACTIVE');
    const anyActiveInstallment = Boolean(activeInstallmentTarget);
    const editablePackages = ([...basics, ...boosters].filter(Boolean) as MemberPackage[])
      .filter((item) => canEditPackageStatus(item.status));
    const canEditGroup = editablePackages.length > 0;
    
    // Calculate total prices for all packages and add-ons
    const totalAddOnPrice = groupAddOns.reduce((sum, addOn) => sum + (addOn.totalPrice || 0), 0);
    const totalFinalPrice = basics.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.finalPrice || 0), 0) + boosters.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.finalPrice || 0), 0) + totalAddOnPrice;
    const totalBasicSessions = basics.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.totalSessions || 0), 0);
    const totalBoosterSessions = boosters.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.totalSessions || 0), 0);
    const totalBasicQuantity = basics.reduce(
      (sum: number, p: MemberPackage | undefined) => sum + (p ? Math.max(1, p.purchaseQuantity || 1) : 0),
      0,
    );
    const totalBoosterQuantity = boosters.reduce(
      (sum: number, p: MemberPackage | undefined) => sum + (p ? Math.max(1, p.purchaseQuantity || 1) : 0),
      0,
    );
    const totalRemainingSessions = basics.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.remainingSessions || 0), 0) + boosters.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.remainingSessions || 0), 0);
    const totalDiscount = [...basics, ...boosters].reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.discountAmount || 0), 0);

    return (
      <div className={`${styles.packageCard} ${styles.bundleCard}`}>
        {/* Compact Header - Always Visible */}
        <div 
          className={styles.compactHeader}
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.compactLeft}>
            <span className={styles.packageIcon}>📦</span>
            <div>
              <div className={styles.compactTitle}>
                Paket Bundling
                {totalBasicQuantity > 0 && <span style={{ marginLeft: '8px', fontSize: '12px' }}>• {totalBasicQuantity} UNIT BASIC ({totalBasicSessions} SESI)</span>}
                {totalBoosterQuantity > 0 && <span style={{ marginLeft: '8px', fontSize: '12px' }}>• {totalBoosterQuantity} UNIT BOOSTER ({totalBoosterSessions} SESI)</span>}
                {groupAddOns.length > 0 && <span style={{ marginLeft: '8px', fontSize: '12px' }}>• {groupAddOns.length} ADD-ON</span>}
              </div>
              <div className={styles.compactSubtitle}>
                {totalRemainingSessions} sesi tersisa
              </div>
            </div>
          </div>
          <div className={styles.compactRight}>
            <div className={styles.compactPrice}>{formatCurrency(totalFinalPrice)}</div>
            {getStatusBadge(groupStatus || 'ACTIVE')}
            {(basics[0] && getRefundBadge(basics[0])) || (boosters[0] && getRefundBadge(boosters[0]))}
            <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className={styles.expandedContent}>
            {/* Basic packages are rendered per catalog pricing. */}
            {basicDisplayGroups.map((basicGroup) => {
              const basic = basicGroup.representative;
              const status = getAggregatePackageStatus(basicGroup.items) || basic.status;
              return (
                <div key={basicGroup.key} className={`${styles.packageSection} ${styles.basicSection}`}>
                  <div className={styles.packageHeader}>
                    <div className={styles.packageInfo}>
                      <div className={styles.packageTitle}>
                        <span className={styles.packageIcon}>📦</span>
                        {getPackageDisplayName(basic)}
                        {basicGroup.quantity > 1 && <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-primary-400)' }}>x{basicGroup.quantity}</span>}
                      </div>
                      <div className={styles.packageCode}>{formatPackageCodes(basicGroup.packageCodes)}</div>
                    </div>
                    {getStatusBadge(status)}
                  </div>

                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionBadge}>{basicGroup.totalSessions} sesi total</span>
                    <span className={styles.sessionDivider}>•</span>
                    <span className={styles.sessionUsed}>{basicGroup.usedSessions} terpakai</span>
                    <span className={styles.sessionDivider}>•</span>
                    <span className={styles.sessionRemaining}>{basicGroup.remainingSessions} tersisa</span>
                  </div>

                  <div className={styles.packagePrice}>{formatCurrency(basicGroup.originalPrice)}</div>
                </div>
              );
            })}

            {/* Booster packages are also separated when their pricing differs. */}
            {boosterDisplayGroups.map((boosterGroup) => {
              const booster = boosterGroup.representative;
              const status = getAggregatePackageStatus(boosterGroup.items) || booster.status;
              return (
                <div key={boosterGroup.key} className={`${styles.packageSection} ${styles.boosterSection}`}>
                  <div className={styles.packageHeader}>
                    <div className={styles.packageInfo}>
                      <div className={styles.packageTitle}>
                        <span className={styles.packageIcon}>🚀</span>
                        {getPackageDisplayName(booster)}
                        {boosterGroup.quantity > 1 && <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-primary-400)' }}>x{boosterGroup.quantity}</span>}
                      </div>
                      <div className={styles.packageCode}>{formatPackageCodes(boosterGroup.packageCodes)}</div>
                    </div>
                    {getStatusBadge(status)}
                  </div>

                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionBadge}>{boosterGroup.totalSessions} sesi total</span>
                    <span className={styles.sessionDivider}>•</span>
                    <span className={styles.sessionUsed}>{boosterGroup.usedSessions} terpakai</span>
                    <span className={styles.sessionDivider}>•</span>
                    <span className={styles.sessionRemaining}>{boosterGroup.remainingSessions} tersisa</span>
                  </div>

                  <div className={`${styles.packagePrice} ${styles.boosterPrice}`}>{formatCurrency(boosterGroup.originalPrice)}</div>
                </div>
              );
            })}

            {/* Add-Ons */}
            {groupAddOns.length > 0 && (
              <div className={`${styles.packageSection} ${styles.addOnSection}`}>
                <div className={styles.packageHeader}>
                  <div className={styles.packageInfo}>
                    <div className={styles.packageTitle}>
                      <span className={styles.packageIcon}>✨</span>
                      Add-Ons
                      {groupAddOns.length > 1 && <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-primary-400)' }}>x{groupAddOns.length}</span>}
                    </div>
                    <div className={styles.packageCode}>
                      {groupAddOns.map((a) => a.addOnCode).join(', ')}
                    </div>
                  </div>
                  {getStatusBadge(addOnStatus || groupAddOns[0].status)}
                </div>
                
                <div className={styles.sessionInfo}>
                  {groupAddOns.map((addon, idx) => (
                    <span key={idx}>
                      {idx > 0 && <span className={styles.sessionDivider}>•</span>}
                      <span className={styles.sessionBadge}>
                        {addon.notes?.split('(')[0]?.trim() || addon.addOnCode}: {addon.quantity}x @ {formatCurrency(addon.pricePerUnit)}
                      </span>
                    </span>
                  ))}
                </div>
                
                <div className={`${styles.packagePrice} ${styles.addOnPrice}`}>
                  {formatCurrency(totalAddOnPrice)}
                </div>
              </div>
            )}

            {/* Bundle Notes & Discount */}
            <div className={styles.bundleNotesSection}>
              {(() => {
                // For bundles, get discount info from first package
                const discountPercent = basics[0]?.discountPercent || boosters[0]?.discountPercent || 0;
                const discountNote = basics[0]?.discountNote || boosters[0]?.discountNote;
                
                // totalDiscount contains the combined discount (percent + amount)
                // We need to separate them for display
                let displayText = '';
                if (totalDiscount > 0 && discountPercent > 0) {
                  // Calculate what the percent discount would be from original price
                  // Original price = current price + total discount
                  const totalPrice = totalFinalPrice + totalDiscount;
                  const percentDiscountValue = (totalPrice * discountPercent) / 100;
                  const amountDiscountValue = totalDiscount - percentDiscountValue;
                  
                  if (amountDiscountValue > 0) {
                    displayText = `${discountPercent}% + ${formatCurrency(amountDiscountValue)}`;
                  } else {
                    displayText = `${discountPercent}%`;
                  }
                } else if (totalDiscount > 0) {
                  displayText = formatCurrency(totalDiscount);
                }
                
                // Check if any package has incentive
                const packageWithIncentive = [...basics, ...boosters].find(p => p?.incentive);
                
                return (
                  <>
                    {totalDiscount > 0 && (
                      <div className={styles.discountInfo}>
                        💰 Diskon: {displayText}
                        {discountNote && ` - ${discountNote}`}
                      </div>
                    )}
                    {packageWithIncentive?.incentive && (
                      <div className={styles.incentiveInfo}>
                        🎁 Insentif Referral: {formatCurrency(packageWithIncentive.incentive.incentiveAmount)}
                        {packageWithIncentive.incentive.incentiveType === 'PERCENTAGE' && 
                          ` (${packageWithIncentive.incentive.incentiveValue}%)`}
                        {packageWithIncentive.incentive.referralCode && (
                          <span style={{ marginLeft: '8px', fontSize: '13px', opacity: 0.8 }}>
                            untuk {packageWithIncentive.incentive.referralCode.referrerName} ({packageWithIncentive.incentive.referralCode.code})
                          </span>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
              {(basics[0]?.notes || boosters[0]?.notes) ? (
                <div className={styles.packageNotes}>
                  📝 {basics[0]?.notes || boosters[0]?.notes}
                </div>
              ) : null}
            </div>

            {/* Meta Info */}
            <div className={styles.metaInfo}>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>📍</span>
                {basics[0]?.branchName || boosters[0]?.branchName}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>👤</span>
                {basics[0]?.assignedBy || boosters[0]?.assignedBy}
              </div>
              {(basics[0]?.paidAt || boosters[0]?.paidAt) && (
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon}>💳</span>
                  {new Date(basics[0]?.paidAt || boosters[0]?.paidAt || '').toLocaleDateString('id-ID')}
                </div>
              )}
            </div>

            {/* Bundle Total */}
            <div className={styles.bundleTotal}>
              <div className={styles.bundleTotalLabel}>Total Bundling:</div>
              <div className={styles.bundleTotalPrice}>
                {formatCurrency(totalFinalPrice)}
              </div>
            </div>
            {getPaymentPlanInfo(basics[0] || boosters[0] || groupAddOns[0], totalFinalPrice)}

            {/* Actions */}
            {anyPending && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                <ViewInvoiceButton
                  packageId={basics[0]?.packageId || boosters[0]?.packageId || groupAddOns[0]?.addOnId || ''}
                  packageCode={`${basics.map((p: MemberPackage) => p?.packageCode).join(', ')} + ${boosters.map((p: MemberPackage) => p?.packageCode).join(', ')}`}
                  status={groupStatus || 'PENDING_PAYMENT'}
                />
                {onVerifyPayment && pendingPaymentTarget && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyPayment(
                      isStandaloneAddOn(pendingPaymentTarget) ? pendingPaymentTarget.addOnId : pendingPaymentTarget.packageId,
                      pendingPaymentTarget.status,
                      pendingPaymentTarget.paymentProofUrl,
                      pendingPaymentTarget.paymentProofFileName
                    );
                  }}
                  className={styles.verifyButton}
                  style={{ marginTop: 0 }}
                >
                  ✅ Verify Payment (Bundle)
                </button>
                )}
                {onEditPackage && canEditGroup && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const discountPercent = basics[0]?.discountPercent || boosters[0]?.discountPercent || 0;
                      onEditPackage(
                        pkg.purchaseGroupId || '',
                        editablePackages,
                        groupAddOns,
                        totalDiscount,
                        discountPercent,
                        basics[0]?.discountNote || boosters[0]?.discountNote || '',
                        basics[0]?.notes || boosters[0]?.notes || ''
                      );
                    }}
                    className={styles.editButton}
                  >
                    Edit Paket
                  </button>
                )}
                {onCancelPackage && basics[0] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelPackage(basics[0].packageId, basics[0].packageCode);
                    }}
                    className={styles.cancelButton}
                  >
                    ❌ Batalkan
                  </button>
                )}
              </div>
            )}
            
            {anyActive && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <ViewInvoiceButton
                  packageId={basics[0]?.packageId || boosters[0]?.packageId || ''}
                  packageCode={`${basics.map((p: MemberPackage) => p?.packageCode).join(', ')} + ${boosters.map((p: MemberPackage) => p?.packageCode).join(', ')}`}
                  status={groupStatus || 'ACTIVE'}
                  documentLabel={anyActiveInstallment ? 'Lihat Invoice' : undefined}
                />
                <ViewPaymentProofButton
                  packageId={basics[0]?.packageId || boosters[0]?.packageId || ''}
                  packageCode={`${basics.map((p: MemberPackage) => p?.packageCode).join(', ')}`}
                  status={groupStatus || 'ACTIVE'}
                />
                {onVerifyPayment && activeInstallmentTarget && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerifyPayment(
                        isStandaloneAddOn(activeInstallmentTarget) ? activeInstallmentTarget.addOnId : activeInstallmentTarget.packageId,
                        activeInstallmentTarget.status,
                        activeInstallmentTarget.paymentProofUrl,
                        activeInstallmentTarget.paymentProofFileName
                      );
                    }}
                    className={styles.verifyButton}
                    style={{ marginTop: 0 }}
                  >
                    ✅ Verify Termin Berikutnya
                  </button>
                )}
                {onEditPackage && canEditGroup && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const discountPercent = basics[0]?.discountPercent || boosters[0]?.discountPercent || 0;
                      onEditPackage(
                        pkg.purchaseGroupId || '',
                        editablePackages,
                        groupAddOns,
                        totalDiscount,
                        discountPercent,
                        basics[0]?.discountNote || boosters[0]?.discountNote || '',
                        basics[0]?.notes || boosters[0]?.notes || ''
                      );
                    }}
                    className={styles.editButton}
                  >
                    Edit Paket
                  </button>
                )}
                {onRefundPackage && basics[0] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefundPackage(basics[0].packageId, basics[0].packageCode, totalFinalPrice);
                    }}
                    className={styles.refundButton}
                  >
                    💰 Refund (Bundle)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Standalone Package (not add-on, not grouped)
  if (isAddOn) {
    return null;
  }
  
  const memberPkg = pkg as MemberPackage;
  const standaloneFinalPrice = memberPkg.finalPrice;
  const canEditStandalonePackage = canEditPackageStatus(memberPkg.status);
  
  return (
    <div className={styles.packageCard}>
      {/* Compact Header - Always Visible */}
      <div 
        className={styles.compactHeader}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.compactLeft}>
          <span className={styles.packageIcon}>
            {memberPkg.packageType === 'BASIC' ? '📦' : '🚀'}
          </span>
          <div>
            <div className={styles.compactTitle}>
              {getPackageDisplayName(memberPkg)}
            </div>
            <div className={styles.compactSubtitle}>
              {memberPkg.packageCode} • {memberPkg.remainingSessions}/{memberPkg.totalSessions} sesi
            </div>
          </div>
        </div>
        <div className={styles.compactRight}>
          <div className={styles.compactPrice}>{formatCurrency(standaloneFinalPrice)}</div>
          {getStatusBadge(memberPkg.status)}
          {getRefundBadge(memberPkg)}
          <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className={styles.expandedContent}>
          <div className={styles.sessionInfo}>
            <span className={styles.sessionBadge}>{memberPkg.totalSessions} sesi</span>
            <span className={styles.sessionDivider}>•</span>
            <span className={styles.sessionUsed}>{memberPkg.usedSessions} terpakai</span>
            <span className={styles.sessionDivider}>•</span>
            <span className={styles.sessionRemaining}>{memberPkg.remainingSessions} tersisa</span>
          </div>

          {/* Notes & Discount */}
          <div className={styles.bundleNotesSection}>
            {(memberPkg.discountAmount && memberPkg.discountAmount > 0) ? (
              <div className={styles.discountInfo}>
                💰 Diskon: {(() => {
                  const discountAmount = Number(memberPkg.discountAmount);
                  const discountPercent = Number(memberPkg.discountPercent || 0);
                  
                  if (discountPercent > 0) {
                    // Calculate original price and separate percent from amount
                    const originalPrice = Number(memberPkg.finalPrice) + discountAmount;
                    const percentDiscountValue = (originalPrice * discountPercent) / 100;
                    const amountDiscountValue = discountAmount - percentDiscountValue;
                    
                    if (amountDiscountValue > 0) {
                      return `${discountPercent}% + ${formatCurrency(amountDiscountValue)}`;
                    } else {
                      return `${discountPercent}%`;
                    }
                  }
                  return formatCurrency(discountAmount);
                })()}
                {memberPkg.discountNote && ` - ${memberPkg.discountNote}`}
              </div>
            ) : null}
            {memberPkg.incentive && (
              <div className={styles.incentiveInfo}>
                🎁 Insentif Referral: {formatCurrency(memberPkg.incentive.incentiveAmount)}
                {memberPkg.incentive.incentiveType === 'PERCENTAGE' && 
                  ` (${memberPkg.incentive.incentiveValue}%)`}
                {memberPkg.incentive.referralCode && (
                  <span style={{ marginLeft: '8px', fontSize: '13px', opacity: 0.8 }}>
                    untuk {memberPkg.incentive.referralCode.referrerName} ({memberPkg.incentive.referralCode.code})
                  </span>
                )}
              </div>
            )}
            {memberPkg.notes ? (
              <div className={styles.packageNotes}>
                📝 {memberPkg.notes}
              </div>
            ) : null}
          </div>

          {/* Meta Info */}
          <div className={styles.metaInfo}>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>📍</span>
              {memberPkg.branchName}
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaIcon}>👤</span>
              {memberPkg.assignedBy}
            </div>
            {memberPkg.paidAt && (
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>💳</span>
                {new Date(memberPkg.paidAt).toLocaleDateString('id-ID')}
              </div>
            )}
          </div>

          {/* Total Price */}
          <div className={styles.bundleTotal}>
            <div className={styles.bundleTotalLabel}>Total:</div>
            <div className={styles.bundleTotalPrice}>
              {formatCurrency(standaloneFinalPrice)}
            </div>
          </div>
          {getPaymentPlanInfo(memberPkg, standaloneFinalPrice)}

          {/* Actions */}
          {(memberPkg.status === 'PENDING_PAYMENT' || memberPkg.status === 'WAITING_VERIFICATION') && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              <ViewInvoiceButton
                packageId={memberPkg.packageId}
                packageCode={memberPkg.packageCode}
                status={memberPkg.status}
                documentLabel={memberPkg.paymentPlanType === 'INSTALLMENT' && memberPkg.paymentPlanStatus === 'ACTIVE_INSTALLMENT' ? 'Lihat Invoice' : undefined}
              />
              {onVerifyPayment && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVerifyPayment(memberPkg.packageId, memberPkg.status, memberPkg.paymentProofUrl, memberPkg.paymentProofFileName);
                }}
                className={styles.verifyButton}
                style={{ marginTop: 0 }}
              >
                ✅ Verify Payment
              </button>
              )}
              {onEditPackage && canEditStandalonePackage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPackage(
                      memberPkg.purchaseGroupId || memberPkg.packageId,
                      [memberPkg],
                      [],
                      Number(memberPkg.discountAmount || 0),
                      Number(memberPkg.discountPercent || 0),
                      memberPkg.discountNote || '',
                      memberPkg.notes || ''
                    );
                  }}
                  className={styles.editButton}
                >
                  Edit Paket
                </button>
              )}
              {onCancelPackage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelPackage(memberPkg.packageId, memberPkg.packageCode);
                  }}
                  className={styles.cancelButton}
                >
                  ❌ Batalkan
                </button>
              )}
            </div>
          )}

          {memberPkg.status === 'ACTIVE' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <ViewInvoiceButton
                packageId={memberPkg.packageId}
                packageCode={memberPkg.packageCode}
                status={memberPkg.status}
                documentLabel={memberPkg.paymentPlanType === 'INSTALLMENT' && memberPkg.paymentPlanStatus === 'ACTIVE_INSTALLMENT' ? 'Lihat Invoice' : undefined}
              />
              <ViewPaymentProofButton
                packageId={memberPkg.packageId}
                packageCode={memberPkg.packageCode}
                status={memberPkg.status}
              />
              {onVerifyPayment && memberPkg.paymentPlanType === 'INSTALLMENT' && memberPkg.paymentPlanStatus === 'ACTIVE_INSTALLMENT' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyPayment(memberPkg.packageId, memberPkg.status, memberPkg.paymentProofUrl, memberPkg.paymentProofFileName);
                  }}
                  className={styles.verifyButton}
                  style={{ marginTop: 0 }}
                >
                  ✅ Verify Termin Berikutnya
                </button>
              )}
              {onEditPackage && canEditStandalonePackage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPackage(
                      memberPkg.purchaseGroupId || memberPkg.packageId,
                      [memberPkg],
                      [],
                      Number(memberPkg.discountAmount || 0),
                      Number(memberPkg.discountPercent || 0),
                      memberPkg.discountNote || '',
                      memberPkg.notes || ''
                    );
                  }}
                  className={styles.editButton}
                >
                  Edit Paket
                </button>
              )}
              {onRefundPackage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefundPackage(memberPkg.packageId, memberPkg.packageCode, standaloneFinalPrice);
                  }}
                  className={styles.refundButton}
                >
                  💰 Refund
                </button>
              )}
            </div>
          )}

          {memberPkg.status === 'EXPIRED' && (
            <div className={styles.invoiceButtonWrapper}>
              <ViewInvoiceButton
                packageId={memberPkg.packageId}
                packageCode={memberPkg.packageCode}
                status={memberPkg.status}
              />
              <ViewPaymentProofButton
                packageId={memberPkg.packageId}
                packageCode={memberPkg.packageCode}
                status={memberPkg.status}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
