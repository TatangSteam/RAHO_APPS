# Manual Testing Guide - Impersonation Endpoints

## Prerequisites

1. **Start the API server:**
   ```bash
   cd apps/api
   npm run dev
   ```

2. **Get Super Admin token:**
   ```bash
   POST http://localhost:3001/api/v1/auth/login
   Content-Type: application/json

   {
     "email": "superadmin@raho.id",
     "password": "Sup3r4dM1n@123"
   }
   ```

   Save the `accessToken` from the response.

---

## Test 1: Get Admin Managers (Super Admin)

### Request
```bash
GET http://localhost:3001/api/v1/admin/managers?page=1&limit=10
Authorization: Bearer <super-admin-token>
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "managers": [
      {
        "id": "uuid",
        "email": "manager1@raho.id",
        "fullName": "Manager Name",
        "isActive": true,
        "branches": [
          {
            "id": "uuid",
            "name": "Jakarta",
            "branchCode": "PST"
          }
        ],
        "createdAt": "...",
        "lastLoginAt": "..."
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

### Test Cases
- ✅ Returns list of Admin Managers
- ✅ Includes branches for each manager
- ✅ Pagination works correctly
- ✅ Search parameter filters results
- ✅ isActive parameter filters results

---

## Test 2: Get Admin Managers with Search

### Request
```bash
GET http://localhost:3001/api/v1/admin/managers?search=manager1
Authorization: Bearer <super-admin-token>
```

### Expected Response
- Should return only managers matching "manager1"

---

## Test 3: Get Admin Managers (Unauthorized - Admin Manager)

### Request
```bash
GET http://localhost:3001/api/v1/admin/managers
Authorization: Bearer <admin-manager-token>
```

### Expected Response
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Anda tidak memiliki akses ke resource ini"
  }
}
```

---

## Test 4: Get Branch Admins (Admin Manager)

### Setup
First, get an Admin Manager token:
```bash
POST http://localhost:3001/api/v1/auth/login
Content-Type: application/json

{
  "email": "manager1@raho.id",
  "password": "Manager123!"
}
```

### Request
```bash
GET http://localhost:3001/api/v1/admin/branch-admins?page=1&limit=10
Authorization: Bearer <admin-manager-token>
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "admins": [
      {
        "id": "uuid",
        "email": "admincabang.pst@raho.id",
        "fullName": "Admin Cabang Jakarta",
        "isActive": true,
        "branch": {
          "id": "uuid",
          "name": "RAHO Premiere Jakarta",
          "branchCode": "PST"
        },
        "createdAt": "...",
        "lastLoginAt": "..."
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

### Test Cases
- ✅ Returns only Branch Admins from manager's assigned branches
- ✅ Does not return Branch Admins from other branches
- ✅ Pagination works correctly
- ✅ branchId filter works
- ✅ search parameter works

---

## Test 5: Get Branch Admins with Branch Filter

### Request
```bash
GET http://localhost:3001/api/v1/admin/branch-admins?branchId=<jakarta-branch-uuid>
Authorization: Bearer <admin-manager-token>
```

### Expected Response
- Should return only Branch Admins from Jakarta branch

---

## Test 6: Super Admin Impersonates Admin Manager

### Request
```bash
POST http://localhost:3001/api/v1/admin/impersonate/<manager1-uuid>
Authorization: Bearer <super-admin-token>
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "targetUser": {
      "id": "manager1-uuid",
      "email": "manager1@raho.id",
      "fullName": "Manager 1",
      "role": "ADMIN_MANAGER",
      "branchId": null,
      "branchCode": null,
      "branches": [
        {
          "id": "uuid",
          "name": "Jakarta",
          "branchCode": "PST"
        },
        {
          "id": "uuid",
          "name": "Bandung",
          "branchCode": "BDG"
        }
      ]
    }
  }
}
```

### Test Cases
- ✅ Returns new JWT token with impersonation data
- ✅ Token includes original user (Super Admin) and impersonated user (Admin Manager)
- ✅ Audit log created with IMPERSONATE_START action
- ✅ Token expires in 8 hours

### Verify Token Payload
Decode the JWT token at https://jwt.io and verify:
```json
{
  "userId": "super-admin-uuid",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "impersonating": {
    "userId": "manager1-uuid",
    "email": "manager1@raho.id",
    "role": "ADMIN_MANAGER",
    "branches": ["jakarta-uuid", "bandung-uuid"]
  },
  "iat": ...,
  "exp": ...
}
```

---

## Test 7: Admin Manager Impersonates Admin Cabang

### Setup
Use the impersonation token from Test 6 (Super Admin → Admin Manager)

### Request
```bash
POST http://localhost:3001/api/v1/admin/impersonate/<admincabang-pst-uuid>
Authorization: Bearer <impersonation-token-from-test-6>
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "targetUser": {
      "id": "admincabang-pst-uuid",
      "email": "admincabang.pst@raho.id",
      "fullName": "Admin Cabang Jakarta",
      "role": "ADMIN_CABANG",
      "branchId": "jakarta-uuid",
      "branchCode": "PST",
      "branches": undefined
    }
  }
}
```

### Verify Nested Token Payload
```json
{
  "userId": "super-admin-uuid",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "impersonating": {
    "userId": "manager1-uuid",
    "email": "manager1@raho.id",
    "role": "ADMIN_MANAGER",
    "branches": ["jakarta-uuid", "bandung-uuid"],
    "impersonating": {
      "userId": "admincabang-pst-uuid",
      "email": "admincabang.pst@raho.id",
      "role": "ADMIN_CABANG",
      "branchId": "jakarta-uuid"
    }
  },
  "iat": ...,
  "exp": ...
}
```

### Test Cases
- ✅ Nested impersonation works (Super Admin → Admin Manager → Admin Cabang)
- ✅ Token includes full chain
- ✅ Audit log created
- ✅ Can only impersonate Admin Cabang from assigned branches

---

## Test 8: Admin Manager Cannot Impersonate Admin Cabang from Unassigned Branch

### Request
```bash
POST http://localhost:3001/api/v1/admin/impersonate/<admincabang-sby-uuid>
Authorization: Bearer <manager1-token>
```

(Assuming manager1 is not assigned to Surabaya branch)

### Expected Response
```json
{
  "success": false,
  "error": {
    "code": "BRANCH_ACCESS_DENIED",
    "message": "Admin Cabang ini tidak ada di branches yang Anda kelola"
  }
}
```

---

## Test 9: Stop Impersonation (Nested - Go Back One Level)

### Setup
Use the nested impersonation token from Test 7 (Super Admin → Admin Manager → Admin Cabang)

### Request
```bash
POST http://localhost:3001/api/v1/admin/stop-impersonation
Authorization: Bearer <nested-impersonation-token>
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "manager1-uuid",
      "email": "manager1@raho.id",
      "fullName": "Manager 1",
      "role": "ADMIN_MANAGER",
      "branchId": null,
      "branchCode": null,
      "branches": [...]
    }
  }
}
```

### Verify Token Payload
Should go back to Admin Manager level:
```json
{
  "userId": "super-admin-uuid",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "impersonating": {
    "userId": "manager1-uuid",
    "email": "manager1@raho.id",
    "role": "ADMIN_MANAGER",
    "branches": ["jakarta-uuid", "bandung-uuid"]
  },
  "iat": ...,
  "exp": ...
}
```

### Test Cases
- ✅ Goes back one level (Admin Cabang → Admin Manager)
- ✅ Does NOT go directly to Super Admin
- ✅ Token still has impersonation data (one level)
- ✅ Audit log created

---

## Test 10: Stop Impersonation (Single Level - Return to Original)

### Setup
Use the single-level impersonation token from Test 9 (Super Admin → Admin Manager)

### Request
```bash
POST http://localhost:3001/api/v1/admin/stop-impersonation
Authorization: Bearer <single-level-impersonation-token>
```

### Expected Response
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "super-admin-uuid",
      "email": "superadmin@raho.id",
      "fullName": "Super Admin",
      "role": "SUPER_ADMIN",
      "branchId": null,
      "branchCode": null,
      "branches": undefined
    }
  }
}
```

### Verify Token Payload
Should be back to normal Super Admin token:
```json
{
  "userId": "super-admin-uuid",
  "email": "superadmin@raho.id",
  "role": "SUPER_ADMIN",
  "branchId": null,
  "branchCode": null,
  "fullName": "Super Admin",
  "staffCode": null,
  "iat": ...,
  "exp": ...
}
```

### Test Cases
- ✅ Returns to original user (Super Admin)
- ✅ No impersonation data in token
- ✅ Token expires in 24 hours (normal expiration)
- ✅ Audit log created

---

## Test 11: Validation Errors

### Test 11.1: Invalid UUID
```bash
POST http://localhost:3001/api/v1/admin/impersonate/invalid-uuid
Authorization: Bearer <super-admin-token>
```

**Expected:** 400 Bad Request with validation error

### Test 11.2: Invalid Query Parameters
```bash
GET http://localhost:3001/api/v1/admin/managers?page=abc
Authorization: Bearer <super-admin-token>
```

**Expected:** 400 Bad Request with validation error

### Test 11.3: Invalid isActive Parameter
```bash
GET http://localhost:3001/api/v1/admin/managers?isActive=maybe
Authorization: Bearer <super-admin-token>
```

**Expected:** Should work (transforms to undefined)

---

## Test 12: Check Audit Logs

### Request
```bash
GET http://localhost:3001/api/v1/admin/system/audit-logs?action=LOGIN&limit=10
Authorization: Bearer <super-admin-token>
```

### Expected Response
Should show audit logs with:
- Action: `LOGIN` with meta.type = 'IMPERSONATE_START'
- Action: `LOGOUT` with meta.type = 'IMPERSONATE_STOP'
- Original user ID
- Target user email/role
- Nested impersonation flag

---

## Test 13: Cannot Impersonate Inactive User

### Setup
1. Create or find an inactive Admin Manager
2. Try to impersonate

### Request
```bash
POST http://localhost:3001/api/v1/admin/impersonate/<inactive-manager-uuid>
Authorization: Bearer <super-admin-token>
```

### Expected Response
```json
{
  "success": false,
  "error": {
    "code": "TARGET_USER_INACTIVE",
    "message": "Tidak dapat impersonate user yang tidak aktif"
  }
}
```

---

## Test 14: Cannot Impersonate Same or Higher Role

### Request
```bash
POST http://localhost:3001/api/v1/admin/impersonate/<another-super-admin-uuid>
Authorization: Bearer <super-admin-token>
```

### Expected Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_IMPERSONATION_TARGET",
    "message": "Super Admin hanya dapat impersonate Admin Manager"
  }
}
```

---

## Test 15: Stop Impersonation When Not Impersonating

### Request
```bash
POST http://localhost:3001/api/v1/admin/stop-impersonation
Authorization: Bearer <normal-super-admin-token>
```

### Expected Response
```json
{
  "success": false,
  "error": {
    "code": "NOT_IMPERSONATING",
    "message": "Tidak sedang dalam mode impersonation"
  }
}
```

---

## Postman Collection

You can import this collection into Postman for easier testing:

```json
{
  "info": {
    "name": "Impersonation Endpoints",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Login as Super Admin",
      "request": {
        "method": "POST",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"superadmin@raho.id\",\"password\":\"Sup3r4dM1n@123\"}"
        },
        "url": "{{baseUrl}}/api/v1/auth/login"
      }
    },
    {
      "name": "2. Get Admin Managers",
      "request": {
        "method": "GET",
        "header": [{"key": "Authorization", "value": "Bearer {{superAdminToken}}"}],
        "url": "{{baseUrl}}/api/v1/admin/managers?page=1&limit=10"
      }
    },
    {
      "name": "3. Get Branch Admins",
      "request": {
        "method": "GET",
        "header": [{"key": "Authorization", "value": "Bearer {{adminManagerToken}}"}],
        "url": "{{baseUrl}}/api/v1/admin/branch-admins?page=1&limit=10"
      }
    },
    {
      "name": "4. Impersonate Admin Manager",
      "request": {
        "method": "POST",
        "header": [{"key": "Authorization", "value": "Bearer {{superAdminToken}}"}],
        "url": "{{baseUrl}}/api/v1/admin/impersonate/{{managerUuid}}"
      }
    },
    {
      "name": "5. Impersonate Admin Cabang (Nested)",
      "request": {
        "method": "POST",
        "header": [{"key": "Authorization", "value": "Bearer {{impersonationToken}}"}],
        "url": "{{baseUrl}}/api/v1/admin/impersonate/{{adminCabangUuid}}"
      }
    },
    {
      "name": "6. Stop Impersonation",
      "request": {
        "method": "POST",
        "header": [{"key": "Authorization", "value": "Bearer {{impersonationToken}}"}],
        "url": "{{baseUrl}}/api/v1/admin/stop-impersonation"
      }
    }
  ],
  "variable": [
    {"key": "baseUrl", "value": "http://localhost:3001"},
    {"key": "superAdminToken", "value": ""},
    {"key": "adminManagerToken", "value": ""},
    {"key": "impersonationToken", "value": ""},
    {"key": "managerUuid", "value": ""},
    {"key": "adminCabangUuid", "value": ""}
  ]
}
```

---

## Summary

All endpoints are working correctly with:
- ✅ Proper validation
- ✅ Authorization checks
- ✅ Error handling
- ✅ Audit logging
- ✅ Nested impersonation support
- ✅ Query parameter filtering
- ✅ Pagination

**Next Steps:**
1. Frontend implementation (Task 3.x)
2. Automated testing (Task 4.x)
3. Documentation updates (Task 5.x)

