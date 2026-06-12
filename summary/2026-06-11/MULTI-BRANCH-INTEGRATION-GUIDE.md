# Multi-Branch Integration Guide

**Date:** 11 Juni 2026  
**Feature:** Multi-Branch Assignment Integration  
**Status:** ✅ Ready for Integration

---

## 🎯 Quick Start

Fitur multi-branch assignment sudah siap digunakan. Yang perlu dilakukan adalah **integrasi dengan UI Admin Manager** untuk menambahkan button "Kelola Cabang" pada staff list.

---

## 📋 Integration Steps

### Step 1: Add "Kelola Cabang" Button to Staff List

Tambahkan button di staff table/list yang sudah ada:

```tsx
// In your staff list component (e.g., StaffTable.tsx)
import { useState } from 'react';
import { StaffBranchModal } from '@/components/admin/StaffBranchModal';

export function StaffTable() {
  const [selectedStaff, setSelectedStaff] = useState<{
    userId: string;
    userName: string;
    userRole: string;
  } | null>(null);

  return (
    <>
      <table>
        {/* ... existing table headers */}
        <tbody>
          {staffList.map((staff) => (
            <tr key={staff.id}>
              {/* ... existing columns */}
              <td>
                {/* Only show for DOCTOR and NURSE */}
                {(staff.role === 'DOCTOR' || staff.role === 'NURSE') && (
                  <button
                    onClick={() =>
                      setSelectedStaff({
                        userId: staff.id,
                        userName: staff.fullName,
                        userRole: staff.role,
                      })
                    }
                  >
                    Kelola Cabang
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal */}
      {selectedStaff && (
        <StaffBranchModal
          userId={selectedStaff.userId}
          userName={selectedStaff.userName}
          userRole={selectedStaff.userRole}
          onClose={() => setSelectedStaff(null)}
          onSuccess={() => {
            // Optional: refresh staff list if needed
            refetchStaff();
          }}
        />
      )}
    </>
  );
}
```

### Step 2: Update Dashboard Queries (Optional but Recommended)

Update dashboard queries untuk menggunakan `activeBranchId` dari auth store:

```tsx
// In dashboard page
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  // Use activeBranchId instead of user.branchId
  const branchId = activeBranchId || user?.branchId;

  // Pass to API calls
  const { data } = await dashboardApi.getBranchDashboard(
    startDate,
    endDate,
    branchId
  );
}
```

---

## 🧪 Manual Testing Steps

### 1. Test Assignment (Admin Manager)

1. Login sebagai **Admin Manager**
2. Navigate ke staff list/management page
3. Find a **DOCTOR** or **NURSE** in the list
4. Click **"Kelola Cabang"** button
5. Modal should open showing:
   - Assigned branches (with ⭐ for primary)
   - Available branches to add
6. Click **"Tambah"** on an available branch
   - Should see success toast
   - Branch should move to "Assigned" section
7. Click **"Hapus"** on a non-primary branch
   - Confirm deletion
   - Should see success toast
   - Branch should move back to "Available"
8. Try to remove primary branch
   - Button should be **disabled**
   - Tooltip: "Cabang utama tidak dapat dihapus"

### 2. Test Branch Switching (Doctor/Nurse)

1. Login sebagai **DOCTOR** yang sudah di-assign ke 2+ cabang
2. Check header - should see **BranchSwitcher** component
   - Shows current branch name with dropdown arrow
   - Format: `🏥 RAHO - Pusat ▼`
3. Click the branch switcher
   - Dropdown opens showing all assigned branches
   - Primary branch has **⭐** badge
   - Active branch has **✓** checkmark
4. Select different branch
   - Page reloads
   - Header should show new branch name
5. Refresh page (F5)
   - Active branch should persist
   - Still showing the last selected branch
6. Check dashboard
   - Should show data for active branch
   - Members, sessions should be from active branch only

### 3. Test Single Branch (No Switcher)

1. Login sebagai **DOCTOR** dengan hanya 1 cabang
2. Check header - **BranchSwitcher should NOT appear**
3. Dashboard shows data from primary branch only

### 4. Test Non-Medical Staff

1. Login sebagai **ADMIN_LAYANAN** atau **ADMIN_CABANG**
2. **BranchSwitcher should NOT appear**
3. Staff list should NOT show "Kelola Cabang" button
4. Behavior unchanged from before

---

## 🔍 Verification Checklist

### Backend
- [x] API builds successfully (`npm run build` in apps/api)
- [x] `StaffBranchAssignmentService` exists
- [x] All endpoints defined in routes
- [x] Authentication middleware loads branches
- [ ] Test POST `/api/users/:userId/branches` (assign)
- [ ] Test DELETE `/api/users/:userId/branches/:branchId` (remove)
- [ ] Test GET `/api/users/:userId/branches` (list)
- [ ] Verify audit logs created

### Frontend
- [x] Web builds successfully (`npm run build` in apps/web)
- [x] `BranchSwitcher` component created
- [x] `StaffBranchModal` component created
- [x] `staffBranchApi` client created
- [x] Auth store supports `activeBranchId`
- [x] BranchSwitcher added to Header
- [ ] Manual test: open app, see no errors
- [ ] Manual test: BranchSwitcher appears for multi-branch doctors
- [ ] Manual test: StaffBranchModal opens and works
- [ ] Manual test: Active branch persists after refresh

### Integration
- [ ] "Kelola Cabang" button added to staff list
- [ ] Modal opens when button clicked
- [ ] Can assign branches successfully
- [ ] Can remove branches successfully
- [ ] Dashboard uses activeBranchId
- [ ] Data isolation verified (no cross-branch data leakage)

---

## 📂 Files Modified/Created

### Backend (Complete)
```
✅ apps/api/src/modules/users/services/staff-branch-assignment.service.ts (NEW)
✅ apps/api/src/modules/users/users.controller.ts (UPDATED)
✅ apps/api/src/middleware/authenticate.ts (UPDATED)
✅ apps/api/src/lib/jwt.ts (UPDATED)
```

### Frontend (Complete)
```
✅ apps/web/src/lib/api/staffBranchApi.ts (NEW)
✅ apps/web/src/stores/authStore.ts (UPDATED)
✅ apps/web/src/components/layout/BranchSwitcher.tsx (NEW)
✅ apps/web/src/components/layout/BranchSwitcher.module.css (NEW)
✅ apps/web/src/components/layout/Header.tsx (UPDATED)
✅ apps/web/src/components/admin/StaffBranchModal.tsx (NEW)
✅ apps/web/src/components/admin/StaffBranchModal.module.css (NEW)
```

### Pending Integration
```
⏳ Staff list/table component - Add "Kelola Cabang" button
⏳ Dashboard queries - Use activeBranchId (optional but recommended)
```

---

## 🚨 Common Issues & Solutions

### Issue 1: BranchSwitcher not appearing
**Cause:** User only has 1 branch OR user is not DOCTOR/NURSE  
**Solution:** Check user.role and number of assigned branches  
**Debug:**
```typescript
console.log('User:', user);
console.log('Branches:', branches);
console.log('Should show:', branches.length > 1 && (user.role === 'DOCTOR' || user.role === 'NURSE'));
```

### Issue 2: Modal doesn't load branches
**Cause:** API endpoint returning error OR userId invalid  
**Solution:** Check browser console and network tab  
**Debug:**
```typescript
// In StaffBranchModal, add console.logs
console.log('Loading branches for userId:', userId);
```

### Issue 3: Branch switch doesn't update dashboard
**Cause:** Dashboard queries still using `user.branchId` instead of `activeBranchId`  
**Solution:** Update dashboard to use active branch:
```typescript
const activeBranchId = useAuthStore((s) => s.activeBranchId);
const branchId = activeBranchId || user?.branchId;
```

### Issue 4: Active branch doesn't persist after refresh
**Cause:** localStorage not set OR auth store not rehydrating  
**Solution:** Check localStorage for `activeBranchId` key  
**Debug:**
```typescript
console.log('LocalStorage:', localStorage.getItem('activeBranchId'));
console.log('Store:', useAuthStore.getState().activeBranchId);
```

---

## 🎨 Styling Guide

### BranchSwitcher Colors
The component uses CSS variables for theming:
- `--primary` - Active state color
- `--border` - Border color
- `--background` - Background color
- `--foreground` - Text color

### Modal Responsive Breakpoints
- Desktop: 600px max width, full height
- Mobile: Full width, stacked buttons

---

## 🔐 Security Notes

1. **Authorization**
   - Only ADMIN_MANAGER and SUPER_ADMIN can manage assignments
   - Admin Manager restricted to managed branches only

2. **Validation**
   - Cannot remove primary branch
   - Cannot assign same branch twice
   - Only DOCTOR/NURSE can have multi-branch

3. **Audit Trail**
   - All assignments/removals logged
   - Shows who performed action and when

---

## 📞 Support & Debugging

### Check Backend Logs
```bash
# Check if branches are being loaded
grep "assigned branches" logs/app.log
```

### Check Database
```sql
-- See all staff branch assignments
SELECT 
  u.email,
  u.role,
  u.branchId as primary_branch,
  sb.branchId as assigned_branch,
  b.name as branch_name
FROM users u
LEFT JOIN staff_branches sb ON sb.userId = u.id
LEFT JOIN branches b ON b.id = sb.branchId
WHERE u.role IN ('DOCTOR', 'NURSE');
```

### Check Frontend State
```typescript
// In browser console
JSON.parse(localStorage.getItem('auth-storage'))
```

---

## ✅ Next Actions

1. **Add "Kelola Cabang" button to staff list**
   - Location: Find where staff are listed for Admin Manager
   - Action: Import `StaffBranchModal` and add button

2. **Test full flow**
   - Assign doctor to 2nd branch
   - Login as doctor
   - See BranchSwitcher in header
   - Switch branches
   - Verify data changes

3. **Update dashboard queries (optional)**
   - Use `activeBranchId` instead of `user.branchId`
   - Ensures dashboard respects active branch

4. **Deploy to staging**
   - Test with real data
   - Verify no performance issues
   - Check audit logs

---

**Ready for Integration:** ✅  
**Blocked By:** Nothing - All components ready  
**Estimated Time:** 30-60 minutes untuk integration  
**Risk Level:** Low - Backward compatible, no breaking changes
