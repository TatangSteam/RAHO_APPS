# Bulk Therapy Plan Creation - Backend Routes & Integration

**Date**: June 13, 2026  
**Task**: Task 10 - Bulk Therapy Plan Creation (Backend Complete)  
**Status**: ✅ Backend Implementation Complete (Routes + Integration)

---

## Summary

Successfully completed the backend routes integration for the bulk therapy plan creation feature. All controller methods and service integrations are now in place and the backend compiles without errors.

---

## Changes Made

### 1. Fixed Bulk Service Schema Issues

**File**: `apps/api/src/modules/members/services/member-therapy-plan-bulk.service.ts`

#### Issues Resolved:
- ❌ Used wrong field names from Prisma schema
- ❌ Incorrect relation access (Member doesn't have `branch`, should be `registrationBranch`)
- ❌ MemberPackage uses `totalSessions`/`usedSessions`, not `vouchersTotal`/`vouchersUsed`
- ❌ `fullName` is in `UserProfile`, not `Member`
- ❌ `packageType` is an enum, not a relation
- ❌ Imported non-existent `generateCode` function

#### Changes:
```typescript
// ✅ Correct member query with proper relations
const member = await prisma.member.findUnique({
  where: { id: memberId },
  include: {
    registrationBranch: {
      select: { branchCode: true },
    },
    user: {
      include: {
        profile: {
          select: { fullName: true },
        },
      },
    },
  },
});

// ✅ Correct package query (no memberEncounter filter)
const memberPackage = await prisma.memberPackage.findFirst({
  where: {
    memberId,
    status: 'ACTIVE',
  },
  orderBy: {
    createdAt: 'desc',
  },
});

// ✅ Use correct field names
const sessionsRemaining = memberPackage.totalSessions - memberPackage.usedSessions;
const sessionsTotal = memberPackage.totalSessions;
const sessionsUsed = memberPackage.usedSessions;

// ✅ Access fullName from nested profile
fullName: member.user.profile?.fullName || 'N/A'

// ✅ packageType is already a string enum value
packageName: memberPackage.packageType

// ✅ Generate plan code manually (no generateCode import needed)
const timestamp = Date.now();
const planCode = `TPL-${member.registrationBranch.branchCode}-${timestamp}-${index}`;
```

---

### 2. Integrated Bulk Service into Main Members Service

**File**: `apps/api/src/modules/members/members.service.ts`

#### Changes:
```typescript
// Import
import { MemberTherapyPlanBulkService } from './services/member-therapy-plan-bulk.service';

// Service instance
private therapyPlanBulkService: MemberTherapyPlanBulkService;

// Constructor
this.therapyPlanBulkService = new MemberTherapyPlanBulkService();

// Wrapper methods
async getMemberPackageSummary(memberId: string) {
  return await this.therapyPlanBulkService.getMemberPackageSummary(memberId);
}

async bulkCreateTherapyPlans(memberId: string, data: any, userId: string) {
  return await this.therapyPlanBulkService.bulkCreateTherapyPlans(memberId, data);
}
```

---

### 3. Added Routes for Bulk Therapy Plan Creation

**File**: `apps/api/src/modules/members/members.routes.ts`

#### New Routes:
```typescript
// Import validation
import { validate } from '../../middleware/validate';
import { bulkCreateTherapyPlansSchema } from './members.schema';

// GET /api/v1/members/:memberId/therapy-plans/package-summary
// - Get package summary for bulk creation UI
// - Authorization: All staff
router.get(
  '/:memberId/therapy-plans/package-summary',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  controller.getMemberPackageSummary.bind(controller)
);

// POST /api/v1/members/:memberId/therapy-plans/bulk
// - Bulk create therapy plans
// - Authorization: All staff
// - Validation: bulkCreateTherapyPlansSchema (1-50 therapy plans)
router.post(
  '/:memberId/therapy-plans/bulk',
  authenticate,
  authorize(ALLSTAFF),
  assertBranchAccess,
  validate(bulkCreateTherapyPlansSchema),
  controller.bulkCreateTherapyPlans.bind(controller)
);
```

**Route Ordering**: Routes added BEFORE existing single therapy plan routes to ensure specific routes are matched first.

---

### 4. Fixed Audit Log Action in Controller

**File**: `apps/api/src/modules/members/members.controller.ts`

#### Issue:
- ❌ Used `'BULK_CREATE_THERAPY_PLANS'` which doesn't exist in AuditAction enum

#### Available Actions:
```prisma
enum AuditAction {
  CREATE
  UPDATE
  DELETE
  VERIFY
  LOGIN
  LOGOUT
  FAILED_LOGIN
  PASSWORD_CHANGE
  PASSWORD_RESET
}
```

#### Solution:
```typescript
await logAudit({
  userId,
  action: 'CREATE',  // ✅ Use CREATE action
  resource: 'TherapyPlan',
  resourceId: memberId,
  meta: { 
    type: 'bulk_creation',  // Identify as bulk via meta
    count: result.data.created,
    details: `Bulk created ${result.data.created} therapy plans`
  },
});
```

---

## API Endpoints

### GET `/api/v1/members/:memberId/therapy-plans/package-summary`

**Purpose**: Get member package summary for bulk creation UI

**Response**:
```json
{
  "member": {
    "id": "member-id",
    "memberNo": "M001",
    "fullName": "John Doe"
  },
  "package": {
    "id": "package-id",
    "packageName": "BASIC",
    "vouchersTotal": 10,
    "vouchersUsed": 3,
    "vouchersRemaining": 7,
    "status": "ACTIVE"
  },
  "therapyPlans": {
    "existing": 5,
    "canCreate": 7,
    "maxRecommended": 10
  }
}
```

---

### POST `/api/v1/members/:memberId/therapy-plans/bulk`

**Purpose**: Create multiple therapy plans in a single transaction

**Request Body**:
```json
{
  "therapyPlans": [
    {
      "keterangan": "Rencana Terapi ke-1 dari 10 sesi",
      "ifa250": 1,
      "ifa500": null,
      "hho": 30,
      "h2": null,
      "no": 2.5,
      "gaso": null,
      "o2": null,
      "o3": null,
      "edta": null,
      "mb": null,
      "h2s": null,
      "kcl": null,
      "jmlNb": null
    }
    // ... up to 50 therapy plans
  ]
}
```

**Validation Rules** (via `bulkCreateTherapyPlansSchema`):
1. Array must contain 1-50 therapy plans
2. Each plan must have at least one dose field filled
3. IFA 250ml and IFA 500ml are mutually exclusive
4. All dose values must be non-negative numbers

**Response**:
```json
{
  "success": true,
  "message": "Berhasil membuat 7 therapy plans",
  "data": {
    "created": 7,
    "therapyPlans": [
      {
        "id": "plan-id-1",
        "planCode": "TPL-CB1-1718230400000-0",
        "keterangan": "Rencana Terapi ke-1 dari 10 sesi",
        "createdAt": "2026-06-13T10:00:00.000Z"
      }
      // ... remaining plans
    ]
  }
}
```

---

## Validation Schema

**File**: `apps/api/src/modules/members/members.schema.ts`

### `therapyPlanDataSchema`
Single therapy plan validation with refinements:
- At least one dose field must be filled
- IFA 250 and IFA 500 mutual exclusivity

### `bulkCreateTherapyPlansSchema`
```typescript
z.object({
  therapyPlans: z.array(therapyPlanDataSchema)
    .min(1, 'Minimal 1 therapy plan harus dibuat')
    .max(50, 'Maksimal 50 therapy plans dapat dibuat sekaligus'),
})
```

---

## Business Logic

### Package Validation:
1. Check if member has ACTIVE package
2. Calculate sessions remaining: `totalSessions - usedSessions`
3. Validate therapy plan count doesn't exceed total sessions
4. Note: Creating therapy plans does NOT consume vouchers

### Therapy Plan Code Generation:
```typescript
const timestamp = Date.now();
const planCode = `TPL-${branchCode}-${timestamp}-${index}`;
// Example: TPL-CB1-1718230400000-0
```

### Transaction Safety:
- All therapy plans created in a single `prisma.$transaction()`
- If any plan fails, ALL plans are rolled back
- Ensures data consistency

---

## Authorization

**All Endpoints**: 
- Roles: DOCTOR, NURSE, ADMIN_LAYANAN, ADMIN_CABANG, ADMIN_MANAGER, SUPER_ADMIN
- Middleware: `authenticate`, `authorize(ALLSTAFF)`, `assertBranchAccess`

---

## Build Status

✅ **Backend**: Compiled successfully (0 errors)
```bash
npm run build
# Exit Code: 0
```

✅ **Frontend**: Compiled successfully (0 errors)
```bash
npm run build
# Route /members/[memberId]: 60.6 kB (325 kB First Load JS)
```

---

## Next Steps

### Frontend Implementation (Task 10 - Phase 2):

1. **Create API Client** (`apps/web/src/lib/therapyPlanApi.ts`)
   - `getMemberPackageSummary(memberId)` 
   - `bulkCreateTherapyPlans(memberId, data)`

2. **Create Bulk Therapy Plan Modal Component**
   - File: `apps/web/src/components/members/BulkTherapyPlanModal.tsx`
   - Package summary display
   - Number of plans selector
   - Table input with columns:
     * No. (read-only)
     * Keterangan (auto-filled, editable)
     * IFA 250, IFA 500 (mutually exclusive)
     * Dose fields (HHO, H2, NO, GASO, O2, O3, EDTA, MB, H2S, KCL, JML NB)
     * Actions (copy buttons)

3. **Table Features**:
   - Auto-fill keterangan: "Rencana Terapi ke-{n} dari {total} sesi"
   - Copy to next row button
   - Copy to all below button
   - Inline validation with red borders
   - Horizontal scroll with sticky columns

4. **Integration**:
   - Add "📋 Buat Bulk" button in `MemberTherapyPlansTab.tsx`
   - Open `BulkTherapyPlanModal` on click
   - Refresh therapy plans list after successful creation

5. **Validation & Error Handling**:
   - Client-side validation matching backend rules
   - Display API error messages
   - Loading states during submission

---

## Testing Checklist

### Backend API Testing:

- [ ] GET package summary with active package
- [ ] GET package summary with no active package (expect 404)
- [ ] POST bulk create with 1 therapy plan
- [ ] POST bulk create with 10 therapy plans
- [ ] POST bulk create with 50 therapy plans (max limit)
- [ ] POST bulk create with 51 therapy plans (expect validation error)
- [ ] POST bulk create exceeding vouchers remaining (expect error)
- [ ] POST bulk create with missing dose fields (expect validation error)
- [ ] POST bulk create with both IFA 250 and 500 (expect validation error)
- [ ] Verify transaction rollback on error
- [ ] Verify audit log created with meta.type = 'bulk_creation'
- [ ] Verify unique therapy plan codes generated

---

## Files Changed

### Backend:
1. `apps/api/src/modules/members/services/member-therapy-plan-bulk.service.ts` - Fixed schema issues
2. `apps/api/src/modules/members/members.service.ts` - Added bulk service integration
3. `apps/api/src/modules/members/members.routes.ts` - Added bulk creation routes
4. `apps/api/src/modules/members/members.controller.ts` - Fixed audit log action

### Documentation:
5. `summary/2026-06-13/BULK-THERAPY-PLAN-BACKEND-ROUTES-IMPLEMENTATION.md` - This file

---

## References

- Requirements: `.kiro/specs/bulk-therapy-plan-table-input/requirements.md`
- Previous Summary: Context transfer from previous conversation
- Prisma Schema: `apps/api/prisma/schema.prisma` (Member, MemberPackage, TherapyPlan models)

---

**Implementation**: Jovan (with Kiro AI)  
**Review Status**: Pending frontend implementation and testing
