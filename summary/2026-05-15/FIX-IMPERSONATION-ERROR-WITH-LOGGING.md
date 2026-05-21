# Fix Impersonation Error dengan Detailed Logging

**Date**: May 15, 2026  
**Issue**: Error 400 saat melakukan impersonation Admin Manager  
**Status**: ✅ Logging ditambahkan untuk debugging

## Problem

User mendapat error 400 (Bad Request) saat mencoba impersonate Admin Manager:
```
POST http://localhost:4000/api/v1/admin/impersonate/cmp44ett3000aze4k4awme4e0 400 (Bad Request)
```

## Solution Implemented

### 1. Added Comprehensive Logging

#### Backend Logging

**File**: `apps/api/src/modules/admin/admin.controller.ts`
- ✅ Log request details (current user, target user)
- ✅ Log token decoding
- ✅ Log service call
- ✅ Log success response
- ✅ Log detailed error with stack trace

**File**: `apps/api/src/modules/admin/services/impersonation.service.ts`
- ✅ Log method entry with parameters
- ✅ Log current user lookup
- ✅ Log target user lookup
- ✅ Log validation process
- ✅ Log impersonation data building
- ✅ Log token generation
- ✅ Log validation rules (Rule 1, Rule 2, Rule 3)
- ✅ Log branch access checks

#### Frontend Logging

**File**: `apps/web/src/components/admin/ImpersonateButton.tsx`
- ✅ Log impersonation start
- ✅ Log API response
- ✅ Log auth store update
- ✅ Log context update
- ✅ Log redirect
- ✅ Log detailed error with response data

**File**: `apps/web/src/lib/api/adminManagersApi.ts`
- ✅ Log API call with userId
- ✅ Log response status and data keys
- ✅ Log error details

## Logging Format

### Backend Console Output
```
🎭 [startImpersonation] Request received: { currentUserId, targetUserId, ... }
🔐 [ImpersonationService] createImpersonationToken called: { ... }
✅ [ImpersonationService] Current user found: { ... }
✅ [ImpersonationService] Target user found: { ... }
🔍 [validateImpersonation] Starting validation: { ... }
✅ [validateImpersonation] Rule 1 passed
✅ [ImpersonationService] Token generated successfully
🎭 [startImpersonation] Audit log created, sending response
```

### Frontend Console Output
```
🎭 [ImpersonateButton] Starting impersonation: { userId, userName, targetRole }
🌐 [adminManagersApi] startImpersonation called: { userId }
✅ [adminManagersApi] startImpersonation response: { status, hasData, ... }
✅ [ImpersonateButton] Impersonation API response: { ... }
✅ [ImpersonateButton] Auth store updated
✅ [ImpersonateButton] Impersonation context updated
🔀 [ImpersonateButton] Redirecting to /admin-manager
```

### Error Output
```
❌ [ImpersonationService] Target user not found: <userId>
❌ [validateImpersonation] SUPER_ADMIN can only impersonate ADMIN_MANAGER
❌ [startImpersonation] Error occurred: { message, code, status, stack }
```

## How to Debug

### Step 1: Open Browser Console
1. Press **F12** to open Developer Tools
2. Go to **Console** tab
3. Clear console (Ctrl + L)

### Step 2: Try Impersonation
1. Click "Impersonate" button on an Admin Manager
2. Confirm in the modal
3. Watch the console output

### Step 3: Check Backend Logs
1. Open terminal where API server is running
2. Look for logs starting with 🎭, 🔐, 🔍, ✅, or ❌
3. Identify where the error occurs

## Common Error Scenarios

### Error 1: Target User Not Found
**Log**: `❌ [ImpersonationService] Target user not found: <userId>`
**Cause**: User ID tidak ada di database
**Solution**: Verify user exists in database

### Error 2: Target User Inactive
**Log**: `❌ [ImpersonationService] Target user is inactive`
**Cause**: User dengan `isActive = false`
**Solution**: Activate user in database or UI

### Error 3: Invalid Impersonation Target
**Log**: `❌ [validateImpersonation] SUPER_ADMIN can only impersonate ADMIN_MANAGER`
**Cause**: Trying to impersonate wrong role
**Solution**: 
- SUPER_ADMIN can only impersonate ADMIN_MANAGER
- ADMIN_MANAGER can only impersonate ADMIN_CABANG

### Error 4: Branch Access Denied
**Log**: `❌ [validateImpersonation] Target Admin Cabang not in manager branches`
**Cause**: Admin Cabang tidak ada di branches yang dikelola Admin Manager
**Solution**: Assign Admin Cabang to one of manager's branches

### Error 5: Current User Not Found
**Log**: `❌ [ImpersonationService] Current user not found: <userId>`
**Cause**: Token tidak valid atau user sudah dihapus
**Solution**: Logout dan login kembali

## Testing Steps

### 1. Test as SUPER_ADMIN
```bash
# Login as super admin
Email: superadmin@raho.id
Password: SuP3r4Dm1n

# Try to impersonate Admin Manager
- Should see logs in console
- Should succeed if target is ADMIN_MANAGER
- Should fail if target is not ADMIN_MANAGER
```

### 2. Check Logs
```bash
# Backend logs should show:
🎭 [startImpersonation] Request received
🔐 [ImpersonationService] createImpersonationToken called
✅ [ImpersonationService] Current user found
✅ [ImpersonationService] Target user found
🔍 [validateImpersonation] Starting validation
✅ [validateImpersonation] Rule 1 passed
✅ [ImpersonationService] Token generated successfully

# Frontend logs should show:
🎭 [ImpersonateButton] Starting impersonation
🌐 [adminManagersApi] startImpersonation called
✅ [adminManagersApi] startImpersonation response
✅ [ImpersonateButton] Auth store updated
```

### 3. If Error Occurs
```bash
# Look for ❌ emoji in logs
# Error will show:
- Which step failed
- Error message
- Error code
- Full details

# Example:
❌ [validateImpersonation] SUPER_ADMIN can only impersonate ADMIN_MANAGER, target is: ADMIN_CABANG
```

## Files Modified

### Backend
1. `apps/api/src/modules/admin/admin.controller.ts`
   - Added detailed logging in `startImpersonation()`
   - Log request, token, service call, success, and errors

2. `apps/api/src/modules/admin/services/impersonation.service.ts`
   - Added logging in `createImpersonationToken()`
   - Added logging in `validateImpersonation()`
   - Log each validation rule and branch checks

### Frontend
1. `apps/web/src/components/admin/ImpersonateButton.tsx`
   - Added logging in `handleImpersonate()`
   - Log API call, response, store updates, and errors

2. `apps/web/src/lib/api/adminManagersApi.ts`
   - Added logging in `startImpersonation()`
   - Log request and response details

## Next Steps

1. **Refresh browser** (Ctrl + Shift + R)
2. **Open console** (F12)
3. **Try impersonation** and watch logs
4. **Share the logs** if error persists

The detailed logs will help identify exactly where and why the impersonation is failing.

## Expected Admin Managers in Database

From seed data (`apps/api/prisma/seeds/users.seed.ts`):

1. **Manager 1**
   - Email: `manager1@raho.id`
   - Password: `Manager@123`
   - Role: `ADMIN_MANAGER`
   - Manages: Jakarta Pusat & Bandung

2. **Manager 2**
   - Email: `manager2@raho.id`
   - Password: `Manager@123`
   - Role: `ADMIN_MANAGER`
   - Manages: Surabaya & Jakarta Pusat

Make sure these users exist and are active in your database.
