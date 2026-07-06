# Product Backlog RAHO ERP Management System

Last updated: 6 Juli 2026  
Scope: monorepo `apps/api` dan `apps/web` untuk operasional klinik RAHO, portal member, backend API, database, file storage, reporting, dan deployment.

## 1. Ringkasan Produk

RAHO ERP adalah sistem manajemen klinik multi-cabang untuk mengelola member, paket terapi, sesi treatment, EMR, inventory, invoice, payment, referral, staff, audit log, dan portal member. Backlog ini disusun dari struktur project, README, dokumentasi role, user stories, test scenario, modul backend, dan halaman frontend yang tersedia di repository.

## 2. Legend

Priority:
- P0: wajib untuk operasional inti, keamanan, atau data correctness.
- P1: nilai bisnis tinggi dan perlu segera distabilkan.
- P2: enhancement penting, bisa dijadwalkan setelah core flow stabil.
- P3: nice to have atau future improvement.

Status:
- Done: sudah terlihat tersedia di kode/dokumentasi.
- In Progress: ada modul atau halaman, tetapi masih perlu penyelesaian atau validasi.
- Todo: belum terlihat lengkap atau perlu dibangun sebagai backlog berikutnya.
- Tech Debt: perbaikan kualitas, testing, refactor, observability, atau deployment.

Roles:
- SUPER_ADMIN
- ADMIN_MANAGER
- ADMIN_CABANG
- ADMIN_LAYANAN
- DOCTOR
- NURSE
- MEMBER

## 3. Product Goals

- Mengurangi pekerjaan manual cabang dalam registrasi, pembayaran, sesi terapi, dan stok.
- Menjaga data medis, pembayaran, stok, dan audit trail tetap konsisten lintas cabang.
- Memberikan dashboard role-based untuk keputusan operasional, klinis, dan manajemen.
- Menyediakan portal member untuk transparansi paket, invoice, sesi, dan profil.
- Menyiapkan fondasi production-ready: security, backup, monitoring, test coverage, dan deployment.

## 4. Epics dan Backlog Items

### Epic 1: Authentication, Authorization, dan Security

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| AUTH-001 | Login, logout, refresh token, current user, dan proteksi route berbasis JWT. | P0 | Done | Semua user |
| AUTH-002 | Role-based access control untuk staff, super admin, dan member. | P0 | Done | SUPER_ADMIN |
| AUTH-003 | Branch access control untuk data member, sesi, inventory, shipment, dan dashboard. | P0 | Done | Semua staff |
| AUTH-004 | Rate limiting login dan pesan error yang aman. | P0 | Done | Semua user |
| AUTH-005 | Auto logout/token refresh berbasis aktivitas user. | P1 | Done | Semua user |
| AUTH-006 | Reset password via email/token kedaluwarsa. | P1 | Todo | Semua user |
| AUTH-007 | Forced password change untuk akun baru/akun hasil reset. | P1 | Todo | Semua user |
| AUTH-008 | Review permission matrix end-to-end antara sidebar, page guard, dan API middleware. | P0 | Tech Debt | Semua role |
| AUTH-009 | Session/device management: lihat sesi aktif dan revoke sesi. | P2 | Todo | SUPER_ADMIN |

Acceptance criteria umum:
- User hanya dapat melihat data sesuai role dan branch.
- Semua mutation penting membuat audit log.
- Error authorization jelas untuk user, tetapi tidak membocorkan detail teknis.

### Epic 2: User, Staff, dan Admin Management

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| USER-001 | CRUD user/staff dan assignment role. | P0 | Done | SUPER_ADMIN, ADMIN_CABANG |
| USER-002 | Staff branch assignment untuk doctor/nurse lintas cabang. | P0 | Done | ADMIN_MANAGER |
| USER-003 | Admin manager CRUD dan assignment cabang. | P0 | Done | SUPER_ADMIN |
| USER-004 | Branch admin management dan pembatasan scope cabang. | P0 | Done | SUPER_ADMIN, ADMIN_MANAGER |
| USER-005 | Credential management untuk staff dan member. | P1 | Done | SUPER_ADMIN |
| USER-006 | Staff performance dashboard dan detail performa staff. | P1 | Done | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG |
| USER-007 | Aktivasi, deaktivasi, dan alasan suspend user. | P1 | Todo | SUPER_ADMIN |
| USER-008 | Riwayat perubahan role dan cabang staff. | P1 | Todo | SUPER_ADMIN |
| USER-009 | Bulk import staff dari template CSV/XLSX. | P3 | Todo | SUPER_ADMIN |

Acceptance criteria umum:
- Perubahan akses staff langsung mempengaruhi sidebar, API, dan data scope.
- Credential sementara tidak ditampilkan ulang setelah modal ditutup.
- Semua assignment menyimpan actor, waktu, branch context, dan metadata perubahan.

### Epic 3: Branch dan Multi-Branch Operations

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| BRANCH-001 | CRUD cabang, edit kode cabang, detail cabang, dan status cabang. | P0 | Done | SUPER_ADMIN, ADMIN_MANAGER |
| BRANCH-002 | Branch switcher untuk staff multi-cabang. | P0 | Done | ADMIN_MANAGER, DOCTOR, NURSE |
| BRANCH-003 | Detail cabang: overview, staff, member, stok, dan statistik. | P1 | Done | SUPER_ADMIN, ADMIN_MANAGER |
| BRANCH-004 | Validasi uniqueness kode cabang dan dampaknya ke invoice/member/session number. | P0 | Done | SUPER_ADMIN |
| BRANCH-005 | Transfer member atau grant akses member antar cabang. | P1 | Done | ADMIN_MANAGER, ADMIN_CABANG |
| BRANCH-006 | Konfigurasi cabang: alamat, kontak, jam operasional, invoice branding. | P2 | Todo | SUPER_ADMIN |
| BRANCH-007 | Audit trail khusus perubahan cabang dan assignment manager. | P1 | In Progress | SUPER_ADMIN |

Acceptance criteria umum:
- Data cabang tidak bocor ke staff yang tidak punya akses.
- Perubahan kode cabang tidak merusak format invoice/sesi/member existing.

### Epic 4: Member Management dan Portal Member

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| MEMBER-001 | Registrasi member lengkap dengan data personal, kontak, agama, cabang, referral, akun, dan validasi. | P0 | Done | ADMIN_CABANG, ADMIN_LAYANAN |
| MEMBER-002 | Upload foto, dokumen consent, dan dokumen pendukung member. | P0 | Done | Staff operasional |
| MEMBER-003 | List/search/filter/export member dengan kolom yang bisa dikonfigurasi. | P0 | Done | Staff operasional |
| MEMBER-004 | Detail member dengan tab profil, paket, sesi, diagnosa, therapy plan, infus, lab result. | P0 | Done | Staff operasional |
| MEMBER-005 | Edit data member dan audit perubahan. | P0 | Done | Staff operasional |
| MEMBER-006 | Status member: active, inactive, suspended, deceased dengan reason/date. | P1 | In Progress | ADMIN_CABANG |
| MEMBER-007 | Lab result upload, list, dan delete sesuai permission. | P1 | Done | Doctor, Staff |
| MEMBER-008 | Portal member: dashboard pribadi, sesi saya, voucher/paket, invoice, profil. | P1 | Done | MEMBER |
| MEMBER-009 | Member self-service update kontak terbatas dengan approval staff. | P2 | Todo | MEMBER |
| MEMBER-010 | Merge duplicate member dan deteksi duplikasi phone/email/NIK. | P2 | Todo | SUPER_ADMIN |
| MEMBER-011 | Riwayat medical record yang mudah dicetak per member. | P2 | Todo | DOCTOR |

Acceptance criteria umum:
- Member number unik dan konsisten dengan cabang.
- File upload memvalidasi ukuran, tipe file, ownership, dan storage path.
- Portal member hanya menampilkan data milik member tersebut.

### Epic 5: Package, Voucher, Pricing, dan Payment Proof

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| PACK-001 | Assign paket basic, booster, add-on, dan bundling dalam satu pembelian. | P0 | Done | ADMIN_CABANG, ADMIN_LAYANAN |
| PACK-002 | Dynamic package pricing per branch. | P0 | Done | SUPER_ADMIN, ADMIN_MANAGER, ADMIN_CABANG |
| PACK-003 | Discount percentage dan fixed amount dalam satu transaksi. | P0 | Done | Staff operasional |
| PACK-004 | Upload/view bukti pembayaran paket. | P0 | Done | Staff, MEMBER |
| PACK-005 | Verify/reject payment dan aktivasi paket. | P0 | Done | Staff operasional |
| PACK-006 | Edit paket status PENDING_PAYMENT. | P1 | Done | Staff operasional |
| PACK-007 | Cancel paket PENDING_PAYMENT. | P1 | Done | Staff operasional |
| PACK-008 | Refund paket ACTIVE dengan reason dan bukti. | P1 | Done | Staff operasional |
| PACK-009 | Auto expire paket berdasarkan tanggal atau kuota sesi. | P0 | Done | System |
| PACK-010 | Validasi eligibility paket saat membuat sesi terapi. | P0 | Done | Staff operasional |
| PACK-011 | Approval berlapis untuk refund bernilai besar. | P2 | Todo | ADMIN_MANAGER |
| PACK-012 | Riwayat perubahan paket yang mudah dibaca di UI member detail. | P2 | Todo | Staff operasional |

Acceptance criteria umum:
- Harga, diskon, total, status pembayaran, dan invoice selalu konsisten.
- PENDING_PAYMENT tidak boleh dipakai untuk sesi.
- Refund/cancel tidak boleh menghasilkan saldo paket negatif.

### Epic 6: Treatment Session dan EMR Workflow

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| SESS-001 | Create session dengan member, paket eligible, branch, admin, doctor, nurse, dan nomor sesi. | P0 | Done | ADMIN_CABANG, ADMIN_LAYANAN, NURSE |
| SESS-002 | Step 1 diagnosis dengan ICD-10, kategori, keluhan, riwayat, dan pemeriksaan fisik. | P0 | Done | DOCTOR |
| SESS-003 | Step 2 review/create therapy plan dan therapy plan set. | P0 | Done | DOCTOR |
| SESS-004 | Step 3 vital sign sebelum terapi. | P0 | Done | NURSE |
| SESS-005 | Step 4 booster/infusion execution dan aktualisasi dosis. | P0 | Done | NURSE |
| SESS-006 | Step 5 material usage dan automatic stock deduction. | P0 | Done | NURSE |
| SESS-007 | Step 6 upload foto sesi dan supporting photos. | P1 | Done | NURSE |
| SESS-008 | Step 7 vital sign sesudah terapi dan perbandingan before/after. | P0 | Done | NURSE |
| SESS-009 | Step 8 keluhan, rekomendasi, evaluasi dokter, dan completion. | P0 | Done | DOCTOR |
| SESS-010 | Save progress setiap step dan mencegah data hilang saat refresh. | P0 | Done | Staff klinis |
| SESS-011 | Lock session setelah completed, kecuali flow koreksi terbatas. | P0 | In Progress | Staff klinis |
| SESS-012 | Export sesi dan laporan EMR per periode/member/cabang. | P1 | Done | Staff operasional |
| SESS-013 | Conflict detection jadwal staff dan kapasitas cabang. | P2 | Todo | ADMIN_CABANG |
| SESS-014 | Workflow koreksi medis dengan approval dan audit detail. | P1 | Todo | DOCTOR, ADMIN_MANAGER |

Acceptance criteria umum:
- Session completion hanya bisa dilakukan jika step wajib lengkap.
- Stock deduction dan package usage berjalan dalam transaksi database.
- Setiap catatan medis memiliki author, timestamp, dan branch context.

### Epic 7: Therapy Plan Set dan Diagnosis Management

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| THER-001 | Therapy plan set untuk rencana berulang per member. | P0 | Done | DOCTOR |
| THER-002 | Bulk create therapy plan dengan limit kuota paket. | P1 | Done | DOCTOR, Staff |
| THER-003 | Versioning therapy plan dan status superseded/final. | P1 | Done | DOCTOR |
| THER-004 | Edit therapy plan set/row sesuai permission. | P1 | Done | DOCTOR, ADMIN_LAYANAN |
| THER-005 | Substance editor untuk IFA dan material therapy plan. | P1 | Done | DOCTOR |
| THER-006 | Diagnosis categories, ICD search, dan riwayat diagnosis. | P0 | Done | DOCTOR |
| THER-007 | Template therapy plan berdasarkan diagnosis. | P2 | Todo | DOCTOR |
| THER-008 | Clinical warning jika dosis/material melewati batas konfigurasi. | P2 | Todo | DOCTOR |

Acceptance criteria umum:
- Plan lama tidak boleh dipakai jika sudah superseded.
- Edit plan harus menyimpan reason dan snapshot sebelum/sesudah.

### Epic 8: Inventory, Stock Request, Shipment, dan Overstock

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| INV-001 | Master product dan branch inventory item. | P0 | Done | SUPER_ADMIN, ADMIN_CABANG |
| INV-002 | Stock mutation otomatis untuk usage, receive, adjustment, request, dan shipment. | P0 | Done | Staff terkait |
| INV-003 | Low stock alert dan inventory dashboard cabang. | P1 | Done | ADMIN_CABANG |
| INV-004 | Stock request dari cabang ke pusat/manager. | P0 | Done | ADMIN_CABANG |
| INV-005 | Review approve/reject request stok. | P0 | Done | ADMIN_MANAGER |
| INV-006 | Shipment workflow: create, ship, receive, approve, shortage. | P0 | Done | ADMIN_MANAGER, ADMIN_CABANG |
| INV-007 | Upload bukti pembayaran request stok dan partial payment/debt status. | P1 | Done | ADMIN_CABANG, ADMIN_MANAGER |
| INV-008 | Unit conversion dan validasi request quantity. | P1 | Done | Staff terkait |
| INV-009 | Material usage history dan export. | P1 | Done | Staff operasional |
| INV-010 | Overstock summary dan preview deduction. | P2 | Done | ADMIN_MANAGER |
| INV-011 | Cycle count/stock opname dengan approval adjustment. | P1 | Todo | ADMIN_MANAGER |
| INV-012 | Barcode/QR scan untuk product dan batch inventory. | P3 | Todo | Staff gudang |
| INV-013 | Expiry date tracking dan FEFO recommendation. | P2 | Todo | Staff gudang |

Acceptance criteria umum:
- Tidak ada operasi stok yang menghasilkan quantity negatif.
- Mutasi stok immutable dan bisa ditelusuri ke sumber transaksi.
- Shipment received hanya menambah stok setelah status valid.

### Epic 9: Invoice, Payment, dan Non-Therapy Products

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| BILL-001 | Generate invoice untuk paket, add-on, stock request, dan non-therapy item. | P0 | Done | Staff operasional |
| BILL-002 | Format invoice branch-specific dan nomor manual/otomatis. | P0 | Done | Staff operasional |
| BILL-003 | Record payment, partial payment, dan debt status. | P1 | Done | Staff operasional |
| BILL-004 | Upload/view bukti pembayaran invoice. | P0 | Done | Staff, MEMBER |
| BILL-005 | Cancel invoice dengan reason dan audit log. | P1 | Done | Staff operasional |
| BILL-006 | Payment dashboard/list untuk verifikasi pembayaran. | P1 | Done | ADMIN_LAYANAN |
| BILL-007 | Non-therapy product management dan pembelian member. | P1 | Done | SUPER_ADMIN, Staff |
| BILL-008 | PDF invoice profesional dan downloadable. | P1 | In Progress | Staff, MEMBER |
| BILL-009 | Rekonsiliasi pembayaran harian per cabang. | P2 | Todo | ADMIN_CABANG |
| BILL-010 | Integrasi payment gateway/VA/QRIS. | P3 | Todo | Management |

Acceptance criteria umum:
- Total invoice sama dengan total transaksi sumber.
- Pembayaran tidak boleh melebihi outstanding tanpa handling overpayment.
- Invoice yang dibatalkan tidak bisa dibayar lagi.

### Epic 10: Referral dan Incentive

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| REF-001 | CRUD referral code dan active referral dropdown. | P1 | Done | ADMIN_MANAGER, ADMIN_CABANG |
| REF-002 | Assign referral saat registrasi member. | P1 | Done | ADMIN_CABANG, ADMIN_LAYANAN |
| REF-003 | Incentive calculation untuk first package dan next package. | P1 | Done | System |
| REF-004 | Referral detail, statistik, incentive records. | P1 | Done | ADMIN_MANAGER |
| REF-005 | Export incentive Excel/PDF dan summary. | P1 | Done | ADMIN_MANAGER |
| REF-006 | Payout tracking incentive: pending, paid, rejected. | P2 | Todo | Finance/Admin |
| REF-007 | Anti-fraud rule untuk self-referral dan duplicate referral. | P2 | Todo | ADMIN_MANAGER |

Acceptance criteria umum:
- Incentive calculation immutable setelah payment verified.
- Perubahan setting referral tidak mengubah historical incentive.

### Epic 11: Dashboard, Reports, dan Analytics

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| RPT-001 | Dashboard super admin: system stats, health, recent activity, branch performance. | P1 | Done | SUPER_ADMIN |
| RPT-002 | Dashboard admin manager multi-cabang. | P1 | Done | ADMIN_MANAGER |
| RPT-003 | Dashboard admin cabang/layanan. | P1 | Done | ADMIN_CABANG, ADMIN_LAYANAN |
| RPT-004 | Dashboard doctor dan nurse. | P1 | Done | DOCTOR, NURSE |
| RPT-005 | Service dashboard dan report builder/export. | P1 | Done | Staff operasional |
| RPT-006 | Staff performance report. | P1 | Done | ADMIN_MANAGER, ADMIN_CABANG |
| RPT-007 | Scheduled report email. | P2 | In Progress | Management |
| RPT-008 | Financial report per branch, produk, dan periode. | P2 | Todo | Management |
| RPT-009 | Clinical outcome report per diagnosis/therapy type. | P3 | Todo | DOCTOR |
| RPT-010 | Dashboard KPI configurable per role. | P3 | Todo | Management |

Acceptance criteria umum:
- Dashboard menghormati role dan branch scope.
- Export menghasilkan data yang sama dengan filter UI.
- Query besar menggunakan pagination dan batas periode.

### Epic 12: Audit Log, Compliance, dan Impersonation

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| AUD-001 | Audit log untuk login/logout, mutation, payment, package, session, inventory, user, dan branch. | P0 | Done | System |
| AUD-002 | Audit log viewer dengan filter user/action/resource/date/branch. | P0 | Done | SUPER_ADMIN |
| AUD-003 | Upgrade audit trail agar user nullable dan metadata lengkap. | P0 | Done | System |
| AUD-004 | Impersonation super admin/admin manager dengan banner dan stop impersonation. | P0 | Done | SUPER_ADMIN, ADMIN_MANAGER |
| AUD-005 | Proteksi nested impersonation dan error cases. | P0 | Done | SUPER_ADMIN |
| AUD-006 | Export audit log untuk compliance. | P1 | Todo | SUPER_ADMIN |
| AUD-007 | Sensitive data masking di audit log UI dan export. | P1 | Todo | SUPER_ADMIN |
| AUD-008 | Retention policy audit log dan archival. | P2 | Todo | SUPER_ADMIN |

Acceptance criteria umum:
- Impersonation selalu menampilkan banner dan actor asli.
- Audit log tidak boleh menyimpan password, token, atau file secret.

### Epic 13: Communication, Notification, dan Chat

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| COMM-001 | Halaman notification di staff area. | P2 | In Progress | Semua staff |
| COMM-002 | Send notification to member dari detail member. | P1 | Done | Semua staff |
| COMM-003 | WhatsApp notification untuk event penting. | P2 | In Progress | Staff, MEMBER |
| COMM-004 | Chat page staff. | P3 | In Progress | Semua staff |
| COMM-005 | Notification center dengan unread/read state. | P2 | Todo | Semua user |
| COMM-006 | Template notifikasi untuk pembayaran, sesi, stok, dan referral. | P2 | Todo | ADMIN_MANAGER |
| COMM-007 | Member portal notification inbox. | P2 | Todo | MEMBER |

Acceptance criteria umum:
- User hanya menerima notifikasi sesuai branch/ownership.
- Pengiriman eksternal menyimpan status delivered/failed dan retry count.

### Epic 14: File Storage, Upload, dan Media Processing

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| FILE-001 | MinIO/S3-compatible storage untuk dokumen, foto, dan invoice. | P0 | Done | System |
| FILE-002 | API file serving dengan authentication. | P0 | Done | Semua user |
| FILE-003 | Image compression untuk foto sesi/member. | P1 | Done | System |
| FILE-004 | Upload payment proof, member document, lab result, avatar, session photo. | P0 | Done | Staff, MEMBER |
| FILE-005 | Signed URL atau protected proxy konsisten untuk semua file. | P1 | In Progress | System |
| FILE-006 | Virus/malware scanning untuk upload production. | P2 | Todo | System |
| FILE-007 | File retention dan cleanup orphan files. | P2 | Todo | System |

Acceptance criteria umum:
- File tidak bisa diakses tanpa auth valid.
- Upload gagal tidak meninggalkan database record yatim.

### Epic 15: Frontend UX, Responsive Design, dan Design System

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| UX-001 | Login page, loading state, spinner, toast, modal, button, data table, confirm dialog. | P1 | Done | Semua user |
| UX-002 | Sidebar role-based dan header/profile/branch switcher. | P0 | Done | Semua staff |
| UX-003 | Responsive design untuk mobile/tablet/desktop. | P1 | In Progress | Semua user |
| UX-004 | Standard empty/error/loading state di semua list dan form. | P1 | In Progress | Semua user |
| UX-005 | Konsistensi CSS modules, dark theme RAHO, dan komponen UI reusable. | P1 | In Progress | Semua user |
| UX-006 | Accessibility pass: keyboard nav, focus state, labels, contrast. | P2 | Todo | Semua user |
| UX-007 | Form autosave/draft untuk session workflow panjang. | P2 | Todo | Staff klinis |
| UX-008 | Optimasi table besar: server-side pagination, virtual list bila perlu. | P2 | Todo | Staff operasional |

Acceptance criteria umum:
- UI tidak menampilkan menu yang tidak bisa diakses role.
- Semua action destruktif memakai confirm dialog dan reason bila perlu.
- Error API tampil jelas dan tidak membuat page blank.

### Epic 16: Backend Architecture, Database, dan API Quality

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| TECH-001 | Modular service architecture untuk admin, members, packages, sessions, invoices, inventory. | P0 | Done | Engineering |
| TECH-002 | Zod validation schemas untuk input API. | P0 | Done | Engineering |
| TECH-003 | Prisma migrations dan seed data essential/testing. | P0 | Done | Engineering |
| TECH-004 | Transaction boundary untuk package/payment/session/inventory. | P0 | In Progress | Engineering |
| TECH-005 | Standard API response dan error handler. | P0 | Done | Engineering |
| TECH-006 | Database indexes untuk query besar: members, sessions, invoices, audit logs, stock mutations. | P1 | Todo | Engineering |
| TECH-007 | API contract documentation otomatis/OpenAPI. | P2 | Todo | Engineering |
| TECH-008 | Background jobs untuk report, notification, file cleanup, auto-expire package. | P2 | Todo | Engineering |
| TECH-009 | Observability: request logs, metrics, tracing, alerting. | P1 | Todo | Engineering |
| TECH-010 | Backup/restore procedure dan disaster recovery runbook. | P0 | Todo | Engineering |

Acceptance criteria umum:
- Endpoint mutation penting menggunakan transaksi saat mengubah beberapa tabel.
- Error log cukup untuk debugging tanpa membocorkan data sensitif.

### Epic 17: Testing, QA, dan Release Management

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| QA-001 | Unit tests backend untuk auth, audit log, invoice, branches, sessions, packages, inventory. | P0 | In Progress | Engineering |
| QA-002 | Unit tests frontend untuk UI primitives dan presentation helpers. | P1 | In Progress | Engineering |
| QA-003 | Playwright E2E flows: dashboard, member, session, payment, inventory, referral, report, audit, chat. | P0 | In Progress | QA |
| QA-004 | Test matrix role simulation lintas cabang. | P0 | Done | QA |
| QA-005 | Seed minimal, essential, testing, dan realistic stock. | P0 | Done | Engineering |
| QA-006 | CI pipeline untuk type-check, test, build, e2e smoke. | P1 | Todo | Engineering |
| QA-007 | Regression checklist per release. | P1 | Todo | QA |
| QA-008 | Performance/load test untuk list besar dan audit log. | P2 | Todo | Engineering |
| QA-009 | Security test untuk auth, upload, branch leak, dan injection. | P1 | Todo | Engineering |

Acceptance criteria umum:
- Build dan type-check bersih sebelum release.
- E2E smoke mencakup minimal login, member, assign package, payment, session complete, stock mutation.

### Epic 18: Deployment dan Operations

| ID | Backlog Item | Priority | Status | Role Utama |
| --- | --- | --- | --- | --- |
| OPS-001 | Docker compose dev dan production. | P0 | Done | DevOps |
| OPS-002 | Environment examples untuk API dan web. | P0 | Done | DevOps |
| OPS-003 | Deployment checklist dan guide. | P1 | Done | DevOps |
| OPS-004 | Production health check API dan frontend readiness. | P0 | In Progress | DevOps |
| OPS-005 | Secret management untuk JWT, database, MinIO, dan integrations. | P0 | Todo | DevOps |
| OPS-006 | Automated migration strategy production. | P0 | Todo | DevOps |
| OPS-007 | Log rotation, centralized logs, dan alerting. | P1 | Todo | DevOps |
| OPS-008 | Backup database dan MinIO berkala dengan restore test. | P0 | Todo | DevOps |
| OPS-009 | Release notes dan versioning aplikasi. | P2 | Todo | DevOps |

Acceptance criteria umum:
- Production deploy bisa diulang tanpa langkah manual berisiko.
- Rollback plan tersedia untuk app dan database.

## 5. Prioritas MVP / Stabilization

### P0 - Harus Stabil

- Login, logout, refresh token, RBAC, branch access.
- Member registration, member detail, documents, package assignment.
- Payment proof, verification, invoice consistency.
- Session workflow 8 step, package usage, stock deduction.
- Inventory stock request dan shipment.
- Audit log untuk mutation penting.
- Backup/restore dan deployment production basics.

### P1 - Sprint Berikutnya

- Password reset dan forced password change.
- Lock/koreksi session completed dengan approval.
- Dashboard/report stabilization.
- Responsive UX dan standard loading/error state.
- Export audit log dan sensitive data masking.
- CI pipeline type-check/test/build.
- Database indexes dan performance pass.

### P2 - Enhancement

- Scheduled reports dan notification center.
- Stock opname, expiry tracking, FEFO.
- Member self-service update dengan approval.
- Rekonsiliasi pembayaran harian.
- Clinical warning dan therapy template.
- Observability lengkap.

### P3 - Future

- Payment gateway/VA/QRIS.
- Barcode/QR inventory.
- Advanced clinical outcome analytics.
- Chat production-ready.
- KPI dashboard configurable.

## 6. Kandidat Sprint Plan

### Sprint 1: Production Hardening Core Flow

Goal: memastikan flow member sampai sesi selesai aman untuk operasional.

- AUTH-008 Review permission matrix end-to-end.
- SESS-011 Lock completed session.
- TECH-004 Transaction boundary untuk package/payment/session/inventory.
- QA-003 E2E smoke untuk member-package-payment-session-stock.
- OPS-008 Backup database dan MinIO.

Definition of done:
- Type-check dan test inti lulus.
- E2E smoke berjalan di seed testing.
- Ada catatan rollback dan backup restore minimal.

### Sprint 2: Payment, Audit, dan Reporting

Goal: memperkuat kontrol finansial dan compliance.

- BILL-008 PDF invoice downloadable final.
- AUD-006 Export audit log.
- AUD-007 Sensitive data masking.
- RPT-008 Financial report per branch/periode.
- QA-009 Security test auth/upload/branch leak.

Definition of done:
- Report/export cocok dengan filter UI.
- Audit export tidak memuat secret/token/password.
- Role yang tidak berhak gagal mengakses data lintas cabang.

### Sprint 3: UX dan Operational Efficiency

Goal: mempercepat pekerjaan staff harian.

- UX-003 Responsive design pass.
- UX-004 Standard empty/error/loading state.
- INV-011 Stock opname.
- MEMBER-011 Printable medical record.
- COMM-005 Notification center.

Definition of done:
- Halaman utama staff/member usable di desktop dan mobile.
- Error API tidak membuat halaman blank.
- Stock opname menghasilkan mutasi dan approval trail.

## 7. Dependency Map

- Package assignment bergantung pada member, pricing, invoice, payment proof, referral.
- Session completion bergantung pada active package, therapy plan, vital signs, material usage, inventory stock, audit log.
- Shipment bergantung pada stock request approval, inventory item, stock mutation, branch access.
- Dashboard/report bergantung pada data correctness dari member, packages, sessions, inventory, invoices.
- Portal member bergantung pada auth member, ownership check, file serving, invoice/session/package APIs.
- Impersonation bergantung pada audit log, session context, banner UI, dan permission matrix.

## 8. Non-Functional Backlog

| ID | Item | Priority | Status |
| --- | --- | --- | --- |
| NFR-001 | Response time mayoritas operasi di bawah 2 detik dengan pagination dan indexing. | P1 | Todo |
| NFR-002 | Security review untuk JWT, CORS, upload, rate limit, dan data masking. | P0 | Todo |
| NFR-003 | Database transaction dan concurrency handling untuk stok/pembayaran/paket. | P0 | In Progress |
| NFR-004 | Auditability: actor, branch, IP/user agent, before/after metadata. | P0 | In Progress |
| NFR-005 | Accessibility baseline untuk form, modal, table, dan workflow session. | P2 | Todo |
| NFR-006 | Monitoring, logs, health check, backup, restore test. | P0 | Todo |
| NFR-007 | Developer experience: CI, lint/type-check, seed repeatability, docs API. | P1 | Todo |

## 9. Open Questions untuk Product Owner

- Apakah role ADMIN_LAYANAN boleh verify pembayaran sendiri, atau perlu approval ADMIN_CABANG/ADMIN_MANAGER untuk nominal tertentu?
- Setelah sesi completed, koreksi medis boleh dilakukan oleh siapa dan butuh approval siapa?
- Apakah status deceased/suspended member harus memblokir semua transaksi baru atau hanya sesi terapi?
- Apakah incentive referral dibayar manual, per periode, atau otomatis melalui sistem finance?
- Format laporan finansial resmi apa saja yang wajib untuk operasional bulanan?
- Apakah WhatsApp notification wajib untuk go-live atau bisa masuk fase setelah stabilisasi?

## 10. Definition of Ready

Sebuah backlog item siap dikerjakan jika:
- Role utama dan business value jelas.
- Acceptance criteria minimum sudah ditulis.
- Data model/API terdampak diketahui.
- Permission dan branch scope jelas.
- Risiko migrasi atau data existing sudah diidentifikasi.

## 11. Definition of Done

Sebuah backlog item dianggap selesai jika:
- Implementasi frontend/backend/database selesai sesuai scope.
- Permission, branch access, validation, error handling, dan audit log sudah sesuai.
- Unit/integration/E2E test ditambahkan sesuai risiko.
- Type-check dan build lulus.
- Dokumentasi atau test scenario diperbarui bila behavior berubah.
- Tidak ada regression pada flow P0.

