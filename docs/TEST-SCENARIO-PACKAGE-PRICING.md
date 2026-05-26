# Test Scenario: Kelola Harga Paket & Add-on

## Overview
Dokumen ini berisi test case untuk fitur **Kelola Harga Paket & Add-on** yang dapat diakses oleh:
- **SUPER_ADMIN**: Akses penuh ke semua fitur
- **ADMIN_MANAGER**: Akses ke paket dan add-on (tidak bisa kelola master data)
- **ADMIN_CABANG**: Akses ke paket cabang sendiri dan master data

**URL**: `/admin/package-pricing`

---

## Pre-requisites
1. Database sudah di-seed dengan data master (booster types, service types)
2. Minimal ada 2 cabang aktif
3. User test sudah dibuat untuk setiap role

---

## Test Accounts
| Role | Email | Password | Cabang |
|------|-------|----------|--------|
| SUPER_ADMIN | superadmin@raho.id | SuP3r4Dm1n | - (All) |
| ADMIN_MANAGER | manager1@raho.id | Manager@123 | Jakarta Pusat, Bandung |
| ADMIN_MANAGER | manager2@raho.id | Manager@123 | Surabaya, Jakarta Pusat |
| ADMIN_CABANG | admincabang.pst@raho.id | AdminCabang@123 | Jakarta Pusat |
| ADMIN_CABANG | admincabang.bdg@raho.id | AdminCabang@123 | Bandung |
| ADMIN_CABANG | admincabang.sby@raho.id | AdminCabang@123 | Surabaya |
| DOCTOR | dokter@raho.id | Dokter@123 | Jakarta Pusat |
| NURSE | nakes@raho.id | Nakes@123 | Jakarta Pusat |

---

## A. ACCESS CONTROL TESTS

### TC-A01: Akses Halaman - SUPER_ADMIN
**Steps:**
1. Login sebagai SUPER_ADMIN
2. Navigasi ke `/admin/package-pricing`

**Expected:**
- ✅ Halaman tampil dengan 4 tab: Paket Terapi, Booster Matrix, Add-on, Master Data
- ✅ Dropdown filter cabang tersedia
- ✅ Tombol "Tambah" tersedia

### TC-A02: Akses Halaman - ADMIN_MANAGER
**Steps:**
1. Login sebagai ADMIN_MANAGER
2. Navigasi ke `/admin/package-pricing`

**Expected:**
- ✅ Halaman tampil dengan 3 tab: Paket Terapi, Booster Matrix, Add-on
- ✅ Tab "Master Data" TIDAK tampil
- ✅ Dropdown filter cabang tersedia
- ✅ Tombol "Tambah" tersedia

### TC-A03: Akses Halaman - ADMIN_CABANG
**Steps:**
1. Login sebagai ADMIN_CABANG
2. Navigasi ke `/admin/package-pricing`

**Expected:**
- ✅ Halaman tampil dengan 4 tab: Paket Terapi, Booster Matrix, Add-on, Master Data
- ✅ Dropdown filter cabang TIDAK tampil (hanya lihat cabang sendiri)
- ✅ Tombol "Tambah" tersedia

### TC-A04: Akses Halaman - Role Lain (DOCTOR, NURSE, dll)
**Steps:**
1. Login sebagai DOCTOR atau NURSE
2. Navigasi ke `/admin/package-pricing`

**Expected:**
- ✅ Tampil pesan "Akses Ditolak"
- ✅ Tidak bisa melihat atau mengelola data

---

## B. TAB PAKET TERAPI (BASIC)

### TC-B01: Lihat Daftar Paket Basic
**Steps:**
1. Login sebagai SUPER_ADMIN
2. Buka tab "Paket Terapi"
3. Pilih filter "Semua Cabang"

**Expected:**
- ✅ Tampil daftar paket dikelompokkan per cabang
- ✅ Setiap card menampilkan: nama, tipe (BASIC), harga, jumlah sesi, status
- ✅ Tombol Edit, On/Off, Hapus tersedia

### TC-B02: Filter Paket per Cabang
**Steps:**
1. Pilih cabang spesifik dari dropdown
2. Perhatikan daftar paket

**Expected:**
- ✅ Hanya tampil paket dari cabang yang dipilih
- ✅ Pilih "Global" → hanya tampil paket tanpa branchId

### TC-B03: Tambah Paket Basic Baru (Global)
**Steps:**
1. Klik tombol "Tambah Harga Paket"
2. Pilih Tipe Paket: BASIC
3. Isi Nama: "Terapi Nano Bubble 10X"
4. Biarkan Cabang: Global (Semua Cabang)
5. Isi Kode Produk: "TNB-10X"
6. Isi Jumlah Sesi: 10
7. Isi Harga: 15000000
8. Centang Aktif
9. Klik Simpan

**Expected:**
- ✅ Toast sukses "Harga paket berhasil ditambahkan"
- ✅ Paket baru muncul di grup "Global (Semua Cabang)"
- ✅ Harga tampil: Rp 15.000.000

### TC-B04: Tambah Paket Basic untuk Cabang Spesifik
**Steps:**
1. Klik tombol "Tambah Harga Paket"
2. Pilih Tipe Paket: BASIC
3. Isi Nama: "Terapi Nano Bubble 7X - Jakarta"
4. Pilih Cabang: Jakarta
5. Isi Jumlah Sesi: 7
6. Isi Harga: 12500000
7. Klik Simpan

**Expected:**
- ✅ Toast sukses
- ✅ Paket muncul di grup cabang Jakarta

### TC-B05: Edit Paket Basic
**Steps:**
1. Klik tombol "Edit" pada paket yang ada
2. Ubah harga dari 12500000 menjadi 13000000
3. Klik Simpan

**Expected:**
- ✅ Toast sukses "Harga paket berhasil diupdate"
- ✅ Harga terupdate di card

### TC-B06: Nonaktifkan Paket
**Steps:**
1. Klik tombol "Off" pada paket aktif

**Expected:**
- ✅ Toast sukses "Harga paket berhasil dinonaktifkan"
- ✅ Badge berubah dari "✓ Aktif" menjadi "✗ Nonaktif"

### TC-B07: Aktifkan Paket
**Steps:**
1. Klik tombol "On" pada paket nonaktif

**Expected:**
- ✅ Toast sukses "Harga paket berhasil diaktifkan"
- ✅ Badge berubah menjadi "✓ Aktif"

### TC-B08: Hapus Paket
**Steps:**
1. Klik tombol "Hapus" pada paket
2. Konfirmasi di dialog

**Expected:**
- ✅ Toast sukses "Harga paket berhasil dihapus"
- ✅ Paket hilang dari daftar

---

## C. TAB BOOSTER MATRIX

### TC-C01: Lihat Booster Matrix
**Steps:**
1. Buka tab "Booster Matrix"
2. Pilih cabang dari dropdown

**Expected:**
- ✅ Tampil tabel matrix dengan:
  - Baris: Tipe Booster (NO, GT, MB, KCL, H2S, HK, O3, dll)
  - Kolom: Tipe Layanan (PM, PS, PTY, PDA, PHC)
- ✅ Cell dengan harga tampil warna hijau (global) atau biru (cabang)
- ✅ Cell kosong tampil ikon "+"

### TC-C02: Tambah Harga Booster via Matrix
**Steps:**
1. Klik cell kosong (ikon "+") pada baris NO, kolom PM
2. Modal form terbuka dengan data pre-filled
3. Verifikasi:
   - Tipe Paket: BOOSTER
   - Tipe Booster: NO
   - Tipe Layanan: PM
   - Nama: "Booster NO 1X - PM"
4. Isi Harga: 1000000
5. Klik Simpan

**Expected:**
- ✅ Toast sukses
- ✅ Cell sekarang menampilkan "Rp 1.000.000" dengan warna biru
- ✅ Status "✓ Aktif" tampil

### TC-C03: Edit Harga Booster via Matrix
**Steps:**
1. Klik cell yang sudah ada harganya
2. Modal edit terbuka
3. Ubah harga
4. Klik Simpan

**Expected:**
- ✅ Toast sukses
- ✅ Harga terupdate di cell

### TC-C04: Bulk Create Booster (Semua Tipe Layanan)
**Steps:**
1. Pada baris booster yang belum lengkap, klik tombol "+5" (atau sesuai jumlah yang kurang)
2. Konfirmasi di dialog

**Expected:**
- ✅ Toast sukses "Berhasil membuat X harga booster"
- ✅ Semua cell pada baris tersebut terisi
- ✅ Harga diambil dari Master Tipe Layanan (atau 0 jika belum diatur)

### TC-C05: Lihat Statistik Matrix
**Steps:**
1. Scroll ke bawah matrix

**Expected:**
- ✅ Tampil card "Keterangan" dengan penjelasan warna
- ✅ Tampil card "Statistik" dengan:
  - Total Kombinasi: X × Y = Z
  - Harga Tersedia: N
  - Belum Ada Harga: M

### TC-C06: Switch Cabang di Matrix
**Steps:**
1. Pilih cabang berbeda dari dropdown
2. Perhatikan perubahan matrix

**Expected:**
- ✅ Matrix refresh dengan data cabang baru
- ✅ Cell yang ada harga spesifik cabang tampil biru
- ✅ Cell kosong menampilkan harga global (jika ada) sebagai referensi

---

## D. TAB ADD-ON

### TC-D01: Lihat Daftar Add-on
**Steps:**
1. Buka tab "Add-on"

**Expected:**
- ✅ Tampil daftar add-on dikelompokkan per tipe:
  - Air Nano (💧)
  - Rokok Kenkou (🚬)
- ✅ Setiap card menampilkan: nama, kode, harga per unit, status

### TC-D02: Tambah Add-on Air Nano
**Steps:**
1. Klik tombol "Tambah Add-on"
2. Pilih Tipe Produk: Air Nano
3. Isi Kode Produk: "AN-KUNING-600ML-BOTOL"
4. Isi Nama: "Air Nano Kuning 600ml Botol"
5. Pilih Warna: Kuning
6. Pilih Volume: 600ml
7. Pilih Unit: Botol
8. Isi Harga per Unit: 150000
9. Klik Simpan

**Expected:**
- ✅ Toast sukses "Add-on berhasil ditambahkan"
- ✅ Add-on muncul di grup Air Nano
- ✅ Detail warna, volume, unit tampil di card

### TC-D03: Tambah Add-on Rokok Kenkou
**Steps:**
1. Klik tombol "Tambah Add-on"
2. Pilih Tipe Produk: Rokok Kenkou
3. Isi Kode Produk: "RK-001"
4. Isi Nama: "Rokok Kenkou Original"
5. Isi Deskripsi: "Rokok herbal tanpa nikotin"
6. Isi Harga per Unit: 50000
7. Klik Simpan

**Expected:**
- ✅ Toast sukses
- ✅ Add-on muncul di grup Rokok Kenkou
- ✅ Field warna/volume/unit TIDAK tampil (khusus Air Nano)

### TC-D04: Edit Add-on
**Steps:**
1. Klik tombol "Edit" pada add-on
2. Ubah harga
3. Klik Simpan

**Expected:**
- ✅ Toast sukses "Add-on berhasil diupdate"
- ✅ Kode produk dan tipe TIDAK bisa diubah (disabled)

### TC-D05: Toggle Status Add-on
**Steps:**
1. Klik tombol "Off" pada add-on aktif

**Expected:**
- ✅ Toast sukses
- ✅ Status berubah menjadi nonaktif

### TC-D06: Hapus Add-on
**Steps:**
1. Klik tombol "Hapus" pada add-on
2. Konfirmasi

**Expected:**
- ✅ Toast sukses "Add-on berhasil dihapus"
- ✅ Add-on hilang dari daftar

### TC-D07: ADMIN_MANAGER Kelola Add-on
**Steps:**
1. Login sebagai ADMIN_MANAGER
2. Buka tab Add-on
3. Coba tambah/edit/hapus add-on

**Expected:**
- ✅ ADMIN_MANAGER BISA mengelola add-on (sama seperti SUPER_ADMIN)

---

## E. TAB MASTER DATA

### TC-E01: Lihat Master Tipe Booster
**Steps:**
1. Login sebagai SUPER_ADMIN
2. Buka tab "Master Data"
3. Pilih sub-tab "Tipe Booster"

**Expected:**
- ✅ Tampil daftar tipe booster: NO, GT, MB, KCL, H2S, HK, O3, dll
- ✅ Setiap card menampilkan: kode, nama, icon, urutan, status

### TC-E02: Tambah Tipe Booster Baru
**Steps:**
1. Klik tombol "Tambah Tipe Booster"
2. Isi Kode: "HHO"
3. Isi Nama: "Hydrogen Hydroxide"
4. Isi Icon: "💎"
5. Isi Deskripsi: "Booster terbaru"
6. Isi Urutan: 10
7. Klik Simpan

**Expected:**
- ✅ Toast sukses "Tipe booster berhasil ditambahkan"
- ✅ Tipe booster baru muncul di daftar
- ✅ Tipe booster baru tersedia di dropdown form paket BOOSTER

### TC-E03: Edit Tipe Booster
**Steps:**
1. Klik tombol "Edit" pada tipe booster
2. Ubah nama atau icon
3. Klik Simpan

**Expected:**
- ✅ Toast sukses
- ✅ Kode TIDAK bisa diubah (disabled)

### TC-E04: Lihat Master Tipe Layanan
**Steps:**
1. Pilih sub-tab "Tipe Layanan"

**Expected:**
- ✅ Tampil daftar tipe layanan: PM, PS, PTY, PDA, PHC
- ✅ Setiap card menampilkan: kode, nama, harga default, urutan, status

### TC-E05: Tambah Tipe Layanan Baru
**Steps:**
1. Klik tombol "Tambah Tipe Layanan"
2. Isi Kode: "PVP"
3. Isi Nama: "Partnership VIP"
4. Isi Harga Default: 2000000
5. Isi Urutan: 6
6. Klik Simpan

**Expected:**
- ✅ Toast sukses "Tipe layanan berhasil ditambahkan"
- ✅ Tipe layanan baru muncul di daftar
- ✅ Tipe layanan baru tersedia di dropdown form paket BOOSTER
- ✅ Kolom baru muncul di Booster Matrix

### TC-E06: Edit Harga Default Tipe Layanan
**Steps:**
1. Klik tombol "Edit" pada tipe layanan
2. Ubah harga default
3. Klik Simpan

**Expected:**
- ✅ Toast sukses
- ✅ Harga default terupdate
- ✅ Bulk create booster akan menggunakan harga baru ini

### TC-E07: ADMIN_MANAGER Tidak Bisa Akses Master Data
**Steps:**
1. Login sebagai ADMIN_MANAGER
2. Coba akses tab Master Data

**Expected:**
- ✅ Tab "Master Data" TIDAK tampil di navigation

---

## F. VALIDATION & ERROR HANDLING

### TC-F01: Validasi Form Paket - Field Kosong
**Steps:**
1. Buka form tambah paket
2. Biarkan nama kosong
3. Klik Simpan

**Expected:**
- ✅ Toast error "Mohon lengkapi semua field dengan benar"
- ✅ Form tidak submit

### TC-F02: Validasi Form Booster - Tipe Booster Kosong
**Steps:**
1. Pilih Tipe Paket: BOOSTER
2. Biarkan Tipe Booster kosong
3. Klik Simpan

**Expected:**
- ✅ Toast error "Tipe booster wajib diisi untuk paket BOOSTER"

### TC-F03: Validasi Form Booster - Tipe Layanan Kosong
**Steps:**
1. Pilih Tipe Paket: BOOSTER
2. Pilih Tipe Booster: NO
3. Biarkan Tipe Layanan kosong
4. Klik Simpan

**Expected:**
- ✅ Toast error "Tipe layanan wajib diisi untuk paket BOOSTER"

### TC-F04: Validasi Form Add-on Air Nano - Field Wajib
**Steps:**
1. Pilih Tipe Produk: Air Nano
2. Biarkan Warna/Volume/Unit kosong
3. Klik Simpan

**Expected:**
- ✅ Toast error "Untuk Air Nano, warna, volume, dan unit wajib diisi"

### TC-F05: Hapus Paket yang Sedang Digunakan
**Steps:**
1. Coba hapus paket yang sudah di-assign ke member

**Expected:**
- ✅ Toast error dengan pesan dari backend
- ✅ Paket tidak terhapus

### TC-F06: Duplikat Kode Produk
**Steps:**
1. Tambah paket dengan kode produk yang sudah ada

**Expected:**
- ✅ Toast error dari backend (jika ada constraint)

---

## G. UI/UX TESTS

### TC-G01: Modal Close dengan ESC
**Steps:**
1. Buka modal form
2. Tekan tombol ESC

**Expected:**
- ✅ Modal tertutup
- ✅ Form di-reset

### TC-G02: Modal Close dengan Click Outside
**Steps:**
1. Buka modal form
2. Klik area di luar modal (backdrop)

**Expected:**
- ✅ Modal tertutup
- ✅ Form di-reset

### TC-G03: Loading State
**Steps:**
1. Refresh halaman
2. Perhatikan loading state

**Expected:**
- ✅ Tampil spinner dengan teks "Memuat data..."
- ✅ Setelah load, data tampil

### TC-G04: Empty State
**Steps:**
1. Filter ke cabang yang tidak punya paket

**Expected:**
- ✅ Tampil empty state dengan icon dan pesan
- ✅ Pesan: "Belum ada harga paket"

### TC-G05: Responsive Design - Mobile
**Steps:**
1. Buka halaman di viewport mobile (< 768px)

**Expected:**
- ✅ Layout menyesuaikan (single column)
- ✅ Tabs bisa di-scroll horizontal
- ✅ Cards stack vertikal
- ✅ Tombol aksi tetap accessible

### TC-G06: Dark Mode
**Steps:**
1. Toggle dark mode
2. Perhatikan semua komponen

**Expected:**
- ✅ Background berubah ke dark
- ✅ Text readable (kontras cukup)
- ✅ Cards, modals, inputs menyesuaikan

### TC-G07: Preview Harga di Form
**Steps:**
1. Buka form tambah paket
2. Ketik angka di field harga

**Expected:**
- ✅ Preview harga tampil di bawah input dalam format currency
- ✅ Contoh: "Rp 12.500.000"

---

## H. INTEGRATION TESTS

### TC-H01: Paket Baru Muncul di Assign Package Modal
**Steps:**
1. Tambah paket BASIC baru
2. Buka halaman member
3. Klik "Assign Paket"

**Expected:**
- ✅ Paket baru muncul di dropdown pilihan paket

### TC-H02: Booster Baru Muncul di Assign Package Modal
**Steps:**
1. Tambah harga booster baru via matrix
2. Buka halaman member
3. Klik "Assign Paket"
4. Pilih paket BASIC
5. Lihat section Booster

**Expected:**
- ✅ Booster baru muncul di pilihan booster

### TC-H03: Add-on Baru Muncul di Assign Package Modal
**Steps:**
1. Tambah add-on baru
2. Buka halaman member
3. Klik "Assign Paket"
4. Lihat section Add-on

**Expected:**
- ✅ Add-on baru muncul di pilihan add-on

### TC-H04: Harga Cabang Override Harga Global
**Steps:**
1. Buat paket global dengan harga Rp 10.000.000
2. Buat paket cabang Jakarta dengan harga Rp 9.500.000
3. Login sebagai admin cabang Jakarta
4. Assign paket ke member

**Expected:**
- ✅ Harga yang digunakan adalah Rp 9.500.000 (harga cabang)

---

## Summary Checklist

| Category | Total | Pass | Fail |
|----------|-------|------|------|
| A. Access Control | 4 | | |
| B. Paket Terapi | 8 | | |
| C. Booster Matrix | 6 | | |
| D. Add-on | 7 | | |
| E. Master Data | 7 | | |
| F. Validation | 6 | | |
| G. UI/UX | 7 | | |
| H. Integration | 4 | | |
| **TOTAL** | **49** | | |

---

## Notes
- Semua test dilakukan di environment development
- Pastikan API server running sebelum test
- Clear browser cache jika ada masalah styling
- Screenshot error untuk dokumentasi bug
