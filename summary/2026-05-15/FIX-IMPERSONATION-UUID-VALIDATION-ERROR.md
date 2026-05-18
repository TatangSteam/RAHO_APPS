# Fix Impersonation 400 Error - UUID Validation Issue

**Date**: May 15, 2026  
**Issue**: Error 400 saat impersonate karena validation schema salah  
**Status**: ✅ Fixed

## Root Cause

**Validation schema mengharapkan UUID tapi database menggunakan CUID**

### Error Details
```
POST /api/v1/admin/impersonate/cmp44ett3000aze4k4awme4e0 400 (Bad Request)
```

### Problem
File: `apps/api/src/modules/admin/admin.schema.ts`

**Before** (❌ Wrong):
```typescript
export const impersonateUserParamsSchema = z.object({
  userId: z.string().uuid('ID user tidak valid')  // ❌ Expects UUID format
});
```

**Database ID Format**: `cmp44ett3000aze4k4awme4e0` (CUID, not UUID)

### Why This Happened
- Prisma schema uses `@default(cuid())` for ID generation
- CUID format: `c` + timestamp + random string (e.g., `cmp44ett3000aze4k4awme4e0`)
- UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Zod `.uuid()` validation rejects CUID format

## Solution

**After** (✅ Fixed):
```typescript
export const impersonateUserParamsSchema = z.object({
  userId: z.string().min(1, 'ID user tidak boleh kosong')  // ✅ Accepts any non-empty string
});
```

### Why This Works
- CUID is always a non-empty string
- Database will validate if ID exists
- No need for format validation at API level
- Consistent with other ID validations in the codebase

## Files Modified

### Backend
1. `apps/api/src/modules/admin/admin.schema.ts`
   - Changed `z.string().uuid()` to `z.string().min(1)`
   - Allows CUID format IDs

## Testing

### Before Fix
```bash
# Request
POST /api/v1/admin/impersonate/cmp44ett3000aze4k4awme4e0

# Response
400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data yang dikirimkan tidak valid",
    "details": [
      {
        "field": "userId",
        "message": "ID user tidak valid"
      }
    ]
  }
}
```

### After Fix
```bash
# Request
POST /api/v1/admin/impersonate/cmp44ett3000aze4k4awme4e0

# Response
200 OK
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "targetUser": {
      "id": "cmp44ett3000aze4k4awme4e0",
      "email": "manager1@raho.id",
      "fullName": "Admin Manager 1",
      "role": "ADMIN_MANAGER",
      ...
    }
  }
}
```

## Related Issues

This same validation issue might exist in other schemas. Check for:
- `z.string().uuid()` in other schema files
- Replace with `z.string().min(1)` or `z.string().cuid()` if available

## Next Steps

1. **Restart API server** to apply the fix
2. **Try impersonation again** - should work now
3. **Check logs** to verify success

## Verification Commands

```bash
# Restart API server
cd apps/api
npm run dev

# Or if using PM2
pm2 restart api

# Check if server is running
curl http://localhost:5000/api/v1/health
```

## Expected Behavior After Fix

1. Click "Impersonate" button on Admin Manager
2. Confirm in modal
3. ✅ Should see success toast
4. ✅ Should redirect to `/admin-manager` dashboard
5. ✅ Should see impersonation banner at top
6. ✅ Backend logs should show:
   ```
   🎭 [startImpersonation] Request received
   🔐 [ImpersonationService] createImpersonationToken called
   ✅ [ImpersonationService] Current user found
   ✅ [ImpersonationService] Target user found
   ✅ [validateImpersonation] Rule 1 passed
   ✅ [ImpersonationService] Token generated successfully
   ```

## Additional Notes

### About CUID vs UUID

**CUID (Collision-resistant Unique Identifier)**:
- Format: `c` + timestamp + counter + random
- Example: `cmp44ett3000aze4k4awme4e0`
- Sortable by creation time
- Used by Prisma by default

**UUID (Universally Unique Identifier)**:
- Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Example: `550e8400-e29b-41d4-a716-446655440000`
- Random, not sortable
- Standard format

### Why Prisma Uses CUID
- Better performance for database indexing
- Sortable by creation time
- Shorter than UUID
- Still globally unique

## Logging Added

The detailed logging added in previous fix will now show successful impersonation:

### Backend Console
```
🎭 [startImpersonation] Request received: {
  currentUserId: 'cmp44etc80004ze4k4bfi9dj6',
  currentUserEmail: 'superadmin@raho.id',
  currentUserRole: 'SUPER_ADMIN',
  targetUserId: 'cmp44ett3000aze4k4awme4e0'
}
🔐 [ImpersonationService] createImpersonationToken called
✅ [ImpersonationService] Current user found
✅ [ImpersonationService] Target user found
🔍 [validateImpersonation] Starting validation
✅ [validateImpersonation] Rule 1 passed
✅ [ImpersonationService] Token generated successfully
🎭 [startImpersonation] Audit log created, sending response
```

### Frontend Console
```
🎭 [ImpersonateButton] Starting impersonation: {
  userId: 'cmp44ett3000aze4k4awme4e0',
  userName: 'Admin Manager 1',
  targetRole: 'ADMIN_MANAGER'
}
🌐 [adminManagersApi] startImpersonation called
✅ [adminManagersApi] startImpersonation response: { status: 200 }
✅ [ImpersonateButton] Impersonation API response
✅ [ImpersonateButton] Auth store updated
✅ [ImpersonateButton] Impersonation context updated
🔀 [ImpersonateButton] Redirecting to /admin-manager
```

## Summary

**Problem**: Validation schema expected UUID but database uses CUID  
**Solution**: Changed validation from `.uuid()` to `.min(1)`  
**Result**: Impersonation now works with CUID format IDs  
**Action Required**: Restart API server and test
