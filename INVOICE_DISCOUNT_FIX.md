# Invoice Discount Calculation Fix

## Problem
Diskon pada invoice pembayaran paket member hanya dihitung dari harga paket basic, bukan dari total subtotal (basic + booster + addon).

### Example
Member MBR-PST-0021 membeli:
- Paket Basic 7x sesi: Rp 12.500.000
- Paket Booster HHO 3x: Rp 3.000.000
- Add-On Air Nano: Rp 35.000
- **Subtotal: Rp 15.535.000**

Dengan diskon 10%, seharusnya:
- Diskon: 10% × Rp 15.535.000 = **Rp 1.553.500**

Tapi yang tersimpan di invoice:
- Diskon: 10% × Rp 12.500.000 = **Rp 1.250.000** ❌

**Selisih: Rp 303.500**

## Root Cause
Di file `apps/api/src/modules/packages/services/invoice-generation.service.ts`, diskon hanya diambil dari paket pertama (`packages[0].discountAmount`), bukan dari total semua paket.

```typescript
// OLD CODE (WRONG)
const packageDiscountAmount = Number(packages[0].discountAmount || 0);
const discountAmount = packageDiscountAmount;
```

Padahal setiap paket sudah memiliki diskon yang didistribusikan secara proporsional. Jadi kita perlu menjumlahkan semua diskon dari semua paket.

## Solution
Menjumlahkan diskon dari semua paket, bukan hanya mengambil dari paket pertama.

```typescript
// NEW CODE (CORRECT)
let totalPackageDiscount = 0;
for (const pkg of packages) {
  totalPackageDiscount += Number(pkg.discountAmount || 0);
}
const discountAmount = totalPackageDiscount;
```

## Files Changed
1. `apps/api/src/modules/packages/services/invoice-generation.service.ts`
   - Updated discount calculation to sum all package discounts

## Data Migration
Script `apps/api/fix-invoice-discount.ts` telah dijalankan untuk memperbaiki 16 invoice yang sudah ada di database.

### Summary
- **Fixed**: 16 invoices
- **Skipped**: 0 invoices (all had incorrect discount)

## Testing
1. **Existing Invoice Verification**
   - Script: `apps/api/check-invoice-discount.ts`
   - Verified invoice INV-PST-2604-0011 now has correct discount

2. **Logic Comparison Test**
   - Script: `apps/api/test-new-invoice-discount-simple.ts`
   - Shows difference between old and new logic
   - Confirms new logic matches expected calculation

## Impact
- ✅ Invoice baru akan memiliki perhitungan diskon yang benar
- ✅ Invoice lama sudah diperbaiki
- ✅ Total pembayaran sekarang akurat
- ✅ Diskon dihitung dari total subtotal (basic + booster + addon)

## Date
April 30, 2026
