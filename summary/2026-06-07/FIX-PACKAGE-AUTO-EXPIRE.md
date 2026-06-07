# Fix: Auto-Expire Package Saat Semua Sesi Digunakan

**Tanggal**: 7 Juni 2026  
**Status**: ✅ SELESAI

---

## 📋 MASALAH YANG DITEMUKAN

User melaporkan bahwa ketika semua sesi dalam paket sudah digunakan (`usedSessions >= totalSessions`), **status package tidak berubah menjadi EXPIRED**.

### Contoh Kasus:
```
Package: totalSessions=7, usedSessions=3
Setelah membuat session ke-4, ke-5, ke-6, ke-7:
- ✅ usedSessions bertambah menjadi 7
- ❌ Status package TIDAK berubah menjadi EXPIRED (MASALAH!)
```

---

## 🔍 ANALISIS ROOT CAUSE

### Logika Existing:
1. **Session Creation** (`session-creation.service.ts` line 632-648):
   - Saat membuat session BARU, `usedSessions` di-increment
   - **TIDAK ADA** pengecekan apakah `usedSessions >= totalSessions`
   - **TIDAK ADA** logika untuk mengubah status menjadi `EXPIRED`

2. **Session Completion** (`session-completion.service.ts`):
   - Hanya menandai `isCompleted = true`
   - **TIDAK** mengupdate `usedSessions` (sudah di-increment saat creation)
   - **TIDAK** mengecek status package

### Kesimpulan:
Package **tidak pernah** diubah statusnya menjadi EXPIRED secara otomatis, meskipun semua sesi sudah habis.

---

## ✅ SOLUSI YANG DIIMPLEMENTASIKAN

### File yang Diubah:
`apps/api/src/modules/sessions/services/session-creation.service.ts`

### Perubahan:

#### 1. Auto-Expire untuk Basic Package
```typescript
// Update member package used sessions
const updatedPackage = await tx.memberPackage.update({
  where: { id: data.memberPackageId },
  data: { usedSessions: { increment: 1 } },
});

// Check if all sessions are used - auto expire package
if (updatedPackage.usedSessions >= updatedPackage.totalSessions) {
  await tx.memberPackage.update({
    where: { id: data.memberPackageId },
    data: { 
      status: 'EXPIRED',
      expiredAt: new Date(),
    },
  });
}
```

#### 2. Auto-Expire untuk Booster Package
```typescript
// Update booster package if provided
if (data.boosterPackageId) {
  const updatedBooster = await tx.memberPackage.update({
    where: { id: data.boosterPackageId },
    data: { usedSessions: { increment: 1 } },
  });

  // Check if all booster sessions are used - auto expire booster package
  if (updatedBooster.usedSessions >= updatedBooster.totalSessions) {
    await tx.memberPackage.update({
      where: { id: data.boosterPackageId },
      data: { 
        status: 'EXPIRED',
        expiredAt: new Date(),
      },
    });
  }
}
```

#### 3. Perbaiki Validasi (Optional Clarity)
```typescript
// Sebelum:
if (remainingSessions <= 0) { ... }

// Sesudah (lebih jelas):
if (remainingSessions < 1) { ... }
```

---

## 🎯 HASIL SETELAH PERBAIKAN

### Alur Baru - Lengkap:

#### Skenario: Package dengan 7 sesi total, sudah pakai 6 sesi

**Step 1: Sebelum buat session ke-7**
```
usedSessions=6, totalSessions=7, status=ACTIVE
remainingSessions = 7 - 6 = 1 ✅ (masih bisa buat session)
```

**Step 2: Membuat session ke-7**
```
1. Validasi pass (remainingSessions = 1 > 0)
2. Session dibuat
3. usedSessions di-increment: 6 + 1 = 7
4. Cek: 7 >= 7? YA!
5. Update status → EXPIRED
6. Set expiredAt → 2026-06-07
```

**Step 3: Hasil akhir**
```
usedSessions=7, totalSessions=7, status=EXPIRED ✅
```

**Step 4: Coba buat session ke-8**
```
ERROR: PACKAGE_NOT_ACTIVE
Paket tidak aktif (karena status=EXPIRED)
```

---

## 🧪 CARA TESTING

### Test Case 1: Package Habis Tepat di Session Terakhir
```bash
# Initial state:
usedSessions=6, totalSessions=7, status=ACTIVE

# Action: Buat session ke-7
POST /treatment-sessions
{
  "memberPackageId": "...",
  "memberId": "...",
  ...
}

# Expected result:
✅ Session berhasil dibuat
✅ usedSessions = 7
✅ status = EXPIRED
✅ expiredAt = [timestamp sekarang]

# Verify: Coba buat session ke-8
POST /treatment-sessions (dengan package yang sama)

# Expected error:
❌ 422 PACKAGE_NOT_ACTIVE
"Paket tidak aktif"
```

### Test Case 2: Package Sudah Expired Sebelumnya
```bash
# Initial state:
usedSessions=7, totalSessions=7, status=EXPIRED

# Action: Coba buat session baru
POST /treatment-sessions

# Expected error:
❌ 422 PACKAGE_NOT_ACTIVE
"Paket tidak aktif"
```

### Query untuk Verifikasi:
```sql
-- Cek package yang baru expired
SELECT 
  mp.id,
  mp.packageCode,
  mp.packageType,
  mp.totalSessions,
  mp.usedSessions,
  mp.status,
  mp.expiredAt,
  m.memberNo,
  u.email
FROM "MemberPackage" mp
JOIN "Member" m ON mp.memberId = m.id
JOIN "User" u ON m.userId = u.id
WHERE mp.status = 'EXPIRED'
  AND mp.expiredAt IS NOT NULL
  AND mp.expiredAt > NOW() - INTERVAL '1 hour'
ORDER BY mp.expiredAt DESC;
```

---

## 📊 PENJELASAN UNTUK USER

### ❓ **Pertanyaan User:**
> "Testing Member 3 sudah menggunakan semua paket (usedSessions=6, totalSessions=7), tapi package masih active statusnya (tapi saat tidak bisa membuat therapy session). Apakah benar begitu?"

### ✅ **Jawaban:**

**SEBELUM FIX** (Bug):
```
usedSessions=6, totalSessions=7, status=ACTIVE
→ Bisa buat session ke-7 ✅
→ usedSessions menjadi 7
→ Status TETAP ACTIVE ❌ (INI BUG!)
→ remainingSessions = 0
→ Tidak bisa buat session baru ✅ (validasi bekerja)
→ Tapi status tidak berubah EXPIRED ❌ (INI MASALAH!)
```

**SETELAH FIX** (Correct):
```
usedSessions=6, totalSessions=7, status=ACTIVE
→ Bisa buat session ke-7 ✅
→ usedSessions menjadi 7
→ Status OTOMATIS berubah EXPIRED ✅ (FIX!)
→ expiredAt di-set ✅
→ Tidak bisa buat session baru ✅
→ Package benar-benar expired secara status ✅
```

### 🎯 **Kesimpulan:**
Yang Anda alami adalah **BENAR** - sistem memang memblok pembuatan session baru karena `remainingSessions <= 0`. Tapi **BUG**-nya adalah status package tidak berubah menjadi EXPIRED secara otomatis. Fix ini menyelesaikan masalah tersebut.

---

## 📝 CATATAN PENTING

### Kapan Package EXPIRED:
1. **Otomatis saat session dibuat**: Saat `usedSessions` mencapai `totalSessions` (FIX INI)
2. **Manual**: Admin mengubah status via dashboard
3. **Scheduled**: Cron job untuk expired berdasarkan tanggal (jika ada)

### Sequence yang Benar:
```
Session 1-6: usedSessions++, status=ACTIVE
Session 7 (terakhir): usedSessions++, cek jika habis → status=EXPIRED
Session 8+: ERROR (status bukan ACTIVE)
```

### Impact:
- ✅ Package yang sudah habis tidak bisa digunakan lagi
- ✅ Status database akurat (EXPIRED vs ACTIVE)
- ✅ Member harus beli package baru jika ingin terapi lagi
- ✅ Voucher count sudah berkurang saat session dibuat (existing)
- ✅ Data lebih akurat untuk reporting dan dashboard

### Edge Case:
Jika ada package existing dengan `usedSessions >= totalSessions` tapi `status=ACTIVE`, mereka akan:
- ❌ Tidak bisa buat session baru (validasi `remainingSessions <= 0`)
- ❌ Status tidak auto-update (karena tidak ada session baru dibuat)
- ✅ Solusi: Buat script migration untuk update status mereka, atau admin update manual

---

## 🚀 DEPLOYMENT

### Restart Required:
✅ **YA** - Perubahan di backend TypeScript, restart API server diperlukan

### Langkah Deployment:
```bash
# 1. Pull latest code
cd apps/api
git pull

# 2. Restart API server
# Windows (jika pakai PM2):
pm2 restart api

# Atau restart manual jika development:
# Ctrl+C untuk stop, lalu npm run dev lagi
```

### Rollback Plan:
Jika ada masalah, revert commit ini dan restart server.

---

## 🔗 RELATED FILES

- `apps/api/src/modules/sessions/services/session-creation.service.ts` - File utama yang diubah
- `apps/api/prisma/schema.prisma` - Model MemberPackage (status enum)
- `apps/web/src/types/package.ts` - Type definitions untuk frontend

---

**Dokumentasi dibuat oleh**: Kiro AI  
**Verified by**: [Nama Verifier]  
**Approved by**: [Nama Approver]
