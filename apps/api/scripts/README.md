# Scripts

Utility scripts untuk maintenance dan data migration.

## Generate Missing Invoices

Script untuk membuat invoice untuk paket-paket lama yang sudah di-verify tapi belum punya invoice (sebelum fitur auto-generate invoice ditambahkan).

### Cara Menjalankan:

```bash
cd apps/api
npx tsx scripts/generateMissingInvoices.ts
```

### Apa yang dilakukan:

1. Mencari semua paket dengan status `ACTIVE` yang sudah punya `paidAt` tapi belum punya invoice
2. Generate invoice number yang sesuai untuk setiap paket
3. Membuat invoice dengan status `PAID` dan tanggal sesuai dengan `paidAt` paket
4. Menampilkan summary berapa invoice yang berhasil dibuat

### Catatan:

- Script ini aman dijalankan berkali-kali (akan skip paket yang sudah punya invoice)
- Invoice yang dibuat akan menggunakan `productCode` jika tersedia, atau fallback ke `packageCode`
- Semua invoice dibuat dengan status `PAID` karena paketnya sudah aktif

## Init MinIO

Script untuk inisialisasi MinIO storage (sudah ada).

```bash
cd apps/api
npx tsx scripts/initMinio.ts
```

## Fix Document URLs

Script untuk memperbaiki URL dokumen di database (sudah ada).

```bash
cd apps/api
npx tsx scripts/fixDocumentUrls.ts
```
