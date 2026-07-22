# UAT Sign-Off MVP ERP RAHO

**Release candidate:** `[isi commit SHA/tag setelah release candidate dibekukan]`

**Environment:** Database dan object-storage rehearsal lokal

**Tanggal technical acceptance:** 22 Juli 2026 (Asia/Jakarta)
**Status dokumen:** TECHNICAL PASS / BUSINESS SIGN-OFF PENDING

## Acceptance Evidence

| AC | Skenario | Automated evidence | Technical status | Business signer |
|---|---|---|---|---|
| AC-001 | Pembayaran paket membentuk kas dan deferred, bukan omzet | Payment posting PostgreSQL integration + revenue contract | PASS | Finance |
| AC-002 | Treatment atomik: omzet, stok, HPP, jurnal | Logistics-to-treatment E2E + duplicate completion + cancellation | PASS | Finance + Operations |
| AC-003 | PO sampai pembayaran supplier kredit | Purchasing PostgreSQL integration + retry concurrency | PASS | Finance + Logistics |
| AC-004 | Transfer internal menjaga total nilai aset | Internal transfer concurrency + FIFO transfer value | PASS | Logistics |
| AC-005 | Role sejajar dan horizontal branch isolation | Permission, branch scope, anti-self-escalation, DB-backed impersonation context, nested frontend restore | PASS | Product Owner |
| AC-006 | Retry/concurrency tidak membuat posting ganda | Payment, AP, shipment, receipt, treatment, FIFO contention | PASS | Product Owner |

## Operational Acceptance

- [x] Migration dari database kosong berhasil untuk seluruh 78 migration.
- [x] Quantity, bucket, FIFO layer, mutation chain, dan valuation control tersedia pada go-live audit.
- [x] Backup dan restore database tervalidasi pada target disposable.
- [x] Backup dan restore object storage tervalidasi pada bucket disposable.
- [ ] Go-live audit pada snapshot data UAT final berstatus `READY`.
- [ ] Trial Balance, opening balance, kas/bank, dan inventory valuation ditandatangani pemilik data.
- [ ] Permission matrix diuji oleh perwakilan setiap role pada environment UAT.
- [ ] Tidak ada defect Severity 1/2 terbuka pada saat keputusan go/no-go.
- [ ] Runbook, monitoring, rollback, RPO, dan RTO diterima Incident Commander.

## Signatures

| Peran | Nama | Keputusan | Tanggal/Waktu | Tanda tangan / approval link |
|---|---|---|---|---|
| Product Owner |  | PENDING |  |  |
| Finance Approver |  | PENDING |  |  |
| Logistics Approver |  | PENDING |  |  |
| UAT Coordinator |  | PENDING |  |  |
| Incident Commander |  | PENDING |  |  |

Dokumen tidak boleh diubah menjadi `SIGNED` hanya berdasarkan test otomatis.
Persetujuan wajib diberikan langsung oleh pemilik bisnis pada tabel di atas.
