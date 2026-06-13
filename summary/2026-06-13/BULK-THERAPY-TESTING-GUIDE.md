# Testing Guide: Bulk Therapy Plan Modal

## Current Status
✅ Backend implementation complete
✅ Frontend modal complete with Tailwind CSS
✅ Debug logging added to both frontend and backend
⚠️ Issue: Modal shows "canCreate = 0" - needs testing to identify cause

## Prerequisites

### 1. Start Development Servers

**Terminal 1 - API Server:**
```bash
cd apps/api
npm run dev
```

**Terminal 2 - Web Server:**
```bash
cd apps/web
npm run dev
```

### 2. Prepare Test Member

You need a member with:
- ✅ Active package (status = 'ACTIVE')
- ✅ totalSessions > 0
- ✅ Existing therapy plans < totalSessions

## Testing Procedure

### Step 1: Identify Test Member

Run this SQL query to find a suitable test member:

```sql
-- Find members with active packages who can create therapy plans
SELECT 
  m.id as memberId,
  m.memberNo,
  p.fullName,
  mp.packageType,
  mp.totalSessions,
  COUNT(tp.id) as existingPlans,
  (mp.totalSessions - COUNT(tp.id)) as canCreate
FROM "Member" m
LEFT JOIN "Profile" p ON p.userId = m.userId
LEFT JOIN "MemberPackage" mp ON mp.memberId = m.id AND mp.status = 'ACTIVE'
LEFT JOIN "TherapyPlan" tp ON tp.memberId = m.id
WHERE mp.id IS NOT NULL
GROUP BY m.id, m.memberNo, p.fullName, mp.packageType, mp.totalSessions
HAVING (mp.totalSessions - COUNT(tp.id)) > 0
ORDER BY canCreate DESC
LIMIT 5;
```

### Step 2: Open Member Detail Page

1. Login as staff user (ADMIN_LAYANAN or above)
2. Navigate to **Members** page
3. Search for the test member (by memberNo or name)
4. Click on the member to open detail page

### Step 3: Open Bulk Therapy Modal

1. Click on **"Terapi Plan"** tab
2. Click **"📋 Buat Bulk"** button
3. Modal should open

### Step 4: Check Console Logs

#### Browser Console (F12 → Console Tab)

Expected logs:
```
📦 Package Summary Response: { member: {...}, package: {...}, therapyPlans: {...} }
📊 Can Create: <number>
📈 Existing: <number>
🎫 Vouchers Total: <number>
✅ Vouchers Used: <number>
🔥 Vouchers Remaining: <number>
```

#### API Server Console

Expected logs:
```
🔍 Package Summary Debug:
  Member ID: <id>
  Package ID: <id>
  Package Type: BASIC_P7_HC
  Total Sessions: 7
  Used Sessions: 2
  Sessions Remaining: 5
  Existing Therapy Plans: 3
  Can Create: 4
  Calculation: 7 - 3 = 4
```

### Step 5: Analyze Results

#### ✅ Success Case - Modal Works Correctly

**Console shows:**
```
Can Create: 4
Existing: 3
Vouchers Total: 7
```

**Modal shows:**
- Header badge: "4 Plans"
- Package summary: All fields populated correctly
- Banner: "Akan membuat 4 rencana terapi sekaligus"
- Table: 4 rows displayed (Terapi ke-4, ke-5, ke-6, ke-7)
- Submit button: "Buat 4 Plans" (enabled)

#### ❌ Problem Case - canCreate = 0

**Console shows:**
```
Can Create: 0
Existing: 7
Vouchers Total: 7
```

**Modal shows:**
- Header badge: "0 Plans"
- Warning banner: "⚠️ Tidak ada voucher tersisa untuk membuat rencana terapi"
- Debug info: "Membuat 0 rows untuk 0 voucher tersisa"
- Empty table
- Submit button: disabled

**Diagnosis:** Member has already created all possible therapy plans (7/7)

**Solution:** Test with a different member who has fewer existing plans

### Step 6: Test Bulk Creation (If canCreate > 0)

1. **Verify IFA Selection:**
   - Each row should default to "IFA 250ml ⭐" (green highlight)
   - Click "IFA 500ml" radio button
   - Should highlight amber/yellow
   - Only one IFA type should be selected per row

2. **Fill Dosage Fields:**
   - Fill at least one dose field per row (HHO, H2, etc.)
   - Use "Copy to next row" button (blue) to copy row data
   - Use "Copy to all below" button (green) to copy to all rows below

3. **Submit:**
   - Click "Buat X Plans" button
   - Should show loading spinner
   - Success toast: "Berhasil membuat X therapy plans"
   - Modal closes automatically
   - Therapy Plans tab refreshes with new plans

4. **Validation Test:**
   - Clear all dose fields in first row
   - Click submit
   - Should show validation error: "Minimal 1 dosis harus diisi"
   - Fill IFA250 = 1 and IFA500 = 1 in same row
   - Should show error: "Tidak boleh mengisi IFA250 dan IFA500 bersamaan"

## Test Scenarios

### Scenario A: Fresh Package (No Therapy Plans)
- **Setup:** Member with active package, 0 existing therapy plans
- **Expected:** canCreate = totalSessions (e.g., 7)
- **Result:** Modal shows 7 rows for Terapi ke-1 through ke-7

### Scenario B: Partial Therapy Plans
- **Setup:** Member with active package, 3 existing therapy plans
- **Expected:** canCreate = 4 (for 7-session package)
- **Result:** Modal shows 4 rows for Terapi ke-4 through ke-7

### Scenario C: All Plans Created
- **Setup:** Member with 7 therapy plans for 7-session package
- **Expected:** canCreate = 0
- **Result:** Modal shows warning, no table, disabled submit button

### Scenario D: No Active Package
- **Setup:** Member with no active package or only PENDING_PAYMENT
- **Expected:** API returns error
- **Result:** Modal shows error message, closes gracefully

### Scenario E: Large Package
- **Setup:** Member with BASIC_P30_HC (30 sessions), 10 existing plans
- **Expected:** canCreate = 20
- **Result:** Modal shows 20 rows with scrollable table

## Common Issues & Solutions

### Issue 1: API Returns 404 "Member tidak ditemukan"
**Cause:** Invalid member ID
**Solution:** Verify member exists in database

### Issue 2: API Returns 404 "Member tidak memiliki paket aktif"
**Cause:** Package status is not ACTIVE
**Solution:** 
```sql
-- Activate package manually
UPDATE "MemberPackage"
SET status = 'ACTIVE', activatedAt = NOW()
WHERE memberId = '<MEMBER_ID>' AND packageCode = '<PACKAGE_CODE>';
```

### Issue 3: canCreate = 0 but member should have remaining slots
**Cause:** TherapyPlan count includes plans from old packages
**Solution:** Check if therapy plans are from current active package or old ones
```sql
-- Check therapy plans
SELECT tp.*, mp.status as packageStatus
FROM "TherapyPlan" tp
LEFT JOIN "TreatmentSession" ts ON ts.therapyPlanId = tp.id
LEFT JOIN "MemberPackage" mp ON mp.memberId = tp.memberId
WHERE tp.memberId = '<MEMBER_ID>'
ORDER BY tp.createdAt;
```

### Issue 4: Modal shows incorrect vouchers remaining
**Cause:** usedSessions not updated correctly
**Solution:** Verify session usage count matches actual treatment sessions

### Issue 5: Submit fails with "TOO_MANY_PLANS"
**Cause:** Trying to create more than 50 plans at once
**Solution:** This is a safety limit, should not occur in normal usage

## SQL Debugging Script

Use this script to check member status:
```bash
# Location: apps/api/scripts/check-member-therapy-status.sql
# Replace <MEMBER_ID> with actual ID before running
```

## Expected API Response

**Successful response:**
```json
{
  "success": true,
  "data": {
    "member": {
      "id": "cm123...",
      "memberNo": "MBR-JKT-20260001",
      "fullName": "John Doe"
    },
    "package": {
      "id": "cm456...",
      "packageName": "BASIC_P7_HC",
      "vouchersTotal": 7,
      "vouchersUsed": 2,
      "vouchersRemaining": 5,
      "status": "ACTIVE"
    },
    "therapyPlans": {
      "existing": 3,
      "canCreate": 4,
      "maxRecommended": 7
    }
  }
}
```

## Next Steps After Testing

Once you've tested and gathered console logs:

1. **If canCreate is correct but not showing:**
   - Check frontend data binding
   - Verify TypeScript interfaces match API response

2. **If calculation is wrong:**
   - Check backend logic
   - Verify TherapyPlan count query is correct

3. **If everything works:**
   - Remove debug console.log statements
   - Create production build
   - Deploy to testing/staging environment

## Files to Monitor

### Frontend
- `apps/web/src/components/members/BulkTherapyPlanModal.tsx`
- `apps/web/src/lib/therapyPlanApi.ts`

### Backend
- `apps/api/src/modules/members/services/member-therapy-plan-bulk.service.ts`
- `apps/api/src/modules/members/members.controller.ts`
- `apps/api/src/modules/members/members.routes.ts`

## Success Criteria

✅ Modal loads without errors
✅ Package summary displays correctly
✅ canCreate calculation is accurate
✅ Table shows correct number of rows
✅ IFA selection works (radio buttons)
✅ Copy functions work (to next row, to all below)
✅ Validation prevents invalid submissions
✅ Bulk creation saves all plans in transaction
✅ Success message appears
✅ Therapy Plans tab refreshes with new data

## Report Template

When reporting results, please include:

```
**Member ID:** <member-id>
**Member No:** <member-no>
**Package Type:** <package-type>

**Backend Console Logs:**
<paste backend logs here>

**Browser Console Logs:**
<paste browser logs here>

**Modal Display:**
- Header badge: "X Plans"
- Vouchers Total: X
- Existing Plans: X
- Can Create: X
- Rows displayed: X

**Issue (if any):**
<describe what's wrong>

**Screenshot:**
<attach screenshot if possible>
```
