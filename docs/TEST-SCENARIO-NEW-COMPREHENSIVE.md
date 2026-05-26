# Test Scenario Komprehensif - RAHO Premier Club

**Versi**: 3.0  
**Tanggal**: 26 Mei 2026  
**Aplikasi**: RAHO Premier Club Management System  
**Tujuan**: Panduan testing end-to-end dengan langkah detail dan kredensial yang benar

---

## Daftar Isi

1. [Persiapan Environment](#1-persiapan-environment)
2. [Kredensial Login](#2-kredensial-login)
3. [Scenario A: Login & Navigasi](#scenario-a-login--navigasi)
4. [Scenario B: Registrasi Member Baru](#scenario-b-registrasi-member-baru)
5. [Scenario C: Assign Paket ke Member](#scenario-c-assign-paket-ke-member)
6. [Scenario D: Verifikasi Pembayaran](#scenario-d-verifikasi-pembayaran)
7. [Scenario E: Buat Sesi Terapi](#scenario-e-buat-sesi-terapi)
8. [Scenario F: Eksekusi Sesi Terapi (8 Step)](#scenario-f-eksekusi-sesi-terapi-8-step)
9. [Scenario G: Inventory & Stock Request](#scenario-g-inventory--stock-request)
10. [Scenario H: Referral & Insentif](#scenario-h-referral--insentif)
11. [Scenario I: Member Portal](#scenario-i-member-portal)
12. [Scenario J: Super Admin Features](#scenario-j-super-admin-features)
13. [Scenario K: Export Data](#scenario-k-export-data)
14. [Checklist Testing](#checklist-testing)

---

## 1. Persiapan Environment

### 1.1 Jalankan Server

**Terminal 1 - Database & MinIO (Docker):**
```bash
cd c:\Users\jovan\Documents\RAHO\agpROJ
docker-compose up -d
```

**Terminal 2 - API Server:**
```bash
cd apps/api
npm run dev
```
Tunggu sampai muncul: `🚀 Server running on http://localhost:3001`

**Terminal 3 - Web Server:**
```bash
cd apps/web
npm run dev
```
Tunggu sampai muncul: `✓ Ready on http://localhost:3000`


### 1.2 Seed Database

**Untuk Production (Data Master saja):**
```bash
cd apps/api
npm run db:seed:essential
```

**Untuk Development/Testing (Data lengkap):**
```bash
cd apps/api
npm run db:seed:essential
npm run db:seed:testing
```

### 1.3 Verifikasi Environment

| Komponen | URL | Status Check |
|----------|-----|--------------|
| Web App | http://localhost:3000 | Halaman login muncul |
| API Server | http://localhost:3001/api/v1/health | `{"status":"ok"}` |
| MinIO Console | http://localhost:9001 | Login page muncul |
| PostgreSQL | localhost:5432 | Database connected |

---

## 2. Kredensial Login

### 2.1 Akun Admin (Cross-Branch)

| Role | Email | Password | Akses |
|------|-------|----------|-------|
| SUPER_ADMIN | `superadmin@raho.id` | `Sup3r4dM1n` | Semua cabang + semua fitur |
| ADMIN_MANAGER | `manager@raho.id` | `Manager@123` | Multi-branch management |

### 2.2 Akun Staff Jakarta (PST)

| Role | Email | Password |
|------|-------|----------|
| ADMIN_CABANG | `admincabang.jakarta@raho.id` | `AdminCabang@123` |
| ADMIN_LAYANAN | `adminlayanan.jakarta@raho.id` | `AdminLayanan@123` |
| DOCTOR | `dokter.jakarta@raho.id` | `Dokter@123` |
| NURSE | `nakes.jakarta@raho.id` | `Nakes@123` |

### 2.3 Akun Staff Bandung (BDG)

| Role | Email | Password |
|------|-------|----------|
| ADMIN_CABANG | `admincabang.bandung@raho.id` | `AdminCabang@123` |
| ADMIN_LAYANAN | `adminlayanan.bandung@raho.id` | `AdminLayanan@123` |
| DOCTOR | `dokter.bandung@raho.id` | `Dokter@123` |
| NURSE | `nakes.bandung@raho.id` | `Nakes@123` |

### 2.4 Akun Staff Surabaya (SBY)

| Role | Email | Password |
|------|-------|----------|
| ADMIN_CABANG | `admincabang.surabaya@raho.id` | `AdminCabang@123` |
| ADMIN_LAYANAN | `adminlayanan.surabaya@raho.id` | `AdminLayanan@123` |
| DOCTOR | `dokter.surabaya@raho.id` | `Dokter@123` |
| NURSE | `nakes.surabaya@raho.id` | `Nakes@123` |

### 2.5 Akun Member (untuk testing Member Portal)

| Nama | Email | Password |
|------|-------|----------|
| Budi Santoso | `budi.santoso@example.com` | `member123` |


---

## Scenario A: Login & Navigasi

### TC-A01: Login sebagai Super Admin

**Tujuan:** Memastikan Super Admin dapat login dan melihat semua menu

**Langkah-langkah:**

1. **Buka browser dan akses halaman login**
   - URL: `http://localhost:3000/login`
   - Pastikan halaman login tampil dengan logo RAHO

2. **Masukkan kredensial Super Admin**
   - Email: `superadmin@raho.id`
   - Password: `Sup3r4dM1n`
   - Klik tombol "Masuk"

3. **Verifikasi redirect ke dashboard**
   - URL berubah ke `/dashboard`
   - Nama "Super Administrator" tampil di header
   - Badge "SUPER_ADMIN" terlihat

4. **Verifikasi menu sidebar**
   - ✅ Dashboard
   - ✅ Members
   - ✅ Sessions
   - ✅ Branches
   - ✅ Referrals
   - ✅ Inventory
   - ✅ Admin (dengan submenu)

**Expected Result:**
- Login berhasil tanpa error
- Dashboard menampilkan statistik semua cabang
- Semua menu tersedia

---

### TC-A02: Login sebagai Admin Cabang

**Tujuan:** Memastikan Admin Cabang hanya melihat data cabangnya

**Langkah-langkah:**

1. **Logout dari akun sebelumnya**
   - Klik avatar di pojok kanan atas
   - Klik "Logout"

2. **Login sebagai Admin Cabang Jakarta**
   - Email: `admincabang.jakarta@raho.id`
   - Password: `AdminCabang@123`

3. **Verifikasi dashboard**
   - Hanya menampilkan statistik cabang Jakarta
   - Tidak ada dropdown pilih cabang

4. **Verifikasi menu**
   - Menu "Branches" tidak ada atau terbatas
   - Menu "Admin" terbatas

**Expected Result:**
- Data yang ditampilkan hanya untuk cabang Jakarta
- Tidak bisa akses data cabang lain

---

### TC-A03: Login dengan kredensial salah

**Tujuan:** Memastikan sistem menolak login dengan kredensial invalid

**Langkah-langkah:**

1. **Buka halaman login**
2. **Masukkan email benar, password salah**
   - Email: `superadmin@raho.id`
   - Password: `wrongpassword`
   - Klik "Masuk"

3. **Verifikasi error message**
   - Muncul pesan "Email atau password salah"
   - Tetap di halaman login

**Expected Result:**
- Login ditolak dengan pesan error yang jelas
- Tidak ada informasi sensitif yang bocor


---

## Scenario B: Registrasi Member Baru

### TC-B01: Registrasi Member dengan Data Lengkap

**Prasyarat:** Login sebagai Admin Layanan Jakarta

**Langkah-langkah:**

1. **Login sebagai Admin Layanan**
   - Email: `adminlayanan.jakarta@raho.id`
   - Password: `AdminLayanan@123`

2. **Navigasi ke halaman Members**
   - Klik menu "Members" di sidebar
   - URL: `/members`

3. **Klik tombol "Daftarkan Member Baru"**
   - Tombol berwarna kuning di pojok kanan atas
   - Redirect ke `/members/new`

4. **Isi Form Data Pribadi (Step 1)**
   ```
   Nama Lengkap: Andi Wijaya Test
   NIK: 3201234567890123
   Tanggal Lahir: 1990-05-15
   Jenis Kelamin: Laki-laki
   Alamat: Jl. Sudirman No. 100, Jakarta
   Telepon: 081234567890
   Email: andi.wijaya.test@example.com
   ```

5. **Upload Dokumen (Step 2)**
   - Upload foto KTP (format JPG/PNG, max 5MB)
   - Upload foto PSP (Persetujuan Setelah Penjelasan)

6. **Isi Data Akun (Step 3)**
   ```
   Email: andi.wijaya.test@example.com (auto-filled)
   Password: Member@123
   Konfirmasi Password: Member@123
   ```

7. **Pilih Referral (Opsional)**
   - Jika ada kode referral, masukkan di field "Kode Referral"
   - Sistem akan validasi kode

8. **Klik "Simpan"**

**Expected Result:**
- ✅ Member berhasil terdaftar
- ✅ Nomor member ter-generate otomatis (format: MBR-XXXXXX)
- ✅ Redirect ke halaman detail member
- ✅ Toast sukses muncul

---

### TC-B02: Validasi Form Registrasi

**Tujuan:** Memastikan validasi form berfungsi dengan benar

**Langkah-langkah:**

1. **Buka form registrasi member baru**

2. **Test validasi NIK**
   - Masukkan NIK kurang dari 16 digit: `12345`
   - Klik field lain
   - Verifikasi error: "NIK harus 16 digit"

3. **Test validasi email**
   - Masukkan email invalid: `invalid-email`
   - Verifikasi error: "Format email tidak valid"

4. **Test validasi telepon**
   - Masukkan telepon invalid: `abc123`
   - Verifikasi error: "Format telepon tidak valid"

5. **Test required fields**
   - Kosongkan nama lengkap
   - Klik "Simpan"
   - Verifikasi error: "Nama lengkap wajib diisi"

**Expected Result:**
- Semua validasi berfungsi dengan pesan error yang jelas
- Form tidak bisa di-submit jika ada error


---

## Scenario C: Assign Paket ke Member

### TC-C01: Assign Paket BASIC ke Member

**Prasyarat:** 
- Login sebagai Admin Layanan Jakarta
- Member sudah terdaftar

**Langkah-langkah:**

1. **Buka halaman detail member**
   - Navigasi ke `/members`
   - Cari member "Andi Wijaya Test" atau member existing
   - Klik tombol "Detail"

2. **Klik tab "Paket"**
   - Tab kedua setelah "Profil"

3. **Klik tombol "Tambah Paket"**
   - Modal assign paket terbuka

4. **Pilih Tipe Paket BASIC**
   - Klik radio button "BASIC"
   - Dropdown produk paket muncul

5. **Pilih Produk Paket**
   - Pilih "TNB-P7" (7 sesi) atau paket lain yang tersedia
   - Harga otomatis terisi

6. **Isi Detail Paket**
   ```
   Jumlah Sesi: 7 (auto-filled dari produk)
   Harga: Rp 7.000.000 (auto-filled)
   Diskon (%): 10
   Diskon (Rp): 0
   Catatan Diskon: Promo member baru
   ```

7. **Verifikasi Kalkulasi**
   - Harga Awal: Rp 7.000.000
   - Diskon: Rp 700.000 (10%)
   - Harga Final: Rp 6.300.000

8. **Klik "Simpan"**

**Expected Result:**
- ✅ Paket berhasil di-assign
- ✅ Status paket: "PENDING_PAYMENT"
- ✅ Invoice ter-generate otomatis
- ✅ Paket muncul di tab Paket member

---

### TC-C02: Assign Paket BOOSTER ke Member

**Prasyarat:** Member sudah punya paket BASIC aktif

**Langkah-langkah:**

1. **Buka detail member yang sudah punya paket BASIC**

2. **Klik "Tambah Paket"**

3. **Pilih Tipe Paket BOOSTER**
   - Klik radio button "BOOSTER"
   - Field tambahan muncul: Tipe Booster, Tipe Layanan

4. **Pilih Tipe Booster**
   - Pilih "NO" (Nitric Oxide) atau booster lain
   - Opsi: NO, GT, MB, KCL, H2S, HK, O3

5. **Pilih Tipe Layanan**
   - Pilih "PM" (Premier) atau layanan lain
   - Opsi: PM, PS, PTY, PDA, PHC

6. **Isi Detail**
   ```
   Jumlah Sesi: 1
   Harga: (auto-filled dari pricing matrix)
   ```

7. **Klik "Simpan"**

**Expected Result:**
- ✅ Paket BOOSTER berhasil di-assign
- ✅ Status: "PENDING_PAYMENT"
- ✅ Terhubung dengan paket BASIC (jika bundling)

---

### TC-C03: Bundle Multiple Paket

**Tujuan:** Assign BASIC + BOOSTER dalam satu pembelian

**Langkah-langkah:**

1. **Buka modal assign paket**

2. **Centang opsi "Bundle dengan paket lain"**

3. **Pilih paket BASIC**
   - Produk: TNB-P10 (10 sesi)

4. **Klik "Tambah Booster"**
   - Pilih Booster: GT (Glutathione)
   - Layanan: PM

5. **Verifikasi total bundle**
   - Harga BASIC + Harga BOOSTER
   - Diskon bundle (jika ada)

6. **Klik "Simpan"**

**Expected Result:**
- ✅ Kedua paket ter-assign dengan purchaseGroupId yang sama
- ✅ Satu invoice untuk bundle
- ✅ Status keduanya: "PENDING_PAYMENT"


---

## Scenario D: Verifikasi Pembayaran

### TC-D01: Upload Bukti Pembayaran

**Prasyarat:** 
- Member punya paket dengan status PENDING_PAYMENT
- Login sebagai Admin Layanan

**Langkah-langkah:**

1. **Buka detail member**
   - Navigasi ke member yang punya paket pending

2. **Klik tab "Paket"**
   - Cari paket dengan status "Menunggu Pembayaran"

3. **Klik tombol "Upload Bukti Bayar"**
   - Ikon upload atau tombol pada card paket

4. **Pilih file bukti pembayaran**
   - Format: JPG, PNG, atau PDF
   - Ukuran maksimal: 5MB
   - Pilih file dari komputer

5. **Klik "Upload"**

**Expected Result:**
- ✅ File terupload ke MinIO
- ✅ Status paket berubah ke "WAITING_VERIFICATION"
- ✅ Tombol "Verifikasi" muncul untuk Admin Cabang

---

### TC-D02: Verifikasi Pembayaran oleh Admin Cabang

**Prasyarat:** 
- Bukti pembayaran sudah diupload
- Login sebagai Admin Cabang

**Langkah-langkah:**

1. **Login sebagai Admin Cabang Jakarta**
   - Email: `admincabang.jakarta@raho.id`
   - Password: `AdminCabang@123`

2. **Buka detail member dengan paket waiting verification**

3. **Klik tab "Paket"**
   - Cari paket dengan status "Menunggu Verifikasi"

4. **Klik tombol "Lihat Bukti Bayar"**
   - Modal preview bukti pembayaran terbuka
   - Verifikasi gambar/dokumen

5. **Klik tombol "Verifikasi"**
   - Konfirmasi dialog muncul
   - Klik "Ya, Verifikasi"

**Expected Result:**
- ✅ Status paket berubah ke "ACTIVE"
- ✅ Field `paidAt`, `verifiedAt`, `verifiedBy` terisi
- ✅ Sesi tersedia untuk digunakan
- ✅ Jika ada referral, insentif terhitung otomatis

---

### TC-D03: Tolak Pembayaran

**Langkah-langkah:**

1. **Buka paket dengan bukti bayar**

2. **Klik "Lihat Bukti Bayar"**

3. **Klik tombol "Tolak"**
   - Isi alasan penolakan: "Bukti tidak jelas"
   - Klik "Konfirmasi Tolak"

**Expected Result:**
- ✅ Status kembali ke "PENDING_PAYMENT"
- ✅ Member bisa upload ulang bukti bayar
- ✅ Alasan penolakan tercatat


---

## Scenario E: Buat Sesi Terapi

### TC-E01: Buat Sesi Terapi Baru

**Prasyarat:**
- Member punya paket ACTIVE dengan sisa sesi > 0
- Login sebagai Admin Layanan

**Langkah-langkah:**

1. **Login sebagai Admin Layanan Jakarta**
   - Email: `adminlayanan.jakarta@raho.id`
   - Password: `AdminLayanan@123`

2. **Navigasi ke halaman Sessions**
   - Klik menu "Sessions" di sidebar
   - URL: `/sessions`

3. **Klik tombol "Buat Sesi Baru"**
   - Modal create session terbuka

4. **Cari dan Pilih Member**
   - Ketik nama member di search box
   - Pilih member dari dropdown

5. **Pilih Paket yang Digunakan**
   - Dropdown menampilkan paket ACTIVE member
   - Pilih paket dengan sisa sesi > 0

6. **Pilih Tanggal & Waktu**
   ```
   Tanggal: (pilih tanggal hari ini atau mendatang)
   Waktu: 09:00
   ```

7. **Pilih Tipe Pelaksanaan**
   - ON_SITE (di klinik)
   - HOME_CARE (di rumah member)

8. **Pilih Staff**
   ```
   Dokter: dr. Ahmad Fauzi (atau dokter yang tersedia)
   Perawat: Siti Rahayu (atau perawat yang tersedia)
   ```

9. **Pilih Booster (Opsional)**
   - Jika member punya paket BOOSTER, pilih untuk digunakan

10. **Klik "Buat Sesi"**

**Expected Result:**
- ✅ Sesi berhasil dibuat
- ✅ Kode sesi ter-generate (format: SES-XXXXXX)
- ✅ Status sesi: "SCHEDULED"
- ✅ Redirect ke halaman detail sesi

---

### TC-E02: Validasi Sesi - Member Tanpa Paket Aktif

**Tujuan:** Memastikan tidak bisa buat sesi untuk member tanpa paket

**Langkah-langkah:**

1. **Buka modal create session**

2. **Pilih member yang tidak punya paket ACTIVE**

3. **Verifikasi pesan error**
   - "Member tidak memiliki paket aktif"
   - Dropdown paket kosong

**Expected Result:**
- Tidak bisa melanjutkan pembuatan sesi
- Pesan error yang jelas


---

## Scenario F: Eksekusi Sesi Terapi (8 Step)

### TC-F01: Step 1 - Diagnosis

**Prasyarat:** Sesi sudah dibuat, login sebagai Dokter

**Langkah-langkah:**

1. **Login sebagai Dokter Jakarta**
   - Email: `dokter.jakarta@raho.id`
   - Password: `Dokter@123`

2. **Buka halaman detail sesi**
   - Navigasi ke `/sessions`
   - Klik sesi yang baru dibuat

3. **Klik tab "Diagnosis" atau Step 1**

4. **Isi Form Diagnosis**
   ```
   Keluhan Utama: Kelelahan kronis, sulit tidur
   Riwayat Penyakit: Tidak ada riwayat penyakit serius
   Pemeriksaan Fisik: Kondisi umum baik, tidak ada kelainan
   Diagnosis: Fatigue syndrome
   Kode ICD-10 Primer: R53.83
   Kode ICD-10 Sekunder: (opsional)
   Kategori: GENERAL
   ```

5. **Klik "Simpan"**

**Expected Result:**
- ✅ Diagnosis tersimpan
- ✅ Timestamp tercatat
- ✅ Step 1 marked as complete
- ✅ Bisa lanjut ke Step 2

---

### TC-F02: Step 2 - Therapy Plan

**Langkah-langkah:**

1. **Klik tab "Therapy Plan" atau Step 2**

2. **Isi Rencana Terapi**
   ```
   IFA 250: 1 ampul
   IFA 500: 0 ampul
   HHO: 1 unit
   H2: 1 unit
   Catatan: Infus standar untuk fatigue
   ```

3. **Klik "Simpan"**

**Expected Result:**
- ✅ Therapy plan tersimpan
- ✅ Dosis tercatat untuk referensi perawat
- ✅ Step 2 complete

---

### TC-F03: Step 3 - Vital Signs (Before)

**Prasyarat:** Login sebagai Perawat

**Langkah-langkah:**

1. **Login sebagai Perawat Jakarta**
   - Email: `nakes.jakarta@raho.id`
   - Password: `Nakes@123`

2. **Buka detail sesi**

3. **Klik tab "Vital Signs" atau Step 3**

4. **Isi Vital Signs Sebelum Terapi**
   ```
   Tekanan Darah Sistol: 120
   Tekanan Darah Diastol: 80
   Heart Rate: 72
   Saturasi O2: 98
   Perfusion Index: 3.5
   Suhu: 36.5
   Berat Badan: 70
   ```

5. **Klik "Simpan"**

**Expected Result:**
- ✅ Vital signs tersimpan dengan timestamp
- ✅ Data ditampilkan di summary
- ✅ Step 3 complete

---

### TC-F04: Step 4 - Infusion

**Langkah-langkah:**

1. **Klik tab "Infusion" atau Step 4**

2. **Isi Data Infus**
   ```
   Waktu Mulai: 09:30
   Waktu Selesai: 10:30
   Catatan: Infus berjalan lancar, tidak ada reaksi
   ```

3. **Klik "Simpan"**

**Expected Result:**
- ✅ Data infus tersimpan
- ✅ Durasi terhitung otomatis (60 menit)
- ✅ Step 4 complete


---

### TC-F05: Step 5 - Material Usage

**Langkah-langkah:**

1. **Klik tab "Materials" atau Step 5**

2. **Tambah Material yang Digunakan**
   - Klik "Tambah Material"
   - Pilih item dari inventory: "Infus Set"
   - Jumlah: 1
   - Klik "Tambah"

3. **Tambah Material Lain**
   - Pilih: "Kapas Alkohol"
   - Jumlah: 2
   - Klik "Tambah"

4. **Verifikasi Daftar Material**
   - Semua material yang digunakan tercatat

5. **Klik "Simpan"**

**Expected Result:**
- ✅ Material usage tercatat
- ✅ Stock inventory berkurang otomatis
- ✅ Step 5 complete

---

### TC-F06: Step 6 - Session Photo

**Langkah-langkah:**

1. **Klik tab "Foto" atau Step 6**

2. **Upload Foto Sebelum Terapi**
   - Klik "Upload Foto Before"
   - Pilih file gambar
   - Tambah caption: "Kondisi sebelum terapi"

3. **Upload Foto Sesudah Terapi**
   - Klik "Upload Foto After"
   - Pilih file gambar
   - Tambah caption: "Kondisi setelah terapi"

4. **Klik "Simpan"**

**Expected Result:**
- ✅ Foto terupload ke MinIO
- ✅ Preview foto tampil
- ✅ Step 6 complete

---

### TC-F07: Step 7 - Vital Signs (After)

**Langkah-langkah:**

1. **Klik tab "Vital Signs After" atau Step 7**

2. **Isi Vital Signs Setelah Terapi**
   ```
   Tekanan Darah Sistol: 118
   Tekanan Darah Diastol: 78
   Heart Rate: 68
   Saturasi O2: 99
   Perfusion Index: 4.0
   Suhu: 36.4
   ```

3. **Klik "Simpan"**

**Expected Result:**
- ✅ Vital signs after tersimpan
- ✅ Perbandingan before/after bisa dilihat
- ✅ Step 7 complete

---

### TC-F08: Step 8 - Doctor Evaluation

**Prasyarat:** Login sebagai Dokter

**Langkah-langkah:**

1. **Login sebagai Dokter**

2. **Buka detail sesi**

3. **Klik tab "Evaluation" atau Step 8**

4. **Isi Evaluasi SOAP**
   ```
   Subjective: Pasien merasa lebih segar setelah terapi
   Objective: Vital signs stabil, tidak ada keluhan
   Assessment: Terapi berjalan baik, respon positif
   Plan: Lanjutkan terapi sesuai jadwal, kontrol 1 minggu
   ```

5. **Klik "Simpan"**

**Expected Result:**
- ✅ Evaluasi tersimpan
- ✅ Step 8 complete
- ✅ Semua 8 step selesai

---

### TC-F09: Complete Session

**Langkah-langkah:**

1. **Verifikasi semua step sudah complete**
   - Semua step menunjukkan centang hijau

2. **Klik tombol "Selesaikan Sesi"**
   - Tombol di bagian bawah atau header

3. **Konfirmasi dialog**
   - "Yakin ingin menyelesaikan sesi ini?"
   - Klik "Ya, Selesaikan"

**Expected Result:**
- ✅ Status sesi berubah ke "COMPLETED"
- ✅ Sisa sesi paket berkurang 1
- ✅ Sesi tidak bisa diedit lagi
- ✅ Audit log tercatat


---

## Scenario G: Inventory & Stock Request

### TC-G01: Lihat Stock Inventory Cabang

**Prasyarat:** Login sebagai Admin Cabang

**Langkah-langkah:**

1. **Login sebagai Admin Cabang Jakarta**
   - Email: `admincabang.jakarta@raho.id`
   - Password: `AdminCabang@123`

2. **Navigasi ke Inventory**
   - Klik menu "Inventory" di sidebar
   - URL: `/inventory`

3. **Verifikasi tampilan stock**
   - Daftar item inventory dengan jumlah stock
   - Warning untuk stock rendah (warna merah/kuning)
   - Filter berdasarkan kategori

**Expected Result:**
- ✅ Daftar inventory cabang tampil
- ✅ Stock level terlihat jelas
- ✅ Low stock warning berfungsi

---

### TC-G02: Buat Stock Request

**Langkah-langkah:**

1. **Navigasi ke Stock Requests**
   - Klik tab "Stock Requests" atau `/inventory/stock-requests`

2. **Klik "Buat Request"**
   - Modal create request terbuka

3. **Pilih Item yang Diminta**
   - Klik "Tambah Item"
   - Pilih: "Infus Set"
   - Jumlah: 50
   - Klik "Tambah"

4. **Tambah Item Lain**
   - Pilih: "Kapas Alkohol"
   - Jumlah: 100

5. **Isi Catatan**
   ```
   Catatan: Stock menipis, butuh restock untuk 2 minggu ke depan
   ```

6. **Klik "Submit Request"**

**Expected Result:**
- ✅ Stock request berhasil dibuat
- ✅ Status: "PENDING"
- ✅ Request muncul di daftar
- ✅ Notifikasi ke Super Admin

---

### TC-G03: Approve Stock Request (Super Admin)

**Prasyarat:** Login sebagai Super Admin

**Langkah-langkah:**

1. **Login sebagai Super Admin**
   - Email: `superadmin@raho.id`
   - Password: `Sup3r4dM1n`

2. **Navigasi ke Stock Requests**
   - `/inventory/stock-requests`

3. **Cari request yang pending**
   - Filter status: "PENDING"

4. **Klik request untuk review**
   - Modal detail request terbuka

5. **Review item yang diminta**
   - Verifikasi jumlah dan item

6. **Klik "Approve"**
   - Atau "Reject" dengan alasan

**Expected Result:**
- ✅ Status berubah ke "APPROVED"
- ✅ Siap untuk proses pembayaran
- ✅ Notifikasi ke Admin Cabang

---

### TC-G04: Upload Bukti Bayar Stock Request

**Prasyarat:** Request sudah approved

**Langkah-langkah:**

1. **Login sebagai Admin Cabang**

2. **Buka stock request yang approved**

3. **Klik "Upload Bukti Bayar"**
   - Pilih file bukti transfer
   - Klik "Upload"

**Expected Result:**
- ✅ Status berubah ke "PAYMENT_UPLOADED"
- ✅ Menunggu verifikasi Super Admin

---

### TC-G05: Buat Shipment

**Prasyarat:** Payment sudah diverifikasi, login sebagai Super Admin

**Langkah-langkah:**

1. **Navigasi ke Shipments**
   - `/inventory/shipments`

2. **Klik "Buat Shipment"**

3. **Pilih Stock Request**
   - Pilih request yang sudah PAID

4. **Isi Detail Pengiriman**
   ```
   Nomor Resi: JNE123456789
   Kurir: JNE
   Tanggal Kirim: (hari ini)
   Catatan: Dikirim via JNE REG
   ```

5. **Klik "Kirim"**

**Expected Result:**
- ✅ Shipment berhasil dibuat
- ✅ Status: "SHIPPED"
- ✅ Notifikasi ke Admin Cabang

---

### TC-G06: Terima Shipment

**Prasyarat:** Login sebagai Admin Cabang

**Langkah-langkah:**

1. **Navigasi ke Shipments**

2. **Cari shipment dengan status "SHIPPED"**

3. **Klik "Terima"**
   - Verifikasi item yang diterima
   - Centang semua item yang sesuai

4. **Klik "Konfirmasi Terima"**

**Expected Result:**
- ✅ Status shipment: "RECEIVED"
- ✅ Stock inventory cabang bertambah
- ✅ Stock request: "COMPLETED"


---

## Scenario H: Referral & Insentif

### TC-H01: Buat Kode Referral Baru

**Prasyarat:** Login sebagai Admin Cabang atau Super Admin

**Langkah-langkah:**

1. **Login sebagai Admin Cabang Jakarta**

2. **Navigasi ke Referrals**
   - Klik menu "Referrals" di sidebar
   - URL: `/referrals`

3. **Klik "Buat Referral"**

4. **Isi Form Referral**
   ```
   Tipe Referrer: DOKTER
   Nama Referrer: dr. Budi Praktek
   Telepon: 081234567890
   Email: dr.budi@example.com
   Tipe Insentif: PERCENTAGE
   Nilai Insentif: 10 (10%)
   Insentif Paket Pertama: 15 (15%)
   ```

5. **Klik "Simpan"**

**Expected Result:**
- ✅ Kode referral ter-generate otomatis (format: REF-XXXXXX)
- ✅ Referral muncul di daftar
- ✅ Status: "ACTIVE"

---

### TC-H02: Gunakan Kode Referral saat Registrasi

**Langkah-langkah:**

1. **Buka form registrasi member baru**

2. **Isi data member**

3. **Masukkan kode referral**
   - Field "Kode Referral": masukkan kode yang dibuat
   - Sistem validasi kode

4. **Verifikasi kode valid**
   - Nama referrer tampil
   - Persentase insentif tampil

5. **Simpan member**

**Expected Result:**
- ✅ Member terhubung dengan referral
- ✅ Referral tercatat di profil member

---

### TC-H03: Lihat Insentif Referral

**Langkah-langkah:**

1. **Navigasi ke Referrals**

2. **Klik salah satu referral**
   - Detail referral terbuka

3. **Klik tab "Insentif"**

4. **Verifikasi data insentif**
   - Daftar member yang menggunakan kode
   - Total insentif yang terkumpul
   - Riwayat pembayaran insentif

**Expected Result:**
- ✅ Daftar insentif tampil
- ✅ Kalkulasi insentif benar
- ✅ Bisa export data insentif

---

### TC-H04: Export Data Referral

**Langkah-langkah:**

1. **Navigasi ke Referrals**

2. **Klik "Export"**

3. **Pilih format**
   - Excel atau CSV

4. **Klik "Download"**

**Expected Result:**
- ✅ File terdownload
- ✅ Data lengkap dengan insentif


---

## Scenario I: Member Portal

### TC-I01: Login sebagai Member

**Langkah-langkah:**

1. **Buka halaman login**
   - URL: `http://localhost:3000/login`

2. **Login dengan akun member**
   - Email: `budi.santoso@example.com`
   - Password: `member123`

3. **Verifikasi redirect**
   - Redirect ke `/me/dashboard`
   - Tampilan khusus member

**Expected Result:**
- ✅ Login berhasil
- ✅ Dashboard member tampil
- ✅ Menu terbatas untuk member

---

### TC-I02: Lihat Dashboard Member

**Langkah-langkah:**

1. **Verifikasi tampilan dashboard**
   - Sisa voucher/sesi
   - Sesi mendatang
   - Riwayat singkat

2. **Verifikasi menu sidebar**
   - Dashboard
   - Sesi Saya
   - Voucher Saya
   - Invoice Saya
   - Profil

**Expected Result:**
- ✅ Informasi personal tampil
- ✅ Tidak ada akses ke data member lain

---

### TC-I03: Lihat Riwayat Sesi

**Langkah-langkah:**

1. **Klik menu "Sesi Saya"**
   - URL: `/me/sessions`

2. **Verifikasi daftar sesi**
   - Semua sesi terapi member
   - Status sesi (Scheduled, Completed)

3. **Klik salah satu sesi**
   - Detail sesi terbuka
   - Bisa lihat diagnosis, vital signs, foto

**Expected Result:**
- ✅ Riwayat sesi lengkap
- ✅ Detail sesi bisa diakses

---

### TC-I04: Lihat Voucher/Paket

**Langkah-langkah:**

1. **Klik menu "Voucher Saya"**
   - URL: `/me/vouchers`

2. **Verifikasi daftar paket**
   - Paket aktif dengan sisa sesi
   - Paket expired/cancelled

3. **Verifikasi informasi paket**
   - Nama paket
   - Sisa sesi
   - Tanggal expired

**Expected Result:**
- ✅ Semua paket member tampil
- ✅ Sisa sesi akurat

---

### TC-I05: Lihat Invoice

**Langkah-langkah:**

1. **Klik menu "Invoice Saya"**
   - URL: `/me/invoices`

2. **Verifikasi daftar invoice**
   - Semua invoice member
   - Status pembayaran

3. **Klik salah satu invoice**
   - Detail invoice terbuka

4. **Klik "Download PDF"**
   - File PDF terdownload

**Expected Result:**
- ✅ Daftar invoice lengkap
- ✅ PDF bisa didownload

---

### TC-I06: Edit Profil Member

**Langkah-langkah:**

1. **Klik menu "Profil"**
   - URL: `/me/profile`

2. **Verifikasi data profil**
   - Nama, email, telepon, alamat

3. **Klik "Edit"**
   - Form edit terbuka

4. **Ubah data yang diizinkan**
   - Telepon: ubah nomor
   - Alamat: ubah alamat

5. **Klik "Simpan"**

**Expected Result:**
- ✅ Data terupdate
- ✅ Email tidak bisa diubah
- ✅ Toast sukses muncul


---

## Scenario J: Super Admin Features

### TC-J01: Lihat Audit Logs

**Prasyarat:** Login sebagai Super Admin

**Langkah-langkah:**

1. **Login sebagai Super Admin**
   - Email: `superadmin@raho.id`
   - Password: `Sup3r4dM1n`

2. **Navigasi ke Admin > Audit Logs**
   - URL: `/admin/audit-logs`

3. **Verifikasi tampilan**
   - Daftar aktivitas sistem
   - Kolom: Waktu, User, Action, Resource, Detail

4. **Filter berdasarkan kriteria**
   - Filter by User
   - Filter by Action (CREATE, UPDATE, DELETE)
   - Filter by Date Range

**Expected Result:**
- ✅ Audit logs tampil lengkap
- ✅ Filter berfungsi
- ✅ Detail aktivitas bisa dilihat

---

### TC-J02: Kelola Master Products

**Langkah-langkah:**

1. **Navigasi ke Admin > Master Products**
   - URL: `/admin/master-products`

2. **Lihat daftar produk**
   - Semua master product tampil

3. **Tambah produk baru**
   - Klik "Tambah Produk"
   - Isi: Nama, SKU, Kategori, Unit, Harga
   - Simpan

4. **Edit produk**
   - Klik ikon edit
   - Ubah data
   - Simpan

5. **Toggle status produk**
   - Aktifkan/nonaktifkan produk

**Expected Result:**
- ✅ CRUD master product berfungsi
- ✅ Produk tersedia untuk inventory

---

### TC-J03: Kelola Package Pricing

**Langkah-langkah:**

1. **Navigasi ke Admin > Kelola Harga Paket**
   - URL: `/admin/package-pricing`

2. **Tab Paket Terapi (BASIC)**
   - Lihat daftar harga paket BASIC
   - Tambah/edit/hapus harga

3. **Tab Booster Matrix**
   - Lihat matrix harga booster
   - Set harga per kombinasi (Booster x Layanan)

4. **Tab Add-on**
   - Kelola produk add-on (Air Nano, Rokok Kenkou)

5. **Tab Master Data**
   - Kelola tipe booster dan tipe layanan

**Expected Result:**
- ✅ Semua tab berfungsi
- ✅ Harga tersimpan dan digunakan saat assign paket

---

### TC-J04: Impersonation (Super Admin ke Admin Cabang)

**Langkah-langkah:**

1. **Navigasi ke Admin > Super Admin**
   - URL: `/admin/super-admin`

2. **Cari user Admin Cabang**
   - Filter role: ADMIN_CABANG

3. **Klik "Impersonate"**
   - Konfirmasi dialog

4. **Verifikasi impersonation**
   - Header menunjukkan "Impersonating: [nama user]"
   - Akses terbatas sesuai role target

5. **Klik "Stop Impersonation"**
   - Kembali ke akun Super Admin

**Expected Result:**
- ✅ Bisa login sebagai user lain
- ✅ Akses sesuai role target
- ✅ Bisa kembali ke akun asli

---

### TC-J05: Lihat Branch Performance

**Langkah-langkah:**

1. **Navigasi ke Dashboard**

2. **Verifikasi statistik semua cabang**
   - Total member per cabang
   - Total revenue per cabang
   - Total sesi per cabang

3. **Klik salah satu cabang**
   - Detail performa cabang

**Expected Result:**
- ✅ Perbandingan performa antar cabang
- ✅ Data akurat dan real-time


---

## Scenario K: Export Data

### TC-K01: Export Member - Quick Export

**Prasyarat:** Login sebagai Admin dengan akses export

**Langkah-langkah:**

1. **Navigasi ke Members**
   - URL: `/members`

2. **Klik "Export Data"**
   - Modal export terbuka

3. **Pilih tab "Quick Export"**

4. **Pilih preset "Ringkasan"**
   - Kolom: No. Member, Nama, Telepon, Email, Cabang, Status

5. **Klik "Export"**

**Expected Result:**
- ✅ File Excel terdownload
- ✅ Data sesuai preset

---

### TC-K02: Export Member - Custom Export

**Langkah-langkah:**

1. **Buka modal export**

2. **Pilih tab "Custom Export"**

3. **Pilih kolom yang diinginkan**
   - Centang: Nama, Email, Telepon, Tanggal Registrasi
   - Centang: Total Sesi, Sesi Selesai

4. **Set filter**
   - Cabang: Jakarta
   - Tanggal: 1 bulan terakhir

5. **Set grouping**
   - Kelompokkan berdasarkan: Status
   - Centang: Tampilkan Subtotal

6. **Klik "Export"**

**Expected Result:**
- ✅ Data dikelompokkan per status
- ✅ Subtotal per grup
- ✅ Grand total di akhir

---

### TC-K03: Export Sessions

**Langkah-langkah:**

1. **Navigasi ke Sessions**

2. **Set filter**
   - Tanggal: range tertentu
   - Status: COMPLETED

3. **Klik "Export"**

4. **Pilih format**
   - Excel atau CSV

**Expected Result:**
- ✅ Data sesi terexport
- ✅ Sesuai filter yang aktif

---

### TC-K04: Export Referral dengan Insentif

**Langkah-langkah:**

1. **Navigasi ke Referrals**

2. **Klik "Export"**

3. **Pilih opsi**
   - Include insentif: Ya
   - Format: Excel

4. **Klik "Download"**

**Expected Result:**
- ✅ Data referral lengkap
- ✅ Kolom insentif termasuk


---

## Checklist Testing

### Authentication & Authorization
- [ ] TC-A01: Login Super Admin
- [ ] TC-A02: Login Admin Cabang
- [ ] TC-A03: Login dengan kredensial salah
- [ ] Logout berfungsi
- [ ] Session timeout berfungsi

### Member Management
- [ ] TC-B01: Registrasi member lengkap
- [ ] TC-B02: Validasi form registrasi
- [ ] Search member berfungsi
- [ ] Filter member berfungsi
- [ ] Edit member berfungsi

### Package Management
- [ ] TC-C01: Assign paket BASIC
- [ ] TC-C02: Assign paket BOOSTER
- [ ] TC-C03: Bundle multiple paket
- [ ] Edit paket PENDING_PAYMENT
- [ ] Cancel paket

### Payment Verification
- [ ] TC-D01: Upload bukti pembayaran
- [ ] TC-D02: Verifikasi pembayaran
- [ ] TC-D03: Tolak pembayaran
- [ ] Invoice ter-generate

### Session Management
- [ ] TC-E01: Buat sesi terapi
- [ ] TC-E02: Validasi member tanpa paket
- [ ] TC-F01-F08: 8 step workflow
- [ ] TC-F09: Complete session

### Inventory
- [ ] TC-G01: Lihat stock
- [ ] TC-G02: Buat stock request
- [ ] TC-G03: Approve request
- [ ] TC-G04: Upload bukti bayar
- [ ] TC-G05: Buat shipment
- [ ] TC-G06: Terima shipment

### Referral
- [ ] TC-H01: Buat kode referral
- [ ] TC-H02: Gunakan kode referral
- [ ] TC-H03: Lihat insentif
- [ ] TC-H04: Export referral

### Member Portal
- [ ] TC-I01: Login member
- [ ] TC-I02: Dashboard member
- [ ] TC-I03: Riwayat sesi
- [ ] TC-I04: Voucher/paket
- [ ] TC-I05: Invoice
- [ ] TC-I06: Edit profil

### Super Admin
- [ ] TC-J01: Audit logs
- [ ] TC-J02: Master products
- [ ] TC-J03: Package pricing
- [ ] TC-J04: Impersonation
- [ ] TC-J05: Branch performance

### Export
- [ ] TC-K01: Quick export member
- [ ] TC-K02: Custom export member
- [ ] TC-K03: Export sessions
- [ ] TC-K04: Export referral

---

## Catatan Penting

### Browser yang Didukung
- Chrome (recommended)
- Firefox
- Safari
- Edge

### Tips Testing
1. Selalu clear cache sebelum testing
2. Gunakan DevTools (F12) untuk melihat error
3. Screenshot setiap error yang ditemukan
4. Catat langkah reproduksi bug

### Format Laporan Bug
```
[TC-XXX] Judul Test Case
- Langkah yang dilakukan: ...
- Expected result: ...
- Actual result: ...
- Screenshot: (lampirkan)
- Browser/Device: ...
- Severity: Critical/High/Medium/Low
```

### Environment URLs
- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- MinIO Console: http://localhost:9001

---

**Dokumen ini terakhir diupdate**: 26 Mei 2026  
**Versi**: 3.0  
**Author**: [JPK](https://github.com/Etherlyvan "Jovan Prabowo Kuncoro")

<!-- 
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║   🥚 You found the easter egg!                           ║
    ║                                                          ║
    ║   Made with ❤️ by Jovan Prabowo Kuncoro                  ║
    ║   https://github.com/Etherlyvan                          ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
-->
