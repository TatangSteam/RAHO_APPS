# Fix Branch Dropdown Empty in Package Pricing Form

**Date:** May 15, 2026  
**Status:** ✅ Fixed  
**Issue:** Branch dropdown only shows "Global (Semua Cabang)" without individual branches

---

## Problem

Saat membuka form "Tambah Harga Paket", dropdown "Cabang (Opsional)" hanya menampilkan:
- 🌐 Global (Semua Cabang)

Tidak ada daftar cabang individual yang muncul, padahal seharusnya menampilkan semua cabang yang tersedia.

---

## Root Cause

**Incorrect API Response Parsing**

Frontend code menggunakan path yang salah untuk mengakses data branches dari API response:

```typescript
// ❌ WRONG - Looking for nested structure
const data = await response.json();
setBranches(data.data?.branches || []);
```

**Actual API Response Structure:**
```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "Cabang A", "branchCode": "CA" },
    { "id": "...", "name": "Cabang B", "branchCode": "CB" }
  ]
}
```

The `sendSuccess()` utility function wraps the data in `{ success: true, data: ... }`, so branches array is directly at `result.data`, not `result.data.branches`.

---

## Solution

Updated `loadBranches()` function to correctly parse the API response:

```typescript
const loadBranches = async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/branches`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log('📦 Branches API Response:', result);
      
      // ✅ CORRECT - Response structure: { success: true, data: [...branches] }
      const branchesData = result.data || [];
      console.log('📋 Branches Data:', branchesData);
      
      setBranches(branchesData);
    } else {
      console.error('Failed to load branches, status:', response.status);
    }
  } catch (error) {
    console.error('Failed to load branches:', error);
  }
};
```

---

## Changes Made

**File:** `apps/web/src/app/(staff)/admin/package-pricing/page.tsx`

### Before (Incorrect)
```typescript
const data = await response.json();
setBranches(data.data?.branches || []);
```

### After (Correct)
```typescript
const result = await response.json();
const branchesData = result.data || [];
setBranches(branchesData);
```

### Added Debug Logging
```typescript
console.log('📦 Branches API Response:', result);
console.log('📋 Branches Data:', branchesData);
```

---

## Expected Behavior After Fix

### Branch Dropdown Should Now Show:

```
┌─────────────────────────────────────────┐
│ Cabang (Opsional)                       │
├─────────────────────────────────────────┤
│ 🌐 Global (Semua Cabang)                │ ← Default
│ CA - Cabang A                           │ ← Individual branches
│ CB - Cabang B                           │
│ CC - Cabang C                           │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## API Endpoint Details

**Endpoint:** `GET /branches`  
**Controller:** `getAllBranchesWithStats`  
**Service:** `getAllBranchesWithStatsService`  
**Response Utility:** `sendSuccess(res, branches)`

**Response Structure:**
```typescript
{
  success: true,
  data: Array<{
    id: string;
    branchCode: string;
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    type: BranchType;
    isActive: boolean;
    // ... other fields
  }>
}
```

---

## Testing

### Manual Test Steps

1. Login as SUPER_ADMIN or ADMIN_MANAGER
2. Go to `/admin/package-pricing`
3. Click "➕ Tambah Harga Paket"
4. Scroll to "Cabang (Opsional)" dropdown
5. Click dropdown
6. **Expected:** See list of all branches
7. **Verify:** Can select individual branch or leave as Global

### Console Verification

Open browser console and check for logs:
```
📦 Branches API Response: { success: true, data: [...] }
📋 Branches Data: [{ id: '...', name: '...', branchCode: '...' }, ...]
```

---

## Related Code

### sendSuccess Utility
**File:** `apps/api/src/utils/response.ts`

```typescript
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: PaginationMeta,
): void {
  const body: Record<string, unknown> = { success: true, data };
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
}
```

This utility always wraps response in `{ success: true, data: T }` format.

---

## Impact

### Before Fix
- ❌ Only "Global (Semua Cabang)" visible
- ❌ Cannot create branch-specific pricing
- ❌ All new prices default to global

### After Fix
- ✅ All branches visible in dropdown
- ✅ Can create branch-specific pricing
- ✅ Can choose between global or specific branch

---

## Notes

- Fix only affects SUPER_ADMIN and ADMIN_MANAGER (they see branch dropdown)
- ADMIN_CABANG doesn't see this dropdown (auto-uses their branch)
- Debug logs added for easier troubleshooting
- No backend changes required
- No database changes required

---

## Related User Query

> "Kenapa list cabang di tambah paket harga hanya global"

**Translation:** "Why does the branch list in add package price only show global"

**Status:** ✅ Fixed
