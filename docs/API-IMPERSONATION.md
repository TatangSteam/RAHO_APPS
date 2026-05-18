# 🎭 API Documentation — Multi-Level Impersonation System

## Overview

The Multi-Level Impersonation System allows users with higher roles to "act as" users with lower roles without requiring re-authentication. The system supports nested impersonation up to 2 levels deep:

1. **Super Admin** → Admin Manager
2. **Admin Manager** → Admin Cabang  
3. **Super Admin** → Admin Manager → Admin Cabang (nested)

When impersonating, the user gains **FULL ACCESS** to all features, pages, and data that the impersonated user can access. The system maintains a complete audit trail of all impersonation activities.

---

## Table of Contents

- [Authentication & Authorization](#authentication--authorization)
- [JWT Token Structure](#jwt-token-structure)
- [API Endpoints](#api-endpoints)
  - [GET /admin/managers](#get-adminmanagers)
  - [GET /admin/branch-admins](#get-adminbranch-admins)
  - [POST /admin/impersonate/:userId](#post-adminimpersonateuserid)
  - [POST /admin/stop-impersonation](#post-adminstop-impersonation)
- [Error Responses](#error-responses)
- [Usage Examples](#usage-examples)
- [Security Considerations](#security-considerations)

---

## Authentication & Authorization

### Base URL
```
Production : https://raho.domain.com/api/v1
Development: http://localhost:4000/api/v1
```

### Authentication Header
All endpoints require Bearer token authentication:
```http
Authorization: Bearer <accessToken>
```

### Role-Based Access Control

| Endpoint | Allowed Roles |
|----------|---------------|
| `GET /admin/managers` | `SUPER_ADMIN` |
| `GET /admin/branch-admins` | `SUPER_ADMIN`, `ADMIN_MANAGER` |
| `POST /admin/impersonate/:userId` | `SUPER_ADMIN`, `ADMIN_MANAGER` |
| `POST /admin/stop-impersonation` | Any authenticated user (with active impersonation) |

---

## JWT Token Structure

### Normal Token (No Impersonation)

```json
{
  "userId": "clxxx_super_001",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "branchCode": null,
  "fullName": "Super Admin",
  "staffCode": null,
  "iat": 1715000000,
  "exp": 1715086400
}
```

### Single-Level Impersonation (Super Admin → Admin Manager)

```json
{
  "userId": "clxxx_super_001",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "branchCode": null,
  "fullName": "Super Admin",
  "staffCode": null,
  "impersonating": {
    "userId": "clxxx_manager_001",
    "email": "manager@raho.id",
    "role": "ADMIN_MANAGER",
    "branches": ["clxxx_branch_jakarta", "clxxx_branch_bandung"]
  },
  "iat": 1715000000,
  "exp": 1715028800
}
```

### Single-Level Impersonation (Admin Manager → Admin Cabang)

```json
{
  "userId": "clxxx_manager_001",
  "email": "manager@raho.id",
  "role": "ADMIN_MANAGER",
  "branchId": null,
  "branchCode": null,
  "fullName": "Admin Manager",
  "staffCode": "AM-001",
  "impersonating": {
    "userId": "clxxx_admin_001",
    "email": "admincabang.jakarta@raho.id",
    "role": "ADMIN_CABANG",
    "branchId": "clxxx_branch_jakarta"
  },
  "iat": 1715000000,
  "exp": 1715028800
}
```

### Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)

```json
{
  "userId": "clxxx_super_001",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "branchCode": null,
  "fullName": "Super Admin",
  "staffCode": null,
  "impersonating": {
    "userId": "clxxx_manager_001",
    "email": "manager@raho.id",
    "role": "ADMIN_MANAGER",
    "branches": ["clxxx_branch_jakarta", "clxxx_branch_bandung"],
    "impersonating": {
      "userId": "clxxx_admin_001",
      "email": "admincabang.jakarta@raho.id",
      "role": "ADMIN_CABANG",
      "branchId": "clxxx_branch_jakarta"
    }
  },
  "iat": 1715000000,
  "exp": 1715028800
}
```

### Token Expiration

- **Normal token**: 24 hours
- **Impersonation token**: 8 hours (shorter for security)

---

## API Endpoints

### GET /admin/managers

Get a list of all Admin Managers in the system. Only accessible by Super Admin.

#### Request

```http
GET /api/v1/admin/managers?search=john&isActive=true&page=1&limit=10
Authorization: Bearer <superAdminToken>
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `search` | string | No | - | Search by name or email |
| `isActive` | boolean | No | - | Filter by active status |
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 10 | Items per page |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "managers": [
      {
        "id": "clxxx_manager_001",
        "email": "manager.jakarta@raho.id",
        "fullName": "John Manager",
        "isActive": true,
        "branches": [
          {
            "id": "clxxx_branch_jakarta",
            "name": "Jakarta Pusat",
            "branchCode": "PST"
          },
          {
            "id": "clxxx_branch_bandung",
            "name": "Bandung",
            "branchCode": "BDG"
          }
        ],
        "createdAt": "2026-01-15T08:00:00.000Z",
        "lastLoginAt": "2026-05-13T09:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 401 | `AUTH_TOKEN_MISSING` | Token autentikasi diperlukan |
| 401 | `AUTH_TOKEN_EXPIRED` | Sesi Anda telah berakhir. Silakan login kembali |
| 403 | `AUTH_FORBIDDEN` | Anda tidak memiliki akses ke resource ini |

---

### GET /admin/branch-admins

Get a list of Admin Cabang (Branch Admins) that the current Admin Manager has access to. Only accessible by Super Admin and Admin Manager.

#### Request

```http
GET /api/v1/admin/branch-admins?branchId=clxxx_branch_jakarta&search=admin&isActive=true&page=1&limit=10
Authorization: Bearer <adminManagerToken>
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `branchId` | string | No | - | Filter by specific branch ID |
| `search` | string | No | - | Search by name or email |
| `isActive` | boolean | No | - | Filter by active status |
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 10 | Items per page |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "id": "clxxx_admin_001",
        "email": "admincabang.jakarta@raho.id",
        "fullName": "Admin Jakarta",
        "isActive": true,
        "branch": {
          "id": "clxxx_branch_jakarta",
          "name": "Jakarta Pusat",
          "branchCode": "PST"
        },
        "createdAt": "2026-02-01T08:00:00.000Z",
        "lastLoginAt": "2026-05-13T10:00:00.000Z"
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

#### Behavior Notes

- **Admin Manager**: Only sees Admin Cabang from branches assigned to them
- **Super Admin**: Can see all Admin Cabang when impersonating an Admin Manager
- Results are automatically filtered based on the user's branch access

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 401 | `AUTH_TOKEN_MISSING` | Token autentikasi diperlukan |
| 403 | `FORBIDDEN` | Hanya Admin Manager yang dapat mengakses endpoint ini |

---

### POST /admin/impersonate/:userId

Start impersonating another user. Creates a new JWT token with impersonation data.

#### Request

```http
POST /api/v1/admin/impersonate/clxxx_manager_001
Authorization: Bearer <superAdminToken>
Content-Type: application/json
```

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | The ID of the user to impersonate |

#### Request Body

No request body required.

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "targetUser": {
      "id": "clxxx_manager_001",
      "email": "manager.jakarta@raho.id",
      "fullName": "John Manager",
      "role": "ADMIN_MANAGER",
      "branchId": null,
      "branchCode": null,
      "branches": [
        {
          "id": "clxxx_branch_jakarta",
          "name": "Jakarta Pusat",
          "branchCode": "PST"
        },
        {
          "id": "clxxx_branch_bandung",
          "name": "Bandung",
          "branchCode": "BDG"
        }
      ]
    }
  }
}
```

#### Impersonation Rules

1. **Super Admin → Admin Manager**
   - Super Admin can only impersonate users with role `ADMIN_MANAGER`
   - Cannot impersonate another Super Admin
   - Cannot impersonate if already impersonating

2. **Admin Manager → Admin Cabang**
   - Admin Manager can only impersonate users with role `ADMIN_CABANG`
   - Can only impersonate Admin Cabang from branches assigned to them
   - Can be done while Super Admin is impersonating Admin Manager (nested)

3. **Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)**
   - Maximum depth: 2 levels
   - Super Admin impersonates Admin Manager, then continues to impersonate Admin Cabang
   - Each level maintains the full chain in the JWT token

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 400 | `TARGET_USER_INACTIVE` | Tidak dapat impersonate user yang tidak aktif |
| 403 | `INVALID_IMPERSONATION_TARGET` | Super Admin hanya dapat impersonate Admin Manager |
| 403 | `INVALID_IMPERSONATION_TARGET` | Admin Manager hanya dapat impersonate Admin Cabang |
| 403 | `BRANCH_ACCESS_DENIED` | Admin Cabang ini tidak ada di branches yang Anda kelola |
| 403 | `IMPERSONATION_NOT_ALLOWED` | Anda tidak memiliki izin untuk melakukan impersonation |
| 404 | `USER_NOT_FOUND` | User tidak ditemukan |
| 404 | `TARGET_USER_NOT_FOUND` | User target tidak ditemukan |

#### Audit Logging

When impersonation starts, the following is logged to the audit log:

```json
{
  "userId": "clxxx_super_001",
  "action": "LOGIN",
  "resource": "Impersonation",
  "resourceId": "clxxx_manager_001",
  "meta": {
    "type": "IMPERSONATE_START",
    "targetUser": "manager.jakarta@raho.id",
    "targetRole": "ADMIN_MANAGER",
    "isNested": false
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

---

### POST /admin/stop-impersonation

Stop the current impersonation and return to the previous level (or original user).

#### Request

```http
POST /api/v1/admin/stop-impersonation
Authorization: Bearer <impersonationToken>
Content-Type: application/json
```

#### Request Body

No request body required.

#### Response `200 OK`

**Scenario 1: Single-level impersonation (return to original user)**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clxxx_super_001",
      "email": "superadmin@raho.id",
      "fullName": "Super Admin",
      "role": "SUPER_ADMIN",
      "branchId": null,
      "branchCode": null
    }
  }
}
```

**Scenario 2: Nested impersonation (return one level back)**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clxxx_manager_001",
      "email": "manager.jakarta@raho.id",
      "fullName": "John Manager",
      "role": "ADMIN_MANAGER",
      "branchId": null,
      "branchCode": null,
      "branches": [
        {
          "id": "clxxx_branch_jakarta",
          "name": "Jakarta Pusat",
          "branchCode": "PST"
        }
      ]
    }
  }
}
```

#### Behavior

- **Single-level impersonation**: Returns to the original user (token expiration: 24 hours)
- **Nested impersonation**: Returns one level back (token expiration: 8 hours)
- The returned token has the impersonation data removed for the stopped level
- Frontend should update the UI and redirect to the appropriate dashboard

#### Error Responses

| Status | Code | Message |
|--------|------|---------|
| 400 | `NOT_IMPERSONATING` | Tidak sedang dalam mode impersonation |
| 401 | `AUTH_TOKEN_MISSING` | Token autentikasi diperlukan |

#### Audit Logging

When impersonation stops, the following is logged to the audit log:

```json
{
  "userId": "clxxx_super_001",
  "action": "LOGOUT",
  "resource": "Impersonation",
  "resourceId": "clxxx_manager_001",
  "meta": {
    "type": "IMPERSONATE_STOP",
    "impersonatedUser": "manager.jakarta@raho.id",
    "impersonatedRole": "ADMIN_MANAGER"
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

---

## Error Responses

### Global Error Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message in Indonesian"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_TOKEN_MISSING` | 401 | Authorization header is missing or invalid format |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT token has expired |
| `AUTH_TOKEN_INVALID` | 401 | JWT token is malformed or invalid |
| `AUTH_FORBIDDEN` | 403 | User role does not have permission |
| `USER_NOT_FOUND` | 404 | User ID does not exist |
| `TARGET_USER_NOT_FOUND` | 404 | Target user ID does not exist |
| `TARGET_USER_INACTIVE` | 400 | Cannot impersonate inactive user |
| `INVALID_IMPERSONATION_TARGET` | 403 | Cannot impersonate user with this role |
| `BRANCH_ACCESS_DENIED` | 403 | User does not have access to this branch |
| `IMPERSONATION_NOT_ALLOWED` | 403 | User cannot perform impersonation |
| `NOT_IMPERSONATING` | 400 | Not currently in impersonation mode |
| `FORBIDDEN` | 403 | Generic forbidden access |

---

## Usage Examples

### Example 1: Super Admin Impersonates Admin Manager

**Step 1: Get list of Admin Managers**

```bash
curl -X GET "https://api.raho.id/api/v1/admin/managers?page=1&limit=10" \
  -H "Authorization: Bearer <superAdminToken>"
```

**Step 2: Start impersonation**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/impersonate/clxxx_manager_001" \
  -H "Authorization: Bearer <superAdminToken>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "targetUser": {
      "id": "clxxx_manager_001",
      "email": "manager@raho.id",
      "fullName": "John Manager",
      "role": "ADMIN_MANAGER",
      "branches": [...]
    }
  }
}
```

**Step 3: Use the new token for subsequent requests**

All API calls now use the impersonation token. The user will have Admin Manager permissions and see Admin Manager data.

**Step 4: Stop impersonation**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/stop-impersonation" \
  -H "Authorization: Bearer <impersonationToken>" \
  -H "Content-Type: application/json"
```

---

### Example 2: Admin Manager Impersonates Admin Cabang

**Step 1: Get list of Branch Admins**

```bash
curl -X GET "https://api.raho.id/api/v1/admin/branch-admins?branchId=clxxx_branch_jakarta" \
  -H "Authorization: Bearer <adminManagerToken>"
```

**Step 2: Start impersonation**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/impersonate/clxxx_admin_001" \
  -H "Authorization: Bearer <adminManagerToken>" \
  -H "Content-Type: application/json"
```

**Step 3: Stop impersonation**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/stop-impersonation" \
  -H "Authorization: Bearer <impersonationToken>" \
  -H "Content-Type: application/json"
```

---

### Example 3: Nested Impersonation (Super Admin → Admin Manager → Admin Cabang)

**Step 1: Super Admin impersonates Admin Manager**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/impersonate/clxxx_manager_001" \
  -H "Authorization: Bearer <superAdminToken>"
```

**Step 2: Continue to impersonate Admin Cabang (using the impersonation token from Step 1)**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/impersonate/clxxx_admin_001" \
  -H "Authorization: Bearer <impersonationToken1>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "targetUser": {
      "id": "clxxx_admin_001",
      "email": "admincabang.jakarta@raho.id",
      "role": "ADMIN_CABANG",
      "branchId": "clxxx_branch_jakarta"
    }
  }
}
```

The JWT token now contains nested impersonation:
```
Super Admin → Admin Manager → Admin Cabang
```

**Step 3: Stop impersonation (returns to Admin Manager level)**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/stop-impersonation" \
  -H "Authorization: Bearer <nestedImpersonationToken>"
```

**Step 4: Stop impersonation again (returns to Super Admin)**

```bash
curl -X POST "https://api.raho.id/api/v1/admin/stop-impersonation" \
  -H "Authorization: Bearer <impersonationToken1>"
```

---

## Security Considerations

### 1. Token Security

- **Shorter expiration**: Impersonation tokens expire in 8 hours (vs 24 hours for normal tokens)
- **No refresh**: Impersonation tokens cannot be refreshed; must stop and restart impersonation
- **Audit trail**: All impersonation activities are logged with original user ID

### 2. Authorization Checks

The authentication middleware extracts the **deepest impersonated user** and sets it as `req.user`. This ensures:

- All authorization checks use the impersonated user's role
- All data queries filter by the impersonated user's branch access
- No special cases or bypasses in the code

```typescript
// Example: Middleware behavior
if (payload.impersonating) {
  // Extract deepest level
  const deepest = extractDeepestImpersonation(payload);
  
  req.originalUser = { /* root user */ };
  req.user = { /* deepest impersonated user */ };
  req.isImpersonating = true;
  req.impersonationChain = ['super@raho.id', 'manager@raho.id', 'admin@raho.id'];
}
```

### 3. Data Access Equality

**Critical Principle**: Impersonated sessions must be 100% identical to actual user sessions.

✅ **Correct Implementation:**
```typescript
// Always use req.user for data filtering
const members = await prisma.member.findMany({
  where: {
    branchId: {
      in: req.user.role === 'ADMIN_MANAGER' 
        ? req.user.branches 
        : [req.user.branchId]
    }
  }
});
```

❌ **Incorrect Implementation:**
```typescript
// DON'T use originalUser for data access
if (req.originalUser?.role === 'SUPER_ADMIN') {
  // Show all data - WRONG!
  return await prisma.member.findMany();
}
```

### 4. Audit Logging

All actions during impersonation are logged with:

- **userId**: Original user ID (for tracking who performed the action)
- **meta.impersonating**: Email of the impersonated user
- **meta.note**: "Action performed as [Impersonated User Name]"

Example:
```json
{
  "userId": "clxxx_super_001",
  "action": "CREATE",
  "resource": "Member",
  "resourceId": "clxxx_member_new",
  "meta": {
    "impersonating": "manager@raho.id",
    "impersonatedRole": "ADMIN_MANAGER",
    "note": "Action performed as John Manager"
  }
}
```

### 5. Impersonation Restrictions

- Cannot impersonate users with the same or higher role
- Cannot impersonate inactive users
- Admin Manager can only impersonate Admin Cabang from assigned branches
- Maximum impersonation depth: 2 levels
- Cannot impersonate if already at maximum depth

### 6. Frontend Security

- Display clear banner showing impersonation status
- Show full impersonation chain: "Super Admin → Admin Manager → Admin Cabang"
- Easy-to-access "Stop Impersonation" button
- Sidebar and routing must match the impersonated user's role
- No data leakage from original user's permissions

---

## Frontend Integration

### Impersonation Context

The frontend should maintain an impersonation context:

```typescript
interface ImpersonationState {
  isImpersonating: boolean;
  originalUser: User | null;
  impersonatedUser: User | null;
  impersonationChain: string[];
}
```

### UI Components

1. **Impersonation Banner**
   - Shows when `isImpersonating === true`
   - Displays: "Anda sedang masuk sebagai [Name]"
   - For nested: "Super Admin → Admin Manager → Admin Cabang"
   - Includes "Kembali ke [Previous Role]" button

2. **Sidebar Menu**
   - Dynamically changes based on `impersonatedUser.role`
   - Shows only menus accessible by the impersonated role

3. **Routing**
   - Redirects to appropriate dashboard after impersonation starts
   - Super Admin → Admin Manager: redirect to `/admin-manager`
   - Admin Manager → Admin Cabang: redirect to `/dashboard`

### Token Management

```typescript
// Start impersonation
const startImpersonation = async (userId: string) => {
  const response = await fetch(`/api/v1/admin/impersonate/${userId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${currentToken}`
    }
  });
  
  const { data } = await response.json();
  
  // Store new token
  localStorage.setItem('token', data.token);
  
  // Update state
  setImpersonationState({
    isImpersonating: true,
    originalUser: currentUser,
    impersonatedUser: data.targetUser
  });
  
  // Redirect to appropriate dashboard
  router.push(getDashboardPath(data.targetUser.role));
};

// Stop impersonation
const stopImpersonation = async () => {
  const response = await fetch('/api/v1/admin/stop-impersonation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${currentToken}`
    }
  });
  
  const { data } = await response.json();
  
  // Restore token
  localStorage.setItem('token', data.token);
  
  // Update state
  setImpersonationState({
    isImpersonating: false,
    originalUser: null,
    impersonatedUser: null
  });
  
  // Redirect back
  router.push(getDashboardPath(data.user.role));
};
```

---

## Testing Scenarios

### Test Case 1: Super Admin → Admin Manager

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Super Admin logs in | Normal Super Admin dashboard |
| 2 | Navigate to Admin Managers tab | See list of Admin Managers |
| 3 | Click "Masuk Sebagai" on a manager | Redirect to `/admin-manager` |
| 4 | Check sidebar | Shows Admin Manager menus |
| 5 | Check data access | Only sees data from manager's branches |
| 6 | Create a member | Member is created with manager's branch |
| 7 | Click "Kembali ke Super Admin" | Returns to Super Admin dashboard |

### Test Case 2: Admin Manager → Admin Cabang

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin Manager logs in | Admin Manager dashboard |
| 2 | Navigate to Branch Admins tab | See list of Admin Cabang from assigned branches |
| 3 | Click "Masuk Sebagai" on an admin | Redirect to `/dashboard` |
| 4 | Check sidebar | Shows Admin Cabang menus |
| 5 | Check data access | Only sees data from single branch |
| 6 | Click "Kembali ke Admin Manager" | Returns to Admin Manager dashboard |

### Test Case 3: Nested Impersonation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Super Admin impersonates Manager | Acting as Admin Manager |
| 2 | Navigate to Branch Admins tab | See Admin Cabang from manager's branches |
| 3 | Impersonate Admin Cabang | Acting as Admin Cabang |
| 4 | Check banner | Shows "Super Admin → Admin Manager → Admin Cabang" |
| 5 | Check data access | Only sees single branch data |
| 6 | Click "Kembali" | Returns to Admin Manager level |
| 7 | Click "Kembali" again | Returns to Super Admin level |

### Test Case 4: Security Validation

| Test | Expected Behavior |
|------|-------------------|
| Super Admin tries to impersonate another Super Admin | 403 error |
| Admin Manager tries to impersonate Admin Cabang from unassigned branch | 403 error |
| Try to impersonate inactive user | 400 error |
| Try to stop impersonation without active impersonation | 400 error |
| Impersonation token expires after 8 hours | 401 error on next request |
| All actions logged to audit log | Audit entries created with original user ID |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-05-13 | Initial documentation for multi-level impersonation system |

---

## Support

For questions or issues related to the impersonation system, please contact:
- **Technical Lead**: [Your Name]
- **Email**: tech@raho.id
- **Documentation**: https://docs.raho.id/impersonation

---

**Last Updated**: May 13, 2026  
**API Version**: v1  
**Document Version**: 1.0.0
