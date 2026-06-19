# Status Therapy Plan Set - 18 Juni 2026

## ❓ Pertanyaan: Apakah Therapy Plan Sudah Satu Set?

### Jawaban: **BELUM ❌**

Saat ini therapy plan **BELUM** dikelompokkan sebagai satu set. Masih bersifat **individual/satuan**.

---

## 📊 Kondisi Saat Ini (Current State)

### Therapy Plan Masih Individual:
1. ✅ Bisa dibuat satuan: `POST /members/:memberId/therapy-plans`
2. ✅ Bisa dibuat bulk: `POST /members/:memberId/therapy-plans/bulk`
3. ✅ Bisa dibuat di sesi: `POST /treatment-sessions/:sessionId/therapy-plan`
4. ❌ **TIDAK ADA** konsep "TherapyPlanSet"
5. ❌ **TIDAK ADA** grouping per paket
6. ❌ **TIDAK ADA** penomoran terapi (Terapi ke-1, ke-2, dst)

### Masalah:
- Therapy plans terpecah-pecah
- Tidak jelas therapy plan mana untuk paket mana
- Tidak ada urutan terapi yang jelas
- Staff bisa membuat therapy plan dari berbagai tempat (tidak konsisten)

---

## 📝 Dokumen Planning Yang Sudah Ada

✅ Sudah ada dokumen planning lengkap:
**`docs/THERAPY-PLAN-BULK-SET-PROPOSAL.md`** (224 baris)

Dokumen ini berisi:
- Analisis kondisi saat ini
- Target alur baru (therapy plan sebagai set)
- Perubahan API yang disarankan
- Perubahan data model
- Perubahan frontend
- Aturan bisnis
- Urutan implementasi

---

## 🎯 Target Alur Baru (Belum Diimplementasi)

### Konsep Therapy Plan Set:

```
1 Paket Member = 1 Set Therapy Plan

Contoh:
- Member beli paket 15 sesi
- Staff buat 1 SET berisi 15 therapy plans
- Therapy Plan ke-1 untuk Sesi ke-1
- Therapy Plan ke-2 untuk Sesi ke-2
- ... dst sampai ke-15
```

### Model Data Usulan:

```
TherapyPlanSet (NEW MODEL)
├─ id
├─ memberId
├─ memberPackageId  ← Link ke paket
├─ setCode
├─ version
└─ status

TherapyPlan (MODIFIED)
├─ therapyPlanSetId  ← Link ke set (NEW)
├─ therapyNumber     ← Urutan: 1, 2, 3... (NEW)
├─ memberPackageId   ← Link ke paket (NEW)
└─ ... (field lain tetap sama)
```

### Aturan Bisnis Usulan:
1. ✅ 1 paket = 1 set therapy plan aktif
2. ✅ Therapy plan HANYA bisa dibuat bulk (sebagai set)
3. ✅ Hapus pembuatan satuan
4. ✅ Hapus pembuatan di step sesi
5. ✅ Sesi hanya MEMILIH therapy plan dari set yang sudah ada
6. ✅ Edit = edit set (bukan edit individual)

---

## ⚠️ Status: PLANNING ONLY

### ❌ BELUM DIIMPLEMENTASI:
- Model `TherapyPlanSet` belum ada di database
- Field `therapyPlanSetId`, `therapyNumber`, `memberPackageId` belum ada di `TherapyPlan`
- API endpoint belum diubah
- Frontend belum diubah
- Aturan bisnis belum diterapkan

### ✅ YANG SUDAH ADA:
- Dokumen planning lengkap (THERAPY-PLAN-BULK-SET-PROPOSAL.md)
- Analisis kebutuhan
- Rancangan data model
- Rancangan API changes
- Rancangan UI changes

---

## 🔧 Yang Perlu Diputuskan Sebelum Implementasi

### Keputusan Bisnis:
1. **Apakah 1 paket hanya boleh punya 1 set aktif?**
   - Atau boleh multiple set/draft?

2. **Jika therapy plan sudah dipakai sesi, apakah bisa diedit?**
   - Opsi A: Dikunci total
   - Opsi B: Buat versi baru, sesi lama pakai versi lama

3. **Member tanpa paket aktif, boleh buat therapy plan set?**
   - Untuk persiapan sebelum beli paket?

4. **Saat paket di-refund/cancel, therapy plan set bagaimana?**
   - Ikut nonaktif?
   - Tetap tersimpan untuk history?

5. **Penomoran terapi (ke-1, ke-2, dst) berdasarkan apa?**
   - Global per member?
   - Per paket?
   - Per cabang?

### Keputusan Teknis:
1. **Migration strategy untuk therapy plan lama**
   - Backfill ke set default?
   - Atau biarkan sebagai legacy?

2. **Versioning strategy untuk set**
   - Set-level versioning atau plan-level versioning?

---

## 📅 Urutan Implementasi Usulan

Jika fitur ini disetujui, urutan implementasinya:

### Phase 1: Backend
1. Tambah model `TherapyPlanSet` di Prisma schema
2. Tambah field di `TherapyPlan` (setId, therapyNumber, memberPackageId)
3. Migration database
4. Ubah service layer untuk support set creation
5. Ubah API endpoints

### Phase 2: Frontend  
6. Ubah bulk modal → "Create Therapy Plan Set"
7. Tampilkan therapy plan sebagai group per set/paket
8. Hapus pembuatan satuan dari member detail
9. Ubah create session: pilih dari list therapy plan set
10. Ubah step 2 sesi: dari input → review only

### Phase 3: Cleanup
11. Disable endpoint satuan
12. Disable endpoint create di sesi
13. Backfill data lama (optional)
14. Update dokumentasi

---

## 🚫 CATATAN PENTING

### ⚠️ JANGAN UBAH KODE DULU

Seperti yang Anda minta:
- ✅ **INI HANYA PLANNING/PROPOSAL**
- ✅ **BELUM ADA CODE CHANGES**
- ✅ **MENUNGGU KEPUTUSAN BISNIS**

### Langkah Selanjutnya:
1. **Review** dokumen planning ini
2. **Putuskan** pertanyaan bisnis di atas
3. **Approve** atau revisi proposal
4. **Baru** mulai implementasi kode

---

## 📂 Referensi Dokumen

- **Planning lengkap**: `docs/THERAPY-PLAN-BULK-SET-PROPOSAL.md`
- **Flow diagram**: `summary/2026-06-18/THERAPY-PLAN-SESSION-FLOW.md`
- **User guide**: `docs/USER-GUIDE-COMPLETE.md` (Section 8.4.5, 11.6)

---

**Kesimpulan**: Therapy plan **BELUM** menjadi satu set. Masih individual. Ada proposal lengkap untuk mengubahnya menjadi set, tapi **belum diimplementasi** dan menunggu keputusan bisnis.

**Status**: 🟡 PLANNING PHASE - NOT IMPLEMENTED YET
