# Test Scenario: Kelola Harga Paket & Add-on

**Versi**: 2.0  
**Tanggal**: 26 Mei 2026  
**Fitur**: Package Pricing Management  
**URL**: `http://localhost:3000/admin/package-pricing`

---

## Daftar Isi

1. [Persiapan Sebelum Testing](#persiapan-sebelum-testing)
2. [Akun Test & Kredensial](#akun-test--kredensial)
3. [Section A: Access Control](#section-a-access-control)
4. [Section B: Tab Paket Terapi (BASIC)](#section-b-tab-paket-terapi-basic)
5. [Section C: Tab Booster Matrix](#section-c-tab-booster-matrix)
6. [Section D: Tab Add-on](#section-d-tab-add-on)
7. [Section E: Tab Master Data](#section-e-tab-master-data)
8. [Section F: Validasi & Error Handling](#section-f-validasi--error-handling)
9. [Section G: UI/UX Testing](#section-g-uiux-testing)
10. [Section H: Integration Testing](#section-h-integration-testing)

---

## Persiapan Sebelum Testing

### 1. Jalankan Server

**Terminal 1 - API Server:**
```bash
cd apps/api
npm run dev
```
Tunggu sampai muncul: `Server running on port 3001`

**Terminal 2 - Web Server:**
```bash
cd apps/web
npm run dev
```
Tunggu sampai muncul: `Ready on http://localhost:3000`

### 2. Pastikan Database Sudah Di-seed
```bash
cd apps/api
npm run db:seed
```

### 3. Buka Browser
- URL: `http://localhost:3000/login`
- Browser: Chrome/Firefox terbaru
- Buka DevTools (F12) → Tab Console untuk melihat error

---

## Akun Test & Kredensial

| No | Role | Email | Password | Cabang Akses |
|----|------|-------|----------|--------------|
| 1 | SUPER_ADMIN | `superadmin@raho.id` | `SuP3r4Dm1n` | Semua Cabang |
| 2 | ADMIN_MANAGER | `manager1@raho.id` | `Manager@123` | PST (Jakarta), BDG (Bandung) |
| 3 | ADMIN_MANAGER | `manager2@raho.id` | `Manager@123` | SBY (Surabaya), PST (Jakarta) |
| 4 | ADMIN_CABANG | `admincabang.pst@raho.id` | `AdminCabang@123` | PST (Jakarta) |
| 5 | ADMIN_CABANG | `admincabang.bdg@raho.id` | `AdminCabang@123` | BDG (Bandung) |
| 6 | ADMIN_CABANG | `admincabang.sby@raho.id` | `AdminCabang@123` | SBY (Surabaya) |
| 7 | ADMIN_LAYANAN | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | PST (Jakarta) |
| 8 | DOCTOR | `dokter@raho.id` | `Dokter@123` | PST (Jakarta) |
| 9 | NURSE | `nakes@raho.id` | `Nakes@123` | PST (Jakarta) |

### Informasi Cabang

| Kode | Nama Cabang | Tipe |
|------|-------------|------|
| PST | RAHO Premier Jakarta | PREMIER |
| BDG | RAHO Partnership Bandung | PARTNERSHIP |
| SBY | RAHO Premier Surabaya | PREMIER |

---

## Section A: Access Control

### TC-A01: SUPER_ADMIN Dapat Mengakses Semua Tab

**Tujuan:** Memastikan SUPER_ADMIN memiliki akses penuh ke semua tab

**Langkah-langkah:**

1. **Buka halaman login**
   - Buka browser
   - Ketik URL: `http://localhost:3000/login`
   - Tekan Enter

2. **Login sebagai SUPER_ADMIN**
   - Pada field "Email", ketik: `superadmin@raho.id`
   - Pada field "Password", ketik: `SuP3r4Dm1n`
   - Klik tombol "Masuk"

3. **Navigasi ke halaman Package Pricing**
   - Pada sidebar kiri, klik menu "Admin"
   - Klik submenu "Kelola Harga Paket"
   - Atau langsung akses: `http://localhost:3000/admin/package-pricing`

4. **Verifikasi tampilan tab**
   - Lihat bagian atas halaman (di bawah judul)
   - Pastikan ada 4 tab: "Paket Terapi", "Booster Matrix", "Add-on", "Master Data"

5. **Test akses setiap tab**
   - Klik tab "Paket Terapi" → Pastikan tabel paket muncul
   - Klik tab "Booster Matrix" → Pastikan matrix booster muncul
   - Klik tab "Add-on" → Pastikan daftar add-on muncul
   - Klik tab "Master Data" → Pastikan form master data muncul

**Expected Result:**
- ✅ Semua 4 tab terlihat dan dapat diklik
- ✅ Setiap tab menampilkan konten yang sesuai
- ✅ Tombol "Tambah" tersedia di setiap tab

---

### TC-A02: ADMIN_MANAGER Tidak Dapat Mengakses Tab Master Data

**Tujuan:** Memastikan ADMIN_MANAGER tidak memiliki akses ke tab Master Data

**Langkah-langkah:**

1. **Logout dari akun sebelumnya (jika ada)**
   - Klik avatar/nama di pojok kanan atas
   - Klik "Logout"

2. **Login sebagai ADMIN_MANAGER**
   - Pada field "Email", ketik: `manager1@raho.id`
   - Pada field "Password", ketik: `Manager@123`
   - Klik tombol "Masuk"

3. **Navigasi ke halaman Package Pricing**
   - Pada sidebar kiri, klik menu "Admin"
   - Klik submenu "Kelola Harga Paket"

4. **Verifikasi tampilan tab**
   - Lihat bagian atas halaman
   - Hitung jumlah tab yang tersedia

**Expected Result:**
- ✅ Hanya ada 3 tab: "Paket Terapi", "Booster Matrix", "Add-on"
- ✅ Tab "Master Data" TIDAK terlihat
- ✅ Tombol "Tambah" tersedia di tab Paket Terapi, Booster Matrix, dan Add-on

---

### TC-A03: ADMIN_CABANG Tidak Dapat CRUD Add-on (View Only)

**Tujuan:** Memastikan ADMIN_CABANG hanya bisa melihat Add-on tanpa bisa menambah/edit/hapus

**Langkah-langkah:**

1. **Logout dari akun sebelumnya**
   - Klik avatar/nama di pojok kanan atas
   - Klik "Logout"

2. **Login sebagai ADMIN_CABANG**
   - Pada field "Email", ketik: `admincabang.pst@raho.id`
   - Pada field "Password", ketik: `AdminCabang@123`
   - Klik tombol "Masuk"

3. **Navigasi ke halaman Package Pricing**
   - Pada sidebar kiri, klik menu "Admin"
   - Klik submenu "Kelola Harga Paket"

4. **Verifikasi tab yang tersedia**
   - Pastikan ada 4 tab: "Paket Terapi", "Booster Matrix", "Add-on", "Master Data"

5. **Klik tab "Add-on"**
   - Klik tab "Add-on"
   - Perhatikan tampilan halaman

6. **Verifikasi tidak ada tombol CRUD**
   - Pastikan TIDAK ada tombol "Tambah Add-on" di pojok kanan atas
   - Pada setiap baris add-on, pastikan TIDAK ada tombol Edit (ikon pensil)
   - Pastikan TIDAK ada tombol Delete (ikon tempat sampah)
   - Pastikan TIDAK ada tombol Toggle Active/Inactive

**Expected Result:**
- ✅ Tab Add-on dapat diakses
- ✅ Daftar add-on ditampilkan (view only)
- ✅ TIDAK ada tombol "Tambah Add-on"
- ✅ TIDAK ada tombol Edit, Delete, atau Toggle pada setiap baris

---

### TC-A04: ADMIN_LAYANAN/DOCTOR/NURSE Tidak Dapat Mengakses Halaman

**Tujuan:** Memastikan role non-admin tidak dapat mengakses halaman Package Pricing

**Langkah-langkah:**

1. **Logout dari akun sebelumnya**
   - Klik avatar/nama di pojok kanan atas
   - Klik "Logout"

2. **Login sebagai ADMIN_LAYANAN**
   - Pada field "Email", ketik: `adminlayanan.pst@raho.id`
   - Pada field "Password", ketik: `AdminLayanan@123`
   - Klik tombol "Masuk"

3. **Coba akses halaman Package Pricing secara langsung**
   - Pada address bar browser, ketik: `http://localhost:3000/admin/package-pricing`
   - Tekan Enter

4. **Verifikasi halaman ditolak**
   - Perhatikan tampilan yang muncul

5. **Ulangi untuk DOCTOR**
   - Logout
   - Login dengan: `dokter@raho.id` / `Dokter@123`
   - Akses: `http://localhost:3000/admin/package-pricing`
   - Verifikasi ditolak

6. **Ulangi untuk NURSE**
   - Logout
   - Login dengan: `nakes@raho.id` / `Nakes@123`
   - Akses: `http://localhost:3000/admin/package-pricing`
   - Verifikasi ditolak

**Expected Result:**
- ✅ Muncul halaman "Akses Ditolak" dengan ikon gembok merah
- ✅ Pesan: "Anda tidak memiliki akses ke halaman ini"
- ✅ Tidak ada tab atau konten package pricing yang terlihat

---

## Section B: Tab Paket Terapi (BASIC)

### TC-B01: Melihat Daftar Paket Terapi

**Tujuan:** Memastikan daftar paket terapi ditampilkan dengan benar

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN**
   - Email: `superadmin@raho.id`
   - Password: `SuP3r4Dm1n`

2. **Navigasi ke Package Pricing**
   - Sidebar → Admin → Kelola Harga Paket

3. **Pastikan tab "Paket Terapi" aktif**
   - Tab "Paket Terapi" harus sudah terpilih (highlight)
   - Jika tidak, klik tab "Paket Terapi"

4. **Verifikasi tampilan tabel**
   - Perhatikan kolom-kolom yang ada:
     - Nama Paket
     - Kode Produk
     - Jumlah Sesi
     - Harga
     - Cabang
     - Status
     - Aksi

5. **Verifikasi filter cabang**
   - Di pojok kanan atas, ada dropdown "Semua Cabang"
   - Klik dropdown tersebut
   - Pastikan ada opsi: "Semua Cabang", "Global", dan nama-nama cabang

**Expected Result:**
- ✅ Tabel paket terapi ditampilkan
- ✅ Kolom lengkap sesuai spesifikasi
- ✅ Filter cabang berfungsi
- ✅ Data paket terapi muncul (jika sudah ada di database)

---

### TC-B02: Menambah Paket Terapi BASIC Baru (Global)

**Tujuan:** Memastikan dapat menambah paket terapi BASIC yang berlaku untuk semua cabang

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)
   - Email: `superadmin@raho.id`
   - Password: `SuP3r4Dm1n`

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Klik tombol "Tambah Paket"**
   - Tombol berwarna kuning/amber di pojok kanan atas
   - Klik tombol tersebut

4. **Isi form modal yang muncul**
   - **Tipe Paket**: Pilih "BASIC" (default)
   - **Nama Paket**: Ketik `Paket Basic Test 7 Sesi`
   - **Kode Produk**: Ketik `PKT-BASIC-TEST-7`
   - **Jumlah Sesi**: Ketik `7`
   - **Harga**: Ketik `7000000` (7 juta)
   - **Cabang**: Biarkan kosong (untuk Global)
   - **Status**: Pastikan toggle "Aktif" dalam keadaan ON

5. **Klik tombol "Simpan"**
   - Tombol berwarna kuning/amber di bagian bawah modal

6. **Verifikasi hasil**
   - Modal tertutup otomatis
   - Muncul toast notification "Harga paket berhasil ditambahkan"
   - Paket baru muncul di tabel dengan label "Global"

**Expected Result:**
- ✅ Modal form terbuka dengan benar
- ✅ Semua field dapat diisi
- ✅ Data tersimpan dengan sukses
- ✅ Toast sukses muncul
- ✅ Paket baru terlihat di tabel dengan status "Global"

---

### TC-B03: Menambah Paket Terapi BASIC untuk Cabang Tertentu

**Tujuan:** Memastikan dapat menambah paket terapi khusus untuk satu cabang

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Klik tombol "Tambah Paket"**

4. **Isi form modal**
   - **Tipe Paket**: Pilih "BASIC"
   - **Nama Paket**: Ketik `Paket Premium Jakarta 10 Sesi`
   - **Kode Produk**: Ketik `PKT-PREM-PST-10`
   - **Jumlah Sesi**: Ketik `10`
   - **Harga**: Ketik `12000000` (12 juta)
   - **Cabang**: Klik dropdown, pilih "PST - RAHO Premier Jakarta"
   - **Status**: Pastikan toggle "Aktif" ON

5. **Klik tombol "Simpan"**

6. **Verifikasi hasil**
   - Paket baru muncul di tabel
   - Kolom "Cabang" menunjukkan "PST" atau "RAHO Premier Jakarta"

7. **Filter berdasarkan cabang**
   - Klik dropdown filter "Semua Cabang"
   - Pilih "PST - RAHO Premier Jakarta"
   - Pastikan paket yang baru dibuat muncul

**Expected Result:**
- ✅ Paket tersimpan dengan cabang PST
- ✅ Filter cabang menampilkan paket dengan benar
- ✅ Paket tidak muncul saat filter cabang lain dipilih

---

### TC-B04: Edit Paket Terapi yang Sudah Ada

**Tujuan:** Memastikan dapat mengedit paket terapi yang sudah ada

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Cari paket yang ingin diedit**
   - Gunakan filter cabang jika perlu
   - Temukan paket "Paket Basic Test 7 Sesi" (yang dibuat di TC-B02)

4. **Klik tombol Edit**
   - Pada baris paket tersebut, klik ikon pensil (Edit) di kolom Aksi

5. **Modal edit terbuka**
   - Verifikasi data yang ada sudah terisi di form
   - Nama Paket: "Paket Basic Test 7 Sesi"
   - Harga: 7000000

6. **Ubah data**
   - **Nama Paket**: Ubah menjadi `Paket Basic Test 7 Sesi (Updated)`
   - **Harga**: Ubah menjadi `7500000` (7.5 juta)

7. **Klik tombol "Simpan"**

8. **Verifikasi hasil**
   - Modal tertutup
   - Toast "Harga paket berhasil diupdate" muncul
   - Data di tabel sudah berubah sesuai edit

**Expected Result:**
- ✅ Modal edit menampilkan data existing
- ✅ Perubahan tersimpan dengan sukses
- ✅ Data di tabel terupdate

---

### TC-B05: Toggle Status Aktif/Nonaktif Paket

**Tujuan:** Memastikan dapat mengaktifkan/menonaktifkan paket

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Cari paket yang statusnya "Aktif"**
   - Lihat kolom Status, cari yang bertuliskan "Aktif" (badge hijau)

4. **Klik tombol Toggle**
   - Pada baris paket tersebut, klik ikon gembok (Lock/Unlock) di kolom Aksi
   - Atau klik badge status "Aktif"

5. **Verifikasi perubahan**
   - Toast "Harga paket berhasil dinonaktifkan" muncul
   - Status berubah menjadi "Nonaktif" (badge merah/abu-abu)

6. **Klik toggle lagi untuk mengaktifkan kembali**
   - Klik ikon yang sama
   - Toast "Harga paket berhasil diaktifkan" muncul
   - Status kembali menjadi "Aktif"

**Expected Result:**
- ✅ Status dapat di-toggle antara Aktif dan Nonaktif
- ✅ Toast notification sesuai dengan aksi
- ✅ Tampilan badge status berubah sesuai

---

### TC-B06: Hapus Paket Terapi

**Tujuan:** Memastikan dapat menghapus paket terapi

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Cari paket yang ingin dihapus**
   - Temukan paket test yang dibuat sebelumnya

4. **Klik tombol Delete**
   - Pada baris paket tersebut, klik ikon tempat sampah (Delete) di kolom Aksi

5. **Konfirmasi dialog muncul**
   - Browser menampilkan dialog konfirmasi: "Yakin ingin menghapus harga paket ini?"

6. **Klik "OK" untuk konfirmasi**

7. **Verifikasi hasil**
   - Toast "Harga paket berhasil dihapus" muncul
   - Paket tidak lagi muncul di tabel

**Expected Result:**
- ✅ Dialog konfirmasi muncul sebelum hapus
- ✅ Paket terhapus setelah konfirmasi
- ✅ Toast sukses muncul
- ✅ Paket tidak lagi ada di tabel

---

### TC-B07: ADMIN_MANAGER Hanya Melihat Cabang yang Dikelola

**Tujuan:** Memastikan ADMIN_MANAGER hanya melihat paket dari cabang yang dikelolanya

**Langkah-langkah:**

1. **Logout dari akun sebelumnya**

2. **Login sebagai ADMIN_MANAGER (Manager 1)**
   - Email: `manager1@raho.id`
   - Password: `Manager@123`
   - (Manager 1 mengelola: PST Jakarta & BDG Bandung)

3. **Navigasi ke Package Pricing → Tab Paket Terapi**

4. **Verifikasi filter cabang**
   - Klik dropdown filter cabang
   - Pastikan hanya ada opsi:
     - "Semua Cabang" (menampilkan PST + BDG)
     - "Global"
     - "PST - RAHO Premier Jakarta"
     - "BDG - RAHO Partnership Bandung"
   - Pastikan TIDAK ada opsi "SBY - RAHO Premier Surabaya"

5. **Verifikasi data yang ditampilkan**
   - Pilih "Semua Cabang"
   - Pastikan hanya paket dari PST, BDG, dan Global yang muncul
   - Paket khusus SBY tidak boleh muncul

**Expected Result:**
- ✅ Filter hanya menampilkan cabang yang dikelola (PST, BDG)
- ✅ Data paket hanya dari cabang yang dikelola + Global
- ✅ Tidak ada data dari cabang SBY

---

## Section C: Tab Booster Matrix

### TC-C01: Melihat Booster Matrix

**Tujuan:** Memastikan tampilan matrix booster ditampilkan dengan benar

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN**
   - Email: `superadmin@raho.id`
   - Password: `SuP3r4Dm1n`

2. **Navigasi ke Package Pricing**
   - Sidebar → Admin → Kelola Harga Paket

3. **Klik tab "Booster Matrix"**
   - Tab kedua dari kiri

4. **Verifikasi tampilan matrix**
   - Lihat struktur matrix:
     - Baris: Tipe Booster (NO, GT, MB, KCL, H2S, HK, O3, HHO, NO2)
     - Kolom: Tipe Layanan (PM, PS, PTY, PDA, PHC)
   - Setiap sel menunjukkan harga atau "-" jika belum ada

5. **Verifikasi filter cabang**
   - Di pojok kanan atas, ada dropdown filter cabang
   - Pilih cabang tertentu untuk melihat harga khusus cabang tersebut

**Expected Result:**
- ✅ Matrix booster ditampilkan dalam format grid
- ✅ Tipe booster sebagai baris
- ✅ Tipe layanan sebagai kolom
- ✅ Harga ditampilkan di setiap sel yang sudah ada datanya
- ✅ Filter cabang berfungsi

---

### TC-C02: Menambah Harga Booster Satuan

**Tujuan:** Memastikan dapat menambah harga booster untuk kombinasi tertentu

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Booster Matrix**

3. **Klik tombol "Tambah Paket"**
   - Tombol di pojok kanan atas

4. **Isi form modal**
   - **Tipe Paket**: Pilih "BOOSTER"
   - **Tipe Booster**: Pilih "NO" (Nitric Oxide)
   - **Tipe Layanan**: Pilih "PM" (Premier)
   - **Nama Paket**: Ketik `Booster NO 1X - PM`
   - **Kode Produk**: Ketik `BST-NO-1X-PM`
   - **Jumlah Sesi**: Ketik `1`
   - **Harga**: Ketik `500000` (500 ribu)
   - **Cabang**: Biarkan kosong (Global)
   - **Status**: Aktif

5. **Klik tombol "Simpan"**

6. **Verifikasi hasil**
   - Toast sukses muncul
   - Di matrix, sel NO x PM sekarang menampilkan harga Rp 500.000

**Expected Result:**
- ✅ Form booster memiliki field Tipe Booster dan Tipe Layanan
- ✅ Data tersimpan dengan sukses
- ✅ Harga muncul di matrix pada posisi yang benar

---

### TC-C03: Bulk Create Booster (Generate Semua Tipe Layanan)

**Tujuan:** Memastikan fitur bulk create dapat membuat semua kombinasi booster sekaligus

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Booster Matrix**

3. **Pilih filter cabang**
   - Pilih "Global" atau cabang tertentu

4. **Cari baris booster yang belum lengkap**
   - Misalnya baris "GT" (Gasotransmitter) yang masih ada sel kosong "-"

5. **Klik tombol "Generate" pada baris tersebut**
   - Tombol kecil di sebelah kanan nama booster
   - Atau klik ikon "+" di baris tersebut

6. **Konfirmasi dialog muncul**
   - Dialog: "Buat X harga booster GT (Global)?"
   - X = jumlah tipe layanan yang belum ada

7. **Klik "OK" untuk konfirmasi**

8. **Verifikasi hasil**
   - Toast sukses: "Berhasil membuat X harga booster"
   - Semua sel di baris GT sekarang terisi harga
   - Harga default diambil dari Master Service Type

**Expected Result:**
- ✅ Bulk create membuat semua kombinasi yang belum ada
- ✅ Harga default sesuai dengan Master Service Type
- ✅ Nama paket otomatis: "Booster [KODE] 1X - [LAYANAN]"

---

### TC-C04: Edit Harga Booster dari Matrix

**Tujuan:** Memastikan dapat mengedit harga booster langsung dari matrix

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Booster Matrix**

3. **Klik sel harga yang ingin diedit**
   - Misalnya sel NO x PM yang sudah ada harganya
   - Klik pada angka harga tersebut

4. **Modal edit terbuka**
   - Verifikasi data existing terisi di form

5. **Ubah harga**
   - **Harga**: Ubah menjadi `550000` (550 ribu)

6. **Klik tombol "Simpan"**

7. **Verifikasi hasil**
   - Toast sukses muncul
   - Harga di matrix terupdate menjadi Rp 550.000

**Expected Result:**
- ✅ Klik sel membuka modal edit
- ✅ Data existing terisi di form
- ✅ Perubahan tersimpan dan ditampilkan di matrix

---

### TC-C05: Booster Matrix per Cabang

**Tujuan:** Memastikan setiap cabang dapat memiliki harga booster berbeda

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Booster Matrix**

3. **Pilih filter "PST - RAHO Premier Jakarta"**

4. **Tambah harga booster khusus PST**
   - Klik "Tambah Paket"
   - Tipe Paket: BOOSTER
   - Tipe Booster: NO
   - Tipe Layanan: PM
   - Nama: `Booster NO 1X - PM (PST)`
   - Harga: `600000` (lebih mahal dari Global)
   - Cabang: PST - RAHO Premier Jakarta
   - Simpan

5. **Verifikasi di filter PST**
   - Harga NO x PM menunjukkan Rp 600.000

6. **Ganti filter ke "Global"**
   - Harga NO x PM menunjukkan Rp 500.000 (atau harga global)

7. **Ganti filter ke "BDG - RAHO Partnership Bandung"**
   - Jika tidak ada harga khusus BDG, sel menunjukkan "-" atau harga global

**Expected Result:**
- ✅ Setiap cabang dapat memiliki harga berbeda
- ✅ Filter cabang menampilkan harga yang sesuai
- ✅ Harga cabang override harga global

---

### TC-C06: Validasi Duplikat Booster

**Tujuan:** Memastikan tidak bisa membuat booster duplikat (kombinasi sama)

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Booster Matrix**

3. **Coba tambah booster yang sudah ada**
   - Klik "Tambah Paket"
   - Tipe Paket: BOOSTER
   - Tipe Booster: NO (yang sudah ada)
   - Tipe Layanan: PM (yang sudah ada)
   - Cabang: Global (atau cabang yang sudah ada kombinasinya)
   - Isi field lainnya
   - Klik Simpan

4. **Verifikasi error**
   - Toast error muncul: "Harga paket dengan kombinasi ini sudah ada"
   - Data tidak tersimpan

**Expected Result:**
- ✅ Sistem menolak duplikat
- ✅ Pesan error yang jelas
- ✅ Data tidak tersimpan

---

## Section D: Tab Add-on

### TC-D01: Melihat Daftar Add-on

**Tujuan:** Memastikan daftar add-on ditampilkan dengan benar

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN**
   - Email: `superadmin@raho.id`
   - Password: `SuP3r4Dm1n`

2. **Navigasi ke Package Pricing → Tab Add-on**
   - Klik tab "Add-on" (tab ketiga)

3. **Verifikasi tampilan**
   - Daftar add-on ditampilkan dalam bentuk card atau tabel
   - Setiap add-on menampilkan:
     - Kode Produk
     - Nama Produk
     - Tipe (AIR_NANO atau ROKOK_KENKOU)
     - Harga per Unit
     - Status (Aktif/Nonaktif)

4. **Verifikasi kategori add-on**
   - Ada 2 kategori: Air Nano dan Rokok Kenkou
   - Air Nano memiliki variasi: Warna, Volume, Unit

**Expected Result:**
- ✅ Daftar add-on ditampilkan
- ✅ Informasi lengkap untuk setiap add-on
- ✅ Kategori terpisah dengan jelas

---

### TC-D02: Menambah Add-on Air Nano

**Tujuan:** Memastikan dapat menambah produk Air Nano dengan semua variasinya

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Add-on**

3. **Klik tombol "Tambah Add-on"**

4. **Isi form modal**
   - **Kode Produk**: Ketik `AN-KNG-600-BTL`
   - **Tipe Produk**: Pilih "AIR_NANO"
   - **Nama Produk**: Ketik `Air Nano Kuning 600ml Botol`
   - **Deskripsi**: Ketik `Air nano warna kuning kemasan botol 600ml`
   - **Harga per Unit**: Ketik `150000`
   - **Warna**: Pilih "KUNING"
   - **Volume**: Pilih "600 ML"
   - **Unit**: Pilih "BOTOL"
   - **Status**: Aktif

5. **Klik tombol "Simpan"**

6. **Verifikasi hasil**
   - Toast sukses muncul
   - Add-on baru muncul di daftar dengan semua detail

**Expected Result:**
- ✅ Form Air Nano memiliki field tambahan (Warna, Volume, Unit)
- ✅ Data tersimpan dengan sukses
- ✅ Add-on muncul di daftar dengan informasi lengkap

---

### TC-D03: Menambah Add-on Rokok Kenkou

**Tujuan:** Memastikan dapat menambah produk Rokok Kenkou

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Add-on**

3. **Klik tombol "Tambah Add-on"**

4. **Isi form modal**
   - **Kode Produk**: Ketik `RK-MILD-001`
   - **Tipe Produk**: Pilih "ROKOK_KENKOU"
   - **Nama Produk**: Ketik `Rokok Kenkou Mild`
   - **Deskripsi**: Ketik `Rokok herbal kenkou varian mild`
   - **Harga per Unit**: Ketik `50000`
   - **Status**: Aktif

5. **Verifikasi field Air Nano tidak muncul**
   - Field Warna, Volume, Unit tidak ditampilkan untuk Rokok Kenkou

6. **Klik tombol "Simpan"**

7. **Verifikasi hasil**
   - Toast sukses muncul
   - Add-on Rokok Kenkou muncul di daftar

**Expected Result:**
- ✅ Form Rokok Kenkou tidak memiliki field Warna/Volume/Unit
- ✅ Data tersimpan dengan sukses
- ✅ Add-on muncul di daftar

---

### TC-D04: Edit Add-on

**Tujuan:** Memastikan dapat mengedit add-on yang sudah ada

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Add-on**

3. **Cari add-on yang ingin diedit**
   - Temukan "Air Nano Kuning 600ml Botol" (yang dibuat di TC-D02)

4. **Klik tombol Edit**
   - Klik ikon pensil pada baris add-on tersebut

5. **Modal edit terbuka**
   - Verifikasi data existing terisi
   - Catatan: Kode Produk dan Tipe tidak bisa diubah

6. **Ubah data**
   - **Nama Produk**: Ubah menjadi `Air Nano Kuning 600ml Botol (Promo)`
   - **Harga per Unit**: Ubah menjadi `125000` (diskon)

7. **Klik tombol "Simpan"**

8. **Verifikasi hasil**
   - Toast sukses muncul
   - Data di daftar terupdate

**Expected Result:**
- ✅ Modal edit menampilkan data existing
- ✅ Kode Produk dan Tipe tidak bisa diubah (disabled)
- ✅ Perubahan tersimpan dengan sukses

---

### TC-D05: Toggle Status Add-on

**Tujuan:** Memastikan dapat mengaktifkan/menonaktifkan add-on

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Add-on**

3. **Cari add-on yang statusnya "Aktif"**

4. **Klik tombol Toggle**
   - Klik ikon gembok atau badge status

5. **Verifikasi perubahan**
   - Toast "Add-on berhasil dinonaktifkan" muncul
   - Status berubah menjadi "Nonaktif"

6. **Klik toggle lagi**
   - Status kembali menjadi "Aktif"

**Expected Result:**
- ✅ Status dapat di-toggle
- ✅ Toast notification sesuai
- ✅ Tampilan status berubah

---

### TC-D06: Hapus Add-on

**Tujuan:** Memastikan dapat menghapus add-on

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Add-on**

3. **Cari add-on yang ingin dihapus**
   - Temukan add-on test yang dibuat sebelumnya

4. **Klik tombol Delete**
   - Klik ikon tempat sampah

5. **Konfirmasi dialog muncul**
   - "Yakin ingin menghapus add-on ini?"

6. **Klik "OK"**

7. **Verifikasi hasil**
   - Toast sukses muncul
   - Add-on tidak lagi ada di daftar

**Expected Result:**
- ✅ Dialog konfirmasi muncul
- ✅ Add-on terhapus setelah konfirmasi
- ✅ Toast sukses muncul

---

### TC-D07: ADMIN_MANAGER Dapat CRUD Add-on

**Tujuan:** Memastikan ADMIN_MANAGER memiliki akses penuh ke Add-on

**Langkah-langkah:**

1. **Logout dari akun sebelumnya**

2. **Login sebagai ADMIN_MANAGER**
   - Email: `manager1@raho.id`
   - Password: `Manager@123`

3. **Navigasi ke Package Pricing → Tab Add-on**

4. **Verifikasi tombol CRUD tersedia**
   - Tombol "Tambah Add-on" ada di pojok kanan atas
   - Setiap baris add-on memiliki tombol Edit, Delete, Toggle

5. **Test tambah add-on**
   - Klik "Tambah Add-on"
   - Isi form dengan data test
   - Simpan
   - Verifikasi berhasil

6. **Test edit add-on**
   - Edit add-on yang baru dibuat
   - Verifikasi berhasil

7. **Test hapus add-on**
   - Hapus add-on test
   - Verifikasi berhasil

**Expected Result:**
- ✅ ADMIN_MANAGER dapat menambah add-on
- ✅ ADMIN_MANAGER dapat mengedit add-on
- ✅ ADMIN_MANAGER dapat menghapus add-on

---

## Section E: Tab Master Data

### TC-E01: Melihat Master Booster Types

**Tujuan:** Memastikan daftar master tipe booster ditampilkan dengan benar

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN**
   - Email: `superadmin@raho.id`
   - Password: `SuP3r4Dm1n`

2. **Navigasi ke Package Pricing → Tab Master Data**
   - Klik tab "Master Data" (tab keempat)

3. **Verifikasi sub-tab**
   - Ada 2 sub-tab: "Tipe Booster" dan "Tipe Layanan"
   - Default: "Tipe Booster" aktif

4. **Verifikasi tampilan tabel Tipe Booster**
   - Kolom: Kode, Nama, Icon, Deskripsi, Urutan, Status, Aksi
   - Data default: NO, GT, MB, KCL, H2S, HK, O3, HHO, NO2

**Expected Result:**
- ✅ Tab Master Data tersedia
- ✅ Sub-tab Tipe Booster dan Tipe Layanan ada
- ✅ Daftar tipe booster ditampilkan

---

### TC-E02: Menambah Master Booster Type

**Tujuan:** Memastikan dapat menambah tipe booster baru

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Master Data → Sub-tab Tipe Booster**

3. **Klik tombol "Tambah"**

4. **Isi form modal**
   - **Kode**: Ketik `TEST`
   - **Nama**: Ketik `Test Booster`
   - **Icon**: Ketik `⚡` (emoji atau kosongkan)
   - **Deskripsi**: Ketik `Booster untuk testing`
   - **Urutan**: Ketik `99`
   - **Status**: Aktif

5. **Klik tombol "Simpan"**

6. **Verifikasi hasil**
   - Toast sukses muncul
   - Tipe booster baru muncul di tabel

**Expected Result:**
- ✅ Form master booster dapat diisi
- ✅ Data tersimpan dengan sukses
- ✅ Tipe booster baru muncul di tabel

---

### TC-E03: Melihat Master Service Types

**Tujuan:** Memastikan daftar master tipe layanan ditampilkan dengan benar

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Master Data**

3. **Klik sub-tab "Tipe Layanan"**

4. **Verifikasi tampilan tabel**
   - Kolom: Kode, Nama, Harga Default, Deskripsi, Urutan, Status, Aksi
   - Data default: PM (Premier), PS (Partnership), PTY (Party), PDA (PDA), PHC (PHC)

**Expected Result:**
- ✅ Sub-tab Tipe Layanan dapat diklik
- ✅ Daftar tipe layanan ditampilkan
- ✅ Harga default terlihat untuk setiap tipe

---

### TC-E04: Menambah Master Service Type

**Tujuan:** Memastikan dapat menambah tipe layanan baru

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Master Data → Sub-tab Tipe Layanan**

3. **Klik tombol "Tambah"**

4. **Isi form modal**
   - **Kode**: Ketik `VIP`
   - **Nama**: Ketik `VIP Service`
   - **Harga Default**: Ketik `1000000`
   - **Deskripsi**: Ketik `Layanan VIP premium`
   - **Urutan**: Ketik `99`
   - **Status**: Aktif

5. **Klik tombol "Simpan"**

6. **Verifikasi hasil**
   - Toast sukses muncul
   - Tipe layanan baru muncul di tabel

**Expected Result:**
- ✅ Form master service type dapat diisi
- ✅ Harga default dapat diset
- ✅ Data tersimpan dengan sukses

---

### TC-E05: Edit Master Data

**Tujuan:** Memastikan dapat mengedit master data

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Master Data**

3. **Pilih sub-tab (Tipe Booster atau Tipe Layanan)**

4. **Klik tombol Edit pada salah satu baris**

5. **Modal edit terbuka**
   - Verifikasi data existing terisi
   - Catatan: Kode tidak bisa diubah

6. **Ubah data**
   - Ubah Nama atau Deskripsi

7. **Klik tombol "Simpan"**

8. **Verifikasi hasil**
   - Toast sukses muncul
   - Data terupdate di tabel

**Expected Result:**
- ✅ Modal edit menampilkan data existing
- ✅ Kode tidak bisa diubah (disabled)
- ✅ Perubahan tersimpan dengan sukses

---

### TC-E06: Toggle Status Master Data

**Tujuan:** Memastikan dapat mengaktifkan/menonaktifkan master data

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Master Data**

3. **Pilih sub-tab (Tipe Booster atau Tipe Layanan)**

4. **Klik tombol Toggle pada salah satu baris**

5. **Verifikasi perubahan**
   - Toast sukses muncul
   - Status berubah

6. **Verifikasi dampak di Booster Matrix**
   - Jika tipe booster dinonaktifkan, baris tersebut tidak muncul di matrix
   - Jika tipe layanan dinonaktifkan, kolom tersebut tidak muncul di matrix

**Expected Result:**
- ✅ Status dapat di-toggle
- ✅ Master data yang nonaktif tidak muncul di Booster Matrix

---

### TC-E07: Hapus Master Data

**Tujuan:** Memastikan dapat menghapus master data

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Master Data**

3. **Cari master data test yang dibuat sebelumnya**
   - Tipe Booster "TEST" atau Tipe Layanan "VIP"

4. **Klik tombol Delete**

5. **Konfirmasi dialog muncul**

6. **Klik "OK"**

7. **Verifikasi hasil**
   - Toast sukses muncul
   - Master data terhapus dari tabel

**Expected Result:**
- ✅ Dialog konfirmasi muncul
- ✅ Master data terhapus setelah konfirmasi
- ✅ Toast sukses muncul

---

## Section F: Validasi & Error Handling

### TC-F01: Validasi Field Wajib - Paket Terapi

**Tujuan:** Memastikan validasi field wajib berfungsi

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN**

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Klik tombol "Tambah Paket"**

4. **Langsung klik "Simpan" tanpa mengisi apapun**

5. **Verifikasi error**
   - Toast error: "Mohon lengkapi semua field dengan benar"
   - Modal tidak tertutup

6. **Isi hanya nama, kosongkan harga**
   - Nama: "Test"
   - Harga: 0 atau kosong
   - Klik Simpan

7. **Verifikasi validasi harga**
   - Sistem menerima harga 0 (gratis) atau menolak?
   - Dokumentasikan behavior

**Expected Result:**
- ✅ Validasi field wajib berfungsi
- ✅ Pesan error yang jelas
- ✅ Modal tidak tertutup jika ada error

---

### TC-F02: Validasi Field Wajib - Booster

**Tujuan:** Memastikan validasi khusus booster berfungsi

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Booster Matrix**

3. **Klik tombol "Tambah Paket"**

4. **Pilih Tipe Paket: BOOSTER**

5. **Isi nama dan harga, tapi JANGAN pilih Tipe Booster**
   - Nama: "Test Booster"
   - Harga: 500000
   - Tipe Booster: (kosong)
   - Klik Simpan

6. **Verifikasi error**
   - Toast error: "Tipe booster wajib diisi untuk paket BOOSTER"

7. **Pilih Tipe Booster, tapi JANGAN pilih Tipe Layanan**
   - Tipe Booster: NO
   - Tipe Layanan: (kosong)
   - Klik Simpan

8. **Verifikasi error**
   - Toast error: "Tipe layanan wajib diisi untuk paket BOOSTER"

**Expected Result:**
- ✅ Validasi Tipe Booster wajib untuk paket BOOSTER
- ✅ Validasi Tipe Layanan wajib untuk paket BOOSTER
- ✅ Pesan error spesifik

---

### TC-F03: Validasi Field Wajib - Air Nano

**Tujuan:** Memastikan validasi khusus Air Nano berfungsi

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Add-on**

3. **Klik tombol "Tambah Add-on"**

4. **Pilih Tipe Produk: AIR_NANO**

5. **Isi kode dan nama, tapi JANGAN pilih Warna**
   - Kode: "AN-TEST"
   - Nama: "Test Air Nano"
   - Harga: 100000
   - Warna: (kosong)
   - Klik Simpan

6. **Verifikasi error**
   - Toast error: "Untuk Air Nano, warna, volume, dan unit wajib diisi"

7. **Pilih Warna, tapi JANGAN pilih Volume**
   - Warna: KUNING
   - Volume: (kosong)
   - Klik Simpan

8. **Verifikasi error masih muncul**

**Expected Result:**
- ✅ Validasi Warna, Volume, Unit wajib untuk Air Nano
- ✅ Pesan error yang jelas

---

### TC-F04: Validasi Kode Produk Duplikat

**Tujuan:** Memastikan tidak bisa membuat kode produk duplikat

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Catat kode produk yang sudah ada**
   - Misalnya: "PKT-BASIC-7"

4. **Klik "Tambah Paket"**

5. **Isi form dengan kode produk yang sama**
   - Kode Produk: "PKT-BASIC-7" (yang sudah ada)
   - Isi field lainnya
   - Klik Simpan

6. **Verifikasi error**
   - Toast error: "Kode produk sudah digunakan" atau pesan serupa

**Expected Result:**
- ✅ Sistem menolak kode produk duplikat
- ✅ Pesan error yang jelas

---

### TC-F05: Validasi Input Numerik

**Tujuan:** Memastikan validasi input numerik berfungsi

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing → Tab Paket Terapi**

3. **Klik "Tambah Paket"**

4. **Coba input non-numerik di field Harga**
   - Harga: Ketik "abc" atau "100abc"
   - Perhatikan behavior field

5. **Coba input negatif di field Jumlah Sesi**
   - Jumlah Sesi: Ketik "-5"
   - Perhatikan behavior field

6. **Coba input desimal di field Jumlah Sesi**
   - Jumlah Sesi: Ketik "7.5"
   - Perhatikan behavior field

**Expected Result:**
- ✅ Field Harga hanya menerima angka
- ✅ Field Jumlah Sesi hanya menerima angka positif bulat
- ✅ Input invalid ditolak atau dikonversi

---

### TC-F06: Error Handling - Network Error

**Tujuan:** Memastikan error handling saat network bermasalah

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing**

3. **Buka DevTools (F12) → Tab Network**

4. **Set "Offline" mode**
   - Klik dropdown "No throttling"
   - Pilih "Offline"

5. **Coba refresh halaman atau klik tab lain**

6. **Verifikasi error handling**
   - Toast error muncul: "Gagal memuat data..." atau pesan serupa
   - Halaman tidak crash

7. **Kembalikan ke "Online"**
   - Pilih "No throttling"
   - Refresh halaman
   - Verifikasi data kembali normal

**Expected Result:**
- ✅ Error handling graceful saat offline
- ✅ Pesan error yang informatif
- ✅ Halaman tidak crash
- ✅ Recovery saat kembali online

---

## Section G: UI/UX Testing

### TC-G01: Responsive Design - Desktop

**Tujuan:** Memastikan tampilan optimal di desktop

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN**

2. **Navigasi ke Package Pricing**

3. **Set browser ke full screen (maximize)**

4. **Verifikasi tampilan**
   - Header dengan judul dan tombol terlihat jelas
   - Tab navigation horizontal
   - Tabel/grid menggunakan lebar penuh
   - Tidak ada horizontal scroll yang tidak perlu

5. **Resize browser ke 1024px width**
   - Buka DevTools → Toggle device toolbar
   - Set width: 1024px
   - Verifikasi tampilan masih baik

**Expected Result:**
- ✅ Tampilan optimal di berbagai ukuran desktop
- ✅ Tidak ada elemen yang terpotong
- ✅ Spacing dan alignment konsisten

---

### TC-G02: Responsive Design - Tablet

**Tujuan:** Memastikan tampilan baik di tablet

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Buka DevTools → Toggle device toolbar**

3. **Pilih device: iPad atau set width 768px**

4. **Navigasi ke Package Pricing**

5. **Verifikasi tampilan**
   - Tab navigation masih terlihat (mungkin scroll horizontal)
   - Tabel dapat di-scroll horizontal jika perlu
   - Modal tidak terpotong
   - Tombol masih dapat diklik

**Expected Result:**
- ✅ Tampilan usable di tablet
- ✅ Semua fungsi dapat diakses
- ✅ Modal responsive

---

### TC-G03: Responsive Design - Mobile

**Tujuan:** Memastikan tampilan usable di mobile

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Buka DevTools → Toggle device toolbar**

3. **Pilih device: iPhone 12 atau set width 390px**

4. **Navigasi ke Package Pricing**

5. **Verifikasi tampilan**
   - Tab navigation dapat di-scroll atau menjadi dropdown
   - Tabel dapat di-scroll horizontal
   - Modal full-width atau nearly full-width
   - Tombol cukup besar untuk di-tap

**Expected Result:**
- ✅ Tampilan usable di mobile
- ✅ Semua fungsi dapat diakses
- ✅ Touch-friendly

---

### TC-G04: Dark Mode

**Tujuan:** Memastikan tampilan baik di dark mode

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Aktifkan dark mode**
   - Klik toggle theme di header (jika ada)
   - Atau set system preference ke dark mode

3. **Navigasi ke Package Pricing**

4. **Verifikasi tampilan**
   - Background gelap
   - Text kontras dengan background
   - Tab, tombol, dan badge terlihat jelas
   - Modal memiliki background gelap
   - Tidak ada text yang "hilang" karena warna sama dengan background

5. **Test semua tab**
   - Paket Terapi
   - Booster Matrix
   - Add-on
   - Master Data

**Expected Result:**
- ✅ Dark mode konsisten di semua tab
- ✅ Kontras text cukup untuk readability
- ✅ Tidak ada elemen yang tidak terlihat

---

### TC-G05: Modal Behavior

**Tujuan:** Memastikan modal berfungsi dengan baik

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing**

3. **Buka modal tambah**
   - Klik "Tambah Paket"

4. **Test close dengan tombol X**
   - Klik tombol X di pojok kanan atas modal
   - Modal harus tertutup

5. **Buka modal lagi**

6. **Test close dengan ESC key**
   - Tekan tombol ESC di keyboard
   - Modal harus tertutup

7. **Buka modal lagi**

8. **Test close dengan klik backdrop**
   - Klik area gelap di luar modal
   - Modal harus tertutup (atau tidak, tergantung design)

9. **Test scroll lock**
   - Buka modal
   - Coba scroll halaman di belakang modal
   - Halaman tidak boleh scroll saat modal terbuka

**Expected Result:**
- ✅ Modal dapat ditutup dengan tombol X
- ✅ Modal dapat ditutup dengan ESC key
- ✅ Body scroll terkunci saat modal terbuka

---

### TC-G06: Loading States

**Tujuan:** Memastikan loading states ditampilkan dengan baik

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Buka DevTools → Tab Network**

3. **Set throttling ke "Slow 3G"**

4. **Navigasi ke Package Pricing**

5. **Verifikasi loading state**
   - Spinner atau skeleton loading muncul
   - Tidak ada blank screen

6. **Klik tab lain (misal Booster Matrix)**

7. **Verifikasi loading state saat pindah tab**
   - Loading indicator muncul
   - Data lama tidak ditampilkan saat loading data baru

8. **Submit form (tambah paket)**

9. **Verifikasi loading state saat submit**
   - Tombol Simpan menunjukkan loading (spinner atau disabled)
   - Tidak bisa double-click submit

**Expected Result:**
- ✅ Loading state saat fetch data
- ✅ Loading state saat pindah tab
- ✅ Loading state saat submit form
- ✅ Tombol disabled saat submitting

---

### TC-G07: Toast Notifications

**Tujuan:** Memastikan toast notifications berfungsi dengan baik

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Navigasi ke Package Pricing**

3. **Trigger toast sukses**
   - Tambah paket baru
   - Verifikasi toast hijau muncul

4. **Verifikasi posisi toast**
   - Toast muncul di pojok (biasanya kanan atas atau kanan bawah)

5. **Verifikasi auto-dismiss**
   - Toast hilang otomatis setelah beberapa detik

6. **Trigger toast error**
   - Coba submit form dengan data invalid
   - Verifikasi toast merah muncul

7. **Test multiple toasts**
   - Lakukan beberapa aksi berturut-turut
   - Verifikasi toasts stack dengan baik

**Expected Result:**
- ✅ Toast sukses berwarna hijau
- ✅ Toast error berwarna merah
- ✅ Toast auto-dismiss
- ✅ Multiple toasts tidak overlap

---

## Section H: Integration Testing

### TC-H01: Integrasi dengan Assign Package (Member)

**Tujuan:** Memastikan paket yang dibuat muncul saat assign ke member

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN**

2. **Buat paket terapi baru di Package Pricing**
   - Nama: "Paket Integration Test"
   - Status: Aktif
   - Simpan

3. **Navigasi ke halaman Members**
   - Sidebar → Members

4. **Pilih salah satu member**
   - Klik nama member untuk masuk ke detail

5. **Klik "Assign Paket" atau tombol serupa**

6. **Verifikasi paket baru muncul di dropdown**
   - Cari "Paket Integration Test"
   - Paket harus muncul di pilihan

7. **Verifikasi paket nonaktif TIDAK muncul**
   - Kembali ke Package Pricing
   - Nonaktifkan paket "Paket Integration Test"
   - Kembali ke Assign Paket
   - Paket tidak boleh muncul di dropdown

**Expected Result:**
- ✅ Paket aktif muncul di Assign Package
- ✅ Paket nonaktif tidak muncul di Assign Package

---

### TC-H02: Integrasi Booster dengan Assign Package

**Tujuan:** Memastikan booster yang dibuat muncul saat assign ke member

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Pastikan ada booster aktif di Booster Matrix**
   - Navigasi ke Package Pricing → Booster Matrix
   - Pastikan ada minimal 1 booster dengan status aktif

3. **Navigasi ke halaman Members → Detail Member**

4. **Klik "Assign Paket"**

5. **Pilih paket BASIC terlebih dahulu**

6. **Lihat section Booster**
   - Verifikasi booster yang aktif muncul sebagai pilihan
   - Booster yang nonaktif tidak muncul

**Expected Result:**
- ✅ Booster aktif muncul di Assign Package
- ✅ Booster nonaktif tidak muncul

---

### TC-H03: Integrasi Add-on dengan Assign Package

**Tujuan:** Memastikan add-on yang dibuat muncul saat assign ke member

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Pastikan ada add-on aktif**
   - Navigasi ke Package Pricing → Add-on
   - Pastikan ada minimal 1 add-on dengan status aktif

3. **Navigasi ke halaman Members → Detail Member**

4. **Klik "Assign Paket"**

5. **Pilih paket BASIC terlebih dahulu**

6. **Lihat section Add-on**
   - Verifikasi add-on yang aktif muncul sebagai pilihan
   - Add-on yang nonaktif tidak muncul

7. **Verifikasi harga add-on**
   - Harga yang ditampilkan sesuai dengan yang diset di Package Pricing

**Expected Result:**
- ✅ Add-on aktif muncul di Assign Package
- ✅ Add-on nonaktif tidak muncul
- ✅ Harga sesuai dengan setting

---

### TC-H04: Integrasi Harga Cabang vs Global

**Tujuan:** Memastikan harga cabang override harga global saat assign

**Langkah-langkah:**

1. **Login sebagai SUPER_ADMIN** (jika belum)

2. **Setup data test**
   - Buat paket Global: "Paket Test Global" dengan harga Rp 5.000.000
   - Buat paket PST: "Paket Test PST" dengan harga Rp 6.000.000 (untuk cabang PST)

3. **Login sebagai ADMIN_CABANG PST**
   - Email: `admincabang.pst@raho.id`
   - Password: `AdminCabang@123`

4. **Navigasi ke Members → Detail Member (member cabang PST)**

5. **Klik "Assign Paket"**

6. **Verifikasi harga yang ditampilkan**
   - Jika ada paket khusus PST, harga PST yang ditampilkan
   - Jika tidak ada paket khusus, harga Global yang ditampilkan

**Expected Result:**
- ✅ Harga cabang override harga global
- ✅ Jika tidak ada harga cabang, gunakan harga global

---

## Ringkasan Test Cases

| Section | Jumlah TC | Deskripsi |
|---------|-----------|-----------|
| A. Access Control | 4 | Pengujian hak akses per role |
| B. Tab Paket Terapi | 7 | CRUD paket terapi BASIC |
| C. Tab Booster Matrix | 6 | CRUD booster dan matrix view |
| D. Tab Add-on | 7 | CRUD produk add-on |
| E. Tab Master Data | 7 | CRUD master booster & service types |
| F. Validasi & Error | 6 | Validasi input dan error handling |
| G. UI/UX | 7 | Responsive, dark mode, modal, toast |
| H. Integration | 4 | Integrasi dengan fitur lain |
| **TOTAL** | **48** | |

---

## Checklist Eksekusi Test

### Persiapan
- [ ] Server API berjalan di port 3001
- [ ] Server Web berjalan di port 3000
- [ ] Database sudah di-seed
- [ ] Browser DevTools siap

### Section A: Access Control
- [ ] TC-A01: SUPER_ADMIN akses semua tab
- [ ] TC-A02: ADMIN_MANAGER tidak ada tab Master Data
- [ ] TC-A03: ADMIN_CABANG view only Add-on
- [ ] TC-A04: ADMIN_LAYANAN/DOCTOR/NURSE ditolak

### Section B: Tab Paket Terapi
- [ ] TC-B01: Melihat daftar paket
- [ ] TC-B02: Tambah paket Global
- [ ] TC-B03: Tambah paket per Cabang
- [ ] TC-B04: Edit paket
- [ ] TC-B05: Toggle status
- [ ] TC-B06: Hapus paket
- [ ] TC-B07: ADMIN_MANAGER filter cabang

### Section C: Tab Booster Matrix
- [ ] TC-C01: Melihat matrix
- [ ] TC-C02: Tambah booster satuan
- [ ] TC-C03: Bulk create booster
- [ ] TC-C04: Edit dari matrix
- [ ] TC-C05: Matrix per cabang
- [ ] TC-C06: Validasi duplikat

### Section D: Tab Add-on
- [ ] TC-D01: Melihat daftar add-on
- [ ] TC-D02: Tambah Air Nano
- [ ] TC-D03: Tambah Rokok Kenkou
- [ ] TC-D04: Edit add-on
- [ ] TC-D05: Toggle status
- [ ] TC-D06: Hapus add-on
- [ ] TC-D07: ADMIN_MANAGER CRUD add-on

### Section E: Tab Master Data
- [ ] TC-E01: Melihat master booster types
- [ ] TC-E02: Tambah booster type
- [ ] TC-E03: Melihat master service types
- [ ] TC-E04: Tambah service type
- [ ] TC-E05: Edit master data
- [ ] TC-E06: Toggle status master
- [ ] TC-E07: Hapus master data

### Section F: Validasi & Error
- [ ] TC-F01: Validasi field wajib paket
- [ ] TC-F02: Validasi field wajib booster
- [ ] TC-F03: Validasi field wajib Air Nano
- [ ] TC-F04: Validasi kode duplikat
- [ ] TC-F05: Validasi input numerik
- [ ] TC-F06: Error handling network

### Section G: UI/UX
- [ ] TC-G01: Responsive desktop
- [ ] TC-G02: Responsive tablet
- [ ] TC-G03: Responsive mobile
- [ ] TC-G04: Dark mode
- [ ] TC-G05: Modal behavior
- [ ] TC-G06: Loading states
- [ ] TC-G07: Toast notifications

### Section H: Integration
- [ ] TC-H01: Integrasi assign package
- [ ] TC-H02: Integrasi booster
- [ ] TC-H03: Integrasi add-on
- [ ] TC-H04: Harga cabang vs global

---

## Catatan Penting

1. **Urutan Testing**: Disarankan mengikuti urutan section A → H karena beberapa test case bergantung pada data yang dibuat di test case sebelumnya.

2. **Data Cleanup**: Setelah testing selesai, hapus data test yang dibuat untuk menjaga kebersihan database.

3. **Screenshot**: Ambil screenshot untuk setiap test case yang gagal sebagai dokumentasi bug.

4. **Browser Console**: Selalu perhatikan console browser untuk error JavaScript yang mungkin tidak terlihat di UI.

5. **Network Tab**: Gunakan Network tab untuk memverifikasi API calls dan response.

---

**Dokumen ini dibuat pada**: 26 Mei 2026  
**Versi**: 2.0  
**Author**: QA Team
