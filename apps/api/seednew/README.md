# Prisma seed dari PostgreSQL custom dump

File upload `postgres.dump` adalah PostgreSQL custom database dump, bukan plain SQL. Jadi file ini harus diekstrak dulu memakai `pg_restore`.

## 1. Generate `seed.sql`

Jalankan dari folder `apps/api/seednew`.

Windows PowerShell:

```powershell
.\convert-to-inserts-docker.ps1 .\postgres.dump .\seed.sql
```

Git Bash / Linux / macOS:

```bash
bash convert-to-inserts-docker.sh postgres.dump seed.sql
```

Script ini akan:

1. Start temporary PostgreSQL container
2. Restore `postgres.dump` ke database sementara
3. Export ulang ke `seed.sql` dalam format `INSERT`
4. Cleanup container

### Alternatif tanpa Docker

Jika sudah install PostgreSQL client:

```bash
bash extract-seed-from-dump.sh postgres.dump seed.sql
```

Catatan: output ini memakai format `COPY`, bukan `INSERT`, sehingga kurang cocok untuk converter readable seed.

## 2. Generate seed yang isinya terlihat

Setelah `seed.sql` terisi `INSERT`, jalankan dari folder `apps/api`:

```bash
npx tsx seednew/generate-readable-seed.ts --input=seednew/seed.sql --output=seednew/seed-readable.ts
```

Hasilnya adalah `seed-readable.ts`, berisi data dalam bentuk array object per tabel:

```ts
const seedTables = [
  {
    table: 'public.branches',
    rows: [
      {
        id: '...',
        branchCode: 'PUS',
        name: 'Raho Premier Jakarta',
      },
    ],
  },
];
```

Secara default tabel `public._prisma_migrations` tidak dimasukkan, supaya tidak bentrok dengan migration Prisma.

## 3. Jalankan readable seed

Dari folder `apps/api`:

```bash
npx tsx seednew/seed-readable.ts
```

Untuk database kosong, jalankan migration dulu:

```bash
npm run db:migrate:prod
npx tsx seednew/seed-readable.ts
```

## 4. Opsional: jadikan script package.json

```json
{
  "scripts": {
    "db:seed:dump": "tsx seednew/seed-readable.ts"
  },
  "devDependencies": {
    "tsx": "latest"
  }
}
```

Jika belum ada `tsx`:

```bash
npm install -D tsx
```

## Catatan penting

- `seed-readable.ts` cocok untuk development/staging database kosong yang sudah menjalankan migration.
- Jangan seed tabel `_prisma_migrations` kecuali memang ingin menyalin history migration lama.
- Generator menunda kolom self-reference `member_packages.upgradedFromId` dan `therapy_plans.supersededById`, lalu meng-update-nya setelah semua row terinsert.
- Kalau masih ada error foreign key, berarti schema Prisma aktif sudah berbeda dari database asal dump.
- Kalau schema Prisma sudah berubah dari database asal dump, beberapa kolom mungkin tidak cocok. Edit `seed.sql` atau buat seed manual per model.
