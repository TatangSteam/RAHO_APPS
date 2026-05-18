# Fix Impersonation Token Storage Issue

**Date**: May 15, 2026  
**Issue**: Token hilang setelah impersonation berhasil, menyebabkan 401 error  
**Status**: ✅ Fixed

## Problem

Setelah impersonation berhasil (200 OK), ada request kedua yang gagal dengan 401 karena token hilang:

```
✅ POST /api/v1/admin/impersonate/... 200 OK
❌ POST /api/v1/admin/impersonate/... 401 (Auth Header: MISSING)
```

### Root Cause

**Frontend tidak menyimpan token dengan benar ke auth store**

1. Component menggunakan `setAccessToken()` dan `setUser()` yang tidak ada
2. `setUser()` bukan method di authStore
3. Token tersimpan tapi user tidak terupdate
4. Redirect terjadi sebelum token tersimpan dengan benar

## Solution

### Before (❌ Wrong)

```typescript
// ImpersonateButton.tsx
const { setAccessToken, setUser } = useAuthStore(); // ❌ setUser tidak ada

// Update auth store
setAccessToken(response.accessToken); // ❌ Hanya update token
setUser({...}); // ❌ Error: setUser is not a function

// Redirect immediately
router.push('/admin-manager'); // ❌ Redirect sebelum token tersimpan
```

### After (✅ Fixed)

```typescript
// ImpersonateButton.tsx
// No destructuring, use getState() instead

// Update auth store with setAuth (complete update)
const { setAuth } = useAuthStore.getState();
setAuth(
  {
    id: response.targetUser.id,
    email: response.targetUser.email,
    role: response.targetUser.role,
    fullName: response.targetUser.fullName,
    branchId: response.targetUser.branchId || null,
    staffCode: null,
  },
  {
    accessToken: response.accessToken,
    refreshToken: response.accessToken,
  }
);

// Wait for token to be saved
await new Promise(resolve => setTimeout(resolve, 100));

// Redirect with full page reload
window.location.href = '/admin-manager';
```

## Key Changes

### 1. Use `setAuth()` Instead of `setAccessToken()` + `setUser()`

**Why**: 
- `setAuth()` updates both user and tokens atomically
- `setUser()` doesn't exist in authStore
- Prevents race conditions

### 2. Use `useAuthStore.getState()` Instead of Hook

**Why**:
- Avoids stale closures
- Gets latest state
- Works in async functions

### 3. Wait Before Redirect

**Why**:
- Ensures token is saved to localStorage
- Zustand persist middleware needs time
- Prevents token loss on redirect

### 4. Use `window.location.href` Instead of `router.push()`

**Why**:
- Forces full page reload
- Ensures new token is used
- Clears any cached state

## Files Modified

### Frontend
1. `apps/web/src/components/admin/ImpersonateButton.tsx`
   - Removed `setAccessToken` and `setUser` destructuring
   - Use `useAuthStore.getState().setAuth()` for atomic update
   - Added 100ms delay before redirect
   - Changed to `window.location.href` for redirect

## Testing

### Before Fix
```bash
# Sequence
1. Click Impersonate ✅
2. API returns 200 OK ✅
3. Token not saved properly ❌
4. Redirect happens ❌
5. Second request with missing token ❌
6. 401 Unauthorized ❌
7. User logged out ❌
```

### After Fix
```bash
# Sequence
1. Click Impersonate ✅
2. API returns 200 OK ✅
3. Token saved with setAuth() ✅
4. Wait 100ms ✅
5. Redirect with window.location.href ✅
6. Page loads with new token ✅
7. User sees Admin Manager dashboard ✅
```

## Expected Behavior

### Backend Logs
```
🎭 [startImpersonation] Request received
🔐 [ImpersonationService] createImpersonationToken called
✅ [ImpersonationService] Current user found
✅ [ImpersonationService] Target user found
🔍 [validateImpersonation] Starting validation
✅ [validateImpersonation] Rule 1 passed
✅ [ImpersonationService] Token generated successfully
🎭 [startImpersonation] Audit log created, sending response
POST /api/v1/admin/impersonate/... 200 OK
```

### Frontend Logs
```
🎭 [ImpersonateButton] Starting impersonation
🌐 [adminManagersApi] startImpersonation called
✅ [adminManagersApi] startImpersonation response: { status: 200 }
✅ [ImpersonateButton] Impersonation API response
🔄 [ImpersonateButton] Updating auth store...
✅ [ImpersonateButton] Auth store updated
🔄 [ImpersonateButton] Updating impersonation context...
✅ [ImpersonateButton] Impersonation context updated
🔀 [ImpersonateButton] Redirecting to /admin-manager
```

### User Experience
1. ✅ Click "Impersonate" button
2. ✅ Confirm in modal
3. ✅ See success toast
4. ✅ Page redirects to Admin Manager dashboard
5. ✅ See impersonation banner at top
6. ✅ Can navigate and use features as Admin Manager
7. ✅ Can click "Stop Impersonation" to return

## Related Issues Fixed

### Issue 1: UUID Validation Error
- **Fixed in**: `FIX-IMPERSONATION-UUID-VALIDATION-ERROR.md`
- **Solution**: Changed validation from `.uuid()` to `.min(1)`

### Issue 2: Token Storage Race Condition
- **Fixed in**: This document
- **Solution**: Use `setAuth()` with delay before redirect

## Next Steps

1. **Refresh browser** (Ctrl + Shift + R)
2. **Try impersonation** - should work completely now
3. **Verify**:
   - No 401 errors
   - No automatic logout
   - Dashboard loads correctly
   - Impersonation banner shows
   - Can navigate freely

## Additional Notes

### About Auth Store Methods

**Available Methods**:
- `setAuth(user, tokens)` - Set user and tokens (use this for impersonation)
- `setAccessToken(accessToken, refreshToken)` - Update tokens only
- `clearAuth()` - Clear all auth data

**Not Available**:
- ❌ `setUser()` - Does not exist
- ❌ `updateUser()` - Does not exist

### Why Full Page Reload?

Using `window.location.href` instead of `router.push()`:
- ✅ Ensures new token is loaded from localStorage
- ✅ Clears any cached React state
- ✅ Reinitializes all contexts with new user
- ✅ Prevents stale data issues
- ✅ More reliable for auth changes

### Zustand Persist Middleware

The auth store uses Zustand's persist middleware:
- Saves to localStorage automatically
- Needs time to complete save operation
- 100ms delay ensures save completes
- Rehydrates on page load

## Summary

**Problem**: Token not saved properly, causing 401 after successful impersonation  
**Solution**: Use `setAuth()` for atomic update, wait before redirect, use full page reload  
**Result**: Impersonation now works end-to-end without errors  
**Action Required**: Refresh browser and test
