# Therapy Plan Set - KONFIRMASI FINAL (APPROVED)

**Tanggal**: 18 Juni 2026, 18:06 WIB  
**Status**: ✅ DIKONFIRMASI & DISETUJUI

---

## ✅ KONFIRMASI SISTEM EDIT

### 1. SET-LEVEL VERSIONING (BENAR ✅)

**Pertanyaan**: Apakah edit 1 therapy plan akan versioning satu set?  
**Jawaban**: **YA, BENAR** ✅

```
SCENARIO:
Member punya Set TPS-001 v1 (15 plans)

Dokter ingin edit Plan #5:
❌ SALAH: Edit hanya Plan #5 saja
✅ BENAR: Buat Set TPS-001 v2 (copy semua 15 plans)

Alur:
1. User edit Plan #5 di Set v1
2. Sistem create Set TPS-001 v2 (NEW)
3. Copy SEMUA Plans (1-15) dari v1 ke v2
4. Apply perubahan di Plan #5 pada v2
5. Set v1 status jadi: SUPERSEDED
6. Set v2 status: ACTIVE
7. Sesi berikutnya pakai Set v2

Hasil:
- Set v1: SUPERSEDED (history)
- Set v2: ACTIVE (digunakan ke depan)
```

**Implementasi**:
```typescript
async function editTherapyPlan(planId: string, changes: any) {
  // 1. Get plan & set info
  const plan = await getTherapyPlan(planId);
  const oldSet = await getTherapyPlanSet(plan.therapyPlanSetId);
  
  // 2. Create NEW SET (version + 1)
  const newSet = await createTherapyPlanSet({
    memberId: oldSet.memberId,
    setCode: oldSet.setCode,
    version: oldSet.version + 1,
    status: 'ACTIVE'
  });
  
  // 3. Copy ALL plans from old set to new set
  const allPlans = await getAllPlansInSet(oldSet.id);
  for (const oldPlan of allPlans) {
    const newPlanData = { ...oldPlan };
    
    // Apply changes only to the plan being edited
    if (oldPlan.id === planId) {
      Object.assign(newPlanData, changes);
    }
    
    await createTherapyPlan({
      ...newPlanData,
      therapyPlanSetId: newSet.id
    });
  }
  
  // 4. Supersede old set
  await updateTherapyPlanSet(oldSet.id, {
    status: 'SUPERSEDED',
    supersededById: newSet.id
  });
  
  return newSet;
}
```

---

### 2. LOCKING MECHANISM (BENAR ✅)

**Aturan**: Plan yang sudah digunakan di sesi TIDAK BISA DIEDIT

```
❌ TIDAK BISA EDIT jika:
- Plan sudah digunakan di sesi terapi
- Status plan: USED

✅ BISA EDIT jika:
- Plan belum pernah digunakan
- Status plan: AVAILABLE

Jika perlu edit used plan:
→ Harus buat Set baru (versioning)
```

**Implementasi**:
```typescript
async function canEditTherapyPlan(planId: string): Promise<boolean> {
  const plan = await getTherapyPlan(planId);
  
  // Check: Apakah plan sudah digunakan?
  const isUsed = await checkIfPlanUsed(planId);
  
  if (isUsed) {
    return false; // ❌ Tidak bisa edit
  }
  
  return true; // ✅ Bisa edit
}

async function checkIfPlanUsed(planId: string): Promise<boolean> {
  // Check di InfusionExecution
  const infusion = await db.infusionExecution.findFirst({
    where: { therapyPlanId: planId }
  });
  
  return !!infusion; // true jika sudah dipakai
}
```

---

### 3. UI DISPLAY: HIDE CODES (BARU 🆕)

**Requirement**: Kode therapy plan dan kode infusion TIDAK ditampilkan di tabel

```
❌ JANGAN TAMPILKAN:
- Therapy Plan Code (TP-BDG-00123-001-05)
- Therapy Plan Set Code (TPS-BDG-00123-001)
- Infusion Execution Code/ID

✅ TAMPILKAN:
- Therapy Plan #X (Plan ke-5)
- Set Name (jika ada: "Protokol Normal")
- Tanggal
- Status (AVAILABLE, USED, SUPERSEDED)
- Dosis (IFA250, IFA500, dll)
```

**Contoh Table Therapy Plan**:
```
╔══════════════╦══════════════╦════════════╦════════════╗
║ Plan         ║ Tanggal      ║ Status     ║ Dosis      ║
╠══════════════╬══════════════╬════════════╬════════════╣
║ Terapi #1    ║ 10 Jun 2026  ║ 🟢 USED    ║ IFA: 50ml  ║
║ Terapi #2    ║ 11 Jun 2026  ║ 🟢 USED    ║ IFA: 55ml  ║
║ Terapi #3    ║ -            ║ ✅ READY   ║ IFA: 60ml  ║
║ Terapi #4    ║ -            ║ ✅ READY   ║ IFA: 65ml  ║
╚══════════════╩══════════════╩════════════╩════════════╝

TIDAK ADA KOLOM CODE!
```

**Implementasi UI**:
```tsx
// ❌ SALAH - Menampilkan code
<Table>
  <Column field="planCode" header="Code" /> {/* HAPUS INI */}
  <Column field="planNumber" header="Terapi" />
  <Column field="date" header="Tanggal" />
</Table>

// ✅ BENAR - Tanpa code
<Table>
  <Column 
    field="planNumber" 
    header="Terapi"
    body={(row) => `Terapi #${row.planNumber}`}
  />
  <Column field="createdAt" header="Tanggal" />
  <Column field="status" header="Status" />
  <Column field="dosis" header="Dosis" />
</Table>
```

---

## 📋 RINGKASAN FINAL (ALL CONFIRMED)

### ✅ Aturan Edit:
1. **Edit 1 plan = Version seluruh set** (SET-LEVEL VERSIONING)
2. **Used plan tidak bisa diedit** (LOCKING)
3. **Perlu buat set baru untuk edit used plan** (VERSIONING)

### ✅ Aturan Display:
4. **Hide therapy plan code** di tabel
5. **Hide infusion code** di tabel
6. **Show: Plan #X, tanggal, status, dosis** saja

### ✅ Aturan Bisnis:
7. **Therapy plan tidak link ke paket** (standalone)
8. **Auto-fill based on session number** (sesi 3 → plan #3)
9. **Read-only saat execution** (tidak update dari infusion)
10. **Penomoran per member** (continuous global)

---

## 🎯 Decision Matrix

| Scenario | Action | Result |
|----------|--------|--------|
| Edit plan yang **belum** used | ✅ Buat set v2, copy all plans, apply change | Set baru created |
| Edit plan yang **sudah** used | ❌ Tidak bisa edit | Error/Warning |
| View therapy plan di tabel | ✅ Show: #X, tanggal, status, dosis | Code HIDDEN |
| View infusion di tabel | ✅ Show: tanggal, material, qty | Code HIDDEN |
| Sesi terapi pilih plan | ✅ Auto-fill dari plan sesuai nomor sesi | Plan jadi USED |

---

## 🔧 Technical Specification

### Database Schema Changes:

```prisma
model TherapyPlanSet {
  id              String   @id @default(cuid())
  memberId        String
  setCode         String   // TPS-BDG-00123-001 (auto-gen, INTERNAL USE)
  name            String?  // "Protokol Normal" (optional)
  version         Int      @default(1)
  status          String   // ACTIVE, SUPERSEDED
  supersededById  String?
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  member          Member   @relation(fields: [memberId], references: [id])
  plans           TherapyPlan[]
  supersededBy    TherapyPlanSet? @relation("Versioning", fields: [supersededById], references: [id])
  
  @@index([memberId, status])
}

model TherapyPlan {
  id                String   @id @default(cuid())
  therapyPlanSetId  String
  planNumber        Int      // 1, 2, 3, ..., 15
  planCode          String   // TP-BDG-00123-001-05 (auto-gen, INTERNAL USE)
  
  // Dosis fields
  ifa250Dose        Float?
  ifa500Dose        Float?
  hhoDose           Float?
  h2Dose            Float?
  noDose            Float?   @default(2.5) // Base 2.5ml
  o3Dose            Float?
  edtaDose          Float?
  mbDose            Float?
  h2sDose           Float?
  kclDose           Float?
  
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  therapyPlanSet    TherapyPlanSet @relation(fields: [therapyPlanSetId], references: [id])
  infusions         InfusionExecution[]
  
  @@unique([therapyPlanSetId, planNumber])
  @@index([therapyPlanSetId])
}

model InfusionExecution {
  id                  String   @id @default(cuid())
  treatmentSessionId  String
  therapyPlanId       String   // Reference (for auto-fill & history)
  
  // Actual values (realisasi)
  actualIfa250        Float?
  actualIfa500        Float?
  actualHho           Float?
  actualH2            Float?
  actualNo            Float?   // Could be > 2.5ml (base + additional)
  actualO3            Float?
  actualEdta          Float?
  actualMb            Float?
  actualH2s           Float?
  actualKcl           Float?
  
  notes               String?
  executedAt          DateTime @default(now())
  
  treatmentSession    TreatmentSession @relation(fields: [treatmentSessionId], references: [id])
  therapyPlan         TherapyPlan @relation(fields: [therapyPlanId], references: [id])
  
  @@unique([treatmentSessionId])
  @@index([therapyPlanId])
}
```

---

## 🚀 Implementation Checklist

### Phase 1: Database
- [ ] Create TherapyPlanSet model
- [ ] Modify TherapyPlan model (add setId, planNumber, remove package link)
- [ ] Migration script
- [ ] Seed data for testing

### Phase 2: Backend API
- [ ] POST /therapy-plan-sets (create set)
- [ ] PUT /therapy-plan-sets/:id (edit → create v2)
- [ ] GET /therapy-plan-sets (list with version info)
- [ ] Check used status before edit
- [ ] Auto-fill logic for infusion
- [ ] Set-level versioning logic

### Phase 3: Frontend
- [ ] Therapy Plan Set page (create/view)
- [ ] Hide codes in tables (show #X instead)
- [ ] Edit UI with versioning confirmation
- [ ] Lock/disable edit for used plans
- [ ] Infusion step auto-fill from plan
- [ ] View therapy plan modal (reference)

### Phase 4: Testing
- [ ] Test versioning (edit creates new set)
- [ ] Test locking (cannot edit used)
- [ ] Test auto-fill by session number
- [ ] Test UI (codes hidden)
- [ ] Test NO calculation (base 2.5ml + additional)

---

## ✅ APPROVAL STATUS

**Dikonfirmasi oleh**: User  
**Tanggal**: 18 Juni 2026, 18:06 WIB

**Keputusan:**
1. ✅ Edit 1 plan = Versioning seluruh set (BENAR)
2. ✅ Used plan tidak bisa diedit (BENAR)
3. ✅ Hide codes di tabel UI (APPROVED)

**Status**: 🟢 READY TO IMPLEMENT

---

**Next Step**: Mulai implementasi kode (database, API, frontend)
