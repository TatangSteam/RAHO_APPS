# Fix: Bundle Incentive Calculation Error

**Date**: 13 Mei 2026  
**Issue**: Perhitungan insentif referral salah ketika ada bundle dengan diskon

## Problem

Ketika member membeli bundle (multiple packages) dengan diskon, perhitungan insentif referral menggunakan nilai yang salah.

### Contoh Kasus:
- **Terapi Nano Bubble 7X Premiere**: Rp 12.500.000
- **Booster H2S 1X Premiere**: Rp 1.000.000
- **Subtotal**: Rp 13.500.000
- **Diskon**: 20% + Rp 2.000.000 = Rp 4.700.000
- **Total Bundling**: Rp 8.800.000
- **Insentif 15%**: Seharusnya Rp 1.320.000

**Yang Terjadi**:
- Insentif dihitung: Rp 1.222.222 (dari Rp 8.148.148) ❌
- Seharusnya: Rp 1.320.000 (dari Rp 8.800.000) ✅

## Root Cause

Di `package-assignment.service.ts`, function `calculateAndRecordIncentive()` dipanggil **di dalam loop** saat membuat setiap paket:

```typescript
// BEFORE (WRONG)
for (const detail of params.packageDetails) {
  for (let i = 0; i < detail.quantity; i++) {
    const memberPackage = await tx.memberPackage.create({ ... });
    
    // ❌ Dipanggil untuk setiap paket
    await calculateAndRecordIncentive(memberPackage.id, tx);
  }
}
```

**Masalah**: Ketika paket pertama dibuat, incentive langsung dihitung. Tapi pada saat itu, paket kedua belum dibuat, jadi query untuk menghitung total bundle hanya menemukan 1 paket.

## Solution

Pindahkan pemanggilan `calculateAndRecordIncentive()` ke **SETELAH semua paket selesai dibuat**:

```typescript
// AFTER (CORRECT)
for (const detail of params.packageDetails) {
  for (let i = 0; i < detail.quantity; i++) {
    const memberPackage = await tx.memberPackage.create({ ... });
    createdPackages.push(memberPackage);
    // ✅ Tidak langsung hitung incentive
  }
}

// ✅ Hitung incentive SETELAH semua paket dibuat
if (createdPackages.length > 0) {
  await calculateAndRecordIncentive(createdPackages[0].id, tx);
}
```

## Files Changed

1. **`apps/api/src/modules/packages/services/package-assignment.service.ts`**
   - Moved `calculateAndRecordIncentive()` call outside the loop
   - Now called once after all packages are created

2. **`apps/api/src/modules/referrals/incentive-calculation.service.ts`**
   - Added detailed logging for debugging
   - Added verification that packageValue matches sum of all finalPrice

## Data Migration

Created script to fix existing incorrect data:
- **Script**: `apps/api/scripts/fix-bundle-incentive-calculation.ts`
- **Check Script**: `apps/api/scripts/check-incentive-calculation.ts`

### Running the Fix:
```bash
cd apps/api
npx tsx scripts/fix-bundle-incentive-calculation.ts
```

### Verifying the Fix:
```bash
cd apps/api
npx tsx scripts/check-incentive-calculation.ts
```

## Impact

- ✅ Future bundle purchases will calculate incentive correctly
- ✅ Existing incorrect data has been fixed
- ✅ Referral code statistics updated with correct amounts

## Testing

1. Create a new bundle purchase with discount
2. Verify incentive is calculated from total bundle price (after discount)
3. Check that incentive record shows correct packageValue
4. Verify referral code totalIncentiveEarned is updated correctly

## Notes

- The fix ensures incentive is calculated based on the **final price after discount**
- For bundles, the packageValue is the **sum of all finalPrice** in the bundle
- The incentive calculation service already had the correct logic, the issue was timing
