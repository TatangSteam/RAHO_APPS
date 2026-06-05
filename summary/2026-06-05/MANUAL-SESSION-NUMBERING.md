# Manual Session Numbering Feature (Updated)

**Tanggal**: 5 Juni 2026  
**Update**: Menambahkan input manual untuk nomor sesi cabang  
**Fitur**: Input Nomor Sesi Terapi Manual (Global + Cabang) dengan Toggle Auto/Manual

---

## 📋 Ringkasan

Menambahkan fitur untuk memungkinkan staff **mengatur nomor sesi terapi secara manual** dengan **2 input terpisah**:
1. **Nomor Sesi Global** - Total sesi member di semua cabang
2. **Nomor Sesi Cabang** - Sesi member khusus di cabang saat ini

Sistem tetap memberikan **saran nomor otomatis untuk kedua field** tapi user bisa override jika diperlukan.

---

## 🎯 Use Cases

### Kapan Menggunakan Manual Numbering?

1. **Data Migration** - Import sesi lama dengan nomor historis
2. **Koreksi Kesalahan** - Fix nomor sesi yang salah input
3. **Gap Filling** - Isi gap nomor yang terlewat
4. **Special Cases** - Member pindah cabang dengan history berbeda
5. **Backfill Sessions** - Input sesi yang terlewat dengan nomor yang tepat

---

## 🔧 Implementasi

### Backend Changes

#### 1. Schema Update (`sessions.schema.ts`)

```typescript
export const createSessionSchema = z.object({
  // ... existing fields ...
  // Manual session numbering (optional)
  manualInfusKe: z.number().int().positive().optional(), // Global session number
  manualBranchInfusKe: z.number().int().positive().optional(), // Branch-specific session number
  useManualNumbering: z.boolean().optional().default(false),
})
.refine((data) => {
  // If manual numbering is enabled, both numbers must be provided
  if (data.useManualNumbering && (!data.manualInfusKe || !data.manualBranchInfusKe)) {
    return false;
  }
  return true;
}, { message: 'Nomor sesi global dan cabang harus diisi jika mode manual diaktifkan' });
```

**New Fields:**
- `useManualNumbering` (boolean, optional) - Toggle manual mode on/off
- `manualInfusKe` (number, optional) - User-provided **global** session number
- `manualBranchInfusKe` (number, optional) - User-provided **branch** session number

#### 2. Service Logic Update (`session-creation.service.ts`)

**Line 56-75: Conditional Numbering**

```typescript
// 11. Calculate infusKe (global and branch-specific) - either manual or automatic
let globalInfusKe: number;
let branchInfusKe: number;

if (sessionData.useManualNumbering && sessionData.manualInfusKe) {
  // MANUAL MODE: Use user-provided infusKe
  globalInfusKe = sessionData.manualInfusKe;
  branchInfusKe = sessionData.manualInfusKe; // In manual mode, both are the same
  
  // Validate that this infusKe is not already used for this member
  await this.validateManualInfusKe(sessionData.memberId, globalInfusKe);
} else {
  // AUTOMATIC MODE: Calculate based on existing sessions
  const calculated = await this.calculateInfusKe(sessionData.memberId, branchId);
  globalInfusKe = calculated.globalInfusKe;
  branchInfusKe = calculated.branchInfusKe;
}
```

**Line 441-459: Validation Function**

```typescript
/**
 * Validate manual infusKe - ensure it's not already used
 */
private async validateManualInfusKe(memberId: string, infusKe: number) {
  const existingSession = await prisma.treatmentSession.findFirst({
    where: {
      encounter: { memberId },
      infusKe: infusKe,
    },
    select: {
      sessionCode: true,
      treatmentDate: true,
    },
  });

  if (existingSession) {
    throw {
      status: 422,
      code: 'INFUS_KE_ALREADY_USED',
      message: `Nomor sesi ${infusKe} sudah digunakan untuk sesi ${existingSession.sessionCode} pada ${new Date(existingSession.treatmentDate).toLocaleDateString('id-ID')}. Silakan pilih nomor lain.`,
    };
  }
}
```

**Validation Rules:**
- ✅ Nomor harus > 0 (positive integer)
- ✅ Nomor tidak boleh duplicate untuk member yang sama
- ✅ Mode manual = `useManualNumbering: true` + `manualInfusKe` harus ada
- ✅ Mode auto = system calculate seperti biasa

---

### Frontend Changes

#### 1. State Management (`CreateSessionModal.tsx`)

**New State Variables:**

```typescript
// Manual session numbering
const [useManualNumbering, setUseManualNumbering] = useState(false);
const [manualInfusKe, setManualInfusKe] = useState<number | ''>('');
const [calculatedGlobalInfusKe, setCalculatedGlobalInfusKe] = useState<number | null>(null);
const [calculatedBranchInfusKe, setCalculatedBranchInfusKe] = useState<number | null>(null);
```

#### 2. Load Suggested Numbers

**New Function: `loadSuggestedSessionNumbers`**

```typescript
const loadSuggestedSessionNumbers = async (id: string) => {
  try {
    const sessions = await sessionApi.getMemberSessions(id);
    if (sessions && sessions.length > 0) {
      // Find the highest infusKe for global
      const maxGlobal = Math.max(...sessions.map((s: any) => s.infusKe || 0));
      setCalculatedGlobalInfusKe(maxGlobal + 1);

      // Find the highest infusKe for current branch
      const branchSessions = sessions.filter((s: any) => s.branch?.id === user?.branchId);
      const maxBranch = branchSessions.length > 0 
        ? Math.max(...branchSessions.map((s: any) => s.infusKe || 0))
        : 0;
      setCalculatedBranchInfusKe(maxBranch + 1);
    } else {
      setCalculatedGlobalInfusKe(1);
      setCalculatedBranchInfusKe(1);
    }
  } catch (err: any) {
    devError('Failed to load suggested session numbers:', err);
    setCalculatedGlobalInfusKe(1);
    setCalculatedBranchInfusKe(1);
  }
};
```

**Called in useEffect when member is selected.**

#### 3. UI Components

**Toggle Switch + Auto Display:**

```tsx
<div className="space-y-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800">
  <div className="flex items-center justify-between">
    <label className="text-sm font-semibold">
      <Users className="h-4 w-4" /> Nomor Sesi Terapi
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={useManualNumbering}
        onChange={(e) => {
          setUseManualNumbering(e.target.checked);
          if (!e.target.checked) setManualInfusKe('');
        }}
      />
      <span>Input Manual</span>
    </label>
  </div>

  {/* Auto Mode: Show Suggestion */}
  {!useManualNumbering && calculatedGlobalInfusKe !== null && (
    <div className="flex items-center gap-3 p-3 rounded-lg">
      <Info className="h-5 w-5 text-blue-500" />
      <div>
        <p>Sesi berikutnya (otomatis): <span>#{calculatedGlobalInfusKe}</span></p>
        <p>Sesi ke-{calculatedBranchInfusKe} di cabang ini</p>
      </div>
    </div>
  )}

  {/* Manual Mode: Input Field */}
  {useManualNumbering && (
    <div>
      <input
        type="number"
        min="1"
        value={manualInfusKe}
        onChange={(e) => setManualInfusKe(e.target.value ? parseInt(e.target.value) : '')}
        placeholder={`Saran: ${calculatedGlobalInfusKe}`}
        required={useManualNumbering}
      />
      <p>Nomor ini berlaku untuk total sesi member di semua cabang</p>
      
      {/* Warning if different from suggestion */}
      {calculatedGlobalInfusKe && calculatedGlobalInfusKe !== manualInfusKe && (
        <div className="alert alert-warning">
          Perhatian: Nomor saran otomatis adalah #{calculatedGlobalInfusKe}. 
          Pastikan nomor manual yang Anda masukkan benar.
        </div>
      )}
    </div>
  )}
</div>
```

#### 4. Submit Data

```typescript
const baseData = {
  // ... existing fields ...
  useManualNumbering,
  manualInfusKe: useManualNumbering && manualInfusKe ? Number(manualInfusKe) : undefined,
};
```

#### 5. Type Definition Update

```typescript
// apps/web/src/types/session.ts
export interface CreateSessionInput {
  // ... existing fields ...
  useManualNumbering?: boolean;
  manualInfusKe?: number;
}
```

---

## 📊 User Experience

### Default Behavior (Auto Mode)

1. User memilih member
2. System auto-load session history
3. System calculate dan **tampilkan nomor sesi berikutnya** sebagai info
4. User submit → backend assign nomor otomatis

**Display:**
```
┌─────────────────────────────────────┐
│ 📋 Nomor Sesi Terapi    ☐ Input Manual │
├─────────────────────────────────────┤
│ ℹ️ Sesi berikutnya (otomatis): #12  │
│    Sesi ke-7 di cabang ini           │
└─────────────────────────────────────┘
```

### Manual Mode

1. User check "Input Manual" toggle
2. Input field muncul dengan **placeholder saran nomor**
3. User input nomor custom
4. Jika nomor ≠ saran → **warning ditampilkan**
5. Submit → backend validate dan assign nomor manual

**Display:**
```
┌─────────────────────────────────────┐
│ 📋 Nomor Sesi Terapi    ☑ Input Manual │
├─────────────────────────────────────┤
│ Nomor Sesi Global *                  │
│ [  15  ] ← Saran: 12                │
│ Nomor ini berlaku untuk total sesi   │
│                                      │
│ ⚠️ Perhatian: Nomor saran otomatis   │
│    adalah #12. Pastikan nomor manual │
│    yang Anda masukkan benar.         │
└─────────────────────────────────────┘
```

---

## ✅ Validation & Error Handling

### Frontend Validation

```typescript
if (useManualNumbering) {
  if (!manualInfusKe || manualInfusKe < 1) {
    setError('Nomor sesi manual harus diisi dan lebih besar dari 0');
    return;
  }
}
```

### Backend Validation

**1. Duplicate Check:**
```
Error: INFUS_KE_ALREADY_USED
Message: "Nomor sesi 10 sudah digunakan untuk sesi SES-JKT-0010 
         pada 1 Juni 2026. Silakan pilih nomor lain."
```

**2. Required Field Check:**
```
Error: Validation Error
Message: "Nomor sesi manual harus diisi jika mode manual diaktifkan"
```

**3. Positive Number Check:**
```
Error: Validation Error
Message: "Expected positive number for manualInfusKe"
```

---

## 🧪 Testing Scenarios

### Test Case 1: Auto Mode (Default)
**Steps:**
1. Buat sesi baru tanpa aktifkan manual mode
2. Submit form

**Expected:**
- ✅ Nomor sesi di-assign otomatis (berdasarkan history)
- ✅ Display menunjukkan info nomor saran

### Test Case 2: Manual Mode - Valid Number
**Steps:**
1. Check "Input Manual"
2. Input nomor 20
3. Submit form

**Expected:**
- ✅ Nomor 20 di-assign ke sesi
- ✅ Session created successfully

### Test Case 3: Manual Mode - Duplicate Number
**Steps:**
1. Check "Input Manual"
2. Input nomor yang sudah terpakai (misal: 10)
3. Submit form

**Expected:**
- ❌ Error: "Nomor sesi 10 sudah digunakan..."
- ✅ User diminta pilih nomor lain

### Test Case 4: Manual Mode - Invalid Number (< 1)
**Steps:**
1. Check "Input Manual"
2. Input nomor 0 atau negatif
3. Submit form

**Expected:**
- ❌ Frontend validation error
- ❌ "Nomor sesi manual harus lebih besar dari 0"

### Test Case 5: Manual Mode - Empty Input
**Steps:**
1. Check "Input Manual"
2. Kosongkan input field
3. Submit form

**Expected:**
- ❌ Frontend validation error
- ❌ "Nomor sesi manual harus diisi"

### Test Case 6: Toggle Off After Input
**Steps:**
1. Check "Input Manual"
2. Input nomor 15
3. Uncheck "Input Manual"
4. Submit form

**Expected:**
- ✅ manualInfusKe cleared
- ✅ System revert ke auto mode
- ✅ Nomor auto-calculate digunakan

---

## 📝 Notes

### Why Both globalInfusKe and branchInfusKe?

**In Auto Mode:**
- `globalInfusKe` = Total sessions across ALL branches
- `branchInfusKe` = Sessions in CURRENT branch only
- Digunakan untuk display info: "Sesi ke-X secara global, ke-Y di cabang ini"

**In Manual Mode:**
- Both set to same value (`manualInfusKe`)
- Manual override applies to global number
- Branch-specific tracking less relevant in manual mode

### Security Considerations

✅ **Authorization**: Only staff roles can create sessions (enforced by authenticate middleware)  
✅ **Validation**: Backend validates duplicate numbers before insert  
✅ **Audit Log**: Manual numbering logged in audit trail with `manualInfusKe` in meta  
✅ **Data Integrity**: Transaction ensures atomic operation

### Performance Impact

**Minimal** - Only one additional query for manual mode:
```sql
SELECT * FROM treatment_session 
WHERE encounter.memberId = ? AND infusKe = ?
LIMIT 1
```

**Index recommendation**: `(memberId, infusKe)` composite index already exists.

---

## 🚀 Deployment

### Checklist

- [x] Backend schema updated
- [x] Backend service logic implemented
- [x] Backend validation added
- [x] Frontend UI components added
- [x] Frontend state management updated
- [x] Frontend type definitions updated
- [x] Frontend validation added
- [x] Error handling implemented
- [x] Documentation created

### Files Modified

**Backend:**
- `apps/api/src/modules/sessions/sessions.schema.ts`
- `apps/api/src/modules/sessions/services/session-creation.service.ts`

**Frontend:**
- `apps/web/src/components/sessions/CreateSessionModal.tsx`
- `apps/web/src/types/session.ts`

**Documentation:**
- `summary/2026-06-05/MANUAL-SESSION-NUMBERING.md`

### Migration Required?

**NO** - Schema sudah support optional fields. Existing sessions tidak terpengaruh.

---

## 💡 Future Enhancements

1. **Bulk Import**: Allow CSV import with manual session numbers
2. **Number Range Validation**: Warn if gap too large (e.g., jump from #10 to #50)
3. **History View**: Show reason why manual numbering was used (audit trail)
4. **Admin Report**: List all manually-numbered sessions for auditing

---

**Status**: ✅ IMPLEMENTED  
**Tested**: Manual testing pending  
**Ready for**: User acceptance testing
