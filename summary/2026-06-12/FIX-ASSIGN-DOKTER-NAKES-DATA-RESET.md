# Fix Assign Dokter/Nakes - Data Reset & Testing

**Date:** 2026-06-12  
**Status:** ✅ COMPLETED  
**Issue:** Semua staff muncul sebagai "Assigned" padahal seharusnya tidak semua sudah di-assign

---

## 🔍 Root Cause

Browser masih **cache response lama** dari sebelum database direset. Data di database sudah benar setelah menjalankan `reset-staff-branches.ts`, tapi browser masih menampilkan data lama dengan `assignedBranches: Array(3)` untuk semua staff.

---

## ✅ Fixes Implemented

### 1. Database Reset
Menjalankan script untuk mereset `StaffBranch` assignments dengan data yang lebih realistis:

```bash
npx tsx scripts/reset-staff-branches.ts
```

**Result:**
- ✅ Deleted 13 existing StaffBranch assignments
- ✅ Created 10 new realistic assignments

**New Assignments:**

**Doctors:**
- dr. Budi Santoso → PST, SBY (2 branches)
- dr. Citra Wijaya → SBY only (1 branch)
- dr. Ahmad Fauzi → PST, SBY (2 branches)

**Nurses:**
- Siti Rahayu → BDG, SBY (2 branches)
- Dewi Lestari → PST only (1 branch)
- Eko Prasetyo → BDG, PST (2 branches)

### 2. Admin Manager Verification
Menjalankan script untuk memverifikasi Admin Manager punya managed branches:

```bash
npx tsx scripts/check-admin-manager-branches.ts
```

**Result:**
- ✅ Admin Manager Regional 1 (manager1@raho.id) manages: PST, BDG, TES
- ✅ Admin Manager Regional 2 (manager2@raho.id) manages: SBY, PST
- ✅ PST branch has 2 managers assigned

### 3. API Testing
Menjalankan comprehensive test untuk verify API response structure:

```bash
npx tsx scripts/test-assign-dokter-nakes.ts
```

**Result:**
- ✅ API returns correct structure with `assignedBranches` array
- ✅ Assignment logic is correct: `isAlreadyAssigned = assignedBranches.some(b => b.id === branchId)`
- ✅ For Bandung branch:
  - **Assigned (2):** Eko Prasetyo, Siti Rahayu
  - **NOT Assigned (4):** dr. Ahmad Fauzi, dr. Budi Santoso, dr. Citra Wijaya, Dewi Lestari

### 4. Fix Branch Staff List Query
**Problem:** Setelah assign dr. Budi Santoso ke branch "test 1", staff tersebut tidak muncul di tab Staff.

**Root Cause:** `listUsersService` hanya query berdasarkan `user.branchId` (primary branch), tidak include staff yang di-assign via `StaffBranch` table (multi-branch assignment).

**Fix:** Update `listUsersService` di `apps/api/src/modules/users/users.service.ts`:

**Before:**
```typescript
// Filter by branchId query param (manager/SA only)
...(branchId && callerRole !== Role.ADMIN_CABANG ? { branchId } : {}),
```

**After:**
```typescript
// Filter by branchId query param (manager/SA only)
// IMPORTANT: Include both primary branch AND staff assigned via StaffBranch
...(branchId && callerRole !== Role.ADMIN_CABANG
  ? {
      OR: [
        { branchId }, // Primary branch
        { staffBranches: { some: { branchId } } }, // Multi-branch assignment
      ],
    }
  : {}),
```

**Result:**
- ✅ Staff dengan `primaryBranchId !== branchId` akan muncul jika ada di `StaffBranch`
- ✅ dr. Budi Santoso (primary: BDG) akan muncul di "test 1" karena di-assign via StaffBranch

### 5. Fix Branch Stats Counter (NEW - Query #17)
**Problem:** Badge "STAFF AKTIF" di Overview masih menunjukkan "1" padahal ada 2 staff setelah assign dr. Budi Santoso.

**Root Cause:** `getBranchWithStatsService`, `listBranchesService`, dan `getAllBranchesWithStatsService` hanya count staff dengan `primaryBranchId`, tidak include multi-branch assignments.

**Fix:** Update 3 functions di `apps/api/src/modules/branches/branches.service.ts`:

**Before:**
```typescript
prisma.user.count({
  where: { 
    branchId, // Only primary branch
    isActive: true, 
    NOT: { role: { in: ['MEMBER', 'ADMIN_MANAGER'] } },
  },
})
```

**After:**
```typescript
prisma.user.count({
  where: { 
    OR: [
      { branchId }, // Primary branch
      { staffBranches: { some: { branchId } } }, // Multi-branch assignment
    ],
    isActive: true, 
    NOT: { role: { in: ['MEMBER', 'ADMIN_MANAGER'] } },
  },
})
```

**Functions Updated:**
1. ✅ `getBranchWithStatsService` - Branch detail stats
2. ✅ `listBranchesService` - Branch list with counts
3. ✅ `getAllBranchesWithStatsService` - All branches stats

**Result:**
- ✅ Badge "STAFF AKTIF" sekarang include multi-branch staff
- ✅ Counter akan show "2" setelah dr. Budi Santoso di-assign
- ✅ Backend build success

---

## 📊 Current Branch Assignment Summary

### RAHO Partnership Bandung (BDG)
**Assigned to Bandung:**
- ✅ Eko Prasetyo, Amd.Kep (NURSE)
- ✅ Siti Rahayu, Amd.Kep (NURSE)

**NOT Assigned to Bandung:**
- ❌ dr. Ahmad Fauzi, SpPD (DOCTOR) - assigned to PST, SBY
- ❌ dr. Budi Santoso, SpPD (DOCTOR) - assigned to PST, SBY
- ❌ dr. Citra Wijaya, SpPD (DOCTOR) - assigned to SBY only
- ❌ Dewi Lestari, Amd.Kep (NURSE) - assigned to PST only

### RAHO Premier Jakarta (PST)
**Assigned to Jakarta:**
- ✅ dr. Ahmad Fauzi, SpPD (DOCTOR)
- ✅ dr. Budi Santoso, SpPD (DOCTOR)
- ✅ Dewi Lestari, Amd.Kep (NURSE)
- ✅ Eko Prasetyo, Amd.Kep (NURSE)

**NOT Assigned to Jakarta:**
- ❌ dr. Citra Wijaya, SpPD (DOCTOR) - assigned to SBY only
- ❌ Siti Rahayu, Amd.Kep (NURSE) - assigned to BDG, SBY

### RAHO Premier Surabaya (SBY)
**Assigned to Surabaya:**
- ✅ dr. Ahmad Fauzi, SpPD (DOCTOR)
- ✅ dr. Budi Santoso, SpPD (DOCTOR)
- ✅ dr. Citra Wijaya, SpPD (DOCTOR)
- ✅ Siti Rahayu, Amd.Kep (NURSE)

**NOT Assigned to Surabaya:**
- ❌ Dewi Lestari, Amd.Kep (NURSE) - assigned to PST only
- ❌ Eko Prasetyo, Amd.Kep (NURSE) - assigned to BDG, PST

---

## 🧪 Testing Instructions

### For User (Browser Testing)

**⚠️ CRITICAL: You MUST do a HARD REFRESH to clear browser cache!**

1. **Clear Browser Cache:**
   - Press: `Ctrl + Shift + R` (Chrome/Edge)
   - Or: `Ctrl + F5`
   - Or: Open DevTools (F12) → Network tab → Check "Disable cache" → Refresh

2. **Login as Admin Manager:**
   - Email: `manager1@raho.id`
   - Password: `Manager123!`
   - Should see "Cab: PST" in header

3. **Navigate to Bandung Branch:**
   - Go to: Branches → RAHO Partnership Bandung
   - Click "Detail" or navigate to branch page

4. **Click "Assign Dokter/Nakes" Button:**
   - Should see modal with 6 medical staff members
   - Should see warning banner (amber/yellow) at top

5. **Verify Modal Display:**

   **Should show "Assigned" (gray, disabled button):**
   - ✅ Eko Prasetyo, Amd.Kep
     - Badge "BDG" should be GREEN
     - Button text: "Assigned" (gray)
   - ✅ Siti Rahayu, Amd.Kep
     - Badge "BDG" should be GREEN
     - Button text: "Assigned" (gray)

   **Should show "Assign" (green, enabled button):**
   - ❌ dr. Ahmad Fauzi, SpPD
     - Badges: PST, SBY (gray/white, NOT green)
     - Button text: "Assign" (green)
   - ❌ dr. Budi Santoso, SpPD
     - Badges: PST, SBY (gray/white)
     - Button text: "Assign" (green)
   - ❌ dr. Citra Wijaya, SpPD
     - Badges: SBY (gray/white)
     - Button text: "Assign" (green)
   - ❌ Dewi Lestari, Amd.Kep
     - Badges: PST (gray/white)
     - Button text: "Assign" (green)

6. **Test Assignment:**
   - Click "Assign" on dr. Citra Wijaya
   - Should show confirmation dialog with warning
   - Click "Ya, Assign"
   - Should see success toast
   - Modal should refresh
   - dr. Citra Wijaya should now show:
     - "BDG" badge in GREEN
     - Button text: "Assigned" (gray, disabled)

7. **Verify Console Logs:**
   - Open DevTools Console (F12)
   - Look for logs starting with `🔍 [AssignModal]`
   - Verify `isAlreadyAssigned` matches button state

---

## 🎯 Expected Console Output

When opening modal for **Bandung** branch, you should see:

```javascript
🔍 [AssignModal] Current branchId: cmpw2zizu002n114vs5o860lw
🔍 [AssignModal] Current branchName: RAHO Partnership Bandung
🔍 [AssignModal] Loaded staff: (6) [{…}, {…}, {…}, {…}, {…}, {…}]

// For staff NOT assigned to Bandung:
🔍 [AssignModal] dr. Ahmad Fauzi, SpPD: {assignedBranches: Array(2), isAlreadyAssigned: false}
🔍 [AssignModal] dr. Budi Santoso, SpPD: {assignedBranches: Array(2), isAlreadyAssigned: false}
🔍 [AssignModal] dr. Citra Wijaya, SpPD: {assignedBranches: Array(1), isAlreadyAssigned: false}
🔍 [AssignModal] Dewi Lestari, Amd.Kep: {assignedBranches: Array(1), isAlreadyAssigned: false}

// For staff ASSIGNED to Bandung:
🔍 [AssignModal] Eko Prasetyo, Amd.Kep: {assignedBranches: Array(2), isAlreadyAssigned: true}
🔍 [AssignModal] Siti Rahayu, Amd.Kep: {assignedBranches: Array(2), isAlreadyAssigned: true}
```

**❌ OLD (WRONG) Output** (before reset):
```javascript
// All staff showing Array(3) - THIS IS CACHED DATA!
🔍 [AssignModal] dr. Ahmad Fauzi, SpPD: {assignedBranches: Array(3), isAlreadyAssigned: true}
🔍 [AssignModal] dr. Budi Santoso, SpPD: {assignedBranches: Array(3), isAlreadyAssigned: true}
// ... all show isAlreadyAssigned: true
```

---

## 📁 Modified Files

### Scripts:
- ✅ `apps/api/scripts/reset-staff-branches.ts` (already existed, no changes)
- ✅ `apps/api/scripts/check-admin-manager-branches.ts` (fixed field name: `manager` → `user`)
- ✅ `apps/api/scripts/test-assign-dokter-nakes.ts` (already existed, no changes)

### Backend Code Changes:
- ✅ `apps/api/src/modules/users/users.service.ts` - Fixed `listUsersService` to include multi-branch assignments
  - Changed branchId filter from simple `{ branchId }` to `OR` condition
  - Now includes staff assigned via `StaffBranch` table
- ✅ `apps/api/src/modules/branches/branches.service.ts` - Fixed 3 functions to count multi-branch staff
  - `getBranchWithStatsService` - Branch detail stats
  - `listBranchesService` - Branch list with staff counts
  - `getAllBranchesWithStatsService` - All branches with stats

### No Frontend Changes Required:
- ✅ Frontend modal logic was already correct
- ✅ Backend assign API was already correct
- ✅ Admin Manager permissions were already correct

---

## 🔧 Build Status

### Backend:
```bash
npm run build --workspace=apps/api
```
✅ **SUCCESS** - No errors

### Frontend:
```bash
npm run build --workspace=apps/web
```
✅ **SUCCESS** - No errors

---

## 📝 Summary

### What Was Wrong:
1. ❌ Old seed data assigned ALL staff to ALL branches (unrealistic)
2. ❌ Browser cached old API responses showing `Array(3)` for all staff
3. ❌ User saw "isAlreadyAssigned: true" for all staff (cached data)
4. ❌ `listUsersService` only queried primary branch, not multi-branch assignments
5. ❌ **NEW:** Branch stats counter only counted primary branch staff

### What Was Fixed:
1. ✅ Database reset with realistic assignments (10 total, not 13)
2. ✅ API verified working correctly
3. ✅ Admin Manager has correct managed branches
4. ✅ Frontend logic is correct (no changes needed)
5. ✅ Backend query updated to include `StaffBranch` assignments (list & count)

### What User Needs to Do:
1. **HARD REFRESH browser** (Ctrl+Shift+R) to clear cache
2. Refresh the branch detail page to reload staff list and stats
3. Verify badge "STAFF AKTIF" now shows correct count
4. Verify assigned staff appear in Staff tab
5. Test assigning more staff if needed

---

## 🎓 Key Learnings

1. **Browser Cache:** After database changes, always hard refresh
2. **Console Logs:** Very useful for debugging - keep them in development
3. **Seed Data:** Should be realistic for proper testing
4. **Assignment Logic:** Works correctly when data is correct

---

## ✅ Task Complete

- ✅ Database reset with realistic data
- ✅ API verified working
- ✅ Admin Manager verified
- ✅ **Backend query fixed to include StaffBranch assignments (both list & count)**
- ✅ Backend build successful (2x)
- ✅ Ready for user testing

**Next Step:** User needs to refresh browser page and verify:
1. dr. Budi Santoso now appears in "test 1" Staff tab
2. Badge "STAFF AKTIF" shows "2" (not "1")!
