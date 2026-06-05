# Update: Dual Manual Session Numbering

**Tanggal**: 5 Juni 2026  
**Update**: Menambahkan input manual terpisah untuk nomor sesi cabang

---

## 🎯 Perubahan

### Sebelumnya:
- Hanya 1 input manual: **Nomor Sesi Global**
- Nomor cabang di-set sama dengan nomor global saat mode manual

### Sekarang (NEW):
- **2 input manual terpisah**:
  1. **Nomor Sesi Global** - Total sesi di semua cabang
  2. **Nomor Sesi Cabang** - Sesi khusus di cabang saat ini
- **Saran otomatis untuk kedua field**
- **Validasi terpisah** dengan warning jika berbeda dari saran

---

## 📊 UI Yang Diupdate

### Mode Auto (Default)
```
┌─────────────────────────────────────────┐
│ 👥 Nomor Sesi Terapi    ☐ Input Manual │
├─────────────────────────────────────────┤
│ ℹ️ Sesi berikutnya (otomatis): #12     │
│    Sesi ke-7 di cabang ini              │
└─────────────────────────────────────────┘
```

### Mode Manual (NEW - 2 Input Fields)
```
┌─────────────────────────────────────────┐
│ 👥 Nomor Sesi Terapi    ☑ Input Manual │
├─────────────────────────────────────────┤
│ Nomor Sesi Global *                     │
│ [  12  ] ← Saran: 12                   │
│ Total sesi member di semua cabang       │
│                                         │
│ Nomor Sesi di Cabang Ini *              │
│ [  7   ] ← Saran: 7                    │
│ Sesi member khusus di cabang saat ini   │
│                                         │
│ ⚠️ Saran otomatis: #12                  │ ← Per field warning
│ ⚠️ Saran otomatis: #7                   │
└─────────────────────────────────────────┘
```

---

## 🔧 Backend Changes

### Schema Update (`sessions.schema.ts`)

```typescript
export const createSessionSchema = z.object({
  // ... existing fields ...
  manualInfusKe: z.number().int().positive().optional(), // Global
  manualBranchInfusKe: z.number().int().positive().optional(), // Branch (NEW)
  useManualNumbering: z.boolean().optional().default(false),
}).refine((data) => {
  // Both numbers required if manual mode enabled
  if (data.useManualNumbering && (!data.manualInfusKe || !data.manualBranchInfusKe)) {
    return false;
  }
  return true;
}, { message: 'Nomor sesi global dan cabang harus diisi jika mode manual diaktifkan' });
```

### Service Logic (`session-creation.service.ts`)

```typescript
if (sessionData.useManualNumbering && sessionData.manualInfusKe && sessionData.manualBranchInfusKe) {
  // MANUAL MODE: Use both user-provided numbers
  globalInfusKe = sessionData.manualInfusKe;
  branchInfusKe = sessionData.manualBranchInfusKe; // Now separate!
  
  await this.validateManualInfusKe(sessionData.memberId, globalInfusKe);
} else {
  // AUTO MODE: Calculate both
  const calculated = await this.calculateInfusKe(sessionData.memberId, branchId);
  globalInfusKe = calculated.globalInfusKe;
  branchInfusKe = calculated.branchInfusKe;
}
```

---

## 💻 Frontend Changes

### New State Variable

```typescript
const [manualBranchInfusKe, setManualBranchInfusKe] = useState<number | ''>(''); // NEW
```

### UI Component (2 Separate Inputs)

```tsx
{useManualNumbering && (
  <div className="space-y-3">
    {/* Global Session Number */}
    <div>
      <label>Nomor Sesi Global *</label>
      <input
        type="number"
        value={manualInfusKe}
        onChange={(e) => setManualInfusKe(...)}
        placeholder={`Saran: ${calculatedGlobalInfusKe}`}
      />
      <p>Total sesi member di semua cabang</p>
      {/* Warning if different from suggestion */}
    </div>

    {/* Branch Session Number (NEW) */}
    <div>
      <label>Nomor Sesi di Cabang Ini *</label>
      <input
        type="number"
        value={manualBranchInfusKe}
        onChange={(e) => setManualBranchInfusKe(...)}
        placeholder={`Saran: ${calculatedBranchInfusKe}`}
      />
      <p>Sesi member khusus di cabang saat ini</p>
      {/* Warning if different from suggestion */}
    </div>
  </div>
)}
```

### Validation Update

```typescript
if (useManualNumbering) {
  if (!manualInfusKe || manualInfusKe < 1) {
    setError('Nomor sesi global harus diisi dan lebih besar dari 0');
    return;
  }
  if (!manualBranchInfusKe || manualBranchInfusKe < 1) {
    setError('Nomor sesi cabang harus diisi dan lebih besar dari 0');
    return;
  }
}
```

### Submit Data

```typescript
const baseData = {
  // ... existing fields ...
  useManualNumbering,
  manualInfusKe: useManualNumbering && manualInfusKe ? Number(manualInfusKe) : undefined,
  manualBranchInfusKe: useManualNumbering && manualBranchInfusKe ? Number(manualBranchInfusKe) : undefined, // NEW
};
```

---

## ✅ Type Definition Update

```typescript
// apps/web/src/types/session.ts
export interface CreateSessionInput {
  // ... existing fields ...
  useManualNumbering?: boolean;
  manualInfusKe?: number; // Global session number
  manualBranchInfusKe?: number; // Branch-specific session number (NEW)
}
```

---

## 🧪 Testing Scenarios (Updated)

### Test Case: Manual Mode - Different Global & Branch Numbers

**Scenario:**
- Member has 15 total sessions (global)
- Only 8 sessions in current branch
- User wants to create session #16 globally, #9 for branch

**Steps:**
1. Check "Input Manual"
2. Input Nomor Sesi Global: `16` (saran: 16)
3. Input Nomor Sesi Cabang: `9` (saran: 9)
4. Submit form

**Expected:**
- ✅ Session created with `infusKe: 16` (global)
- ✅ `branchInfusKe: 9` tracked correctly in audit
- ✅ No warnings (matches suggestions)

### Test Case: Manual Override with Custom Numbers

**Scenario:**
- User wants to backfill: global #10, branch #5

**Steps:**
1. Check "Input Manual"
2. Input Nomor Sesi Global: `10` (saran: 16)
3. Input Nomor Sesi Cabang: `5` (saran: 9)
4. Submit form

**Expected:**
- ⚠️ Warning displayed for global: "Saran otomatis: #16"
- ⚠️ Warning displayed for branch: "Saran otomatis: #9"
- ✅ If not duplicate, session created with custom numbers
- ❌ If duplicate, error: "Nomor sesi 10 sudah digunakan..."

### Test Case: Validation - One Field Empty

**Steps:**
1. Check "Input Manual"
2. Input Nomor Sesi Global: `20`
3. Leave Nomor Sesi Cabang empty
4. Submit form

**Expected:**
- ❌ Frontend error: "Nomor sesi cabang harus diisi dan lebih besar dari 0"

---

## 💡 Use Cases (Updated)

### Why Separate Global & Branch Numbers?

**Scenario 1: Member Pindah Cabang**
- Member has 20 sessions total (10 at Branch A, 10 at Branch B)
- Now at Branch C for first time
- Global: #21 (continuing from 20)
- Branch C: #1 (first at this branch)

**Scenario 2: Data Migration**
- Import historical data with accurate branch tracking
- Global numbering maintains continuity
- Branch numbering reflects actual location history

**Scenario 3: Multi-Branch Analytics**
- Track member journey across branches
- Accurate per-branch statistics
- Maintain global session count

---

## 📁 Files Modified

**Backend:**
- ✅ `apps/api/src/modules/sessions/sessions.schema.ts` - Added `manualBranchInfusKe` field
- ✅ `apps/api/src/modules/sessions/services/session-creation.service.ts` - Updated logic

**Frontend:**
- ✅ `apps/web/src/components/sessions/CreateSessionModal.tsx` - Added second input field
- ✅ `apps/web/src/types/session.ts` - Added `manualBranchInfusKe` field

**Documentation:**
- ✅ `summary/2026-06-05/MANUAL-SESSION-NUMBERING.md` - Updated
- ✅ `summary/2026-06-05/UPDATE-DUAL-MANUAL-NUMBERING.md` - New

---

## 🚀 Deployment

### No Breaking Changes
- ✅ Backward compatible (new fields optional)
- ✅ Auto mode still works as before
- ✅ Existing sessions unaffected

### Migration Required?
**NO** - New optional fields, no database changes needed

---

## 📝 Summary

**Sebelum:**
- Manual mode: 1 nomor untuk global & cabang

**Sesudah:**
- Manual mode: 2 nomor terpisah (global + cabang)
- Saran otomatis untuk kedua field
- Validasi & warning per-field
- Lebih akurat untuk multi-branch tracking

---

**Status**: ✅ **IMPLEMENTED**  
**Ready for**: Testing & deployment
