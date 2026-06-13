# Testing Guide: Unlimited Bulk Therapy Plan Creation

**Feature**: Remove voucher limit from bulk therapy plan creation  
**Date**: June 13, 2026

---

## Quick Start Test

### 1. Test with Member "test23"

```bash
# Start backend
cd apps/api
npm run dev

# Start frontend (in another terminal)
cd apps/web
npm run dev
```

**Steps**:
1. Login as Admin Layanan or Doctor
2. Go to Members page
3. Find member "test23"
4. Click on member to view details
5. Go to "Therapy Plans" tab
6. Click "Buat Bulk" button

**Expected Result**:
- Modal opens
- Shows package summary (if member has package) OR "Tidak Ada Paket Aktif"
- Shows green/purple banner about unlimited mode
- Table starts with 1 empty row
- "Tambah Baris" button is visible

---

## Test Scenarios

### ✅ Test 1: Add Multiple Rows

**Steps**:
1. Open bulk therapy plan modal
2. Click "Tambah Baris" button 5 times
3. Verify total shows "6 therapy plan(s)"

**Expected**:
- Each click adds 1 new row
- Row numbers auto-increment (Terapi ke-1, ke-2, ke-3...)
- Success toast shows "Baris baru ditambahkan"
- Header badge updates dynamically

**Pass/Fail**: ______

---

### ✅ Test 2: Remove Rows

**Steps**:
1. Open bulk therapy plan modal with multiple rows
2. Click trash icon (🗑️) on row 2
3. Verify row is deleted
4. Try to delete the last remaining row

**Expected**:
- Row 2 is removed
- Remaining rows renumber automatically
- Success toast: "Baris dihapus"
- Last row deletion shows error: "Minimal harus ada 1 baris"

**Pass/Fail**: ______

---

### ✅ Test 3: Create 10 Plans (With Package)

**Prerequisites**: Member with active package (any voucher count)

**Steps**:
1. Open bulk therapy plan modal
2. Click "Tambah Baris" 9 times (total 10 rows)
3. Select IFA type for each row (250ml or 500ml)
4. Leave dosage values as default
5. Click "Buat 10 Plan(s)"

**Expected**:
- All 10 therapy plans created successfully
- No voucher validation error
- Success toast shows
- Modal closes
- Therapy plans list refreshes with new plans

**Pass/Fail**: ______

---

### ✅ Test 4: Create Plans Without Package

**Prerequisites**: Member with NO active package

**Steps**:
1. Find/create member without active package
2. Open bulk therapy plan modal
3. Verify purple banner: "Member tanpa paket bisa membuat therapy plan tanpa batas"
4. Add 5 rows
5. Fill in dosage data
6. Submit

**Expected**:
- Modal shows "Tidak Ada Paket Aktif" status
- Can add rows normally
- Can submit successfully
- No errors about missing package

**Pass/Fail**: ______

---

### ✅ Test 5: Copy Functions

**Steps**:
1. Open bulk therapy plan modal with 3 rows
2. In row 1, set:
   - IFA: 250ml
   - HHO: 5
   - H2: 3
3. Click "Copy to next" button on row 1
4. Verify row 2 has same values
5. Change row 2 HHO to 7
6. Click "Copy to all below" on row 2
7. Verify row 3 has row 2's values

**Expected**:
- Copy to next: Copies to immediately next row only
- Copy to all: Copies to all rows below
- Success toasts show
- Dosage values match exactly

**Pass/Fail**: ______

---

### ✅ Test 6: Validation - Empty Dosage

**Steps**:
1. Open bulk therapy plan modal
2. Add 1 row
3. Clear all dosage fields (or leave empty)
4. Click submit

**Expected**:
- Red error banner appears
- Error message: "Baris 1: Minimal 1 dosis harus diisi"
- Form does not submit
- Toast: "Mohon perbaiki error validasi"

**Pass/Fail**: ______

---

### ✅ Test 7: Validation - Both IFA Types

**Steps**:
1. Open bulk therapy plan modal
2. In row 1, somehow set both IFA250 and IFA500 to non-zero values
   (Note: UI prevents this with radio buttons, but test manually if needed)
3. Click submit

**Expected**:
- If possible to set both: validation error shows
- Radio buttons should prevent selecting both

**Pass/Fail**: ______

---

### ✅ Test 8: Large Bulk Creation

**Steps**:
1. Open bulk therapy plan modal
2. Click "Tambah Baris" 49 times (total 50 rows - max limit)
3. Select IFA250 for all
4. Submit

**Expected**:
- All 50 plans created successfully
- No voucher validation
- Process completes without timeout

**Pass/Fail**: ______

---

### ✅ Test 9: Package Info Display

**Prerequisites**: Member with active package

**Steps**:
1. Open bulk therapy plan modal
2. Verify package summary card shows:
   - 📦 Paket: [Package name]
   - 🎫 Total Voucher: [Number]
   - ✅ Voucher Terpakai: [Number]
   - 🔥 Voucher Tersisa: [Number]
   - 📋 Terapi Plan Existing: [Number]
3. Verify green banner shows "Mode Unlimited"

**Expected**:
- All package info displays correctly
- Numbers match member's actual package
- Info is display-only (not enforced)

**Pass/Fail**: ______

---

### ✅ Test 10: Auto-Numbering

**Steps**:
1. Check member's completed sessions count (e.g., 5)
2. Check member's unused therapy plans count (e.g., 2)
3. Open bulk therapy plan modal
4. Verify first row shows "Terapi ke-8" (5 + 2 + 1)
5. Add 2 more rows
6. Verify they show "Terapi ke-9" and "Terapi ke-10"
7. Remove row 2
8. Verify remaining rows renumber to "Terapi ke-8" and "Terapi ke-9"

**Expected**:
- Auto-numbering formula correct
- Renumbering works on delete

**Pass/Fail**: ______

---

## Edge Cases

### 🔍 Edge Case 1: Member Just Assigned Package

**Steps**:
1. Assign a new package to member (10 sessions)
2. Immediately open bulk therapy plan modal
3. Verify voucher counts show correctly

**Expected**:
- Vouchers Total: 10
- Vouchers Used: 0
- Vouchers Remaining: 10
- Can create unlimited plans

---

### 🔍 Edge Case 2: All Vouchers Used

**Steps**:
1. Find member with 0 remaining vouchers
2. Open bulk therapy plan modal
3. Try to create plans

**Expected**:
- Shows "Voucher Tersisa: 0"
- Green banner still shows unlimited mode
- Can still create plans (no validation error)

---

### 🔍 Edge Case 3: Package Expires During Session

**Steps**:
1. Open bulk therapy plan modal
2. Leave it open for 1 minute
3. In another tab, expire the member's package
4. Return to modal and try to submit

**Expected**:
- Should still work (no package validation)
- Backend will handle gracefully

---

## Browser Compatibility

Test in:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (if on Mac)

---

## Mobile Responsiveness

Test on:
- ✅ Mobile (portrait)
- ✅ Tablet (landscape)
- ✅ Desktop (large screen)

**Check**:
- Modal is full-screen
- Table scrolls horizontally
- Buttons are touch-friendly
- Add/remove buttons accessible

---

## Performance Test

**Steps**:
1. Create 50 therapy plans in one submission
2. Monitor:
   - Submit button shows spinner
   - No UI freezing
   - Success within 5 seconds
   - Page updates correctly

**Expected**:
- Fast creation (< 5 seconds)
- Smooth UI
- No errors

---

## Regression Test

Verify existing features still work:

### ✅ Single Therapy Plan Creation
- Still works from "Therapy Plans" tab
- "Buat Plan" button functional

### ✅ Edit Therapy Plan
- Edit button still works
- Creates new version correctly

### ✅ View Therapy Plan History
- "View Versions" button works
- Shows all versions

### ✅ Session Creation
- Can select therapy plan in session
- Superseded plans not selectable

---

## API Testing (Optional)

Using Postman or curl:

### Get Package Summary (No Package)
```bash
GET /api/v1/members/{memberId}/therapy-plans/package-summary
```

**Expected Response**:
```json
{
  "data": {
    "member": { ... },
    "package": null,
    "therapyPlans": {
      "existing": 0,
      "canCreate": 999,
      "maxRecommended": 999
    }
  }
}
```

### Bulk Create (No Validation)
```bash
POST /api/v1/members/{memberId}/therapy-plans/bulk
{
  "therapyPlans": [
    { "keterangan": "Terapi ke-1", "ifa250": 1, "hho": 5 },
    { "keterangan": "Terapi ke-2", "ifa250": 1, "hho": 5 }
  ]
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Berhasil membuat 2 therapy plans",
  "data": {
    "created": 2,
    "therapyPlans": [ ... ]
  }
}
```

---

## Sign-Off

**Tester Name**: _________________  
**Date**: _________________  
**Overall Result**: ✅ PASS / ❌ FAIL  

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## Rollback Plan (If Issues Found)

1. Revert `apps/api/src/modules/members/services/member-therapy-plan-bulk.service.ts`
2. Revert `apps/web/src/components/members/BulkTherapyPlanModal.tsx`
3. Revert `apps/web/src/lib/therapyPlanApi.ts`
4. Rebuild both projects
5. Redeploy

---

**Happy Testing! 🎉**
