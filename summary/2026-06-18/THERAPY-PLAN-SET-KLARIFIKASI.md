# Klarifikasi Therapy Plan Set - Cross-Check Sebelum Implementasi

**Tanggal**: 18 Juni 2026  
**Status**: MENUNGGU KONFIRMASI FINAL SEBELUM EDIT KODE

---

## 🎯 Konsep Therapy Plan Set - Penjelasan Lengkap

### ❓ Pertanyaan 1: "1 Paket = 1 Set Aktif" - Apa Maksudnya?

Mari saya jelaskan dengan contoh konkret:

#### Skenario A: Member Beli Paket 15 Sesi

```
MEMBER: Budi
PAKET: BASIC 15 Sesi (aktif)

THERAPY PLAN SET untuk Paket ini:
┌─────────────────────────────────────────────┐
│ Set: TPS-BDG-001 (untuk Paket B15-0001)     │
├─────────────────────────────────────────────┤
│ ├─ Therapy Plan #1 (Terapi ke-1) [✅ READY]│
│ ├─ Therapy Plan #2 (Terapi ke-2) [✅ READY]│
│ ├─ Therapy Plan #3 (Terapi ke-3) [✅ READY]│
│ ├─ Therapy Plan #4 (Terapi ke-4) [✅ READY]│
│ ├─ ... (sampai 15)                          │
│ └─ Therapy Plan #15 (Terapi ke-15) [✅ READY]│
└─────────────────────────────────────────────┘
```

#### Saat Sesi Terapi Berjalan:

**Sesi 1:**
- Staff pilih "Therapy Plan #1" dari set
- Therapy Plan #1 statusnya jadi: ✅ READY → 🟢 DIGUNAKAN (di Sesi S-001)
- Therapy Plan #1 **TIDAK BERKURANG/HILANG**, hanya statusnya berubah
- Therapy Plan #2 sampai #15 masih ✅ READY

**Sesi 2:**
- Staff pilih "Therapy Plan #2" dari set
- Therapy Plan #2 statusnya jadi: ✅ READY → 🟢 DIGUNAKAN (di Sesi S-002)
- Dan seterusnya...

#### Pertanyaan: "Boleh Multiple Set untuk 1 Paket?"

**Jawaban Saya (perlu konfirmasi Anda):**

**Opsi A: 1 Paket = 1 Set Aktif Saja (RECOMMENDED)**
```
Paket BASIC 15 Sesi
└─ Set TPS-001 (AKTIF) ← hanya 1 set
   ├─ Plan #1
   ├─ Plan #2
   └─ ... sampai #15
```
- Jika perlu ubah, buat versi baru (versioning)
- Set lama jadi "superseded"
- Simple dan jelas

**Opsi B: 1 Paket Boleh Multiple Set (Draft/Version)**
```
Paket BASIC 15 Sesi
├─ Set TPS-001 v1 (SUPERSEDED)
├─ Set TPS-001 v2 (SUPERSEDED)  
└─ Set TPS-001 v3 (AKTIF) ← yang dipakai
```
- Bisa ada set draft/alternatif
- Lebih fleksibel tapi lebih complex

### ✅ **KEPUTUSAN ANDA (berdasarkan feedback):**
> Sepertinya Anda pilih **Opsi A** - 1 Paket = 1 Set Aktif
> Karena Anda bilang therapy plan "tidak terikat paket aktif" dan "seperti resep"

**Klarifikasi yang saya pahami:**
- Therapy Plan Set dibuat untuk member (bukan untuk paket)
- 1 Member bisa punya banyak therapy plan set (untuk persiapan)
- Saat sesi terapi, staff pilih plan mana yang akan dipakai
- Plan yang sudah dipakai, statusnya berubah (tidak hilang)

**❓ Apakah pemahaman ini sudah benar?**

---

## 📝 Rangkuman Keputusan Anda

### ✅ KEPUTUSAN 1: Struktur Set
**Pertanyaan**: 1 paket = 1 set aktif saja?

**JAWABAN ANDA**: 
- Therapy Plan Set **TIDAK TERIKAT** ke paket aktif
- Therapy Plan seperti "resep" yang dibuat sebelum sesi
- Member bisa punya banyak therapy plan set (untuk persiapan)
- Saat sesi, staff pilih plan dari set yang tersedia

**Implementasi**:
```
Member
├─ Therapy Plan Set A (15 plans) - untuk kondisi X
├─ Therapy Plan Set B (10 plans) - untuk kondisi Y
└─ Therapy Plan Set C (8 plans) - untuk kondisi Z

Saat Sesi:
- Staff bisa pilih plan dari Set A, B, atau C
- Plan yang dipilih statusnya jadi "DIGUNAKAN"
- Plan tidak hilang, hanya ter-mark sebagai sudah dipakai
```

---

### ✅ KEPUTUSAN 2: Edit Permission
**Pertanyaan**: Therapy plan yang sudah dipakai sesi, bisa diedit?

**JAWABAN ANDA**: 
- **BISA DIEDIT** oleh:
  - ✅ ADMIN_CABANG
  - ✅ ADMIN_MANAGER
  - ✅ SUPER_ADMIN
  - ✅ DOCTOR

**Implementasi**:
```typescript
// Permission check
const canEditUsedTherapyPlan = (userRole) => {
  return [
    'SUPER_ADMIN',
    'ADMIN_MANAGER', 
    'ADMIN_CABANG',
    'DOCTOR'
  ].includes(userRole);
};

// ADMIN_LAYANAN & NURSE: TIDAK BISA edit used plan
```

**Note**: Saat edit plan yang sudah dipakai:
- Buat versi baru (versioning)
- Sesi lama tetap pakai versi lama
- Sesi baru pakai versi baru

---

### ✅ KEPUTUSAN 3: Therapy Plan Tanpa Paket Aktif
**Pertanyaan**: Member tanpa paket aktif, boleh buat therapy plan set?

**JAWABAN ANDA**: 
- **BOLEH** ✅
- Karena therapy plan adalah "resep" sebelum sesi
- Tidak terikat oleh paket aktif
- Bisa dibuat untuk persiapan

**Implementasi**:
```
Skenario:
1. Member baru registrasi
2. Belum beli paket
3. Dokter sudah bisa buat therapy plan set (persiapan)
4. Nanti saat member beli paket dan mulai sesi
5. Staff tinggal pilih plan dari set yang sudah disiapkan
```

---

### ✅ KEPUTUSAN 4: Therapy Plan Saat Paket Refund
**Pertanyaan**: Paket di-refund, therapy plan set bagaimana?

**JAWABAN ANDA**: 
- **TIDAK TERPENGARUH** ✅
- Therapy plan tetap ada
- Tidak berhubungan dengan status paket

**Implementasi**:
```
Skenario Refund:
1. Member punya paket BASIC 15 sesi (aktif)
2. Therapy plan set sudah dibuat (15 plans)
3. Sudah jalan 3 sesi (3 plans sudah digunakan)
4. Member refund paket

Hasil:
- Paket: Status jadi REFUNDED
- Therapy Plan Set: TETAP ADA (tidak berubah)
- 3 plans yang sudah dipakai: Tetap tercatat di history sesi
- 12 plans yang belum dipakai: Tetap tersedia

Kenapa? Karena therapy plan = data medis/resep
Tidak boleh hilang untuk keperluan audit/rekam medis
```

---

### ✅ KEPUTUSAN 5: Penomoran Terapi
**Pertanyaan**: Penomoran terapi berdasarkan apa?

**JAWABAN ANDA**: 
- **PER MEMBER** ✅
- Bukan per paket atau per cabang
- **PENGKODEAN CABANG OTOMATIS** (bukan manual)

**Implementasi**:
```
Member: Budi (M-BDG-00123)
Cabang: Bandung (BDG)

Therapy Plan Set Code (otomatis):
TPS-BDG-00123-001
│   │   │     │
│   │   │     └─ Set sequence (increment)
│   │   └─ Member number
│   └─ Branch code (OTOMATIS dari member.branch)
└─ Prefix

Therapy Plan Code (otomatis):
TP-BDG-00123-001-01
│  │   │     │   │
│  │   │     │   └─ Plan number dalam set (01-15)
│  │   │     └─ Set number
│  │   └─ Member number
│  └─ Branch code (OTOMATIS)
└─ Prefix

Penomoran Terapi (sequence per member):
- Terapi ke-1 (global untuk member)
- Terapi ke-2 (global untuk member)
- ... dst

Bukan:
❌ Terapi ke-1 di paket A, terapi ke-1 di paket B (SALAH)
✅ Terapi ke-1, ke-2, ke-3 global di semua paket (BENAR)
```

**Contoh Konkret**:
```
Member Budi:
- Beli paket 10 sesi (Mei)
  - Jalan 10 sesi → Terapi ke-1 sampai ke-10
- Beli paket 5 sesi lagi (Juni)
  - Jalan 5 sesi → Terapi ke-11 sampai ke-15
  
Penomoran: 1, 2, 3, ..., 15 (continuous per member)
BUKAN: 1-10 (paket 1), 1-5 (paket 2) ← SALAH
```

---

## 🔧 Pertanyaan Tambahan (Belum Dijawab)

### ❓ KEPUTUSAN 6: Migration Strategy
**Data therapy plan lama bagaimana?**

**Opsi A: Backfill**
- Therapy plan lama di-migrate ke struktur set baru
- Dikelompokkan berdasarkan member
- Dapat generated set code otomatis

**Opsi B: Legacy**
- Therapy plan lama tetap sebagai "legacy"
- Tidak di-migrate
- Hanya therapy plan baru pakai struktur set
- Sistem support both (legacy & new)

**❓ Pilih opsi mana?**

---

### ❓ KEPUTUSAN 7: Versioning Strategy
**Versioning di level mana?**

**Opsi A: Set-Level Versioning**
```
Set TPS-001 v1 (superseded) - 15 plans
Set TPS-001 v2 (active) - 15 plans
```
- Edit 1 plan = create new set version (semua plans di-copy)
- History lebih jelas (set by set)
- Lebih banyak data duplicate

**Opsi B: Plan-Level Versioning**
```
Set TPS-001
├─ Plan #1 v1 (superseded)
├─ Plan #1 v2 (active)
├─ Plan #2 v1 (active)
└─ Plan #3 v1 (active)
```
- Edit 1 plan = create new version untuk plan itu saja
- Lebih efficient (tidak duplicate semua)
- Bisa mix-and-match versions

**❓ Pilih opsi mana?**

---

## ✅ Cross-Check: Apakah Sudah Sesuai?

### Yang Sudah Jelas:
1. ✅ Therapy plan set **tidak terikat paket** (seperti resep)
2. ✅ Bisa diedit oleh: Admin Cabang+, Doctor (dengan versioning)
3. ✅ Boleh dibuat tanpa paket aktif
4. ✅ Tidak terpengaruh refund paket
5. ✅ Penomoran per member, code generation otomatis

### Yang Perlu Konfirmasi:
6. ❓ Migration strategy: Backfill atau Legacy?
7. ❓ Versioning: Set-level atau Plan-level?

### Pertanyaan Validasi:
1. ✅ Apakah konsep "1 sesi pakai 1 plan dari set" sudah benar?
2. ✅ Apakah "plan tidak hilang, hanya status berubah" sudah benar?
3. ✅ Apakah contoh penomoran terapi (continuous per member) sudah benar?
4. ✅ Apakah code generation otomatis (TPS-BDG-00123-001) sudah sesuai?

---

## 🚦 Next Steps

**Setelah Anda Konfirmasi:**
1. Saya akan update dokumen planning dengan keputusan final
2. Buat detailed technical specification
3. BARU mulai implementasi kode (database, API, frontend)

**❗ PENTING**: Belum ada perubahan kode apapun. Menunggu konfirmasi Anda.

---

**Mohon konfirmasi:**
- ✅ Apakah pemahaman saya tentang konsep sudah benar?
- ✅ Apakah keputusan 1-5 sudah sesuai harapan?
- ❓ Keputusan 6 & 7: Pilih opsi mana?
