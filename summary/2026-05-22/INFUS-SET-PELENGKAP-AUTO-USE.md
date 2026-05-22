# Fitur: Infus Set + Pelengkap Auto-Use

**Tanggal**: 22 Mei 2026  
**Status**: Implementasi selesai, perlu migration

## Ringkasan
Menambahkan produk "Infus Set + Pelengkap" yang otomatis:
1. Digunakan (dikurangi stoknya) setiap sesi infus terapi
2. Ditambahkan ke inventory saat cabang baru dibuat

## Perubahan File

### 1. Schema Prisma
**File**: `apps/api/prisma/schema.prisma`

Menambahkan 3 field baru ke model `MasterProduct`:
```prisma
isAutoUsedPerSession Boolean @default(false) @map("is_auto_used_per_session")
isAutoAddedToBranch  Boolean @default(false) @map("is_auto_added_to_branch")
defaultInitialStock  Decimal? @map("default_initial_stock") @db.Decimal(10, 4)
```

### 2. Migration
**File**: `apps/api/prisma/migrations/20260522010000_add_auto_use_fields_to_master_product/migration.sql`

SQL migration untuk menambahkan kolom baru ke tabel `master_products`.

### 3. Products Seed
**File**: `apps/api/prisma/seeds/products.seed.ts`

Menambahkan produk baru:
```typescript
{ 
  sku: 'PRD-INF-SET-002', 
  name: 'Infus Set + Pelengkap', 
  category: ProductCategory.DEVICE, 
  unit: 'Piece', 
  baseUnit: 'Piece', 
  usageUnit: 'Piece', 
  conversionFactor: 1, 
  description: 'Set infus lengkap dengan pelengkap - WAJIB otomatis digunakan per sesi terapi',
  isAutoUsedPerSession: true,
  isAutoAddedToBranch: true,
  defaultInitialStock: 100,
}
```

### 4. Branch Service
**File**: `apps/api/src/modules/branches/branches.service.ts`

Menambahkan fungsi `autoAddProductsToBranchInventory()` yang:
- Mencari semua produk dengan `isAutoAddedToBranch: true`
- Membuat InventoryItem untuk setiap produk di cabang baru
- Menggunakan `defaultInitialStock` sebagai stok awal

### 5. Infusion Service
**File**: `apps/api/src/modules/sessions/services/infusion.service.ts`

Menambahkan logika auto-use di `createInfusion()`:
- Mencari semua produk dengan `isAutoUsedPerSession: true`
- Mengurangi stok 1 unit per sesi
- Membuat StockMutation dengan notes `[AUTO]`
- Membuat MaterialUsage record
- Mengirim notifikasi jika stok kritis

## Cara Menjalankan

### 1. Stop server
```bash
Ctrl+C
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

### 4. Update produk (seed)
```bash
npx prisma db seed
```

### 5. Restart server
```bash
npm run dev
```

## Verifikasi

### A. Cek Master Products
1. Buka halaman Admin > Master Products
2. Cari "Infus Set + Pelengkap" (SKU: PRD-INF-SET-002)
3. Pastikan produk ada dengan flag auto-use

### B. Cek Auto-Add ke Cabang Baru
1. Buat cabang baru
2. Buka inventory cabang tersebut
3. Pastikan "Infus Set + Pelengkap" ada dengan stok 100

### C. Cek Auto-Use per Sesi
1. Buat sesi terapi baru
2. Isi data infus aktual
3. Cek material usage - "Infus Set + Pelengkap" harus tercatat otomatis
4. Cek stok inventory - harus berkurang 1

## Catatan Teknis

### Produk yang Ada
- **Infus Set** (PRD-INF-SET-001): Produk lama, tidak auto-use
- **Infus Set + Pelengkap** (PRD-INF-SET-002): Produk baru dengan auto-use

### Flow Auto-Use
```
createInfusion() 
  → findMany(isAutoUsedPerSession: true)
  → for each product:
      → findInventoryItem(branchId, productId)
      → updateStock(stock - 1)
      → createStockMutation(type: USED, notes: [AUTO])
      → createMaterialUsage()
      → if (stock < minThreshold) createNotification()
```

### Flow Auto-Add to Branch
```
createBranchService()
  → createBranch()
  → createDefaultPackagePricing()
  → autoAddProductsToBranchInventory()
      → findMany(isAutoAddedToBranch: true)
      → for each product:
          → createInventoryItem(stock: defaultInitialStock)
```
