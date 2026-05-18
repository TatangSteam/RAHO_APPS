# Fix: Admin Managers API Response Structure Mismatch

**Tanggal**: 15 Mei 2026  
**Status**: ✅ Fixed

## 🐛 Error

```
Error loading admin managers: TypeError: Cannot read properties of undefined (reading 'total')
at loadManagers (AdminManagersTab.tsx:38:30)
```

## 🔍 Root Cause

**Mismatch antara Backend Response dan Frontend Expectation**

### Backend Response Structure:
```typescript
{
  data: {
    managers: [...],
    pagination: {
      page, limit, total, totalPages
    }
  }
}
```

### Frontend Expected Structure:
```typescript
{
  data: [...],
  meta: {
    page, limit, total, totalPages
  }
}
```

## ✅ Solution

### 1. **Transform Response di API Client**
**File**: `apps/web/src/lib/api/adminManagersApi.ts`

```typescript
getAdminManagers: async (params?) => {
  const response = await api.get('/admin/managers', { params });
  
  // Transform backend response to frontend format
  const backendData = response.data.data || response.data;
  
  return {
    data: backendData.managers || [],
    meta: {
      total: backendData.pagination?.total || 0,
      page: backendData.pagination?.page || 1,
      limit: backendData.pagination?.limit || 10,
      totalPages: backendData.pagination?.totalPages || 0,
    }
  };
}
```

### 2. **Add Missing Field (phoneNumber)**
**File**: `apps/api/src/modules/admin/services/impersonation.service.ts`

```typescript
managers: managers.map(manager => ({
  id: manager.id,
  email: manager.email,
  fullName: manager.profile?.fullName || manager.email,
  phoneNumber: manager.profile?.phoneNumber || '',  // ← ADDED
  isActive: manager.isActive,
  branches: manager.managedBranches.map(mb => mb.branch),
  createdAt: manager.createdAt,
  lastLoginAt: manager.lastLoginAt
}))
```

### 3. **Improve Error Handling**
**File**: `apps/web/src/components/admin/AdminManagersTab.tsx`

```typescript
const loadManagers = async () => {
  try {
    setLoading(true);
    
    const params: any = { page, limit };
    if (search) params.search = search;
    if (statusFilter !== 'all') params.isActive = statusFilter === 'active';

    console.log('🔍 Calling getAdminManagers with params:', params);
    const response = await adminManagersApi.getAdminManagers(params);
    console.log('✅ Response received:', response);
    
    // Handle different response structures
    if (response && response.data) {
      setManagers(Array.isArray(response.data) ? response.data : []);
      setTotal(response.meta?.total || 0);
    } else {
      console.warn('⚠️ Unexpected response structure:', response);
      setManagers([]);
      setTotal(0);
    }
  } catch (error: any) {
    console.error('❌ Error loading admin managers:', error);
    console.error('Error details:', error.response?.data);
    showToast.error(error.response?.data?.message || 'Gagal memuat data Admin Manager');
    setManagers([]);
    setTotal(0);
  } finally {
    setLoading(false);
  }
};
```

## 📁 Files Changed

### Frontend:
1. ✅ `apps/web/src/lib/api/adminManagersApi.ts`
   - Transform response structure
   - Map `managers` → `data`
   - Map `pagination` → `meta`

2. ✅ `apps/web/src/components/admin/AdminManagersTab.tsx`
   - Better error handling
   - Console logging for debugging
   - Fallback values

### Backend:
1. ✅ `apps/api/src/modules/admin/services/impersonation.service.ts`
   - Add `phoneNumber` field to response

## 🧪 Testing

After fix:
1. ✅ Refresh browser (Ctrl + Shift + R)
2. ✅ Navigate to `/admin/managers`
3. ✅ API call succeeds
4. ✅ Data displays in table
5. ✅ Stats cards show correct numbers
6. ✅ No console errors

## 📊 Response Flow

```
Backend Service (impersonation.service.ts)
  ↓
  Returns: { managers: [...], pagination: {...} }
  ↓
Backend Controller (admin.controller.ts)
  ↓
  Wraps in: { data: { managers, pagination } }
  ↓
API Client (adminManagersApi.ts)
  ↓
  Transforms to: { data: [...], meta: {...} }
  ↓
Frontend Component (AdminManagersTab.tsx)
  ↓
  Uses: response.data and response.meta
```

## 🎯 Key Learnings

1. **Always check response structure** - Backend and frontend must agree on data format
2. **Transform at API layer** - Keep transformation logic in one place (API client)
3. **Add defensive coding** - Handle undefined/null with fallbacks
4. **Log for debugging** - Console logs help identify issues quickly
5. **Include all required fields** - phoneNumber was missing from backend response

## ✅ Status

**FIXED** ✅ - Admin Managers page now loads data correctly!

### What Works Now:
- ✅ API call to `/admin/managers` succeeds
- ✅ Data transforms correctly from backend to frontend
- ✅ Table displays admin managers
- ✅ Stats cards show totals
- ✅ Pagination works
- ✅ Search and filter work
- ✅ All fields display (including phoneNumber)
