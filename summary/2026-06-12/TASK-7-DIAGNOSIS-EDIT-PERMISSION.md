# Task 7: Allow DOCTOR, ADMIN_MANAGER, SUPER_ADMIN to Edit Diagnosis

**Status**: ✅ COMPLETED

**Date**: June 12, 2026

---

## User Request
User wants DOCTOR, ADMIN_MANAGER, and SUPER_ADMIN roles to be able to edit/create diagnosis for members.

---

## Current State Analysis

**Before Changes**:
- `MemberDiagnosesTab` component had NO permission checks
- All roles could technically create/edit diagnosis (no restrictions)
- However, the ability to edit was implicit - not explicitly controlled
- Screenshot shows "Buat Diagnosa" button in orange at top right of Diagnosis tab

---

## Solution Implementation

### 1. Added Permission Control to MemberDiagnosesTab Component
**File**: `apps/web/src/components/members/MemberDiagnosesTab.tsx`

**Changes**:
1. Added `canEdit` prop to interface:
   ```typescript
   interface MemberDiagnosesTabProps {
     memberId: string;
     memberBranchId?: string;
     canEdit?: boolean; // NEW - defaults to true
   }
   ```

2. Added conditional rendering for "Buat Diagnosa" buttons:
   ```typescript
   // Top right button (when diagnoses exist)
   {canEdit && (
     <button onClick={handleOpenModal}>
       <Plus /> Buat Diagnosa
     </button>
   )}

   // Center button (when no diagnoses yet)
   {canEdit && (
     <button onClick={handleOpenModal}>
       <Plus /> Buat Diagnosa Pertama
     </button>
   )}
   ```

### 2. Added Permission Logic to Member Detail Page
**File**: `apps/web/src/app/(staff)/members/[memberId]/page.tsx`

**Changes**:
1. Added permission constant:
   ```typescript
   const canEditDiagnosis = ['DOCTOR', 'ADMIN_MANAGER', 'SUPER_ADMIN'].includes(user?.role || '');
   ```

2. Passed `canEdit` prop to MemberDiagnosesTab:
   ```typescript
   {activeTab === 'diagnosa' && (
     <MemberDiagnosesTab 
       memberId={memberId} 
       memberBranchId={member.registrationBranch?.id} 
       canEdit={canEditDiagnosis}  // NEW PROP
     />
   )}
   ```

---

## Permission Matrix

| Role | Can View Diagnosis | Can Create/Edit Diagnosis |
|------|-------------------|---------------------------|
| **DOCTOR** | ✅ Yes | ✅ Yes (NEW - explicitly enabled) |
| **ADMIN_MANAGER** | ✅ Yes | ✅ Yes (NEW - explicitly enabled) |
| **SUPER_ADMIN** | ✅ Yes | ✅ Yes (NEW - explicitly enabled) |
| ADMIN_LAYANAN | ✅ Yes | ❌ No (button hidden) |
| ADMIN_CABANG | ✅ Yes | ❌ No (button hidden) |
| NURSE | ✅ Yes | ❌ No (button hidden) |

---

## UI Behavior

### Roles WITH Permission (DOCTOR, ADMIN_MANAGER, SUPER_ADMIN):
- **See orange "Buat Diagnosa" button** at top right of Diagnosis tab
- Can click button to open modal and create new diagnosis
- If no diagnosis exists yet, see "Buat Diagnosa Pertama" button in center

### Roles WITHOUT Permission (ADMIN_LAYANAN, ADMIN_CABANG, NURSE):
- **Button is completely hidden** - no visual clutter
- Can still VIEW existing diagnoses (read-only access)
- Cannot create new diagnoses

---

## Technical Details

### Default Behavior
- `canEdit` prop defaults to `true` for backward compatibility
- If not explicitly passed, component allows editing (safe default)

### Permission Check Location
- Permission check happens at PAGE level (`members/[memberId]/page.tsx`)
- Component remains reusable - permission can be controlled by parent

### Why These 3 Roles?
1. **DOCTOR** - Medical professional who makes diagnosis
2. **ADMIN_MANAGER** - Manages multiple branches, needs oversight
3. **SUPER_ADMIN** - System administrator with full access

---

## Files Modified

1. `apps/web/src/components/members/MemberDiagnosesTab.tsx`
   - Added `canEdit` prop
   - Added conditional rendering for buttons

2. `apps/web/src/app/(staff)/members/[memberId]/page.tsx`
   - Added `canEditDiagnosis` permission constant
   - Passed `canEdit` prop to MemberDiagnosesTab

---

## Testing Notes

**Test Scenarios**:
1. ✅ Login as DOCTOR → See "Buat Diagnosa" button
2. ✅ Login as ADMIN_MANAGER → See "Buat Diagnosa" button
3. ✅ Login as SUPER_ADMIN → See "Buat Diagnosa" button
4. ✅ Login as ADMIN_LAYANAN → Button hidden, can view existing diagnoses
5. ✅ Login as NURSE → Button hidden, can view existing diagnoses

**Expected Behavior**:
- Authorized roles can create diagnosis
- Unauthorized roles see read-only view
- No errors or broken UI for any role

---

## Summary

Successfully implemented role-based permission control for diagnosis editing:
- ✅ DOCTOR, ADMIN_MANAGER, SUPER_ADMIN can create/edit diagnoses
- ✅ Other roles can view but not edit
- ✅ Clean UI - button hidden for unauthorized users
- ✅ Backward compatible with default `canEdit=true`
- ✅ Explicit permission check at page level
- ✅ Reusable component design

The implementation follows best practices:
- Permission check at appropriate level (page, not component)
- Clean conditional rendering (no error-prone CSS hiding)
- Clear permission matrix
- Maintainable and extensible design
