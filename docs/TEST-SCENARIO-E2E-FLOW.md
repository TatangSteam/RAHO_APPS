# 🧪 Test Scenario End-to-End Flow

> **Dokumen ini berisi skenario test lengkap dari awal sampai akhir alur sistem RAHO Klinik.**
> Mulai dari Super Admin membuat Admin Manager, sampai Admin Layanan membuat sesi terapi.

---

## 📋 Daftar Isi

1. [Persiapan Awal](#-persiapan-awal)
2. [Phase 1: Super Admin → Admin Manager](#-phase-1-super-admin--admin-manager)
3. [Phase 2: Admin Manager → Cabang & Admin Cabang](#-phase-2-admin-manager--cabang--admin-cabang)
4. [Phase 3: Admin Cabang → Staff Cabang (Admin Layanan, Dokter, Nakes)](#-phase-3-admin-cabang--staff-cabang)
5. [Phase 4: Admin Cabang → Inventori Stok](#-phase-4-admin-cabang--inventori-stok)
6. [Phase 5: Admin Cabang → Member](#-phase-5-admin-cabang--member)
7. [Phase 6: Admin Cabang → Paket Member](#-phase-6-admin-cabang--paket-member)
8. [Phase 7: Dokter → Diagnosis](#-phase-7-dokter--diagnosis)
9. [Phase 8: Admin Layanan → Sesi Terapi](#-phase-8-admin-layanan--sesi-terapi)
10. [Verifikasi & Audit](#-verifikasi--audit)

---

## 🎯 Persiapan Awal

### Prerequisites
- [ ] API server running (`npm run dev` di `apps/api`)
- [ ] Web app running (`npm run dev` di `apps/web`)
- [ ] Database sudah ter-migrate (`npx prisma migrate deploy`)
- [ ] Essential seed sudah dijalankan (`npm run db:seed:essential`)
- [ ] Materials seed sudah dijalankan (`npx tsx prisma/seeds/materials.seed.ts`)
- [ ] MinIO running (untuk upload file)

### Akun Default
| Email | Password | Role |
|-------|----------|------|
| `superadmin@raho.id` | `Sup3r4dM1n@123` | SUPER_ADMIN |

---

## 🟣 Phase 1: Super Admin → Admin Manager

**Tujuan:** Super Admin membuat user Admin Manager untuk mengelola beberapa cabang.

### Test Case 1.1: Login sebagai Super Admin

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Buka `/login` | Form login muncul |
| 2 | Email: `superadmin@raho.id` | - |
| 3 | Password: `Sup3r4dM1n@123` | - |
| 4 | Klik **Masuk** | Redirect ke `/dashboard` |
| 5 | Cek sidebar | Menu lengkap muncul (Member, Sesi Terapi, Stok, Admin Managers, Master Produk, Audit Log, dll) |

✅ **Pass Criteria:** User berhasil login, role di header tertera "Super Admin"

---

### Test Case 1.2: Buat Admin Manager Baru

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik menu **Admin Managers** di sidebar | Halaman list Admin Manager muncul |
| 2 | Klik tombol **+ Tambah Admin Manager** | Modal form muncul |
| 3 | Isi form: <br> - Nama: `Budi Santoso` <br> - Email: `manager.budi@raho.id` <br> - Password: `Manager@123` <br> - No. HP: `0811-1111-1111` | Field tervalidasi (no error) |
| 4 | Klik **Simpan** | Toast sukses muncul, modal tertutup |
| 5 | Cek list Admin Manager | User baru muncul di list dengan badge `ADMIN_MANAGER` |

✅ **Pass Criteria:** 
- Admin Manager baru tercatat di database
- Audit log mencatat aksi `CREATE User` oleh Super Admin

📌 **Verifikasi DB:**
```sql
SELECT email, role, "isActive" FROM users WHERE email = 'manager.budi@raho.id';
-- Expected: ADMIN_MANAGER, true
```

---

### Test Case 1.3: Logout Super Admin

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik tombol **Keluar** di sidebar | Redirect ke `/login` |
| 2 | localStorage cleared | `accessToken` tidak ada lagi |

---

## 🔵 Phase 2: Admin Manager → Cabang & Admin Cabang

**Tujuan:** Admin Manager membuat cabang baru dan menambahkan Admin Cabang.

### Test Case 2.1: Login sebagai Admin Manager

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Login: `manager.budi@raho.id` / `Manager@123` | Redirect ke `/dashboard` |
| 2 | Cek sidebar | Menu cabang multi-branch muncul, tidak ada menu Super Admin |

---

### Test Case 2.2: Buat Cabang Baru

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik menu **Pengaturan Cabang** atau **Cabang** | Halaman list cabang |
| 2 | Klik **+ Tambah Cabang** | Modal form cabang muncul |
| 3 | Isi form: <br> - Kode Cabang: `JKT` <br> - Nama: `RAHO Klinik Jakarta` <br> - Tipe: `KLINIK` <br> - Alamat: `Jl. Sudirman No. 100` <br> - Kota: `Jakarta` <br> - Telepon: `021-12345678` <br> - Jam Operasi: `08:00 - 20:00` | Form valid |
| 4 | Klik **Simpan** | Toast sukses, cabang baru muncul di list |

✅ **Pass Criteria:**
- Cabang dengan code `JKT` tercatat di tabel `branches`
- `createdBy` = ID Admin Manager
- Audit log: `CREATE Branch`

---

### Test Case 2.3: Assign Cabang ke Admin Manager (Self-assign untuk akses)

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Di halaman cabang, klik detail cabang `JKT` | Detail cabang muncul |
| 2 | Tab **Manager Branches** | List manager yang dipilih |
| 3 | Cek bahwa Admin Manager (Budi) sudah ter-assign | Auto-assigned saat create |

---

### Test Case 2.4: Buat Admin Cabang untuk Cabang JKT

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Buka detail cabang `JKT` | - |
| 2 | Tab **Staff** atau klik **+ Tambah Staff** | Modal staff muncul |
| 3 | Isi form: <br> - Role: `ADMIN_CABANG` <br> - Nama: `Siti Aminah` <br> - Email: `admincabang.jkt@raho.id` <br> - Password: `AdminCabang@123` <br> - No. HP: `0822-2222-2222` | Form valid |
| 4 | Klik **Simpan** | Toast sukses, staff muncul di list |

✅ **Pass Criteria:**
- User dengan role `ADMIN_CABANG` dan `branchId = JKT.id` tercatat
- `staffCode` auto-generated dengan format `AC-YYYYMMDD-XXX`

---

## 🟢 Phase 3: Admin Cabang → Staff Cabang

**Tujuan:** Admin Cabang membuat user Admin Layanan, Dokter, dan Nakes untuk cabangnya.

### Test Case 3.1: Login sebagai Admin Cabang JKT

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Logout dari Admin Manager | - |
| 2 | Login: `admincabang.jkt@raho.id` / `AdminCabang@123` | Redirect ke `/dashboard` |
| 3 | Cek header | Tertera: "Admin Cabang JKT" / "Cab. JKT" |
| 4 | Cek sidebar | Menu Member, Sesi Terapi, Stok, dll muncul. Menu Admin Manager TIDAK muncul |

---

### Test Case 3.2: Tambah Admin Layanan

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Buka detail cabang sendiri (atau menu Staff) | - |
| 2 | Klik **+ Tambah Staff** | Modal muncul |
| 3 | Isi form: <br> - Role: `ADMIN_LAYANAN` <br> - Nama: `Ahmad Yusuf` <br> - Email: `adminlayanan.jkt@raho.id` <br> - Password: `AdminLayanan@123` | - |
| 4 | Klik **Simpan** | User tercipta dengan `branchId = JKT.id` |

---

### Test Case 3.3: Tambah Dokter

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik **+ Tambah Staff** | Modal muncul |
| 2 | Isi form: <br> - Role: `DOCTOR` <br> - Nama: `dr. Andi Pratama` <br> - Email: `dokter.jkt@raho.id` <br> - Password: `Dokter@123` | - |
| 3 | Klik **Simpan** | Dokter tercipta + `StaffBranch` record |

---

### Test Case 3.4: Tambah Nakes

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik **+ Tambah Staff** | Modal muncul |
| 2 | Isi form: <br> - Role: `NURSE` <br> - Nama: `Dewi Lestari` <br> - Email: `nakes.jkt@raho.id` <br> - Password: `Nakes@123` | - |
| 3 | Klik **Simpan** | Nakes tercipta + `StaffBranch` record |

✅ **Pass Criteria:** Cabang JKT sekarang punya: 1 Admin Cabang + 1 Admin Layanan + 1 Dokter + 1 Nakes

---

## 🟡 Phase 4: Admin Cabang → Inventori Stok

**Tujuan:** Pastikan cabang punya stok material untuk sesi terapi.

### Test Case 4.1: Cek Stok Awal

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik menu **Stok** di sidebar | Halaman Inventori Stok |
| 2 | Cek stat cards | Total Item, Stok Rendah, Stok Normal terisi |
| 3 | Cek list produk | Material dari `seedMaterials` muncul (IFA, HHO, EDTA, dll) |

⚠️ **Catatan:** Cabang baru `JKT` mungkin belum punya inventory item. Solusinya:

**Opsi A: Top-up manual per produk**
1. Buka halaman **Master Produk** (jika punya akses)
2. Klik **📦 Stok** di salah satu produk
3. Tambah stok untuk cabang JKT

**Opsi B: Re-run materials seed dengan branch yang baru**
```bash
npx tsx prisma/seeds/materials.seed.ts
```

### Test Case 4.2: Edit Stok Produk

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik tombol **Edit Stok** pada produk `IFA A+MG 500ml` | Modal edit stok muncul |
| 2 | Update stok: `100 botol` | - |
| 3 | Klik **Simpan** | Toast sukses, `StockMutation` tercatat dengan type `ADJUSTMENT` |

---

## 🟠 Phase 5: Admin Cabang → Member

**Tujuan:** Buat member baru untuk cabang JKT.

### Test Case 5.1: Tambah Member Baru

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik menu **Member** di sidebar | Halaman list member |
| 2 | Klik **+ Tambah Member** | Wizard form member muncul |
| 3 | **Step 1 - Data Diri:** <br> - Nama: `Putri Amalia` <br> - NIK: `3201234567890123` <br> - Tempat Lahir: `Bandung` <br> - Tanggal Lahir: `1995-05-15` <br> - Jenis Kelamin: `P` <br> - No. HP: `0833-3333-3333` | Validasi NIK 16 digit |
| 4 | **Step 2 - Alamat & Kontak:** <br> - Alamat: `Jl. Mawar No. 5` <br> - Kontak Darurat: `0844-4444-4444` <br> - Sumber Info: `Instagram` | - |
| 5 | **Step 3 - Konsen Foto:** <br> - Centang setuju difoto saat terapi | - |
| 6 | **Step 4 - Upload Dokumen:** <br> - Upload foto profil <br> - Upload dokumen persetujuan setelah penjelasan | File ter-upload ke MinIO |
| 7 | Klik **Simpan Member** | Toast sukses, member baru muncul di list |

✅ **Pass Criteria:**
- Member tercipta dengan `memberNo` format `MBR-JKT-XXXX`
- User account dengan role `MEMBER` ter-create
- `MemberDocument` records ter-create untuk foto profil & consent doc
- `registrationBranchId = JKT.id`

📌 **Verifikasi DB:**
```sql
SELECT m."memberNo", u.email, m."registrationBranchId", m.nik 
FROM members m 
JOIN users u ON m."userId" = u.id 
WHERE m."memberNo" LIKE 'MBR-JKT-%';
```

---

## 🔴 Phase 6: Admin Cabang → Paket Member

**Tujuan:** Assign paket terapi ke member agar bisa dibuatkan sesi.

### Test Case 6.1: Assign Paket Basic

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik member `Putri Amalia` di list | Halaman detail member |
| 2 | Tab **Paket** | Section paket muncul |
| 3 | Klik **+ Tambah Paket** | Modal Assign Package muncul |
| 4 | **Step 1 - Pilih Tipe:** Pilih `BASIC` | - |
| 5 | **Step 2 - Pilih Paket:** <br> - Service Type: `HC (Home Care)` <br> - Total Sesi: `7` <br> - Booster: optional | Harga otomatis muncul dari `PackagePricing` |
| 6 | **Step 3 - Diskon (optional):** Skip atau isi | - |
| 7 | **Step 4 - Bukti Pembayaran:** Upload bukti transfer | File ter-upload |
| 8 | Klik **Simpan** | Status paket: `PENDING_PAYMENT` |
| 9 | Verifikasi pembayaran (klik tombol **Verifikasi**) | Status berubah jadi `ACTIVE` |

✅ **Pass Criteria:**
- `MemberPackage` tercipta dengan `packageType = BASIC`, `status = ACTIVE`
- `Invoice` auto-generated dengan status `PAID`
- `verifiedBy` dan `verifiedAt` terisi
- Audit log: `CREATE MemberPackage`, `VERIFY MemberPackage`

---

## 🩺 Phase 7: Dokter → Diagnosis

**Tujuan:** Member harus punya minimal 1 diagnosis sebelum bisa buat sesi terapi.

### Test Case 7.1: Login sebagai Dokter

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Logout dari Admin Cabang | - |
| 2 | Login: `dokter.jkt@raho.id` / `Dokter@123` | Redirect ke dashboard |

---

### Test Case 7.2: Buat Diagnosis untuk Member

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Buka detail member `Putri Amalia` | - |
| 2 | Tab **Diagnosis & Rekam Medis** | - |
| 3 | Klik **+ Tambah Diagnosis** | Form diagnosis muncul |
| 4 | Isi form: <br> - Kategori: `HIPERTENSI` <br> - ICD Primer: `I10` <br> - Diagnosa: `Hipertensi Esensial` <br> - Keluhan: `Sakit kepala, pusing` <br> - Riwayat Penyakit: `Tidak ada` <br> - Pemeriksaan Fisik: `TD: 150/90 mmHg` | - |
| 5 | Klik **Simpan** | Toast sukses, diagnosis muncul di list |

✅ **Pass Criteria:**
- `Diagnosis` tercipta dengan `memberId` member ybs
- `doktorPemeriksa` = ID dokter yang login
- `diagnosisCode` auto-generated

---

## 🔥 Phase 8: Admin Layanan → Sesi Terapi

**Tujuan:** **TUJUAN UTAMA** - Admin Layanan membuat sesi terapi untuk member.

### Test Case 8.1: Login sebagai Admin Layanan

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Logout dari Dokter | - |
| 2 | Login: `adminlayanan.jkt@raho.id` / `AdminLayanan@123` | Redirect ke dashboard |

---

### Test Case 8.2: Buat Therapy Plan (Persiapan)

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Buka detail member `Putri Amalia` | - |
| 2 | Tab **Therapy Plan** | - |
| 3 | Klik **+ Buat Therapy Plan** | Form therapy plan muncul |
| 4 | Isi rencana infus: <br> - IFA: `500 ml` <br> - HHO: `100 ml` <br> - NO: `25 ml` <br> - Catatan: `Sesi pertama` | - |
| 5 | Klik **Simpan** | Therapy plan tercipta dengan `treatmentSessionId = null` (belum dipakai) |

✅ **Pass Criteria:**
- `TherapyPlan` tercipta dengan `memberId` member
- Status: belum di-link ke sesi (`treatmentSessionId = null`)

---

### Test Case 8.3: Buat Sesi Terapi Baru

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik menu **Sesi Terapi** di sidebar | Halaman list sesi |
| 2 | Klik **+ Buat Sesi Terapi** | Modal Create Session muncul |
| 3 | **Step 1 - Pilih Member:** <br> - Cari `Putri Amalia` <br> - Pilih member | - |
| 4 | **Step 2 - Pilih Paket:** <br> - Pilih paket BASIC yang ACTIVE | Sisa sesi muncul (7 dari 7) |
| 5 | **Step 3 - Pilih Therapy Plan:** <br> - Pilih therapy plan yang baru dibuat | - |
| 6 | **Step 4 - Pilih Staff:** <br> - Admin Layanan: auto-fill (current user) <br> - Dokter: pilih `dr. Andi Pratama` <br> - Nakes: pilih `Dewi Lestari` | - |
| 7 | **Step 5 - Detail Sesi:** <br> - Pelaksanaan: `ON_SITE` <br> - Tanggal: hari ini <br> - Booster Package: skip | - |
| 8 | Klik **Buat Sesi** | Toast sukses, redirect ke detail sesi |

✅ **Pass Criteria:**
- `TreatmentSession` tercipta dengan `sessionCode` format `SES-JKT-XX-DDMM-XXXX`
- `Encounter` auto-created (jika belum ada untuk paket ini)
- `usedSessions` di MemberPackage bertambah 1 (`6/7` sisa)
- `voucherCount` di Member berkurang 1
- `TherapyPlan.treatmentSessionId` ter-update
- Audit log: `CREATE TreatmentSession`

📌 **Verifikasi DB:**
```sql
SELECT "sessionCode", "infusKe", "isCompleted", "treatmentDate" 
FROM treatment_sessions 
ORDER BY "createdAt" DESC LIMIT 1;
```

---

### Test Case 8.4: Isi Step 1 - Diagnosis (jika belum)

✅ Sudah ada dari Phase 7. Tinggal cek otomatis muncul di sesi.

---

### Test Case 8.5: Isi Step 2 - Therapy Plan

✅ Sudah dipilih saat create session.

---

### Test Case 8.6: Isi Step 3 - Vital Signs Sebelum

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Di detail sesi, klik **Step 3 - Vital Sebelum** | Form vital signs muncul |
| 2 | Isi: <br> - Sistol: `140` <br> - Diastol: `90` <br> - HR: `78` <br> - Saturasi: `98` <br> - PI: `5.5` | - |
| 3 | Klik **Simpan** | `VitalSign` records tercipta dengan `waktuCatat = SEBELUM` |

---

### Test Case 8.7: Isi Step 4/5 - Infus Aktual ⭐ AUTO-DEDUCT

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik **Step 4 - Infus Aktual** | Form infus muncul, default value dari therapy plan |
| 2 | Isi sesuai pemakaian: <br> - IFA: `500 ml` <br> - HHO: `100 ml` <br> - NO: `25 ml` <br> - Catatan Deviasi: kosong (jika sama dengan plan) | - |
| 3 | Klik **Simpan Infus** | **Otomatis terjadi:** <br> ✅ `InfusionExecution` tercipta <br> ✅ Stok `IFA 500ml` berkurang 1 botol <br> ✅ Stok `HHO 100ml` berkurang 1 botol <br> ✅ Stok `NO 25ml` berkurang 1 botol <br> ✅ `MaterialUsage` records auto-created untuk masing-masing |

✅ **Pass Criteria:**
- `StockMutation` tercipta dengan `referenceType = 'InfusionExecution'`
- Stok di tabel `inventory_items` berkurang
- `MaterialUsage` records muncul di Step 6 tanpa input manual

📌 **Verifikasi:**
- Buka menu **Stok** → cek stok IFA berkurang
- Buka **Master Produk** → produk IFA badge berubah jadi `🔗 Auto-fill: IFA (1x)`

---

### Test Case 8.8: Isi Step 6 - Material Usage Tambahan (Manual)

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik **Step 6 - Material Usage** | List material yang sudah ada (dari auto-fill infus) |
| 2 | Tambah material manual: <br> - Pilih `Infus Set` <br> - Jumlah: `1 piece` | - |
| 3 | Klik **+ Tambah** | `MaterialUsage` tercipta, stok berkurang |

✅ **Pass Criteria:**
- Material non-infus (alat medis) bisa ditambah manual
- Stok `Infus Set` berkurang 1 piece

---

### Test Case 8.9: Isi Step 7 - Upload Foto

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik **Step 7 - Upload Foto** | Form upload foto |
| 2 | Upload foto sesi terapi | File ter-upload ke MinIO |
| 3 | Klik **Simpan** | `SessionPhoto` record tercipta |

⚠️ **Catatan:** Step ini OPTIONAL, member harus consent (`isConsentToPhoto = true`)

---

### Test Case 8.10: Isi Step 8 - Vital Signs Sesudah & Evaluasi Dokter

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Klik **Step 8 - Vital Sesudah** | Form vital signs muncul |
| 2 | Isi vital sesudah terapi | `VitalSign` dengan `waktuCatat = SESUDAH` |
| 3 | Klik **Step 9 - Evaluasi Dokter** | Form evaluasi muncul |
| 4 | Isi SOAP: <br> - Subjective: `Pasien merasa lebih segar` <br> - Objective: `TD turun ke 130/85` <br> - Assessment: `Respon baik terhadap terapi` <br> - Plan: `Lanjutkan sesi 2 minggu ke depan` | - |
| 5 | Klik **Simpan** | `DoctorEvaluation` tercipta |

---

### Test Case 8.11: Complete Session

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Setelah semua step selesai (kecuali yang optional), klik **✅ Selesaikan Sesi** | Konfirmasi muncul |
| 2 | Klik **Ya, Selesaikan** | Toast sukses, status sesi: `COMPLETED` |

✅ **Pass Criteria:**
- `TreatmentSession.isCompleted = true`
- Audit log: `UPDATE TreatmentSession` dengan meta complete

---

## ✅ Verifikasi & Audit

### Verifikasi Akhir

#### Cek Audit Log (sebagai Super Admin)

| Step | Aksi | Expected Result |
|------|------|-----------------|
| 1 | Login sebagai Super Admin | - |
| 2 | Buka menu **Audit Log** | Halaman audit log |
| 3 | Filter by `resource = TreatmentSession` | Lihat record CREATE oleh Admin Layanan |
| 4 | Filter by `action = CREATE` | Lihat semua aksi create dari Phase 1-8 |

#### Cek Stock Mutations

```sql
-- Cek mutasi stok dari sesi terapi
SELECT 
  sm.type,
  sm.quantity,
  sm."stockBefore",
  sm."stockAfter",
  sm."referenceType",
  sm.notes,
  mp.name as product_name
FROM stock_mutations sm
JOIN inventory_items ii ON sm."inventoryItemId" = ii.id
JOIN master_products mp ON ii."masterProductId" = mp.id
WHERE sm."referenceType" IN ('InfusionExecution', 'MaterialUsage')
ORDER BY sm."createdAt" DESC
LIMIT 10;
```

#### Cek Member Package

```sql
-- Cek used sessions bertambah
SELECT 
  "packageCode", 
  "packageType", 
  "totalSessions", 
  "usedSessions",
  status
FROM member_packages 
WHERE status = 'ACTIVE';
-- Expected: usedSessions = 1, sisa = 6
```

---

## 📊 Summary Test Cases

| Phase | Role | Total Cases | Coverage |
|-------|------|-------------|----------|
| 1 | SUPER_ADMIN | 3 | Login, Create Manager, Logout |
| 2 | ADMIN_MANAGER | 4 | Login, Create Branch, Self-assign, Create Admin Cabang |
| 3 | ADMIN_CABANG | 4 | Login, Create Admin Layanan, Dokter, Nakes |
| 4 | ADMIN_CABANG | 2 | Inventory check & edit |
| 5 | ADMIN_CABANG | 1 | Create Member (multi-step) |
| 6 | ADMIN_CABANG | 1 | Assign & Verify Package |
| 7 | DOCTOR | 2 | Login, Create Diagnosis |
| 8 | ADMIN_LAYANAN | 11 | Full session lifecycle |
| ✅ | SUPER_ADMIN | 1 | Final audit verification |

**Total: 29 test cases**

---

## 🐛 Common Issues & Solutions

| Issue | Penyebab | Solusi |
|-------|----------|--------|
| 403 saat create session | User tidak punya `branchId` | Logout & login ulang untuk refresh token |
| Material dropdown kosong | Cabang baru belum punya `InventoryItem` | Run `npx tsx prisma/seeds/materials.seed.ts` |
| Diagnosis required error | Member belum punya diagnosis | Login sebagai dokter, buat diagnosis dulu |
| Therapy plan already used | Plan sudah dipakai di sesi lain | Buat therapy plan baru untuk sesi baru |
| Stock insufficient | Stok di cabang habis | Top-up stok via halaman Stok |

---

## 🎯 Acceptance Criteria

Test scenario ini PASS jika:

1. ✅ Semua 29 test case berhasil tanpa error
2. ✅ Audit log mencatat setiap aksi penting
3. ✅ Stok berkurang otomatis saat infus & material usage
4. ✅ Notifikasi stok kritis terkirim ke Admin Cabang (jika di bawah threshold)
5. ✅ Status paket dan voucher count ter-update dengan benar
6. ✅ Tidak ada error 403/500 dalam flow normal

---

**Selesai!** 🎉 Selamat menguji.
