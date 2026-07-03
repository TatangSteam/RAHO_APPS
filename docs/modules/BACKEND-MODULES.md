# Backend Modules Documentation

Dokumentasi lengkap mengenai struktur modul backend API.

---

## Daftar Isi

1. [Sessions](#1-sessions---manajemen-sesi-terapi)
2. [Members](#2-members---manajemen-memberpasien)
3. [Inventory](#3-inventory---manajemen-inventaris)
4. [Invoices](#4-invoices---manajemen-tagihan)
5. [Packages](#5-packages---manajemen-paket-terapi)
6. [Admin](#6-admin---administrasi-sistem)
7. [Users](#7-users---manajemen-pengguna)
8. [Dashboard](#8-dashboard---dashboard--reporting)
9. [Referrals](#9-referrals---sistem-referral)
10. [Branches](#10-branches---manajemen-cabang)
11. [Auth](#11-auth---autentikasi--otorisasi)
12. [Files](#12-files---manajemen-file)
13. [Diagnosis](#13-diagnosis---manajemen-diagnosa)
14. [Me](#14-me---profile-member-area)
15. [Non-Therapy](#15-non-therapy---produk-non-terapi)
16. [Audit](#16-audit---audit-log)

---

## 1. Sessions - Manajemen Sesi Terapi

### Deskripsi
Modul Sessions mengelola seluruh siklus hidup sesi terapi, mulai dari pembuatan, pelaksanaan, hingga penyelesaian sesi. Modul ini merupakan inti dari bisnis proses klinik.

### Lokasi File
```
apps/api/src/modules/sessions/
├── sessions.controller.ts
├── sessions.routes.ts
├── sessions.schema.ts
├── sessions.service.ts
└── services/
    ├── session-creation.service.ts
    ├── session-retrieval.service.ts
    ├── session-completion.service.ts
    ├── session-export.service.ts
    ├── therapy-plan.service.ts
    ├── infusion.service.ts
    ├── booster.service.ts
    ├── vital-signs.service.ts
    ├── diagnosis.service.ts
    ├── evaluation.service.ts
    ├── emr-notes.service.ts
    ├── photo.service.ts
    ├── supporting-photos.service.ts
    └── material-usage.service.ts
```

### Sub-Services

| Service | Deskripsi |
|---------|-----------|
| `session-creation.service.ts` | Pembuatan sesi terapi baru dengan validasi jadwal dokter dan ketersediaan ruangan |
| `session-retrieval.service.ts` | Pengambilan data sesi dengan filter berdasarkan status, tanggal, cabang, dan member |
| `session-completion.service.ts` | Penyelesaian sesi terapi termasuk update status dan perhitungan pemakaian material |
| `session-export.service.ts` | Export data sesi ke format PDF dan Excel untuk keperluan laporan |
| `therapy-plan.service.ts` | Manajemen rencana terapi termasuk IFA substances, sets, dan versi therapy plan |
| `infusion.service.ts` | Pengelolaan data infus termasuk jenis infus, dosis, dan durasi pemberian |
| `booster.service.ts` | Manajemen booster package yang digunakan selama sesi terapi |
| `vital-signs.service.ts` | Pencatatan tanda-tanda vital sebelum dan sesudah terapi (tekanan darah, suhu, dll) |
| `diagnosis.service.ts` | Pengelolaan diagnosa berdasarkan kode ICD dengan kategori diagnosa |
| `evaluation.service.ts` | Evaluasi dokter sebelum dan sesudah sesi termasuk keluhan dan rekomendasi |
| `emr-notes.service.ts` | Catatan rekam medis elektronik untuk dokumentasi medis |
| `photo.service.ts` | Pengelolaan foto-foto sesi untuk dokumentasi visual |
| `supporting-photos.service.ts` | Foto pendukung seperti foto consent dan foto identitas |
| `material-usage.service.ts` | Pencatatan penggunaan material selama sesi terapi |

### Endpoint Utama
- `POST /sessions` - Buat sesi baru
- `GET /sessions` - List semua sesi
- `GET /sessions/:id` - Detail sesi
- `PUT /sessions/:id` - Update sesi
- `POST /sessions/:id/complete` - Selesaikan sesi
- `POST /sessions/:id/therapy-plan` - Update therapy plan
- `POST /sessions/:id/vital-signs` - Input tanda vital
- `POST /sessions/:id/evaluation` - Input evaluasi dokter
- `POST /sessions/:id/materials` - Input penggunaan material
- `POST /sessions/:id/photos` - Upload foto sesi

---

## 2. Members - Manajemen Member/Pasien

### Deskripsi
Modul Members mengelola data member/pasien termasuk registrasi, update profil, dokumen, rekaman medis, dan therapy plan member.

### Lokasi File
```
apps/api/src/modules/members/
├── members.controller.ts
├── members.routes.ts
├── members.schema.ts
├── members.service.ts
└── services/
    ├── member-registration.service.ts
    ├── member-retrieval.service.ts
    ├── member-update.service.ts
    ├── member-documents.service.ts
    ├── member-medical-records.service.ts
    ├── member-lab-results.service.ts
    ├── member-export.service.ts
    ├── member-branch-access.service.ts
    ├── member-therapy-plan-bulk.service.ts
    ├── member-therapy-plan-edit.service.ts
    └── member-therapy-plan-set-edit.service.ts
```

### Sub-Services

| Service | Deskripsi |
|---------|-----------|
| `member-registration.service.ts` | Registrasi member baru dengan validasi data dan generate kode member unik |
| `member-retrieval.service.ts` | Pengambilan data member dengan filter berdasarkan cabang, status, dan pencarian |
| `member-update.service.ts` | Update data profil member termasuk foto avatar dan informasi kontak |
| `member-documents.service.ts` | Manajemen dokumen member (KTP, consent form, dokumen medis) |
| `member-medical-records.service.ts` | Penyimpanan dan pengambilan rekaman medis member |
| `member-lab-results.service.ts` | Pengelolaan hasil laboratorium member |
| `member-export.service.ts` | Export data member ke Excel untuk keperluan laporan |
| `member-branch-access.service.ts` | Manajemen akses member ke multiple cabang |
| `member-therapy-plan-bulk.service.ts` | Bulk input therapy plan untuk efisiensi input data |
| `member-therapy-plan-edit.service.ts` | Edit therapy plan individual |
| `member-therapy-plan-set-edit.service.ts` | Edit therapy plan sets dan IFA substances |

### Endpoint Utama
- `POST /members` - Registrasi member baru
- `GET /members` - List semua member
- `GET /members/:id` - Detail member
- `PUT /members/:id` - Update data member
- `GET /members/:id/documents` - List dokumen member
- `POST /members/:id/documents` - Upload dokumen
- `GET /members/:id/medical-records` - Rekaman medis
- `GET /members/:id/lab-results` - Hasil lab
- `POST /members/:id/therapy-plan` - Input therapy plan
- `PUT /members/:id/therapy-plan` - Update therapy plan
- `POST /members/export` - Export data member

---

## 3. Inventory - Manajemen Inventaris

### Deskripsi
Modul Inventory mengelola seluruh aspek inventaris klinik termasuk stok produk, permintaan stok, pengiriman, dan tracking penggunaan material.

### Lokasi File
```
apps/api/src/modules/inventory/
├── inventory.controller.ts
├── inventory.routes.ts
├── inventory.service.ts
├── stock-request.controller.ts
├── stock-request.service.ts
├── shipment.controller.ts
├── shipment.service.ts
├── overstock.controller.ts
└── services/
    ├── inventory-items.service.ts
    ├── inventory-export.service.ts
    ├── material-usage-history.service.ts
    ├── overstock.service.ts
    ├── stock-request-creation.service.ts
    ├── stock-request-approval.service.ts
    ├── stock-request-retrieval.service.ts
    ├── shipment-processing.service.ts
    ├── shipment-retrieval.service.ts
    └── unit-conversion.service.ts
```

### Sub-Services

| Service | Deskripsi |
|---------|-----------|
| `inventory-items.service.ts` | CRUD item inventaris dengan tracking stok per cabang |
| `inventory-export.service.ts` | Export data inventaris ke Excel |
| `material-usage-history.service.ts` | Riwayat penggunaan material per sesi dan per periode |
| `overstock.service.ts` | Manajemen kelebihan stok dan transfer antar cabang |
| `stock-request-creation.service.ts` | Pembuatan permintaan stok dari cabang ke pusat |
| `stock-request-approval.service.ts` | Proses persetujuan permintaan stok oleh admin pusat |
| `stock-request-retrieval.service.ts` | Pengambilan data permintaan stok dengan filter status |
| `shipment-processing.service.ts` | Proses pengiriman stok dari pusat ke cabang |
| `shipment-retrieval.service.ts` | Tracking status pengiriman dan riwayat |
| `unit-conversion.service.ts` | Konversi satuan produk (box ke pcs, dll) |

### Endpoint Utama
- `GET /inventory` - List inventaris per cabang
- `POST /inventory` - Tambah item inventaris
- `PUT /inventory/:id` - Update stok
- `GET /inventory/stock-requests` - List permintaan stok
- `POST /inventory/stock-requests` - Buat permintaan stok
- `PUT /inventory/stock-requests/:id/approve` - Setujui permintaan
- `GET /inventory/shipments` - List pengiriman
- `POST /inventory/shipments` - Buat pengiriman
- `PUT /inventory/shipments/:id/receive` - Terima pengiriman
- `GET /inventory/overstock` - List kelebihan stok
- `POST /inventory/overstock/transfer` - Transfer stok

---

## 4. Invoices - Manajemen Tagihan

### Deskripsi
Modul Invoices mengelola seluruh proses penagihan mulai dari pembuatan invoice, pembayaran, hingga pembatalan.

### Lokasi File
```
apps/api/src/modules/invoices/
├── invoices.controller.ts
├── invoices.routes.ts
├── invoices.schema.ts
├── invoices.service.ts
└── services/
    ├── invoice-creation.service.ts
    ├── invoice-retrieval.service.ts
    ├── invoice-payment.service.ts
    └── invoice-cancellation.service.ts
```

### Sub-Services

| Service | Deskripsi |
|---------|-----------|
| `invoice-creation.service.ts` | Pembuatan invoice otomatis dari package assignment dengan generate nomor invoice unik |
| `invoice-retrieval.service.ts` | Pengambilan data invoice dengan filter status, tanggal, dan member |
| `invoice-payment.service.ts` | Proses pembayaran termasuk upload bukti pembayaran dan verifikasi |
| `invoice-cancellation.service.ts` | Pembatalan invoice dengan alasan dan tracking |

### Endpoint Utama
- `GET /invoices` - List semua invoice
- `GET /invoices/:id` - Detail invoice
- `POST /invoices` - Buat invoice manual
- `POST /invoices/:id/payment` - Upload bukti pembayaran
- `PUT /invoices/:id/verify` - Verifikasi pembayaran
- `POST /invoices/:id/cancel` - Batalkan invoice
- `GET /invoices/:id/pdf` - Download PDF invoice

---

## 5. Packages - Manajemen Paket Terapi

### Deskripsi
Modul Packages mengelola paket terapi yang ditawarkan klinik termasuk assignment ke member, pricing per cabang, dan proses refund.

### Lokasi File
```
apps/api/src/modules/packages/
├── packages.controller.ts
├── packages.routes.ts
├── packages.schema.ts
├── packages.service.ts
└── services/
    ├── package-assignment.service.ts
    ├── package-retrieval.service.ts
    ├── package-edit.service.ts
    ├── package-cancel.service.ts
    ├── package-refund.service.ts
    ├── package-pricing.service.ts
    ├── payment-verification.service.ts
    └── invoice-generation.service.ts
```

### Sub-Services

| Service | Deskripsi |
|---------|-----------|
| `package-assignment.service.ts` | Penugasan paket ke member dengan opsi addon dan booster |
| `package-retrieval.service.ts` | Pengambilan data paket dengan filter member dan status |
| `package-edit.service.ts` | Edit detail paket termasuk sesi yang tersisa |
| `package-cancel.service.ts` | Pembatalan paket dengan perhitungan refund |
| `package-refund.service.ts` | Proses refund paket dengan approval workflow |
| `package-pricing.service.ts` | Manajemen harga paket per cabang |
| `payment-verification.service.ts` | Verifikasi pembayaran paket oleh admin |
| `invoice-generation.service.ts` | Generate invoice otomatis dari assignment paket |

### Endpoint Utama
- `GET /packages` - List semua paket
- `GET /packages/pricing` - List harga paket per cabang
- `POST /packages/assign` - Assign paket ke member
- `PUT /packages/:id` - Update paket
- `POST /packages/:id/cancel` - Batalkan paket
- `POST /packages/:id/refund` - Request refund
- `PUT /packages/:id/verify` - Verifikasi pembayaran

---

## 6. Admin - Administrasi Sistem

### Deskripsi
Modul Admin menyediakan fungsi-fungsi administratif sistem termasuk manajemen user, audit log, dan konfigurasi master data.

### Lokasi File
```
apps/api/src/modules/admin/
├── admin.controller.ts
├── admin.routes.ts
├── admin.schema.ts
├── admin.service.ts
└── services/
    ├── audit-logs.service.ts
    ├── branch-performance.service.ts
    ├── impersonation.service.ts
    ├── master-product-admin.service.ts
    ├── master-types-admin.service.ts
    ├── non-therapy-product-admin.service.ts
    ├── package-pricing-admin.service.ts
    ├── system-stats.service.ts
    └── user-management.service.ts
```

### Sub-Services

| Service | Deskripsi |
|---------|-----------|
| `audit-logs.service.ts` | Pencatatan dan pengambilan log audit untuk keamanan dan tracking |
| `branch-performance.service.ts` | Analisis performa cabang berdasarkan revenue dan jumlah sesi |
| `impersonation.service.ts` | Fitur impersonasi super admin untuk login sebagai user lain |
| `master-product-admin.service.ts` | CRUD master produk yang digunakan di seluruh cabang |
| `master-types-admin.service.ts` | Manajemen tipe-tipe master (tipe produk, kategori, dll) |
| `non-therapy-product-admin.service.ts` | Manajemen produk non-terapi (retail products) |
| `package-pricing-admin.service.ts` | Manajemen harga paket untuk semua cabang |
| `system-stats.service.ts` | Statistik sistem untuk dashboard super admin |
| `user-management.service.ts` | Manajemen user termasuk reset password dan activation |

### Endpoint Utama
- `GET /admin/audit-logs` - List audit log
- `GET /admin/stats` - Statistik sistem
- `GET /admin/users` - List semua user
- `PUT /admin/users/:id` - Update user
- `POST /admin/impersonate/:userId` - Impersonasi user
- `GET /admin/master-products` - List master produk
- `POST /admin/master-products` - Tambah master produk
- `GET /admin/package-pricing` - List harga paket
- `PUT /admin/package-pricing/:id` - Update harga paket

---

## 7. Users - Manajemen Pengguna

### Deskripsi
Modul Users mengelola pengguna sistem termasuk staf, dokter, dan admin dengan fitur performa dan penugasan cabang.

### Lokasi File
```
apps/api/src/modules/users/
├── users.controller.ts
├── users.routes.ts
├── users.schema.ts
├── users.service.ts
├── admin-manager.routes.ts
└── services/
    ├── staff-performance.service.ts
    ├── doctor-branch-management.service.ts
    └── staff-branch-assignment.service.ts
```

### Sub-Services

| Service | Deskripsi |
|---------|-----------|
| `staff-performance.service.ts` | Analisis performa staf berdasarkan jumlah sesi dan rating |
| `doctor-branch-management.service.ts` | Manajemen penugasan dokter ke multiple cabang |
| `staff-branch-assignment.service.ts` | Penugasan staf ke cabang tertentu |

### Endpoint Utama
- `GET /users` - List semua user
- `GET /users/:id` - Detail user
- `PUT /users/:id` - Update user
- `GET /users/staff-performance` - Performa staf
- `GET /users/doctors` - List dokter
- `POST /users/doctors/:id/branches` - Assign dokter ke cabang
- `GET /users/admin-managers` - List admin manager
- `POST /users/admin-managers` - Buat admin manager

---

## 8. Dashboard - Dashboard & Reporting

### Deskripsi
Modul Dashboard menyediakan data untuk dashboard berbeda berdasarkan role user.

### Lokasi File
```
apps/api/src/modules/dashboard/
├── dashboard.controller.ts
├── dashboard.routes.ts
├── dashboard.service.ts
└── role-dashboard.service.ts
```

### Services

| Service | Deskripsi |
|---------|-----------|
| `dashboard.service.ts` | Data dashboard umum seperti jumlah member, sesi, dan revenue |
| `role-dashboard.service.ts` | Data dashboard spesifik per role (super admin, admin layanan, dokter, admin cabang) |

### Endpoint Utama
- `GET /dashboard` - Data dashboard umum
- `GET /dashboard/super-admin` - Dashboard super admin
- `GET /dashboard/admin-layanan` - Dashboard admin layanan
- `GET /dashboard/doctor` - Dashboard dokter
- `GET /dashboard/admin-cabang` - Dashboard admin cabang

---

## 9. Referrals - Sistem Referral

### Deskripsi
Modul Referrals mengelola sistem referral member termasuk tracking dan perhitungan insentif.

### Lokasi File
```
apps/api/src/modules/referrals/
├── referrals.controller.ts
├── referrals.routes.ts
├── referrals.schema.ts
├── referrals.service.ts
├── referral-export.service.ts
└── incentive-calculation.service.ts
```

### Services

| Service | Deskripsi |
|---------|-----------|
| `referrals.service.ts` | Manajemen referral termasuk link referral dan tracking |
| `referral-export.service.ts` | Export data referral ke Excel |
| `incentive-calculation.service.ts` | Kalkulasi insentif referral berdasarkan kebijakan |

### Endpoint Utama
- `GET /referrals` - List semua referral
- `GET /referrals/my` - Referral member login
- `POST /referrals/generate-link` - Generate link referral
- `GET /referrals/incentives` - List insentif
- `POST /referrals/export` - Export data referral

---

## 10. Branches - Manajemen Cabang

### Deskripsi
Modul Branches mengelola data cabang klinik termasuk informasi lokasi, kontak, dan tipe cabang.

### Lokasi File
```
apps/api/src/modules/branches/
├── branches.controller.ts
├── branches.routes.ts
├── branches.schema.ts
├── branches.service.ts
└── __tests__/
```

### File Utama

| File | Deskripsi |
|------|-----------|
| `branches.controller.ts` | Controller untuk CRUD cabang |
| `branches.service.ts` | Logika bisnis manajemen cabang |
| `branches.schema.ts` | Validasi input data cabang |

### Endpoint Utama
- `GET /branches` - List semua cabang
- `GET /branches/:id` - Detail cabang
- `POST /branches` - Buat cabang baru
- `PUT /branches/:id` - Update cabang
- `DELETE /branches/:id` - Hapus cabang
- `GET /branches/:id/staff` - List staf di cabang
- `GET /branches/:id/inventory` - Inventaris cabang

---

## 11. Auth - Autentikasi & Otorisasi

### Deskripsi
Modul Auth mengelola proses autentikasi dan otorisasi pengguna termasuk login, logout, dan refresh token.

### Lokasi File
```
apps/api/src/modules/auth/
├── auth.controller.ts
├── auth.routes.ts
├── auth.schema.ts
└── auth.service.ts
```

### File Utama

| File | Deskripsi |
|------|-----------|
| `auth.controller.ts` | Controller untuk endpoint autentikasi |
| `auth.service.ts` | Logika autentikasi termasuk JWT token generation |
| `auth.schema.ts` | Validasi input login dan register |

### Endpoint Utama
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Request reset password
- `POST /auth/reset-password` - Reset password

---

## 12. Files - Manajemen File

### Deskripsi
Modul Files mengelola upload dan download file menggunakan MinIO object storage.

### Lokasi File
```
apps/api/src/modules/files/
├── files.controller.ts
├── files.routes.ts
└── files.service.ts
```

### File Utama

| File | Deskripsi |
|------|-----------|
| `files.controller.ts` | Controller untuk upload dan download file |
| `files.service.ts` | Logika penyimpanan file ke MinIO |

### Endpoint Utama
- `POST /files/upload` - Upload file
- `GET /files/:key` - Download file
- `DELETE /files/:key` - Hapus file
- `GET /files/presigned-url/:key` - Get presigned URL untuk akses langsung

---

## 13. Diagnosis - Manajemen Diagnosa

### Deskripsi
Modul Diagnosis mengelola data diagnosa berdasarkan kode ICD dengan kategori diagnosa.

### Lokasi File
```
apps/api/src/modules/diagnosis/
├── diagnosis.controller.ts
├── diagnosis.routes.ts
└── diagnosis.service.ts
```

### File Utama

| File | Deskripsi |
|------|-----------|
| `diagnosis.controller.ts` | Controller untuk endpoint diagnosa |
| `diagnosis.service.ts` | Logika pengambilan data diagnosa dan ICD codes |

### Endpoint Utama
- `GET /diagnosis` - List semua diagnosa
- `GET /diagnosis/categories` - List kategori diagnosa
- `GET /diagnosis/icd-codes` - List kode ICD
- `GET /diagnosis/search` - Cari diagnosa berdasarkan keyword

---

## 14. Me - Profile Member Area

### Deskripsi
Modul Me menyediakan endpoint untuk member melihat dan mengelola data dirinya sendiri.

### Lokasi File
```
apps/api/src/modules/me/
├── me.controller.ts
├── me.routes.ts
└── me.service.ts
```

### File Utama

| File | Deskripsi |
|------|-----------|
| `me.controller.ts` | Controller untuk member area |
| `me.service.ts` | Logika pengambilan dan update data member |

### Endpoint Utama
- `GET /me` - Profil member yang login
- `PUT /me` - Update profil
- `GET /me/sessions` - Sesi terapi member
- `GET /me/invoices` - Invoice member
- `GET /me/packages` - Paket member
- `GET /me/vouchers` - Voucher member

---

## 15. Non-Therapy - Produk Non-Terapi

### Deskripsi
Modul Non-Therapy mengelola produk retail atau produk non-terapi yang dijual di klinik.

### Lokasi File
```
apps/api/src/modules/non-therapy/
├── non-therapy.controller.ts
├── non-therapy.routes.ts
├── non-therapy.schema.ts
└── non-therapy.service.ts
```

### File Utama

| File | Deskripsi |
|------|-----------|
| `non-therapy.controller.ts` | Controller untuk CRUD produk non-terapi |
| `non-therapy.service.ts` | Logika bisnis produk non-terapi |
| `non-therapy.schema.ts` | Validasi input produk |

### Endpoint Utama
- `GET /non-therapy` - List produk non-terapi
- `GET /non-therapy/:id` - Detail produk
- `POST /non-therapy` - Tambah produk
- `PUT /non-therapy/:id` - Update produk
- `DELETE /non-therapy/:id` - Hapus produk

---

## 16. Audit - Audit Log

### Deskripsi
Modul Audit menyediakan endpoint untuk mengakses log audit sistem.

### Lokasi File
```
apps/api/src/modules/audit/
├── audit.controller.ts
└── audit.routes.ts
```

### File Utama

| File | Deskripsi |
|------|-----------|
| `audit.controller.ts` | Controller untuk mengakses audit log |
| `audit.routes.ts` | Routes untuk audit log |

### Endpoint Utama
- `GET /audit` - List audit log dengan filter
- `GET /audit/user/:userId` - Audit log per user
- `GET /audit/branch/:branchId` - Audit log per cabang

---

## Ringkasan Struktur Modul

```
apps/api/src/modules/
├── admin/              # Administrasi sistem
├── audit/              # Audit log
├── auth/               # Autentikasi & otorisasi
├── branches/           # Manajemen cabang
├── dashboard/          # Dashboard & reporting
├── diagnosis/          # Manajemen diagnosa
├── files/              # Manajemen file
├── inventory/          # Manajemen inventaris
├── invoices/           # Manajemen tagihan
├── me/                 # Profile member area
├── members/            # Manajemen member/pasien
├── non-therapy/        # Produk non-terapi
├── packages/           # Manajemen paket terapi
├── referrals/          # Sistem referral
├── sessions/           # Manajemen sesi terapi
└── users/              # Manajemen pengguna
```

## Statistik Modul

| Modul | Jumlah Sub-Services | Jumlah Endpoint |
|-------|---------------------|-----------------|
| Sessions | 14 | 20+ |
| Members | 11 | 15+ |
| Inventory | 10 | 25+ |
| Admin | 9 | 15+ |
| Packages | 8 | 10+ |
| Invoices | 4 | 8+ |
| Users | 3 | 10+ |
| Referrals | 3 | 5+ |
| Dashboard | 2 | 5+ |
| Branches | - | 6+ |
| Auth | - | 5+ |
| Files | - | 4+ |
| Diagnosis | - | 4+ |
| Me | - | 6+ |
| Non-Therapy | - | 5+ |
| Audit | - | 3+ |

**Total: 16 Modul Utama dengan 64+ Sub-Services dan 150+ Endpoint**

---

*Dokumentasi ini terakhir diperbarui pada Juli 2026*
