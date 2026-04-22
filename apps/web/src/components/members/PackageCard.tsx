import type { PackageDisplay, MemberPackage } from '@/types/package';
import ViewInvoiceButton from '../invoices/ViewInvoiceButton';
import { formatNumberWithDots, formatCurrency } from '@/lib/formatNumber';
import styles from './MemberPackagesTab.module.css';

interface PackageCardProps {
  pkg: PackageDisplay;
  onVerifyPayment: (packageId: string) => void;
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
            'PM': 'Premiere',
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
            'PM': 'Premiere',
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

export default function PackageCard({ pkg, onVerifyPayment }: PackageCardProps) {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING_PAYMENT: 'pending',
      ACTIVE: 'active',
      EXPIRED: 'expired',
      CANCELLED: 'cancelled'
    };
    
    const statusText: Record<string, string> = {
      PENDING_PAYMENT: 'Pending Payment',
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

  const isGroup = 'isGroup' in pkg && pkg.isGroup;
  const isAddOn = 'isAddOn' in pkg && pkg.isAddOn;

  // Helper to calculate original price (before discount)
  const getOriginalPrice = (pkg: MemberPackage) => {
    return pkg.finalPrice + (pkg.discountAmount || 0);
  };

  // Standalone Add-On
  if (isAddOn && !isGroup) {
    const addon = pkg as any; // Type assertion for add-on
    return (
      <div className={styles.packageCard}>
        <div className={styles.packageHeader}>
          <div className={styles.packageInfo}>
            <div className={styles.packageTitle}>
              <span className={styles.packageIcon}>✨</span>
              Add-On: {addon.notes?.split('(')[0]?.trim() || addon.addOnCode}
            </div>
            <div className={styles.packageCode}>{addon.addOnCode}</div>
          </div>
          {getStatusBadge(addon.status)}
        </div>

        <div className={styles.sessionInfo}>
          <span className={styles.sessionBadge}>Qty: {addon.quantity}</span>
          <span className={styles.sessionDivider}>•</span>
          <span className={styles.sessionUsed}>@ {formatCurrency(addon.pricePerUnit)}</span>
        </div>

        <div className={styles.packagePrice}>
          {formatCurrency(addon.totalPrice)}
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

        <div className={styles.bundleTotal}>
          <div className={styles.bundleTotalLabel}>Total:</div>
          <div className={styles.bundleTotalPrice}>
            {formatCurrency(addon.totalPrice)}
          </div>
        </div>

        {addon.status === 'PENDING_PAYMENT' && (
          <button
            onClick={() => onVerifyPayment(addon.addOnId)}
            className={styles.verifyButton}
          >
            ✅ Verify Payment
          </button>
        )}
      </div>
    );
  }

  if (isGroup) {
    // Bundle Package
    const basics = pkg.basics || (pkg.basic ? [pkg.basic] : []);
    const boosters = pkg.boosters || (pkg.booster ? [pkg.booster] : []);
    const groupAddOns = pkg.addOns || [];
    const groupStatus = basics[0]?.status || boosters[0]?.status || groupAddOns[0]?.status;
    const anyPending = basics.some(p => p?.status === 'PENDING_PAYMENT') || boosters.some(p => p?.status === 'PENDING_PAYMENT') || groupAddOns.some(a => a?.status === 'PENDING_PAYMENT');
    const anyActive = basics.some(p => p?.status === 'ACTIVE') || boosters.some(p => p?.status === 'ACTIVE') || groupAddOns.some(a => a?.status === 'ACTIVE');
    
    // Calculate total prices for all packages and add-ons
    const totalBasicPrice = basics.reduce((sum: number, p: MemberPackage | undefined) => sum + (p ? getOriginalPrice(p) : 0), 0);
    const totalBoosterPrice = boosters.reduce((sum: number, p: MemberPackage | undefined) => sum + (p ? getOriginalPrice(p) : 0), 0);
    const totalAddOnPrice = groupAddOns.reduce((sum: number, a: any) => sum + (a?.totalPrice || 0), 0);
    const totalFinalPrice = basics.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.finalPrice || 0), 0) + boosters.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.finalPrice || 0), 0) + totalAddOnPrice;
    const totalBasicSessions = basics.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.totalSessions || 0), 0);
    const totalBoosterSessions = boosters.reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.totalSessions || 0), 0);

    return (
      <div className={`${styles.packageCard} ${styles.bundleCard}`}>
        <div className={styles.bundleBadge}>
          <span className={styles.bundleIcon}>📦</span>
          Paket Bundling
          {basics.length > 0 && <span style={{ marginLeft: '8px' }}>• {basics.length} BASIC</span>}
          {boosters.length > 0 && <span style={{ marginLeft: '8px' }}>• {boosters.length} BOOSTER</span>}
          {groupAddOns.length > 0 && <span style={{ marginLeft: '8px' }}>• {groupAddOns.length} ADD-ON</span>}
        </div>

        {/* Basic Packages */}
        {basics.length > 0 && (
          <div className={`${styles.packageSection} ${styles.basicSection}`}>
            <div className={styles.packageHeader}>
              <div className={styles.packageInfo}>
                <div className={styles.packageTitle}>
                  <span className={styles.packageIcon}>📦</span>
                  {getTherapyName(basics[0].productCode, basics[0].packageCode, basics[0].packageType)}
                  {basics.length > 1 && <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-primary-400)' }}>x{basics.length}</span>}
                </div>
                <div className={styles.packageCode}>{basics[0].packageCode}{basics.length > 1 && ` (+${basics.length - 1} lainnya)`}</div>
              </div>
              {getStatusBadge(basics[0].status)}
            </div>
            
            <div className={styles.sessionInfo}>
              <span className={styles.sessionBadge}>{totalBasicSessions} sesi total</span>
              <span className={styles.sessionDivider}>•</span>
              <span className={styles.sessionUsed}>{basics.reduce((sum: number, p: MemberPackage) => sum + p.usedSessions, 0)} terpakai</span>
              <span className={styles.sessionDivider}>•</span>
              <span className={styles.sessionRemaining}>{basics.reduce((sum: number, p: MemberPackage) => sum + p.remainingSessions, 0)} tersisa</span>
            </div>
            
            <div className={styles.packagePrice}>
              {formatCurrency(totalBasicPrice)}
            </div>
          </div>
        )}

        {/* Booster Packages */}
        {boosters.length > 0 && (
          <div className={`${styles.packageSection} ${styles.boosterSection}`}>
            <div className={styles.packageHeader}>
              <div className={styles.packageInfo}>
                <div className={styles.packageTitle}>
                  <span className={styles.packageIcon}>🚀</span>
                  {getTherapyName(boosters[0].productCode, boosters[0].packageCode, boosters[0].packageType)}
                  {boosters.length > 1 && <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: '700', color: 'var(--color-primary-400)' }}>x{boosters.length}</span>}
                </div>
                <div className={styles.packageCode}>
                  {boosters[0].packageCode}{boosters.length > 1 && ` (+${boosters.length - 1} lainnya)`}
                </div>
              </div>
              {getStatusBadge(boosters[0].status)}
            </div>
            
            <div className={styles.sessionInfo}>
              <span className={styles.sessionBadge}>{totalBoosterSessions} sesi total</span>
              <span className={styles.sessionDivider}>•</span>
              <span className={styles.sessionUsed}>{boosters.reduce((sum: number, p: MemberPackage) => sum + p.usedSessions, 0)} terpakai</span>
              <span className={styles.sessionDivider}>•</span>
              <span className={styles.sessionRemaining}>{boosters.reduce((sum: number, p: MemberPackage) => sum + p.remainingSessions, 0)} tersisa</span>
            </div>
            
            <div className={`${styles.packagePrice} ${styles.boosterPrice}`}>
              {formatCurrency(totalBoosterPrice)}
            </div>
          </div>
        )}

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
                  {groupAddOns.map((a: any) => a.addOnCode).join(', ')}
                </div>
              </div>
              {getStatusBadge(groupAddOns[0].status)}
            </div>
            
            <div className={styles.sessionInfo}>
              {groupAddOns.map((addon: any, idx: number) => (
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
            // For bundles, sum discount from all packages
            const totalDiscount = [...basics, ...boosters].reduce((sum: number, p: MemberPackage | undefined) => sum + (p?.discountAmount || 0), 0);
            const discountPercent = basics[0]?.discountPercent || boosters[0]?.discountPercent || 0;
            const discountNote = basics[0]?.discountNote || boosters[0]?.discountNote;
            
            return totalDiscount > 0 ? (
              <div className={styles.discountInfo}>
                💰 Diskon: {formatCurrency(totalDiscount)}
                {discountPercent > 0 && ` (${discountPercent}%)`}
                {discountNote && ` - ${discountNote}`}
              </div>
            ) : null;
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

        {/* Actions */}
        {anyPending && (
          <button
            onClick={() => onVerifyPayment(basics[0]?.packageId || boosters[0]?.packageId || '')}
            className={styles.verifyButton}
          >
            ✅ Verify Payment (Bundle)
          </button>
        )}
        
        {anyActive && (
          <div className={styles.invoiceButtonWrapper}>
            <ViewInvoiceButton
              packageId={basics[0]?.packageId || boosters[0]?.packageId || ''}
              packageCode={`${basics.map((p: MemberPackage) => p?.packageCode).join(', ')} + ${boosters.map((p: MemberPackage) => p?.packageCode).join(', ')}`}
              status={groupStatus || 'ACTIVE'}
            />
          </div>
        )}
      </div>
    );
  } else {
    // Standalone Package (not add-on, not grouped)
    if (isAddOn) {
      // This shouldn't happen - add-ons are handled above
      return null;
    }
    
    const memberPkg = pkg as MemberPackage;
    const standaloneOriginalPrice = getOriginalPrice(memberPkg);
    const standaloneFinalPrice = memberPkg.finalPrice;
    
    return (
      <div className={styles.packageCard}>
        <div className={styles.packageHeader}>
          <div className={styles.packageInfo}>
            <div className={styles.packageTitle}>
              <span className={styles.packageIcon}>
                {memberPkg.packageType === 'BASIC' ? '📦' : '🚀'}
              </span>
              {getTherapyName(memberPkg.productCode, memberPkg.packageCode, memberPkg.packageType)}
            </div>
            <div className={styles.packageCode}>
              {memberPkg.packageCode}
            </div>
          </div>
          {getStatusBadge(memberPkg.status)}
        </div>

        <div className={styles.sessionInfo}>
          <span className={styles.sessionBadge}>{memberPkg.totalSessions} sesi</span>
          <span className={styles.sessionDivider}>•</span>
          <span className={styles.sessionUsed}>{memberPkg.usedSessions} terpakai</span>
          <span className={styles.sessionDivider}>•</span>
          <span className={styles.sessionRemaining}>{memberPkg.remainingSessions} tersisa</span>
        </div>

        <div className={styles.packagePrice}>
          {formatCurrency(standaloneOriginalPrice)}
        </div>

        {/* Notes & Discount */}
        <div className={styles.bundleNotesSection}>
          {(memberPkg.discountAmount && memberPkg.discountAmount > 0) ? (
            <div className={styles.discountInfo}>
              💰 Diskon: {formatCurrency(memberPkg.discountAmount)}
              {memberPkg.discountPercent && memberPkg.discountPercent > 0 && ` (${memberPkg.discountPercent}%)`}
              {memberPkg.discountNote && ` - ${memberPkg.discountNote}`}
            </div>
          ) : null}
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
          <div className={styles.bundleTotalLabel}>Total Bundling:</div>
          <div className={styles.bundleTotalPrice}>
            {formatCurrency(standaloneFinalPrice)}
          </div>
        </div>

        {/* Actions */}
        {memberPkg.status === 'PENDING_PAYMENT' && (
          <button
            onClick={() => onVerifyPayment(memberPkg.packageId)}
            className={styles.verifyButton}
          >
            ✅ Verify Payment
          </button>
        )}

        {(memberPkg.status === 'ACTIVE' || memberPkg.status === 'EXPIRED') && (
          <div className={styles.invoiceButtonWrapper}>
            <ViewInvoiceButton
              packageId={memberPkg.packageId}
              packageCode={memberPkg.packageCode}
              status={memberPkg.status}
            />
          </div>
        )}
      </div>
    );
  }
}
