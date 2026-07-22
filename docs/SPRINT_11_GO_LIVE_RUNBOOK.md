# Sprint 11 — Go-Live Runbook ERP RAHO

Dokumen ini adalah prosedur eksekusi. Checklist baru boleh ditandai setelah command
selesai dan evidence disimpan. Timestamp operasional menggunakan Asia/Jakarta;
timestamp database tetap UTC.

## 1. Owner dan keputusan

| Peran | Nama | Kontak | Status |
|---|---|---|---|
| Incident Commander | `[isi]` | `[isi]` | PENDING |
| Product Owner | `[isi]` | `[isi]` | PENDING |
| Finance Approver | `[isi]` | `[isi]` | PENDING |
| Logistics Approver | `[isi]` | `[isi]` | PENDING |
| Developer A | `[isi]` | `[isi]` | PENDING |
| Developer B | `[isi]` | `[isi]` | PENDING |

Keputusan go/no-go hanya dapat dibuat Incident Commander setelah Finance,
Logistics, dan Product Owner menandatangani evidence.

## 2. Gate sebelum maintenance window

1. Freeze merge dan catat commit SHA release candidate.
2. Pastikan defect Severity 1/2 berjumlah nol.
3. Jalankan:

   ```bash
   npm --prefix apps/api run test:go-live:contracts
   npm run type-check:all
   npm run build:api
   npm run build:web
   ```

4. Pada database rehearsal disposable:

   ```bash
   RUN_FINANCE_DB_TESTS=true RUN_INVENTORY_DB_TESTS=true \
     npm --prefix apps/api run test:go-live:database
   npm --prefix apps/api run go-live:audit -- --cutover=2026-XX-XX
   ```

Status audit wajib `READY`. Output JSON disimpan sebagai evidence dan tidak boleh
disunting.

## 3. Backup dan restore rehearsal

Backup database dan protected evidence merupakan satu paket recovery:

```bash
npm --prefix apps/api run db:backup -- ./backups/database
npm --prefix apps/api run storage:backup -- ./backups/minio
```

Restore hanya ke database dan bucket disposable. Script menolak target yang sama
dengan sumber dan membutuhkan konfirmasi eksplisit:

```bash
BACKUP_FILE=./backups/database/raho-YYYYMMDDTHHMMSSZ.dump \
RESTORE_DATABASE_URL='postgresql://.../raho_restore_test' \
CONFIRM_DISPOSABLE_RESTORE=YES CUTOVER_AT=2026-XX-XX \
npm --prefix apps/api run db:restore:verify

MINIO_BACKUP_DIR=./backups/minio \
MINIO_RESTORE_BUCKET=raho-restore-test \
CONFIRM_DISPOSABLE_RESTORE=YES \
npm --prefix apps/api run storage:restore:verify
```

Catat durasi backup, RPO, durasi restore/RTO, checksum dump, jumlah object, dan
hasil audit setelah restore.

## 4. Opening-data rehearsal

1. Import opening balance ke database rehearsal melalui workflow normal.
2. Maker mengajukan; checker berbeda mem-posting.
3. Jalankan `go-live:audit`.
4. Pastikan `OPEN-001`, `FIN-001`, `INV-001`, `INV-002`, dan `INV-003` lulus.
5. Finance membandingkan Trial Balance dan kas/bank terhadap sumber eksternal.
6. Logistics membandingkan quantity dan valuation per cabang/lokasi.
7. Simpan source file, hash file, output audit, dan tanda tangan kedua approver.

## 5. Cutover

1. Aktifkan maintenance mode dan hentikan write pada sistem lama.
2. Ambil backup final database serta object storage.
3. Deploy release candidate yang sudah diuji; jalankan migration production.
4. Import saldo pembukaan yang telah ditandatangani.
5. Jalankan go-live audit dan smoke test role utama.
6. Verifikasi health check, structured logs, error rate, latency, ruang disk,
   koneksi PostgreSQL, dan akses MinIO.
7. Incident Commander memutuskan go/no-go.

## 6. Rollback

Rollback dilakukan bila ada Sev-1/2, jurnal tidak balanced, inventory mismatch,
akses horizontal, migration gagal, atau restore tidak tervalidasi.

1. Pertahankan maintenance mode dan hentikan semua worker/write.
2. Simpan log, failed payload, dan snapshot database bermasalah untuk investigasi.
3. Roll back aplikasi ke image/commit sebelumnya.
4. Bila data sudah berubah, restore database dan object storage dari paket backup
   final yang timestamp-nya sama. Jangan hanya memulihkan salah satunya.
5. Jalankan audit terhadap hasil restore sebelum membuka sistem lama.
6. Catat keputusan, timeline, data loss window, dan owner tindak lanjut.

## 7. Monitoring 24 jam pertama

- journal imbalance dan reconciliation mismatch: setiap 15 menit;
- failed domain event dan HTTP 5xx: real-time alert;
- negative stock dan pending valuation: setiap jam;
- PostgreSQL connection/storage dan MinIO availability: setiap 5 menit;
- review finance/logistics: H+1 sebelum pukul 10:00 WIB.

Severity 1: transaksi/data integrity/security outage. Severity 2: flow utama tidak
dapat digunakan tanpa workaround aman. Kontak eskalasi mengikuti tabel owner.
