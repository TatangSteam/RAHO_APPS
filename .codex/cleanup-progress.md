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
- Lanjutan masih ada. Batch berikutnya yang direkomendasikan adalah Batch 8: BE Auth / Middleware / Security.

Priority guide:
- P0 Risiko Tinggi: data pasien/member, billing/payment/invoice, terapi/sesi, stok, auth/security.
- P1 Kompleksitas Tinggi/Shared: modul besar, lintas role/branch, schema/migration, shared service.
- P2 Quick Win/Validasi Pendekatan: modul kecil atau workflow pendukung untuk membuktikan pola cleanup.

| Modul | Jumlah File | Prioritas | Status | Catatan Awal |
|-------|------------|-----------|--------|--------------|
| BE Members / Patient Records | 20 (~7.1k LOC) | P0 Risiko Tinggi | Backlog | Data pasien/member. File panjang: `me.service.ts` ~1004 LOC, `members.controller.ts` ~645 LOC, `member-registration.service.ts` besar. Test backend terlihat minim: 1 test module. Cleanup harus batch kecil: retrieval, registration, documents, lab, therapy plan. |
| FE Members / Patient Records | 67 (~21.4k LOC) | P0 Risiko Tinggi | Backlog | UI member paling besar dan menyentuh pasien, package, dokumen, lab, therapy plan. File panjang: detail member page ~882 LOC, member new page ~536 LOC, `MemberTherapyPlansTab.tsx` ~936 LOC, `BulkTherapyPlanModal.tsx` ~873 LOC, `PackageCard.tsx` ~846 LOC, `ExportMembersModal.tsx` ~792 LOC. Ada E2E member, tapi cleanup harus per subfitur. |
| BE Packages / Billing / Invoices | 22 (~5.2k LOC) | P0 Risiko Tinggi | Backlog | Menyentuh invoice, assignment paket, refund, cancel, payment verification. Tidak terlihat test backend di folder ini. File panjang: `invoice-generation.service.ts` ~690 LOC, `package-assignment.service.ts` besar. Perlu contract test sebelum refactor. |
| FE Packages / Billing / Invoices / Payments | 19 (~5.1k LOC) | P0 Risiko Tinggi | Backlog | Payment page ~833 LOC, invoice rendering/CSS besar. Ada E2E payment flow, namun UI package/payment tersebar antara member components, invoice components, dan API clients. |
| BE Sessions / Treatment / Diagnosis | 26 (~5.9k LOC) | P0 Risiko Tinggi | Backlog | Menyentuh terapi klinis dan diagnosis. Ada beberapa test backend. File panjang: `session-creation.service.ts` ~706 LOC, session retrieval/service besar. Banyak endpoint controller dengan `catch (err: any)` berulang. |
| FE Sessions / Treatment / Therapy Plan | 29 (~15.3k LOC) | P0 Risiko Tinggi + Kompleksitas Tinggi | Backlog | Salah satu area FE paling kompleks. File panjang: sessions page ~1630 LOC, `CreateSessionModal.tsx` ~1462 LOC, sessions CSS ~1478 LOC, `Step5Infusion.tsx` ~1129 LOC. Cleanup perlu dipotong per step wizard. |
| BE Inventory / Stock / Shipments | 19 (~7.6k LOC) | P0 Risiko Tinggi | Backlog | Stok dan shipment berdampak operasional/financial. Tidak terlihat test backend di folder inventory. File panjang: `stock-request-approval.service.ts` ~1256 LOC, inventory controller/service besar. Perlu test sebelum split approval/shipment. |
| FE Inventory / Stock / Shipments | 38 (~13.9k LOC) | P0 Risiko Tinggi + Kompleksitas Tinggi | Backlog | Banyak modal dan page stock request/shipment. File panjang: stock request review modal ~1160 LOC, stock request page/CSS >1000 LOC, inventory page ~855 LOC, shipments page ~806 LOC. Ada E2E inventory, tapi perlu batch per workflow. |
| BE Auth / Middleware / Security | 14 (~2.0k LOC) | P0 Risiko Tinggi | Backlog | Security/auth/branch access. Ada test JWT/middleware, tapi banyak `console.log` di `authenticate.ts` dan `assertBranchAccess.ts`. Cleanup kecil tapi sensitif: logging, error shape, branch-access boundaries. |
| FE Auth / Layout / Impersonation | 22 (~3.4k LOC) | P1 Shared Access Control | Batch 7 Partial | Role presentation untuk header/sidebar dipusatkan di `rolePresentation`, duplikasi label/warna role dihapus, dan smoke E2E layout navigation ditambahkan. Sidebar menu config dan impersonation masih backlog karena lebih sensitif. |
| BE Users / Staff / Admin / Impersonation | 33 (~13.9k LOC) | P1 Kompleksitas Tinggi | Backlog | Banyak integration test admin/impersonation sudah ada. File panjang: `users.service.ts` ~1011 LOC, `admin.controller.ts` ~1003 LOC. Banyak logging debug. Cleanup dapat dimulai dari service boundaries yang sudah tertutup test. |
| FE Branches / Staff / Admin | 87 (~27.9k LOC) | P1 Kompleksitas Tinggi | Backlog | Modul FE terbesar. Banyak page/admin/branch/staff/modal. File panjang: branch detail page ~974 LOC, master-products page ~1134 LOC, beberapa CSS >900 LOC. Perlu pecah per halaman: branches list, branch detail, admin managers, master products. |
| BE Branches | 5 (~1.8k LOC) | P1 Kompleksitas Tinggi | Backlog | File sedikit tapi `branches.service.ts` ~1190 LOC, termasuk create defaults, inventory auto-add, force delete. Ada 1 test delete. Risiko tinggi untuk delete/branch data, cleanup harus ekstra kecil. |
| Prisma Schema / Migrations / Seeds | 74 (~9.7k LOC) | P1 Data Model | Backlog | `schema.prisma` ~1567 LOC. Banyak seed variants dan migration history panjang, termasuk beberapa migration bernama mirip/duplikat. Cleanup sebaiknya mulai dari dokumentasi seed dan konsolidasi seed yang aman. |
| BE Referrals / Non Therapy / Files / Dashboard / Audit | 20 (~4.8k LOC) | P1 Shared + Audit | Backlog | Banyak submodul tanpa test backend. `role-dashboard.service.ts` ~1032 LOC, `files.service.ts` ~582 LOC. Audit penting untuk ERP klinik; cleanup audit harus menjaga contract log resmi. |
| BE Core Utils / Config | 16 (~2.6k LOC) | P1 Shared Foundation | Backlog | Shared utils/config/lib dipakai lintas modul. Ada `auditLog.test.ts` besar dan util audit memakai beberapa `as any`. Cleanup jangan dulu sebelum modul pengguna jelas. |
| FE Shared UI / Lib / Types | 71 (~12.0k LOC) | P1 Shared Foundation | Backlog | Banyak API client, UI primitive, types, CSS global. Indikasi: API clients/domain lib tersebar, beberapa `any` di types/API, file API panjang (`inventoryApi.ts`, `icdApi.ts`). Cleanup shared dilakukan setelah pola dari 1-2 modul domain terbukti. |
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
| 8 | BE Auth / Middleware / Security | P0 | Next | Bersihkan logging debug, audit error shape, branch-access boundary. Tidak boleh ubah behavior auth tanpa test. | Backend type-check/test auth/middleware. |
| 9 | FE Inventory: Stock Requests Small Slice | P0 | Planned | Masuk P0 pertama dari frontend. Ambil slice kecil, misalnya list/review modal shell, bukan seluruh inventory sekaligus. | `type-check:web` + inventory E2E slice. |
| 10 | BE Inventory: Stock Request Approval Small Slice | P0 | Planned | Pecah service approval secara kecil, tambah/rapikan contract test sebelum refactor logic. | Backend test + API smoke terkait inventory. |
| 11 | FE Payments / Invoices Small Slice | P0 | Planned | Rapikan payment/invoice UI yang punya E2E, mulai dari helper/page object/export states. | `type-check:web` + payment E2E. |
| 12 | BE Packages / Billing / Invoices Small Slice | P0 | Planned | Rapikan service invoice/package assignment dengan test kontrak. | Backend test billing/package. |
| 13 | FE Members Small Slice | P0 | Planned | Ambil subfitur kecil member, misalnya header/edit modal atau documents tab, bukan detail page penuh. | `type-check:web` + member CRUD/detail smoke. |
| 14 | BE Members Small Slice | P0 | Planned | Rapikan retrieval/registration/documents secara bertahap dengan test. | Backend member tests/API smoke. |
| 15 | FE Sessions / Therapy Plan Small Slice | P0 | Planned | Ambil satu step wizard/komponen terapi, jangan seluruh sessions page. | `type-check:web` + session therapy E2E slice. |

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

Status: Next, belum dikerjakan.

1. Discovery
   - Scan backend auth, middleware, rate limiter, branch-access guard, dan test yang tersedia.
   - Cari logging debug yang keluar di production/test output.
   - Cari error shape yang tidak konsisten di auth/middleware.

2. Refactor Scope
   - Bersihkan logging debug hanya bila aman dan tidak mengubah behavior.
   - Rapikan helper kecil untuk auth/middleware bila ada duplikasi nyata.
   - Jangan ubah JWT/session semantics, branch access policy, atau role authorization tanpa test eksplisit.

3. Verification
   - Jalankan backend type-check.
   - Jalankan test backend auth/middleware yang tersedia.
   - Jika test auth/middleware belum cukup, tambahkan test kecil sebelum refactor behavior-sensitive.

4. Completion Criteria
   - Auth/middleware lebih bersih tanpa perubahan akses.
   - Test backend relevan lulus atau gap dicatat dengan alasan konkret.
   - `.codex/cleanup-progress.md` diupdate dengan Batch 8 `Complete`, `Partial`, atau `Blocked`.

## Discovery Notes

- Scan dilakukan dengan `rg --files` untuk `apps/web/src`, `apps/web/e2e`, `apps/api/src`, dan `apps/api/prisma`.
- LOC dihitung kasar dari line count file text. Asset binary yang terbaca sebagai teks oleh shell dapat membuat angka minor tidak presisi, tetapi cukup untuk prioritas discovery.
- Indikasi awal paling mencolok: beberapa page/modal >1000 LOC, backend service besar di branch/inventory/users/dashboard, dan banyak folder backend kritikal tanpa test lokal di folder modul.
- Cleanup berikutnya harus batch per modul/submodul, satu patch terverifikasi sebelum lanjut.
