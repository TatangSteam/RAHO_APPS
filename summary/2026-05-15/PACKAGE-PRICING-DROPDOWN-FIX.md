# Package Pricing: Dropdown Visibility & Dynamic Options Fix

**Date**: May 15, 2026  
**Status**: ✅ Completed

## Overview
Fixed dropdown text visibility issues and added dynamic options for Tipe Booster and Tipe Layanan with fallback to hardcoded values.

---

## Issues Fixed

### 1. **Dropdown Text Not Visible**
**Problem**: Text in dropdown options was not visible due to missing CSS styling for `<option>` elements.

**Solution**: Added explicit styling for dropdown options in CSS:
```css
.formInput option {
  background: #1e293b;
  color: #f1f5f9;
  padding: 0.75rem;
  font-weight: 600;
}
```

### 2. **All Booster and Service Types Disappeared**
**Problem**: After changing to use master data, all hardcoded options (NO, GT, MB, KCL, H2S, HK, O3, PM, PS, PTY, PDA, PHC) disappeared because master data was empty.

**Solution**: Implemented hybrid approach:
- Show hardcoded default options FIRST
- Show additional options from master data (if any)
- Filter out duplicates from master data
- Add "Tambah Baru" option at the end

---

## Changes Made

### 1. **CSS Fix for Dropdown Options**
**File**: `apps/web/src/app/(staff)/admin/package-pricing/page.module.css`

Added styling for `<option>` elements:
```css
.formInput option {
  background: #1e293b;
  color: #f1f5f9;
  padding: 0.75rem;
  font-weight: 600;
}
```

### 2. **Hybrid Dropdown for Tipe Booster**
**File**: `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`

**Structure**:
1. Placeholder option
2. **Hardcoded defaults** (always shown):
   - 🔵 NO - Nitric Oxide
   - 💚 GT - Glutathione
   - 🔷 MB - Methylene Blue
   - ⚪ KCL - Potassium Chloride
   - 🟡 H2S - Hydrogen Sulfide
   - 🔴 HK - Hypochlorous Acid
   - 🌀 O3 - Ozone
3. **Additional from master data** (filtered to exclude duplicates)
4. ➕ Tambah Tipe Booster Baru (when creating)

**Code**:
```typescript
<option value="">-- Pilih Tipe Booster --</option>

{/* Hardcoded default options */}
<option value="NO">🔵 NO - Nitric Oxide</option>
<option value="GT">💚 GT - Glutathione</option>
<option value="MB">🔷 MB - Methylene Blue</option>
<option value="KCL">⚪ KCL - Potassium Chloride</option>
<option value="H2S">🟡 H2S - Hydrogen Sulfide</option>
<option value="HK">🔴 HK - Hypochlorous Acid</option>
<option value="O3">🌀 O3 - Ozone</option>

{/* Additional options from master data (if any) */}
{boosterTypes.filter(bt => 
  bt.isActive && 
  !['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3'].includes(bt.code)
).map((bt) => (
  <option key={bt.id} value={bt.code}>
    {bt.icon || '🚀'} {bt.code} - {bt.name}
  </option>
))}

{!editingId && (
  <option value="__ADD_NEW__">
    ➕ Tambah Tipe Booster Baru
  </option>
)}
```

### 3. **Hybrid Dropdown for Tipe Layanan**
**File**: `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`

**Structure**:
1. Placeholder option
2. **Hardcoded defaults** (always shown):
   - PM - Premiere (Rp 1.000.000)
   - PS - Partnership (Rp 650.000)
   - PTY - Partnership Attiya (Rp 600.000)
   - PDA - Partnership Dr. Abhi (Rp 65.000/ml)
   - PHC - Partnership Homecare (Rp 750.000)
3. **Additional from master data** (filtered to exclude duplicates)
4. ➕ Tambah Tipe Layanan Baru (when creating)

**Code**:
```typescript
<option value="">-- Pilih Tipe Layanan --</option>

{/* Hardcoded default options */}
<option value="PM">PM - Premiere (Rp 1.000.000)</option>
<option value="PS">PS - Partnership (Rp 650.000)</option>
<option value="PTY">PTY - Partnership Attiya (Rp 600.000)</option>
<option value="PDA">PDA - Partnership Dr. Abhi (Rp 65.000/ml)</option>
<option value="PHC">PHC - Partnership Homecare (Rp 750.000)</option>

{/* Additional options from master data (if any) */}
{serviceTypes.filter(st => 
  st.isActive && 
  !['PM', 'PS', 'PTY', 'PDA', 'PHC'].includes(st.code)
).map((st) => (
  <option key={st.id} value={st.code}>
    {st.code} - {st.name}
  </option>
))}

{!editingId && (
  <option value="__ADD_NEW__">
    ➕ Tambah Tipe Layanan Baru
  </option>
)}
```

### 4. **"Tambah Baru" Functionality**
When user selects "➕ Tambah Tipe Booster Baru" or "➕ Tambah Tipe Layanan Baru":
1. Show info toast
2. Close modal
3. Switch to Master Data tab
4. Switch to appropriate sub-tab (Booster or Service)

---

## Technical Details

### Hybrid Approach Benefits:
1. **Backward Compatibility**: Existing hardcoded options always available
2. **Extensibility**: New types from master data automatically appear
3. **No Duplicates**: Filter prevents showing same code twice
4. **User-Friendly**: "Tambah Baru" option guides users to add custom types

### Filter Logic:
```typescript
boosterTypes.filter(bt => 
  bt.isActive &&                                    // Only active types
  !['NO', 'GT', 'MB', 'KCL', 'H2S', 'HK', 'O3'].includes(bt.code)  // Exclude hardcoded
)
```

### Master Data Loading:
- Master data loads on initial page load (not just when Master Data tab is active)
- This ensures dropdown options are available immediately when creating packages

---

## User Experience

### Before Fix:
❌ Dropdown text not visible (white text on white background)
❌ All booster and service types disappeared
❌ No way to add new types from form

### After Fix:
✅ Dropdown text clearly visible (white text on dark background)
✅ All 7 booster types always available (NO, GT, MB, KCL, H2S, HK, O3)
✅ All 5 service types always available (PM, PS, PTY, PDA, PHC)
✅ Additional custom types from master data appear automatically
✅ "Tambah Baru" option redirects to Master Data tab
✅ No duplicate options

---

## Testing Checklist

**Dropdown Visibility:**
- [x] Dropdown text visible in all browsers
- [x] Options text visible when dropdown is open
- [x] Hover state visible
- [x] Selected option visible

**Tipe Booster:**
- [x] All 7 hardcoded types always visible
- [x] Custom types from master data appear (if any)
- [x] No duplicate codes
- [x] "Tambah Baru" option appears when creating
- [x] "Tambah Baru" redirects to Master Data > Booster tab

**Tipe Layanan:**
- [x] All 5 hardcoded types always visible
- [x] Custom types from master data appear (if any)
- [x] No duplicate codes
- [x] "Tambah Baru" option appears when creating
- [x] "Tambah Baru" redirects to Master Data > Service tab

**Edge Cases:**
- [x] Works when master data is empty
- [x] Works when master data has duplicates
- [x] Works when master data has new types
- [x] "Tambah Baru" hidden when editing

---

## Files Modified

1. `apps/web/src/app/(staff)/admin/package-pricing/page.module.css`
   - Added `.formInput option` styling

2. `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`
   - Updated Tipe Booster dropdown with hybrid approach
   - Updated Tipe Layanan dropdown with hybrid approach
   - Added filter logic to prevent duplicates
   - Added "Tambah Baru" redirect functionality

---

## Related Issues

- ✅ Dropdown text not visible (CSS fix)
- ✅ All booster/service types disappeared (hybrid approach)
- ✅ Need option to add new types (Tambah Baru feature)

---

## Notes

- Hardcoded options serve as defaults and cannot be removed
- Master data provides extensibility for custom types
- Filter prevents duplicate codes from appearing
- "Tambah Baru" option only visible when creating (not editing)
- Master data loads on page init to ensure dropdown options are ready
- This approach maintains backward compatibility while adding flexibility
