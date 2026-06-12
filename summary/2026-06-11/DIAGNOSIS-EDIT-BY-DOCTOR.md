# Diagnosis Edit by Doctor - Implementation Summary

**Date:** 11 Juni 2026  
**Feature:** Edit Diagnosis oleh Dokter  
**Status:** ✅ Complete & Tested

---

## 📋 Overview

Fitur yang memungkinkan **dokter** untuk mengedit diagnosis yang sudah dibuat sebelumnya. Semua field diagnosis dapat diedit kecuali `doktorPemeriksa` (dokter yang membuat diagnosis).

---

## 🎯 What Was Implemented

### Backend (API) ✅

#### 1. **Schema Validation**
**File:** `apps/api/src/modules/sessions/sessions.schema.ts`

**Added:**
```typescript
export const updateDiagnosisSchema = z.object({
  keluhan: z.string().optional(),
  sistole: z.coerce.number().optional(),
  diastole: z.coerce.number().optional(),
  heartRate: z.coerce.number().optional(),
  bloodSugar: z.coerce.number().optional(),
  note: z.string().optional(),
  primaryDiagnosisId: z.string().optional(),
  secondaryDiagnosisId: z.string().optional(),
  tertiaryDiagnosisId: z.string().optional(),
});
```

**Validation Rules:**
- Semua field optional (tidak harus update semua)
- `doktorPemeriksa` TIDAK bisa diubah (tidak ada di schema)
- Numbers di-coerce untuk handle string input dari form

#### 2. **Service Method**
**File:** `apps/api/src/modules/sessions/services/diagnosis.service.ts`

**Added Method:**
```typescript
async updateDiagnosis(diagnosisId: string, data: UpdateDiagnosisInput, updatedBy: string)
```

**Features:**
- ✅ Validates diagnosis exists
- ✅ Updates only fields yang provided
- ✅ Creates audit log dengan old/new values
- ✅ Returns updated diagnosis dengan relasi lengkap
- ✅ Error handling proper

**Audit Log Format:**
```typescript
meta: {
  diagnosisId,
  oldValues: { ... },
  newValues: { ... },
  updatedBy
}
```

#### 3. **Controller Method**
**File:** `apps/api/src/modules/sessions/sessions.controller.ts`

**Added:**
```typescript
export async function updateDiagnosis(req: Request, res: Response, next: NextFunction)
```

**Authorization:**
- Only **DOCTOR** role can update diagnosis
- Uses `authorize([Role.DOCTOR])` middleware

#### 4. **Route**
**File:** `apps/api/src/modules/sessions/sessions.routes.ts`

**Added:**
```typescript
router.patch(
  '/diagnoses/:diagnosisId',
  authenticate,
  authorize([Role.DOCTOR]),
  validate(updateDiagnosisSchema),
  controller.updateDiagnosis
);
```

**Endpoint:**
- `PATCH /api/treatment-sessions/diagnoses/:diagnosisId`
- Requires authentication
- Restricted to DOCTOR role only
- Validates request body with schema

---

### Frontend (Web) ✅

#### 1. **API Client**
**File:** `apps/web/src/lib/sessionApi.ts`

**Added Method:**
```typescript
updateDiagnosis: async (diagnosisId: string, data: UpdateDiagnosisInput): Promise<Diagnosis>
```

**Usage:**
```typescript
await sessionApi.updateDiagnosis(diagnosisId, {
  keluhan: "Updated complaint",
  sistole: 120,
  diastole: 80,
  // ... other fields
});
```

#### 2. **Step1Diagnosis Component Enhancement**
**File:** `apps/web/src/components/sessions/Step1Diagnosis.tsx`

**Added Features:**
- ✅ **Edit Mode Toggle** - Button to enter/exit edit mode
- ✅ **Form State Management** - Tracks original vs edited values
- ✅ **Conditional Rendering** - Shows form when editing, display when viewing
- ✅ **Save/Cancel Actions** - Commits changes or reverts to original
- ✅ **Doctor-Only Visibility** - Edit button only shown to doctors
- ✅ **Loading States** - Shows loading during save operation
- ✅ **Error Handling** - Toast notifications for success/error

**New State:**
```typescript
const [isEditMode, setIsEditMode] = useState(false);
const [editedDiagnosis, setEditedDiagnosis] = useState<Diagnosis | null>(null);
const [isSaving, setIsSaving] = useState(false);
```

**Edit Button (Doctor Only):**
```typescript
{user?.role === 'DOCTOR' && !isEditMode && (
  <button onClick={() => setIsEditMode(true)}>
    Edit Diagnosis
  </button>
)}
```

**Save Handler:**
```typescript
const handleSave = async () => {
  try {
    setIsSaving(true);
    const updated = await sessionApi.updateDiagnosis(diagnosis.id, editedData);
    setDiagnosis(updated);
    setIsEditMode(false);
    toast.success('Diagnosis berhasil diupdate');
  } catch (err) {
    toast.error('Gagal mengupdate diagnosis');
  } finally {
    setIsSaving(false);
  }
};
```

#### 3. **CSS Styling**
**File:** `apps/web/src/components/sessions/Step1Diagnosis.module.css`

**Added Styles:**
```css
.editButton {
  /* Orange-themed button for edit action */
}

.editForm {
  /* Form styling for edit mode */
}

.editActions {
  /* Save/Cancel button group */
}

.saveButton {
  /* Green success button */
}

.cancelButton {
  /* Gray cancel button */
}
```

**Features:**
- Matches existing design system
- Orange theme for primary actions
- Clear visual distinction between view/edit modes
- Responsive for mobile

---

## 🎨 UI/UX Design

### View Mode (Default)
```
┌─────────────────────────────────────────┐
│ Diagnosis Member                        │
│                          [Edit] (Doctor)│
├─────────────────────────────────────────┤
│ Dokter Pemeriksa: dr. Ahmad Fauzi, SpPD│
│ Keluhan: Nyeri kepala & pusing          │
│ Sistole: 130 mmHg                       │
│ Diastole: 85 mmHg                       │
│ Heart Rate: 78 bpm                      │
│ Blood Sugar: 145 mg/dL                  │
│                                         │
│ Primary Diagnosis: A00.0 - Cholera      │
│ Secondary: B01.1 - ...                  │
│ Tertiary: C02.2 - ...                   │
│                                         │
│ Note: Patient history shows...          │
└─────────────────────────────────────────┘
```

### Edit Mode (Doctor Only)
```
┌─────────────────────────────────────────┐
│ Edit Diagnosis                          │
├─────────────────────────────────────────┤
│ Dokter Pemeriksa: dr. Ahmad Fauzi (❌) │
│ [Input: Keluhan]                        │
│ [Input: Sistole] [Input: Diastole]     │
│ [Input: Heart Rate] [Input: Blood Sugar]│
│                                         │
│ [Select: Primary Diagnosis (ICD)]       │
│ [Select: Secondary Diagnosis (ICD)]     │
│ [Select: Tertiary Diagnosis (ICD)]      │
│                                         │
│ [Textarea: Note]                        │
│                                         │
│      [Cancel]  [Save Changes]           │
└─────────────────────────────────────────┘
```

---

## 🔧 How It Works

### Flow Diagram
```
┌──────────────┐
│ Doctor views │
│  diagnosis   │
└──────┬───────┘
       │
       ↓ Click "Edit"
┌──────────────┐
│  Edit mode   │
│  activated   │
└──────┬───────┘
       │
       ↓ Makes changes
┌──────────────┐
│   Clicks     │
│   "Save"     │
└──────┬───────┘
       │
       ↓ PATCH /api/.../diagnoses/:id
┌──────────────┐
│   Backend    │
│  validates   │
└──────┬───────┘
       │
       ↓ Success
┌──────────────┐
│ Diagnosis    │
│  updated     │
│ Audit logged │
└──────┬───────┘
       │
       ↓ Response
┌──────────────┐
│  Frontend    │
│  updates UI  │
│ Toast shown  │
└──────────────┘
```

---

## 🧪 Testing Checklist

### Backend Tests ✅
- [x] PATCH endpoint responds correctly
- [x] Schema validation rejects invalid data
- [x] Only DOCTOR can update
- [x] Non-doctors get 403 Forbidden
- [x] Invalid diagnosisId returns 404
- [x] Partial updates work (only sistole, etc.)
- [x] Audit log created with old/new values
- [x] `doktorPemeriksa` cannot be changed

### Frontend Tests ✅
- [x] Edit button only visible to doctors
- [x] Edit button hidden for non-doctors
- [x] Edit mode activates on button click
- [x] Form populated with current values
- [x] Changes tracked in state
- [x] Save button sends PATCH request
- [x] Success toast shown after save
- [x] Error toast shown on failure
- [x] Cancel button reverts changes
- [x] UI returns to view mode after save

### Integration Tests ✅
- [x] Doctor edits diagnosis → success
- [x] Nurse tries to edit → blocked (no button)
- [x] Admin tries to edit → blocked (no button)
- [x] Edit persists after page refresh
- [x] Audit log records changes
- [x] `doktorPemeriksa` field remains unchanged

---

## 📂 Files Modified

### Backend
```
✅ apps/api/src/modules/sessions/sessions.schema.ts (UPDATED)
✅ apps/api/src/modules/sessions/services/diagnosis.service.ts (UPDATED)
✅ apps/api/src/modules/sessions/sessions.controller.ts (UPDATED)
✅ apps/api/src/modules/sessions/sessions.routes.ts (UPDATED)
✅ apps/api/src/modules/sessions/sessions.service.ts (UPDATED - exports)
```

### Frontend
```
✅ apps/web/src/lib/sessionApi.ts (UPDATED)
✅ apps/web/src/components/sessions/Step1Diagnosis.tsx (UPDATED)
✅ apps/web/src/components/sessions/Step1Diagnosis.module.css (UPDATED)
```

---

## 🔐 Security Features

### Authorization
✅ **Role-Based Access Control**
- Only DOCTOR role can edit
- Enforced at route level via `authorize([Role.DOCTOR])`
- UI button only shown to doctors

### Data Integrity
✅ **Protected Fields**
- `doktorPemeriksa` cannot be changed (not in schema)
- Original doctor attribution preserved

### Audit Trail
✅ **Full Change Tracking**
- Old values recorded before update
- New values recorded after update
- Timestamp of change
- User who made the change
- All stored in `audit_logs` table

**Example Audit Log:**
```json
{
  "userId": "doctor_123",
  "action": "UPDATE",
  "resource": "Diagnosis",
  "resourceId": "diagnosis_456",
  "meta": {
    "diagnosisId": "diagnosis_456",
    "oldValues": {
      "keluhan": "Old complaint",
      "sistole": 120
    },
    "newValues": {
      "keluhan": "Updated complaint",
      "sistole": 130
    },
    "updatedBy": "doctor_123"
  },
  "createdAt": "2026-06-11T10:30:00Z"
}
```

---

## 💡 Usage Example

### Doctor Workflow

1. **Navigate to Session Detail**
   - Click on a therapy session
   - Go to Step 1: Diagnosis tab

2. **Enter Edit Mode**
   - Click **"Edit Diagnosis"** button (orange)
   - Form appears with current values pre-filled

3. **Make Changes**
   - Update keluhan (complaint)
   - Adjust vital signs (sistole, diastole, heart rate)
   - Change blood sugar reading
   - Update ICD diagnosis codes
   - Modify notes

4. **Save or Cancel**
   - Click **"Save Changes"** (green) → Commits updates
   - Click **"Cancel"** (gray) → Reverts to original values

5. **Verification**
   - Success toast appears: "Diagnosis berhasil diupdate"
   - UI returns to view mode with updated values
   - Changes visible immediately

---

## 🐛 Error Handling

### Backend Errors
- **404 Not Found** - Invalid diagnosisId
- **403 Forbidden** - Non-doctor trying to update
- **400 Bad Request** - Invalid data in request body
- **500 Server Error** - Database or service error

### Frontend Handling
```typescript
try {
  await sessionApi.updateDiagnosis(id, data);
  toast.success('Diagnosis berhasil diupdate');
} catch (err: any) {
  if (err.response?.status === 403) {
    toast.error('Anda tidak memiliki akses untuk mengedit diagnosis');
  } else if (err.response?.status === 404) {
    toast.error('Diagnosis tidak ditemukan');
  } else {
    toast.error('Gagal mengupdate diagnosis');
  }
}
```

---

## 📊 Database Impact

### Tables Modified
- **`diagnoses`** - Updated with new values
- **`audit_logs`** - New record for each update

### No Schema Changes
✅ No migration required - uses existing fields

---

## 🎯 Success Criteria

- [x] Doctor can edit all diagnosis fields except `doktorPemeriksa`
- [x] Non-doctors cannot edit diagnosis (no access to edit button)
- [x] Edit mode provides intuitive form interface
- [x] Changes saved via PATCH API endpoint
- [x] Success/error feedback shown via toasts
- [x] Audit trail records all changes
- [x] UI immediately reflects updated values
- [x] Cancel button reverts unsaved changes
- [x] Backend validates all inputs
- [x] Build successful (backend & frontend)

---

## 🚀 Deployment Status

**Backend:** ✅ Built & Ready  
**Frontend:** ✅ Built & Ready  
**Database:** ✅ No migration needed  
**Testing:** ✅ Manual testing completed  

**Ready for Production:** ✅ YES

---

## 📞 Troubleshooting

### Issue: Edit button not showing
**Solution:** Verify user role is DOCTOR
```typescript
console.log('User role:', user?.role);
// Should output: "DOCTOR"
```

### Issue: Save fails with 403
**Solution:** Check authentication and role
- Ensure logged in as doctor
- Check JWT token has correct role

### Issue: Changes not persisting
**Solution:** Check network tab for PATCH request
- Should go to `/api/treatment-sessions/diagnoses/:id`
- Should return 200 OK with updated data

---

**Implementation Date:** 11 Juni 2026  
**Status:** ✅ Complete & Tested  
**Next:** Multi-branch assignment feature
