# Cleanup Progress

Discovery date: 2026-07-01

Scope: frontend Next.js (`apps/web`) dan backend Express.js/Prisma (`apps/api`).

Status test fase ini: tidak dijalankan, karena fase ini hanya discovery/backlog dan tidak mengubah kode aplikasi.

## Priority Definition

P0 bukan nama phase. P0 berarti prioritas paling tinggi / risiko paling besar. Modul P0 menyentuh data atau workflow yang kalau rusak bisa berdampak langsung ke operasional klinik, data pasien, pembayaran, terapi, stok, atau keamanan akses.

- P0 Risiko Tinggi: data pasien/member, billing/payment/invoice, terapi/sesi, stok, auth/security. Harus dikerjakan dengan batch kecil, test dulu, lalu refactor.
- P1 Kompleksitas Tinggi/Shared: modul besar, lintas role/branch, schema/migration, shared service. Dampaknya luas, jadi perlu dilakukan setelah pola cleanup dan test cukup stabil.
- P2 Quick Win/Validasi Pendekatan: modul kecil atau workflow pendukung untuk membuktikan pola cleanup. Dipakai untuk menstabilkan test harness dan cara kerja sebelum masuk P0.

## Execution Rules

- Jangan cleanup seluruh repo sekaligus.
- Setiap batch harus scoped ke satu modul/submodul.
- Setiap batch harus punya verifikasi minimal `type-check:web` atau test relevan.
- Jika batch menyentuh backend, tambahkan/verifikasi test backend atau contract check yang relevan.
- Jangan lanjut ke batch berikutnya kalau batch berjalan belum selesai atau masih gagal test tanpa dicatat.
- Jika ada skipped test, catat alasan skipped dan apakah skipped itu acceptable atau harus menjadi backlog fitur.
- Update file ini setiap selesai batch.

## Completed Summary

- Batch 1 selesai: E2E Test Harness.
- Batch 2 selesai: FE Referrals / Incentives.
- Batch 3 selesai: FE Notifications.
- Batch 4 selesai: FE Reports.
- Batch 5 selesai: FE Dashboard Supporting Cleanup.
- Batch 6 selesai: FE Chat / Supporting Placeholder.
- Batch 7 selesai: FE Auth / Layout / Sidebar.
- Batch 8 selesai: BE Auth / Middleware / Security.
- Batch 9 selesai: FE Inventory: Stock Requests Small Slice.
- Batch 10 selesai: BE Inventory: Stock Request Approval Small Slice.
- Batch 11 selesai: FE Payments / Invoices Small Slice.
- Batch 12 selesai: BE Packages / Billing / Invoices Small Slice.
- Batch 13 selesai: FE Members Small Slice.
- Batch 14 selesai: BE Members Small Slice.
- Batch 15 selesai: FE Sessions / Therapy Plan Small Slice.
- Batch 16 selesai: BE Sessions / Treatment Small Slice.
- Batch 17 selesai: FE Sessions Step 2 / Therapy Plan Small Slice.
- Batch 18 selesai: BE Core Utils / Audit Log Compatibility Small Slice.
- Batch 19 selesai: BE Branches Debug Logging Small Slice.
- Batch 20 selesai: BE Referrals Controller Logging Small Slice.
- Batch 21 selesai: FE Shared UI Modal Reuse Small Slice.
- Lanjutan berikutnya: Batch 22: FE Shared Button Adoption Small Slice.

Priority guide:
- P0 Risiko Tinggi: data pasien/member, billing/payment/invoice, terapi/sesi, stok, auth/security.
- P1 Kompleksitas Tinggi/Shared: modul besar, lintas role/branch, schema/migration, shared service.
- P2 Quick Win/Validasi Pendekatan: modul kecil atau workflow pendukung untuk membuktikan pola cleanup.

| Modul | Jumlah File | Prioritas | Status | Catatan Awal |
|-------|------------|-----------|--------|--------------|
| BE Members / Patient Records | 20 (~7.1k LOC) | P0 Risiko Tinggi | Batch 14 Complete | Data pasien/member tetap perlu cleanup bertahap. Batch 14 mengambil slice kecil registration: parsing tanggal lahir dan resolusi nomor identitas diekstrak dari service `@ts-nocheck` ke helper typed serta ditutup unit test tanpa menyentuh transaksi Prisma atau generation member number. |
| FE Members / Patient Records | 67 (~21.4k LOC) | P0 Risiko Tinggi | Batch 13 Complete | UI member paling besar dan tetap perlu cleanup per subfitur. Batch 13 mengambil slice kecil `MemberStatusCards`: kalkulasi voucher BASIC/BOOSTER standalone dan grouped diekstrak ke helper pure serta ditutup unit test tanpa mengubah API, package assignment, edit member, atau dokumen. |
| BE Packages / Billing / Invoices | 22 (~5.2k LOC) | P0 Risiko Tinggi | Batch 12 Complete | Menyentuh invoice, assignment paket, refund, cancel, payment verification. Batch 12 mengambil slice kecil di `invoice-generation.service.ts`: helper pure alokasi item invoice termin/installment diekstrak dan ditutup unit test contract. |
| FE Packages / Billing / Invoices / Payments | 19 (~5.1k LOC) | P0 Risiko Tinggi | Batch 11 Complete | Payment page ~833 LOC, invoice rendering/CSS besar. Batch 11 mengambil slice kecil pada local payment harness `/payments`: helper presentasi/kalkulasi/filter invoice diekstrak dari page dan ditutup unit test + payment E2E. |
| BE Sessions / Treatment / Diagnosis | 26 (~5.9k LOC) | P0 Risiko Tinggi | Batch 16 Complete | Menyentuh terapi klinis dan diagnosis sehingga tetap perlu cleanup bertahap. Batch 16 mengambil slice validasi paket utama session creation: mode ACTIVE/DEBT, urutan error, sisa sesi, dan allowance dua sesi utang diekstrak ke helper pure dengan contract test. |
| FE Sessions / Treatment / Therapy Plan | 29 (~15.3k LOC) | P0 Risiko Tinggi + Kompleksitas Tinggi | Batch 17 Complete | Area FE ini tetap perlu cleanup per step. Batch 15 mengambil slice kecil `CreateSessionModal`: aturan eligibility paket ACTIVE/utang BASIC/BOOSTER dan batas dua sesi utang diekstrak ke helper pure. Batch 17 mengekstrak helper presentasi Step 2 therapy plan, memperbaiki selector smoke E2E filter session yang ambigu, dan menutupnya dengan unit/lint/type-check/E2E session hijau. |
| BE Inventory / Stock / Shipments | 19 (~7.6k LOC) | P0 Risiko Tinggi | Batch 10 Complete | Stok dan shipment berdampak operasional/financial. Batch 10 mengambil slice kecil pada `stock-request-approval.service.ts`: helper pure invoice draft dan approval plan diekstrak, lalu ditutup unit test contract untuk mode FREE/DEBT/NORMAL dan invalid invoice item. |
| FE Inventory / Stock / Shipments | 38 (~13.9k LOC) | P0 Risiko Tinggi + Kompleksitas Tinggi | Batch 9 Complete | Banyak modal dan page stock request/shipment. Batch 9 mengambil slice kecil stock request list/page shell: helper presentasi aksi row dan format tanggal diekstrak. Targeted lint pass dengan warning existing `no-explicit-any`, `type-check:web` pass, dan E2E stock request flow `10 passed` di port 3000 dengan `E2E_START_WEB_SERVER=false`. |
| BE Auth / Middleware / Security | 14 (~2.0k LOC) | P0 Risiko Tinggi | Batch 8 Complete | Security/auth/branch access. Debug `console.log` di `authenticate.ts` dan `assertBranchAccess.ts` sudah dibersihkan, branch helper dipusatkan, dan coverage branch-access middleware ditambahkan. Backend type-check passed setelah query akses shipment receipt di `files.service.ts` tidak lagi memakai generated Prisma field yang stale. |
| FE Auth / Layout / Impersonation | 22 (~3.4k LOC) | P1 Shared Access Control | Batch 7 Partial | Role presentation untuk header/sidebar dipusatkan di `rolePresentation`, duplikasi label/warna role dihapus, dan smoke E2E layout navigation ditambahkan. Sidebar menu config dan impersonation masih backlog karena lebih sensitif. |
| BE Users / Staff / Admin / Impersonation | 33 (~13.9k LOC) | P1 Kompleksitas Tinggi | Backlog | Banyak integration test admin/impersonation sudah ada. File panjang: `users.service.ts` ~1011 LOC, `admin.controller.ts` ~1003 LOC. Banyak logging debug. Cleanup dapat dimulai dari service boundaries yang sudah tertutup test. |
| FE Branches / Staff / Admin | 87 (~27.9k LOC) | P1 Kompleksitas Tinggi | Backlog | Modul FE terbesar. Banyak page/admin/branch/staff/modal. File panjang: branch detail page ~974 LOC, master-products page ~1134 LOC, beberapa CSS >900 LOC. Perlu pecah per halaman: branches list, branch detail, admin managers, master products. |
| BE Branches | 5 (~1.8k LOC) | P1 Kompleksitas Tinggi | Batch 19 Complete | File sedikit tapi `branches.service.ts` ~1190 LOC, termasuk create defaults, inventory auto-add, force delete. Batch 19 membersihkan debug `console.*` di controller/service branch dan menggantinya dengan logger untuk warning/error yang masih perlu, tanpa mengubah query/delete/force-delete flow. |
| Prisma Schema / Migrations / Seeds | 74 (~9.7k LOC) | P1 Data Model | Backlog | `schema.prisma` ~1567 LOC. Banyak seed variants dan migration history panjang, termasuk beberapa migration bernama mirip/duplikat. Cleanup sebaiknya mulai dari dokumentasi seed dan konsolidasi seed yang aman. |
| BE Referrals / Non Therapy / Files / Dashboard / Audit | 20 (~4.8k LOC) | P1 Shared + Audit | Batch 20 Partial | Banyak submodul tanpa test backend. Batch 20 mengambil slice kecil referrals controller: debug `console.*` diganti logger dan contract test list referrals ditambahkan. `role-dashboard.service.ts`, `files.service.ts`, dashboard, non-therapy, dan audit controller masih backlog terpisah. |
| BE Core Utils / Config | 16 (~2.6k LOC) | P1 Shared Foundation | Batch 18 Complete | Shared utils/config/lib dipakai lintas modul. Batch 18 mengambil slice kecil `auditLog`: helper audit sekarang retry dengan payload legacy saat generated Prisma client belum mengenal kolom audit trail baru, test audit lama dirapikan menjadi contract test yang sesuai behavior sekarang, dan warning runtime `Unknown argument userName` tidak lagi memblokir audit log. |
| FE Shared UI / Lib / Types | 71 (~12.0k LOC) | P1 Shared Foundation | Batch 21 Partial | Batch 21 menambah primitive `ui/Modal` dan wrapper `PackageActionModal` yang dipakai ulang oleh modal edit/cancel/refund paket. Audit masih menemukan `36` file memakai `createPortal` langsung dan sekitar `753` elemen `<button>`, sementara `ui/Button.tsx` belum memiliki consumer; konsolidasi harus dilanjutkan per cluster agar behavior UI tetap aman. |
| FE Reports / Dashboard / Notifications / Chat | 26 (~4.7k LOC) | P2 Quick Win / Supporting | Batch 6 Complete | Submodul Notifications, Reports, Dashboard, dan Chat selesai. Notifications: row/card/empty state diekstrak, utility label/date/severity dipusatkan, CSS placeholder mati dihapus. Reports: page orchestration dirapikan, dropdown/export/results/dialog diekstrak, utility report dipusatkan, page object E2E dirapikan. Dashboard: date range/helper/card/loading/error state dipusatkan dan smoke E2E role ditambahkan. Chat: placeholder dirapikan, CSS module mati dihapus, smoke E2E route/sidebar ditambahkan. |
| FE Referrals / Incentives | 5 (~2.2k LOC) | P2 Quick Win | Batch 2 Complete | Modal create referral sudah diekstrak, formatting/export utility dipusatkan, fetch list/branch dipisah, alert diganti toast, type referrer dirapikan, dan smoke E2E referral ditambahkan. |
| E2E Test Harness | 27 (~5.8k LOC) | P2 Test Infrastructure | Batch 1 Complete | Page objects dan flow specs sudah ada. Batch 1 merapikan helper auth/waiters/navigation serta selector convention tanpa mengubah kode aplikasi. |

## Batch History

| Batch | Modul | Status | Perubahan | Verifikasi |
|-------|-------|--------|-----------|------------|
| 1 | E2E Test Harness | Complete | Menambahkan `helpers/selectors.ts` sebagai sumber selector/regex umum; merapikan auth headers, waiters, navigation helper, dan page object search/table/modal conventions. | `type-check:web` passed; auth smoke `15 passed`; member CRUD `17 passed`. |
| 2 | FE Referrals / Incentives | Complete | Ekstraksi `CreateReferralModal`, tambah `referralUtils`, rapikan export blob/filename, pisahkan efek fetch referrals vs branches, gunakan router navigation dan toast error, tambah `ReferralPage` page object serta smoke spec referral. Playwright config diberi `E2E_BROWSER_CHANNEL` agar browser cache Chromium bisa dipilih eksplisit. | `type-check:web` passed; referral smoke `9 passed`. |
| 3 | FE Notifications | Complete | Ekstraksi `ManagerNotificationRow`, `NotificationSummaryCard`, `NotificationsEmptyState`, dan `managerNotificationPresentation`; hapus CSS module notifikasi yang sudah tidak dipakai; header badge memakai formatter shared; E2E notifications dipindah ke page object. | `type-check:web` passed; notifications E2E `17 passed`, `4 skipped`. |
| 4 | FE Reports | Complete | Ekstraksi `ReportDropdown`, `ReportExportMenu`, `ReportResults`, `ReportAccessDenied`, `ReportScheduleDialog`, `ReportEmailDialog`, dan `reportPresentation`; `reports/page.tsx` menjadi orchestration state/event; `ReportPage` E2E page object dirapikan dan wait statis dihapus. | `type-check:web` passed; reports E2E `34 passed`. |
| 5 | FE Dashboard Supporting Cleanup | Complete | Menambahkan `dashboardPresentation`, `DashboardStatCard`, `DashboardDateRangeFilter`, `DashboardLoadingState`, dan `DashboardErrorState`; dashboard cabang/manager memakai helper date range shared; dashboard layanan/dokter/perawat memakai card/loading/error shared; `catch any` di dashboard role diganti error handler typed; smoke E2E dashboard role ditambahkan. | `type-check:web` passed; dashboard E2E `14 passed`. |
| 6 | FE Chat / Supporting Placeholder | Complete | Placeholder `/chat` diganti ke Tailwind/lucide yang bersih, CSS module lama dihapus, dan page object + smoke E2E chat ditambahkan untuk route langsung serta link sidebar. | `type-check:web` passed; chat E2E `9 passed`. |
| 7 | FE Auth / Layout / Sidebar | Complete | Menambahkan `rolePresentation` untuk label/warna role shared, menghubungkan `Header` dan `Sidebar` ke helper tersebut, menghapus duplikasi role display lokal, dan menambahkan smoke E2E layout navigation per role. | `type-check:web` passed; auth + layout E2E `18 passed`. |
| 8 | BE Auth / Middleware / Security | Complete | Mengganti debug `console.*` auth/branch-access dengan logger, memusatkan helper assigned branch di `authenticate`, mengekstrak helper accessible branches di `assertBranchAccess`, memperbaiki test auth async + Prisma mock, menambah test branch-access middleware, dan memperbaiki blocker `files.service.ts` pada akses shipment receipt. | Middleware tests `24 passed`; `type-check:api` passed. |
| 9 | FE Inventory: Stock Requests Small Slice | Complete | Ekstrak `stockRequestPresentation` untuk keputusan aksi row stock request dan format tanggal; page list memakai helper tersebut, dan import mati `Loader2` dihapus. Tidak menyentuh API, modal review, atau workflow approval/payment. | Targeted lint passed dengan warning existing `no-explicit-any`; `type-check:web` passed; inventory E2E stock request flow `10 passed` di port 3000 dengan `E2E_START_WEB_SERVER=false`. |
| 10 | BE Inventory: Stock Request Approval Small Slice | Complete | Ekstrak `stock-request-approval.helpers.ts` untuk validasi/snapshot item invoice dan rencana approval invoice FREE/DEBT/NORMAL; `createInvoice` memakai helper tersebut tanpa mengubah transaksi, shipment, audit, atau payment flow lain. | Helper unit tests `5 passed`; `type-check:api` passed. |
| 11 | FE Payments / Invoices Small Slice | Complete | Ekstrak `paymentPresentation.ts` dari `/payments/page.tsx` untuk tipe local harness, constants, format currency, total/sisa invoice, product matching, filter invoice, parsing form item, validasi item, dan status payment. Tidak mengubah API, storage key, modal flow, atau E2E page object. | Helper unit tests `5 passed`; targeted lint passed; `type-check:web` passed; payment E2E `30 passed` di port 3000 dengan `E2E_START_WEB_SERVER=false`. |
| 12 | BE Packages / Billing / Invoices Small Slice | Complete | Ekstrak `invoice-generation.helpers.ts` untuk `allocateInvoiceItems` dan `cloneInvoiceItemsForAllocation`; `invoice-generation.service.ts` memakai helper tersebut pada invoice termin explicit, open installment payment, dan next installment invoice. Tidak mengubah Prisma transaction, invoice status, payment verification, atau assignment flow. | Helper unit tests `5 passed`; `type-check:api` passed. |
| 13 | FE Members Small Slice | Complete | Ekstrak `memberStatusPresentation.ts` untuk total voucher aktif BASIC/BOOSTER dari paket standalone, grouped arrays, dan fallback singular; `MemberStatusCards` memakai satu helper tanpa mengubah render atau data source. | Helper unit tests `4 passed`; targeted lint passed; `type-check:web` passed; member CRUD/detail/assignment E2E non-delete `16 passed` memakai system Chrome. |
| 14 | BE Members Small Slice | Complete | Ekstrak `member-registration.helpers.ts` untuk parsing tanggal lahir dan resolusi identitas NIK/PASSPORT/KITAS/VIP/SPECIAL/FOREIGN_AUTO/NO_NIK; registration service memakai helper tanpa mengubah transaksi atau response. | Helper + controller tests `13 passed`; `type-check:api` passed. Targeted ESLint unavailable karena config API tidak ditemukan. |
| 15 | FE Sessions / Therapy Plan Small Slice | Complete | Ekstrak `sessionPackageEligibility.ts` untuk status paket utang, sisa kuota utang, eligibility BASIC, dan usability BASIC/BOOSTER; `CreateSessionModal` memakai helper dan import mati dihapus. | Helper unit tests `5 passed`; targeted lint tanpa error dengan warning existing; `type-check:web` passed; session E2E `16 passed`, `16 skipped`. |
| 16 | BE Sessions / Treatment Small Slice | Complete | Ekstrak `session-creation.helpers.ts` untuk validasi paket BASIC, mode ACTIVE/DEBT, sisa sesi, dan allowance dua sesi utang; `session-creation.service.ts` tetap menangani query dan transaksi. | Helper + existing green session tests `15 passed`; `type-check:api` passed. Satu suite existing tetap gagal saat load karena Jest/ESM `nanoid`. |
| 17 | FE Sessions Step 2 / Therapy Plan Small Slice | Complete | Ekstrak `step2TherapyPlanPresentation.ts` untuk role editor, mapping plan ke table, sorting set plan, fallback list, dan subtitle therapy plan; `Step2TherapyPlan` memakai helper tanpa mengubah fetch, save, atau modal flow. Selector smoke E2E filter session dibuat spesifik ke label agar tidak bentrok dengan header tabel `Status`. | Helper unit tests `5 passed`; targeted lint passed; `type-check:web` passed; session E2E di port 3000/API 4000 `16 passed`, `16 skipped`. |
| 18 | BE Core Utils / Audit Log Compatibility Small Slice | Complete | Tambah fallback `auditLog` untuk retry create dengan field legacy saat Prisma client/generated schema stale terhadap kolom audit trail baru; test audit lama diringkas menjadi contract test enrichment, request impersonation, sanitasi, non-blocking error, dan fallback legacy. | Audit utility tests `5 passed`; `type-check:api` passed. |
| 19 | BE Branches Debug Logging Small Slice | Complete | Hapus debug `console.*` dari `branches.controller.ts` dan `branches.service.ts`; warning side-effect branch creation dan create-branch error memakai logger. Tidak mengubah validasi, query visibility manager, create defaults, inventory auto-add, delete, atau force-delete behavior. | Branch delete service tests `2 passed`; `type-check:api` passed. |
| 20 | BE Referrals Controller Logging Small Slice | Complete | Ganti debug `console.*` pada `referrals.controller.ts` list endpoint ke logger; tambah unit test controller untuk user context dan error forwarding. Tidak mengubah service, export, schema, atau response shape. | Referrals controller tests `2 passed`; `type-check:api` passed. |
| 21 | FE Shared UI Modal Reuse Small Slice | Complete | Tambah primitive `ui/Modal` dan wrapper style `PackageActionModal`; modal edit, cancel, dan refund paket memakai shell reusable untuk portal, scroll lock, backdrop, dialog semantics, header, close icon, body, dan footer. | Modal unit tests `3 passed`; targeted lint tanpa error dengan satu warning image existing; `type-check:web` passed. |

## Next Execution Plan

| Batch | Modul | Prioritas | Status | Target Lengkap | Verifikasi Wajib |
|-------|-------|-----------|--------|----------------|------------------|
| 1 | E2E Test Harness | P2 | Complete | Helper auth/waiters/selector/page object convention stabil sebagai fondasi cleanup. | Done: `type-check:web`, auth smoke, member CRUD. |
| 2 | FE Referrals / Incentives | P2 | Complete | Pecah modal create referral, utility referral, smoke E2E referral. | Done: `type-check:web`, referral smoke. |
| 3 | FE Notifications | P2 | Complete | Pecah row/card/empty state, utility notifikasi, hapus CSS mati, page object E2E. | Done: `type-check:web`, notifications E2E. |
| 4 | FE Reports | P2 | Complete | Audit reports page/API/E2E, rapikan `ReportPage` page object, ekstrak helper/component kecil, hapus dead code/CSS bila ada, jangan ubah behavior export. | Done: `type-check:web`, reports E2E `34 passed`. |
| 5 | FE Dashboard Supporting Cleanup | P2 | Complete | Rapikan dashboard cards/widgets/helper display untuk admin manager/cabang/super admin tanpa mengubah data source. | Done: `type-check:web`, dashboard E2E `14 passed`. |
| 6 | FE Chat / Supporting Placeholder | P2 | Complete | Jika masih placeholder, hapus/rapikan CSS mati dan page sederhana; jika sudah ada fitur aktif, audit dulu sebelum refactor. | Done: `type-check:web`, chat E2E `9 passed`. |
| 7 | FE Auth / Layout / Sidebar | P1 | Complete | Rapikan role navigation, sidebar badge, header/layout shared. Sensitif karena akses role, jadi lakukan setelah P2 stabil. | Done: `type-check:web`, auth + layout E2E `18 passed`. |
| 8 | BE Auth / Middleware / Security | P0 | Complete | Bersihkan logging debug, audit error shape, branch-access boundary. Tidak boleh ubah behavior auth tanpa test. | Done: middleware tests `24 passed`; `type-check:api` passed. |
| 9 | FE Inventory: Stock Requests Small Slice | P0 | Complete | Masuk P0 pertama dari frontend. Ambil slice kecil list/page shell, bukan seluruh inventory sekaligus. | Done: targeted lint, `type-check:web`, inventory E2E stock request flow `10 passed` di port 3000. |
| 10 | BE Inventory: Stock Request Approval Small Slice | P0 | Complete | Pecah service approval secara kecil, tambah/rapikan contract test sebelum refactor logic. | Done: helper unit tests `5 passed`; `type-check:api` passed. |
| 11 | FE Payments / Invoices Small Slice | P0 | Complete | Rapikan payment/invoice UI yang punya E2E, mulai dari helper/page object/export states. | Done: helper unit tests `5 passed`; targeted lint; `type-check:web`; payment E2E `30 passed`. |
| 12 | BE Packages / Billing / Invoices Small Slice | P0 | Complete | Rapikan service invoice/package assignment dengan test kontrak. | Done: helper unit tests `5 passed`; `type-check:api` passed. |
| 13 | FE Members Small Slice | P0 | Complete | Ekstrak kalkulasi voucher aktif BASIC/BOOSTER dari `MemberStatusCards` ke helper pure, tanpa menyentuh workflow package/member lain. | Done: helper unit tests `4 passed`; targeted lint; `type-check:web`; member CRUD/detail/assignment E2E non-delete `16 passed`. |
| 14 | BE Members Small Slice | P0 | Complete | Ekstrak normalisasi tanggal lahir dan nomor identitas registration ke helper typed dengan contract test. | Done: helper + controller tests `13 passed`; `type-check:api`. |
| 15 | FE Sessions / Therapy Plan Small Slice | P0 | Complete | Ekstrak aturan eligibility paket sesi dan batas dua sesi utang dari `CreateSessionModal` ke helper pure. | Done: helper unit tests `5 passed`; targeted lint; `type-check:web`; session E2E `16 passed`, `16 skipped`. |
| 16 | BE Sessions / Treatment Small Slice | P0 | Complete | Ekstrak validasi paket utama dan allowance utang dari session creation ke helper pure. | Done: helper + existing green session tests `15 passed`; `type-check:api`. |
| 17 | FE Sessions Step 2 / Therapy Plan Small Slice | P0 | Complete | Ambil helper presentasi/selection pure dari `Step2TherapyPlan`, bukan seluruh wizard. | Done: helper unit tests `5 passed`, targeted lint, `type-check:web`, session E2E `16 passed`, `16 skipped` di port 3000/API 4000. |
| 18 | BE Core Utils / Audit Log Compatibility Small Slice | P1 | Complete | Jaga audit utility tetap kompatibel dengan Prisma client lama/baru tanpa mengubah pemanggil domain. | Done: audit utility tests `5 passed`; `type-check:api`. |
| 19 | BE Branches Debug Logging Small Slice | P1 | Complete | Bersihkan debug logging branch tanpa menyentuh transaksi/delete flow. | Done: branch delete service tests `2 passed`; `type-check:api`. |
| 20 | BE Referrals Controller Logging Small Slice | P1 | Complete | Bersihkan debug logging referrals controller dan tambah contract test kecil. | Done: referrals controller tests `2 passed`; `type-check:api`. |
| 21 | FE Shared UI Modal Reuse Small Slice | P1 | Complete | Konsolidasikan satu cluster modal package action ke primitive modal reusable tanpa mengubah form/API. | Done: modal unit tests `3 passed`; targeted lint; `type-check:web`. |
| 22 | FE Shared Button Adoption Small Slice | P1 | Next | Audit `ui/Button.tsx` yang belum dipakai, lalu adopsi atau hapus pada satu cluster tombol yang konsisten. | Targeted unit/lint + `type-check:web` + smoke relevan. |

## Batch 4 Detailed Plan

Status: Complete.

1. Discovery
   - Scan `apps/web/src/app/(staff)/reports`.
   - Scan `apps/web/e2e/flows/reports.spec.ts`.
   - Scan `apps/web/e2e/pages/ReportPage.ts`.
   - Catat helper inline, file panjang, selector rapuh, dan dead code/CSS.

2. Refactor Scope
   - Rapikan hanya FE Reports.
   - Ekstrak formatter/helper/component kecil jika mengurangi kompleksitas nyata.
   - Rapikan page object reports bila selector atau flow masih terlalu rapuh.
   - Tidak mengubah behavior generate/export report.
   - Tidak menyentuh backend kecuali discovery menunjukkan blocker yang jelas.

3. Verification
   - Done: `npm.cmd run type-check:web` passed.
   - Done: `npm.cmd run e2e:web -- --project=chromium --reporter=line --workers=1 flows/reports.spec.ts` => `34 passed`.
   - Hasil dicatat di Batch History.

4. Completion Criteria
   - Done: file report lebih kecil/lebih jelas dan E2E reports lebih stabil.
   - Done: test wajib selesai dan hasilnya dicatat.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 4 `Complete`.

## Batch 5 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan dashboard staff: `apps/web/src/app/(staff)/dashboard`.
   - Done: scan dashboard role khusus: super admin, admin manager, admin cabang, admin layanan, doctor, nurse.
   - Done: scan komponen dashboard terkait seperti `RecentTransactions`.
   - Done: dashboard belum punya smoke E2E khusus, jadi ditambahkan coverage ringan per role.

2. Refactor Scope
   - Done: rapikan hanya FE Dashboard supporting area.
   - Done: ekstrak card/widget/helper display kecil untuk duplikasi nyata.
   - Done: data source/API dashboard tidak diubah.
   - Done: tidak menyentuh modul P0 seperti payment/member/inventory logic.

3. Verification
   - Done: `npm.cmd run type-check:web` passed.
   - Done: `npm.cmd run e2e:web -- --project=chromium --reporter=line --workers=1 flows/dashboard.spec.ts` => `14 passed`.
   - Done: E2E mengikuti pola page object Batch 1-4 melalui `DashboardPage`.

4. Completion Criteria
   - Done: dashboard page lebih jelas dan komponen widget reusable bertambah.
   - Done: test wajib selesai dan hasilnya dicatat.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 5 `Complete`.

## Batch 6 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan FE chat/supporting route dan komponen terkait.
   - Done: chat masih placeholder di `/chat` dengan CSS module khusus.
   - Done: belum ada E2E/smoke untuk halaman chat/supporting, sehingga ditambahkan.

2. Refactor Scope
   - Done: placeholder chat dirapikan menjadi page sederhana berbasis Tailwind/lucide.
   - Done: CSS module chat lama dihapus.
   - Done: tidak mengubah behavior pesan/API karena belum ada fitur chat aktif.
   - Done: tidak menyentuh auth/sidebar global, hanya menambahkan smoke untuk link sidebar yang sudah ada.

3. Verification
   - Done: `npm.cmd run type-check:web` passed.
   - Done: `npm.cmd run e2e:web -- --project=chromium --reporter=line --workers=1 flows/chat.spec.ts` => `9 passed`.

4. Completion Criteria
   - Done: status chat/supporting jelas sebagai placeholder cleaned.
   - Done: CSS module placeholder lama dihapus.
   - Done: test wajib selesai dan hasilnya dicatat.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 6 `Complete`.

## Batch 7 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan `Header`, `Sidebar`, staff layout, middleware route guard, auth store, dan E2E auth/logout/navigation coverage.
   - Done: ditemukan duplikasi label/warna role di `Header` dan `Sidebar`.
   - Done: sidebar menu config masih besar dan sensitif, jadi tidak dipindahkan pada batch ini.

2. Refactor Scope
   - Done: tambah `apps/web/src/lib/rolePresentation.ts`.
   - Done: `Header` dan `Sidebar` memakai helper role label/color shared.
   - Done: duplikasi role presentation lokal dihapus.
   - Done: tidak mengubah route guard, auth state, logout flow, atau daftar menu sidebar.

3. Verification
   - Done: `npm.cmd run type-check:web` passed.
   - Done: `npm.cmd run e2e:web -- --project=chromium --reporter=line --workers=1 auth/login.smoke.spec.ts flows/layout-navigation.spec.ts` => `18 passed`.

4. Completion Criteria
   - Done: role presentation shared dipakai oleh layout utama.
   - Done: smoke auth dan navigation/access per role lulus.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 7 `Complete`.

## Batch 8 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan backend auth, middleware, rate limiter, branch-access guard, dan test yang tersedia.
   - Done: ditemukan debug `console.log/error/time` paling banyak di `authenticate.ts` dan `assertBranchAccess.ts`.
   - Done: baseline `authenticate.test.ts` gagal karena middleware async tidak di-`await` dan Prisma branch lookup tidak dimock.

2. Refactor Scope
   - Done: bersihkan logging debug di `authenticate.ts` dan `assertBranchAccess.ts`.
   - Done: gunakan `logger.warn/debug/error` untuk kejadian auth/branch-access yang masih perlu dicatat.
   - Done: pusatkan helper assigned branch di `authenticate`.
   - Done: ekstrak helper accessible branches di `assertBranchAccess`.
   - Done: tidak mengubah JWT/session semantics, role bypass, response code, atau pesan error.

3. Verification
   - Done: `npm.cmd test --prefix apps/api -- --runInBand src/middleware/__tests__/authenticate.test.ts src/middleware/__tests__/assertBranchAccess.test.ts` => `24 passed`.
   - Done: `npm.cmd run type-check --prefix apps/api` passed setelah follow-up fix di `files.service.ts`.
   - Done: `authenticate.test.ts` diperbaiki untuk `await` middleware async dan mock Prisma branch lookup.
   - Done: `assertBranchAccess.test.ts` ditambahkan untuk global bypass, registration branch, staff branch assignment, granted branch access, denied access, not found, dan DB error.

4. Completion Criteria
   - Done: auth/middleware lebih bersih tanpa perubahan akses yang disengaja.
   - Done: test backend relevan lulus.
   - Done: type-check backend lulus.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 8 `Complete`.

## Batch 9 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan stock request page, components, hooks, API client, dan E2E inventory.
   - Done: dipilih slice kecil di list/page shell agar tidak menyentuh modal review/payment besar.

2. Refactor Scope
   - Done: tambah `stockRequestPresentation.ts` untuk `isStockRequestManager`, format tanggal, dan keputusan aksi row.
   - Done: `stock-requests/page.tsx` memakai helper tersebut untuk edit/review/upload state.
   - Done: hapus import mati `Loader2`.
   - Tidak mengubah API call, status workflow, modal review, modal payment, atau approval logic.

3. Verification
   - Done: `npm.cmd run lint --prefix apps/web -- --file 'src/app/(staff)/inventory/stock-requests/page.tsx' --file 'src/app/(staff)/inventory/stock-requests/stockRequestPresentation.ts'` passed dengan warning existing `no-explicit-any` di page.
   - Done: `npm.cmd run type-check --prefix apps/web` passed setelah dependency Playwright tersedia.
   - Done: `E2E_START_WEB_SERVER=false npm.cmd run e2e --prefix apps/web -- --project=chromium --reporter=line --workers=1 critical/inventory-flow.spec.ts -g "Inventory - Stock Request Flow"` memakai web server user di port 3000 dan API lokal di port 4000: `10 passed`.
   - Notes: setelah user restart web server, verifikasi final berjalan di port 3000. Port 3001 tidak digunakan untuk verifikasi lanjutan.

4. Completion Criteria
   - Done: cleanup slice code selesai, lint targeted pass, `type-check:web` pass, dan E2E stock request flow pass.
   - Done: progress ditutup sebagai Batch 9 Complete; lanjutan masuk Batch 10.

## Batch 10 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan service inventory backend, terutama `stock-request-approval.service.ts`, controller/service stock request, schema Prisma invoice/shipment, dan test backend yang tersedia.
   - Done: ditemukan belum ada test inventory lokal; service approval masih besar dan `// @ts-nocheck`, jadi slice dipilih dari logic pure di `createInvoice`.

2. Refactor Scope
   - Done: tambah `stock-request-approval.helpers.ts`.
   - Done: ekstrak `buildStockRequestInvoiceDraft` untuk validasi item invoice terhadap item request, snapshot SKU/nama/deskripsi, dan subtotal.
   - Done: ekstrak `getStockRequestInvoiceApprovalPlan` untuk status invoice/request, payment verification status, paid/remaining amount, notes, audit payment mode, dan response message pada mode FREE/DEBT/NORMAL.
   - Done: `createInvoice` memakai helper tersebut.
   - Tidak mengubah transaksi Prisma, audit log, shipment creation, upload/confirm/reject payment flow, atau endpoint/controller.

3. Verification
   - Done: `npm.cmd test --prefix apps/api -- --runInBand src/modules/inventory/services/__tests__/stock-request-approval.helpers.test.ts` => `5 passed`.
   - Done: `npm.cmd run type-check --prefix apps/api` passed.

4. Completion Criteria
   - Done: approval invoice logic punya contract test kecil sebelum split lanjutan.
   - Done: backend type-check lulus.
   - Done: progress ditutup sebagai Batch 10 Complete; lanjutan masuk Batch 11.

## Batch 11 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan payment/invoice FE files, `payment-flow.spec.ts`, `PaymentPage` page object, invoice API/types, dan `/payments/page.tsx`.
   - Done: ditemukan `/payments` adalah local E2E harness berbasis browser storage; slice dipilih pada logic pure presentasi/kalkulasi agar tidak menyentuh transaksi backend.

2. Refactor Scope
   - Done: tambah `paymentPresentation.ts` di folder `/payments`.
   - Done: pindahkan tipe local invoice/payment, constants storage/filter/product seed, `formatCurrency`, `calculateTotal`, `remainingAmount`, `matchingProducts`, `filterInvoices`, `parseInvoiceItemForms`, `hasInvalidInvoiceItem`, dan `getPaymentStatus`.
   - Done: `/payments/page.tsx` memakai helper tersebut untuk filtering, invoice creation parsing/validation, product suggestions, dan status setelah payment.
   - Tidak mengubah storage key, initial invoice data, modal flow, role access, E2E page object, API client, atau backend payment/invoice logic.

3. Verification
   - Done: `npm.cmd test --prefix apps/web -- --runInBand --runTestsByPath "src/app/(staff)/payments/paymentPresentation.test.ts"` => `5 passed`.
   - Done: `npm.cmd run lint --prefix apps/web -- --file 'src/app/(staff)/payments/page.tsx' --file 'src/app/(staff)/payments/paymentPresentation.ts' --file 'src/app/(staff)/payments/paymentPresentation.test.ts'` passed.
   - Done: `npm.cmd run type-check --prefix apps/web` passed.
   - Done: `E2E_START_WEB_SERVER=false npm.cmd run e2e --prefix apps/web -- --project=chromium --reporter=line --workers=1 flows/payment-flow.spec.ts` memakai web server user di port 3000 dan API lokal sementara di port 4000: `30 passed`.
   - Notes: port 3001 tidak digunakan. API log masih menunjukkan warning audit schema existing (`userName` tidak dikenal), tetapi E2E tetap pass.

4. Completion Criteria
   - Done: payment page logic pure punya unit test kecil.
   - Done: lint targeted, type-check web, dan payment E2E lulus.
   - Done: progress ditutup sebagai Batch 11 Complete; lanjutan masuk Batch 12.

## Batch 12 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan backend packages/invoices files, `invoice-generation.service.ts`, `package-assignment.service.ts`, `payment-verification.service.ts`, dan test backend yang tersedia.
   - Done: belum ada test lokal untuk package billing; slice dipilih dari helper pure allocation di invoice generation agar contract bisa ditutup tanpa menyentuh database flow.

2. Refactor Scope
   - Done: tambah `invoice-generation.helpers.ts`.
   - Done: ekstrak `allocateInvoiceItems` untuk membagi nominal termin/installment ke item invoice, termasuk fallback source total kosong dan rounding remainder ke item terakhir.
   - Done: ekstrak `cloneInvoiceItemsForAllocation` untuk menormalisasi invoice item menjadi input numeric.
   - Done: `invoice-generation.service.ts` memakai helper tersebut untuk explicit installment invoice, open installment paid invoice item allocation, dan next installment invoice.
   - Tidak mengubah Prisma transaction, invoice status, payment verification, assignment flow, invoice numbering, atau payment recording.

3. Verification
   - Done: `npm.cmd test --prefix apps/api -- --runInBand src/modules/packages/services/__tests__/invoice-generation.helpers.test.ts` => `5 passed`.
   - Done: `npm.cmd run type-check --prefix apps/api` passed.

4. Completion Criteria
   - Done: package invoice allocation punya contract test kecil.
   - Done: backend type-check lulus.
   - Done: progress ditutup sebagai Batch 12 Complete; lanjutan masuk Batch 13.

## Batch 13 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan page list/detail member, komponen header/edit/documents/status cards, tipe package, dan E2E member CRUD.
   - Done: dipilih slice kalkulasi voucher di `MemberStatusCards` karena pure, terduplikasi, dan tidak menyentuh API atau mutasi data.

2. Refactor Scope
   - Done: tambah `memberStatusPresentation.ts` dengan `getMemberVoucherTotals`.
   - Done: pertahankan contract paket standalone, grouped arrays, fallback singular, dan hanya hitung status `ACTIVE`.
   - Done: `MemberStatusCards` memakai helper untuk nilai voucher BASIC dan BOOSTER.
   - Tidak mengubah API, load member/package, package assignment, edit/delete member, documents, atau render status card lain.

3. Verification
   - Done: `npm.cmd test --prefix apps/web -- --runInBand --runTestsByPath "src/components/members/memberStatusPresentation.test.ts"` => `4 passed`.
   - Done: targeted lint untuk component/helper/test passed tanpa warning.
   - Done: `npm.cmd run type-check:web` passed.
   - Done: member E2E dengan system Chrome dan video sementara dimatikan karena cache FFmpeg tidak tersedia => `16 passed` (`7` setup + `9` test member CRUD/detail/assignment).
   - Skipped: test `should delete a member` dikecualikan karena menghapus data melalui browser dan slice ini tidak menyentuh delete flow. Acceptable untuk Batch 13; test tetap tersedia untuk regression run penuh.

4. Completion Criteria
   - Done: kalkulasi voucher member punya contract test kecil dan tidak lagi terduplikasi di komponen.
   - Done: lint targeted, type-check web, dan E2E member relevan lulus.
   - Done: progress ditutup sebagai Batch 13 Complete; lanjutan masuk Batch 14.

## Batch 14 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan service, controller, routes, schema, dan test BE Members.
   - Done: baseline `members.create.controller.test.ts` lulus `2 passed`.
   - Done: dipilih slice normalisasi registration karena pure dan terisolasi dari transaksi Prisma.

2. Refactor Scope
   - Done: tambah `member-registration.helpers.ts` dengan tipe identitas, `parseMemberBirthDate`, dan `resolveMemberIdentityNumber`.
   - Done: tutup contract NIK 16 digit, PASSPORT/KITAS manual, identitas otomatis VIP/SPECIAL/FOREIGN_AUTO/NO_NIK, fallback type, serta rentang tahun tanggal lahir.
   - Done: `member-registration.service.ts` memakai helper typed dan private method lama dihapus.
   - Tidak mengubah Prisma transaction, duplicate lookup, generation member number, upload dokumen, audit, atau response shape.

3. Verification
   - Done: helper + existing controller tests => `13 passed`.
   - Done: `npm.cmd run type-check:api` passed.
   - Targeted ESLint tidak dapat dijalankan karena ESLint tidak menemukan configuration file untuk `apps/api`; tidak diperluas menjadi cleanup lint harness pada batch P0 ini.

4. Completion Criteria
   - Done: normalisasi input registrasi kritikal keluar dari service `@ts-nocheck` dan memiliki contract test typed.
   - Done: test backend relevan dan type-check API lulus.
   - Done: progress ditutup sebagai Batch 14 Complete; lanjutan masuk Batch 15.

## Batch 15 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan sessions list/detail, wizard session, komponen therapy plan, dan E2E `session-therapy.spec.ts`.
   - Done: dipilih aturan eligibility paket di `CreateSessionModal` karena pure dan terisolasi dari submit/API flow.

2. Refactor Scope
   - Done: tambah `sessionPackageEligibility.ts` untuk status utang, sisa kuota dua sesi, eligibility BASIC, dan usability BASIC/BOOSTER.
   - Done: `CreateSessionModal` memakai helper tersebut dan import mati `TherapyPlanDoseTable` dihapus.
   - Tidak mengubah API call, flatten package response, pemilihan therapy plan, validasi stok, assignment staff, atau submit session.

3. Verification
   - Done: helper unit tests => `5 passed`.
   - Done: targeted lint passed tanpa error; warning hook dependency, `no-explicit-any`, dan unescaped entities existing tetap dicatat untuk cleanup terpisah.
   - Done: `npm.cmd run type-check:web` passed.
   - Done: `flows/session-therapy.spec.ts` dengan system Chrome => `16 passed`, `16 skipped`.
   - Skipped E2E berasal dari `test.fixme` existing untuk create/detail/staff/vitals/diagnosis/therapy-plan/follow-up yang belum punya workflow atau seed deterministik; acceptable untuk slice helper eligibility ini, tetapi tetap backlog coverage fitur.

4. Completion Criteria
   - Done: aturan eligibility paket sesi kritikal memiliki contract test dan tidak lagi inline di modal besar.
   - Done: lint targeted, type-check web, dan smoke sessions relevan lulus.
   - Done: progress ditutup sebagai Batch 15 Complete; lanjutan masuk Batch 16.

## Batch 16 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan session creation/retrieval, schema, controller, dan empat suite test sessions existing.
   - Baseline: tiga suite lulus `6 passed`; `therapy-plan-session.service.test.ts` gagal sebelum test karena Jest tidak mentransform dependency ESM `nanoid` dari `codeGenerator.ts`.
   - Done: dipilih validasi paket utama di session creation karena pure dan paralel dengan aturan eligibility FE Batch 15.

2. Refactor Scope
   - Done: tambah `session-creation.helpers.ts` untuk `getSessionPackageAvailability`, `getDebtSessionAllowance`, status debt, dan constants dua sesi utang.
   - Done: pertahankan urutan contract error `INVALID_PACKAGE_TYPE`, `PACKAGE_SESSIONS_EXHAUSTED`, `PACKAGE_NOT_ACTIVE`, dan `PACKAGE_DEBT_LIMIT_REACHED`.
   - Done: `session-creation.service.ts` memakai helper; query outstanding debt tetap dijalankan hanya untuk mode DEBT.
   - Tidak mengubah branch/member access, Prisma transaction, session numbering, therapy plan selection, stock validation, atau audit.

3. Verification
   - Done: helper tests dan tiga suite sessions yang baseline-nya hijau => `15 passed`.
   - Done: `npm.cmd run type-check:api` passed.
   - Existing blocker: `therapy-plan-session.service.test.ts` tetap gagal saat suite load karena incompatibility Jest CommonJS dengan ESM `nanoid`; bukan regresi Batch 16 dan perlu batch test-harness terpisah.

4. Completion Criteria
   - Done: validasi paket session creation kritikal keluar dari service `@ts-nocheck` dan memiliki contract test typed.
   - Done: test backend relevan yang runnable dan type-check API lulus.
   - Done: progress ditutup sebagai Batch 16 Complete; lanjutan masuk Batch 17.

## Batch 17 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan `Step2TherapyPlan`, tipe therapy plan, pola table, dan E2E sessions.
   - Done: dipilih slice presentasi/selection murni agar tidak menyentuh fetch, save, modal, atau wizard flow.
   - Ditemukan bahwa session E2E sensitif terhadap server/auth state, sehingga verifikasi akhir dijalankan ulang di port 3000 dengan API 4000 aktif.

2. Refactor Scope
   - Done: tambah `step2TherapyPlanPresentation.ts` untuk role editor, mapping plan ke table, sorting set plan, fallback table list, dan subtitle therapy plan.
   - Done: `Step2TherapyPlan` memakai helper baru untuk `canEdit`, sort set plan, fallback single plan, list table, dan subtitle.
   - Done: selector E2E filter session dibuat spesifik ke label `Status` agar tidak ambigu dengan header tabel.
   - Tidak mengubah API call, submit/save plan, tab therapy plan, modal behavior, atau data source.

3. Verification
   - Done: `npm.cmd test --prefix apps/web -- --runInBand --runTestsByPath src/components/sessions/step2TherapyPlanPresentation.test.ts` => `5 passed`.
   - Done: targeted lint untuk `Step2TherapyPlan.tsx`, helper, dan test => passed.
   - Done: `npm.cmd run type-check --prefix apps/web` passed.
   - Done: `flows/session-therapy.spec.ts` dengan system Chrome di port 3000/API 4000 => `16 passed`, `16 skipped`.
   - Catatan: port 3001 tidak dipakai. Beberapa percobaan awal gagal karena server/API state belum siap dan selector `Status` ambigu, lalu ditutup dengan rerun hijau.

4. Completion Criteria
   - Done: helper presentasi Step 2 keluar dari komponen besar dan punya unit test.
   - Done: E2E session smoke hijau di port 3000/API 4000.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 17 `Complete`.

## Batch 18 Detailed Plan

Status: Complete.

1. Discovery
   - Done: saat E2E session, API menulis warning audit runtime `Unknown argument userName` dari `auditLog.ts`.
   - Done: scan `auditLog.ts`, `schema.prisma`, migration audit trail, audit controller, dan test audit existing.
   - Ditemukan schema sudah punya kolom audit trail baru, tetapi generated Prisma client/runtime bisa stale sehingga `create` gagal sebelum log audit tersimpan.

2. Refactor Scope
   - Done: tambah adapter internal `createAuditLog` yang mencoba payload audit lengkap terlebih dahulu.
   - Done: jika Prisma menolak field audit trail baru (`userName`, `userRole`, `branchName`, `module`, `entity*`, `description`, `beforeData`, `afterData`, `changedFields`, `metadata`), helper retry dengan shape legacy.
   - Done: detail audit lengkap tetap disimpan di `meta` pada fallback legacy.
   - Tidak mengubah pemanggil domain, route audit, enum action, atau schema/migration.

3. Verification
   - Done: `npm.cmd test --prefix apps/api -- --runInBand src/utils/__tests__/auditLog.test.ts` => `5 passed`.
   - Done: `npm.cmd run type-check --prefix apps/api` passed.

4. Completion Criteria
   - Done: audit log tetap non-blocking dan kompatibel dengan Prisma client lama/baru.
   - Done: test audit sesuai kontrak behavior sekarang dan tidak lagi gagal karena mock lama.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 18 `Complete`.

## Batch 19 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan `branches.controller.ts`, `branches.service.ts`, logger shared, dan test branches existing.
   - Ditemukan banyak debug `console.log` di controller/service branch, termasuk create branch, list stats, default pricing, inventory auto-add, dan force delete.
   - Dipilih slice observability kecil karena BE Branches sensitif dan punya flow delete/force-delete besar.

2. Refactor Scope
   - Done: hapus debug `console.*` dari modul branches.
   - Done: `createBranch` error di controller memakai `logger.error`.
   - Done: side-effect gagal saat default pricing / inventory auto-add memakai `logger.warn`, tetap non-blocking seperti behavior lama.
   - Tidak mengubah schema, query visibility, create branch, pricing creation, inventory auto-add, delete, force-delete, atau audit behavior.

3. Verification
   - Done: `npm.cmd test --prefix apps/api -- --runInBand src/modules/branches/__tests__/branches.delete.service.test.ts` => `2 passed`.
   - Done: `npm.cmd run type-check --prefix apps/api` passed.
   - Done: `rg -n "console\\." apps\\api\\src\\modules\\branches` tidak menemukan sisa console.

4. Completion Criteria
   - Done: branches module tidak lagi mengeluarkan debug console langsung.
   - Done: test backend relevan dan type-check API lulus.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 19 `Complete`.

## Batch 20 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan BE referrals module dan ditemukan debug `console.log/error` di `referrals.controller.ts`.
   - Done: belum ada test backend referrals controller, sehingga ditambahkan contract test kecil untuk endpoint list.

2. Refactor Scope
   - Done: debug user context pada `listReferrals` memakai `logger.debug`.
   - Done: error path `listReferrals` memakai `logger.error` lalu tetap meneruskan error ke `next`.
   - Tidak mengubah referrals service, schema, export Excel/PDF, incentive calculation, atau response shape.

3. Verification
   - Done: `rg -n "console\\." apps\\api\\src\\modules\\referrals` tidak menemukan sisa console.
   - Done: `npm.cmd test --prefix apps/api -- --runInBand src/modules/referrals/__tests__/referrals.controller.test.ts` => `2 passed`.
   - Done: `npm.cmd run type-check --prefix apps/api` passed.

4. Completion Criteria
   - Done: referrals controller tidak lagi memakai console langsung.
   - Done: contract test kecil menutup user context dan error forwarding.
   - Done: `.codex/cleanup-progress.md` diupdate dengan Batch 20 `Complete`.

## Batch 21 Detailed Plan

Status: Complete.

1. Discovery
   - Done: scan primitive `components/ui`, seluruh file modal/dialog, pemakaian `createPortal`, dan tombol JSX frontend.
   - Ditemukan `36` file masih memakai `createPortal` langsung dan sekitar `753` elemen `<button>`.
   - Ditemukan `ui/Button.tsx` belum dipakai oleh consumer frontend, sehingga standardisasi tombol belum benar-benar berjalan.
   - Dipilih cluster modal edit/cancel/refund paket karena ketiganya memakai CSS dan shell identik.

2. Refactor Scope
   - Done: tambah `ui/Modal.tsx` untuk portal, mounted guard, body scroll lock, backdrop close, Escape close, ARIA dialog, header, close icon, body, dan footer.
   - Done: tambah `PackageActionModal.tsx` untuk mapping CSS package action sekali.
   - Done: `PackageEditModal`, `PackageCancelModal`, dan `PackageRefundModal` memakai shell reusable.
   - Tidak mengubah field form, validasi submit, image compression, callback/API, atau visual CSS package action.

3. Verification
   - Done: `Modal.test.tsx` => `3 passed`.
   - Done: targeted lint passed tanpa error; warning existing `<img>` preview refund tetap dicatat.
   - Done: `npm.cmd run type-check:web` passed.

4. Completion Criteria
   - Done: satu cluster modal tidak lagi menggandakan portal/backdrop/header/body/footer shell.
   - Partial repo-wide: modal dan button redundancy lain tetap backlog dan harus dikerjakan per cluster.
   - Done: progress ditutup sebagai Batch 21 Complete; lanjutan masuk Batch 22.

## Discovery Notes

- Scan dilakukan dengan `rg --files` untuk `apps/web/src`, `apps/web/e2e`, `apps/api/src`, dan `apps/api/prisma`.
- LOC dihitung kasar dari line count file text. Asset binary yang terbaca sebagai teks oleh shell dapat membuat angka minor tidak presisi, tetapi cukup untuk prioritas discovery.
- Indikasi awal paling mencolok: beberapa page/modal >1000 LOC, backend service besar di branch/inventory/users/dashboard, dan banyak folder backend kritikal tanpa test lokal di folder modul.
- Cleanup berikutnya harus batch per modul/submodul, satu patch terverifikasi sebelum lanjut.
