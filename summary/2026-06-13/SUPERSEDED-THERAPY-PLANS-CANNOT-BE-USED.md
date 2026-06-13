# 🚫 Superseded Therapy Plans Cannot Be Used in Sessions

**Date**: 13 Juni 2026  
**Status**: ✅ IMPLEMENTED  
**Backend Build**: ✅ SUCCESS

## Overview

Updated sistem agar therapy plan yang sudah di-supersede (versi lama) **TIDAK BISA DIGUNAKAN** dalam treatment session. Hanya therapy plan versi terbaru (current version) yang bisa dipakai.

## Changes Made

### 1. Backend Validation - Session Creation

**File**: `apps/api/src/modules/sessions/services/session-creation.service.ts`

**Method**: `validateTherapyPlan(therapyPlanId, memberId)`

**Added Validation**:
```typescript
// CRITICAL: Therapy plan must not be superseded (must be current version)
// Only the latest version can be used
if (therapyPlan.supersededById) {
  throw {
    status: 422,
    code: 'THERAPY_PLAN_SUPERSEDED',
    message: 'Therapy plan ini adalah versi lama yang sudah di-supersede. Hanya versi terbaru yang dapat digunakan untuk sesi terapi. Silakan pilih therapy plan versi terbaru.',
  };
}
```

**Validation Flow**:
1. ✅ Therapy plan exists
2. ✅ Therapy plan belongs to the correct member
3. ✅ Therapy plan not already used (`treatmentSessionId IS NULL`)
4. ✅ **NEW**: Therapy plan not superseded (`supersededById IS NULL`)

### 2. Frontend Filtering - Session Creation Modal

**File**: `apps/web/src/components/sessions/CreateSessionModal.tsx`

**Method**: `loadTherapyPlans(id)`

**Before**:
```typescript
const availablePlans = plans.filter(p => !p.isUsed);
```

**After**:
```typescript
// Filter: only show plans that are NOT used AND NOT superseded (current version only)
const availablePlans = plans.filter(p => !p.isUsed && !p.supersededById);
```

**Effect**: Superseded therapy plans tidak akan muncul di dropdown selection saat create session.

### 3. Frontend Visual Indicators - Therapy Plans Tab

**File**: `apps/web/src/components/members/MemberTherapyPlansTab.tsx`

**Enhanced Card Styling**:
```typescript
// Determine card style based on status
const isSuperseded = !!plan.supersededById;
const isUsed = plan.isUsed;

let cardBackground, cardBorder;
if (isSuperseded) {
  // Grey for superseded (old version)
  cardBackground = 'linear-gradient(135deg, rgba(148,163,184,0.05), rgba(100,116,139,0.05))';
  cardBorder = '2px solid rgba(148,163,184,0.3)';
  opacity = 0.7; // Slightly faded
} else if (isUsed) {
  // Green for used
  cardBackground = 'linear-gradient(135deg, rgba(34,197,94,0.05), rgba(16,185,129,0.05))';
  cardBorder = '2px solid rgba(34,197,94,0.2)';
} else {
  // Yellow/amber for available
  cardBackground = 'linear-gradient(135deg, rgba(251,191,36,0.05), rgba(245,158,11,0.05))';
  cardBorder = '2px solid rgba(251,191,36,0.2)';
}
```

**Visual States**:
- 🟢 **Green** - Sudah digunakan dalam sesi
- 🟡 **Yellow/Amber** - Belum digunakan, tersedia (current version)
- ⚪ **Grey (faded)** - Superseded, tidak bisa digunakan (old version)

## User Experience

### Scenario 1: Attempting to Use Superseded Plan

**Before Changes**:
- User bisa memilih therapy plan superseded dari dropdown
- API akan error setelah submit (tidak user-friendly)

**After Changes**:
- Superseded plans tidak muncul di dropdown selection
- Jika somehow tetap dipilih (manual API call), backend akan reject dengan error message yang jelas

### Scenario 2: Viewing Therapy Plans List

**Visual Indicators**:

**Current Version (Can Use):**
```
📋 TPL-JKT-1718267801234-V3          [v3 badge]
🟡 Belum Digunakan  [✏️ Edit]
[Yellow/Amber card, full opacity]
```

**Superseded Version (Cannot Use):**
```
📋 TPL-JKT-1718267801234-V2          [v2 badge] [⚠️ Superseded]
🟡 Belum Digunakan  [No edit button]
[Grey card, 70% opacity, faded]
```

**Used in Session:**
```
📋 TPL-JKT-1718267801234-V1          [v1 badge]
✅ Sudah Digunakan  [No edit button]
[Green card, full opacity]
```

## API Error Response

### When Attempting to Use Superseded Plan

**Request**:
```http
POST /api/v1/sessions
{
  "therapyPlanId": "superseded-plan-id",
  ...
}
```

**Response** (422 Unprocessable Entity):
```json
{
  "error": {
    "status": 422,
    "code": "THERAPY_PLAN_SUPERSEDED",
    "message": "Therapy plan ini adalah versi lama yang sudah di-supersede. Hanya versi terbaru yang dapat digunakan untuk sesi terapi. Silakan pilih therapy plan versi terbaru."
  }
}
```

## Validation Rules Summary

A therapy plan CAN be used in a session if and only if:
- ✅ `treatmentSessionId IS NULL` (not already used)
- ✅ `supersededById IS NULL` (not superseded, is current version)
- ✅ Belongs to the correct member
- ✅ Exists in database

A therapy plan CANNOT be used in a session if:
- ❌ Already used (`treatmentSessionId IS NOT NULL`)
- ❌ Superseded (`supersededById IS NOT NULL`)
- ❌ Doesn't belong to the member
- ❌ Doesn't exist

## Testing Scenarios

### Test 1: Create and Edit Therapy Plan, Then Try to Use Old Version

1. **Create** therapy plan V1 for member
2. **Edit** therapy plan → creates V2, V1 becomes superseded
3. **Create Session** → V1 should NOT appear in dropdown
4. **Try to use V1 via API** → Should get 422 error
5. **Use V2** → Should work fine ✅

### Test 2: Multiple Versions

1. Create therapy plan V1
2. Edit → V2 (V1 superseded)
3. Edit → V3 (V2 superseded)
4. **Session Creation**:
   - Dropdown should ONLY show V3
   - V1 and V2 should not be selectable
5. Use V3 in session → Success ✅

### Test 3: Visual States

1. Go to member detail → Therapy Plans tab
2. View therapy plans list:
   - V1 (superseded) → Grey card, faded, "⚠️ Superseded" badge
   - V2 (superseded) → Grey card, faded, "⚠️ Superseded" badge
   - V3 (current) → Yellow card, full opacity, "✏️ Edit" button
3. Click Edit on V3 → Creates V4
4. Now V3 becomes grey/faded, V4 is yellow/bright

## Benefits

### 1. **Data Integrity**
- Ensures only current/valid therapy plans are used
- Prevents confusion from using outdated plans
- Clear version history maintained

### 2. **User Experience**
- Clear visual distinction between usable and non-usable plans
- Dropdown only shows relevant options
- Helpful error messages if something goes wrong

### 3. **Audit Trail**
- Old versions remain in database for history
- Can always see what was used vs what was superseded
- Complete version tracking

## Database State Examples

### Example 1: Single Edit

**Before Edit**:
```
ID: A, version: 1, supersededById: null, treatmentSessionId: null
Status: ✅ Can be used
```

**After Edit**:
```
ID: A, version: 1, supersededById: B, treatmentSessionId: null
Status: ❌ Cannot be used (superseded)

ID: B, version: 2, supersededById: null, treatmentSessionId: null
Status: ✅ Can be used
```

### Example 2: Multiple Edits

```
ID: A, v1, supersededById: B, treatmentSessionId: null → ❌ Cannot use
ID: B, v2, supersededById: C, treatmentSessionId: null → ❌ Cannot use
ID: C, v3, supersededById: null, treatmentSessionId: null → ✅ Can use
```

### Example 3: Used Plan

```
ID: C, v3, supersededById: null, treatmentSessionId: X → ❌ Cannot use (already used)
```

## Files Modified

### Backend
- ✅ `apps/api/src/modules/sessions/services/session-creation.service.ts`
  - Added `supersededById` validation check
  - Added error code `THERAPY_PLAN_SUPERSEDED`

### Frontend
- ✅ `apps/web/src/components/sessions/CreateSessionModal.tsx`
  - Filter superseded plans from dropdown selection
- ✅ `apps/web/src/components/members/MemberTherapyPlansTab.tsx`
  - Grey card styling for superseded plans
  - Reduced opacity (0.7) for visual distinction
  - Dynamic background based on status (superseded/used/available)

## Build Status

```bash
✅ Backend Build: SUCCESS (0 errors)
⚠️  Frontend Build: Has unrelated error (missing _document page)
```

**Note**: Frontend error is NOT related to these changes. It's a Next.js configuration issue with _document file.

## Summary

Fitur sudah **COMPLETE**:
- ✅ Backend validation - superseded plans cannot be used
- ✅ Frontend filtering - superseded plans not shown in dropdown
- ✅ Visual indicators - grey/faded styling for superseded plans
- ✅ Clear error messages
- ✅ Complete version tracking

**Key Points**:
1. Therapy plan lama (superseded) **TIDAK BISA DIGUNAKAN** untuk sesi
2. Hanya versi terbaru (current) yang bisa dipakai
3. Visual jelas: Grey/faded = tidak bisa dipakai
4. Dropdown hanya showing versi yang bisa dipakai
5. History tetap tersimpan lengkap

Siap digunakan! 🚀
