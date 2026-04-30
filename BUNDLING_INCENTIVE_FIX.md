# Perbaikan Perhitungan Insentif Bundling

## Tanggal: 30 April 2026

## Masalah
Perhitungan insentif referral hanya dihitung dari harga paket BASIC saja, bukan dari total bundling (BASIC + BOOSTER + ADD-ON).

### Contoh Kasus
Member MBR-PST-0021 membeli bundling:
- 1 BASIC: Rp 10.000.000
- 4 BOOSTER: Rp 3.200.000 (4 × Rp 800.000)
- **Total Bundling: Rp 13.200.000**

**Sebelum perbaikan:**
- Insentif dihitung dari BASIC saja: Rp 10.000.000 × 20% = **Rp 2.000.000** ❌

**Setelah perbaikan:**
- Insentif dihitung dari total bundling: Rp 13.200.000 × 20% = **Rp 2.640.000** ✅

## Penyebab Masalah

### 1. Logika Perhitungan Salah
**File**: `apps/api/src/modules/referrals/incentive-calculation.service.ts`

Fungsi `calculateAndRecordIncentive()` dipanggil untuk **setiap paket secara individual**, sehingga:
- Setiap paket dalam bundling mendapat insentif terpisah
- Insentif dihitung dari `memberPackage.finalPrice` (harga 1 paket saja)
- Tidak memperhitungkan total bundling

### 2. Duplikasi Record
Karena fungsi dipanggil untuk setiap paket, terjadi duplikasi:
- Bundle dengan 1 BASIC + 4 BOOSTER = 5 incentive records (seharusnya 1)
- Total insentif salah karena dijumlahkan dari paket-paket individual

## Solusi Implementasi

### 1. Update Logika Perhitungan Insentif

**File**: `apps/api/src/modules/referrals/incentive-calculation.service.ts`

#### A. Cek Duplikasi untuk Bundle
```typescript
// If this package is part of a bundle (has purchaseGroupId), 
// check if incentive already created for this group
if (memberPackage.purchaseGroupId) {
  const existingGroupIncentive = await db.referralIncentiveRecord.findFirst({
    where: {
      memberPackage: {
        purchaseGroupId: memberPackage.purchaseGroupId,
      },
    },
  });

  // If incentive already exists for this bundle, skip creating duplicate
  if (existingGroupIncentive) {
    logger.info(
      `[IncentiveCalculation] Incentive already exists for bundle ${memberPackage.purchaseGroupId}, skipping`
    );
    return null;
  }
}
```

#### B. Hitung Total Bundling
```typescript
// Calculate package value for incentive
// If part of a bundle, sum all packages in the same purchaseGroupId
let packageValue: number;
let packageName: string;

if (memberPackage.purchaseGroupId) {
  // Get all packages in this bundle
  const bundlePackages = await db.memberPackage.findMany({
    where: {
      purchaseGroupId: memberPackage.purchaseGroupId,
    },
  });

  // Sum all finalPrice in the bundle
  packageValue = bundlePackages.reduce((sum, pkg) => sum + Number(pkg.finalPrice), 0);
  
  const basicCount = bundlePackages.filter(p => p.packageType === 'BASIC').length;
  const boosterCount = bundlePackages.filter(p => p.packageType === 'BOOSTER').length;
  packageName = `Bundle (${basicCount} BASIC + ${boosterCount} BOOSTER)`;
  
  logger.info(
    `[IncentiveCalculation] Calculating incentive for bundle ${memberPackage.purchaseGroupId}: ` +
      `${bundlePackages.length} packages, total value Rp ${packageValue}`
  );
} else {
  // Standalone package
  packageValue = Number(memberPackage.finalPrice);
  packageName = `${memberPackage.packageType} - ${memberPackage.totalSessions}x`;
}
```

#### C. Hitung Insentif dari Total Bundling
```typescript
// Calculate incentive amount
let incentiveAmount: number;
if (incentiveType === IncentiveType.PERCENTAGE) {
  incentiveAmount = (packageValue * Number(incentiveValue)) / 100;
} else {
  // FIXED_AMOUNT
  incentiveAmount = Number(incentiveValue);
}

// Round to nearest integer (no decimal)
incentiveAmount = Math.round(incentiveAmount);
```

#### D. Update Penentuan First Package
```typescript
// Count how many purchase groups this member has (to determine if first package)
// For bundled packages, count unique purchaseGroupIds
// For standalone packages, count packages without purchaseGroupId
const existingGroups = await db.memberPackage.findMany({
  where: {
    memberId: memberPackage.memberId,
    status: {
      in: ['ACTIVE', 'PENDING_PAYMENT'],
    },
  },
  select: {
    purchaseGroupId: true,
  },
});

// Get unique purchase groups (including null for standalone)
const uniqueGroups = new Set(existingGroups.map(p => p.purchaseGroupId || 'standalone'));
const isFirstPackage = uniqueGroups.size === 1;
```

### 2. Script Perbaikan Data Existing

**File**: `apps/api/fix-bundling-incentive.ts`

Script ini memperbaiki data insentif yang sudah ada di database:

#### Fungsi Script:
1. **Identifikasi Bundle Groups**: Kelompokkan incentive records berdasarkan `purchaseGroupId`
2. **Hitung Total Bundling**: Sum semua `finalPrice` dalam bundle yang sama
3. **Update Record Pertama**: Update dengan nilai yang benar (total bundling)
4. **Hapus Duplikat**: Hapus incentive records duplikat untuk paket lain dalam bundle yang sama
5. **Update Statistik**: Sesuaikan `totalIncentiveEarned` di referral code

#### Hasil Eksekusi:
```
📊 Summary:
   Fixed records: 3
   Deleted duplicate records: 10
   Total bundle groups processed: 3
```

## Hasil Perbaikan

### Bundle 1: GRP-1777522191761-K7FQDO7 (First Package)
- **Paket**: 1 BASIC + 3 BOOSTER
- **Total Bundling**: Rp 13.946.500
- **Incentive Type**: FIXED_AMOUNT Rp 5.000.000
- **Sebelum**: Rp 5.000.000 (sudah benar, karena FIXED_AMOUNT)
- **Sesudah**: Rp 5.000.000 ✓
- **Duplikat dihapus**: 3 records

### Bundle 2: GRP-1777525477535-571QMYS
- **Paket**: 1 BASIC + 4 BOOSTER
- **Total Bundling**: Rp 13.200.000
- **Incentive Type**: PERCENTAGE 20%
- **Sebelum**: Rp 2.000.000 (hanya dari BASIC Rp 10.000.000) ❌
- **Sesudah**: Rp 2.640.000 (dari total Rp 13.200.000) ✅
- **Selisih**: +Rp 640.000
- **Duplikat dihapus**: 4 records

### Bundle 3: GRP-1777532184775-KV04LLZ
- **Paket**: 1 BASIC + 3 BOOSTER
- **Total Bundling**: Rp 13.948.000
- **Incentive Type**: PERCENTAGE 20%
- **Sebelum**: Rp 2.250.000 (hanya dari BASIC Rp 11.250.000) ❌
- **Sesudah**: Rp 2.789.600 (dari total Rp 13.948.000) ✅
- **Selisih**: +Rp 539.600
- **Duplikat dihapus**: 3 records

## Verifikasi

### Sebelum Perbaikan
```
Bundle GRP-1777525477535-571QMYS:
- Total: Rp 13.200.000
- Insentif: Rp 2.000.000 (hanya dari BASIC)
- 5 incentive records (duplikat)
```

### Setelah Perbaikan
```
Bundle GRP-1777525477535-571QMYS:
- Total: Rp 13.200.000
- Insentif: Rp 2.640.000 (dari total bundling)
- 1 incentive record (duplikat dihapus)
```

## Dampak

### Untuk Paket Baru
- ✅ Insentif otomatis dihitung dari total bundling
- ✅ Tidak ada duplikasi incentive records
- ✅ Hanya 1 record per bundle

### Untuk Paket Existing
- ✅ Data sudah diperbaiki dengan script
- ✅ Duplikat sudah dihapus
- ✅ Statistik referral code sudah disesuaikan

## Testing

### Cara Test
1. Buat member baru dengan referral code
2. Assign paket bundling (1 BASIC + beberapa BOOSTER)
3. Cek incentive record di database
4. Verifikasi:
   - Hanya ada 1 incentive record untuk bundle
   - `packageValue` = total semua paket dalam bundle
   - `incentiveAmount` dihitung dari total bundling
   - `packageName` menunjukkan "Bundle (X BASIC + Y BOOSTER)"

### Query Verifikasi
```sql
-- Cek incentive untuk bundle tertentu
SELECT 
  rir.*,
  mp.purchaseGroupId,
  mp.packageCode,
  mp.finalPrice
FROM referral_incentive_records rir
JOIN member_packages mp ON mp.id = rir."memberPackageId"
WHERE mp."purchaseGroupId" = 'GRP-1777525477535-571QMYS';

-- Cek total bundling
SELECT 
  "purchaseGroupId",
  COUNT(*) as package_count,
  SUM("finalPrice") as total_bundling
FROM member_packages
WHERE "purchaseGroupId" = 'GRP-1777525477535-571QMYS'
GROUP BY "purchaseGroupId";
```

## Files Modified
1. `apps/api/src/modules/referrals/incentive-calculation.service.ts` - Update logika perhitungan
2. `apps/api/fix-bundling-incentive.ts` - Script perbaikan data existing

## Status
✅ **COMPLETED**
- Logika perhitungan insentif sudah diperbaiki
- Data existing sudah diperbaiki dengan script
- Duplikat records sudah dihapus
- Statistik referral code sudah disesuaikan
- API server sudah direstart
- Verifikasi berhasil
