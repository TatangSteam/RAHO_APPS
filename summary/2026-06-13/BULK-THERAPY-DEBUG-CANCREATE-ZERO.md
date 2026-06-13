# Debug: Bulk Therapy Plan Modal - canCreate Returns 0

## Issue
Modal shows "Tidak ada voucher tersisa untuk membuat rencana terapi" with debug info showing "Membuat 0 rows untuk 0 voucher tersisa"

## Root Cause Investigation

The issue is that `packageSummary.therapyPlans.canCreate` is returning 0, which can happen if:

1. **No active package exists** - The member doesn't have an active package
2. **All therapy plans already created** - `existingTherapyPlansCount >= totalSessions`
3. **Backend calculation error** - Field names mismatch or logic error

## Verification Steps

### Schema Verification ✅
Confirmed in `apps/api/prisma/schema.prisma`:
```prisma
model MemberPackage {
  totalSessions    Int
  usedSessions     Int           @default(0)
  status           PackageStatus @default(PENDING_PAYMENT)
}
```

### Backend Calculation Logic ✅
In `apps/api/src/modules/members/services/member-therapy-plan-bulk.service.ts`:
```typescript
const therapyPlansCanCreate = Math.max(0, sessionsTotal - existingTherapyPlansCount);
```

This calculation is correct:
- `sessionsTotal` = Total vouchers in the package
- `existingTherapyPlansCount` = Number of therapy plans already created
- `canCreate` = How many more plans can be created

### Debug Logging Added

#### Frontend (BulkTherapyPlanModal.tsx)
```typescript
console.log('📦 Package Summary Response:', summary);
console.log('📊 Can Create:', summary.therapyPlans.canCreate);
console.log('📈 Existing:', summary.therapyPlans.existing);
console.log('🎫 Vouchers Total:', summary.package.vouchersTotal);
console.log('✅ Vouchers Used:', summary.package.vouchersUsed);
console.log('🔥 Vouchers Remaining:', summary.package.vouchersRemaining);
```

#### Backend (member-therapy-plan-bulk.service.ts)
```typescript
console.log('🔍 Package Summary Debug:');
console.log('  Member ID:', memberId);
console.log('  Package ID:', memberPackage.id);
console.log('  Package Type:', memberPackage.packageType);
console.log('  Total Sessions:', sessionsTotal);
console.log('  Used Sessions:', sessionsUsed);
console.log('  Sessions Remaining:', sessionsRemaining);
console.log('  Existing Therapy Plans:', existingTherapyPlansCount);
console.log('  Can Create:', therapyPlansCanCreate);
console.log('  Calculation:', `${sessionsTotal} - ${existingTherapyPlansCount} = ${therapyPlansCanCreate}`);
```

## Next Steps to Test

1. **Start the API server** with logging enabled
   ```bash
   cd apps/api
   npm run dev
   ```

2. **Start the web server**
   ```bash
   cd apps/web
   npm run dev
   ```

3. **Open the Bulk Therapy Modal** on a member detail page

4. **Check Console Logs**:
   - Browser Console (F12) - will show frontend logs
   - Terminal running API - will show backend logs

## Expected Scenarios

### Scenario 1: Member has no active package
- Backend should throw error: "Member tidak memiliki paket aktif"
- Modal should show error message

### Scenario 2: Member has active package with all plans created
- Example: Package has 7 sessions, 7 therapy plans already exist
- Backend calculation: `7 - 7 = 0`
- Modal correctly shows: "Tidak ada voucher tersisa"

### Scenario 3: Member has active package with remaining slots
- Example: Package has 7 sessions, 3 therapy plans exist
- Backend calculation: `7 - 3 = 4`
- Modal should show: "Membuat 4 rows untuk 4 voucher tersisa"
- Table should display 4 rows

## Common Issues to Check

1. **Package Status** - Must be "ACTIVE", not "PENDING_PAYMENT" or "EXPIRED"
2. **TherapyPlan Count** - Check if member has therapy plans from old/expired packages
3. **Member Selection** - Ensure testing with correct member who has active package

## Database Query to Check Member Package Status

```sql
-- Check member's active package
SELECT 
  mp.id,
  mp.packageCode,
  mp.packageType,
  mp.totalSessions,
  mp.usedSessions,
  mp.status,
  COUNT(tp.id) as therapyPlansCount
FROM MemberPackage mp
LEFT JOIN TherapyPlan tp ON tp.memberId = mp.memberId
WHERE mp.memberId = '<MEMBER_ID>'
  AND mp.status = 'ACTIVE'
GROUP BY mp.id;
```

## Resolution

Once the console logs show the actual values:
1. If `totalSessions = 0` → The package was created incorrectly
2. If `existingTherapyPlansCount >= totalSessions` → User needs to create a new package or upgrade
3. If calculation is correct but UI shows 0 → Check frontend data mapping

## Files Modified

### Frontend
- `apps/web/src/components/members/BulkTherapyPlanModal.tsx` - Added debug console logs

### Backend
- `apps/api/src/modules/members/services/member-therapy-plan-bulk.service.ts` - Added debug console logs

## Build Status
✅ Backend compiled successfully (0 errors)
✅ Frontend compiled successfully (0 errors)

## Action Required
**User needs to test the modal and share console log output to proceed with debugging.**
