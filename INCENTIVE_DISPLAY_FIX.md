# Incentive Display Fix - Investigation & Implementation

## Date: April 30, 2026

## Issue Report
User reported:
1. One package for member MBR-PST-0021 (Tark) shows incorrect incentive amount
2. Need to display percentage value when incentive type is PERCENTAGE

## Investigation Results

### Database Check
Ran `check-tark-incentive-detail.ts` script to investigate member MBR-PST-0021's incentive records.

**Finding: ALL INCENTIVE AMOUNTS ARE CORRECT** ✅

All 11 packages for member MBR-PST-0021 have correct incentive calculations:
- Package 1 (BASIC): Rp 10.000.000 × 20% = Rp 2.000.000 ✓
- Package 2 (BASIC): Rp 11.250.000 × 20% = Rp 2.250.000 ✓
- Package 3-6 (BOOSTER): Rp 800.000 × 20% = Rp 160.000 each ✓
- Package 7 (BASIC): Rp 10.000.000 × 20% = Rp 2.000.000 ✓
- Package 8 (BOOSTER): Rp 896.500 × 20% = Rp 179.300 ✓
- Package 9-10 (BOOSTER): Rp 900.000 × 20% = Rp 180.000 each ✓
- Package 11 (BASIC - First): Rp 5.000.000 (FIXED_AMOUNT) ✓

**Conclusion**: No incorrect incentive amounts found. User may have been confused about which package they were looking at or the calculation method.

## Implementation: Add Percentage Display

### Changes Made

#### 1. Backend - Add incentiveValue to API Response
**File**: `apps/api/src/modules/packages/services/package-retrieval.service.ts`

Added `incentiveValue` field to the incentive object in `formatPackageData()`:

```typescript
incentive: incentiveRecord ? {
  incentiveAmount: Number(incentiveRecord.incentiveAmount),
  incentiveType: incentiveRecord.incentiveType,
  incentiveValue: Number(incentiveRecord.incentiveValue), // ← ADDED
  referralCode: incentiveRecord.referralCode ? {
    code: incentiveRecord.referralCode.code,
    referrerName: incentiveRecord.referrerName,
    referrerType: incentiveRecord.referrerType,
  } : null,
  createdAt: incentiveRecord.createdAt.toISOString(),
} : undefined,
```

#### 2. Frontend - Update Type Definition
**File**: `apps/web/src/types/package.ts`

Added `incentiveValue` field to MemberPackage interface:

```typescript
incentive?: {
  incentiveAmount: number;
  incentiveType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  incentiveValue: number; // ← ADDED
  referralCode: {
    code: string;
    referrerName: string;
    referrerType: 'MEMBER' | 'STAFF' | 'EXTERNAL';
  } | null;
  createdAt: string;
};
```

#### 3. Frontend - Update Display Component
**File**: `apps/web/src/components/members/PackageCard.tsx`

Updated incentive display in TWO locations:

**A. Bundle Package Section** (line ~360):
```typescript
{packageWithIncentive?.incentive && (
  <div className={styles.incentiveInfo}>
    🎁 Insentif Referral: {formatCurrency(packageWithIncentive.incentive.incentiveAmount)}
    {packageWithIncentive.incentive.incentiveType === 'PERCENTAGE' && 
      ` (${packageWithIncentive.incentive.incentiveValue}%)`}  // ← CHANGED
    {packageWithIncentive.incentive.referralCode && (
      <span style={{ marginLeft: '8px', fontSize: '13px', opacity: 0.8 }}>
        untuk {packageWithIncentive.incentive.referralCode.referrerName} ({packageWithIncentive.incentive.referralCode.code})
      </span>
    )}
  </div>
)}
```

**B. Standalone Package Section** (line ~520):
```typescript
{memberPkg.incentive && (
  <div className={styles.incentiveInfo}>
    🎁 Insentif Referral: {formatCurrency(memberPkg.incentive.incentiveAmount)}
    {memberPkg.incentive.incentiveType === 'PERCENTAGE' && 
      ` (${memberPkg.incentive.incentiveValue}%)`}  // ← CHANGED
    {memberPkg.incentive.referralCode && (
      <span style={{ marginLeft: '8px', fontSize: '13px', opacity: 0.8 }}>
        untuk {memberPkg.incentive.referralCode.referrerName} ({memberPkg.incentive.referralCode.code})
      </span>
    )}
  </div>
)}
```

### Display Format Examples

**Before**:
- `🎁 Insentif Referral: Rp 800.000 (%) untuk Joko Widodo (REF-007)`

**After**:
- `🎁 Insentif Referral: Rp 800.000 (20%) untuk Joko Widodo (REF-007)`
- `🎁 Insentif Referral: Rp 5.000.000 untuk Joko Widodo (REF-007)` (FIXED_AMOUNT - no percentage shown)

## Testing

### How to Test
1. Navigate to Admin Layanan → Member Detail → MBR-PST-0021 (Tark)
2. Expand any package card in the Paket Member section
3. Look for the incentive info line (🎁 Insentif Referral)
4. Verify:
   - Amount is displayed correctly
   - Percentage value is shown for PERCENTAGE type incentives (e.g., "Rp 800.000 (20%)")
   - No percentage shown for FIXED_AMOUNT type incentives
   - Referrer name and code are displayed

### Expected Results
- All packages with PERCENTAGE incentive type show: `Rp XXX (YY%)`
- All packages with FIXED_AMOUNT incentive type show: `Rp XXX` (no percentage)
- All incentive amounts match the database values (verified correct)

## Files Modified
1. `apps/api/src/modules/packages/services/package-retrieval.service.ts` - Added incentiveValue to API response
2. `apps/web/src/types/package.ts` - Added incentiveValue to type definition
3. `apps/web/src/components/members/PackageCard.tsx` - Updated display to show percentage value

## Status
✅ **COMPLETED**
- Investigation completed - all incentive amounts are correct
- Backend updated to include incentiveValue in API response
- Frontend type definition updated
- Display component updated to show percentage value
- API server restarted successfully
