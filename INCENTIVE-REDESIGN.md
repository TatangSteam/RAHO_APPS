# 🔄 Incentive System Redesign

## 📋 **New Requirement:**

**Insentif ditentukan saat MEMBUAT MEMBER, tapi perhitungannya per paket**

## 🎯 **Correct Flow:**

```
1. Create Referral Code
   ├── Kode: REF-001
   ├── Nama: Ahmad Wijaya
   ├── Tipe: SALES
   ├── Cabang: Jakarta
   ├── Phone: 081234567890
   └── Email: ahmad@raho.id
   ❌ NO INCENTIVE FIELDS

2. Create Member
   ├── ... (member data)
   ├── Referral Code: REF-001 ✅
   └── ✨ INCENTIVE SETTINGS ✨
       ├── First Package Incentive Type: PERCENTAGE
       ├── First Package Incentive Value: 10
       ├── Next Package Incentive Type: PERCENTAGE
       └── Next Package Incentive Value: 5

3. Assign Package #1 (First)
   ├── Package: NB7PM (Rp 12,500,000)
   ├── Get incentive from MEMBER: 10%
   ├── Calculate: 10% × 12,500,000 = Rp 1,250,000
   └── Save to ReferralIncentiveRecord

4. Assign Package #2 (Next)
   ├── Package: NB15PM (Rp 22,500,000)
   ├── Get incentive from MEMBER: 5%
   ├── Calculate: 5% × 22,500,000 = Rp 1,125,000
   └── Save to ReferralIncentiveRecord
```

## 🗄️ **Database Changes:**

### Migration: Move Incentive from ReferralCode to Member

```prisma
// OLD: ReferralCode model
model ReferralCode {
  id                    String        @id @default(cuid())
  code                  String        @unique
  referrerName          String
  referrerType          ReferrerType
  branchId              String
  phone                 String?
  email                 String?
  firstIncentiveType    IncentiveType  ❌ REMOVE
  firstIncentiveValue   Decimal        ❌ REMOVE
  nextIncentiveType     IncentiveType  ❌ REMOVE
  nextIncentiveValue    Decimal        ❌ REMOVE
  totalReferrals        Int           @default(0)
  totalIncentiveEarned  Decimal       @default(0)
  isActive              Boolean       @default(true)
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
}

// NEW: Member model
model Member {
  id                      String    @id @default(cuid())
  userId                  String    @unique
  memberNo                String    @unique
  registrationBranchId    String
  referralCodeId          String?
  
  // ✨ ADD INCENTIVE FIELDS ✨
  firstIncentiveType      IncentiveType?  ✅ ADD
  firstIncentiveValue     Decimal?        ✅ ADD
  nextIncentiveType       IncentiveType?  ✅ ADD
  nextIncentiveValue      Decimal?        ✅ ADD
  
  voucherCount            Int       @default(0)
  // ... rest of fields
}
```

## 📝 **Migration Steps:**

### Step 1: Create Migration File
```bash
npx prisma migrate dev --name move_incentive_to_member --create-only
```

### Step 2: Edit Migration SQL
```sql
-- Add incentive fields to Member
ALTER TABLE "members" 
  ADD COLUMN "firstIncentiveType" "IncentiveType",
  ADD COLUMN "firstIncentiveValue" DECIMAL(10,2),
  ADD COLUMN "nextIncentiveType" "IncentiveType",
  ADD COLUMN "nextIncentiveValue" DECIMAL(10,2);

-- Migrate existing data (if any members have referralCodeId)
UPDATE "members" m
SET 
  "firstIncentiveType" = rc."firstIncentiveType",
  "firstIncentiveValue" = rc."firstIncentiveValue",
  "nextIncentiveType" = rc."nextIncentiveType",
  "nextIncentiveValue" = rc."nextIncentiveValue"
FROM "referral_codes" rc
WHERE m."referralCodeId" = rc."id"
  AND m."referralCodeId" IS NOT NULL;

-- Remove incentive fields from ReferralCode
ALTER TABLE "referral_codes"
  DROP COLUMN "firstIncentiveType",
  DROP COLUMN "firstIncentiveValue",
  DROP COLUMN "nextIncentiveType",
  DROP COLUMN "nextIncentiveValue";
```

### Step 3: Apply Migration
```bash
npx prisma migrate dev
npx prisma generate
```

## 🔧 **Code Changes:**

### 1. Update Schema (`schema.prisma`)
```prisma
model ReferralCode {
  id                    String        @id @default(cuid())
  code                  String        @unique
  referrerName          String
  referrerType          ReferrerType
  branchId              String
  phone                 String?
  email                 String?
  // REMOVED: incentive fields
  totalReferrals        Int           @default(0)
  totalIncentiveEarned  Decimal       @default(0)
  isActive              Boolean       @default(true)
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  branch            Branch                      @relation(fields: [branchId], references: [id])
  members           Member[]
  incentiveRecords  ReferralIncentiveRecord[]

  @@index([branchId, isActive])
  @@index([code])
  @@map("referral_codes")
}

model Member {
  id                      String    @id @default(cuid())
  userId                  String    @unique
  memberNo                String    @unique
  registrationBranchId    String
  referralCodeId          String?
  
  // ADD: Incentive fields
  firstIncentiveType      IncentiveType?
  firstIncentiveValue     Decimal?       @db.Decimal(10, 2)
  nextIncentiveType       IncentiveType?
  nextIncentiveValue      Decimal?       @db.Decimal(10, 2)
  
  voucherCount            Int       @default(0)
  isConsentToPhoto        Boolean   @default(true)
  // ... rest of fields
}
```

### 2. Update Referrals Schema (`referrals.schema.ts`)
```typescript
// REMOVE incentive fields
export const createReferralSchema = z.object({
  referrerName: z.string().min(1),
  referrerType: z.enum(['SALES', 'DOKTER', 'MEMBER']),
  branchId: z.string().cuid(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  // REMOVED: incentive fields
});

export const updateReferralSchema = z.object({
  referrerName: z.string().min(1).optional(),
  referrerType: z.enum(['SALES', 'DOKTER', 'MEMBER']).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  // REMOVED: incentive fields
});
```

### 3. Update Members Schema (`members.schema.ts`)
```typescript
// ADD incentive fields
export const createMemberSchema = z.object({
  // ... existing fields
  referralCodeId: z.string().cuid().optional(),
  
  // ADD: Incentive fields
  firstIncentiveType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  firstIncentiveValue: z.number().min(0).optional(),
  nextIncentiveType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
  nextIncentiveValue: z.number().min(0).optional(),
});
```

### 4. Update Incentive Calculation Service
```typescript
// OLD: Get incentive from ReferralCode
const referralCode = memberPackage.member.referralCode;
const incentiveType = isFirstPackage
  ? referralCode.firstIncentiveType
  : referralCode.nextIncentiveType;

// NEW: Get incentive from Member
const member = memberPackage.member;
const incentiveType = isFirstPackage
  ? member.firstIncentiveType
  : member.nextIncentiveType;
```

### 5. Update Frontend Forms

#### Remove from Referrals Page:
```typescript
// REMOVE incentive fields from CreateReferralModal
// REMOVE incentive columns from table
// REMOVE incentive display from detail page
```

#### Add to Member Create Form:
```typescript
// ADD IncentiveSection component
<div className={styles.incentiveSection}>
  <h3>Insentif Referral (Opsional)</h3>
  
  <div className={styles.formRow}>
    <div className={styles.formGroup}>
      <label>Insentif Paket Pertama - Tipe</label>
      <select value={formData.firstIncentiveType}>
        <option value="">Tidak Ada</option>
        <option value="PERCENTAGE">Persentase (%)</option>
        <option value="FIXED_AMOUNT">Nominal (Rp)</option>
      </select>
    </div>
    
    <div className={styles.formGroup}>
      <label>Nilai</label>
      <input type="number" value={formData.firstIncentiveValue} />
    </div>
  </div>
  
  <div className={styles.formRow}>
    <div className={styles.formGroup}>
      <label>Insentif Paket Lanjutan - Tipe</label>
      <select value={formData.nextIncentiveType}>
        <option value="">Tidak Ada</option>
        <option value="PERCENTAGE">Persentase (%)</option>
        <option value="FIXED_AMOUNT">Nominal (Rp)</option>
      </select>
    </div>
    
    <div className={styles.formGroup}>
      <label>Nilai</label>
      <input type="number" value={formData.nextIncentiveValue} />
    </div>
  </div>
</div>
```

## 🎯 **Benefits:**

✅ **Flexibility**: Setiap member bisa punya rate insentif berbeda
✅ **Simplicity**: Kode referral hanya info referrer
✅ **Accuracy**: Insentif langsung terkait dengan member
✅ **Override**: Bisa set custom rate per member

## 📊 **Example Scenarios:**

### Scenario 1: Standard Rate
```
1. Create REF-001 (Ahmad Wijaya - SALES)
2. Create Member A with REF-001
   - First: 10%
   - Next: 5%
3. Member A buys packages → Use 10% / 5%
```

### Scenario 2: Custom Rate per Member
```
1. Create REF-001 (Ahmad Wijaya - SALES)
2. Create Member A with REF-001
   - First: 10%
   - Next: 5%
3. Create Member B with REF-001
   - First: 15% (special deal)
   - Next: 7%
4. Member A → Use 10% / 5%
5. Member B → Use 15% / 7%
```

### Scenario 3: No Incentive
```
1. Create REF-001 (Ahmad Wijaya - SALES)
2. Create Member C with REF-001
   - No incentive fields set
3. Member C buys packages → No incentive calculated
```

## ⚠️ **Important Notes:**

1. **Backward Compatibility**: Migration will copy existing incentive data from ReferralCode to Members
2. **Optional Fields**: Incentive fields are optional - not all members need incentives
3. **Validation**: If incentive type is set, value must be provided
4. **UI Changes**: Major changes to both Referrals and Members pages

## 🚀 **Implementation Checklist:**

- [ ] Update `schema.prisma`
- [ ] Create and run migration
- [ ] Update `referrals.schema.ts` (remove incentive)
- [ ] Update `members.schema.ts` (add incentive)
- [ ] Update `referrals.service.ts` (remove incentive logic)
- [ ] Update `members.service.ts` (add incentive logic)
- [ ] Update `incentive-calculation.service.ts` (get from member)
- [ ] Update referrals frontend (remove incentive UI)
- [ ] Update members frontend (add incentive UI)
- [ ] Update seeding (remove incentive from referrals, add to members)
- [ ] Test all flows
- [ ] Update documentation

Apakah Anda ingin saya implementasikan perubahan ini sekarang?
