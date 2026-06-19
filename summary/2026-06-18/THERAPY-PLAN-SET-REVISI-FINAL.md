# Therapy Plan Set - REVISI FINAL KONSEP

**Tanggal**: 18 Juni 2026  
**Status**: REVISI BERDASARKAN FEEDBACK - KONSEP BARU

---

## ⚠️ REVISI PENTING: Konsep Therapy Plan Set

### ❌ KONSEP LAMA (SALAH):
- Therapy plan terhubung ke paket
- 1 sesi "menggunakan" 1 therapy plan
- Plan yang sudah dipakai, statusnya berubah menjadi "DIGUNAKAN"

### ✅ KONSEP BARU (BENAR):

#### 1. Therapy Plan Set = Template/Acuan Saja
```
Therapy Plan Set TIDAK terhubung ke:
❌ Paket member
❌ Voucher
❌ Session tertentu

Therapy Plan Set adalah:
✅ Template/acuan dosis
✅ Bisa dilihat di step "Infus Aktual"
✅ Auto-fill berdasarkan sesi ke-X
```

#### 2. Cara Kerja yang Benar:

```
STEP 1: Buat Therapy Plan Set (Standalone)
───────────────────────────────────────────
Member: Budi
Therapy Plan Set: TPS-001

Set TPS-001 berisi:
├─ Plan #1: IFA250=50ml, IFA500=100ml, HHO=200ml...
├─ Plan #2: IFA250=55ml, IFA500=105ml, HHO=205ml...
├─ Plan #3: IFA250=60ml, IFA500=110ml, HHO=210ml...
└─ ... sampai Plan #15

Catatan: Set ini TIDAK terikat paket apapun


STEP 2: Sesi Terapi Dimulai
───────────────────────────────────────────
Member Budi mulai sesi terapi:
- Ini adalah sesi ke-3 untuk member Budi
- Sistem deteksi: "Ini sesi ke-3"


STEP 3: Step "Infus Aktual" (Step 5)
───────────────────────────────────────────
Sistem OTOMATIS:
1. Cek: Ini sesi ke berapa? → Sesi ke-3
2. Buka Therapy Plan Set member ini (TPS-001)
3. Ambil Plan #3 dari set
4. AUTO-FILL form Infus Aktual dengan data Plan #3:
   - IFA250: 60ml (dari Plan #3)
   - IFA500: 110ml (dari Plan #3)
   - HHO: 210ml (dari Plan #3)
   - dst...


STEP 4: Perawat Bisa Lihat & Edit
───────────────────────────────────────────
Di form Infus Aktual:
- Ada tombol/link: "Lihat Therapy Plan" 
- Click → Muncul modal/panel showing Plan #3
- Perawat lihat acuan dosis
- Perawat BISA UBAH nilai di form Infus Aktual


STEP 5: Jika Perawat Ubah Dosis
───────────────────────────────────────────
Contoh: Perawat ubah IFA250 dari 60ml → 65ml

Sistem HARUS:
1. Simpan nilai baru ke Infus Aktual (65ml)
2. UPDATE Therapy Plan Set:
   - Bukan hanya Plan #3
   - Tapi UPDATE SELURUH SET (Plan #1-15)
   - Semua plan terpengaruh perubahan ini

Kenapa? Karena perubahan dosis = perubahan protokol
```

---

## 🎯 Konsep Final: Therapy Plan sebagai "Dynamic Template"

### Karakteristik:
1. **Standalone**: Tidak terikat paket/voucher
2. **Auto-fill**: Otomatis isi form infus berdasarkan nomor sesi
3. **Reference**: Bisa dibuka saat infus aktual sebagai acuan
4. **Bidirectional**: Perubahan di infus → update therapy plan set
5. **Set-level Update**: Edit 1 plan = update seluruh set

---

## 📊 Flow Diagram Baru

```mermaid
flowchart TD
    START([Member mulai sesi terapi])
    
    DETECT[Deteksi: Ini sesi ke-X<br/>untuk member ini]
    
    LOAD_SET[Load Therapy Plan Set<br/>member ini]
    
    CHECK_SET{Ada Therapy<br/>Plan Set?}
    
    NO_SET[Tidak ada set<br/>Form kosong, input manual]
    
    GET_PLAN[Ambil Plan #X dari set<br/>X = nomor sesi]
    
    AUTO_FILL[AUTO-FILL form Infus Aktual:<br/>IFA250, IFA500, HHO, dll<br/>dari Plan #X]
    
    SHOW_REF[Tampilkan link/button:<br/>"Lihat Therapy Plan"]
    
    NURSE_INPUT[Perawat review & bisa edit]
    
    CHANGE{Perawat ubah<br/>nilai?}
    
    NO_CHANGE[Simpan infus aktual<br/>sesuai template]
    
    YES_CHANGE[Simpan infus aktual<br/>dengan nilai baru]
    
    UPDATE_SET[UPDATE Therapy Plan Set:<br/>Perubahan berlaku untuk<br/>SELURUH set bukan hanya Plan #X]
    
    DONE([Infus Aktual tersimpan])
    
    START --> DETECT
    DETECT --> LOAD_SET
    LOAD_SET --> CHECK_SET
    
    CHECK_SET -->|Tidak| NO_SET
    CHECK_SET -->|Ada| GET_PLAN
    
    GET_PLAN --> AUTO_FILL
    AUTO_FILL --> SHOW_REF
    SHOW_REF --> NURSE_INPUT
    
    NURSE_INPUT --> CHANGE
    
    CHANGE -->|Tidak| NO_CHANGE
    CHANGE -->|Ya| YES_CHANGE
    
    NO_CHANGE --> DONE
    YES_CHANGE --> UPDATE_SET
    UPDATE_SET --> DONE
```

---

## 🔧 Implementasi Detail

### 1. Struktur Data

```typescript
// Therapy Plan Set - Standalone, tidak link ke package
TherapyPlanSet {
  id: string
  memberId: string
  setCode: string  // TPS-BDG-00123-001 (auto)
  name: string     // Opsional: "Protokol Normal", "Protokol Intensif"
  version: number
  status: 'ACTIVE' | 'SUPERSEDED'
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// Individual plan dalam set
TherapyPlan {
  id: string
  therapyPlanSetId: string  // Link ke set
  planNumber: number        // 1, 2, 3, ..., 15
  planCode: string          // TP-BDG-00123-001-01
  
  // Dosis material
  ifa250Dose: number
  ifa500Dose: number
  hhoDose: number
  h2Dose: number
  noDose: number
  o3Dose: number
  edtaDose: number
  mbDose: number
  h2sDose: number
  kclDose: number
  
  notes: string
  createdAt: Date
  updatedAt: Date
}

// Infus Aktual - menyimpan realisasi
InfusionExecution {
  id: string
  treatmentSessionId: string
  therapyPlanId: string  // Reference ke plan yang dipakai sebagai acuan
  
  // Realisasi aktual (bisa beda dari plan)
  actualIfa250: number
  actualIfa500: number
  actualHho: number
  // ... dst
  
  notes: string
  executedAt: Date
}
```

### 2. Logic Auto-Fill

```typescript
// Saat perawat masuk ke Step 5 (Infus Aktual)
async function autoFillInfusionForm(sessionId: string) {
  // 1. Get session info
  const session = await getSession(sessionId);
  const memberId = session.memberId;
  
  // 2. Hitung: Ini sesi ke berapa untuk member ini?
  const sessionNumber = await getSessionNumberForMember(memberId, sessionId);
  // Contoh hasil: 3 (ini sesi ke-3)
  
  // 3. Load therapy plan set member
  const therapyPlanSet = await getActiveTherapyPlanSet(memberId);
  
  if (!therapyPlanSet) {
    // Tidak ada set, form kosong
    return null;
  }
  
  // 4. Get plan sesuai session number
  const plan = await getTherapyPlan(therapyPlanSet.id, sessionNumber);
  
  if (!plan) {
    // Tidak ada plan untuk sesi ini, form kosong
    return null;
  }
  
  // 5. Return data untuk auto-fill
  return {
    therapyPlanId: plan.id,
    ifa250Dose: plan.ifa250Dose,
    ifa500Dose: plan.ifa500Dose,
    hhoDose: plan.hhoDose,
    h2Dose: plan.h2Dose,
    noDose: plan.noDose,
    o3Dose: plan.o3Dose,
    edtaDose: plan.edtaDose,
    mbDose: plan.mbDose,
    h2sDose: plan.h2sDose,
    kclDose: plan.kclDose,
    notes: plan.notes
  };
}
```

### 3. Logic Update Set Saat Ada Perubahan

```typescript
// Saat perawat submit infus aktual dengan nilai berbeda
async function saveInfusionExecution(data: InfusionData) {
  // 1. Simpan infus aktual
  const infusion = await createInfusionExecution({
    treatmentSessionId: data.sessionId,
    therapyPlanId: data.therapyPlanId,
    actualIfa250: data.ifa250,  // Nilai baru dari perawat
    actualIfa500: data.ifa500,
    // ... dst
  });
  
  // 2. Cek: Apakah ada perubahan dari therapy plan?
  const originalPlan = await getTherapyPlan(data.therapyPlanId);
  const hasChanges = checkIfDifferent(originalPlan, data);
  
  if (hasChanges) {
    // 3. UPDATE SELURUH THERAPY PLAN SET
    // Bukan hanya 1 plan, tapi semua plan dalam set
    await updateEntireTherapyPlanSet({
      therapyPlanSetId: originalPlan.therapyPlanSetId,
      changes: {
        ifa250Dose: data.ifa250,
        ifa500Dose: data.ifa500,
        // ... dst
      }
    });
    
    // Log audit
    await createAuditLog({
      action: 'THERAPY_PLAN_SET_UPDATED',
      reason: 'Updated from infusion execution',
      sessionId: data.sessionId,
      setId: originalPlan.therapyPlanSetId
    });
  }
  
  return infusion;
}
```

---

## 🎨 UI/UX Implementation

### Step 5: Infus Aktual

```
┌─────────────────────────────────────────────────┐
│ Step 5: Infus Aktual (Material Usage)          │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📋 Sesi ke-3 untuk member ini                  │
│ 📖 [Lihat Therapy Plan sebagai acuan] ← Link  │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ Dosis Material                          │   │
│ ├─────────────────────────────────────────┤   │
│ │ IFA 250:  [60] ml  ← Auto-filled        │   │
│ │ IFA 500:  [110] ml ← Auto-filled        │   │
│ │ HHO:      [210] ml ← Auto-filled        │   │
│ │ H2:       [50] ml  ← Auto-filled        │   │
│ │ ...                                     │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ℹ️  Nilai di-isi otomatis dari Therapy Plan   │
│    Anda bisa mengubah sesuai kondisi aktual    │
│                                                 │
│ ⚠️  Perubahan akan update seluruh set          │
│                                                 │
│ [Simpan]                                        │
└─────────────────────────────────────────────────┘
```

### Modal "Lihat Therapy Plan"

```
┌─────────────────────────────────────────────────┐
│ Therapy Plan - Sesi ke-3                       │
├─────────────────────────────────────────────────┤
│                                                 │
│ Set: TPS-BDG-00123-001                         │
│ Plan: #3 (untuk sesi ke-3)                     │
│                                                 │
│ Dosis Acuan:                                    │
│ • IFA 250:  60 ml                              │
│ • IFA 500:  110 ml                             │
│ • HHO:      210 ml                             │
│ • H2:       50 ml                              │
│ • ...                                          │
│                                                 │
│ Catatan: -                                      │
│                                                 │
│ [Tutup]                                         │
└─────────────────────────────────────────────────┘
```

---

## ⚠️ ATURAN LOCKING: Therapy Plan yang Sudah Digunakan

### **CRITICAL RULE: Once Used = LOCKED**

```
❌ Therapy plan yang SUDAH DIGUNAKAN di sesi:
   - TIDAK BISA DIEDIT lagi
   - TIDAK BISA DIGUNAKAN lagi di sesi lain

✅ Therapy plan yang BELUM DIGUNAKAN:
   - BISA DIEDIT
   - BISA DIGUNAKAN
```

### Skenario & Implikasi:

#### Skenario 1: First Use (Pertama Kali Dipakai)
```
Member Budi punya Set TPS-001 (15 plans, semua BELUM DIGUNAKAN)

Sesi ke-3 dimulai:
1. Sistem auto-fill dari Plan #3
2. Perawat input infus aktual (bisa ubah nilai)
3. Submit → Plan #3 status jadi: USED
4. Plan #3 sekarang LOCKED:
   ❌ Tidak bisa diedit
   ❌ Tidak bisa dipakai lagi
```

#### Skenario 2: Need to Edit Used Plan
```
Plan #3 sudah USED (locked)
Dokter perlu ubah dosis:

SOLUSI: VERSIONING
1. Buat Set baru (TPS-001 v2)
2. Copy semua plans dari v1 ke v2
3. Edit di v2 (belum used, bisa diedit)
4. Set v1 jadi SUPERSEDED
5. Sesi berikutnya pakai Set v2
```

#### Skenario 3: Therapy Plan Reuse
```
❌ TIDAK BOLEH:
- Plan #3 sudah dipakai di Sesi A
- Plan #3 tidak bisa dipakai lagi di Sesi B

✅ HARUS:
- Setiap sesi pakai plan yang berbeda
- Sesi A → Plan #1
- Sesi B → Plan #2
- Sesi C → Plan #3
- dst...
```

---

## ✅ Keputusan Final (Updated with Locking)

### 1. Therapy Plan & Paket
**TIDAK TERHUBUNG** ✅
- Therapy plan set berdiri sendiri
- Tidak link ke paket/voucher
- Hanya sebagai template/acuan

### 2. Auto-Fill Logic
**Berdasarkan Nomor Sesi** ✅
- Sistem deteksi: ini sesi ke-X
- Auto-fill dari Plan #X dalam set
- Bisa dilihat saat input infus aktual

### 3. Locking Mechanism ⭐ **BARU**
**Once Used = LOCKED** ✅
- Plan yang sudah digunakan: TIDAK BISA DIEDIT
- Plan yang sudah digunakan: TIDAK BISA DIGUNAKAN LAGI
- Perlu versioning jika mau edit used plan

### 4. Edit Permission
**Admin Cabang+ dan Dokter** ✅
- Bisa edit therapy plan set yang BELUM DIGUNAKAN
- Tidak bisa edit plan yang SUDAH DIGUNAKAN
- Harus buat versi baru untuk edit used plan

### 5. Update Strategy
**Versioning untuk Used Plans** ✅
- Plan sudah used → buat set baru (versioning)
- Plan belum used → bisa edit langsung
- Set-level versioning (create new set)

### 6. Penomoran
**Per Member, Code Auto** ✅
- Sesi ke-1, ke-2, ke-3... (global per member)
- Code: TPS-BDG-00123-001 (otomatis)

---

## 🚀 Next Steps

1. ✅ Konsep sudah jelas
2. ⏳ Update technical specification
3. ⏳ Implementasi:
   - Database: TherapyPlanSet, TherapyPlan (tanpa link paket)
   - API: Auto-fill logic, update set logic
   - Frontend: Step 5 with auto-fill, view plan modal

**❗ Menunggu konfirmasi**: Apakah pemahaman ini sudah 100% benar?
