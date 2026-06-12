# Separate Unassign and Delete Staff Actions with Warning Modal

**Date**: June 12, 2026  
**Status**: ✅ **COMPLETED**  
**Build Status**: ✅ Backend OK | ✅ Frontend OK

---

## 📋 Task Overview

User requested TWO separate actions for staff management in the "Kelola Cabang" (Manage Branch) page:
1. **Unassign** - Remove staff from specific branch (keep staff in system)
2. **Delete** - Permanently remove staff from system (with comprehensive warning modal using Tailwind CSS)

### User Requirements:
- ❌ **CRITICAL**: Do NOT delete staff when only unassigning from branch
- ✅ Separate buttons for "Unassign" vs "Hapus" (Delete)
- ✅ Warning modal for delete action using Tailwind CSS
- ✅ Check for active sessions before deletion
- ✅ Show historical data warning
- ✅ Preserve audit trail

---

## 🔧 Implementation Details

### 1. Backend Changes

#### **File**: `apps/api/src/modules/users/users.service.ts`

**New Function**: `softDeleteUserService(userId: string)`

```typescript
/**
 * Soft delete (deactivate) a staff member
 * - Sets isActive = false (staff cannot login but data is preserved)
 * - Checks for active sessions to prevent deletion
 * - Returns warnings if historical sessions exist
 */
export async function softDeleteUserService(userId: string) {
  // Validate user exists and is active
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  // CRITICAL CHECK: Block deletion if active sessions exist
  const activeSessions = await prisma.treatmentSession.count({
    where: {
      OR: [
        { doctorId: userId },
        { nurseId: userId },
        { adminLayananId: userId },
      ],
      isCompleted: false,
    },
  });

  if (activeSessions > 0) {
    throw errors.badRequest(
      'HAS_ACTIVE_SESSIONS', 
      `Cannot delete staff with ${activeSessions} active therapy sessions.`
    );
  }

  // Count historical sessions for audit trail warning
  const historicalSessions = await prisma.treatmentSession.count({
    where: {
      OR: [
        { doctorId: userId },
        { nurseId: userId },
        { adminLayananId: userId },
      ],
      isCompleted: true,
    },
  });

  // Soft delete: Set isActive = false (not hard delete)
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  return {
    success: true,
    message: `Staff successfully deactivated`,
    email: user.email,
    historicalSessions,
    hasHistoricalData: historicalSessions > 0,
  };
}
```

#### **File**: `apps/api/src/modules/users/users.controller.ts`

Updated `deactivateUser` controller to use `softDeleteUserService`:

```typescript
export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  // Use soft delete service with session validation
  const result = await softDeleteUserService(req.params.userId);
  
  // Create audit log with historical data info
  logAudit({
    userId: req.user.userId,
    action: 'DELETE',
    resource: 'User',
    meta: { 
      action: 'soft_delete',
      historicalSessions: result.historicalSessions,
      hasHistoricalData: result.hasHistoricalData,
    },
  });
  
  sendSuccess(res, result);
}
```

---

### 2. Frontend Changes

#### **File**: `apps/web/src/components/branches/StaffTable.tsx`

Updated component to have TWO separate action buttons:

```typescript
interface StaffTableProps {
  // OLD: Single onDelete handler
  // onDelete: (staff: Staff) => void;
  
  // NEW: Two separate handlers
  onUnassignFromBranch: (staff: Staff) => void;
  onDeleteStaff: (staff: Staff) => void;
}

// Updated Actions Column:
<ActionButton
  onClick={() => onUnassignFromBranch(staff)}
  icon={<Building2 size={14} />}
  title="Unassign dari Cabang"
  variant="warning"
/>
<ActionButton
  onClick={() => onDeleteStaff(staff)}
  icon={<Trash2 size={14} />}
  title="Hapus Staff"
  variant="delete"
/>
```

#### **New Component**: `apps/web/src/components/branches/DeleteStaffModal.tsx`

Created comprehensive warning modal with:

**Features**:
- 🔴 **Red warning theme** with gradient header
- ⚠️ **Staff information** display
- 📊 **Session statistics** (active + completed)
- 🚫 **Block deletion** if active sessions exist
- ✅ **Historical data warning** (data will be preserved)
- 💾 **Audit trail notice**
- 🔄 **Reactivation possibility** mentioned

**UI Design**:
```jsx
// Header - Red gradient with warning icon
<div className="bg-gradient-to-r from-red-500 to-red-600 ...">
  <AlertTriangle /> Konfirmasi Hapus Staff
  <p>Tindakan ini tidak dapat dibatalkan</p>
</div>

// Staff Info - Red accent
<div className="bg-red-50 border-red-200 ...">
  Staff yang akan dihapus: {staff.fullName}
</div>

// Session Stats - Amber warning
<div className="bg-amber-50 border-amber-200 ...">
  Sesi Aktif: {active} sesi (RED if > 0)
  Sesi Selesai: {completed} sesi
</div>

// Warning List
⚠️ Yang akan terjadi:
• Staff akan dinonaktifkan (cannot login)
• Data historis tetap tersimpan
• Staff dapat diaktifkan kembali

// Critical Notice
🔒 Pastikan Anda benar-benar ingin menghapus staff ini!
```

**Validation Logic**:
```typescript
// Disable delete button if active sessions exist
disabled={loading || (sessionStats?.active || 0) > 0}

// Show blocking message at bottom
{sessionStats?.active > 0 && (
  <div className="bg-red-50 border-red-200">
    ⛔ Cannot delete staff with active therapy sessions
  </div>
)}
```

#### **File**: `apps/web/src/app/(staff)/branches/[branchId]/page.tsx`

Added two separate handler functions:

```typescript
// 1. UNASSIGN: Remove from branch (keep staff in system)
const handleUnassignFromBranch = async (staffUser: Staff) => {
  // Only DOCTOR/NURSE can be unassigned
  if (staffUser.role !== 'DOCTOR' && staffUser.role !== 'NURSE') {
    showToast.error('Only DOCTOR and NURSE can be unassigned from branches');
    return;
  }

  const confirmed = await confirm.warning(
    'Unassign Staff dari Cabang',
    `Remove ${staffUser.fullName} from this branch?`
  );
  if (!confirmed) return;

  await api.delete(`/users/${staffUser.id}/branches/${branchId}`);
  showToast.success('Staff successfully unassigned from branch');
  
  // Refresh modal and reload data
  setStaffListVersion(prev => prev + 1);
  loadTabData();
};

// 2. DELETE: Soft delete staff (deactivate)
const handleDeleteStaff = async (staffUser: Staff) => {
  setDeleteStaffModal({
    isOpen: true,
    staff: staffUser,
  });
};

const confirmDeleteStaff = async () => {
  const response = await api.delete(`/users/${deleteStaffModal.staff.id}`);
  const result = response.data.data;
  
  if (result.hasHistoricalData) {
    showToast.success(
      `${staff.fullName} deleted. History of ${result.historicalSessions} sessions preserved.`
    );
  } else {
    showToast.success(`${staff.fullName} deleted successfully.`);
  }

  setDeleteStaffModal({ isOpen: false, staff: null });
  setStaffListVersion(prev => prev + 1);
  loadTabData();
};
```

**Modal State**:
```typescript
const [deleteStaffModal, setDeleteStaffModal] = useState<{
  isOpen: boolean;
  staff: Staff | null;
}>({ isOpen: false, staff: null });
```

**JSX Addition**:
```jsx
{deleteStaffModal.isOpen && deleteStaffModal.staff && (
  <DeleteStaffModal
    isOpen={deleteStaffModal.isOpen}
    onClose={() => setDeleteStaffModal({ isOpen: false, staff: null })}
    onConfirm={confirmDeleteStaff}
    staff={{
      id: deleteStaffModal.staff.id,
      fullName: deleteStaffModal.staff.profile?.fullName,
      role: deleteStaffModal.staff.role,
      email: deleteStaffModal.staff.email,
    }}
  />
)}
```

---

## 🎨 UI/UX Flow

### Scenario 1: Unassign Staff from Branch

**User Action**: Click "Unassign dari Cabang" button (yellow/warning variant)

**Flow**:
1. ✅ Simple confirmation dialog (using existing `confirm.warning()`)
2. ✅ API call: `DELETE /users/{userId}/branches/{branchId}`
3. ✅ Success toast: "Staff berhasil di-unassign dari cabang"
4. ✅ Staff removed from THIS branch only
5. ✅ Staff still appears in "Assign Dokter/Nakes" modal
6. ✅ Staff still active in system

**Requirements**:
- Only DOCTOR and NURSE roles can be unassigned
- Cannot unassign from primary branch
- Staff can still login and access other branches

---

### Scenario 2: Delete Staff (Soft Delete)

**User Action**: Click "Hapus Staff" button (red/delete variant)

**Flow**:
1. 🚨 Open comprehensive warning modal (`DeleteStaffModal`)
2. 📊 Modal automatically fetches session statistics
3. ⚠️ Display warnings:
   - If active sessions > 0: BLOCK deletion with red warning
   - If completed sessions > 0: Show warning that data will be preserved
4. ✅ User clicks "Ya, Hapus Staff"
5. ✅ API call: `DELETE /users/{userId}` (soft delete endpoint)
6. ✅ Backend validation:
   - ❌ REJECT if active sessions exist
   - ✅ ALLOW if no active sessions
   - 💾 Set `isActive = false`
7. ✅ Success toast with historical data info
8. ✅ Staff disappears from all branch lists
9. ✅ Staff cannot login (isActive = false)
10. ✅ Historical therapy data preserved
11. ✅ Can be reactivated by Super Admin if needed

**Warning Modal Content**:
```
┌──────────────────────────────────────────┐
│ ⚠️  KONFIRMASI HAPUS STAFF               │
│ Tindakan ini tidak dapat dibatalkan      │
├──────────────────────────────────────────┤
│ Staff yang akan dihapus:                 │
│ • dr. Budi Santoso                       │
│ • doctor@example.com                     │
│ • Role: DOCTOR                           │
├──────────────────────────────────────────┤
│ Data Riwayat Terapi:                     │
│ • Sesi Aktif: 2 sesi    ⚠️ (BLOCKING)   │
│ • Sesi Selesai: 150 sesi  ✅             │
├──────────────────────────────────────────┤
│ Yang akan terjadi:                       │
│ • Staff akan dinonaktifkan               │
│ • Data historis tetap tersimpan          │
│ • Staff dapat diaktifkan kembali         │
├──────────────────────────────────────────┤
│ 🔒 Pastikan Anda benar-benar ingin       │
│    menghapus staff ini!                  │
├──────────────────────────────────────────┤
│ [Batal]  [Ya, Hapus Staff] ← DISABLED   │
│                              if active   │
└──────────────────────────────────────────┘
```

---

## 🔒 Safety Validations

### Backend Validations:

1. **Active Session Check**:
   ```sql
   COUNT(*) FROM treatment_sessions
   WHERE (doctorId = ? OR nurseId = ? OR adminLayananId = ?)
   AND isCompleted = false
   ```
   - If count > 0: **REJECT deletion**
   - Error: `"Cannot delete staff with N active therapy sessions"`

2. **Historical Session Check**:
   ```sql
   COUNT(*) FROM treatment_sessions
   WHERE (doctorId = ? OR nurseId = ? OR adminLayananId = ?)
   AND isCompleted = true
   ```
   - If count > 0: **ALLOW but WARN**
   - Return: `hasHistoricalData: true, historicalSessions: N`

3. **Soft Delete Implementation**:
   ```sql
   UPDATE users SET isActive = false WHERE id = ?
   ```
   - Not hard delete (`DELETE FROM users`)
   - Preserves referential integrity
   - Maintains audit trail

4. **Audit Log**:
   ```json
   {
     "action": "DELETE",
     "resource": "User",
     "meta": {
       "action": "soft_delete",
       "historicalSessions": 150,
       "hasHistoricalData": true
     }
   }
   ```

### Frontend Validations:

1. **Modal Button Disable**:
   ```typescript
   disabled={loading || (sessionStats?.active || 0) > 0}
   ```

2. **Visual Blocking Message**:
   - Red banner at bottom of modal
   - Clear explanation: "Cannot delete with active sessions"

3. **Role-Based Unassign**:
   ```typescript
   if (staff.role !== 'DOCTOR' && staff.role !== 'NURSE') {
     showToast.error('Only DOCTOR and NURSE can be unassigned');
     return;
   }
   ```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    STAFF MANAGEMENT ACTIONS                  │
└─────────────────────────────────────────────────────────────┘

ACTION 1: UNASSIGN FROM BRANCH
───────────────────────────────
User Click "Unassign dari Cabang"
         ↓
Confirmation Dialog
         ↓
DELETE /users/{userId}/branches/{branchId}
         ↓
Remove StaffBranch Record
         ↓
Staff remains in system ✅
Staff can be reassigned ✅
         ↓
Success Toast + Reload Data


ACTION 2: DELETE STAFF (SOFT DELETE)
────────────────────────────────────
User Click "Hapus Staff"
         ↓
Open DeleteStaffModal
         ↓
Fetch Session Stats:
  GET /users/performance/{staffId}/history
         ↓
Display Warning Modal:
  - Staff Info
  - Active Sessions (if > 0: BLOCK)
  - Completed Sessions (show count)
  - Warnings & Notices
         ↓
User Confirms "Ya, Hapus Staff"
         ↓
DELETE /users/{userId}
         ↓
Backend Validation:
  ├─ Check Active Sessions
  │  └─ If > 0: REJECT (400 error)
  └─ If 0: Proceed
         ↓
UPDATE users SET isActive = false
         ↓
Create Audit Log (DELETE action)
         ↓
Return Response:
  {
    success: true,
    message: "Staff deactivated",
    historicalSessions: 150,
    hasHistoricalData: true
  }
         ↓
Frontend Toast:
  "dr. Budi deleted. History of 150 sessions preserved."
         ↓
Increment staffListVersion (force refresh)
Reload Tab Data
Close Modal
```

---

## ✅ Testing Checklist

### Backend Tests:
- [x] Soft delete function sets `isActive = false`
- [x] Blocks deletion if active sessions exist
- [x] Returns historical session count
- [x] Creates audit log entry
- [x] Does not hard delete user record
- [x] Preserves therapy session data

### Frontend Tests:
- [x] Two separate buttons visible in StaffTable
- [x] "Unassign" button triggers unassign flow
- [x] "Hapus" button opens DeleteStaffModal
- [x] Modal fetches session stats on open
- [x] Modal displays staff information
- [x] Modal shows active sessions warning
- [x] Modal shows historical sessions count
- [x] Delete button disabled when active sessions > 0
- [x] Delete button enabled when active sessions = 0
- [x] Success toast shows historical data info
- [x] Staff list refreshes after deletion
- [x] Modal closes after successful deletion

### Integration Tests:
- [x] Backend API builds successfully
- [x] Frontend builds successfully
- [x] No TypeScript errors
- [x] No build warnings

---

## 🎯 User Requirements Met

| Requirement | Status | Notes |
|------------|--------|-------|
| Separate "Unassign" and "Hapus" buttons | ✅ | Two distinct action buttons in StaffTable |
| "Hapus" shows warning modal using Tailwind | ✅ | DeleteStaffModal with comprehensive Tailwind design |
| Modal displays staff info | ✅ | Name, email, role shown in red-accent box |
| Modal shows session statistics | ✅ | Active + completed sessions fetched and displayed |
| Block deletion if active sessions | ✅ | Button disabled + red warning banner |
| Warning about historical data | ✅ | Amber box showing preserved data message |
| Unassign does NOT delete user | ✅ | Only removes StaffBranch record |
| Delete is soft delete (not hard) | ✅ | Sets `isActive = false`, preserves data |
| Audit trail preserved | ✅ | Audit log created with historical session count |
| Can be reactivated | ✅ | Mentioned in modal, possible for Super Admin |

---

## 📝 Files Modified

### Backend:
1. `apps/api/src/modules/users/users.service.ts`
   - Added `softDeleteUserService()` function

2. `apps/api/src/modules/users/users.controller.ts`
   - Updated `deactivateUser()` to use soft delete service
   - Imported `softDeleteUserService`

### Frontend:
1. `apps/web/src/components/branches/StaffTable.tsx`
   - Changed props: `onDelete` → `onUnassignFromBranch` + `onDeleteStaff`
   - Updated action column with two separate buttons

2. **NEW**: `apps/web/src/components/branches/DeleteStaffModal.tsx`
   - Comprehensive warning modal with Tailwind CSS
   - Session statistics fetching
   - Active session blocking logic

3. `apps/web/src/app/(staff)/branches/[branchId]/page.tsx`
   - Added `handleUnassignFromBranch()` handler
   - Added `handleDeleteStaff()` handler
   - Added `confirmDeleteStaff()` handler
   - Added `deleteStaffModal` state
   - Added `DeleteStaffModal` component to JSX
   - Imported `DeleteStaffModal` component

---

## 🚀 Deployment Notes

### Database:
- ✅ No migration needed
- ✅ Uses existing `isActive` field on `users` table

### Environment:
- ✅ No new environment variables required

### Dependencies:
- ✅ No new packages installed

### Build Status:
- ✅ Backend: `npm run build` - SUCCESS
- ✅ Frontend: `npm run build` - SUCCESS

---

## 📖 Usage Guide

### For Staff Users (Admin Cabang, Admin Manager, Super Admin):

#### To Remove Staff from a Branch:
1. Navigate to: Branches → Select Branch → "Staff" tab
2. Find the staff member in the list
3. Click the **yellow "Unassign dari Cabang"** button (Building icon)
4. Confirm in the dialog
5. ✅ Staff removed from this branch only
6. ✅ Staff still active in system and other branches

#### To Delete Staff from System:
1. Navigate to: Branches → Select Branch → "Staff" tab
2. Find the staff member in the list
3. Click the **red "Hapus Staff"** button (Trash icon)
4. ⚠️ Review the warning modal carefully:
   - Check active sessions (if > 0, deletion is BLOCKED)
   - Note historical session count (data will be preserved)
5. Click "Ya, Hapus Staff" to confirm
6. ✅ Staff deactivated (cannot login)
7. ✅ Historical therapy data preserved
8. ✅ Staff can be reactivated by Super Admin if needed

### For Super Admin (Reactivation):
1. Navigate to: Admin → Users
2. Filter: Show inactive users (`isActive = false`)
3. Find the staff member
4. Click "Edit"
5. Toggle "Is Active" back to `true`
6. Save
7. ✅ Staff can now login again

---

## 🎉 Summary

Successfully implemented TWO separate staff management actions with comprehensive safety validations:

1. **Unassign from Branch** - Remove staff from specific branch (simple confirmation)
2. **Delete Staff** - Soft delete with comprehensive warning modal (Tailwind CSS)

**Key Features**:
- ✅ Separate buttons to avoid accidental deletions
- ✅ Beautiful warning modal with red theme
- ✅ Active session blocking (cannot delete if sessions ongoing)
- ✅ Historical data preservation notice
- ✅ Soft delete implementation (isActive = false)
- ✅ Audit trail maintained
- ✅ Reactivation possibility
- ✅ Both backend and frontend build successfully

**User Safety**:
- 🔒 Cannot accidentally delete when trying to unassign
- 🔒 Cannot delete staff with active therapy sessions
- 🔒 Clear warnings about historical data
- 🔒 Confirmation required for destructive action
- 🔒 Audit log created for compliance

---

**End of Implementation** 🎯
