# Sprint 11 Evidence Status

Tanggal eksekusi teknis: 22 Juli 2026 (Asia/Jakarta).

| Gate | Evidence | Status |
|---|---|---|
| AC-001-006 contract suite | `npm --prefix apps/api run test:go-live:contracts` - 10 suite, 39 test | PASS |
| PostgreSQL integration/concurrency | `npm --prefix apps/api run test:go-live:database` - 6 suite, 7 test | PASS |
| API regression | `npm --prefix apps/api run test:regression` - 70 suite/417 test aktif lulus; 11 suite/19 test DB skip dan dijalankan oleh gate PostgreSQL terpisah | PASS |
| Web regression | `npm --prefix apps/web test -- --runInBand` - 15 suite, 103 test | PASS |
| Full logistics-to-treatment E2E | Shipment retry, receipt retry, FIFO consumption, atomic completion, cancellation reversal | PASS |
| Role/impersonation regression | Context role dibaca ulang dari DB; token/store/cookie frontend sinkron; nested stop kembali satu level | PASS |
| Migration rehearsal | Database disposable `raho_sprint11_rehearsal`, 78 migration dari nol | PASS |
| Inventory reconciliation controls | `INV-001` sampai `INV-005`: mirror, bucket, layer, mutation chain, valuation vs akun 1300/1310 | PASS (AUTOMATED CONTROL) |
| Database backup/restore | Dump 611,820 byte; SHA-256 `d8d6ecf5eddd8f7456687962f1578db40bab26542e479f75d3d70a5f93fa267e`; 78 migration; row count identik | PASS |
| Object storage backup/restore | 268 object; 72,281,920 byte; manifest SHA-256 `02cb1ecc2bb2fe394d4b77a98a1e83e03d9555f326e049ff095f710c0ee76411`; SHA-256 setiap object hasil restore identik | PASS |
| API/web type-check dan build | `npm run type-check:all`, `npm run build:api`, `npm run build:web` | PASS |
| UAT business sign-off | `docs/UAT_SIGN_OFF_MVP.md` | PENDING BUSINESS SIGN-OFF |

Evidence dump, manifest, dan restore report disimpan di `backups/sprint11/` dan
tidak masuk Git karena dapat memuat data sensitif. Technical PASS tidak mengganti
persetujuan Product Owner, Finance Approver, dan Logistics Approver.

## P0 Integration Coverage

| P0 domain | Integrated evidence | Status |
|---|---|---|
| IAM, role, permission, branch scope, audit | DB-backed authorization, role-template gate, horizontal-access tests, nested impersonation regression | TECHNICAL PASS |
| Accounting, period, opening, cash/bank | Balanced-journal audit, period security contract, opening maker-checker controls, payment posting integration | TECHNICAL PASS |
| Package billing dan deferred revenue | AC-001 payment posting dan revenue contract | TECHNICAL PASS |
| Product/UOM, inventory, FIFO, valuation | Inventory contract/concurrency suites dan `INV-001` sampai `INV-005` | TECHNICAL PASS |
| Request, reservation, shipment, receiving | Logistics-to-treatment E2E, duplicate dispatch/receipt, transfer valuation | TECHNICAL PASS |
| Purchasing dan AP | AC-003 PostgreSQL integration, serializable retry, supplier payment idempotency | TECHNICAL PASS |
| BOM, treatment usage, revenue, HPP | AC-002 atomic completion, FIFO consumption, duplicate protection, cancellation reversal | TECHNICAL PASS |
| Adjustment, opname, discrepancy, homecare | Mutation/journal controls dan regression suite inventory | TECHNICAL PASS |
| Finance dan logistics reporting | Ledger-backed reporting modules tercakup type-check, build, dan regression | TECHNICAL PASS |
| Business acceptance seluruh P0 | Snapshot UAT final, role walkthrough, data-owner reconciliation, dan signatures | PENDING BUSINESS SIGN-OFF |
