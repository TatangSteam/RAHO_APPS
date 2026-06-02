# 📖 PANDUAN PENGGUNAAN APLIKASI RAHO ERP MANAGEMENT SYSTEM

> Dokumentasi lengkap cara penggunaan aplikasi untuk semua role pengguna

**Versi**: 2.1.0  
**Terakhir Diperbarui**: 29 Mei 2026  
**Author**: [Jovan Prabowo Kuncoro](https://github.com/Etherlyvan)

---

## DAFTAR ISI

| No | Bab | Halaman |
|----|-----|---------|
| 1 | [Informasi Umum](#bab-1-informasi-umum) | - |
| 2 | [Akun Demo & Kredensial](#bab-2-akun-demo--kredensial) | - |
| 3 | [Panduan Login](#bab-3-panduan-login) | - |
| 4 | [Panduan Super Admin](#bab-4-panduan-super-admin) | - |
| 5 | [Panduan Admin Manager](#bab-5-panduan-admin-manager) | - |
| 6 | [Panduan Admin Cabang](#bab-6-panduan-admin-cabang) | - |
| 7 | [Panduan Admin Layanan](#bab-7-panduan-admin-layanan) | - |
| 8 | [Panduan Dokter](#bab-8-panduan-dokter) | - |
| 9 | [Panduan Perawat](#bab-9-panduan-perawat) | - |
| 10 | [Panduan Member](#bab-10-panduan-member) | - |
| 11 | [Fitur Utama Sistem](#bab-11-fitur-utama-sistem) | - |
| 12 | [FAQ & Troubleshooting](#bab-12-faq--troubleshooting) | - |
| A | [Appendix A: Data Referensi](#appendix-a-data-referensi) | - |
| B | [Appendix B: Status & Badge](#appendix-b-status--badge) | - |
| C | [Appendix C: Alur Kerja](#appendix-c-alur-kerja) | - |
| D | [Appendix D: Glossary](#appendix-d-glossary) | - |

---

# BAB 1: INFORMASI UMUM

## 1.1 Tentang Aplikasi

**RAHO ERP Management System** adalah sistem manajemen klinik terintegrasi untuk mengelola operasional klinik terapi infus RAHO Premier Club. Sistem ini mencakup:

- ✅ Manajemen member/pasien
- ✅ Paket terapi dan pembayaran
- ✅ Sesi treatment dengan workflow 8 langkah
- ✅ Inventory dan stock management
- ✅ Multi-branch operations
- ✅ Sistem referral dan insentif
- ✅ Audit trail dan compliance
- ✅ Dashboard analytics per role

## 1.2 URL Aplikasi

| Environment | Web App | API |
|-------------|---------|-----|
| Development | `http://localhost:3000` | `http://localhost:4000` |
| Production | `https://app.raho.id` | `https://api.raho.id` |

## 1.3 Browser yang Didukung

| Browser | Versi Minimum | Status |
|---------|---------------|--------|
| Google Chrome | 90+ | ✅ Recommended |
| Mozilla Firefox | 88+ | ✅ Supported |
| Microsoft Edge | 90+ | ✅ Supported |
| Safari | 14+ | ✅ Supported |
| Internet Explorer | - | ❌ Not Supported |

## 1.4 Struktur Role Pengguna

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                             │
│              (Akses penuh ke semua sistem)                   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     ADMIN MANAGER       │     │     ADMIN MANAGER       │
│   (Multi-branch access) │     │   (Multi-branch access) │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
    ┌─────────┴─────────┐           ┌────────┴────────┐
    ▼                   ▼           ▼                 ▼
┌────────┐         ┌────────┐  ┌────────┐        ┌────────┐
│CABANG A│         │CABANG B│  │CABANG C│        │CABANG D│
└────────┘         └────────┘  └────────┘        └────────┘
    │
    ├── ADMIN CABANG (1 per cabang)
    ├── ADMIN LAYANAN (operasional harian)
    ├── DOKTER (diagnosis & evaluasi)
    └── PERAWAT (eksekusi treatment)

┌─────────────────────────────────────────────────────────────┐
│                        MEMBER                                │
│              (Pasien/klien yang terdaftar)                   │
└─────────────────────────────────────────────────────────────┘
```

---

# BAB 2: AKUN DEMO & KREDENSIAL

## 2.1 Akun Super Admin

| Field | Value |
|-------|-------|
| **Email** | `superadmin@raho.id` |
| **Password** | `Sup3r4dM1n` |
| **Role** | SUPER_ADMIN |
| **Akses** | Semua cabang & fitur |

> ⚠️ **PENTING**: Ini adalah akun production. Gunakan dengan hati-hati.

## 2.2 Akun Admin Manager

| No | Email | Password | Nama | Cabang yang Dikelola |
|----|-------|----------|------|----------------------|
| 1 | `manager1@raho.id` | `Manager@123` | Admin Manager Regional 1 | Jakarta Pusat, Bandung |
| 2 | `manager2@raho.id` | `Manager@123` | Admin Manager Regional 2 | Surabaya, Jakarta Pusat |

## 2.3 Akun Staff Cabang Jakarta Pusat (PST)

| No | Role | Email | Password | Nama Lengkap |
|----|------|-------|----------|--------------|
| 1 | Admin Cabang | `admincabang.pst@raho.id` | `AdminCabang@123` | Admin Cabang Pusat |
| 2 | Admin Layanan | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | Admin Layanan Pusat |
| 3 | Dokter | `dokter@raho.id` | `Dokter@123` | dr. Ahmad Fauzi, SpPD |
| 4 | Perawat | `nakes@raho.id` | `Nakes@123` | Siti Rahayu, Amd.Kep |

## 2.4 Akun Staff Cabang Bandung (BDG)

| No | Role | Email | Password | Nama Lengkap |
|----|------|-------|----------|--------------|
| 1 | Admin Cabang | `admincabang.bdg@raho.id` | `AdminCabang@123` | Admin Cabang Bandung |
| 2 | Admin Layanan | `adminlayanan.bdg@raho.id` | `AdminLayanan@123` | Admin Layanan Bandung |
| 3 | Dokter | `dokter2@raho.id` | `Dokter@123` | dr. Budi Santoso, SpPD |
| 4 | Perawat | `nakes2@raho.id` | `Nakes@123` | Dewi Lestari, Amd.Kep |

## 2.5 Akun Staff Cabang Surabaya (SBY)

| No | Role | Email | Password | Nama Lengkap |
|----|------|-------|----------|--------------|
| 1 | Admin Cabang | `admincabang.sby@raho.id` | `AdminCabang@123` | Admin Cabang Surabaya |
| 2 | Admin Layanan | `adminlayanan.sby@raho.id` | `AdminLayanan@123` | Admin Layanan Surabaya |
| 3 | Dokter | `dokter3@raho.id` | `Dokter@123` | dr. Citra Wijaya, SpPD |
| 4 | Perawat | `nakes3@raho.id` | `Nakes@123` | Eko Prasetyo, Amd.Kep |

## 2.6 Akun Member (Pasien)

| No | Cabang | Email | Password | Nama |
|----|--------|-------|----------|------|
| 1 | Jakarta | `budi.santoso@email.com` | `Member@123` | Budi Santoso |
| 2 | Jakarta | `siti.nurhaliza@email.com` | `Member@123` | Siti Nurhaliza |
| 3 | Jakarta | `ahmad.fauzi@email.com` | `Member@123` | Ahmad Fauzi |
| 4 | Bandung | `andi.wijaya@email.com` | `Member@123` | Andi Wijaya |
| 5 | Bandung | `rina.melati@email.com` | `Member@123` | Rina Melati |
| 6 | Surabaya | `joko.susilo@email.com` | `Member@123` | Joko Susilo |
| 7 | Surabaya | `maya.sari@email.com` | `Member@123` | Maya Sari |

> **Catatan**: Password default untuk semua member testing adalah `Member@123`

---

# BAB 3: PANDUAN LOGIN

## 3.1 Langkah-langkah Login

1. **Buka aplikasi** di browser yang didukung
2. **Masukkan email** pada field "Email"
3. **Masukkan password** pada field "Password"
4. **Klik tombol "Masuk"**
5. Sistem akan memvalidasi kredensial
6. Jika berhasil, sistem akan redirect ke dashboard sesuai role

## 3.2 Halaman Redirect Setelah Login

| Role | Halaman Tujuan | Deskripsi |
|------|----------------|-----------|
| SUPER_ADMIN | `/admin/super-admin` | Panel Super Admin |
| ADMIN_MANAGER | `/dashboard/admin-manager` | Dashboard Multi-Cabang |
| ADMIN_CABANG | `/dashboard` | Dashboard Cabang |
| ADMIN_LAYANAN | `/dashboard/admin-layanan` | Dashboard Layanan |
| DOCTOR | `/dashboard/doctor` | Dashboard Dokter |
| NURSE | `/dashboard/nurse` | Dashboard Perawat |
| MEMBER | `/me/dashboard` | Portal Member |

## 3.3 Troubleshooting Login

### 3.3.1 Error "Invalid credentials"
**Penyebab**: Email atau password salah
**Solusi**:
- Periksa kembali email (case-sensitive untuk domain)
- Periksa password (case-sensitive)
- Pastikan tidak ada spasi di awal/akhir

### 3.3.2 Error "Account deactivated"
**Penyebab**: Akun telah dinonaktifkan oleh admin
**Solusi**: Hubungi Super Admin atau Admin Cabang untuk mengaktifkan kembali

### 3.3.3 Error "Too many login attempts"
**Penyebab**: Terlalu banyak percobaan login gagal
**Solusi**: Tunggu 15 menit sebelum mencoba lagi

### 3.3.4 Lupa Password
**Solusi**: Hubungi Super Admin atau Admin Cabang untuk reset password

## 3.4 Logout

1. Klik nama/foto profil di sidebar
2. Klik tombol **"Keluar"** di bagian bawah sidebar
3. Sistem akan menghapus session dan redirect ke halaman login

---

# BAB 4: PANDUAN SUPER ADMIN

## 4.1 Overview

Super Admin adalah role tertinggi dalam sistem dengan akses penuh ke semua fitur dan data di semua cabang.

## 4.2 Menu yang Tersedia

| No | Menu | Path | Icon | Fungsi |
|----|------|------|------|--------|
| 1 | Dashboard | `/admin/super-admin` | 🛡️ | Overview sistem keseluruhan |
| 2 | Admin Managers | `/admin/managers` | 👥 | Kelola Admin Manager |
| 3 | Master Produk | `/admin/master-products` | 📦 | Kelola produk master |
| 4 | Audit Log | `/admin/audit-logs` | 📋 | Lihat log aktivitas |
| 5 | Pengaturan Cabang | `/branches` | 🏢 | Kelola semua cabang |
| 6 | Pengiriman | `/inventory/shipments` | 🚚 | Kelola pengiriman stok |
| 7 | Kinerja Staff | `/staff-performance` | 📊 | Lihat performa staff |
| 8 | Harga Paket | `/admin/package-pricing` | 💰 | Kelola harga paket |
| 9 | Notifikasi | `/notifications` | 🔔 | Notifikasi sistem |
| 10 | Chat | `/chat` | 💬 | Komunikasi internal |

## 4.3 Dashboard Super Admin

### 4.3.1 Statistik Utama (Quick Stats)
Dashboard menampilkan 6 kartu statistik:

| Statistik | Deskripsi |
|-----------|-----------|
| Total Cabang | Jumlah cabang terdaftar (aktif/total) |
| Total Staff | Jumlah pengguna sistem (aktif/total) |
| Total Member | Jumlah member terdaftar (aktif/total) |
| Master Produk | Jumlah produk master (aktif/total) |
| Total Pendapatan | Revenue keseluruhan + bulanan |
| Total Sesi Terapi | Jumlah sesi (total + bulan ini) |

### 4.3.2 Tab Overview
- **Master Data**: Link ke Master Produk dan Manajemen Cabang
- **Manajemen User**: Link ke Kelola User + Distribusi Role
- **Monitoring Sistem**: Link ke Audit Logs dan Performa Cabang
- **Aktivitas Terbaru**: 10 aktivitas terakhir sistem

### 4.3.3 Tab Admin Managers
Menampilkan daftar Admin Manager dengan:
- Nama dan email
- Cabang yang dikelola
- Status aktif/nonaktif
- Aksi: Lihat detail, Edit, Nonaktifkan

### 4.3.4 Aksi Cepat
- Tambah Produk
- Tambah Cabang
- Tambah User
- Lihat Audit Log
- Refresh Data

## 4.4 Fitur-Fitur Super Admin

### 4.4.1 Kelola Admin Manager

**Langkah Melihat Daftar Admin Manager:**
1. Buka Dashboard Super Admin
2. Klik tab **"Admin Managers"**
3. Lihat daftar Admin Manager yang terdaftar

**Langkah Melihat Detail Admin Manager:**
1. Klik nama Admin Manager dari daftar
2. Lihat informasi detail:
   - Data pribadi
   - Cabang yang dikelola
   - Statistik aktivitas

**Langkah Assign Cabang ke Admin Manager:**
1. Buka detail Admin Manager
2. Klik **"Tambah Cabang"**
3. Pilih cabang yang akan diassign
4. Klik **"Simpan"**

### 4.4.2 Kelola Master Products

**Langkah Menambah Produk Baru:**
1. Buka menu **Master Produk** (`/admin/master-products`)
2. Klik tombol **"+ Tambah Produk"**
3. Isi form:
   - **Nama Produk**: Nama lengkap produk
   - **SKU**: Kode unik produk
   - **Kategori**: INFUSION_MATERIALS / MEDICAL_SUPPLIES / CONSUMABLES / EQUIPMENT
   - **Unit**: Satuan (Ampul, Vial, Pcs, Pack, dll)
   - **Harga**: Harga per unit
   - **Deskripsi**: Keterangan produk (opsional)
4. Klik **"Simpan"**

**Langkah Edit Produk:**
1. Cari produk di daftar
2. Klik tombol **"Edit"**
3. Ubah data yang diperlukan
4. Klik **"Simpan Perubahan"**

**Langkah Nonaktifkan Produk:**
1. Cari produk di daftar
2. Klik tombol **"Nonaktifkan"**
3. Konfirmasi aksi

### 4.4.3 Kelola Harga Paket per Cabang

**Langkah Mengatur Harga Paket:**
1. Buka menu **Harga Paket** (`/admin/package-pricing`)
2. Pilih cabang dari dropdown
3. Lihat daftar paket dengan harga saat ini
4. Klik **"Edit"** pada paket yang ingin diubah
5. Masukkan harga baru
6. Klik **"Simpan"**

### 4.4.4 Lihat Audit Logs

**Langkah Melihat Audit Log:**
1. Buka menu **Audit Log** (`/admin/audit-logs`)
2. Gunakan filter:
   - **User**: Filter berdasarkan pengguna
   - **Action**: LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VERIFY
   - **Tanggal**: Range tanggal
3. Klik baris untuk melihat detail

### 4.4.5 Kelola Cabang

**Langkah Melihat Detail Cabang:**
1. Buka menu **Pengaturan Cabang** (`/branches`)
2. Klik nama cabang
3. Lihat tab-tab:
   - **Overview**: Statistik cabang
   - **Member**: Daftar member cabang
   - **Staff**: Daftar staff cabang
   - **Inventory**: Stok cabang
   - **Managers**: Admin Manager yang mengelola

---

# BAB 5: PANDUAN ADMIN MANAGER

## 5.1 Overview

Admin Manager adalah role yang mengelola multiple cabang. Satu Admin Manager dapat mengelola beberapa cabang sekaligus.

## 5.2 Menu yang Tersedia

| No | Menu | Path | Icon | Fungsi |
|----|------|------|------|--------|
| 1 | Dashboard | `/dashboard/admin-manager` | 🏢 | Overview multi-cabang |
| 2 | Member | `/members` | 👥 | Kelola member semua cabang |
| 3 | Request Stok | `/inventory/stock-requests` | 📋 | Review request stok |
| 4 | Pengiriman | `/inventory/shipments` | 🚚 | Kelola pengiriman |
| 5 | Pengaturan Cabang | `/branches` | 🏢 | Kelola cabang |
| 6 | Kinerja Staff | `/staff-performance` | 📊 | Performa staff |
| 7 | Kode Referral | `/referrals` | 📄 | Kelola referral |
| 8 | Notifikasi | `/notifications` | 🔔 | Notifikasi |
| 9 | Chat | `/chat` | 💬 | Komunikasi |

## 5.3 Dashboard Admin Manager

### 5.3.1 Summary Cards (Agregat Semua Cabang)
| Kartu | Deskripsi |
|-------|-----------|
| Total Cabang | Jumlah cabang yang dikelola |
| Member Aktif | Total member aktif dari semua cabang |
| Sesi Selesai | Total sesi selesai dari semua cabang |
| Admin Cabang | Jumlah Admin Cabang yang dikelola |

### 5.3.2 Total Revenue Card
- Total revenue dari semua cabang
- Growth indicator (% vs bulan lalu)
- Total kumulatif

### 5.3.3 Perbandingan Performa Cabang
Untuk setiap cabang menampilkan:
- Nama dan tipe cabang (PUSAT/CABANG)
- Lokasi (kota)
- Growth indicator
- Statistik: Member Aktif, Sesi Selesai, Revenue, Pending, Staff

### 5.3.4 Quick Actions
- Kelola Cabang
- Admin Cabang
- Semua Member
- Semua Sesi

## 5.4 Fitur-Fitur Admin Manager

### 5.4.1 Multi-Branch Overview

**Cara Melihat Performa Cabang:**
1. Buka Dashboard Admin Manager
2. Scroll ke bagian **"Perbandingan Performa Cabang"**
3. Lihat statistik setiap cabang
4. Klik cabang untuk melihat detail

**Filter Periode:**
- Hari Ini
- 7 Hari Terakhir
- Bulan Ini

### 5.4.2 Review Stock Request

**Langkah Review Request:**
1. Buka menu **Request Stok** (`/inventory/stock-requests`)
2. Lihat daftar request dari cabang yang dikelola
3. Klik request untuk melihat detail
4. Review item yang diminta
5. Pilih aksi:
   - **Approve**: Setujui request
   - **Reject**: Tolak request (wajib isi alasan)

**Langkah Proses Pengiriman:**
1. Setelah approve, buka menu **Pengiriman**
2. Cari request yang sudah approved
3. Klik **"Proses Kirim"**
4. Isi detail pengiriman
5. Klik **"Kirim"**

### 5.4.3 Kelola Admin Cabang

**Langkah Melihat Admin Cabang:**
1. Buka halaman **Kelola Admin Cabang** (`/admin-manager`)
2. Lihat daftar Admin Cabang di cabang yang dikelola
3. Lihat statistik aktivitas masing-masing

### 5.4.4 Grant Multi-Branch Access untuk Member

**Langkah Menambah Akses Cabang:**
1. Buka menu **Member**
2. Cari dan klik member
3. Buka tab **"Profil"**
4. Klik **"Tambah Akses Cabang"**
5. Pilih cabang tambahan
6. Klik **"Simpan"**

> **Catatan**: Member dengan multi-branch access dapat treatment di cabang manapun yang diizinkan.

### 5.4.5 Lihat Performa Staff

**Langkah Melihat Performa:**
1. Buka menu **Kinerja Staff** (`/staff-performance`)
2. Pilih cabang (atau semua cabang)
3. Pilih periode waktu
4. Lihat statistik per staff:
   - Jumlah sesi yang ditangani
   - Completion rate
   - Revenue yang dihasilkan

---

# BAB 6: PANDUAN ADMIN CABANG

## 6.1 Overview

Admin Cabang adalah role yang mengelola satu cabang spesifik. Bertanggung jawab atas operasional cabang, staff, dan inventory.

## 6.2 Menu yang Tersedia

| No | Menu | Path | Icon | Fungsi |
|----|------|------|------|--------|
| 1 | Dashboard | `/dashboard` | 📊 | Overview cabang |
| 2 | Member | `/members` | 👥 | Kelola member |
| 3 | Sesi Terapi | `/sessions` | 💉 | Kelola sesi |
| 4 | Stok | `/inventory` | 📦 | Lihat stok |
| 5 | Request Stok | `/inventory/stock-requests` | 📋 | Request stok |
| 6 | Pengiriman | `/inventory/shipments` | 🚚 | Terima pengiriman |
| 7 | Kelola Staff | `/staff` | 👤 | Kelola staff |
| 8 | Kinerja Staff | `/staff-performance` | 📊 | Performa staff |
| 9 | Kode Referral | `/referrals` | 📄 | Kelola referral |
| 10 | Harga Paket | `/admin/package-pricing` | 💰 | Harga paket |
| 11 | Notifikasi | `/notifications` | 🔔 | Notifikasi |
| 12 | Chat | `/chat` | 💬 | Komunikasi |

## 6.3 Dashboard Admin Cabang

### 6.3.1 Revenue Card (Full Width)
- Total Revenue dengan growth indicator
- Perbandingan dengan periode sebelumnya

### 6.3.2 Main Stats Grid (3 Kolom)
| Statistik | Deskripsi |
|-----------|-----------|
| Paket Terjual | Jumlah paket terjual + aktif |
| Member Aktif | Member aktif dari total |
| Transaksi | Jumlah transaksi + rata-rata |

### 6.3.3 Secondary Stats Grid (4 Kolom)
| Statistik | Deskripsi |
|-----------|-----------|
| Sesi Selesai | Sesi selesai dari total |
| Pending Payment | Paket menunggu bayar |
| Member Baru | Member baru bulan ini |
| Total Staff | Jumlah staff cabang |

### 6.3.4 Grafik Revenue
Visualisasi pendapatan harian dalam periode yang dipilih

### 6.3.5 Transaksi Terbaru
Daftar 5 transaksi terakhir dengan:
- Nama member
- Nomor invoice
- Jumlah
- Status

## 6.4 Fitur-Fitur Admin Cabang

### 6.4.1 Kelola Staff Cabang

**Langkah Melihat Daftar Staff:**
1. Buka menu **Kelola Staff** (`/staff`)
2. Lihat daftar staff cabang dengan:
   - Nama dan role
   - Email
   - Status aktif/nonaktif
   - Tanggal bergabung

**Langkah Menambah Staff:**
1. Klik tombol **"+ Tambah Staff"**
2. Isi form:
   - Nama lengkap
   - Email
   - Role (ADMIN_LAYANAN / DOCTOR / NURSE)
   - Password awal
3. Klik **"Simpan"**

**Langkah Nonaktifkan Staff:**
1. Cari staff di daftar
2. Klik tombol **"Nonaktifkan"**
3. Konfirmasi aksi

### 6.4.2 Request Stok ke Pusat

**Langkah Membuat Request:**
1. Buka menu **Request Stok** (`/inventory/stock-requests`)
2. Klik tombol **"+ Buat Request"**
3. Pilih item dari daftar Master Product
4. Masukkan jumlah yang dibutuhkan
5. Tambahkan catatan (opsional)
6. Klik **"Kirim Request"**

**Status Request:**
- **PENDING**: Menunggu review
- **APPROVED**: Disetujui, menunggu kirim
- **REJECTED**: Ditolak
- **SHIPPED**: Sudah dikirim
- **RECEIVED**: Sudah diterima

### 6.4.3 Terima Shipment

**Langkah Menerima Pengiriman:**
1. Buka menu **Pengiriman** (`/inventory/shipments`)
2. Cari shipment dengan status **"SHIPPED"**
3. Klik tombol **"Terima"**
4. Verifikasi item dan jumlah yang diterima
5. Jika ada selisih, catat di kolom catatan
6. Klik **"Konfirmasi Penerimaan"**
7. Stok cabang akan otomatis bertambah

### 6.4.4 Kelola Harga Paket Cabang

**Langkah Mengatur Harga:**
1. Buka menu **Harga Paket** (`/admin/package-pricing`)
2. Lihat daftar paket dengan harga saat ini
3. Klik **"Edit"** pada paket
4. Masukkan harga baru
5. Klik **"Simpan"**

> **Catatan**: Perubahan harga hanya berlaku untuk paket baru, tidak mempengaruhi paket yang sudah dibeli.

### 6.4.5 Kelola Kode Referral

**Langkah Menambah Kode Referral:**
1. Buka menu **Kode Referral** (`/referrals`)
2. Klik **"+ Tambah Referral"**
3. Isi form:
   - Kode referral (unik)
   - Nama referrer
   - Tipe: DOKTER / KLINIK / AGENT / INFLUENCER / CORPORATE
   - Persentase komisi
4. Klik **"Simpan"**

---

# BAB 7: PANDUAN ADMIN LAYANAN

## 7.1 Overview

Admin Layanan adalah role utama untuk operasional harian klinik. Bertanggung jawab atas registrasi member, assign paket, verifikasi pembayaran, dan pembuatan sesi terapi.

## 7.2 Menu yang Tersedia

| No | Menu | Path | Icon | Fungsi |
|----|------|------|------|--------|
| 1 | Dashboard | `/dashboard/admin-layanan` | 📊 | Overview harian |
| 2 | Member | `/members` | 👥 | Kelola member |
| 3 | Sesi Terapi | `/sessions` | 💉 | Kelola sesi |
| 4 | Stok | `/inventory` | 📦 | Lihat stok |
| 5 | Notifikasi | `/notifications` | 🔔 | Notifikasi |
| 6 | Chat | `/chat` | 💬 | Komunikasi |

## 7.3 Dashboard Admin Layanan

### 7.3.1 Today Stats (4 Kartu)
| Statistik | Deskripsi |
|-----------|-----------|
| Sesi Hari Ini | Total sesi + yang selesai |
| Pending Payment | Paket menunggu bayar |
| Member Aktif | Jumlah member aktif |
| Revenue Minggu Ini | Pendapatan minggu berjalan |

### 7.3.2 Jadwal Sesi Hari Ini
Tabel dengan kolom:
- Waktu
- Member (nama + nomor)
- Paket (BASIC/BOOSTER)
- Dokter
- Status (Terjadwal/Berlangsung/Selesai)

### 7.3.3 Pembayaran Pending
Daftar invoice yang perlu diverifikasi:
- Nama member
- Nomor invoice
- Jumlah hari overdue
- Nominal

### 7.3.4 Perlu Follow-up
Daftar member yang perlu ditindaklanjuti:
- Nama dan nomor member
- Alasan follow-up

### 7.3.5 Statistik Minggu Ini
- Sesi Selesai
- Member Baru
- Paket Terjual
- Revenue

## 7.4 Fitur-Fitur Admin Layanan

### 7.4.1 Registrasi Member Baru

**Langkah-langkah:**
1. Buka menu **Member** (`/members`)
2. Klik tombol **"+ Tambah Member"**
3. Isi form registrasi:

**Tab Data Pribadi:**
| Field | Keterangan | Wajib |
|-------|------------|-------|
| Nama Lengkap | Nama sesuai KTP | ✅ |
| Email | Email aktif untuk login | ✅ |
| No. HP | Nomor WhatsApp aktif | ✅ |
| Tanggal Lahir | Format: DD/MM/YYYY | ✅ |
| Gender | Laki-laki / Perempuan | ✅ |
| NIK | Nomor KTP (16 digit) | ❌ |

**Tab Alamat:**
| Field | Keterangan | Wajib |
|-------|------------|-------|
| Alamat | Alamat lengkap | ✅ |
| Kota | Kota domisili | ✅ |
| Kode Pos | 5 digit | ❌ |

**Tab Data Medis:**
| Field | Keterangan | Wajib |
|-------|------------|-------|
| Golongan Darah | A/B/AB/O (+/-) | ❌ |
| Alergi | Daftar alergi | ❌ |
| Riwayat Penyakit | Penyakit yang pernah diderita | ❌ |
| Obat Rutin | Obat yang sedang dikonsumsi | ❌ |

**Tab Lainnya:**
| Field | Keterangan | Wajib |
|-------|------------|-------|
| Kode Referral | Kode dari referrer | ❌ |
| Foto | Upload foto member | ❌ |

4. Klik **"Simpan"**
5. Sistem akan generate nomor member otomatis (format: M-[CABANG]-XXXXX)

### 7.4.2 Assign Paket ke Member

**Langkah-langkah:**
1. Buka detail member (klik nama dari daftar)
2. Klik tab **"Paket"**
3. Klik tombol **"+ Assign Paket"**
4. Pilih tipe paket:
   - **BASIC**: Paket dasar (B1-B9)
   - **BOOSTER**: Paket tambahan (Vitamin C, Glutathione, dll)
5. Pilih varian paket (jumlah sesi)
6. Tambahkan **Add-On** jika diperlukan:
   - Air Nano (pilih ukuran)
   - Konsultasi Gizi
   - Konsultasi Psikolog
   - Rokok Kenkou
7. Masukkan **Diskon** (jika ada):
   - Diskon persentase (%)
   - Diskon nominal (Rp)
8. Review total harga di bagian bawah
9. Klik **"Assign Paket"**
10. Status paket: **PENDING_PAYMENT**

### 7.4.3 Upload Bukti Pembayaran

**Langkah-langkah:**
1. Buka detail member → tab **"Paket"**
2. Cari paket dengan status **PENDING_PAYMENT**
3. Klik tombol **"Upload Bukti Bayar"**
4. Pilih file:
   - Format: JPG, PNG, atau PDF
   - Ukuran maksimal: 5MB
5. Klik **"Upload"**
6. Status berubah menjadi **PENDING_VERIFICATION**

### 7.4.4 Verifikasi Pembayaran

**Langkah-langkah:**
1. Buka detail member → tab **"Paket"**
2. Cari paket dengan bukti pembayaran (ada icon 📎)
3. Klik tombol **"Verifikasi"**
4. Modal akan menampilkan:
   - Bukti pembayaran (gambar/PDF)
   - Detail paket
   - Total yang harus dibayar
5. Verifikasi jumlah pembayaran sesuai
6. Klik **"Verifikasi Pembayaran"**
7. Status paket berubah menjadi **ACTIVE**
8. Invoice otomatis dibuat dengan status **PAID**

### 7.4.5 Edit Paket (Sebelum Pembayaran)

**Langkah-langkah:**
1. Buka detail member → tab **"Paket"**
2. Cari paket dengan status **PENDING_PAYMENT**
3. Klik tombol **"Edit"**
4. Ubah detail paket:
   - Tambah/hapus add-on
   - Ubah diskon
5. Klik **"Simpan Perubahan"**

> ⚠️ **Catatan**: Paket yang sudah ACTIVE tidak bisa diedit

### 7.4.6 Batalkan Paket

**Langkah-langkah:**
1. Buka detail member → tab **"Paket"**
2. Cari paket dengan status **PENDING_PAYMENT**
3. Klik tombol **"Batalkan"**
4. Masukkan alasan pembatalan
5. Klik **"Konfirmasi Pembatalan"**
6. Status berubah menjadi **CANCELLED**

### 7.4.7 Refund Paket

**Langkah-langkah:**
1. Buka detail member → tab **"Paket"**
2. Cari paket dengan status **ACTIVE**
3. Klik tombol **"Refund"**
4. Masukkan jumlah refund (tidak boleh melebihi harga paket)
5. Masukkan alasan refund
6. Klik **"Proses Refund"**

### 7.4.8 Buat Sesi Terapi

**Langkah-langkah:**
1. Buka detail member → tab **"Sesi Terapi"**
2. Klik tombol **"+ Buat Sesi"**
3. Isi form:

| Field | Keterangan | Wajib |
|-------|------------|-------|
| Paket | Pilih paket ACTIVE yang akan digunakan | ✅ |
| Tanggal Treatment | Tanggal pelaksanaan | ✅ |
| Waktu | Jam pelaksanaan | ✅ |
| Tipe Pelaksanaan | ON_SITE (di klinik) / HOME_CARE | ✅ |
| Dokter | Pilih dokter yang bertugas | ✅ |
| Perawat | Pilih perawat yang bertugas | ✅ |
| Catatan | Catatan tambahan | ❌ |

4. Klik **"Buat Sesi"**
5. Sesi dibuat dengan status **SCHEDULED**
6. Sisa sesi paket berkurang 1

### 7.4.9 Lihat Stok Material

**Langkah-langkah:**
1. Buka menu **Stok** (`/inventory`)
2. Lihat daftar item dengan:
   - Nama item
   - SKU
   - Kategori
   - Stok saat ini
   - Unit
   - Status (Normal/Low/Out of Stock)
3. Gunakan filter untuk mencari item spesifik

---

# BAB 8: PANDUAN DOKTER

## 8.1 Overview

Dokter bertanggung jawab atas diagnosis, therapy plan, dan evaluasi akhir sesi terapi. Dokter mengerjakan Step 1, Step 2, dan Step 8 dalam workflow sesi.

## 8.2 Menu yang Tersedia

| No | Menu | Path | Icon | Fungsi |
|----|------|------|------|--------|
| 1 | Dashboard | `/dashboard/doctor` | 🩺 | Overview sesi |
| 2 | Member | `/members` | 👥 | Lihat data member |
| 3 | Sesi Terapi | `/sessions` | 💉 | Daftar sesi |
| 4 | Stok | `/inventory` | 📦 | Lihat stok |
| 5 | Notifikasi | `/notifications` | 🔔 | Notifikasi |
| 6 | Chat | `/chat` | 💬 | Komunikasi |

## 8.3 Dashboard Dokter

### 8.3.1 Stats Grid (4 Kartu)
| Statistik | Deskripsi |
|-----------|-----------|
| Sesi Hari Ini | Total sesi yang ditugaskan |
| Selesai | Jumlah sesi yang sudah selesai |
| Berlangsung | Sesi yang sedang berjalan |
| Completion Rate | Persentase penyelesaian bulan ini |

### 8.3.2 Jadwal Sesi Hari Ini
Daftar sesi dengan:
- Waktu
- Nama member
- Tipe paket (BASIC/BOOSTER)
- Infus ke-X
- Tipe pelaksanaan (Di Klinik/Home Care)
- Status (Terjadwal/Berlangsung/Selesai)

### 8.3.3 Pasien Terbaru
Tabel pasien yang baru ditangani:
- Nama dan nomor member
- Tipe paket
- Progress sesi
- Tanggal sesi terakhir

## 8.4 Fitur-Fitur Dokter

### 8.4.1 Input Diagnosis (Step 1)

**Langkah-langkah:**
1. Buka menu **Sesi Terapi** atau klik sesi dari Dashboard
2. Klik sesi yang akan dikerjakan
3. Klik **"Step 1: Diagnosis"**
4. Isi form diagnosis:

| Field | Keterangan | Wajib |
|-------|------------|-------|
| Keluhan Utama | Keluhan yang disampaikan pasien | ✅ |
| Riwayat Penyakit Sekarang | Kronologi keluhan | ❌ |
| Riwayat Penyakit Dahulu | Penyakit yang pernah diderita | ❌ |
| Riwayat Pengobatan | Obat yang sedang/pernah dikonsumsi | ❌ |
| Pemeriksaan Fisik | Hasil pemeriksaan | ✅ |
| Diagnosis | Diagnosis dokter | ✅ |
| Kode ICD-10 Primer | Kode diagnosis utama | ❌ |
| Kode ICD-10 Sekunder | Kode diagnosis tambahan | ❌ |
| Kode ICD-10 Tersier | Kode diagnosis tambahan | ❌ |
| Kategori Diagnosis | Pilih kategori | ✅ |

5. Klik **"Simpan Diagnosis"**
6. Step 1 selesai, lanjut ke Step 2

### 8.4.2 Buat Therapy Plan (Step 2)

**Langkah-langkah:**
1. Buka detail sesi
2. Klik **"Step 2: Therapy Plan"**
3. Isi rencana terapi:

| Field | Keterangan | Wajib |
|-------|------------|-------|
| Jenis Terapi | Pilih jenis terapi | ✅ |
| Material | Pilih material dari inventory | ✅ |
| Dosis | Tentukan dosis per material | ✅ |
| Kecepatan Infus | Tetes per menit (rekomendasi) | ❌ |
| Durasi | Estimasi durasi infus | ❌ |
| Catatan untuk Perawat | Instruksi khusus | ❌ |

4. Klik **"+ Tambah Material"** untuk menambah material lain
5. Klik **"Simpan Therapy Plan"**
6. Step 2 selesai, perawat dapat melanjutkan Step 3-7

### 8.4.3 Evaluasi Akhir (Step 8)

**Langkah-langkah:**
1. Buka detail sesi (setelah Step 1-7 selesai)
2. Klik **"Step 8: Evaluasi"**
3. Isi evaluasi SOAP:

| Field | Keterangan | Wajib |
|-------|------------|-------|
| **Subjective** | Keluhan pasien setelah treatment | ✅ |
| **Objective** | Hasil pemeriksaan setelah treatment | ✅ |
| **Assessment** | Penilaian dokter terhadap kondisi | ✅ |
| **Plan** | Rencana tindak lanjut | ✅ |
| Rekomendasi | Saran untuk sesi berikutnya | ❌ |
| Catatan Tambahan | Catatan lainnya | ❌ |

4. Review perbandingan vital signs (before vs after)
5. Klik **"Simpan Evaluasi"**
6. Sesi selesai dengan status **COMPLETED**

### 8.4.4 Lihat Riwayat Medis Member

**Langkah-langkah:**
1. Buka menu **Member**
2. Cari dan klik member
3. Lihat tab-tab:
   - **Profil**: Data pribadi dan medis
   - **Diagnosa**: Riwayat semua diagnosis
   - **Therapy Plan**: Riwayat rencana terapi
   - **Sesi**: Riwayat semua sesi

### 8.4.5 Lihat Stok Material

**Langkah-langkah:**
1. Buka menu **Stok** (`/inventory`)
2. Lihat ketersediaan material untuk therapy plan
3. Jika stok rendah, informasikan ke Admin Cabang

---

# BAB 9: PANDUAN PERAWAT

## 9.1 Overview

Perawat bertanggung jawab atas eksekusi treatment, pencatatan vital signs, penggunaan material, dan dokumentasi foto. Perawat mengerjakan Step 3, Step 4, Step 5, Step 6, dan Step 7 dalam workflow sesi.

## 9.2 Menu yang Tersedia

| No | Menu | Path | Icon | Fungsi |
|----|------|------|------|--------|
| 1 | Dashboard | `/dashboard/nurse` | ❤️ | Overview sesi |
| 2 | Member | `/members` | 👥 | Lihat data member |
| 3 | Sesi Terapi | `/sessions` | 💉 | Daftar sesi |
| 4 | Stok | `/inventory` | 📦 | Lihat stok |
| 5 | Notifikasi | `/notifications` | 🔔 | Notifikasi |
| 6 | Chat | `/chat` | 💬 | Komunikasi |

## 9.3 Dashboard Perawat

### 9.3.1 Stats Grid (4 Kartu)
| Statistik | Deskripsi |
|-----------|-----------|
| Sesi Hari Ini | Total sesi yang ditugaskan |
| Selesai | Jumlah sesi yang sudah selesai |
| Berlangsung | Sesi yang sedang berjalan |
| Material Dipakai | Jumlah material yang digunakan hari ini |

### 9.3.2 Sesi Aktif
Daftar sesi yang sedang berlangsung dengan:
- Nama member dan kode sesi
- Nama dokter
- Infus ke-X
- Vital signs terakhir (Sistol, Diastol, HR, SpO2)
- Tombol "Lanjutkan Sesi"

### 9.3.3 Sesi Mendatang
Daftar sesi yang akan datang:
- Waktu
- Nama member
- Nama dokter
- Infus ke-X

### 9.3.4 Stok Material
Overview stok dengan alert untuk item yang rendah:
- Nama item
- Stok saat ini
- Unit
- Indikator low stock (⚠️)

## 9.4 Fitur-Fitur Perawat

### 9.4.1 Catat Vital Signs Sebelum Treatment (Step 3)

**Langkah-langkah:**
1. Buka detail sesi (setelah dokter selesai Step 1-2)
2. Klik **"Step 3: Vital Signs (Before)"**
3. Isi data vital:

| Field | Satuan | Range Normal | Wajib |
|-------|--------|--------------|-------|
| Tekanan Darah Sistolik | mmHg | 90-140 | ✅ |
| Tekanan Darah Diastolik | mmHg | 60-90 | ✅ |
| Nadi (Heart Rate) | bpm | 60-100 | ✅ |
| Suhu | °C | 36.0-37.5 | ✅ |
| Respirasi | x/menit | 12-20 | ✅ |
| SpO2 (Saturasi Oksigen) | % | 95-100 | ✅ |
| Berat Badan | kg | - | ❌ |
| Tinggi Badan | cm | - | ❌ |

4. Klik **"Simpan Vital Signs"**
5. Step 3 selesai, lanjut ke Step 4

### 9.4.2 Eksekusi Infusion (Step 4)

**Langkah-langkah:**
1. Buka detail sesi
2. Klik **"Step 4: Infusion"**
3. Lihat therapy plan dari dokter (material dan dosis)
4. Isi detail infusi:

| Field | Keterangan | Wajib |
|-------|------------|-------|
| Waktu Mulai | Jam mulai infusi | ✅ |
| Waktu Selesai | Jam selesai infusi | ✅ |
| Kecepatan Tetes | Tetes per menit | ✅ |
| Volume Total | Total cairan (ml) | ❌ |
| Catatan | Catatan selama infusi | ❌ |

5. Jika ada reaksi/kejadian, catat di kolom catatan
6. Klik **"Simpan Data Infusi"**
7. Step 4 selesai, lanjut ke Step 5

### 9.4.3 Catat Penggunaan Material (Step 5)

**Langkah-langkah:**
1. Buka detail sesi
2. Klik **"Step 5: Material Usage"**
3. Lihat daftar material dari therapy plan
4. Untuk setiap material:
   - Pilih item dari inventory
   - Masukkan jumlah yang digunakan
   - Pilih batch/lot number (jika ada)
5. Klik **"+ Tambah Material"** untuk material tambahan
6. Klik **"Simpan Penggunaan Material"**
7. Stok inventory akan otomatis berkurang
8. Step 5 selesai, lanjut ke Step 6

> ⚠️ **Penting**: Pastikan mencatat semua material yang digunakan untuk tracking inventory yang akurat.

### 9.4.4 Upload Foto Sesi (Step 6)

**Langkah-langkah:**
1. Buka detail sesi
2. Klik **"Step 6: Session Photo"**
3. Klik **"Upload Foto"**
4. Pilih foto:
   - Format: JPG atau PNG
   - Ukuran maksimal: 5MB
   - Rekomendasi: Foto area infus, kondisi pasien
5. Tambahkan caption/keterangan (opsional)
6. Klik **"Upload"**
7. Dapat upload multiple foto
8. Step 6 selesai, lanjut ke Step 7

### 9.4.5 Catat Vital Signs Setelah Treatment (Step 7)

**Langkah-langkah:**
1. Buka detail sesi
2. Klik **"Step 7: Vital Signs (After)"**
3. Isi data vital setelah treatment (sama seperti Step 3)
4. Sistem akan menampilkan perbandingan:
   - Vital Before vs After
   - Indikator perubahan (naik/turun)
5. Klik **"Simpan Vital Signs"**
6. Step 7 selesai, dokter dapat melanjutkan Step 8

### 9.4.6 Lihat Stok Material

**Langkah-langkah:**
1. Buka menu **Stok** (`/inventory`)
2. Lihat ketersediaan material
3. Perhatikan item dengan status **Low Stock** (⚠️)
4. Informasikan ke Admin Cabang jika perlu request stok

---

# BAB 10: PANDUAN MEMBER

## 10.1 Overview

Member adalah pasien/klien yang terdaftar di sistem. Member dapat mengakses portal khusus untuk melihat informasi paket, riwayat sesi, invoice, dan voucher.

## 10.2 Menu yang Tersedia

| No | Menu | Path | Icon | Fungsi |
|----|------|------|------|--------|
| 1 | Dashboard | `/me/dashboard` | 🏠 | Overview pribadi |
| 2 | Profile | `/me/profile` | 👤 | Lihat & edit profil |
| 3 | Sessions | `/me/sessions` | 💉 | Riwayat sesi |
| 4 | Invoices | `/me/invoices` | 📄 | Daftar invoice |
| 5 | Vouchers | `/me/vouchers` | 🎫 | Voucher/paket |

## 10.3 Dashboard Member

### 10.3.1 Header Greeting
Sapaan personal dengan nama member

### 10.3.2 Stats Grid (4 Kartu)
| Statistik | Deskripsi |
|-----------|-----------|
| Voucher Tersisa | Jumlah sesi yang tersisa |
| Paket Aktif | Jumlah paket yang aktif |
| Total Sesi | Total sesi yang pernah dilakukan |
| Sesi Selesai | Jumlah sesi yang sudah selesai |

### 10.3.3 Paket Terapi Aktif
Kartu untuk setiap paket aktif:
- Tipe paket (BASIC/BOOSTER)
- Kode paket
- Nama cabang
- Sesi tersisa
- Progress bar (used/total)
- Masa berlaku

### 10.3.4 Sesi Terakhir
Informasi sesi terakhir:
- Kode sesi
- Infus ke-X
- Status (Selesai/Dalam Proses)
- Tanggal
- Nama dokter
- Lokasi dan tipe pelaksanaan

### 10.3.5 Invoice Terbaru
Daftar invoice terbaru:
- Nomor invoice
- Tanggal
- Nominal
- Status (Lunas/Pending/Belum Bayar)

### 10.3.6 Kontak Cabang
Informasi kontak cabang:
- Nama cabang
- Kota
- Nomor telepon
- Tombol WhatsApp
- Alamat lengkap

## 10.4 Fitur-Fitur Member

### 10.4.1 Lihat & Edit Profil

**Langkah Melihat Profil:**
1. Buka menu **Profile** (`/me/profile`)
2. Lihat informasi:
   - Foto profil
   - Nama lengkap
   - Email
   - Nomor telepon
   - Alamat
   - Data medis (golongan darah, alergi, dll)

**Langkah Edit Profil:**
1. Klik tombol **"Edit"**
2. Ubah data yang diizinkan:
   - Foto profil
   - Nomor telepon
   - Alamat
3. Klik **"Simpan"**

> ⚠️ **Catatan**: Email tidak dapat diubah. Hubungi admin jika perlu mengubah email.

### 10.4.2 Lihat Riwayat Sesi Terapi

**Langkah-langkah:**
1. Buka menu **Sessions** (`/me/sessions`)
2. Lihat daftar semua sesi terapi
3. Klik sesi untuk melihat detail:
   - Tanggal dan waktu treatment
   - Nama dokter dan perawat
   - Diagnosis
   - Vital signs (before & after)
   - Foto sesi
   - Evaluasi dokter

### 10.4.3 Lihat Invoice

**Langkah-langkah:**
1. Buka menu **Invoices** (`/me/invoices`)
2. Lihat daftar semua invoice
3. Klik invoice untuk melihat detail:
   - Nomor invoice
   - Tanggal
   - Detail item (paket, add-on)
   - Diskon (jika ada)
   - Total
   - Status pembayaran
4. Klik **"Download PDF"** untuk mengunduh invoice

### 10.4.4 Lihat Voucher/Paket

**Langkah-langkah:**
1. Buka menu **Vouchers** (`/me/vouchers`)
2. Lihat daftar paket:
   - Paket aktif dengan sisa sesi
   - Paket expired
   - Paket cancelled
3. Untuk setiap paket, lihat:
   - Tipe dan kode paket
   - Total sesi
   - Sesi terpakai
   - Sesi tersisa
   - Masa berlaku

### 10.4.5 Hubungi Cabang

**Via Telepon:**
1. Buka Dashboard
2. Scroll ke bagian **"Butuh Bantuan?"**
3. Klik nomor telepon untuk menelepon langsung

**Via WhatsApp:**
1. Buka Dashboard
2. Scroll ke bagian **"Butuh Bantuan?"**
3. Klik tombol **"WhatsApp"**
4. Akan membuka WhatsApp dengan nomor cabang

---

# BAB 11: FITUR UTAMA SISTEM

## 11.1 Workflow Sesi Terapi (8 Langkah)

### 11.1.1 Diagram Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW SESI TERAPI                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  STEP 1  │───▶│  STEP 2  │───▶│  STEP 3  │───▶│  STEP 4  │      │
│  │Diagnosis │    │ Therapy  │    │  Vital   │    │ Infusion │      │
│  │ (Dokter) │    │  Plan    │    │  Before  │    │(Perawat) │      │
│  │          │    │ (Dokter) │    │(Perawat) │    │          │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│                                                        │             │
│                                                        ▼             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │  STEP 8  │◀───│  STEP 7  │◀───│  STEP 6  │◀───│  STEP 5  │      │
│  │Evaluation│    │  Vital   │    │  Photo   │    │ Material │      │
│  │ (Dokter) │    │  After   │    │(Perawat) │    │  Usage   │      │
│  │          │    │(Perawat) │    │          │    │(Perawat) │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────┐                                                        │
│  │ COMPLETED│                                                        │
│  └──────────┘                                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.1.2 Detail Setiap Step

| Step | Nama | Pelaksana | Deskripsi | Output |
|------|------|-----------|-----------|--------|
| 1 | Diagnosis | Dokter | Input keluhan, pemeriksaan, diagnosis | Data diagnosis + ICD-10 |
| 2 | Therapy Plan | Dokter | Rencana terapi, material, dosis | Daftar material + instruksi |
| 3 | Vital Signs Before | Perawat | Catat vital sebelum treatment | Data vital awal |
| 4 | Infusion | Perawat | Eksekusi infusi | Waktu, kecepatan, catatan |
| 5 | Material Usage | Perawat | Catat penggunaan material | Stok berkurang |
| 6 | Session Photo | Perawat | Dokumentasi foto | Foto sesi |
| 7 | Vital Signs After | Perawat | Catat vital setelah treatment | Data vital akhir |
| 8 | Evaluation | Dokter | Evaluasi SOAP, rekomendasi | Sesi selesai |

## 11.2 Sistem Paket

### 11.2.1 Paket BASIC

| Kode | Nama | Sesi | Harga | Harga/Sesi |
|------|------|------|-------|------------|
| B1 | Basic 1 Sesi | 1 | Rp 150.000 | Rp 150.000 |
| B2 | Basic 2 Sesi | 2 | Rp 280.000 | Rp 140.000 |
| B3 | Basic 3 Sesi | 3 | Rp 400.000 | Rp 133.333 |
| B4 | Basic 4 Sesi | 4 | Rp 520.000 | Rp 130.000 |
| B5 | Basic 5 Sesi | 5 | Rp 625.000 | Rp 125.000 |
| B6 | Basic 6 Sesi | 6 | Rp 720.000 | Rp 120.000 |
| B7 | Basic 7 Sesi | 7 | Rp 805.000 | Rp 115.000 |
| B8 | Basic 8 Sesi | 8 | Rp 880.000 | Rp 110.000 |
| B9 | Basic 9 Sesi | 9 | Rp 945.000 | Rp 105.000 |

### 11.2.2 Paket BOOSTER

| Tipe | Kode | Deskripsi |
|------|------|-----------|
| VITAMIN_C | VC | Vitamin C Booster untuk imunitas |
| GLUTATHIONE | GT | Glutathione Booster untuk detox & kulit |
| COLLAGEN | CL | Collagen Booster untuk kulit & sendi |
| DETOX | DT | Detox Booster untuk pembersihan tubuh |
| IMMUNE | IM | Immune Booster untuk sistem imun |

**Varian Sesi Booster:**
| Sesi | Harga |
|------|-------|
| 1 Sesi | Rp 200.000 |
| 2 Sesi | Rp 380.000 |
| 3 Sesi | Rp 540.000 |
| 4 Sesi | Rp 680.000 |
| 5 Sesi | Rp 800.000 |
| 6 Sesi | Rp 900.000 |
| 7 Sesi | Rp 980.000 |

### 11.2.3 Add-On

| Nama | Harga | Keterangan |
|------|-------|------------|
| Air Nano 330ml | Rp 15.000 | Per botol |
| Air Nano 500ml | Rp 20.000 | Per botol |
| Air Nano 1L | Rp 35.000 | Per botol |
| Konsultasi Gizi | Rp 100.000 | Per sesi |
| Konsultasi Psikolog | Rp 150.000 | Per sesi |
| Rokok Kenkou Herbal | Rp 75.000 | Per pack |

## 11.3 Sistem Inventory

### 11.3.1 Kategori Produk

| Kategori | Kode | Contoh Item |
|----------|------|-------------|
| Bahan Infus | INFUSION_MATERIALS | Vitamin C, Glutathione, NaCl |
| Perlengkapan Medis | MEDICAL_SUPPLIES | Jarum, Selang Infus, Plester |
| Bahan Habis Pakai | CONSUMABLES | Kapas, Alkohol, Sarung Tangan |
| Peralatan | EQUIPMENT | Timbangan, Tensimeter |

### 11.3.2 Alur Stock Request

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CABANG    │────▶│   MANAGER   │────▶│   PUSAT     │
│   Request   │     │   Review    │     │   Ship      │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Approve /  │
                    │   Reject    │
                    └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐
│   CABANG    │◀────│   SHIPPED   │
│   Receive   │     │             │
└─────────────┘     └─────────────┘
```

### 11.3.3 Status Stock Request

| Status | Warna | Deskripsi | Aksi Selanjutnya |
|--------|-------|-----------|------------------|
| PENDING | 🟡 | Menunggu review | Manager review |
| APPROVED | 🟢 | Disetujui | Proses kirim |
| REJECTED | 🔴 | Ditolak | - |
| SHIPPED | 🔵 | Sudah dikirim | Cabang terima |
| RECEIVED | ✅ | Sudah diterima | Selesai |

## 11.4 Sistem Referral

### 11.4.1 Tipe Referrer

| Tipe | Komisi | Keterangan |
|------|--------|------------|
| DOKTER | 10% | Dokter yang merujuk pasien |
| KLINIK | 15% | Klinik partner |
| AGENT | 8% | Agen marketing |
| INFLUENCER | 12% | Influencer/KOL |
| CORPORATE | 20% | Perusahaan partner |

### 11.4.2 Cara Kerja Referral

1. Referrer mendaftar dan mendapat kode unik
2. Member baru menggunakan kode saat registrasi
3. Saat member membeli paket, komisi dihitung
4. Komisi = Persentase × Harga Paket (sebelum diskon)
5. Laporan komisi dapat dilihat di menu Referral

## 11.5 Multi-Branch Access

### 11.5.1 Siapa yang Bisa Multi-Branch?

| Role | Multi-Branch | Keterangan |
|------|--------------|------------|
| SUPER_ADMIN | ✅ | Akses semua cabang |
| ADMIN_MANAGER | ✅ | Cabang yang diassign |
| ADMIN_CABANG | ❌ | Hanya 1 cabang |
| ADMIN_LAYANAN | ❌ | Hanya 1 cabang |
| DOCTOR | ✅ | Bisa bekerja di multiple cabang |
| NURSE | ✅ | Bisa bekerja di multiple cabang |
| MEMBER | ✅ | Jika diberi akses tambahan |

---

# BAB 12: FAQ & TROUBLESHOOTING

## 12.1 Masalah Login

### Q: Tidak bisa login, muncul "Invalid credentials"
**A:** 
- Periksa email (case-sensitive untuk domain)
- Periksa password (case-sensitive)
- Pastikan tidak ada spasi di awal/akhir
- Coba reset browser cache

### Q: Akun terkunci setelah beberapa kali gagal login
**A:** 
- Tunggu 15 menit sebelum mencoba lagi
- Atau hubungi admin untuk unlock manual

### Q: Lupa password
**A:** 
- Hubungi Super Admin atau Admin Cabang
- Admin akan reset password ke default
- Login dan segera ganti password

### Q: Session expired saat sedang bekerja
**A:** 
- Access token berlaku 15 menit
- Sistem akan auto-refresh jika masih aktif
- Jika logout otomatis, login kembali

## 12.2 Masalah Member

### Q: Bagaimana cara menambah akses cabang untuk member?
**A:** 
- Hanya Admin Manager atau Super Admin yang bisa
- Buka detail member → Profil → Tambah Akses Cabang
- Pilih cabang → Simpan

### Q: Member tidak bisa login
**A:** 
- Pastikan email sudah benar saat registrasi
- Cek status member (aktif/nonaktif)
- Reset password jika perlu

### Q: Nomor member tidak muncul setelah registrasi
**A:** 
- Nomor member di-generate otomatis
- Refresh halaman jika tidak muncul
- Format: M-[CABANG]-XXXXX

## 12.3 Masalah Paket

### Q: Tidak bisa edit paket
**A:** 
- Paket hanya bisa diedit jika status PENDING_PAYMENT
- Paket ACTIVE tidak bisa diedit
- Gunakan fitur Refund jika perlu

### Q: Bagaimana cara bundle paket?
**A:** 
- Saat assign paket, pilih multiple paket sekaligus
- Sistem akan otomatis membundle
- Satu invoice untuk semua paket dalam bundle

### Q: Paket tidak bisa digunakan untuk sesi
**A:** 
- Pastikan status paket ACTIVE
- Pastikan masih ada sisa sesi
- Pastikan belum expired

## 12.4 Masalah Sesi Terapi

### Q: Tidak bisa lanjut ke step berikutnya
**A:** 
- Pastikan step sebelumnya sudah selesai
- Workflow harus sequential (1→2→3→...→8)
- Refresh halaman jika tombol tidak muncul

### Q: Material tidak muncul di Step 5
**A:** 
- Pastikan inventory cabang memiliki stok
- Pastikan material sudah ada di Master Product
- Hubungi Admin Cabang untuk request stok

### Q: Foto tidak bisa diupload di Step 6
**A:** 
- Pastikan format JPG atau PNG
- Ukuran maksimal 5MB
- Coba compress foto terlebih dahulu

### Q: Sesi tidak bisa diselesaikan
**A:** 
- Pastikan semua step 1-8 sudah selesai
- Cek apakah ada field wajib yang kosong
- Refresh dan coba lagi

## 12.5 Masalah Inventory

### Q: Stock request tidak diapprove
**A:** 
- Hubungi Admin Manager untuk follow up
- Cek apakah stok pusat mencukupi
- Lihat alasan reject jika ditolak

### Q: Stok tidak berkurang setelah treatment
**A:** 
- Pastikan Step 5 (Material Usage) sudah diisi
- Cek apakah material sudah disimpan
- Hubungi admin jika masih bermasalah

### Q: Item tidak muncul di daftar inventory
**A:** 
- Item harus ada di Master Product
- Pastikan item sudah di-assign ke cabang
- Hubungi Super Admin untuk menambah item

## 12.6 Masalah Pembayaran

### Q: Bukti pembayaran tidak bisa diupload
**A:** 
- Format: JPG, PNG, atau PDF
- Ukuran maksimal 5MB
- Pastikan file tidak corrupt

### Q: Invoice tidak muncul setelah verifikasi
**A:** 
- Invoice dibuat otomatis setelah verifikasi
- Refresh halaman
- Cek di tab Invoice member

---

## 12.7 Kontak Support

Jika mengalami masalah yang tidak tercantum di FAQ:

| Channel | Kontak | Jam Operasional |
|---------|--------|-----------------|
| Email | support@raho.id | 24 jam |
| WhatsApp | 0811-0000-0000 | 08:00-17:00 WIB |
| Telepon | 021-12345678 | 08:00-17:00 WIB |

---

# APPENDIX A: DATA REFERENSI

## A.1 Daftar Cabang

| Kode | Nama | Tipe | Alamat | Telepon | Email |
|------|------|------|--------|---------|-------|
| PST | RAHO Pusat | PUSAT | Jl. Sudirman No. 123, Jakarta Pusat | 021-12345678 | pusat@raho.com |
| BDG | RAHO Bandung | CABANG | Jl. Asia Afrika No. 456, Bandung | 022-87654321 | bandung@raho.com |
| SBY | RAHO Surabaya | CABANG | Jl. Pemuda No. 789, Surabaya | 031-11223344 | surabaya@raho.com |

## A.2 Produk Non-Terapi

### Air Nano
| No | Nama | Harga | Ukuran |
|----|------|-------|--------|
| 1 | Air Nano 330ml | Rp 15.000 | 330ml |
| 2 | Air Nano 500ml | Rp 20.000 | 500ml |
| 3 | Air Nano 600ml | Rp 25.000 | 600ml |
| 4 | Air Nano 1L | Rp 35.000 | 1 Liter |
| 5 | Air Nano 1.5L | Rp 45.000 | 1.5 Liter |
| 6 | Air Nano Galon 19L | Rp 150.000 | 19 Liter |
| 7 | Air Nano Premium 330ml | Rp 18.000 | 330ml |
| 8 | Air Nano Premium 500ml | Rp 25.000 | 500ml |
| 9 | Air Nano Premium 1L | Rp 40.000 | 1 Liter |
| 10 | Air Nano Alkaline 500ml | Rp 30.000 | 500ml |
| 11 | Air Nano Alkaline 1L | Rp 50.000 | 1 Liter |
| 12 | Air Nano Mineral 1L | Rp 35.000 | 1 Liter |

### Produk Lainnya
| No | Nama | Harga | Kategori |
|----|------|-------|----------|
| 1 | Rokok Kenkou Herbal | Rp 75.000 | ROKOK_KENKOU |

## A.3 Kode Referral Default

| Kode | Nama Referrer | Tipe | Komisi |
|------|---------------|------|--------|
| REF001 | Dr. Ahmad Referral | DOKTER | 10% |
| REF002 | Klinik Partner A | KLINIK | 15% |
| REF003 | Agent Marketing B | AGENT | 8% |
| REF004 | Influencer Health C | INFLUENCER | 12% |
| REF005 | Corporate Partner D | CORPORATE | 20% |
| REF006 | Dr. Sari Medical | DOKTER | 10% |
| REF007 | Beauty Clinic E | KLINIK | 15% |
| REF008 | Health Agent F | AGENT | 8% |

---

# APPENDIX B: STATUS & BADGE

## B.1 Status Paket

| Status | Warna | Badge | Deskripsi | Aksi yang Tersedia |
|--------|-------|-------|-----------|-------------------|
| PENDING_PAYMENT | 🟡 Kuning | `Menunggu Bayar` | Menunggu pembayaran | Upload bukti, Edit, Batalkan |
| PENDING_VERIFICATION | 🟠 Orange | `Menunggu Verifikasi` | Bukti sudah diupload | Verifikasi |
| ACTIVE | 🟢 Hijau | `Aktif` | Aktif, bisa digunakan | Buat sesi, Refund |
| EXPIRED | 🔴 Merah | `Kadaluarsa` | Masa berlaku habis | - |
| CANCELLED | ⚫ Abu-abu | `Dibatalkan` | Dibatalkan | - |
| REFUNDED | 🟣 Ungu | `Refund` | Sudah direfund | - |

## B.2 Status Sesi

| Status | Warna | Badge | Deskripsi |
|--------|-------|-------|-----------|
| SCHEDULED | 🔵 Biru | `Terjadwal` | Sesi sudah dijadwalkan |
| ONGOING | 🟡 Kuning | `Berlangsung` | Sesi sedang berjalan |
| COMPLETED | 🟢 Hijau | `Selesai` | Sesi sudah selesai |
| CANCELLED | ⚫ Abu-abu | `Dibatalkan` | Sesi dibatalkan |

## B.3 Status Invoice

| Status | Warna | Badge | Deskripsi |
|--------|-------|-------|-----------|
| DRAFT | ⚪ Putih | `Draft` | Invoice draft |
| PENDING | 🟡 Kuning | `Pending` | Menunggu pembayaran |
| PAID | 🟢 Hijau | `Lunas` | Sudah dibayar |
| CANCELLED | ⚫ Abu-abu | `Dibatalkan` | Invoice dibatalkan |

## B.4 Status Stock Request

| Status | Warna | Badge | Deskripsi |
|--------|-------|-------|-----------|
| PENDING | 🟡 Kuning | `Pending` | Menunggu review |
| APPROVED | 🟢 Hijau | `Disetujui` | Disetujui |
| REJECTED | 🔴 Merah | `Ditolak` | Ditolak |
| SHIPPED | 🔵 Biru | `Dikirim` | Sudah dikirim |
| RECEIVED | ✅ Hijau | `Diterima` | Sudah diterima |

## B.5 Status User

| Status | Warna | Badge | Deskripsi |
|--------|-------|-------|-----------|
| ACTIVE | 🟢 Hijau | `Aktif` | User aktif |
| INACTIVE | ⚫ Abu-abu | `Nonaktif` | User dinonaktifkan |

---

# APPENDIX C: ALUR KERJA

## C.1 Alur Registrasi Member Baru

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALUR REGISTRASI MEMBER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin Layanan buka menu Members                              │
│                    │                                             │
│                    ▼                                             │
│  2. Klik "Tambah Member"                                         │
│                    │                                             │
│                    ▼                                             │
│  3. Isi form registrasi (data pribadi, alamat, medis)           │
│                    │                                             │
│                    ▼                                             │
│  4. Upload foto (opsional)                                       │
│                    │                                             │
│                    ▼                                             │
│  5. Pilih referral code (opsional)                               │
│                    │                                             │
│                    ▼                                             │
│  6. Klik "Simpan"                                                │
│                    │                                             │
│                    ▼                                             │
│  7. Sistem generate nomor member (M-[CABANG]-XXXXX)             │
│                    │                                             │
│                    ▼                                             │
│  8. Member dapat login dengan email                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## C.2 Alur Assign & Aktivasi Paket

```
┌─────────────────────────────────────────────────────────────────┐
│                 ALUR ASSIGN & AKTIVASI PAKET                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin Layanan buka detail member                             │
│                    │                                             │
│                    ▼                                             │
│  2. Klik tab "Paket" → "Assign Paket"                           │
│                    │                                             │
│                    ▼                                             │
│  3. Pilih paket (BASIC/BOOSTER) + Add-on + Diskon               │
│                    │                                             │
│                    ▼                                             │
│  4. Klik "Assign" → Status: PENDING_PAYMENT                      │
│                    │                                             │
│                    ▼                                             │
│  5. Member/Admin upload bukti bayar                              │
│                    │                                             │
│                    ▼                                             │
│  6. Admin verifikasi pembayaran                                  │
│                    │                                             │
│                    ▼                                             │
│  7. Status: ACTIVE + Invoice dibuat (PAID)                       │
│                    │                                             │
│                    ▼                                             │
│  8. Paket siap digunakan untuk sesi terapi                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## C.3 Alur Sesi Terapi Lengkap

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALUR SESI TERAPI LENGKAP                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PERSIAPAN:                                                      │
│  1. Admin Layanan buat sesi baru                                 │
│  2. Assign dokter & perawat                                      │
│  3. Status: SCHEDULED                                            │
│                    │                                             │
│                    ▼                                             │
│  DOKTER (Step 1-2):                                              │
│  4. Dokter input diagnosis (Step 1)                              │
│  5. Dokter buat therapy plan (Step 2)                            │
│                    │                                             │
│                    ▼                                             │
│  PERAWAT (Step 3-7):                                             │
│  6. Perawat catat vital before (Step 3)                          │
│  7. Perawat eksekusi infusi (Step 4)                             │
│  8. Perawat catat material usage (Step 5)                        │
│  9. Perawat upload foto (Step 6)                                 │
│  10. Perawat catat vital after (Step 7)                          │
│                    │                                             │
│                    ▼                                             │
│  DOKTER (Step 8):                                                │
│  11. Dokter evaluasi SOAP (Step 8)                               │
│                    │                                             │
│                    ▼                                             │
│  SELESAI:                                                        │
│  12. Status: COMPLETED                                           │
│  13. Sisa sesi paket berkurang 1                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## C.4 Alur Stock Request

```
┌─────────────────────────────────────────────────────────────────┐
│                      ALUR STOCK REQUEST                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CABANG:                                                         │
│  1. Admin Cabang buat request                                    │
│  2. Pilih item & jumlah                                          │
│  3. Submit request → Status: PENDING                             │
│                    │                                             │
│                    ▼                                             │
│  MANAGER/PUSAT:                                                  │
│  4. Admin Manager/Pusat review                                   │
│  5. Approve atau Reject                                          │
│                    │                                             │
│         ┌─────────┴─────────┐                                    │
│         ▼                   ▼                                    │
│    APPROVED            REJECTED                                  │
│         │                   │                                    │
│         ▼                   ▼                                    │
│  6. Proses ship        (Selesai)                                 │
│         │                                                        │
│         ▼                                                        │
│  7. Status: SHIPPED                                              │
│         │                                                        │
│         ▼                                                        │
│  CABANG:                                                         │
│  8. Admin Cabang receive                                         │
│         │                                                        │
│         ▼                                                        │
│  9. Status: RECEIVED                                             │
│  10. Stok cabang bertambah                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# APPENDIX D: GLOSSARY

## D.1 Istilah Umum

| Istilah | Definisi |
|---------|----------|
| **Member** | Pasien/klien yang terdaftar di sistem RAHO |
| **Staff** | Pengguna sistem dengan role selain MEMBER |
| **Branch/Cabang** | Lokasi klinik RAHO (Pusat atau Cabang) |
| **Role** | Peran pengguna yang menentukan akses dan fitur |

## D.2 Istilah Paket & Pembayaran

| Istilah | Definisi |
|---------|----------|
| **Package/Paket** | Paket terapi yang dibeli member |
| **BASIC** | Tipe paket dasar dengan infus standar |
| **BOOSTER** | Tipe paket tambahan dengan vitamin/suplemen |
| **Add-On** | Layanan tambahan di luar paket utama |
| **Bundle** | Beberapa paket yang dibeli bersamaan |
| **Invoice** | Dokumen tagihan pembayaran |
| **Voucher** | Sesi yang tersisa dari paket yang dibeli |

## D.3 Istilah Sesi Terapi

| Istilah | Definisi |
|---------|----------|
| **Session/Sesi** | Satu kali sesi treatment |
| **Encounter** | Kunjungan member (bisa berisi multiple sessions) |
| **Infusion/Infus** | Proses pemberian cairan/obat melalui infus |
| **Vital Signs** | Tanda-tanda vital (tekanan darah, nadi, dll) |
| **Therapy Plan** | Rencana terapi yang dibuat dokter |
| **SOAP** | Format evaluasi medis (Subjective, Objective, Assessment, Plan) |
| **ICD-10** | Kode diagnosis internasional |
| **ON_SITE** | Pelaksanaan treatment di klinik |
| **HOME_CARE** | Pelaksanaan treatment di rumah pasien |

## D.4 Istilah Inventory

| Istilah | Definisi |
|---------|----------|
| **Master Product** | Daftar produk utama yang dikelola pusat |
| **Inventory Item** | Item stok di cabang |
| **Stock Request** | Permintaan stok dari cabang ke pusat |
| **Shipment** | Pengiriman stok dari pusat ke cabang |
| **SKU** | Stock Keeping Unit - kode unik produk |
| **Low Stock** | Stok di bawah batas minimum |

## D.5 Istilah Referral

| Istilah | Definisi |
|---------|----------|
| **Referral** | Sistem rujukan untuk mendapatkan insentif |
| **Referrer** | Pihak yang merujuk member baru |
| **Referral Code** | Kode unik untuk tracking rujukan |
| **Commission/Komisi** | Insentif yang didapat referrer |

## D.6 Istilah Teknis

| Istilah | Definisi |
|---------|----------|
| **Access Token** | Token untuk autentikasi API (15 menit) |
| **Refresh Token** | Token untuk memperbarui access token (7 hari) |
| **Audit Log** | Catatan aktivitas sistem |
| **Dashboard** | Halaman utama dengan ringkasan informasi |

---

<!-- Easter Egg: Made with ❤️ by Jovan Prabowo Kuncoro - https://github.com/Etherlyvan -->
