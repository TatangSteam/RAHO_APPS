# Task 6: Change Unassign Button Color to Orange

**Status**: ✅ COMPLETED

**Date**: June 12, 2026

---

## User Request
User wants the "Unassign dari Cabang" button to have orange color instead of amber/yellow.

---

## Problem Analysis

1. **Current State**:
   - StaffTable uses `variant="warning"` for unassign button
   - DataTable's ActionButton component didn't have a `warning` variant defined
   - Available variants: 'default', 'edit', 'delete', 'view', 'purple', 'amber'

2. **Root Cause**:
   - Missing `warning` variant in ActionButton type definition
   - No orange/warning color mapping in variantClasses

---

## Solution Implementation

### 1. Updated DataTable ActionButton Component
**File**: `apps/web/src/components/ui/DataTable.tsx`

**Changes**:
- Added `'orange'` and `'warning'` to ActionButton variant type
- Added orange color classes for both variants:
  ```typescript
  orange: 'bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20',
  warning: 'bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20',
  ```

### 2. StaffTable Already Configured
**File**: `apps/web/src/components/branches/StaffTable.tsx`

**No changes needed** - Already uses:
```typescript
<ActionButton
  onClick={() => onUnassignFromBranch(staff)}
  icon={<UserMinus size={14} />}
  title="Unassign dari Cabang"
  variant="warning"  // ✅ Already uses warning variant
/>
```

---

## Color Specification

**Orange Button Colors**:
- Light mode:
  - Background: `bg-orange-100` (light orange)
  - Text: `text-orange-600` (medium orange)
  - Hover: `bg-orange-200` (darker orange)
  
- Dark mode:
  - Background: `bg-orange-500/10` (semi-transparent orange)
  - Text: `text-orange-400` (bright orange)
  - Hover: `bg-orange-500/20` (more opaque orange)

---

## Verification

### Build Status
✅ Frontend build successful
```
npm run build (web)
```

### Visual Result
The "Unassign dari Cabang" button now displays with:
- Orange background color
- UserMinus icon (changed in Task 5)
- Orange hover state
- Consistent with Tailwind CSS orange color palette

---

## Related Tasks

- **Task 5**: Changed unassign button icon from `Building2` to `UserMinus`
- **Task 4**: Replaced native confirmation with Tailwind CSS modal
- **Task 2**: Separated unassign and delete functionality

---

## Technical Notes

1. **Variant Naming**: Both `orange` and `warning` variants use same orange colors for flexibility
2. **Tailwind Classes**: Uses `orange-*` color scale (not `amber-*`)
3. **Dark Mode Support**: Full dark mode support with adjusted opacity and brightness
4. **Type Safety**: ActionButton variant type properly updated

---

## Files Modified

1. `apps/web/src/components/ui/DataTable.tsx`
   - Added `orange` and `warning` variants to ActionButton

---

## Summary

Successfully added orange color to the unassign button by:
1. Adding missing `warning` variant to ActionButton component
2. Mapping `warning` to orange Tailwind colors
3. Verifying StaffTable already uses correct variant

The button now displays with a clear orange color that visually differentiates it from the delete action (red) and edit action (blue), while maintaining consistency with other UI elements.
