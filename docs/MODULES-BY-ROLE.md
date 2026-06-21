# Daftar Modul Sistem Berdasarkan Role

Dokumen ini merangkum modul yang ada di sistem RAHO dan pembagian aksesnya berdasarkan role.

Sumber pemetaan:
- UI staff sidebar: `apps/web/src/components/layout/Sidebar.tsx`
- Portal member: `apps/web/src/app/(member)/me`
- API route registry: `apps/api/src/app.ts`
- API route modules: `apps/api/src/modules/**/**.routes.ts`

Catatan:
- "Menu utama" berarti modul yang tampil di sidebar atau portal utama.
- Beberapa API lebih luas dari menu UI. Contoh: API sesi terapi bisa dibaca/diisi semua staff tertentu, tetapi create sesi mengecualikan role dokter.
- Modul Notifikasi dan Chat sudah ada di UI, tetapi halaman utamanya masih `Under Construction`.

## Role

| Role | Label UI | Area akses utama |
| --- | --- | --- |
| `SUPER_ADMIN` | Super Admin | Sistem pusat, master data, cabang, admin manager, audit, impersonation |
| `ADMIN_MANAGER` | Admin Manager | Monitoring banyak cabang, admin cabang, request stok, pengiriman, pricing, referral |
| `ADMIN_CABANG` | Admin Cabang | Operasional cabang, staff cabang, member, sesi, stok, paket |
| `ADMIN_LAYANAN` | Admin Layanan | Operasional layanan: member, sesi terapi, paket, invoice |
| `DOCTOR` | Dokter | Klinis: member, diagnosa, therapy plan, sesi terapi, evaluasi |
| `NURSE` | Nakes | Layanan medis: sesi terapi, vital sign, infus, material, stok |
| `MEMBER` | Member | Portal pribadi member |

## Ringkasan Modul Backend

Modul backend yang terdaftar di API:

| Modul API | Prefix | Fungsi utama |
| --- | --- | --- |
| Auth | `/auth` | Login, refresh token, logout, current user |
| Dashboard | `/dashboard` | Dashboard umum dan dashboard spesifik role |
| Me | `/me` | Portal member |
| Users | `/users` | User, staff, cabang staff, credential, performance |
| Admin Manager | `/admin-manager` | Cabang yang dikelola admin manager |
| Branches | `/branches` | Cabang, staff cabang, member cabang, manager cabang |
| Members | `/members` | Member, dokumen, diagnosa, paket, therapy plan, lab result |
| Packages | `/packages`, `/package-pricings` | Paket, bukti bayar, verifikasi, refund, pricing |
| Treatment Sessions | `/treatment-sessions` | Sesi terapi dan step operasional terapi |
| Diagnosis | `/diagnosis` | Kategori diagnosis |
| Non Therapy | `/non-therapy` | Produk non-terapi dan pembelian member |
| Invoices | `/invoices` | Invoice, pembayaran, bukti bayar |
| Inventory | `/inventory` | Stok, mutasi, request stok, pengiriman, overstock |
| Referrals | `/referrals` | Kode referral dan insentif |
| Audit Logs | `/audit-logs` | Log aktivitas dan statistik audit |
| Admin | `/admin` | System admin, master data, admin managers, impersonation |
| Files | `/files` | Serve file/dokumen melalui API |

## Matrix Menu Utama

Kode kolom:
- SA = `SUPER_ADMIN`
- AM = `ADMIN_MANAGER`
- AC = `ADMIN_CABANG`
- AL = `ADMIN_LAYANAN`
- DR = `DOCTOR`
- NR = `NURSE`
- MB = `MEMBER`

| Modul menu | Route UI | SA | AM | AC | AL | DR | NR | MB |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard Super Admin | `/admin/super-admin` | Y | - | - | - | - | - | - |
| Dashboard Staff | `/dashboard` | - | Y | Y | Y | Y | Y | - |
| Dashboard Member | `/me/dashboard` | - | - | - | - | - | - | Y |
| Member | `/members` | - | Y | Y | Y | Y | Y | - |
| Sesi Terapi | `/sessions` | - | - | Y | Y | Y | Y | - |
| Stok | `/inventory` | - | - | Y | Y | Y | Y | - |
| Mutasi Stok | `/inventory/stock-mutations` | Y | Y | Y | Y | Y | Y | - |
| Request Stok | `/inventory/stock-requests` | - | Y | Y | - | - | - | - |
| Pengiriman | `/inventory/shipments` | Y | Y | Y | - | - | - | - |
| Notifikasi | `/notifications` | Y | Y | Y | Y | Y | Y | - |
| Chat | `/chat` | Y | Y | Y | Y | Y | Y | - |
| Pengaturan Cabang | `/branches` | Y | Y | - | - | - | - | - |
| Kelola Staff | `/staff` | - | - | Y | - | - | - | - |
| Kinerja Staff | `/staff-performance` | Y | Y | Y | - | - | - | - |
| Kode Referral | `/referrals` | - | Y | Y | - | - | - | - |
| Harga Paket | `/admin/package-pricing` | Y | Y | Y | - | - | - | - |
| Admin Managers | `/admin/managers` | Y | - | - | - | - | - | - |
| Master Produk | `/admin/master-products` | Y | - | - | - | - | - | - |
| Audit Log | `/admin/audit-logs` | Y | - | - | - | - | - | - |
| Sesi Saya | `/me/sessions` | - | - | - | - | - | - | Y |
| Voucher/Paket Saya | `/me/vouchers` | - | - | - | - | - | - | Y |
| Invoice Saya | `/me/invoices` | - | - | - | - | - | - | Y |
| Profil Saya | `/me/profile` | - | - | - | - | - | - | Y |

## Grouping Modul Per Role

### SUPER_ADMIN

Menu utama:
- Dashboard Super Admin: statistik sistem, health, aktivitas terbaru, performa cabang.
- Mutasi Stok: melihat riwayat mutasi stok lintas cabang.
- Pengiriman: melihat dan memproses shipment.
- Notifikasi: halaman tersedia, masih under construction.
- Chat: halaman tersedia, masih under construction.
- Pengaturan Cabang: CRUD cabang, detail cabang, staff, member, sesi cabang, assignment manager.
- Kinerja Staff: monitoring performa staff.
- Harga Paket: pricing paket dan pricing cabang.
- Admin Managers: CRUD admin manager dan assignment cabang.
- Master Produk: CRUD master product.
- Audit Log: log aktivitas sistem.

Sub-modul/fungsi backend:
- Auth dan profil user.
- User management semua role.
- Credential management user dan member.
- Branch admin management.
- Impersonation ke admin manager/admin cabang.
- Master booster type dan service type.
- Non-therapy product management.
- Paket member: assign, edit, verify, reject, cancel, refund.
- Invoice: create, update, finalize, record payment, cancel.
- Member: list, register, update, delete, export, dokumen, diagnosa, therapy plan, lab result.
- Sesi terapi: list, create, detail, export, progress, complete.
- Inventory: item stok, adjustment, export, request stok, shipment, overstock.
- Referral dan incentive export.
- File serving.

### ADMIN_MANAGER

Menu utama:
- Dashboard Admin Manager.
- Member: monitoring member di cabang yang dikelola.
- Mutasi Stok: melihat mutasi stok.
- Request Stok: review dan proses request stok.
- Pengiriman: melihat dan memproses pengiriman.
- Notifikasi: halaman tersedia, masih under construction.
- Chat: halaman tersedia, masih under construction.
- Pengaturan Cabang: melihat/mengelola cabang dalam scope manager.
- Kinerja Staff: monitoring staff cabang yang dikelola.
- Kode Referral: CRUD referral dan export insentif.
- Harga Paket: kelola pricing paket.

Sub-modul/fungsi backend:
- Admin Manager panel: cabang yang dikelola (`/admin-manager/branches`) dan dokter (`/admin-manager/doctors`).
- Branch admin management.
- Staff branch assignment untuk doctor/nurse.
- Member: list, register, update, delete, export, dokumen, diagnosa, therapy plan, lab result.
- Paket member: assign, edit, verify, reject, cancel, refund.
- Invoice operasional.
- Non-therapy product management dan pembelian non-terapi.
- Inventory: melihat stok, mutasi, adjustment terbatas, request stok, pengiriman, overstock.
- Referral management.
- Audit logs tersedia di API untuk admin manager.
- Impersonation ke admin cabang.
- File serving.

### ADMIN_CABANG

Menu utama:
- Dashboard Admin Cabang.
- Member: register, lihat, update member cabang.
- Sesi Terapi: create dan kelola sesi terapi.
- Stok: stok cabang, item stok, low stock.
- Mutasi Stok: riwayat mutasi stok cabang.
- Request Stok: membuat dan memantau request stok.
- Pengiriman: menerima shipment dan melihat status.
- Notifikasi: halaman tersedia, masih under construction.
- Chat: halaman tersedia, masih under construction.
- Kelola Staff: CRUD staff cabang untuk admin layanan, dokter, dan nakes.
- Kinerja Staff: monitoring staff cabang.
- Kode Referral: CRUD referral cabang dan insentif.
- Harga Paket: kelola pricing paket sesuai scope.

Sub-modul/fungsi backend:
- Member: list, lookup, register, update, delete, export, dokumen, diagnosa, lab result.
- Paket member: assign, edit, verify, reject, cancel, refund.
- Therapy plan member: bulk create, edit set/row sesuai izin, history.
- Sesi terapi: semua step operasional terapi.
- Invoice operasional.
- Non-therapy purchase untuk member.
- Inventory: item stok, batch create, update, adjust stock, export, stock mutation.
- Stock request: create request.
- Shipment: receive shipment.
- Overstock: lihat summary dan preview deduction.
- Master booster type dan service type: create/update; delete hanya super admin.
- Audit logs tersedia di API untuk admin cabang.
- File serving.

### ADMIN_LAYANAN

Menu utama:
- Dashboard Admin Layanan.
- Member: lihat dan kelola data member operasional.
- Sesi Terapi: create dan kelola sesi terapi.
- Stok: melihat stok dan stok tersedia untuk layanan.
- Mutasi Stok: melihat riwayat mutasi stok.
- Notifikasi: halaman tersedia, masih under construction.
- Chat: halaman tersedia, masih under construction.

Sub-modul/fungsi backend:
- Member: list, lookup, register, update, export, dokumen, diagnosa, lab result.
- Paket member: assign, edit, upload bukti bayar, verify/reject, cancel, refund.
- Non-therapy purchase untuk member.
- Invoice: create, update, finalize, record payment, cancel.
- Sesi terapi: diagnosis, review therapy plan, vital sign, booster type, infusion, material usage, photo, evaluasi dokter, complete session.
- Therapy plan member: view, bulk create, history; beberapa endpoint edit set/row juga mengizinkan admin layanan.
- Inventory: lihat stok, low stock, export, mutasi.
- Referral active list untuk dropdown.
- File serving.

### DOCTOR

Menu utama:
- Dashboard Dokter.
- Member: melihat data member, diagnosis, paket, therapy plan, lab result.
- Sesi Terapi: kelola sesi terapi yang relevan.
- Stok: melihat stok dan stok tersedia.
- Mutasi Stok: melihat riwayat mutasi stok.
- Notifikasi: halaman tersedia, masih under construction.
- Chat: halaman tersedia, masih under construction.

Sub-modul/fungsi backend:
- Member: list, lookup, detail, diagnosa, lab result, infusion history.
- Therapy plan member: view, bulk create, history, edit sesuai izin backend.
- Sesi terapi: list/detail, diagnosis, update diagnosis session khusus dokter, therapy plan review, vital sign, booster, infusion, material usage, photo, evaluasi dokter, complete session. Dokter tidak dapat membuat sesi terapi baru.
- Inventory: lihat stok, low stock, export, mutasi.
- Referral active list untuk dropdown.
- Non-therapy purchase: view.
- Staff dropdown untuk kebutuhan create session.
- File serving.

### NURSE

Menu utama:
- Dashboard Nakes.
- Member: melihat data member, paket, diagnosis, therapy plan, lab result.
- Sesi Terapi: menjalankan step layanan terapi.
- Stok: melihat stok dan stok tersedia.
- Mutasi Stok: melihat riwayat mutasi stok.
- Notifikasi: halaman tersedia, masih under construction.
- Chat: halaman tersedia, masih under construction.

Sub-modul/fungsi backend:
- Member: list, lookup, detail, diagnosa, lab result, infusion history.
- Therapy plan member: view, bulk create, history.
- Sesi terapi: create/list/detail, vital sign, booster, infusion, material usage, photo, evaluasi dokter, complete session.
- Inventory: lihat stok, low stock, export, mutasi.
- Referral active list untuk dropdown.
- Non-therapy purchase: view.
- Staff dropdown untuk kebutuhan create session.
- File serving.

### MEMBER

Menu utama portal:
- Dashboard Member: ringkasan paket, sesi, invoice, status member.
- Sesi Saya: list sesi terapi dan detail sesi read-only.
- Voucher/Paket Saya: list paket/voucher member.
- Invoice Saya: list dan detail invoice.
- Profil Saya: profil member.

Sub-modul/fungsi backend:
- Detail diagnosis member.
- Detail sesi terapi member: diagnosis, therapy plan, vital sign, infusion, material, photo, evaluasi.
- Upload bukti pembayaran paket.
- Melihat bukti pembayaran invoice.

## Sub-Modul Detail

### Member

Sub-modul:
- List dan pencarian member.
- Registrasi member.
- Export member.
- Detail profil member.
- Dokumen consent dan foto profil.
- Credential member.
- Paket/voucher member.
- Referral incentive member.
- Diagnosa member.
- Therapy plan set dan history.
- Riwayat infus.
- Lab result.
- Notifikasi ke member.

Role utama:
- View: semua staff.
- Create/update/delete/export: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`, `ADMIN_LAYANAN`.
- Credential member: `SUPER_ADMIN`.
- Delete lab result: `SUPER_ADMIN`, `ADMIN_MANAGER`.

### Paket, Voucher, dan Invoice

Sub-modul:
- Assign paket basic/booster/add-on.
- Upload bukti pembayaran.
- Verifikasi/reject pembayaran.
- Edit paket pending.
- Cancel paket pending.
- Refund paket aktif.
- Package pricing.
- Invoice create, finalize, payment, cancel.

Role utama:
- Paket member: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`, `ADMIN_LAYANAN`.
- Pricing menu: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`.
- Pricing API tertentu: create/update/delete juga tersedia untuk `SUPER_ADMIN`, `ADMIN_MANAGER`.
- Invoice operasional: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`, `ADMIN_LAYANAN`.
- Member dapat melihat invoice sendiri dan upload bukti pembayaran melalui portal.

### Sesi Terapi

Sub-modul step:
- Create session.
- Step diagnosis.
- Review therapy plan.
- Vital sign sebelum/sesudah.
- Booster type.
- Infusion aktual.
- Material usage.
- Upload foto.
- Evaluasi dokter.
- Save progress.
- Complete session.
- Export session.

Role utama:
- API sesi terapi: semua staff untuk akses operasional; create sesi tidak mengizinkan `DOCTOR`.
- Menu sidebar: `ADMIN_CABANG`, `ADMIN_LAYANAN`, `DOCTOR`, `NURSE`.
- Update diagnosis session khusus dokter pada endpoint patch diagnosis.

### Inventory

Sub-modul:
- Stok item cabang.
- Master products untuk stok.
- Low stock.
- Stock adjustment.
- Export inventory.
- Mutasi stok.
- Request stok.
- Shipment/pengiriman.
- Overstock.

Role utama:
- Lihat stok/mutasi/export: semua staff.
- Kelola inventory item dan adjustment: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`.
- Request stok: create oleh `ADMIN_CABANG`, review/proses oleh `SUPER_ADMIN`, `ADMIN_MANAGER`.
- Shipment: lihat oleh `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`; ship oleh `SUPER_ADMIN`, `ADMIN_MANAGER`; receive oleh `ADMIN_CABANG`.

### Cabang dan Staff

Sub-modul:
- List/CRUD cabang.
- Detail cabang.
- Member cabang.
- Staff cabang.
- Admin manager assignment.
- Staff branch assignment untuk doctor/nurse.
- Kelola staff cabang.
- Staff performance.

Role utama:
- Cabang: `SUPER_ADMIN`, `ADMIN_MANAGER`.
- Staff cabang: `ADMIN_CABANG` via menu Kelola Staff.
- Staff performance: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`.
- Credential user: `SUPER_ADMIN`.
- Reset password user: `SUPER_ADMIN`, `ADMIN_MANAGER`.

### Super Admin dan Master Data

Sub-modul:
- System stats.
- System health.
- Recent activities.
- Branch performance.
- Admin managers.
- Branch admins.
- All users.
- Master products.
- Master booster types.
- Master service types.
- Package pricing.
- Non-therapy products.
- Impersonation.
- Audit logs.

Role utama:
- Mayoritas system dan master product: `SUPER_ADMIN`.
- Branch admins dan impersonation: `SUPER_ADMIN`, `ADMIN_MANAGER`.
- Master booster/service type: view `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`; create/update `SUPER_ADMIN`, `ADMIN_CABANG`; delete `SUPER_ADMIN`.
- Non-therapy products: view staff tertentu, manage `SUPER_ADMIN`, `ADMIN_MANAGER`.

### Referral

Sub-modul:
- List referral.
- Active referral dropdown.
- Create/update/delete referral.
- Detail referral.
- Incentive records.
- Export incentive Excel/PDF.
- Export summary.

Role utama:
- Management: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`, `ADMIN_LAYANAN`.
- Menu sidebar: `ADMIN_MANAGER`, `ADMIN_CABANG`.
- Active list untuk dropdown: semua staff.

### Komunikasi

Sub-modul:
- Notifikasi page.
- Chat page.
- Send notification to member via member detail.

Role utama:
- Notifikasi dan Chat menu: semua staff.
- Halaman Notifikasi dan Chat masih under construction.
- Send notification endpoint: semua staff, melalui member detail.

### File dan Dokumen

Sub-modul:
- Serve file dari storage melalui API.
- Upload member document.
- Upload lab result.
- Upload payment proof.
- Upload session photo.
- Upload avatar.

Role utama:
- Serve file: semua user terautentikasi.
- Upload dokumen member: `SUPER_ADMIN`, `ADMIN_MANAGER`, `ADMIN_CABANG`, `ADMIN_LAYANAN`.
- Upload lab result: semua staff.
- Upload payment proof: staff operasional dan member sesuai alur.
- Upload session photo: semua staff pada sesi terapi.
