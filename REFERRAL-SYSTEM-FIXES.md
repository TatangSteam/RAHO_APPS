# 🔧 Referral System Fixes & Updates

## ✅ Issues Fixed

### 1. **Error 500 pada List Referrals API**
   - **Problem**: `userBranchId` tidak ada di user object, menyebabkan error saat filtering
   - **Solution**: Update `listReferralsService` untuk fetch branch dari `staffBranch` relation
   - **File**: `apps/api/src/modules/referrals/referrals.service.ts`
   
   **Changes:**
   ```typescript
   // OLD (Error 500)
   if (userRole === 'ADMIN_CABANG' && userBranchId) {
     where.branchId = userBranchId;
   }
   
   // NEW (Fixed)
   if (userRole === 'ADMIN_CABANG') {
     const user = await prisma.user.findUnique({
       where: { id: userId },
       include: { staffBranch: true },
     });
     
     if (user?.staffBranch) {
       where.branchId = user.staffBranch.branchId;
     }
   }
   ```

### 2. **Seeding Referral Codes**
   - **Problem**: Hanya 3-4 referral codes, tidak cukup untuk testing
   - **Solution**: Update seeding untuk create 8 referral codes dengan variasi:
     - 6 SALES (berbeda cabang & incentive types)
     - 1 DOKTER
     - 1 MEMBER
   - **File**: `apps/api/prisma/seeds/referrals.seed.ts`
   
   **Referral Codes Created:**
   ```
   REF-001: Ahmad Wijaya (SALES, Jakarta) - 10% / 5%
   REF-002: Siti Nurhaliza (SALES, Jakarta) - Rp 500K / Rp 250K
   REF-003: Budi Santoso (SALES, Bandung) - 8% / 4%
   REF-004: Dr. Andi Pratama (DOKTER, Bandung) - 5% / 3%
   REF-005: Dewi Lestari (SALES, Surabaya) - Rp 750K / Rp 350K
   REF-006: Rina Kusuma (MEMBER, Surabaya) - 3% / 2%
   REF-007: Joko Widodo (SALES, Jakarta) - 12% / 6%
   REF-008: Maya Sari (SALES, Bandung) - Rp 600K / Rp 300K
   ```

## 📋 Clarification: Incentive Determination

### ❌ **BUKAN** saat membuat kode referral
Kode referral hanya menyimpan **RATE** insentif (persentase atau nominal), bukan jumlah insentif final.

### ✅ **ADALAH** saat member membeli package
Insentif dihitung dan dicatat saat:
1. Member baru dibuat dengan `referralCodeId`
2. Member membeli package (BASIC atau BOOSTER)
3. System otomatis:
   - Ambil rate dari `ReferralCode`
   - Hitung insentif berdasarkan harga package
   - Simpan ke `ReferralIncentiveRecord`
   - Update `totalIncentiveEarned` di `ReferralCode`

### 🔄 **Flow Diagram:**

```
┌─────────────────────┐
│ Create Referral Code│
│ (Set RATE only)     │
│ - First: 10%        │
│ - Next: 5%          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Member Registration │
│ (Select referral)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Buy Package         │
│ Price: Rp 12,500,000│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Calculate Incentive │
│ 10% × 12,500,000    │
│ = Rp 1,250,000      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Save to DB          │
│ ReferralIncentive   │
│ Record              │
└─────────────────────┘
```

## 🎯 **Incentive Calculation Logic**

### File: `apps/api/src/modules/referrals/incentive-calculation.service.ts`

```typescript
export async function calculateAndRecordIncentive(
  memberPackageId: string,
  prisma: PrismaClient
): Promise<void> {
  // 1. Get package & member data
  const memberPackage = await prisma.memberPackage.findUnique({
    where: { id: memberPackageId },
    include: {
      member: {
        include: {
          referralCode: true, // Get referral code with rates
        },
      },
    },
  });

  if (!memberPackage?.member.referralCode) return;

  // 2. Determine if first or subsequent package
  const packageCount = await prisma.memberPackage.count({
    where: {
      memberId: memberPackage.memberId,
      status: 'ACTIVE',
    },
  });

  const isFirstPackage = packageCount === 1;
  const referralCode = memberPackage.member.referralCode;

  // 3. Get incentive rate (first or next)
  const incentiveType = isFirstPackage
    ? referralCode.firstIncentiveType
    : referralCode.nextIncentiveType;

  const incentiveValue = isFirstPackage
    ? referralCode.firstIncentiveValue
    : referralCode.nextIncentiveValue;

  // 4. Calculate incentive amount
  const packageValue = Number(memberPackage.finalPrice);
  let incentiveAmount = 0;

  if (incentiveType === 'PERCENTAGE') {
    incentiveAmount = (packageValue * incentiveValue) / 100;
  } else {
    incentiveAmount = incentiveValue;
  }

  // 5. Save incentive record
  await prisma.referralIncentiveRecord.create({
    data: {
      referralCodeId: referralCode.id,
      memberId: memberPackage.memberId,
      memberPackageId: memberPackage.id,
      packageType: memberPackage.packageType,
      packageName: `${memberPackage.packageType} Package`,
      packageValue,
      isFirstPackage,
      incentiveType,
      incentiveValue,
      incentiveAmount,
    },
  });

  // 6. Update total incentive earned
  await prisma.referralCode.update({
    where: { id: referralCode.id },
    data: {
      totalIncentiveEarned: {
        increment: incentiveAmount,
      },
      totalReferrals: {
        increment: isFirstPackage ? 1 : 0,
      },
    },
  });
}
```

## 📊 **Example Scenarios**

### Scenario 1: PERCENTAGE Incentive
```
Referral Code: REF-001
- First Package: 10%
- Next Package: 5%

Member buys:
1. Package NB7PM (Rp 12,500,000) → Incentive: Rp 1,250,000 (10%)
2. Package NB15PM (Rp 22,500,000) → Incentive: Rp 1,125,000 (5%)
3. Booster NO (Rp 1,000,000) → Incentive: Rp 50,000 (5%)

Total Incentive: Rp 2,425,000
```

### Scenario 2: FIXED_AMOUNT Incentive
```
Referral Code: REF-002
- First Package: Rp 500,000
- Next Package: Rp 250,000

Member buys:
1. Package NB7PM (Rp 12,500,000) → Incentive: Rp 500,000
2. Package NB15PM (Rp 22,500,000) → Incentive: Rp 250,000
3. Booster NO (Rp 1,000,000) → Incentive: Rp 250,000

Total Incentive: Rp 1,000,000
```

### Scenario 3: Mixed (PERCENTAGE first, FIXED next)
```
Referral Code: REF-009 (custom)
- First Package: 8% (PERCENTAGE)
- Next Package: Rp 300,000 (FIXED_AMOUNT)

Member buys:
1. Package NB7PM (Rp 12,500,000) → Incentive: Rp 1,000,000 (8%)
2. Package NB15PM (Rp 22,500,000) → Incentive: Rp 300,000 (fixed)
3. Booster NO (Rp 1,000,000) → Incentive: Rp 300,000 (fixed)

Total Incentive: Rp 1,600,000
```

## 🔍 **Testing the Fix**

### 1. Test List Referrals API
```bash
# Login first to get token
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admincabang.pst@raho.id",
    "password": "AdminCabang@123"
  }'

# Use the token to list referrals
curl -X GET "http://localhost:4000/api/v1/referrals?page=1&limit=20&isActive=true" \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "id": "...",
        "code": "REF-001",
        "referrerName": "Ahmad Wijaya",
        "referrerType": "SALES",
        "branchId": "...",
        "phone": "081234567890",
        "email": "ahmad.wijaya@raho.id",
        "firstIncentiveType": "PERCENTAGE",
        "firstIncentiveValue": 10,
        "nextIncentiveType": "PERCENTAGE",
        "nextIncentiveValue": 5,
        "totalReferrals": 0,
        "totalIncentiveEarned": 0,
        "isActive": true,
        "branch": {
          "id": "...",
          "branchCode": "PST",
          "name": "RAHO Premiere Jakarta"
        }
      },
      // ... 7 more referrals
    ],
    "total": 8,
    "page": 1,
    "limit": 20
  }
}
```

### 2. Test Create Member with Referral
```bash
curl -X POST http://localhost:4000/api/v1/members \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.member@example.com",
    "password": "Member@123",
    "fullName": "Test Member",
    "phone": "081234567999",
    "nik": "3201010101990001",
    "tempatLahir": "Jakarta",
    "dateOfBirth": "1990-01-01",
    "jenisKelamin": "L",
    "address": "Jl. Test No. 123",
    "pekerjaan": "Karyawan",
    "statusNikah": "MARRIED",
    "emergencyContact": "Emergency Contact - 081234567888",
    "sumberInfoRaho": "Referral",
    "postalCode": "12000",
    "isConsentToPhoto": true,
    "referralCodeId": "<REFERRAL_CODE_ID>"
  }'
```

### 3. Test Assign Package (Incentive Auto-Calculated)
```bash
curl -X POST http://localhost:4000/api/v1/members/<MEMBER_ID>/packages \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "packagePricingId": "<PACKAGE_PRICING_ID>",
    "discountPercent": 0,
    "paymentMethod": "CASH"
  }'
```

**Expected:**
- Package created
- Incentive record created automatically
- `totalIncentiveEarned` updated in referral code

### 4. Test Export Reports
```bash
# Export to Excel
curl -X GET "http://localhost:4000/api/v1/referrals/export/excel" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  --output laporan_insentif.xlsx

# Export to PDF
curl -X GET "http://localhost:4000/api/v1/referrals/export/pdf" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  --output laporan_insentif.pdf

# Export Summary
curl -X GET "http://localhost:4000/api/v1/referrals/export/summary" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  --output ringkasan_insentif.xlsx
```

## 📁 **Files Modified**

1. `apps/api/src/modules/referrals/referrals.service.ts` - Fixed branch filtering
2. `apps/api/prisma/seeds/referrals.seed.ts` - Updated seeding with 8 referral codes
3. `apps/api/src/modules/referrals/incentive-calculation.service.ts` - Auto-calculate incentives
4. `apps/api/src/modules/packages/services/package-assignment.service.ts` - Call incentive calculation
5. `apps/api/src/modules/members/services/member-registration.service.ts` - Support referralCodeId

## 🎯 **Key Points**

1. ✅ **Referral Code** = Template dengan RATE insentif
2. ✅ **Incentive Record** = Transaksi aktual dengan JUMLAH insentif
3. ✅ **Auto-Calculation** = Terjadi saat package assignment
4. ✅ **Two Rates** = First package (higher) vs subsequent packages (lower)
5. ✅ **Two Types** = PERCENTAGE (%) atau FIXED_AMOUNT (Rp)
6. ✅ **Export Ready** = Excel & PDF reports available

## 🚀 **Next Steps**

1. ✅ Run seeding: `npm run db:seed` (Done - 8 referral codes created)
2. ✅ Test API endpoints (List, Create, Update, Delete)
3. ✅ Test member registration with referral
4. ✅ Test package assignment (incentive auto-calculated)
5. ✅ Test export reports (Excel, PDF, Summary)
6. ✅ Verify incentive calculations are correct
7. ✅ Test different incentive types (PERCENTAGE vs FIXED_AMOUNT)

## 📞 **Support**

For questions or issues:
- Check API logs: `apps/api/logs/`
- Review error messages in browser console
- Test with Postman/Insomnia for detailed API responses
- Contact: dev@raho.id
