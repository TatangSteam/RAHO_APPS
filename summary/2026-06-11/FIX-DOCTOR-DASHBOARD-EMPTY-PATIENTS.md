# Fix: Doctor Dashboard - Empty Patients List

**Tanggal:** 11 Juni 2026  
**Status:** ✅ Fixed

## 🐛 Masalah

Di dashboard dokter, bagian **"Pasien Terbaru"** tidak menampilkan data (kosong) ketika:
1. Dokter baru dan belum pernah menangani sesi terapi
2. Dokter belum pernah handle session untuk member tertentu

## 🔍 Root Cause

Query di `role-dashboard.service.ts` untuk fetch recent patients hanya mengambil member yang **sudah pernah ditangani oleh dokter tersebut**:

```typescript
const recentSessions = await prisma.treatmentSession.findMany({
  where: {
    doctorId,  // ❌ Hanya sesi dokter ini
    branchId,
  },
  // ...
});
```

Jika dokter belum pernah menangani sesi, `recentSessions` akan kosong, sehingga `recentPatients` juga kosong.

## ✅ Solusi

Tambahkan **fallback logic** untuk menampilkan active members di branch jika dokter belum pernah menangani sesi:

```typescript
// Jika tidak ada pasien dari sessions, ambil active members dari branch
if (memberMap.size === 0) {
  const activeMembers = await prisma.member.findMany({
    where: {
      registrationBranchId: branchId,
      memberPackages: {
        some: {
          status: 'ACTIVE',
          branchId: branchId,
        },
      },
    },
    // ... include packages
  });
  
  // Map to memberMap
}
```

## 🎯 Behavior Setelah Fix

### Sebelum Fix
- Dokter baru: **Pasien Terbaru = Kosong** ❌
- Dokter aktif dengan sesi: Tampil pasien yang pernah ditangani ✅

### Setelah Fix
- Dokter baru: **Tampil 5 active members dari branch** ✅
- Dokter aktif dengan sesi: Tetap tampil pasien yang pernah ditangani ✅

## 📝 Perubahan Kode

**File:** `apps/api/src/modules/dashboard/role-dashboard.service.ts`

**Method:** `getDoctorDashboard()`

**Line:** ~260-310

### Logic Flow:
1. Query sesi terakhir dokter (20 records)
2. Extract unique members dari sesi tersebut
3. **NEW:** Jika hasil kosong (memberMap.size === 0):
   - Query active members di branch
   - Ambil 5 member dengan paket aktif
   - Tampilkan dengan `lastSession: null`

## 🧪 Testing

### Test Case 1: Dokter Baru (Belum Ada Sesi)
**Expected:**
- recentPatients menampilkan 5 active members dari branch
- lastSession untuk semua member = null

### Test Case 2: Dokter Aktif (Sudah Ada Sesi)
**Expected:**
- recentPatients menampilkan member yang pernah ditangani
- lastSession menampilkan tanggal sesi terakhir

### Test Case 3: Branch Tanpa Member Aktif
**Expected:**
- recentPatients = [] (empty array)
- Tidak error

## 📊 Data yang Ditampilkan

```typescript
recentPatients: [
  {
    memberId: "clxxx...",
    memberNo: "M-PST-2606-00001",
    memberName: "John Doe",
    packageType: "BASIC",
    progress: "3/7",  // usedSessions/totalSessions
    lastSession: "2026-06-10T10:00:00.000Z" | null
  }
]
```

## 🔄 Backward Compatibility

✅ **Fully Compatible**
- Tidak ada breaking changes
- Logic lama tetap berfungsi untuk dokter dengan sesi
- Hanya menambah fallback untuk dokter baru

## 🚀 Deployment

1. **Build API:**
   ```powershell
   cd apps/api
   npm run build
   ```

2. **Restart API Server:**
   ```powershell
   npm run dev
   # atau
   npm run start:prod
   ```

3. **Clear Browser Cache** (jika perlu)

## 📁 File yang Dimodifikasi

```
apps/api/src/modules/dashboard/
└── role-dashboard.service.ts  (+ fallback logic untuk empty patients)
```

## 💡 Notes

### Kenapa Tidak Tampilkan Semua Member?

Kami tidak mengubah query utama karena:
1. **Performance**: Query dengan `doctorId` lebih cepat
2. **Relevance**: Dokter lebih perlu lihat pasien yang pernah ditangani
3. **Privacy**: Member mungkin belum mau dokter lain lihat data mereka

Fallback hanya untuk kasus edge (dokter baru) agar dashboard tidak terlihat kosong.

### Alternative Solutions yang Dipertimbangkan

1. **Always show all active members** ❌
   - Performance impact besar
   - Tidak relevan untuk dokter dengan banyak sesi

2. **Show message "Belum ada pasien"** ❌
   - User experience buruk
   - Dokter bingung apa yang harus dilakukan

3. **Show active members as fallback** ✅ **CHOSEN**
   - Best UX untuk dokter baru
   - Tidak impact dokter aktif
   - Minimal query overhead

## ✅ Kesimpulan

Fix ini mengatasi masalah empty patients list untuk dokter baru dengan menambahkan fallback logic yang menampilkan active members dari branch. Solusi ini:

- ✅ Tidak breaking existing functionality
- ✅ Improve UX untuk dokter baru
- ✅ Minimal performance impact
- ✅ Maintain data relevancy

Dokter sekarang akan selalu melihat data pasien di dashboard, baik yang pernah ditangani maupun active members di branch mereka.
