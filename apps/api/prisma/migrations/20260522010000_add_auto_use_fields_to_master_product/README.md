# Migration: Add Auto-Use Fields to MasterProduct

## Deskripsi
Migration ini menambahkan field baru ke tabel `master_products` untuk mendukung fitur:
1. **Auto-use per session**: Produk otomatis digunakan (dikurangi stoknya) setiap sesi infus
2. **Auto-add to branch**: Produk otomatis ditambahkan ke inventory cabang baru

## Field Baru
- `is_auto_used_per_session` (BOOLEAN, default: false) - Jika true, 1 unit produk akan otomatis dikurangi dari stok setiap sesi infus
- `is_auto_added_to_branch` (BOOLEAN, default: false) - Jika true, produk akan otomatis ditambahkan ke inventory saat cabang baru dibuat
- `default_initial_stock` (DECIMAL(10,4), nullable) - Stok awal default saat produk ditambahkan ke cabang baru

## Produk yang Terpengaruh
- **Infus Set + Pelengkap** (SKU: PRD-INF-SET-002)
  - `isAutoUsedPerSession: true` - Otomatis digunakan 1 piece per sesi terapi
  - `isAutoAddedToBranch: true` - Otomatis ditambahkan ke cabang baru
  - `defaultInitialStock: 100` - Stok awal 100 piece

## Cara Menjalankan

### 1. Stop server yang sedang berjalan
```bash
# Ctrl+C pada terminal yang menjalankan server
```

### 2. Jalankan migration
```bash
cd apps/api
npx prisma migrate deploy
```

### 3. Generate Prisma client
```bash
npx prisma generate
```

### 4. Jalankan seed untuk update produk
```bash
npx prisma db seed
```

### 5. Restart server
```bash
npm run dev
```

## Verifikasi
Setelah migration berhasil:
1. Cek tabel `master_products` - harus ada 3 kolom baru
2. Cek produk "Infus Set + Pelengkap" - harus memiliki flag auto-use dan auto-add
3. Buat cabang baru - "Infus Set + Pelengkap" harus otomatis ada di inventory
4. Buat sesi infus - "Infus Set + Pelengkap" harus otomatis tercatat di material usage
