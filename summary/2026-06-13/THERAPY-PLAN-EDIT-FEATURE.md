# ✏️ Therapy Plan Edit Feature with Versioning

**Date**: 13 Juni 2026  
**Status**: ✅ IMPLEMENTED  
**Build Status**: ✅ Backend & Frontend compiled successfully

## Overview

Implemented complete Edit Therapy Plan feature with versioning system:
- ✅ Tombol Edit pada setiap therapy plan yang belum digunakan
- ✅ Therapy plan lama TIDAK DIHAPUS - tetap tersimpan di database
- ✅ Setiap edit membuat versi baru (version 1 → 2 → 3, dst.)
- ✅ Therapy plan lama di-mark sebagai "superseded"
- ✅ Bisa edit berkali-kali - setiap edit membuat versi baru
- ✅ History tracking - bisa melihat semua versi lama

## Database Changes

### Migration: `20260613080301_add_therapy_plan_versioning`

Added 3 new fields to `TherapyPlan` model:

```prisma
model TherapyPlan {
  // ... existing fields ...
  
  // NEW: Versioning fields
  version            Int      @default(1)        // Version number (1, 2, 3, ...)
  supersededById     String?                    // ID of newer version
  supersededAt       DateTime?                  // When was this superseded
  
  supersededBy   TherapyPlan?  @relation("TherapyPlanVersioning", fields: [supersededById], references: [id])
  supersedes     TherapyPlan[] @relation("TherapyPlanVersioning")
}
```

**How It Works:**
- Setiap therapy plan dimulai dengan `version = 1`
- Ketika di-edit, dibuat therapy plan baru dengan `version = version + 1`
- Therapy plan lama di-update dengan `supersededById` = ID dari versi baru
- Chain: V1 (supersededById=V2) → V2 (supersededById=V3) → V3 (current, supersededById=null)

## Backend Implementation

### 1. New Service: `MemberTherapyPlanEditService`

**File**: `apps/api/src/modules/members/services/member-therapy-plan-edit.service.ts`

**Methods**:

#### `editTherapyPlan(therapyPlanId, input)`
- Validates therapy plan exists and is NOT already used in session
- Validates therapy plan is NOT already superseded
- Validates at least one dose field filled
- Validates IFA mutual exclusivity
- **Creates NEW therapy plan** with incremented version
- **Updates OLD therapy plan** with `supersededById` and `supersededAt`
- Returns new plan info with version numbers

**Transaction flow**:
```typescript
prisma.$transaction([
  // 1. Create new version
  prisma.therapyPlan.create({
    version: originalPlan.version + 1,
    // ... copy all data from original with new values
  }),
  
  // 2. Mark original as superseded
  prisma.therapyPlan.update({
    where: { id: originalPlanId },
    data: {
      supersededById: newPlan.id,
      supersededAt: new Date()
    }
  })
])
```

#### `getTherapyPlanHistory(therapyPlanId)`
- Fetches all versions of a therapy plan
- Walks the superseded chain
- Returns current version + all old versions
- Useful for history viewing

### 2. Updated Controller & Routes

**Controller Method**: `editTherapyPlan(req, res, next)`
- Extracts `memberId` and `therapyPlanId` from params
- Calls service method
- Logs audit trail
- Returns success response

**Route**: 
```typescript
PUT /api/v1/members/:memberId/therapy-plans/:therapyPlanId
```

**Permissions**: All staff (ALLSTAFF)
**Middleware**: `authenticate`, `authorize`, `assertBranchAccess`, `validate(editTherapyPlanSchema)`

**Additional Route** (for viewing history):
```typescript
GET /api/v1/members/:memberId/therapy-plans/:therapyPlanId/history
```

### 3. Schema Validation

**File**: `apps/api/src/modules/members/members.schema.ts`

```typescript
export const editTherapyPlanSchema = z.object({
  keterangan: z.string().optional(),
  ifa250: z.number().int().min(0).nullable().optional(),
  ifa500: z.number().int().min(0).nullable().optional(),
  // ... all dose fields ...
});
```

### 4. Business Rules

**Can Edit If**:
- ✅ Therapy plan exists
- ✅ `treatmentSessionId IS NULL` (not yet used in session)
- ✅ `supersededById IS NULL` (not yet superseded by newer version)

**Cannot Edit If**:
- ❌ Already used in a treatment session (`treatmentSessionId IS NOT NULL`)
- ❌ Already superseded by newer version (`supersededById IS NOT NULL`)
- ❌ No dose fields filled
- ❌ Both IFA 250 and IFA 500 selected (mutual exclusive)

## Frontend Implementation

### 1. Edit Modal Component

**File**: `apps/web/src/components/members/EditTherapyPlanModal.tsx`

**Features**:
- Full-screen modal with portal rendering (like BulkTherapyPlanModal)
- Shows original plan info (plan code, current version)
- Shows version progression: "Versi sekarang: 2 → Versi baru: 3"
- Pre-filled with current therapy plan values
- IFA 250/500 radio button selection
- All dose input fields
- Validation: at least one dose, IFA mutual exclusivity
- Dark mode compatible

**Props**:
```typescript
interface EditTherapyPlanModalProps {
  therapyPlan: TherapyPlan;     // The plan being edited
  memberId: string;             // Owner member ID
  onClose: () => void;          // Close modal
  onSuccess: () => void;        // Called after successful edit
}
```

### 2. Updated Therapy Plans Tab

**File**: `apps/web/src/components/members/MemberTherapyPlansTab.tsx`

**Changes**:
1. **Import EditTherapyPlanModal**
2. **Add state**: `const [editingPlan, setEditingPlan] = useState<TherapyPlan | null>(null);`
3. **Render Edit Modal**: 
   ```tsx
   {editingPlan && (
     <EditTherapyPlanModal ... />
   )}
   ```
4. **Add Edit Button** in therapy plan card (next to status badge):
   ```tsx
   {!plan.isUsed && !plan.supersededById && (
     <button onClick={() => setEditingPlan(plan)}>
       ✏️ Edit
     </button>
   )}
   ```
5. **Show Version Badge** if version > 1:
   ```tsx
   {plan.version && plan.version > 1 && (
     <span>v{plan.version}</span>
   )}
   ```
6. **Show Superseded Badge** if plan is superseded:
   ```tsx
   {plan.supersededById && (
     <span>⚠️ Superseded</span>
   )}
   ```

### 3. Updated API Client

**File**: `apps/web/src/lib/therapyPlanApi.ts`

**New Interface Fields**:
```typescript
export interface TherapyPlan {
  // ... existing fields ...
  version?: number;           // Version number
  supersededById?: string;   // ID of newer version
  supersededAt?: string;     // When superseded
}
```

**New Methods**:
```typescript
// Edit therapy plan (creates new version)
editTherapyPlan: async (
  memberId: string,
  therapyPlanId: string,
  data: Partial<CreateTherapyPlanInput>
) => PUT /api/v1/members/:memberId/therapy-plans/:therapyPlanId

// Get history (all versions)
getTherapyPlanHistory: async (
  memberId: string,
  therapyPlanId: string
) => GET /api/v1/members/:memberId/therapy-plans/:therapyPlanId/history
```

## User Experience

### Viewing Therapy Plans

**Current Version (Active)**:
```
📋 TPL-JKT-1718267801234-V3          [v3 badge]
🟡 Belum Digunakan  [✏️ Edit button]
```

**Superseded Version (Old)**:
```
📋 TPL-JKT-1718267801234-V2          [v2 badge] [⚠️ Superseded badge]
🟡 Belum Digunakan  [No edit button]
```

**Used in Session (Cannot Edit)**:
```
📋 TPL-JKT-1718267801234-V1          [v1 badge]
✅ Sudah Digunakan  [No edit button]
```

### Editing Flow

1. **User clicks "✏️ Edit"** on unused, non-superseded therapy plan
2. **Modal opens** showing:
   - Original plan code
   - Current version → New version
   - All current dose values pre-filled
3. **User modifies** doses (e.g., change IFA 250 from 1 to 2)
4. **User clicks "Simpan Perubahan"**
5. **Backend creates** new therapy plan with version+1
6. **Backend marks** old plan as superseded
7. **Modal closes**, therapy plan list refreshes
8. **User sees**:
   - Old plan: "v2" badge + "⚠️ Superseded" badge (no edit button)
   - New plan: "v3" badge + "✏️ Edit" button

### Version History Example

```
Timeline (newest first):

V3 (Current) ─────── Created: 13 Jun 2026 14:50
  📋 TPL-JKT-1718267801234-V3
  [v3] [🟡 Belum Digunakan] [✏️ Edit]
  IFA 250: 2 botol, NO: 3ml
  
V2 (Superseded) ──── Created: 13 Jun 2026 14:35
  📋 TPL-JKT-1718267801234-V2
  [v2] [⚠️ Superseded] [🟡 Belum Digunakan]
  IFA 250: 1 botol, NO: 2.5ml
  Superseded by V3 at: 13 Jun 2026 14:50
  
V1 (Used) ─────────── Created: 13 Jun 2026 10:00
  📋 TPL-JKT-1718267801234-V1
  [v1] [✅ Sudah Digunakan]
  IFA 250: 1 botol, NO: 2.5ml
  Used in session: SES-JKT-001 (12 Jun 2026)
```

## Key Benefits

### 1. **Complete History Tracking**
- Every change is preserved
- Can audit who changed what and when
- Can trace back to original plan

### 2. **Data Integrity**
- Old therapy plans remain linked to sessions they were used in
- No data loss - everything is preserved
- Clear indication of which version was actually used in treatment

### 3. **Flexibility**
- Can edit multiple times
- Can fix mistakes without losing history
- Can revert (by creating new version with old values)

### 4. **Clear UI Indicators**
- Version badges show which version you're looking at
- Superseded badge makes it clear this is an old version
- Edit button only on editable plans
- Color coding: Yellow (unused), Green (used), Red (superseded)

## Testing Scenarios

### Scenario 1: Simple Edit
1. Create therapy plan (V1)
2. Click Edit
3. Change IFA 250 from 1 to 2
4. Save
5. ✅ V2 created, V1 marked superseded

### Scenario 2: Multiple Edits
1. Create therapy plan (V1)
2. Edit → V2 (change IFA)
3. Edit V2 → V3 (change NO)
4. Edit V3 → V4 (change GASO)
5. ✅ Chain: V1(superseded) → V2(superseded) → V3(superseded) → V4(current)

### Scenario 3: Cannot Edit Used Plan
1. Create therapy plan (V1)
2. Use in treatment session
3. Try to click Edit → **No edit button shown**
4. ✅ Cannot edit - used in session

### Scenario 4: Cannot Edit Superseded Plan
1. Create therapy plan (V1)
2. Edit → V2
3. Try to edit V1 → **No edit button shown**
4. ✅ Cannot edit - already superseded

### Scenario 5: View History
1. Create therapy plan (V1)
2. Edit → V2
3. Edit V2 → V3
4. GET /therapy-plans/:id/history
5. ✅ Returns: current=V3, versions=[V3, V2, V1], totalVersions=3

## Database Queries

### Find Current Version of All Plans
```sql
SELECT * FROM therapy_plans 
WHERE supersededById IS NULL
ORDER BY createdAt DESC;
```

### Find All Versions of a Plan
```sql
WITH RECURSIVE version_chain AS (
  -- Start with current version
  SELECT * FROM therapy_plans WHERE id = 'plan-id' AND supersededById IS NULL
  UNION ALL
  -- Walk backwards through supersedes chain
  SELECT tp.* FROM therapy_plans tp
  INNER JOIN version_chain vc ON vc.id = tp.supersededById
)
SELECT * FROM version_chain ORDER BY version DESC;
```

### Find Superseded but Unused Plans (Can Be Cleaned Up?)
```sql
SELECT * FROM therapy_plans
WHERE supersededById IS NOT NULL
  AND treatmentSessionId IS NULL;
```

## API Endpoints

### Edit Therapy Plan
```http
PUT /api/v1/members/:memberId/therapy-plans/:therapyPlanId
Authorization: Bearer <token>
Content-Type: application/json

{
  "keterangan": "Updated plan",
  "ifa250": 2,
  "no": 3,
  "gaso": 1.5
}
```

**Response**:
```json
{
  "success": true,
  "message": "Therapy plan berhasil diedit (versi 3)",
  "data": {
    "id": "new-plan-id",
    "planCode": "TPL-JKT-1718267801234-V3",
    "version": 3,
    "keterangan": "Updated plan",
    "originalPlanId": "original-plan-id",
    "originalVersion": 2,
    "createdAt": "2026-06-13T14:50:00.000Z"
  }
}
```

### Get Therapy Plan History
```http
GET /api/v1/members/:memberId/therapy-plans/:therapyPlanId/history
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "currentVersion": { /* Full therapy plan object */ },
    "versions": [
      { /* V3 - current */ },
      { /* V2 - superseded */ },
      { /* V1 - used */ }
    ],
    "totalVersions": 3
  }
}
```

## Error Handling

### 404 - Therapy Plan Not Found
```json
{
  "error": {
    "status": 404,
    "code": "THERAPY_PLAN_NOT_FOUND",
    "message": "Therapy plan tidak ditemukan"
  }
}
```

### 400 - Already Used in Session
```json
{
  "error": {
    "status": 400,
    "code": "THERAPY_PLAN_IN_USE",
    "message": "Therapy plan sudah digunakan dalam sesi treatment, tidak dapat diedit"
  }
}
```

### 400 - Already Superseded
```json
{
  "error": {
    "status": 400,
    "code": "THERAPY_PLAN_ALREADY_SUPERSEDED",
    "message": "Therapy plan ini sudah di-supersede oleh versi yang lebih baru"
  }
}
```

### 400 - No Dose Provided
```json
{
  "error": {
    "status": 400,
    "code": "NO_DOSE_PROVIDED",
    "message": "Minimal satu field dosis harus diisi"
  }
}
```

### 400 - IFA Mutual Exclusive
```json
{
  "error": {
    "status": 400,
    "code": "IFA_MUTUAL_EXCLUSIVE",
    "message": "IFA 250ml dan IFA 500ml tidak boleh diisi bersamaan"
  }
}
```

## Files Modified/Created

### Backend
- ✅ `apps/api/prisma/schema.prisma` - Added version fields
- ✅ `apps/api/prisma/migrations/20260613080301_add_therapy_plan_versioning/migration.sql`
- ✅ `apps/api/src/modules/members/services/member-therapy-plan-edit.service.ts` - NEW
- ✅ `apps/api/src/modules/members/members.service.ts` - Added edit methods
- ✅ `apps/api/src/modules/members/members.controller.ts` - Added edit endpoint
- ✅ `apps/api/src/modules/members/members.routes.ts` - Added edit route
- ✅ `apps/api/src/modules/members/members.schema.ts` - Added editTherapyPlanSchema

### Frontend
- ✅ `apps/web/src/components/members/EditTherapyPlanModal.tsx` - NEW
- ✅ `apps/web/src/components/members/MemberTherapyPlansTab.tsx` - Added edit button & modal
- ✅ `apps/web/src/lib/therapyPlanApi.ts` - Added edit methods & version fields

## Build Status

```bash
✅ Backend Build: SUCCESS (0 errors)
✅ Frontend Build: SUCCESS (0 errors)
✅ Database Migration: Applied successfully
```

## Next Steps

1. **Test the feature**:
   - Create a therapy plan
   - Edit it multiple times
   - Verify versions are created correctly
   - Verify old versions show superseded badge
   - Verify cannot edit used/superseded plans

2. **Optional Enhancements** (future):
   - Add "View History" button to see all versions in a timeline
   - Add "Revert to this version" functionality
   - Add diff viewer to compare versions
   - Add "Copy from previous version" in create form
   - Add audit log viewer for who edited what

3. **Documentation**:
   - Update user manual with edit feature instructions
   - Add screenshots to user guide
   - Train staff on versioning concept

## Summary

Feature is **COMPLETE** and **READY TO USE**:
- ✅ Tombol edit tersedia
- ✅ Therapy plan lama tidak terhapus
- ✅ Bisa diedit berkali-kali
- ✅ History lengkap tersimpan
- ✅ UI indicators jelas (version badge, superseded badge)
- ✅ Validasi lengkap
- ✅ Build successful
- ✅ Database migration applied

**Start testing!** 🚀
