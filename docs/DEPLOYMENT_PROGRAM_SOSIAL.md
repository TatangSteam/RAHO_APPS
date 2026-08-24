# Deployment Program Sosial

Tanggal: 24 Agustus 2026  
Kode: `SRV-TNB-TRP-PS-001`  
Nama: **Terapi Nano Bubble 1X (Program Sosial)**  
Harga dibayar member: **Rp500.000 per sesi**

## Versi super singkat

```text
Backup → pastikan migration sehat → deploy migration → restart API/Web
→ cek harga sosial → UAT pengajuan → Manager approve → Finance approve
→ cek invoice dan paket → baru gunakan untuk member sungguhan
```

> Jangan menjalankan full seed di production. Migration sudah menambahkan master
> harga sosial hanya bila kode tersebut belum ada.

## Jaminan data lama

Migration `20260824120000_add_social_treatment_program` bersifat **additive**:

- membuat tabel `social_program_requests`;
- menambah kolom nullable `member_packages.socialProgramRequestId`;
- menambah permission dan approval rule;
- menambah harga sosial per cabang hanya jika belum ada;
- tidak menjalankan `UPDATE` pada paket, invoice, pembayaran, jurnal, atau revenue;
- tidak melakukan backfill paket lama;
- tidak mengubah harga normal 1X/7X/15X atau harga Booster.

Paket sosial baru hanya dibuat setelah dua approval selesai. Paket lama tetap
memakai harga, diskon, voucher, invoice, dan histori yang telah tersimpan.

## Flow setelah deployment

```text
Admin Layanan / Admin Cabang
  → Member → Paket → Program Sosial
  → isi jumlah Basic, opsi Booster gratis, dan alasan
  → Ajukan

Admin Manager
  → Approval Inbox → Review → Setujui/Tolak

Finance
  → Approval Inbox → Review nominal subsidi → Setujui/Tolak

Jika disetujui dua tahap
  → Basic dibuat dengan list Rp2.000.000, diskon Rp1.500.000, net Rp500.000
  → Booster terpilih dibuat dengan list Rp1.000.000, diskon 100%, net Rp0
  → satu invoice PENDING_PAYMENT dibuat
  → pembayaran Rp500.000 × jumlah sesi diverifikasi seperti paket biasa
  → stok dan HPP Booster tetap dicatat saat sesi terapi dijalankan
```

## 1. Sebelum merge/deploy

Jalankan pada source yang akan dipasang:

```bash
npm ci
npm run db:generate --prefix apps/api
npm run type-check:all
npm run test --prefix apps/api -- --runInBand src/modules/social-program/__tests__/social-program.rules.test.ts
npm run build
```

Pastikan migration yang akan diterapkan hanya:

```bash
npm exec --prefix apps/api prisma migrate status
```

Expected: `20260824120000_add_social_treatment_program` belum diterapkan, dan
tidak ada migration lama berstatus failed.

## 2. Backup wajib

Workflow production repository sudah menjalankan backup terverifikasi sebelum
migration melalui `.github/scripts/deploy-production.sh`. Pastikan log berisi:

```text
Creating verified pre-migration database backup...
Verified backup written to ...
```

Catat lokasi file `.dump` dan `.sha256`. Jangan lanjut jika backup gagal atau
kosong.

## 3. Bila migration reimburse lama masih P3018

Bagian ini hanya dijalankan bila `prisma migrate status` di server masih
menunjukkan migration berikut gagal:

```text
20260821120000_add_reimbursements
```

Jangan langsung menjalankan `migrate resolve`. Periksa dahulu:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '20260821120000_add_reimbursements';

SELECT to_regclass('public.reimbursements') AS reimbursements_table;

SELECT "ruleCode", "updatedAt"
FROM approval_rules
WHERE "ruleCode" IN ('REIMBURSEMENT_STANDARD', 'REIMBURSEMENT_HIGH_VALUE');
```

- Jika server sudah menunjukkan migration selesai, jangan resolve apa pun.
- Jika migration failed tetapi seluruh objek ternyata sudah lengkap, review
  bersama DBA sebelum menandai `--applied`.
- Jika migration failed dan transaksi database telah rollback seluruhnya,
  barulah tandai rolled back lalu deploy ulang:

```bash
npx prisma migrate resolve --rolled-back 20260821120000_add_reimbursements
npx prisma migrate deploy
```

Perbaikan `updatedAt` untuk approval rule sudah ada pada migration repository.
Jangan menghapus tabel atau data reimburse secara manual.

## 4. Deployment production yang direkomendasikan

Repository sudah memakai GitHub Actions pada push ke `main`:

```text
.github/workflows/deploy.yml
  → test + lint + type-check
  → build image API dan Web
  → backup PostgreSQL terverifikasi
  → prisma migrate deploy
  → restart API/Web
  → health check
```

Jadi prosedurnya:

1. Merge commit ke `main`.
2. Pantau job **Deploy RAHO_APPS** sampai selesai.
3. Jangan menjalankan `db:seed`, `db:reset`, atau `prisma migrate reset`.
4. Jangan menyalakan Zoho sync saat migration; deploy script memang mewajibkan
   mode Zoho `OFF`.
5. Simpan nomor workflow run dan lokasi backup dalam laporan deployment.

Jika deployment dilakukan manual memakai compose yang sama:

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps migrate npx prisma migrate status
docker compose -f docker-compose.prod.yml run --rm --no-deps migrate
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate api web
```

Tetap lakukan backup terverifikasi sebelum perintah tersebut.

## 5. Verifikasi database setelah migration

Jalankan query read-only:

```sql
SELECT "productCode", name, price, COUNT(*) AS jumlah_cabang
FROM package_pricings
WHERE "productCode" = 'SRV-TNB-TRP-PS-001'
GROUP BY "productCode", name, price;

SELECT "ruleCode", name, "isActive"
FROM approval_rules
WHERE "ruleCode" = 'SOCIAL_PROGRAM_STANDARD';

SELECT "stepNo", name, "permissionCode"
FROM approval_rule_steps
WHERE "approvalRuleId" = 'apr_social_program_standard'
ORDER BY "stepNo";
```

Expected:

- harga sosial `500000.00`;
- satu master sosial untuk setiap cabang yang sudah ada saat migration;
- tahap 1 `SOCIAL_PROGRAM.MANAGER_APPROVE`;
- tahap 2 `SOCIAL_PROGRAM.FINANCE_APPROVE`.

Untuk cabang yang dibuat **setelah** migration, tambahkan master sosial melalui
menu master pricing atau prosedur provisioning cabang. Jangan menjalankan full
seed hanya untuk menambah satu harga.

## 6. UAT cepat sebelum member sungguhan

Gunakan satu member test:

1. Admin Layanan/Admin Cabang membuka detail member.
2. Klik **Program Sosial**.
3. Pilih `1` Basic dan opsional `1` Booster.
4. Pastikan preview:
   - dibayar member Rp500.000;
   - subsidi Basic Rp1.500.000;
   - jika Booster dipilih, tambahan subsidi Rp1.000.000.
5. Ajukan.
6. Admin Manager approve dari Approval Inbox.
7. Pastikan pengajuan berpindah ke tahap Finance dan paket belum dibuat.
8. Finance approve.
9. Pastikan paket dan invoice baru muncul tepat satu kali.
10. Ulangi refresh/retry dan pastikan tidak ada paket/invoice ganda.
11. Verifikasi pembayaran Rp500.000.
12. Jalankan satu sesi test dan pastikan voucher serta pemakaian material
    berkurang sesuai transaksi.

## 7. Rollback aman

Jika aplikasi bermasalah setelah deploy:

- rollback image API dan Web ke image sebelumnya;
- jangan menghapus tabel atau kolom Program Sosial;
- jangan restore database otomatis bila migration sudah sukses;
- hentikan sementara pembuatan pengajuan sosial;
- data baru tetap tersimpan dan dapat dibaca lagi setelah fix;
- restore database hanya untuk insiden berat dan harus menggunakan backup
  terverifikasi serta persetujuan DBA/Product Owner.

Karena perubahan database bersifat additive, aplikasi lama dapat berjalan dengan
tabel/kolom baru tetap berada di database.
