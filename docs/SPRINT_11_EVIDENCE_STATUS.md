# Sprint 11 Evidence Status

| Gate | Evidence wajib | Status awal |
|---|---|---|
| AC-001–006 contract suite | 10 suites, 36 tests | PASS — 22 Juli 2026 |
| PostgreSQL integration/concurrency | Output `test:go-live:database` | BLOCKED — `localhost:5432` tidak aktif pada 22 Juli 2026 |
| Finance/opening/inventory reconciliation | JSON `go-live:audit` | BLOCKED — koneksi PostgreSQL gagal pada 22 Juli 2026 |
| API dan web build | API build, web build, API/web type-check | PASS — 22 Juli 2026 |
| Database backup/restore | Dump checksum, restore log, migration, post-restore audit | BLOCKED — PostgreSQL dan `pg_dump`/`pg_restore` tidak tersedia |
| Object storage backup/restore | Manifest dan `mc diff` | BLOCKED — MinIO client `mc` tidak tersedia |
| UAT | `UAT_SIGN_OFF_MVP.md` lengkap | PENDING BUSINESS SIGN-OFF |

`BLOCKED` atau `PENDING` pada tabel ini berarti release belum memenuhi go-live gate.
