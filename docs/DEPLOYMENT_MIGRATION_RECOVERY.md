# Recovery migrasi deployment

Error `P3018/P3009` pada migrasi `20260729084954_rahoapps` atau `20260818042140_teest` dapat muncul karena SQL lama menghapus index yang sudah tidak ada atau mengulang rename yang sudah dilakukan. Migrasi Juli juga merujuk dua index sebelum tabelnya dibuat oleh migrasi berikutnya.

Perbaikan deployment menggunakan `apps/api/prisma/deploy-with-recovery.sh` yang sudah dipanggil oleh deployment produksi. Tidak perlu reset database atau menjalankan seed.

## Cara menjalankan

1. Commit dan push seluruh perubahan recovery, termasuk migrasi baru dan helper `.cjs`.
2. Jalankan ulang workflow deployment dengan commit terbaru, bukan re-run job commit lama. Workflow sudah membuat backup database sebelum migrasi.
3. Periksa log: recovery harus merekonsiliasi SQL sebelum `marked as applied`, kemudian `migrate deploy` melanjutkan migrasi lainnya.
4. Migrasi `20260917100000_reconcile_schema_alignment_indexes` menyelesaikan nama dua index yang tabelnya dibuat belakangan. Setelah selesai, status migrasi harus up to date.

Tidak perlu menandai migrasi sebagai applied secara manual. Penyelesaian SQL lebih dahulu mengikuti opsi [complete migration and resolve as applied dari Prisma](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing).

## Pengaman

- File migrasi lama tidak diubah; helper memverifikasi checksum SQL yang sudah direview. Hanya dua migrasi alignment di atas dan jalur recovery deferred revenue yang sebelumnya ada yang dikenali.
- Hanya error missing index/constraint milik migrasi tersebut yang dapat masuk recovery alignment. Error permission, foreign key/data integrity, SQL berbeda, atau migrasi lain ditolak.
- Semua operasi alignment yang berlaku dijalankan dalam transaksi. Rename yang sudah selesai boleh diulang; source dan target sama-sama hilang atau keduanya ada menyebabkan rollback.
- Khusus migrasi Juli, dua rename boleh ditunda hanya jika tabel belum ada dan migrasi pembuat tabel belum applied. Migrasi rekonsiliasi akhir wajib tersedia.
- Tidak ada penghapusan tabel/baris bisnis, `migrate reset`, `db push`, atau bypass semua error. DROP hanya untuk empat/lima index obsolete dan foreign key yang langsung dibuat ulang sesuai SQL asli dalam transaksi.
- Lock timeout 5 detik, statement timeout 30 detik, transaction timeout 60 detik. Retry deploy dibatasi tiga recovery agar tidak looping.
- Jika recovery menolak, hentikan deployment dan periksa database dengan backup tersedia. Jangan mengubah checksum/helper whitelist hanya untuk melewati error.

## Tes

Unit recovery termasuk dalam `npm run test:api`. Tes PostgreSQL tambahan bersifat opt-in: database lokal harus bernama `migration_recovery`, host localhost/127.0.0.1, dan `RUN_MIGRATION_RECOVERY_DB_TESTS=true`. Tes membuat schema sementara `recovery_test_*` lalu menghapus schema itu; jangan arahkan ke produksi.

Yang diperiksa: kasus missing index, preservasi baris dan aksi foreign key SET NULL, replay setelah resolve gagal, rollback DDL jika constraint wajib hilang, serta penolakan index konflik. Seluruh rantai migrasi juga diverifikasi pada PostgreSQL sementara; ini tidak menggantikan verifikasi kondisi database produksi.
