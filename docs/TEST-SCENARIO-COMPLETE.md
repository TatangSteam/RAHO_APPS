# Test Case Scenario - RAHO Premier Club

**Versi**: 2.0  
**Tanggal**: 22 Mei 2026  
**Aplikasi**: RAHO Premier Club Management System

---

## Daftar Isi

1. [Autentikasi & Otorisasi](#1-autentikasi--otorisasi)
2. [Dashboard](#2-dashboard)
3. [Manajemen Member](#3-manajemen-member)
4. [Manajemen Paket](#4-manajemen-paket)
5. [Sesi Terapi](#5-sesi-terapi)
6. [Invoice & Pembayaran](#6-invoice--pembayaran)
7. [Inventory & Stock Request](#7-inventory--stock-request)
8. [Referral](#8-referral)
9. [Manajemen Cabang](#9-manajemen-cabang)
10. [Admin & Super Admin](#10-admin--super-admin)
11. [Export Data](#11-export-data)
12. [Member Portal](#12-member-portal)

---

## Akun Test

## Pengguna Staff (Users)

### Super Admin & Manager (Cross-Branch)
| No | Email | Role | Nama Lengkap | Password | Cabang Primary |
|----|-------|------|--------------|----------|----------------|
| 1 | superadmin@raho.id | SUPER_ADMIN | Super Administrator | Sup3r4dM1n@123 | - (Semua) |
| 2 | manager1@raho.id | ADMIN_MANAGER | Admin Manager Regional 1 | Manager@123 | PST (Jakarta) |
| 3 | manager2@raho.id | ADMIN_MANAGER | Admin Manager Regional 2 | Manager@123 | SBY (Surabaya) |

**Catatan:**
- Super Admin dibuat melalui **essential seed** (production-safe)
- Admin Manager dibuat melalui **testing seed** (development only)

### Cabang Pusat Jakarta (PST) - 5 Staff
| No | Email | Role | Nama Lengkap | Password | Staff Code |
|----|-------|------|--------------|----------|------------|
| 1 | admincabang.pst@raho.id | ADMIN_CABANG | Admin Cabang Pusat | AdminCabang@123 | AC-20260413-PST1 |
| 2 | adminlayanan.pst@raho.id | ADMIN_LAYANAN | Admin Layanan Pusat | AdminLayanan@123 | AL-20260413-PST1 |
| 3 | dokter@raho.id | DOCTOR | dr. Ahmad Fauzi, SpPD | Dokter@123 | DR-20260413-SHARED1 |
| 4 | nakes@raho.id | NURSE | Siti Rahayu, Amd.Kep | Nakes@123 | NR-20260413-SHARED1 |
| 5 | - | - | - | - | - |

### Cabang Bandung (BDG) - 4 Staff
| No | Email | Role | Nama Lengkap | Password | Staff Code |
|----|-------|------|--------------|----------|------------|
| 1 | admincabang.bdg@raho.id | ADMIN_CABANG | Admin Cabang Bandung | AdminCabang@123 | AC-20260413-BDG1 |
| 2 | adminlayanan.bdg@raho.id | ADMIN_LAYANAN | Admin Layanan Bandung | AdminLayanan@123 | AL-20260413-BDG1 |
| 3 | dokter2@raho.id | DOCTOR | dr. Budi Santoso, SpPD | Dokter@123 | DR-20260413-SHARED2 |
| 4 | nakes2@raho.id | NURSE | Dewi Lestari, Amd.Kep | Nakes@123 | NR-20260413-SHARED2 |

### Cabang Surabaya (SBY) - 4 Staff
| No | Email | Role | Nama Lengkap | Password | Staff Code |
|----|-------|------|--------------|----------|------------|
| 1 | admincabang.sby@raho.id | ADMIN_CABANG | Admin Cabang Surabaya | AdminCabang@123 | AC-20260413-SBY1 |
| 2 | adminlayanan.sby@raho.id | ADMIN_LAYANAN | Admin Layanan Surabaya | AdminLayanan@123 | AL-20260413-SBY1 |
| 3 | dokter3@raho.id | DOCTOR | dr. Citra Wijaya, SpPD | Dokter@123 | DR-20260413-SHARED3 |
| 4 | nakes3@raho.id | NURSE | Eko Prasetyo, Amd.Kep | Nakes@123 | NR-20260413-SHARED3 |

**Total Staff**: 16 pengguna (3 Cross-Branch + 5 PST + 4 BDG + 4 SBY)

**Catatan:**
- SUPER_ADMIN tidak memiliki cabang (akses ke semua cabang)
- SUPER_ADMIN dapat melakukan impersonation ke Admin Manager dan Admin Cabang
- ADMIN_MANAGER memiliki cabang primary tapi bisa manage multiple branches via ManagerBranch table
- ADMIN_MANAGER dapat melakukan impersonation ke Admin Cabang di branches yang dikelola
- DOCTOR dan NURSE memiliki cabang primary tapi bisa bekerja di cabang lain via StaffBranch table
- Manager 1 mengelola: Jakarta Pusat & Bandung
- Manager 2 mengelola: Surabaya & Jakarta Pusat

---

## 1. Autentikasi & Otorisasi

### TC-AUTH-001: Login dengan kredensial valid
**Prasyarat**: Akun sudah terdaftar  
**Langkah**:
1. Buka halaman `/login`
2. Masukkan email dan password yang valid
3. Klik tombol "Masuk"

**Expected Result**:
- ✅ Redirect ke dashboard sesuai role
- ✅ Token tersimpan di localStorage
- ✅ User info tampil di header

### TC-AUTH-002: Login dengan kredensial invalid
**Langkah**:
1. Buka halaman `/login`
2. Masukkan email/password yang salah
3. Klik tombol "Masuk"

**Expected Result**:
- ✅ Tampil pesan error "Email atau password salah"
- ✅ Tetap di halaman login

### TC-AUTH-003: Logout
**Langkah**:
1. Login dengan akun valid
2. Klik menu profil di header
3. Klik "Logout"

**Expected Result**:
- ✅ Token dihapus dari localStorage
- ✅ Redirect ke halaman login

### TC-AUTH-004: Akses halaman tanpa login
**Langkah**:
1. Buka langsung URL `/dashboard` tanpa login

**Expected Result**:
- ✅ Redirect ke halaman login

### TC-AUTH-005: Akses halaman tanpa otorisasi
**Langkah**:
1. Login sebagai NURSE
2. Coba akses `/admin/super-admin`

**Expected Result**:
- ✅ Tampil halaman 403 Forbidden atau redirect

---

## 2. Dashboard

### TC-DASH-001: Tampilan dashboard ADMIN_CABANG
**Prasyarat**: Login sebagai ADMIN_CABANG  
**Langkah**:
1. Buka halaman `/dashboard`

**Expected Result**:
- ✅ Tampil statistik cabang sendiri
- ✅ Tampil grafik sesi hari ini
- ✅ Tampil member terbaru
- ✅ Tampil sesi mendatang

### TC-DASH-002: Tampilan dashboard SUPER_ADMIN
**Prasyarat**: Login sebagai SUPER_ADMIN  
**Langkah**:
1. Buka halaman `/dashboard`

**Expected Result**:
- ✅ Tampil statistik semua cabang
- ✅ Tampil perbandingan performa cabang
- ✅ Tampil total revenue sistem

### TC-DASH-003: Filter dashboard berdasarkan periode
**Langkah**:
1. Buka dashboard
2. Pilih filter periode (Hari ini, Minggu ini, Bulan ini)

**Expected Result**:
- ✅ Data statistik berubah sesuai periode
- ✅ Grafik ter-update

---

## 3. Manajemen Member

### TC-MEM-001: Daftar member baru
**Prasyarat**: Login sebagai ADMIN_LAYANAN/ADMIN_CABANG  
**Langkah**:
1. Buka `/members`
2. Klik "Daftarkan Member Baru"
3. Isi form data pribadi (nama, NIK, tanggal lahir, dll)
4. Upload dokumen PSP dan foto
5. Isi data akun (email, password)
6. Klik "Simpan"

**Expected Result**:
- ✅ Member berhasil dibuat
- ✅ Nomor member ter-generate otomatis (format: MBR-XXXXXX)
- ✅ Dokumen terupload ke MinIO
- ✅ Redirect ke halaman detail member

### TC-MEM-002: Cari member
**Langkah**:
1. Buka `/members`
2. Ketik nama/nomor member di search box
3. Tekan Enter atau klik Cari

**Expected Result**:
- ✅ Hasil pencarian tampil sesuai keyword
- ✅ Pagination berfungsi

### TC-MEM-003: Filter member berdasarkan status
**Langkah**:
1. Buka `/members`
2. Pilih filter status "Aktif" atau "Nonaktif"

**Expected Result**:
- ✅ Hanya member dengan status terpilih yang tampil

### TC-MEM-004: Lihat detail member
**Langkah**:
1. Buka `/members`
2. Klik tombol "Detail" pada salah satu member

**Expected Result**:
- ✅ Tampil halaman detail dengan tab: Profil, Paket, Sesi, Diagnosis, Dokumen
- ✅ Data member tampil lengkap

### TC-MEM-005: Edit data member
**Langkah**:
1. Buka detail member
2. Klik "Edit" pada tab Profil
3. Ubah beberapa data
4. Klik "Simpan"

**Expected Result**:
- ✅ Data berhasil diupdate
- ✅ Tampil notifikasi sukses

### TC-MEM-006: Lookup member lintas cabang
**Prasyarat**: Login sebagai ADMIN_CABANG  
**Langkah**:
1. Buka `/members`
2. Klik "Cari Lintas Cabang"
3. Masukkan nomor member dari cabang lain
4. Klik "Cari"

**Expected Result**:
- ✅ Data member ditemukan
- ✅ Tampil opsi "Grant Akses"

### TC-MEM-007: Grant akses member lintas cabang
**Langkah**:
1. Lakukan lookup member (TC-MEM-006)
2. Klik "Grant Akses"

**Expected Result**:
- ✅ Member mendapat akses ke cabang baru
- ✅ Badge "Lintas" tampil di list member

### TC-MEM-008: Lihat dokumen consent member
**Langkah**:
1. Buka detail member
2. Klik tab "Dokumen"

**Expected Result**:
- ✅ Tampil daftar dokumen (PSP, Foto)
- ✅ Bisa preview/download dokumen

---

## 4. Manajemen Paket

### TC-PKG-001: Assign paket BASIC ke member
**Prasyarat**: Member sudah terdaftar  
**Langkah**:
1. Buka detail member
2. Klik tab "Paket"
3. Klik "Tambah Paket"
4. Pilih tipe "BASIC"
5. Pilih produk paket
6. Isi jumlah sesi
7. Klik "Simpan"

**Expected Result**:
- ✅ Paket berhasil di-assign
- ✅ Invoice ter-generate otomatis
- ✅ Status paket "PENDING_PAYMENT"

### TC-PKG-002: Assign paket BOOSTER ke member
**Langkah**:
1. Buka detail member
2. Klik "Tambah Paket"
3. Pilih tipe "BOOSTER"
4. Pilih tipe booster (NO, GT, MB, dll)
5. Isi jumlah sesi
6. Klik "Simpan"

**Expected Result**:
- ✅ Paket BOOSTER berhasil di-assign
- ✅ Invoice ter-generate

### TC-PKG-003: Aktivasi paket setelah pembayaran
**Prasyarat**: Paket sudah di-assign, invoice sudah dibayar  
**Langkah**:
1. Buka detail member
2. Klik tab "Paket"
3. Lihat status paket

**Expected Result**:
- ✅ Status paket berubah menjadi "ACTIVE"
- ✅ Sesi tersedia untuk digunakan

### TC-PKG-004: Lihat riwayat paket member
**Langkah**:
1. Buka detail member
2. Klik tab "Paket"

**Expected Result**:
- ✅ Tampil semua paket (aktif, expired, cancelled)
- ✅ Tampil sisa sesi untuk paket aktif

---

## 5. Sesi Terapi

### TC-SES-001: Buat sesi terapi baru
**Prasyarat**: Member punya paket aktif dengan sisa sesi  
**Langkah**:
1. Buka `/sessions`
2. Klik "Buat Sesi Baru"
3. Cari dan pilih member
4. Pilih paket yang akan digunakan
5. Pilih dokter dan perawat
6. Klik "Buat Sesi"

**Expected Result**:
- ✅ Sesi berhasil dibuat
- ✅ Kode sesi ter-generate (format: SES-XXXXXX)
- ✅ Redirect ke halaman detail sesi

### TC-SES-002: Input therapy plan
**Langkah**:
1. Buka detail sesi
2. Klik tab "Therapy Plan"
3. Isi dosis infus (IFA, HHO, H2, dll)
4. Klik "Simpan"

**Expected Result**:
- ✅ Therapy plan tersimpan
- ✅ Data tampil di summary

### TC-SES-003: Input vital signs sebelum terapi
**Langkah**:
1. Buka detail sesi
2. Klik tab "Vital Signs"
3. Isi data vital (sistol, diastol, HR, saturasi, PI)
4. Klik "Simpan"

**Expected Result**:
- ✅ Vital signs tersimpan
- ✅ Timestamp tercatat

### TC-SES-004: Input data infusion
**Langkah**:
1. Buka detail sesi
2. Klik tab "Infusion"
3. Isi waktu mulai dan selesai infus
4. Isi catatan jika ada
5. Klik "Simpan"

**Expected Result**:
- ✅ Data infusion tersimpan
- ✅ Durasi terhitung otomatis

### TC-SES-005: Input material usage
**Langkah**:
1. Buka detail sesi
2. Klik tab "Materials"
3. Pilih material yang digunakan
4. Isi jumlah
5. Klik "Simpan"

**Expected Result**:
- ✅ Material usage tercatat
- ✅ Stock inventory berkurang

### TC-SES-006: Upload foto sesi
**Langkah**:
1. Buka detail sesi
2. Klik tab "Foto"
3. Upload foto sebelum dan sesudah terapi
4. Klik "Simpan"

**Expected Result**:
- ✅ Foto terupload ke MinIO
- ✅ Preview foto tampil

### TC-SES-007: Complete sesi terapi
**Langkah**:
1. Pastikan semua data sesi sudah diisi
2. Klik "Selesaikan Sesi"
3. Konfirmasi

**Expected Result**:
- ✅ Status sesi berubah menjadi "Completed"
- ✅ Sisa sesi paket berkurang 1
- ✅ Tidak bisa diedit lagi

### TC-SES-008: Filter sesi berdasarkan tanggal
**Langkah**:
1. Buka `/sessions`
2. Pilih range tanggal
3. Klik "Filter"

**Expected Result**:
- ✅ Hanya sesi dalam range tanggal yang tampil

### TC-SES-009: Export data sesi
**Langkah**:
1. Buka `/sessions`
2. Klik "Export"
3. Pilih format (Excel/CSV)

**Expected Result**:
- ✅ File terdownload
- ✅ Data sesuai filter yang aktif

---

## 6. Invoice & Pembayaran

### TC-INV-001: Lihat daftar invoice
**Langkah**:
1. Buka `/invoices` atau dari detail member

**Expected Result**:
- ✅ Tampil daftar invoice dengan status
- ✅ Bisa filter berdasarkan status

### TC-INV-002: Lihat detail invoice
**Langkah**:
1. Klik salah satu invoice

**Expected Result**:
- ✅ Tampil detail invoice (items, total, status)
- ✅ Tampil informasi member dan cabang

### TC-INV-003: Upload bukti pembayaran
**Prasyarat**: Invoice status PENDING  
**Langkah**:
1. Buka detail invoice
2. Klik "Upload Bukti Bayar"
3. Pilih file gambar
4. Klik "Upload"

**Expected Result**:
- ✅ Bukti bayar terupload
- ✅ Status invoice berubah ke "WAITING_VERIFICATION"

### TC-INV-004: Verifikasi pembayaran
**Prasyarat**: Login sebagai ADMIN_CABANG, bukti bayar sudah diupload  
**Langkah**:
1. Buka detail invoice
2. Lihat bukti bayar
3. Klik "Verifikasi" atau "Tolak"

**Expected Result**:
- ✅ Jika verifikasi: Status invoice "PAID", paket aktif
- ✅ Jika tolak: Status kembali "PENDING"

### TC-INV-005: Download invoice PDF
**Langkah**:
1. Buka detail invoice
2. Klik "Download PDF"

**Expected Result**:
- ✅ File PDF terdownload
- ✅ Format invoice profesional

---

## 7. Inventory & Stock Request

### TC-INV-001: Lihat stock inventory cabang
**Langkah**:
1. Buka `/inventory`

**Expected Result**:
- ✅ Tampil daftar item dengan stock
- ✅ Tampil warning untuk stock rendah

### TC-INV-002: Buat stock request
**Prasyarat**: Login sebagai ADMIN_CABANG  
**Langkah**:
1. Buka `/inventory/stock-requests`
2. Klik "Buat Request"
3. Pilih item dan jumlah
4. Klik "Submit"

**Expected Result**:
- ✅ Request berhasil dibuat
- ✅ Status "PENDING"

### TC-INV-003: Review stock request (SUPER_ADMIN)
**Prasyarat**: Login sebagai SUPER_ADMIN  
**Langkah**:
1. Buka `/inventory/stock-requests`
2. Klik request yang pending
3. Review dan klik "Approve" atau "Reject"

**Expected Result**:
- ✅ Status berubah sesuai aksi
- ✅ Jika approve: Lanjut ke proses pembayaran

### TC-INV-004: Upload bukti bayar stock request
**Langkah**:
1. Buka stock request yang sudah approved
2. Klik "Upload Bukti Bayar"
3. Upload file
4. Submit

**Expected Result**:
- ✅ Bukti bayar terupload
- ✅ Status berubah ke "PAYMENT_UPLOADED"

### TC-INV-005: Verifikasi pembayaran stock request
**Prasyarat**: Login sebagai SUPER_ADMIN  
**Langkah**:
1. Buka stock request dengan bukti bayar
2. Verifikasi pembayaran

**Expected Result**:
- ✅ Status berubah ke "PAID"
- ✅ Siap untuk shipment

### TC-INV-006: Buat shipment
**Prasyarat**: Login sebagai SUPER_ADMIN  
**Langkah**:
1. Buka `/inventory/shipments`
2. Klik "Buat Shipment"
3. Pilih stock request yang sudah paid
4. Isi detail pengiriman
5. Submit

**Expected Result**:
- ✅ Shipment berhasil dibuat
- ✅ Status "SHIPPED"

### TC-INV-007: Terima shipment
**Prasyarat**: Login sebagai ADMIN_CABANG  
**Langkah**:
1. Buka `/inventory/shipments`
2. Klik shipment yang diterima
3. Verifikasi item
4. Klik "Terima"

**Expected Result**:
- ✅ Status shipment "RECEIVED"
- ✅ Stock inventory cabang bertambah

---

## 8. Referral

### TC-REF-001: Buat kode referral baru
**Prasyarat**: Login sebagai ADMIN_CABANG  
**Langkah**:
1. Buka `/referrals`
2. Klik "Buat Referral"
3. Pilih tipe (SALES, DOKTER, MEMBER)
4. Isi data referrer
5. Set persentase insentif
6. Klik "Simpan"

**Expected Result**:
- ✅ Kode referral ter-generate
- ✅ Tampil di daftar referral

### TC-REF-002: Gunakan kode referral saat daftar member
**Langkah**:
1. Daftar member baru
2. Masukkan kode referral
3. Simpan

**Expected Result**:
- ✅ Member terhubung dengan referral
- ✅ Insentif akan dihitung saat pembelian paket

### TC-REF-003: Lihat laporan insentif referral
**Langkah**:
1. Buka `/referrals`
2. Klik salah satu referral
3. Lihat tab "Insentif"

**Expected Result**:
- ✅ Tampil riwayat insentif
- ✅ Tampil total insentif

### TC-REF-004: Export data referral
**Langkah**:
1. Buka `/referrals`
2. Klik "Export"

**Expected Result**:
- ✅ File Excel terdownload
- ✅ Data lengkap dengan insentif

---

## 9. Manajemen Cabang

### TC-BRN-001: Lihat daftar cabang
**Prasyarat**: Login sebagai SUPER_ADMIN  
**Langkah**:
1. Buka `/branches`

**Expected Result**:
- ✅ Tampil semua cabang dengan statistik
- ✅ Tampil jumlah member, staff, revenue

### TC-BRN-002: Lihat detail cabang
**Langkah**:
1. Klik salah satu cabang

**Expected Result**:
- ✅ Tampil tab: Overview, Members, Staff, Inventory, Managers
- ✅ Data statistik cabang

### TC-BRN-003: Tambah staff ke cabang
**Langkah**:
1. Buka detail cabang
2. Klik tab "Staff"
3. Klik "Tambah Staff"
4. Isi data staff
5. Simpan

**Expected Result**:
- ✅ Staff berhasil ditambahkan
- ✅ Tampil di daftar staff cabang

### TC-BRN-004: Assign manager ke cabang
**Langkah**:
1. Buka detail cabang
2. Klik tab "Managers"
3. Klik "Assign Manager"
4. Pilih manager
5. Simpan

**Expected Result**:
- ✅ Manager ter-assign ke cabang
- ✅ Manager bisa akses data cabang

### TC-BRN-005: Edit informasi cabang
**Langkah**:
1. Buka detail cabang
2. Klik "Edit"
3. Ubah data
4. Simpan

**Expected Result**:
- ✅ Data cabang terupdate

---

## 10. Admin & Super Admin

### TC-ADM-001: Lihat audit logs
**Prasyarat**: Login sebagai SUPER_ADMIN  
**Langkah**:
1. Buka `/admin/audit-logs`

**Expected Result**:
- ✅ Tampil log aktivitas sistem
- ✅ Bisa filter berdasarkan user, action, tanggal

### TC-ADM-002: Kelola master products
**Langkah**:
1. Buka `/admin/master-products`
2. Tambah/edit/hapus produk

**Expected Result**:
- ✅ CRUD produk berfungsi
- ✅ Produk tersedia untuk paket

### TC-ADM-003: Kelola package pricing
**Langkah**:
1. Buka `/admin/package-pricing`
2. Set harga paket per cabang

**Expected Result**:
- ✅ Harga tersimpan
- ✅ Harga tampil saat assign paket

### TC-ADM-004: Lihat kinerja staff
**Langkah**:
1. Buka `/staff-performance`

**Expected Result**:
- ✅ Tampil summary performa staff
- ✅ Bisa lihat detail per staff

### TC-ADM-005: Lihat detail kinerja staff
**Langkah**:
1. Klik salah satu staff di halaman kinerja

**Expected Result**:
- ✅ Tampil riwayat sesi yang ditangani
- ✅ Tampil statistik (total sesi, rating, dll)

---

## 11. Export Data

### TC-EXP-001: Quick export member - Ringkasan
**Langkah**:
1. Buka `/members`
2. Klik "Export Data"
3. Pilih tab "Quick Export"
4. Pilih preset "Ringkasan"
5. Klik "Export"

**Expected Result**:
- ✅ File Excel terdownload
- ✅ Berisi kolom: No. Member, Nama, Telepon, Email, Cabang, Status, Tanggal Registrasi

### TC-EXP-002: Quick export member - Semua Data
**Langkah**:
1. Buka modal export
2. Pilih preset "Semua Data"
3. Export

**Expected Result**:
- ✅ File berisi semua kolom data member

### TC-EXP-003: Custom export dengan filter cabang
**Prasyarat**: Login sebagai SUPER_ADMIN  
**Langkah**:
1. Buka modal export
2. Pilih tab "Custom Export"
3. Pilih beberapa cabang
4. Export

**Expected Result**:
- ✅ Hanya member dari cabang terpilih yang di-export

### TC-EXP-004: Custom export dengan filter tanggal
**Langkah**:
1. Buka modal export custom
2. Set tanggal registrasi dari-sampai
3. Export

**Expected Result**:
- ✅ Hanya member dalam range tanggal yang di-export

### TC-EXP-005: Custom export dengan grouping
**Langkah**:
1. Buka modal export custom
2. Pilih kolom yang diinginkan
3. Set "Kelompokkan Berdasarkan" = Cabang
4. Centang "Tampilkan Subtotal"
5. Export

**Expected Result**:
- ✅ Data dikelompokkan per cabang
- ✅ Ada subtotal per grup
- ✅ Ada grand total di akhir

### TC-EXP-006: Export dengan data terapi
**Langkah**:
1. Buka modal export custom
2. Expand kategori "Data Terapi"
3. Centang: Total Sesi Terapi, Sesi Selesai, Tanggal Terapi Terakhir
4. Export

**Expected Result**:
- ✅ Kolom terapi muncul di file
- ✅ Data sesi terapi akurat

### TC-EXP-007: Export format CSV
**Langkah**:
1. Buka modal export
2. Pilih format "CSV"
3. Export

**Expected Result**:
- ✅ File CSV terdownload
- ✅ Bisa dibuka di Excel/text editor

### TC-EXP-008: Preview count sebelum export
**Langkah**:
1. Buka modal export custom
2. Set beberapa filter
3. Lihat preview count

**Expected Result**:
- ✅ Tampil jumlah member yang akan di-export
- ✅ Count update saat filter berubah

---

## 12. Member Portal

### TC-MBR-001: Login sebagai member
**Langkah**:
1. Buka `/login`
2. Login dengan akun member

**Expected Result**:
- ✅ Redirect ke `/me/dashboard`
- ✅ Tampil dashboard member

### TC-MBR-002: Lihat dashboard member
**Langkah**:
1. Login sebagai member
2. Buka `/me/dashboard`

**Expected Result**:
- ✅ Tampil sisa voucher
- ✅ Tampil sesi mendatang
- ✅ Tampil riwayat singkat

### TC-MBR-003: Lihat riwayat sesi
**Langkah**:
1. Buka `/me/sessions`

**Expected Result**:
- ✅ Tampil daftar sesi terapi
- ✅ Bisa lihat detail sesi

### TC-MBR-004: Lihat voucher/paket
**Langkah**:
1. Buka `/me/vouchers`

**Expected Result**:
- ✅ Tampil paket aktif dengan sisa sesi
- ✅ Tampil riwayat paket

### TC-MBR-005: Lihat invoice
**Langkah**:
1. Buka `/me/invoices`

**Expected Result**:
- ✅ Tampil daftar invoice
- ✅ Bisa download PDF

### TC-MBR-006: Edit profil member
**Langkah**:
1. Buka `/me/profile`
2. Edit data yang diizinkan
3. Simpan

**Expected Result**:
- ✅ Data terupdate
- ✅ Tampil notifikasi sukses

---

## Catatan Pengujian

### Environment
- **Browser**: Chrome, Firefox, Safari (latest)
- **Device**: Desktop, Tablet, Mobile
- **API**: `http://localhost:3001/api/v1`
- **Web**: `http://localhost:3000`

### Sebelum Testing
1. Jalankan `npm run seed:essential` untuk data dasar
2. Jalankan `npm run seed:testing` untuk data testing
3. Pastikan MinIO berjalan untuk upload file

### Pelaporan Bug
Format laporan:
```
[TC-XXX-000] Judul Test Case
- Langkah yang dilakukan
- Expected result
- Actual result
- Screenshot (jika ada)
- Browser/Device
```

---

**Dokumen ini terakhir diupdate**: 22 Mei 2026
