# UAT Sign-Off MVP ERP RAHO

**Release candidate:** `[commit SHA / tag]`  
**Environment:** `[UAT URL]`  
**Tanggal pengujian:** `[Asia/Jakarta]`  
**Dataset:** `[snapshot/import ID dan checksum]`

## Acceptance evidence

| AC | Skenario | Automated contract | DB/E2E evidence | Business signer | Status |
|---|---|---|---|---|---|
| AC-001 | Pembayaran paket; kas dan deferred, bukan omzet | `[link]` | `[link]` | Finance | PENDING |
| AC-002 | Treatment atomic: omzet, stok, HPP, jurnal | `[link]` | `[link]` | Finance + Operations | PENDING |
| AC-003 | PO hingga pembayaran supplier kredit | `[link]` | `[link]` | Finance + Logistics | PENDING |
| AC-004 | Transfer internal menjaga total nilai aset | `[link]` | `[link]` | Logistics | PENDING |
| AC-005 | Role sejajar dan horizontal branch isolation | `[link]` | `[link]` | Product Owner | PENDING |
| AC-006 | Retry/concurrency tidak membuat posting ganda | `[link]` | `[link]` | Product Owner | PENDING |

## Operational acceptance

- [ ] Finance reconciliation berstatus `READY`.
- [ ] Opening debit sama dengan kredit.
- [ ] Quantity/value inventory cocok dengan ledger.
- [ ] Closed period menolak posting; reopen diaudit; LOCKED tidak dapat dibuka.
- [ ] Permission matrix dan branch scope diuji dengan positive/negative scenario.
- [ ] Protected evidence tidak dapat diakses lintas user/cabang.
- [ ] Backup database dan object storage tervalidasi.
- [ ] Restore ke target disposable berhasil dan audit setelah restore `READY`.
- [ ] Tidak ada defect Severity 1/2 terbuka.
- [ ] Runbook, monitoring, rollback, dan kontak eskalasi diterima.

## Signatures

| Peran | Nama | Keputusan | Tanggal/Waktu | Tanda tangan / approval link |
|---|---|---|---|---|
| Product Owner |  | PENDING |  |  |
| Finance Approver |  | PENDING |  |  |
| Logistics Approver |  | PENDING |  |  |
| UAT Coordinator |  | PENDING |  |  |
| Incident Commander |  | PENDING |  |  |

Dokumen tidak boleh diubah menjadi `SIGNED` hanya berdasarkan test otomatis.
Persetujuan wajib diberikan oleh pemilik bisnis yang tercantum di atas.
