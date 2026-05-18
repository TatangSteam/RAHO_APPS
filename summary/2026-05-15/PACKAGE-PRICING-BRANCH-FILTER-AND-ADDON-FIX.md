# Package Pricing: Branch Filter & Addon Display Fix

**Date**: May 15, 2026  
**Status**: ✅ Completed

## Overview
Added branch filter functionality for Super Admin and Admin Manager, fixed the addon tab display issue, and added branch selection in the "Add Package Pricing" form.

---

## Changes Made

### 1. **Added Branch Filter State**
**File**: `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`

Added new state for branch filtering:
```typescript
const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
```

### 2. **Implemented Filter Logic**
Created filtering logic that:
- Filters packages by selected branch
- Supports "all branches" view
- Supports "global" (no branch) packages
- Maintains the grouped display structure

```typescript
const filteredPricings = selectedBranchFilter === 'all' 
  ? pricings 
  : pricings.filter(p => {
      if (selectedBranchFilter === 'global') {
        return !p.branchId;
      }
      return p.branchId === selectedBranchFilter;
    });
```

### 3. **Added Branch Filter Dropdown**
**Location**: Header section, next to "Tambah" button

**Features**:
- Only visible to SUPER_ADMIN and ADMIN_MANAGER
- Only shows on "Paket Terapi" tab
- Dark theme styling matching the application
- Options include:
  - 🏢 Semua Cabang (All branches)
  - 🌐 Global (if global packages exist)
  - Individual branches with code and name

### 4. **Fixed Addon Tab Display Issue**
**Problem**: Addon tab had incorrect conditional rendering structure

**Solution**: Fixed the ternary operator structure:
```typescript
// Before (incorrect nesting)
) : (
  /* ADD-ON TAB */
  products.length === 0 ? (

// After (correct structure)
) : activeTab === 'addons' ? (
  /* ADD-ON TAB */
  products.length === 0 ? (
```

### 5. **Added Branch Selection in Form** ⭐ NEW
**Location**: "Tambah Harga Paket" modal form

**Features**:
- Added `branchId` field to form state
- Added branches state to store available branches
- Added `loadBranches()` function to fetch branches from API
- Added dropdown field in form (after "Nama Paket" field)
- Only visible to SUPER_ADMIN and ADMIN_MANAGER
- Only shown when creating new pricing (not when editing)
- Options include:
  - 🌐 Global (Semua Cabang) - default/empty value
  - Individual branches with code and name
- Hint text explains the purpose

**Form Logic**:
```typescript
// Priority when creating:
// 1. Selected branch from dropdown (for SUPER_ADMIN/ADMIN_MANAGER)
// 2. User's branch (for ADMIN_CABANG)
// 3. null/undefined (Global pricing)

if (formData.branchId) {
  payload.branchId = formData.branchId;
} else if (isAdminCabang && user?.branchId) {
  payload.branchId = user.branchId;
}
```

### 6. **Added CSS Styling**
**File**: `apps/web/src/app/(staff)/admin/package-pricing/page.module.css`

Added `.branchFilter` class with:
- Dark theme gradient background
- Blue border with hover/focus states
- Proper option styling
- Smooth transitions

---

## Technical Details

### Branch Filter Logic
1. **State Management**: Uses `selectedBranchFilter` state to track selected branch
2. **Data Filtering**: Filters `pricings` array before grouping
3. **Unique Branches**: Extracts unique branches from pricing data for dropdown options
4. **Global Detection**: Checks if any global (non-branch-specific) packages exist

### Branch Selection in Form
1. **State Management**: 
   - Added `branchId` to `formData` state
   - Added `branches` state for available branches list
2. **Data Loading**: 
   - `loadBranches()` fetches branches from `/branches` endpoint
   - Only loads for SUPER_ADMIN and ADMIN_MANAGER
3. **Form Behavior**:
   - Dropdown only visible when creating (not editing)
   - Default value is empty string (Global)
   - Updates `formData.branchId` on selection
4. **Submit Logic**:
   - Checks `formData.branchId` first
   - Falls back to `user.branchId` for ADMIN_CABANG
   - Sends as `null` if neither exists (Global pricing)

### Conditional Rendering Fix
The addon tab was nested incorrectly in the else clause. Fixed by:
1. Properly closing the packages tab conditional
2. Adding explicit `activeTab === 'addons'` check
3. Ensuring master tab remains separate with its own conditional

---

## User Experience

### For Super Admin / Admin Manager:

**Viewing Packages:**
1. **View All Branches**: Default view shows all packages grouped by branch
2. **Filter by Branch**: Select specific branch to see only that branch's packages
3. **View Global**: Select "Global" to see packages available to all branches

**Creating Package Pricing:**
1. Click "Tambah Harga Paket"
2. Fill in package details
3. **NEW**: Select branch from dropdown or leave as "Global"
   - Global: Package available to all branches
   - Specific branch: Package only for that branch
4. Submit form

### For Admin Cabang:
- No filter dropdown (only sees their own branch)
- No branch selection in form (automatically uses their branch)
- Addon tab works correctly

---

## Testing Checklist

**Branch Filter:**
- [x] Branch filter dropdown appears for SUPER_ADMIN
- [x] Branch filter dropdown appears for ADMIN_MANAGER
- [x] Branch filter dropdown hidden for ADMIN_CABANG
- [x] "Semua Cabang" option shows all packages
- [x] Individual branch selection filters correctly
- [x] "Global" option shows only global packages (if any exist)

**Branch Selection in Form:**
- [x] Branch dropdown appears for SUPER_ADMIN when creating
- [x] Branch dropdown appears for ADMIN_MANAGER when creating
- [x] Branch dropdown hidden for ADMIN_CABANG
- [x] Branch dropdown hidden when editing
- [x] Default value is "Global (Semua Cabang)"
- [x] Can select specific branch
- [x] Form submits with correct branchId
- [x] Global pricing created when no branch selected
- [x] Branch-specific pricing created when branch selected

**Other Features:**
- [x] Addon tab displays products correctly
- [x] Addon tab shows Air Nano products
- [x] Addon tab shows Rokok Kenkou products
- [x] Master Data tab still works correctly
- [x] No TypeScript errors
- [x] Dark theme styling consistent

---

## Files Modified

1. `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`
   - Added branch filter state
   - Added filter logic
   - Added filter dropdown UI
   - Fixed addon tab conditional rendering
   - **Added branches state**
   - **Added loadBranches() function**
   - **Added branchId to formData**
   - **Added branch selection dropdown in form**
   - **Updated handleSubmit logic for branchId**
   - **Updated resetForm to include branchId**
   - **Updated handleEdit to include branchId**

2. `apps/web/src/app/(staff)/admin/package-pricing/page.module.css`
   - Added `.branchFilter` class
   - Added option styling

---

## API Integration

### Endpoints Used:
1. `GET /branches` - Fetch available branches for dropdown
2. `POST /admin/package-pricing` - Create pricing with optional branchId
3. `GET /admin/package-pricing` - Fetch pricings (already filtered by backend)

### Payload Example:
```json
{
  "packageType": "BASIC",
  "name": "Terapi Nano Bubble 7X",
  "totalSessions": 7,
  "price": 12500000,
  "branchId": "branch-uuid-here",  // Optional: null for global
  "isActive": true
}
```

---

## Related Issues

- ✅ Branch filter per cabang (requested feature)
- ✅ Addon tidak muncul (bug fix)
- ✅ **Tambah harga paket ada cabangnya (requested feature)** ⭐ NEW

---

## Notes

- Filter only applies to "Paket Terapi" tab
- Addon and Master Data tabs are not filtered by branch
- Filter state resets when switching tabs
- Empty state messages remain appropriate for filtered views
- **Branch selection only available when creating new pricing**
- **Branch cannot be changed after pricing is created**
- **ADMIN_CABANG automatically gets their branch assigned**
- **Global pricing (no branch) is available to all branches**
