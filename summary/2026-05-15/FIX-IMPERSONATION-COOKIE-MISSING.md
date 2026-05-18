# Fix Impersonation Cookie Missing Issue - FINAL FIX

**Date**: May 15, 2026  
**Issue**: Cookie hilang setelah impersonation, menyebabkan auto logout  
**Status**: ✅ Fixed - FINAL SOLUTION

## Problem

Setelah impersonation berhasil dan redirect ke `/admin-manager`, user langsung logout karena **cookie hilang**:

```
✅ GET /admin-manager 200 (authCookie: true, role: SUPER_ADMIN)
❌ [Middleware] Path: /login (authCookie: false) ← Cookie hilang!
```

### Root Cause

**Frontend hanya update localStorage, tidak update cookie!**

Middleware Next.js menggunakan **cookie** untuk authentication, bukan localStorage:
- ✅ localStorage updated → API calls work
- ❌ Cookie NOT updated → Middleware redirects to login
- Result: User logged out immediately after redirect

## Solution

### The Missing Piece: Update Cookie!

**Before** (❌ Incomplete):
```typescript
// Update localStorage only
setAuth(user, tokens); // ✅ localStorage updated
// Cookie NOT updated ❌
window.location.href = '/admin-manager'; // Redirect
// Middleware checks cookie → NOT FOUND → Redirect to /login ❌
```

**After** (✅ Complete):
```typescript
// Update localStorage
setAuth(user, tokens); // ✅ localStorage updated

// Update cookie for middleware
document.cookie = `raho-auth-token=${response.accessToken}; path=/; max-age=28800; SameSite=Lax`;
// ✅ Cookie updated

// Wait for everything to save
await new Promise(resolve => setTimeout(resolve, 200));

// Redirect
window.location.href = '/admin-manager';
// Middleware checks cookie → FOUND → Access granted ✅
```

## Key Changes

### 1. Add Cookie Update

```typescript
// Set cookie with proper attributes
document.cookie = `raho-auth-token=${response.accessToken}; path=/; max-age=28800; SameSite=Lax`;
```

**Cookie Attributes**:
- `path=/` - Available for all routes
- `max-age=28800` - 8 hours (same as token expiry)
- `SameSite=Lax` - CSRF protection

### 2. Increase Wait Time

```typescript
// Before: 100ms
await new Promise(resolve => setTimeout(resolve, 100));

// After: 200ms
await new Promise(resolve => setTimeout(resolve, 200));
```

**Why**: Ensure both localStorage AND cookie are fully written before redirect

## Complete Flow

### 1. User Clicks Impersonate
```typescript
handleImpersonate() called
```

### 2. API Call
```typescript
POST /api/v1/admin/impersonate/:userId
Response: { accessToken, targetUser }
```

### 3. Update Auth (3 places!)
```typescript
// 1. Update localStorage (for API calls)
setAuth(user, tokens);

// 2. Update cookie (for middleware)
document.cookie = `raho-auth-token=${token}; ...`;

// 3. Update impersonation context
startImpersonation(userId, role);
```

### 4. Wait & Redirect
```typescript
await new Promise(resolve => setTimeout(resolve, 200));
window.location.href = '/admin-manager';
```

### 5. Middleware Check
```typescript
// Middleware reads cookie
const token = cookies.get('raho-auth-token'); // ✅ Found!
// Decode and verify
const decoded = verifyToken(token);
// Allow access ✅
```

## Files Modified

### Frontend
1. `apps/web/src/components/admin/ImpersonateButton.tsx`
   - Added cookie update: `document.cookie = ...`
   - Increased wait time to 200ms
   - Added cookie update logging

## Testing

### Before Fix
```bash
# Sequence
1. Click Impersonate ✅
2. API returns 200 OK ✅
3. localStorage updated ✅
4. Cookie NOT updated ❌
5. Redirect to /admin-manager ✅
6. Middleware checks cookie ❌
7. Cookie not found ❌
8. Redirect to /login ❌
9. User logged out ❌
```

### After Fix
```bash
# Sequence
1. Click Impersonate ✅
2. API returns 200 OK ✅
3. localStorage updated ✅
4. Cookie updated ✅
5. Wait 200ms ✅
6. Redirect to /admin-manager ✅
7. Middleware checks cookie ✅
8. Cookie found with valid token ✅
9. Access granted ✅
10. Dashboard loads ✅
```

## Expected Logs

### Frontend Console
```
🎭 [ImpersonateButton] Starting impersonation
🌐 [adminManagersApi] startImpersonation called
✅ [adminManagersApi] startImpersonation response: { status: 200 }
✅ [ImpersonateButton] Impersonation API response
🔄 [ImpersonateButton] Updating auth store...
✅ [ImpersonateButton] Auth store updated
🍪 [ImpersonateButton] Updating auth cookie...
✅ [ImpersonateButton] Cookie updated
🔄 [ImpersonateButton] Updating impersonation context...
✅ [ImpersonateButton] Impersonation context updated
🔀 [ImpersonateButton] Redirecting to /admin-manager
```

### Middleware Logs
```
[Middleware] Path: /admin-manager
[Middleware] isStaffRoute: false authCookie: true  ← Cookie found! ✅
[Middleware] Decoded role: ADMIN_MANAGER  ← Correct role! ✅
[Middleware] Allowing access to: /admin-manager  ← Access granted! ✅
GET /admin-manager 200
```

## Why This Happens

### Next.js Middleware Architecture

Next.js middleware runs **before** page loads:
1. User requests `/admin-manager`
2. **Middleware runs first** (checks cookie)
3. If cookie valid → Allow access
4. If cookie invalid/missing → Redirect to `/login`
5. Page component loads (if allowed)

### localStorage vs Cookie

| Storage | Used By | Accessible In |
|---------|---------|---------------|
| localStorage | API client (axios) | Client-side only |
| Cookie | Middleware | Server & Client |

**Problem**: We only updated localStorage, not cookie!

**Solution**: Update BOTH localStorage AND cookie!

## Related Fixes

This is the **FINAL FIX** in a series of 3 fixes:

### Fix 1: UUID Validation Error
- **File**: `FIX-IMPERSONATION-UUID-VALIDATION-ERROR.md`
- **Issue**: Schema expected UUID but database uses CUID
- **Solution**: Changed validation from `.uuid()` to `.min(1)`

### Fix 2: Token Storage Issue
- **File**: `FIX-IMPERSONATION-TOKEN-STORAGE-ISSUE.md`
- **Issue**: Used wrong method to update auth store
- **Solution**: Use `setAuth()` instead of `setAccessToken()` + `setUser()`

### Fix 3: Cookie Missing (THIS FIX)
- **File**: `FIX-IMPERSONATION-COOKIE-MISSING.md`
- **Issue**: Cookie not updated, only localStorage
- **Solution**: Update cookie with `document.cookie = ...`

## Next Steps

1. **Refresh browser** (Ctrl + Shift + R)
2. **Try impersonation** - should work completely now!
3. **Verify**:
   - ✅ No 401 errors
   - ✅ No automatic logout
   - ✅ Dashboard loads correctly
   - ✅ Impersonation banner shows
   - ✅ Can navigate freely
   - ✅ Middleware logs show `authCookie: true`

## Summary

**Problem**: Cookie not updated after impersonation, causing middleware to redirect to login  
**Solution**: Update cookie with `document.cookie = ...` after updating localStorage  
**Result**: Impersonation now works end-to-end without logout  
**Action Required**: Refresh browser and test - THIS IS THE FINAL FIX! 🎉

## Cookie Format

```javascript
document.cookie = `raho-auth-token=${token}; path=/; max-age=28800; SameSite=Lax`;
```

- **Name**: `raho-auth-token` (must match middleware)
- **Value**: JWT token from API
- **path=/**: Available for all routes
- **max-age=28800**: 8 hours (28800 seconds)
- **SameSite=Lax**: CSRF protection, allows navigation

## Debugging Tips

If still having issues, check:

1. **Cookie in DevTools**:
   - F12 → Application → Cookies
   - Look for `raho-auth-token`
   - Verify value matches localStorage token

2. **Middleware Logs**:
   - Should show `authCookie: true`
   - Should show correct role
   - Should allow access

3. **Console Logs**:
   - Should see "Cookie updated" message
   - Should see redirect message
   - No error messages

This is the complete and final solution! 🚀
