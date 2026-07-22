# Development Update Plan ERP Finance & Logistik RAHO

**Versi:** 1.0  
**Tanggal rencana:** 21 Juli 2026  
**Tim:** 2 Full-Stack Developer  
**Durasi target MVP:** 24 minggu (12 sprint, masing-masing 2 minggu)  
**Stack saat ini:** Next.js 14, React, TypeScript, Express, Prisma, PostgreSQL, MinIO, Jest, dan Playwright  
**Acuan:** SRS ERP Finance dan Logistik RAHO versi 1.0

> Dokumen ini adalah rencana upgrade aplikasi yang sudah berjalan, bukan rencana membangun ulang dari nol. Estimasi harus dikalibrasi kembali setelah audit kode dan data pada Sprint 0.

---

## 1. Tujuan

Menyelesaikan MVP ERP Finance dan Logistik RAHO dengan dua jalur kerja paralel yang tetap terintegrasi:

1. transaksi finance dan accounting tercatat dengan double-entry;
2. stok memakai batch dan FIFO cost layer yang dapat diaudit;
3. uang masuk dipisahkan dari pengakuan omzet;
4. treatment selesai menghasilkan omzet, HPP, jurnal, dan pengurangan stok secara atomik;
5. purchasing terhubung ke persediaan dan utang supplier;
6. transfer, homecare bag, opname, adjustment, dan discrepancy memiliki dokumen sumber;
7. seluruh akses sensitif memakai permission, branch scope, maker-checker, dan audit log;
8. acceptance criteria AC-001 sampai AC-006 lulus.

## 2. Kondisi Awal Repository

Hasil inventarisasi awal menunjukkan fitur berikut sudah tersedia sebagian dan perlu diaudit sebelum digunakan sebagai fondasi:

- authentication, user, branch, dan role dasar;
- invoice dan payment;
- inventory item, mutation, stock request, shipment, serta discrepancy;
- treatment session dan material usage;
- homecare team, bag, request, shipment, usage, return, dan opname;
- audit log, file/evidence, notification, serta dashboard;
- unit test backend dan E2E Playwright.

Gap utama terhadap SRS:

- permission granular dan branch scope yang konsisten di server;
- Chart of Accounts, journal engine, accounting period, dan opening balance;
- kas/bank, expense, AR/AP, supplier, serta purchasing;
- inventory batch, reservation, FIFO cost layer, dan stock valuation;
- deferred revenue dan revenue recognition;
- BOM treatment berversi;
- workflow/approval generik dan maker-checker;
- idempotency, concurrency control, reversal, serta immutable posted transaction;
- laporan finance dan inventory yang bersumber dari ledger.

Status setiap fitur lama wajib diklasifikasikan pada Sprint 0 sebagai `REUSE`, `REFACTOR`, `REPLACE`, atau `NEW`.

---

## 3. Pembagian Tanggung Jawab

Kedua developer bekerja secara **vertical slice**: database, API, UI, dan test untuk domain yang dimiliki. Dengan demikian tidak ada satu developer yang terus-menerus menunggu frontend atau backend dari developer lain.

| Area | Developer A — Finance & Platform | Developer B — Inventory & Operations |
|---|---|---|
| Kepemilikan utama | IAM/RBAC, organization, accounting, kas/bank, sales, invoice, payment, revenue recognition, expense, purchasing/AP, finance report | product/UOM, warehouse/location, inventory ledger, FIFO, request/reservation, shipment/receiving, discrepancy, adjustment, opname, BOM, treatment usage, homecare, logistics report |
| Tanggung jawab lintas domain | transaction/posting framework, idempotency framework, approval engine, period lock, audit contract | inventory transaction engine, stock locking, evidence integration, notification integration, E2E operational flow |
| UI utama | halaman administrasi, finance, purchasing, approval, finance dashboard | halaman master inventory, logistics, treatment material, homecare, logistics dashboard |
| Review wajib | Mereview PR Developer B yang berdampak pada jurnal/akun | Mereview PR Developer A yang berdampak pada quantity, batch, cost layer, atau lokasi stok |
| Backup ownership | API contract dan migration strategy | design system/state UI dan E2E test suite |

### Aturan file bersama

File bersama seperti `schema.prisma`, router utama, enum, navigation, dan shared type tidak boleh diubah bersamaan tanpa koordinasi.

1. Perubahan schema diajukan lebih dahulu sebagai proposal singkat berisi model, relasi, index, dan migration plan.
2. Satu developer menjadi **migration owner** per sprint; ownership bergantian A dan B.
3. Migration yang sudah masuk branch utama tidak boleh diedit. Koreksi memakai migration baru.
4. API contract disepakati sebelum UI dan API dikerjakan paralel.
5. Perubahan kontrak lintas domain harus direview oleh kedua developer.

---

## 4. Prinsip Implementasi Wajib

- Semua nominal dan quantity memakai `Decimal`, bukan floating point.
- Timestamp disimpan dalam UTC dan ditampilkan menggunakan zona waktu bisnis Asia/Jakarta.
- Authorization, branch scope, dan approval divalidasi di server, bukan hanya disembunyikan di UI.
- Transaksi posted bersifat immutable; koreksi menggunakan reversal/credit note.
- Posting stok, jurnal, pembayaran, dan completion treatment memakai satu database transaction bila berada dalam satu business event.
- Endpoint kritis memakai idempotency key dan unique constraint pendukung.
- Pengurangan stok memakai locking dan mencegah saldo negatif.
- Audit log operasional tidak dapat diubah atau dihapus melalui API umum.
- Evidence bersifat protected, memakai signed URL, dan mengikuti permission serta branch scope.
- List API konsisten untuk pagination, sorting, pencarian, rentang tanggal, cabang, dan status.

---

## 5. Roadmap MVP — 12 Sprint

### Sprint 0 — Audit, Baseline, dan Kontrak Arsitektur (Minggu 1–2)

| Developer A | Developer B | Output bersama |
|---|---|---|
| Audit auth, role, branch, invoice, payment, audit, serta struktur transaksi Prisma | Audit product, inventory, shipment, treatment, homecare, notification, dan E2E yang tersedia | Gap matrix seluruh P0; baseline test/build; ERD target; event-to-journal matrix; API convention; daftar fitur `REUSE/REFACTOR/REPLACE/NEW` |

**Gate:** belum boleh membuat migration besar sebelum ERD target, strategi data lama, dan daftar breaking change disetujui.

### Sprint 1 — IAM, Organization, dan Master Dasar (Minggu 3–4)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Permission granular, role template, user override, branch scope, anti-self-escalation, delegated admin permission | Branch type, warehouse, stock location, product, category, UOM, unit conversion, batch/expiry flags | Super Admin dan role sejajar bekerja; master data siap dipakai; semua aksi sensitif tercatat di audit log |

**Requirement utama:** FR-IAM-001–010, FR-ORG-002–006, FR-MST-001–008.  
**Migration owner:** Developer A.

### Sprint 2 — Accounting Foundation dan Inventory Ledger (Minggu 5–6)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Chart of Accounts, journal entry/line, balanced journal validation, accounting period, source-document link | inventory balance, batch, cost layer, stock mutation, quantity buckets, movement reason/reference | Kontrak posting bersama; ledger finance dan ledger stok memiliki traceability dan branch/cost-center context |

**Requirement utama:** FR-ACC-001–010, FR-INV-001–008.  
**Migration owner:** Developer B.

### Sprint 3 — Invoice, Payment, Kas/Bank, dan FIFO (Minggu 7–8)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Invoice snapshot, partial/full payment, verification, kas/bank, protected payment proof, duplicate prevention | FIFO allocation, valid-layer selection, stock locking, negative-stock prevention, consumption/reversal layer | Payment verification membentuk cash/bank ledger dan jurnal; FIFO lulus unit serta concurrency test |

**Requirement utama:** FR-SAL-001–008, 010–012; FR-CASH-001–002; FR-INV-003–010.  
**Migration owner:** Developer A.

### Sprint 4 — Opening Balance, Expense, Stock Request, dan Reservation (Minggu 9–10)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Opening balance untuk kas, bank, stok, AR, AP, deposit, deferred revenue; expense dan approval | Stock request; approve penuh/parsial/tolak; reservation dan release; available quantity | Opening stock menghasilkan cost layer; expense terbayar menghasilkan jurnal; reservation tidak mengubah nilai aset |

**Requirement utama:** FR-CASH-003–008, FR-STK-001–004, FR-INV-009–010.  
**Migration owner:** Developer B.

### Sprint 5 — Shipment, Receiving, dan Internal Transfer (Minggu 11–12)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Posting policy persediaan in-transit dan validasi jurnal transfer internal | Shipment idempotent, partial receiving, in-transit, evidence, discrepancy/quarantine | AC-004 dan AC-006 lulus; transfer internal tidak menghasilkan omzet/beban; total nilai inventory tetap |

**Requirement utama:** FR-STK-005–012, FR-ADJ-001–004.  
**Migration owner:** Developer A.

### Sprint 6 — Purchasing dan Accounts Payable Dasar (Minggu 13–14)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Supplier, Purchase Request approval, PO, supplier invoice, AP, due date, partial supplier payment | Goods Receipt partial, batch/expiry/condition/location, inventory layer dari harga pembelian | Goods Receipt dan supplier invoice mengikuti posting policy; AC-003 lulus dari PO sampai supplier payment |

**Requirement utama:** FR-PUR-001–008 dan FR-PUR-012.  
**Migration owner:** Developer B.

### Sprint 7 — Paket, Deferred Revenue, BOM, dan Material Usage (Minggu 15–16)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Member benefit valuation, deferred revenue, konfigurasi revenue per session, anti-double-recognition | Treatment BOM, rekomendasi material, actual usage, alasan deviasi, FIFO consumption | Kontrak event `TREATMENT_COMPLETED` siap; paket dibayar belum menjadi omzet; usage memiliki biaya aktual |

**Requirement utama:** FR-REV-001–008, FR-BOM-001 dan FR-BOM-004–007.  
**Migration owner:** Developer A.

### Sprint 8 — Atomic Treatment Completion dan Profitability (Minggu 17–18)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Revenue recognition, deferred revenue release, revenue/HPP journal, gross-profit projection | Atomic completion, material validation, FIFO deduction, cancellation release, duplicate completion protection | Dalam satu transaction: session complete + revenue + usage + stock mutation + FIFO layer + HPP + journal; AC-001 dan AC-002 lulus |

**Requirement utama:** FR-REV-001–009 dan FR-BOM-007.  
**Migration owner:** Developer B.

### Sprint 9 — Adjustment, Opname, Homecare, dan Approval (Minggu 19–20)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Approval rule berbasis nominal/branch/role/category/type, multi-step approver, maker-checker, approval audit | Adjustment/reason code, approval threshold, opname lock/snapshot, discrepancy resolution, finalisasi multi-bag homecare | Approval engine dipakai oleh expense, purchasing, request, dan adjustment; opname difference menghasilkan stock mutation dan journal |

**Requirement utama:** FR-WFL-001–005, FR-ADJ-001–010, FR-HOM-001–009.  
**Migration owner:** Developer A.

### Sprint 10 — Dashboard, Reporting, Notification, dan Evidence (Minggu 21–22)

| Developer A | Developer B | Integrasi/hasil |
|---|---|---|
| Finance dashboard, P&L, General Ledger, Trial Balance, cash/bank, deferred revenue, finance read-only scope | Logistics dashboard, stock card, valuation, usage, request/shipment/discrepancy/opname metrics | Filter tanggal/cabang konsisten; angka dashboard direkonsiliasi ke ledger; approval dan payment rejection notification aktif |

**Requirement utama:** FR-RPT-001–003, 006, 008; FR-NTF-001–002 dan 005–006.  
**Migration owner:** Developer B.

### Sprint 11 — Hardening, UAT, dan Go-Live (Minggu 23–24)

| Developer A | Developer B | Output bersama |
|---|---|---|
| Rekonsiliasi finance, period lock/reopen test, permission/security test, opening-data rehearsal | Concurrency/race test, FIFO/stock reconciliation, full E2E logistics/treatment, migration rehearsal | AC-001–006 lulus; regression lulus; backup/restore diuji; observability aktif; runbook, rollback plan, UAT sign-off, dan release candidate |

**Gate go-live:** tidak ada defect Severity 1/2; saldo pembukaan seimbang; stock valuation cocok dengan ledger; akses role tervalidasi; restore test berhasil.

---

## 6. Dependency dan Titik Sinkronisasi

```text
IAM + Branch + Master
        |
        +--> Accounting Foundation --> Payment/Purchasing/Revenue --> Finance Report
        |
        +--> Inventory Ledger --> FIFO/Reservation --> Shipment/BOM/Usage --> Stock Report
                                      |                    |
                                      +---- Treatment Completion ----+
                                                   |
                                             Revenue + HPP
```

Titik integrasi paling berisiko:

| Integrasi | Kontrak yang harus disepakati | Owner akhir |
|---|---|---|
| Payment → Cash/Bank → Journal | status yang boleh diposting, idempotency key, reversal | Developer A |
| Goods Receipt → Cost Layer | sumber unit cost, partial receipt, batch/expiry | Developer B |
| Supplier Invoice → AP | matching policy dan source reference | Developer A |
| Shipment → In-Transit → Receipt | status transition, value transfer, discrepancy | Developer B |
| Treatment → Revenue + FIFO + HPP | atomic transaction, retry behavior, unique recognition | Bersama; A menjaga finance, B menjaga stok |
| Opname/Adjustment → Journal | reason-to-account mapping dan approval threshold | Bersama |

---

## 7. Cara Kerja per Sprint

### Ritme dua minggu

| Hari | Aktivitas |
|---|---|
| Hari 1 | Planning, acceptance criteria, contract/API/schema review, pembagian ticket |
| Hari 2–7 | Implementasi vertical slice, unit/integration test, review harian |
| Hari 8 | Integrasi antardomain dan regression test |
| Hari 9 | QA internal, perbaikan, dokumentasi API dan operasional |
| Hari 10 | Demo, acceptance, retrospective, release ke staging |

### Aturan pull request

- Satu PR berisi satu perubahan logis dan idealnya dapat direview dalam kurang dari 60 menit.
- PR wajib mencantumkan requirement ID, skenario test, migration impact, permission, audit, dan screenshot UI bila relevan.
- Minimal satu approval dari developer lain sebelum merge.
- PR lintas ledger atau transaction boundary wajib dipair-review.
- Branch utama harus selalu lulus build, type-check, dan test.
- Feature flag dipakai untuk modul besar yang belum siap digunakan.

### Pembagian kapasitas

Per developer per sprint:

- 60% implementasi fitur;
- 20% automated test dan perbaikan defect;
- 10% code review/pairing;
- 10% dokumentasi, refinement, dan buffer.

Hindari mengisi 100% kapasitas dengan fitur karena domain finance dan inventory memiliki risiko koreksi serta migrasi data yang tinggi.

---

## 8. Definition of Ready

Sebuah ticket dapat masuk sprint jika:

- requirement ID dan tujuan bisnis jelas;
- acceptance criteria dapat diuji;
- owner dan reviewer ditentukan;
- desain data/API/UI tersedia secukupnya;
- dependency dan migration impact sudah diketahui;
- permission, branch scope, audit, jurnal, serta pengaruh stok sudah dijawab;
- data uji tersedia.

## 9. Definition of Done

Sebuah fitur dinyatakan selesai hanya jika:

- acceptance criteria dan requirement terkait terpenuhi;
- authorization serta branch scope diterapkan server-side;
- migration forward tersedia dan telah diuji pada salinan data;
- validasi input, error state, loading state, empty state, dan success state tersedia;
- audit log tersedia untuk aksi sensitif;
- unit, integration, dan E2E test relevan lulus;
- idempotency, concurrency, dan reversal diuji bila relevan;
- dokumentasi API dan runbook diperbarui;
- lint, type-check, build, dan test lulus;
- tidak ada transaksi posted yang dapat diedit atau dihapus langsung;
- Product Owner/UAT menerima hasil demo.

---

## 10. Quality Gate dan Target Test

| Level | Minimum yang wajib diuji |
|---|---|
| Unit | perhitungan invoice, decimal, FIFO allocation, journal balance, permission evaluator, state transition |
| Integration | payment posting, stock reservation, shipment/receipt, purchasing/AP, treatment completion, reversal, period lock |
| Concurrency | duplicate payment, double shipment (AC-006), double treatment completion, competing FIFO consumption |
| E2E | AC-001–006 serta happy path setiap role utama |
| Security | horizontal branch access, privilege escalation, evidence access, maker-checker, closed period |
| Data | migration rehearsal, opening balance reconciliation, inventory quantity/value reconciliation |

Target operasional MVP:

- seluruh test kritis lulus 100%;
- coverage business service kritis minimal 80%;
- P95 operasi non-report di bawah 2 detik pada skenario beban MVP;
- zero unresolved Severity 1 dan Severity 2 saat go-live;
- journal debit selalu sama dengan credit;
- tidak ada negative stock tanpa override resmi;
- retry request idempotent tidak membuat posting ganda.

---

## 11. Tracking Status

Gunakan status berikut pada backlog:

`BACKLOG` → `READY` → `IN_PROGRESS` → `IN_REVIEW` → `QA` → `UAT` → `DONE`  
Status tambahan: `BLOCKED` dan `DEFERRED`.

Kolom minimum setiap ticket:

| Kolom | Isi |
|---|---|
| ID | kode ticket dan requirement ID |
| Owner / Reviewer | Developer A/B |
| Scope | API, DB, UI, test, docs |
| Acceptance criteria | kondisi Given/When/Then |
| Dependency | ticket atau keputusan yang diperlukan |
| Risk | Low/Medium/High |
| Estimate | ideal day atau story point |
| Status | status workflow |
| Evidence | PR, test result, screenshot, atau demo link |

### Template update mingguan

```md
## Update Mingguan — [Tanggal]

### Ringkasan
- Status sprint: On Track / At Risk / Off Track
- Progress sprint: [selesai]/[komitmen] story point
- Keputusan penting: ...

### Developer A
- Selesai: ...
- Sedang dikerjakan: ...
- Berikutnya: ...
- Blocker/risiko: ...

### Developer B
- Selesai: ...
- Sedang dikerjakan: ...
- Berikutnya: ...
- Blocker/risiko: ...

### Integrasi dan Quality
- PR lintas domain: ...
- Test/build: ...
- Migration/data: ...
- Defect Sev-1/Sev-2/Sev-3: ...

### Bantuan/Keputusan yang Dibutuhkan
- [Owner keputusan] — [batas waktu] — [pertanyaan]
```

---

## 12. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Schema lama tidak sesuai ledger baru | Migrasi gagal atau histori tidak konsisten | Audit Sprint 0, mapping data, dry run, reconciliation query, backup dan rollback plan |
| Dua developer mengubah schema yang sama | Konflik migration dan keterlambatan | Migration owner bergantian dan schema proposal sebelum implementasi |
| Finance dan stok tidak atomik | Jurnal berbeda dengan persediaan | Shared posting service dan database transaction untuk satu business event |
| Race condition mengurangi stok dua kali | Saldo negatif dan HPP salah | Locking, unique constraint, idempotency record, concurrency test |
| Scope MVP melebar | Jadwal 24 minggu gagal | P0 menjadi gate; P1/P2 hanya dikerjakan setelah P0 dan AC stabil |
| Existing behavior rusak | Operasional saat ini terganggu | Characterization test, feature flag, backward-compatible endpoint, staged rollout |
| Knowledge silo | Salah satu developer menjadi bottleneck | Cross-review, pair session pada titik integrasi, runbook, pergantian migration owner |
| Data awal tidak seimbang | Laporan sejak go-live salah | Template opening balance, maker-checker, trial import, finance/stock sign-off |

---

## 13. Rencana Release Setelah MVP

Rencana ini baru dapat dikunci setelah hasil velocity MVP tersedia.

| Release | Estimasi awal | Fokus |
|---|---:|---|
| Release 2 | 8–12 minggu | installment lanjutan, refund lengkap, AR/AP aging, three-way matching, bank reconciliation, workflow builder UI, alert expiry/low stock, export report |
| Release 3 | 8–12 minggu | configurable dashboard, custom field, scheduled report, supplier scorecard, reorder recommendation, external API, consolidation, analytics lanjutan |

Release 2 dan 3 tidak boleh mengganggu stabilisasi ledger MVP. Item dapat dimajukan hanya bila dependency selesai, test kritis tetap hijau, dan Product Owner menyetujui pertukaran scope.

---

## 14. Checklist Go-Live MVP

- [x] AC-001 Pembayaran Paket lulus.
- [x] AC-002 Treatment Selesai lulus.
- [ ] AC-003 Pembelian Supplier Kredit lulus.
- [ ] AC-004 Transfer Internal lulus.
- [ ] AC-005 Role Sejajar lulus.
- [ ] AC-006 Double Processing lulus.
- [ ] Permission matrix dan branch scope ditandatangani owner bisnis.
- [ ] Opening balance debit sama dengan credit.
- [ ] Quantity dan nilai persediaan telah direkonsiliasi.
- [ ] Semua period, account mapping, dan document numbering terkonfigurasi.
- [ ] Migration produksi dan rollback telah direhearsal.
- [ ] Backup dan restore telah diuji.
- [ ] Monitoring, health check, structured log, dan alert aktif.
- [ ] Runbook insiden dan kontak eskalasi tersedia.
- [ ] User operasional telah mengikuti UAT/training.
- [ ] Tidak ada defect Severity 1/2 yang terbuka.

## 15. Keputusan yang Harus Dikonfirmasi pada Sprint 0

1. Tanggal target go-live dan apakah operasional lama harus berjalan paralel.
2. Sumber serta kualitas opening balance kas, bank, stok, AR, AP, deposit, dan deferred revenue.
3. Chart of Accounts dan posting policy yang disetujui finance.
4. Metode nilai benefit paket dan rule aktivasi paket.
5. Apakah Goods Receipt memakai GRNI atau langsung AP pada MVP.
6. Lokasi mana yang diizinkan memiliki negative stock override, jika ada.
7. Nominal approval dan maker-checker per transaksi.
8. Data historis yang harus dimigrasikan dibanding hanya membawa saldo awal.
9. Definisi partnership/franchise yang tetap termasuk MVP.
10. Product Owner, Finance Approver, Logistics Approver, dan UAT signer.

