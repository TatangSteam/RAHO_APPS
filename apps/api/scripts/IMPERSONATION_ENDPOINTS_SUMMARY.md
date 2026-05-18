# Impersonation Endpoints Implementation Summary

## Task 2.2: Add Impersonation Endpoints ✅ COMPLETED

### Overview
All impersonation endpoints have been successfully implemented with proper validation, authorization, and error handling.

---

## Implemented Endpoints

### 1. GET /api/v1/admin/managers
**Purpose:** Get list of Admin Managers (Super Admin only)

**Authorization:** `SUPER_ADMIN` only

**Query Parameters:**
- `search` (optional): Search by name or email
- `isActive` (optional): Filter by status (true/false)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Validation:** `getAdminManagersQuerySchema`

**Response:**
```json
{
  "success": true,
  "data": {
    "managers": [
      {
        "id": "uuid",
        "email": "manager@raho.id",
        "fullName": "Manager Name",
        "isActive": true,
        "branches": [
          {
            "id": "uuid",
            "name": "Jakarta",
            "branchCode": "PST"
          }
        ],
        "createdAt": "2026-05-13T10:00:00Z",
        "lastLoginAt": "2026-05-13T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

---

### 2. GET /api/v1/admin/branch-admins
**Purpose:** Get list of Branch Admins (Admin Manager only, filtered by assigned branches)

**Authorization:** `SUPER_ADMIN` or `ADMIN_MANAGER`

**Query Parameters:**
- `branchId` (optional): Filter by specific branch
- `search` (optional): Search by name or email
- `isActive` (optional): Filter by status (true/false)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Validation:** `getBranchAdminsQuerySchema`

**Response:**
```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "id": "uuid",
        "email": "admincabang@raho.id",
        "fullName": "Admin Cabang Name",
        "isActive": true,
        "branch": {
          "id": "uuid",
          "name": "Jakarta",
          "branchCode": "PST"
        },
        "createdAt": "2026-05-13T10:00:00Z",
        "lastLoginAt": "2026-05-13T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

**Special Behavior:**
- Admin Manager can only see Branch Admins from their assigned branches
- Super Admin can see all Branch Admins

---

### 3. POST /api/v1/admin/impersonate/:userId
**Purpose:** Start impersonation (generic - supports both Admin Manager and Admin Cabang)

**Authorization:** `SUPER_ADMIN` or `ADMIN_MANAGER`

**URL Parameters:**
- `userId`: UUID of the user to impersonate

**Validation:** `impersonateUserParamsSchema`

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-with-impersonation-data",
    "targetUser": {
      "id": "uuid",
      "email": "user@raho.id",
      "fullName": "User Name",
      "role": "ADMIN_MANAGER" | "ADMIN_CABANG",
      "branchId": "uuid",
      "branchCode": "PST",
      "branches": [
        {
          "id": "uuid",
          "name": "Jakarta",
          "branchCode": "PST"
        }
      ]
    }
  }
}
```

**Impersonation Rules:**
1. Super Admin can impersonate Admin Manager
2. Admin Manager can impersonate Admin Cabang (only from assigned branches)
3. Super Admin impersonating Admin Manager can continue to impersonate Admin Cabang (nested)
4. Cannot impersonate inactive users
5. Cannot impersonate users with same or higher role

**JWT Token Structure (Nested Impersonation):**
```json
{
  "userId": "super-admin-uuid",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "impersonating": {
    "userId": "manager-uuid",
    "email": "manager@raho.id",
    "role": "ADMIN_MANAGER",
    "branches": ["branch-uuid-1", "branch-uuid-2"],
    "impersonating": {
      "userId": "admin-cabang-uuid",
      "email": "admincabang@raho.id",
      "role": "ADMIN_CABANG",
      "branchId": "branch-uuid-1"
    }
  }
}
```

**Audit Logging:**
- Action: `LOGIN` (with meta.type = 'IMPERSONATE_START')
- Logs original user ID, target user email/role
- Tracks nested impersonation flag

---

### 4. POST /api/v1/admin/stop-impersonation
**Purpose:** Stop impersonation (handle nested - go back one level)

**Authorization:** Any authenticated user (with impersonation token)

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-without-last-impersonation-level",
    "user": {
      "id": "uuid",
      "email": "user@raho.id",
      "fullName": "User Name",
      "role": "SUPER_ADMIN" | "ADMIN_MANAGER",
      "branchId": "uuid",
      "branchCode": "PST",
      "branches": [...]
    }
  }
}
```

**Behavior:**
- If nested (Super Admin → Admin Manager → Admin Cabang): Returns to Admin Manager
- If single level (Admin Manager → Admin Cabang): Returns to Admin Manager
- If single level (Super Admin → Admin Manager): Returns to Super Admin
- Token expiration changes: 8h for impersonation → 24h for normal

**Audit Logging:**
- Action: `LOGOUT` (with meta.type = 'IMPERSONATE_STOP')
- Logs original user ID, impersonated user email/role

---

## Implementation Details

### Files Modified

1. **admin.schema.ts**
   - Added `getAdminManagersQuerySchema`
   - Added `getBranchAdminsQuerySchema`
   - Added `impersonateUserParamsSchema`
   - Added type exports

2. **admin.routes.ts**
   - Added `GET /managers` route with validation
   - Added `GET /branch-admins` route with validation
   - Added `POST /impersonate/:userId` route with validation
   - Added `POST /stop-impersonation` route
   - Imported `validateQuery` and `validateParams` middleware

3. **admin.controller.ts** (already implemented)
   - `getAdminManagers()` - Calls impersonation service
   - `getBranchAdmins()` - Calls impersonation service with branch filtering
   - `startImpersonation()` - Creates impersonation token with audit logging
   - `stopImpersonation()` - Stops impersonation with audit logging

4. **impersonation.service.ts** (already implemented)
   - `getAdminManagers()` - Fetches Admin Managers with pagination
   - `getBranchAdmins()` - Fetches Branch Admins filtered by manager branches
   - `createImpersonationToken()` - Creates JWT with nested impersonation support
   - `stopImpersonation()` - Handles going back one level
   - `validateImpersonation()` - Validates permissions
   - `getImpersonationChain()` - Returns full chain
   - `canImpersonate()` - Checks if user can impersonate

---

## Validation Schemas

### getAdminManagersQuerySchema
```typescript
{
  search: string (optional),
  isActive: boolean (optional, transformed from string),
  page: number (optional, default: 1),
  limit: number (optional, default: 10)
}
```

### getBranchAdminsQuerySchema
```typescript
{
  branchId: UUID (optional),
  search: string (optional),
  isActive: boolean (optional, transformed from string),
  page: number (optional, default: 1),
  limit: number (optional, default: 10)
}
```

### impersonateUserParamsSchema
```typescript
{
  userId: UUID (required)
}
```

---

## Authorization Matrix

| Endpoint | SUPER_ADMIN | ADMIN_MANAGER | ADMIN_CABANG | Other Roles |
|----------|-------------|---------------|--------------|-------------|
| GET /managers | ✅ | ❌ | ❌ | ❌ |
| GET /branch-admins | ✅ | ✅ (filtered) | ❌ | ❌ |
| POST /impersonate/:userId | ✅ | ✅ (limited) | ❌ | ❌ |
| POST /stop-impersonation | ✅ (if impersonating) | ✅ (if impersonating) | ✅ (if impersonating) | ❌ |

---

## Error Handling

### Common Errors

**403 Forbidden:**
- Not authorized for the endpoint
- Trying to impersonate user outside assigned branches
- Trying to impersonate same or higher role

**404 Not Found:**
- User not found
- Target user not found

**400 Bad Request:**
- Invalid UUID format
- Cannot impersonate inactive user
- Not currently impersonating (for stop-impersonation)
- Invalid query parameters

**401 Unauthorized:**
- Missing or invalid token
- Token expired

---

## Testing

### Database State
- ✅ Super Admin exists: `superadmin@raho.id`
- ✅ 2 Admin Managers found
- ✅ 3 Admin Cabang found

### Build Status
- ✅ TypeScript compilation successful
- ✅ All routes compiled correctly
- ✅ All controller functions exported
- ✅ Validation schemas compiled

### Manual Testing Checklist
- [ ] Super Admin can get list of Admin Managers
- [ ] Admin Manager can get list of Branch Admins (filtered)
- [ ] Super Admin can impersonate Admin Manager
- [ ] Admin Manager can impersonate Admin Cabang
- [ ] Super Admin → Admin Manager → Admin Cabang (nested)
- [ ] Stop impersonation goes back one level
- [ ] Audit logs are created for all actions
- [ ] Validation errors are returned correctly
- [ ] Authorization checks work correctly

---

## Next Steps

### Frontend Implementation (Task 3.x)
1. Create ImpersonationContext
2. Create Admin API clients
3. Create AdminManagersTab component
4. Create BranchAdminsTab component
5. Create ImpersonationBanner component
6. Integrate with layout

### Testing (Task 4.x)
1. Write unit tests for service
2. Write integration tests for endpoints
3. Write E2E tests for flows
4. Manual testing

---

## API Usage Examples

### Example 1: Super Admin gets Admin Managers
```bash
GET /api/v1/admin/managers?page=1&limit=10&search=manager
Authorization: Bearer <super-admin-token>
```

### Example 2: Admin Manager gets Branch Admins
```bash
GET /api/v1/admin/branch-admins?branchId=<branch-uuid>&isActive=true
Authorization: Bearer <admin-manager-token>
```

### Example 3: Super Admin impersonates Admin Manager
```bash
POST /api/v1/admin/impersonate/<manager-uuid>
Authorization: Bearer <super-admin-token>
```

### Example 4: Admin Manager impersonates Admin Cabang
```bash
POST /api/v1/admin/impersonate/<admin-cabang-uuid>
Authorization: Bearer <admin-manager-token>
```

### Example 5: Stop impersonation
```bash
POST /api/v1/admin/stop-impersonation
Authorization: Bearer <impersonation-token>
```

---

## Completion Status

✅ **Task 2.2: Add Impersonation Endpoints - COMPLETED**

All subtasks completed:
- ✅ Add `GET /api/v1/admin/managers` endpoint (Super Admin only)
- ✅ Add `GET /api/v1/admin/branch-admins` endpoint (Admin Manager only)
- ✅ Add `POST /api/v1/admin/impersonate/:userId` endpoint (generic - supports both roles)
- ✅ Add `POST /api/v1/admin/stop-impersonation` endpoint (handle nested impersonation)
- ✅ Add validation schemas
- ✅ Add authorization checks (SUPER_ADMIN for managers, ADMIN_MANAGER for branch admins)
- ✅ Add query parameter support for filtering branch admins by branch

**Estimated Time:** 2.5 hours
**Actual Time:** ~1.5 hours (faster due to existing implementation)

---

## Notes

- The controller and service were already implemented in Task 2.1
- This task focused on adding validation schemas and ensuring routes are properly configured
- All endpoints support pagination, search, and filtering
- Nested impersonation is fully supported (Super Admin → Admin Manager → Admin Cabang)
- Audit logging is integrated for all impersonation actions
- Error handling follows the existing error response format

