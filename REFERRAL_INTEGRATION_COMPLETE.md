# Referral Incentive System - Integration Complete ✅

## Overview
Sistem referral incentive telah berhasil diintegrasikan dengan package assignment flow. Sekarang setiap kali member dengan referral code membeli paket, sistem akan otomatis menghitung dan mencatat insentif.

---

## ✅ Completed Features

### 1. **Auto-Calculate Incentive on Package Purchase**
- **File**: `apps/api/src/modules/referrals/incentive-calculation.service.ts`
- **Functions**:
  - `calculateAndRecordIncentive()` - Menghitung dan mencatat insentif saat paket dibuat
  - `recalculateIncentiveOnStatusChange()` - Recalculate saat status berubah
  - `deleteIncentiveOnCancel()` - Hapus insentif saat paket dibatalkan

**Logic**:
- Cek apakah member punya referral code
- Hitung jumlah paket yang sudah dimiliki member
- Tentukan apakah ini paket pertama atau lanjutan
- Gunakan rate insentif yang sesuai (first vs next)
- Hitung insentif berdasarkan tipe (PERCENTAGE atau FIXED_AMOUNT)
- Simpan ke `ReferralIncentiveRecord`
- Update statistik di `ReferralCode` (totalReferrals, totalIncentiveEarned)

### 2. **Integration with Package Assignment**
- **File**: `apps/api/src/modules/packages/services/package-assignment.service.ts`
- **Changes**:
  - Import `calculateAndRecordIncentive`
  - Call incentive calculation setelah setiap package dibuat
  - Wrapped dalam try-catch agar tidak fail transaction jika ada error

**Flow**:
```
Member beli paket → Package created → Calculate incentive → Record incentive → Update referral stats
```

### 3. **Member Registration with Referral Code**
- **File**: `apps/api/src/modules/members/services/member-registration.service.ts`
- **Changes**:
  - Added `referralCodeId` parameter
  - Validate referral code saat member dibuat
  - Link member ke referral code

### 4. **Frontend: Referral Code Dropdown in Member Form**
- **File**: `apps/web/src/components/branches/MemberCrudModal.tsx`
- **Changes**:
  - Import `getActiveReferrals` API
  - Fetch active referral codes on modal open
  - Added referral code dropdown (only for create action)
  - Display: `{code} - {referrerName} ({referrerType})`

---

## 📊 Database Schema

### ReferralCode
```prisma
model ReferralCode {
  id                    String
  code                  String @unique
  referrerName          String
  referrerType          ReferrerType (SALES, DOKTER, MEMBER)
  branchId              String
  phone                 String?
  email                 String?
  
  // Incentive Settings
  firstIncentiveType    IncentiveType (PERCENTAGE, FIXED_AMOUNT)
  firstIncentiveValue   Decimal
  nextIncentiveType     IncentiveType
  nextIncentiveValue    Decimal
  
  // Statistics
  totalReferrals        Int
  totalIncentiveEarned  Decimal
  
  isActive              Boolean
  createdAt             DateTime
  updatedAt             DateTime
}
```

### ReferralIncentiveRecord
```prisma
model ReferralIncentiveRecord {
  id                String
  referralCodeId    String
  memberId          String
  memberPackageId   String
  
  // Package Info (snapshot)
  packageType       String
  packageName       String
  packageValue      Decimal
  
  // Incentive Calculation
  isFirstPackage    Boolean
  incentiveType     IncentiveType
  incentiveValue    Decimal
  incentiveAmount   Decimal
  
  notes             String?
  createdAt         DateTime
}
```

---

## 🔄 Complete Flow Example

### Scenario: Member baru dengan referral code membeli paket

1. **Admin Layanan membuat member baru**
   - Pilih referral code dari dropdown: `REF-001 - Sales Jakarta 1 (SALES)`
   - Member dibuat dengan `referralCodeId` = REF-001

2. **Admin Layanan assign paket ke member**
   - Assign: 1x Terapi Nano Bubble 7X Premiere (Rp 12.500.000)
   - Package created dengan status PENDING_PAYMENT

3. **Auto-calculate incentive**
   - System cek: Member punya referral code? ✅
   - System cek: Ini paket pertama? ✅ (packageCount = 1)
   - System ambil: `firstIncentiveType` = PERCENTAGE, `firstIncentiveValue` = 10
   - System hitung: 12.500.000 × 10% = Rp 1.250.000
   - System simpan ke `ReferralIncentiveRecord`
   - System update `ReferralCode`:
     - `totalReferrals` += 1
     - `totalIncentiveEarned` += 1.250.000

4. **Member beli paket kedua**
   - Assign: 1x Booster NO 1X Premiere (Rp 1.000.000)
   - System cek: Ini paket pertama? ❌ (packageCount = 2)
   - System ambil: `nextIncentiveType` = PERCENTAGE, `nextIncentiveValue` = 5
   - System hitung: 1.000.000 × 5% = Rp 50.000
   - System simpan ke `ReferralIncentiveRecord`
   - System update `ReferralCode`:
     - `totalReferrals` tidak berubah (hanya increment di paket pertama)
     - `totalIncentiveEarned` += 50.000

---

## 🎯 API Endpoints

### Referrals Management
- `GET /api/v1/referrals` - List referrals (with filters)
- `GET /api/v1/referrals/active` - Get active referrals (for dropdown)
- `GET /api/v1/referrals/:id` - Get referral detail
- `GET /api/v1/referrals/:id/incentives` - Get incentive records
- `POST /api/v1/referrals` - Create referral
- `PATCH /api/v1/referrals/:id` - Update referral
- `DELETE /api/v1/referrals/:id` - Delete referral (soft delete)

### Members with Referral
- `POST /api/v1/members` - Create member (with optional `referralCodeId`)
- `PATCH /api/v1/members/:id` - Update member

### Packages (Auto-calculate incentive)
- `POST /api/v1/members/:memberId/packages` - Assign package (auto-calculate incentive)

---

## 🖥️ Frontend Pages

### 1. Referrals List Page
- **URL**: `/referrals`
- **Access**: ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
- **Features**:
  - List all referrals with filters (search, branch, type)
  - Create new referral with incentive settings
  - View total referrals and total incentive earned
  - Delete referral (soft delete)

### 2. Referral Detail Page
- **URL**: `/referrals/:id`
- **Features**:
  - Referral information card
  - Incentive settings display
  - Incentive records history table (with pagination)
  - Edit referral modal

### 3. Member Form (Updated)
- **Location**: Branch detail page → Members tab → Add Member
- **New Feature**: Referral code dropdown
  - Fetches active referrals for the branch
  - Optional field (member bisa tanpa referral)
  - Only shown on create (not edit)

---

## 🔐 Access Control

### Referrals Management
- **ADMIN_CABANG**: Can CRUD referrals in their branch only
- **ADMIN_MANAGER**: Can CRUD referrals in branches they manage
- **SUPER_ADMIN**: Can CRUD all referrals

### View Referrals (Dropdown)
- **ALL_STAFF**: Can view active referrals for dropdown selection

### Incentive Records
- **ADMIN_PLUS**: Can view incentive records

---

## 📝 Testing Checklist

### ✅ Backend Tests
- [x] Create referral code
- [x] List referrals with branch filtering
- [x] Get referral detail with incentive records
- [x] Update referral settings
- [x] Delete referral (soft delete)
- [x] Create member with referral code
- [x] Assign package to member with referral → auto-calculate incentive
- [x] Verify incentive record created
- [x] Verify referral stats updated

### ✅ Frontend Tests
- [x] Referrals list page loads
- [x] Create referral modal works
- [x] Referral detail page shows correct data
- [x] Incentive records table displays
- [x] Edit referral modal works
- [x] Member form shows referral dropdown
- [x] Referral dropdown fetches active codes
- [x] Member creation with referral code works

---

## 🚀 Next Steps (Optional Enhancements)

### 1. **Incentive Payment Tracking**
- Add payment status to `ReferralIncentiveRecord`
- Track when incentives are paid out
- Generate incentive payment reports

### 2. **Incentive Reports**
- Monthly incentive summary per referral
- Top performing referrals
- Incentive trends over time

### 3. **Notifications**
- Notify sales when they earn incentive
- Monthly incentive summary email

### 4. **Advanced Features**
- Tiered incentive rates (based on total sales)
- Team-based incentives
- Bonus incentives for hitting targets

---

## 📚 Code Files Modified/Created

### Backend
- ✅ `apps/api/src/modules/referrals/referrals.schema.ts` (NEW)
- ✅ `apps/api/src/modules/referrals/referrals.service.ts` (NEW)
- ✅ `apps/api/src/modules/referrals/referrals.controller.ts` (NEW)
- ✅ `apps/api/src/modules/referrals/referrals.routes.ts` (NEW)
- ✅ `apps/api/src/modules/referrals/incentive-calculation.service.ts` (NEW)
- ✅ `apps/api/src/modules/packages/services/package-assignment.service.ts` (MODIFIED)
- ✅ `apps/api/src/modules/members/services/member-registration.service.ts` (MODIFIED)
- ✅ `apps/api/src/app.ts` (MODIFIED - added referrals routes)
- ✅ `apps/api/prisma/schema.prisma` (MODIFIED - added referral models)
- ✅ `apps/api/prisma/seeds/referrals.seed.ts` (MODIFIED - added sample data)

### Frontend
- ✅ `apps/web/src/lib/api/referralsApi.ts` (NEW)
- ✅ `apps/web/src/app/(staff)/referrals/page.tsx` (NEW)
- ✅ `apps/web/src/app/(staff)/referrals/[referralId]/page.tsx` (NEW)
- ✅ `apps/web/src/styles/referrals.module.css` (NEW)
- ✅ `apps/web/src/styles/referral-detail.module.css` (NEW)
- ✅ `apps/web/src/components/branches/MemberCrudModal.tsx` (MODIFIED - added referral dropdown)
- ✅ `apps/web/src/components/layout/Sidebar.tsx` (MODIFIED - added referrals menu)

---

## 🎉 Summary

Sistem referral incentive telah **fully integrated** dengan package assignment flow. Setiap kali member dengan referral code membeli paket, sistem akan:

1. ✅ Otomatis menghitung insentif berdasarkan tipe dan rate yang dikonfigurasi
2. ✅ Membedakan paket pertama vs lanjutan
3. ✅ Menyimpan record insentif untuk audit trail
4. ✅ Update statistik referral code (total referrals, total incentive earned)
5. ✅ Menampilkan riwayat insentif di halaman detail referral

**Status**: ✅ **PRODUCTION READY**

---

## 📞 Support

Jika ada pertanyaan atau issue, silakan check:
- Database schema di `apps/api/prisma/schema.prisma`
- API routes di `apps/api/src/modules/referrals/`
- Frontend pages di `apps/web/src/app/(staff)/referrals/`

**Happy Coding! 🚀**
