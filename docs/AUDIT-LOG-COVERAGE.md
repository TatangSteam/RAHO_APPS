# Audit Log Coverage Documentation

## Overview
Sistem audit log merekam semua aktivitas penting dalam aplikasi untuk keperluan compliance, security monitoring, dan troubleshooting. Semua audit log menggunakan "fire-and-forget" pattern untuk mencegah kegagalan audit log memblokir operasi bisnis.

## Authentication & Session Management

### ✅ LOGIN
- **Action**: `LOGIN`
- **Resource**: `Auth`
- **Trigger**: User berhasil login
- **Metadata**:
  - email: Email user yang login
  - role: Role user
  - branchId: ID cabang (jika applicable)
- **Location**: `apps/api/src/modules/auth/auth.service.ts` - `loginService()`
- **IP & User Agent**: ✅ Tracked

### ✅ LOGOUT
- **Action**: `LOGOUT`
- **Resource**: `Auth`
- **Trigger**: User logout
- **Metadata**:
  - email: Email user yang logout
  - role: Role user
- **Location**: `apps/api/src/modules/auth/auth.controller.ts` - `logout()`
- **IP & User Agent**: ✅ Tracked

### ✅ FAILED_LOGIN
- **Action**: `FAILED_LOGIN`
- **Resource**: `Auth`
- **Trigger**: Login gagal (password salah atau akun tidak aktif)
- **Metadata**:
  - email: Email yang digunakan
  - reason: Alasan kegagalan ("Invalid password" atau "Account inactive")
- **Location**: `apps/api/src/modules/auth/auth.service.ts` - `loginService()`
- **IP & User Agent**: ✅ Tracked
- **Security Note**: Membantu mendeteksi brute force attacks

## User & Staff Management

### ✅ CREATE (User)
- **Action**: `CREATE`
- **Resource**: `User`
- **Trigger**: Staff baru dibuat
- **Metadata**:
  - email: Email user baru
  - role: Role user baru
  - createdUserEmail: Email yang dibuat
  - createdUserRole: Role yang dibuat
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `createUser()`

### ✅ UPDATE (User)
- **Action**: `UPDATE`
- **Resource**: `User`
- **Trigger**: User data diupdate (role, branch, profile, status)
- **Metadata**:
  - changes: Object berisi field yang diubah
  - updatedUserEmail: Email user yang diupdate
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `updateUser()`

### ✅ DELETE (User Deactivation)
- **Action**: `DELETE`
- **Resource**: `User`
- **Trigger**: User di-deactivate
- **Metadata**:
  - action: "deactivate"
  - deactivatedUserEmail: Email user yang di-deactivate
  - deactivatedUserRole: Role user yang di-deactivate
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `deactivateUser()`

### ✅ PASSWORD_CHANGE
- **Action**: `PASSWORD_CHANGE`
- **Resource**: `User`
- **Trigger**: User mengubah password sendiri
- **Metadata**:
  - action: "self_password_change"
  - email: Email user yang mengubah password
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `changePassword()`
- **Security Note**: Penting untuk tracking unauthorized password changes

### ✅ PASSWORD_RESET
- **Action**: `PASSWORD_RESET`
- **Resource**: `User`
- **Trigger**: Admin mereset password user lain
- **Metadata**:
  - action: "admin_password_reset"
  - resetByUserId: ID admin yang mereset
  - resetByEmail: Email admin yang mereset
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `resetPassword()`
- **Security Note**: Tracking admin-initiated password resets

### ✅ UPDATE (Email Change)
- **Action**: `UPDATE`
- **Resource**: `User`
- **Trigger**: Super Admin mengubah email user (operasi sensitif)
- **Metadata**:
  - action: "email_change"
  - oldEmail: Email lama
  - newEmail: Email baru
  - changedByUserId: ID admin yang mengubah
  - changedByEmail: Email admin yang mengubah
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `updateUserEmail()`

### ✅ CREATE (StaffBranch)
- **Action**: `CREATE`
- **Resource**: `StaffBranch`
- **Trigger**: Staff di-assign ke cabang tambahan
- **Metadata**:
  - targetUserId: ID staff yang di-assign
  - assignedBranchId: ID cabang yang ditambahkan
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `assignUserToBranch()`

### ✅ DELETE (StaffBranch)
- **Action**: `DELETE`
- **Resource**: `StaffBranch`
- **Trigger**: Staff assignment ke cabang dihapus
- **Metadata**:
  - targetUserId: ID staff
  - removedBranchId: ID cabang yang dihapus
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `removeUserFromBranch()`

### ✅ UPDATE (Primary Branch Change)
- **Action**: `UPDATE`
- **Resource**: `User`
- **Trigger**: Cabang utama staff diubah
- **Metadata**:
  - action: "set_primary_branch"
  - oldPrimaryBranch: Info cabang lama
  - newPrimaryBranch: Info cabang baru
- **Location**: `apps/api/src/modules/users/users.controller.ts` - `setPrimaryBranch()`

## Member Management

### ✅ CREATE (Member Registration)
- **Action**: `CREATE`
- **Resource**: `Member`
- **Location**: `apps/api/src/modules/members/services/member-registration.service.ts`

### ✅ UPDATE (Member Data)
- **Action**: `UPDATE`
- **Resource**: `Member`
- **Location**: `apps/api/src/modules/members/services/member-update.service.ts`

### ✅ UPDATE (Member Deactivation)
- **Action**: `UPDATE`
- **Resource**: `Member`
- **Metadata**: action: "deactivate"
- **Location**: `apps/api/src/modules/members/services/member-update.service.ts`

### ✅ UPDATE (Password Reset)
- **Action**: `UPDATE`
- **Resource**: `Member`
- **Metadata**: action: "password_reset"
- **Location**: `apps/api/src/modules/members/services/member-update.service.ts`

### ✅ CREATE (Branch Access Grant)
- **Action**: `CREATE`
- **Resource**: `BranchMemberAccess`
- **Location**: `apps/api/src/modules/members/services/member-branch-access.service.ts`

### ✅ DELETE (Branch Access Revoke)
- **Action**: `DELETE`
- **Resource**: `BranchMemberAccess`
- **Location**: `apps/api/src/modules/members/services/member-branch-access.service.ts`

### ✅ CREATE/UPDATE/DELETE (Member Documents)
- **Actions**: `CREATE`, `UPDATE`, `DELETE`
- **Resource**: `MemberDocument`
- **Location**: `apps/api/src/modules/members/services/member-documents.service.ts`

## Package & Payment Management

### ✅ CREATE (Package Assignment)
- **Action**: `CREATE`
- **Resource**: Various (Package, GroupPackage, AddOnPackage)
- **Location**: Multiple package assignment services

### ✅ UPDATE (Payment Verification)
- **Action**: `UPDATE`
- **Resource**: Package/Invoice
- **Metadata**: action: "verify_payment"
- **Location**: `apps/api/src/modules/packages/services/payment-verification.service.ts`

### ✅ UPDATE (Payment Rejection)
- **Action**: `UPDATE`
- **Resource**: Package/Invoice
- **Metadata**: 
  - action: "reject_payment"
  - rejectionReason: Alasan reject
- **Location**: `apps/api/src/modules/packages/services/payment-verification.service.ts`

### ✅ UPDATE (Package Edit)
- **Action**: `UPDATE`
- **Resource**: Package
- **Location**: `apps/api/src/modules/packages/services/package-edit.service.ts`

### ✅ UPDATE (Package Refund)
- **Action**: `UPDATE`
- **Resource**: Package
- **Metadata**: action: "refund"
- **Location**: Package refund services

### ✅ UPDATE (Package Cancellation)
- **Action**: `UPDATE`
- **Resource**: Package
- **Metadata**: action: "cancel"
- **Location**: Package cancellation services

### ✅ UPDATE (Package Pricing Changes)
- **Action**: `UPDATE`
- **Resource**: `PackagePricing`
- **Location**: `apps/api/src/modules/admin/admin.controller.ts`

## Therapy Session Management

### ✅ CREATE (Session Creation)
- **Action**: `CREATE`
- **Resource**: `TreatmentSession`
- **Location**: `apps/api/src/modules/sessions/services/session-creation.service.ts`

### ✅ UPDATE (Session Completion)
- **Action**: `UPDATE`
- **Resource**: `TreatmentSession`
- **Metadata**: action: "complete"
- **Location**: Session completion service

### ✅ UPDATE (Diagnosis)
- **Action**: `UPDATE`
- **Resource**: `TreatmentSession`
- **Metadata**: action: "diagnosis"
- **Location**: `apps/api/src/modules/sessions/services/diagnosis.service.ts`

### ✅ UPDATE (Therapy Plan)
- **Action**: `UPDATE`
- **Resource**: `TreatmentSession`
- **Metadata**: action: "therapy_plan"
- **Location**: `apps/api/src/modules/sessions/services/therapy-plan.service.ts`

### ✅ UPDATE (Infusion Data)
- **Action**: `UPDATE`
- **Resource**: `TreatmentSession`
- **Metadata**: action: "infusion"
- **Location**: `apps/api/src/modules/sessions/services/infusion.service.ts`

### ✅ UPDATE (Materials Usage)
- **Action**: `UPDATE`
- **Resource**: `TreatmentSession`
- **Metadata**: action: "materials"
- **Location**: Material usage service

### ✅ UPDATE (Evaluation/Notes)
- **Action**: `UPDATE`
- **Resource**: `TreatmentSession`
- **Metadata**: action: "evaluation"
- **Location**: Evaluation service

### ✅ UPDATE (EMR)
- **Action**: `UPDATE`
- **Resource**: `TreatmentSession`
- **Metadata**: action: "emr"
- **Location**: EMR service

## Medical Records

### ✅ CREATE/UPDATE (Medical Records)
- **Actions**: `CREATE`, `UPDATE`
- **Resource**: `MedicalRecord`
- **Location**: `apps/api/src/modules/members/services/member-medical-records.service.ts`

## Inventory Management

Status: ✅ **COMPLETE**

### ✅ CREATE (Stock Request)
- **Action**: `CREATE`
- **Resource**: `StockRequest`
- **Location**: `apps/api/src/modules/inventory/services/stock-request-creation.service.ts`

### ✅ CREATE (Shipment Creation - Approval)
- **Action**: `CREATE`
- **Resource**: `Shipment`
- **Location**: `apps/api/src/modules/inventory/services/stock-request-approval.service.ts`

### ✅ UPDATE (Stock Request Approval)
- **Action**: `UPDATE`
- **Resource**: `StockRequest`
- **Metadata**: action: "approve"
- **Location**: `apps/api/src/modules/inventory/services/stock-request-approval.service.ts`

### ✅ UPDATE (Stock Request Rejection)
- **Action**: `UPDATE`
- **Resource**: `StockRequest`
- **Metadata**: action: "reject"
- **Location**: `apps/api/src/modules/inventory/services/stock-request-approval.service.ts`

### ✅ UPDATE (Shipment Processing)
- **Action**: `UPDATE`
- **Resource**: `Shipment`
- **Metadata**: action: "ship" or "receive"
- **Location**: `apps/api/src/modules/inventory/services/shipment-processing.service.ts`

### ✅ UPDATE (Overstock Management)
- **Action**: `UPDATE`
- **Resource**: `Overstock`
- **Location**: `apps/api/src/modules/inventory/services/overstock.service.ts`

## Branch Management

Status: ✅ **COMPLETE**

### ✅ CREATE (Branch)
- **Action**: `CREATE`
- **Resource**: `Branch`
- **Location**: `apps/api/src/modules/branches/branches.controller.ts` - `createBranch()`

### ✅ UPDATE (Branch)
- **Action**: `UPDATE`
- **Resource**: `Branch`
- **Location**: `apps/api/src/modules/branches/branches.controller.ts` - `updateBranch()`

### ✅ DELETE (Branch)
- **Action**: `DELETE`
- **Resource**: `Branch`
- **Location**: `apps/api/src/modules/branches/branches.controller.ts` - `deleteBranch()`

### ✅ CREATE (Manager Assignment)
- **Action**: `CREATE`
- **Resource**: `BranchManager`
- **Location**: `apps/api/src/modules/branches/branches.controller.ts` - `assignManager()`

### ✅ DELETE (Manager Unassignment)
- **Action**: `DELETE`
- **Resource**: `BranchManager`
- **Location**: `apps/api/src/modules/branches/branches.controller.ts` - `unassignManager()`

## Audit Log Best Practices

### Fire-and-Forget Pattern
All audit logs use `.catch()` to prevent failures from blocking business operations:

```typescript
logAudit({...}).catch((error) => {
  console.error('❌ Failed to create audit log:', error);
});
```

### IP Address & User Agent Tracking
Authentication operations (LOGIN, LOGOUT, FAILED_LOGIN) track:
- IP Address (with IPv6 → IPv4 conversion for localhost)
- User Agent (browser/client information)

### Branch Context
Audit logs respect organizational hierarchy:
- SUPER_ADMIN and ADMIN_MANAGER: `branchId` is null (organization-wide)
- Other roles: `branchId` is populated for branch-specific filtering

### Metadata Standards
- Include relevant identifiers (email, role, IDs)
- For changes: Include old and new values when applicable
- For admin actions: Include who performed the action (`changedByUserId`, `changedByEmail`)
- For rejections/approvals: Include reasons

## Security & Compliance Benefits

1. **Unauthorized Access Detection**: Track failed logins and unusual access patterns
2. **Change Auditing**: Who changed what, when, and why
3. **Compliance**: Meet regulatory requirements for healthcare data access
4. **Troubleshooting**: Investigate issues by reviewing operation history
5. **Accountability**: Clear audit trail for all sensitive operations

## Query Examples

### Recent Failed Logins
```sql
SELECT * FROM audit_logs
WHERE action = 'FAILED_LOGIN'
ORDER BY "createdAt" DESC
LIMIT 20;
```

### User Activity
```sql
SELECT * FROM audit_logs
WHERE "userId" = 'user-id-here'
ORDER BY "createdAt" DESC;
```

### Password Changes
```sql
SELECT * FROM audit_logs
WHERE action IN ('PASSWORD_CHANGE', 'PASSWORD_RESET')
ORDER BY "createdAt" DESC;
```

### Branch-Specific Activity
```sql
SELECT * FROM audit_logs
WHERE "branchId" = 'branch-id-here'
ORDER BY "createdAt" DESC;
```

## Frontend Integration

Audit logs dapat dilihat di:
- **Super Admin Dashboard**: `/admin/audit-logs` - View all audit logs across organization
- **Filter Options**:
  - By user (userId)
  - By action type (LOGIN, CREATE, UPDATE, DELETE, etc.)
  - By resource type (User, Member, Package, etc.)
  - By date range
  - By branch

## Next Steps

### ✅ ALL CRITICAL MODULES COMPLETE

All major modules now have comprehensive audit logging:

1. ✅ **Authentication** - COMPLETE (LOGIN, LOGOUT, FAILED_LOGIN)
2. ✅ **User Management** - COMPLETE (CREATE, UPDATE, DELETE, PASSWORD operations)
3. ✅ **Member Management** - COMPLETE (Registration, updates, documents, branch access)
4. ✅ **Package Management** - COMPLETE (Assignment, payment, refunds, pricing)
5. ✅ **Therapy Sessions** - COMPLETE (All session lifecycle events)
6. ✅ **Medical Records** - COMPLETE (CREATE, UPDATE)
7. ✅ **Inventory Management** - COMPLETE (Stock requests, shipments, overstock)
8. ✅ **Branch Management** - COMPLETE (Branch CRUD, manager assignments)

### Audit Log Implementation Summary

**Total Coverage**: ~50+ different audit log types across 8 major modules

**Key Security Features**:
- Failed login tracking for brute force detection
- Password change/reset tracking
- Email change tracking (super admin only)
- Payment verification/rejection tracking
- All CRUD operations on critical resources

**All implementations follow best practices**:
- ✅ Fire-and-forget pattern (non-blocking)
- ✅ IP address & User Agent tracking for auth events
- ✅ Proper branch context (null for org-wide roles)
- ✅ Rich metadata with old/new values where applicable
- ✅ Action identifiers (who did what)

### Future Enhancements
- Real-time audit log monitoring dashboard
- Automated alerts for suspicious activities (e.g., multiple failed logins)
- Audit log export functionality (CSV/Excel)
- Long-term archival strategy (move old logs to cold storage)
- Performance optimization for large audit log tables (partitioning)
- Advanced search and filtering in UI
- Audit log retention policies
