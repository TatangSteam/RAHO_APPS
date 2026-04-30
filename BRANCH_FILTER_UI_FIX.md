# Branch Filter UI Fix for ADMIN_CABANG

## Problem
ADMIN_CABANG users were seeing a branch filter dropdown in the referrals page, even though they can only access data from their own branch. This was confusing because:
1. The backend correctly filters data to show only their branch
2. The UI showed a dropdown suggesting they could filter by other branches
3. This created a misleading user experience

## Solution
Hide the branch filter dropdown for ADMIN_CABANG users while keeping it visible for other roles (SUPER_ADMIN, ADMIN_MANAGER, ADMIN_LAYANAN).

## Changes Made

### Frontend: `apps/web/src/app/(staff)/referrals/page.tsx`

1. **Import auth store**:
   ```typescript
   import { useAuthStore } from '@/stores/authStore';
   ```

2. **Get user role**:
   ```typescript
   const user = useAuthStore((state) => state.user);
   const isAdminCabang = user?.role === 'ADMIN_CABANG';
   ```

3. **Skip fetching branches for ADMIN_CABANG**:
   ```typescript
   const fetchBranches = async () => {
     // Only fetch branches if user is not ADMIN_CABANG
     if (isAdminCabang) return;
     
     try {
       const response = await branchesApi.getAllBranches();
       setBranches(response.data.data);
     } catch (error) {
       console.error('Error fetching branches:', error);
     }
   };
   ```

4. **Conditionally render branch filter dropdown**:
   ```typescript
   {/* Hide branch filter for ADMIN_CABANG */}
   {!isAdminCabang && (
     <select
       value={branchFilter}
       onChange={(e) => {
         setBranchFilter(e.target.value);
         setPage(1);
       }}
       className={styles.filterSelect}
     >
       <option value="">Semua Cabang</option>
       {branches.map((branch) => (
         <option key={branch.id} value={branch.id}>
           {branch.name}
         </option>
       ))}
     </select>
   )}
   ```

### Backend: No Changes Required
The backend filtering in `apps/api/src/modules/referrals/referrals.service.ts` was already correctly implemented:
- ADMIN_CABANG users are automatically filtered to see only their branch's referrals
- The `where.branchId` is set based on `userBranchId` or from `staffBranches` relation
- This filtering happens server-side and cannot be bypassed

## User Experience

### Before Fix
- ADMIN_CABANG saw a branch filter dropdown
- Dropdown showed "Semua Cabang" option
- Confusing because they could only see their own branch anyway

### After Fix
- ADMIN_CABANG sees only search and type filters
- No branch dropdown visible
- Cleaner UI that matches their actual permissions
- Other roles (SUPER_ADMIN, ADMIN_MANAGER, ADMIN_LAYANAN) still see the branch filter

## Testing Checklist
- [x] ADMIN_CABANG users don't see branch filter dropdown
- [x] ADMIN_CABANG users still see only their branch's referrals (backend filter works)
- [x] SUPER_ADMIN users see branch filter dropdown
- [x] ADMIN_MANAGER users see branch filter dropdown
- [x] ADMIN_LAYANAN users see branch filter dropdown
- [x] Search and type filters work for all roles
- [x] No API errors when ADMIN_CABANG accesses the page

## Files Modified
1. `apps/web/src/app/(staff)/referrals/page.tsx` - Hide branch filter for ADMIN_CABANG

## Related Issues
- Task 7: Fixed referral code errors for ADMIN_CABANG (backend filtering)
- Task 8: Remove branch filter dropdown for ADMIN_CABANG (UI fix)
