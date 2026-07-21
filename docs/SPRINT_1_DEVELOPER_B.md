# Sprint 1 Developer B - Master Inventory & Organization

**Versi:** 1.0  
**Tanggal rencana:** 21 Juli 2026  
**Durasi:** 2 minggu / 10 hari kerja  
**Owner:** Developer B  
**Reviewer utama:** Developer A  
**Migration owner sprint:** Developer A  
**Sumber:** `docs/DEVELOPMENT_UPDATE_PLAN_2_DEVELOPERS.md`

Sprint 1 Developer B berfokus pada master data operasional: branch type, warehouse, stock location, product, category, UOM, dan unit conversion. Output integrasi yang wajib terlihat di akhir sprint adalah role sejajar bekerja sesuai scope, master data siap dipakai oleh inventory ledger Sprint 2, dan audit log aktif untuk semua aksi sensitif.

---

## 1. Tujuan Sprint

1. Menyiapkan master data inventory yang stabil untuk Sprint 2: warehouse, stock location, product, category, UOM, dan conversion.
2. Menjaga kompatibilitas dengan data lama: `Branch`, `MasterProduct`, `InventoryItem`, `ProductCategory`, dan `storageLocation`.
3. Mengintegrasikan server-side role/branch scope dari Developer A ke seluruh endpoint master inventory.
4. Mengaktifkan audit log untuk create, update, deactivate, reactivate, dan perubahan conversion.
5. Menyediakan seed data dan UI/API yang cukup agar stock request, shipment, material usage, dan homecare dapat memakai master baru.

---

## 2. Scope Fitur

| Area | Target Sprint 1 | Catatan Repo Saat Ini |
|---|---|---|
| Branch type | Validasi dan penggunaan `PUSAT`, `PREMIER`, `PARTNERSHIP` untuk inventory rules | Sudah ada enum `BranchType` di Prisma |
| Warehouse | Warehouse pusat/cabang dengan default warehouse per branch | Belum ada model eksplisit |
| Stock location | Lokasi/rak/bin di dalam warehouse | Saat ini hanya `InventoryItem.storageLocation` string |
| Product | Master barang dengan SKU, nama, kategori, status aktif, unit, auto-add flag | Sudah ada `MasterProduct` |
| Category | Kategori barang yang konsisten untuk filter/report | Saat ini enum `ProductCategory`: `MEDICINE`, `DEVICE`, `CONSUMABLE` |
| UOM | Master satuan untuk storage dan usage | Saat ini field string `baseUnit`, `usageUnit` |
| Conversion | Konversi storage unit ke usage unit memakai Decimal | Saat ini `conversionFactor Decimal(10,4)` |
| Audit log | Audit untuk semua aksi master inventory | Sudah ada `AuditLog` dan util `logAudit` |
| Role/branch scope | Role sejajar tidak bisa mengubah data di luar scope | Perlu sinkron dengan IAM Developer A |

---

## 3. Output Integrasi

| Output | Kondisi Lulus |
|---|---|
| Role sejajar bekerja | `ADMIN_CABANG` hanya mengelola master inventory cabangnya; `ADMIN_LOGISTIK`/role logistik mengikuti permission; `ADMIN_MANAGER` hanya branch yang dikelola; `SUPER_ADMIN` global. Role sejajar tidak bisa saling eskalasi atau mengakses branch lain. |
| Master data siap | Branch punya default warehouse; warehouse punya minimal satu stock location; product punya SKU/kategori/UOM/conversion valid; data bisa dipilih di stock request, shipment, material usage, dan homecare. |
| Audit log aktif | Create/update/deactivate/reactivate product, warehouse, stock location, UOM/conversion, dan inventory item mapping tercatat dengan user, role, branch, before/after, resourceId, dan timestamp. |

---

## 4. Ticket Sprint 1

| ID | Ticket | Scope | Estimasi | Reviewer | Acceptance Criteria |
|---|---|---|---:|---|---|
| B1-01 | Finalisasi schema proposal warehouse, stock location, UOM, dan conversion | DB/docs | 1.0 hari | Developer A | Proposal berisi model, relasi, index, migration/backfill, dan dampak ke `InventoryItem.storageLocation`; disetujui migration owner sebelum implementasi. |
| B1-02 | Implement warehouse master backend | DB/API/test | 1.0 hari | Developer A | CRUD warehouse tersedia; setiap branch punya default warehouse; kode warehouse unique per branch; delete memakai deactivate bila sudah dipakai. |
| B1-03 | Implement stock location master backend | DB/API/test | 1.0 hari | Developer A | CRUD stock location tersedia; location terikat warehouse dan branch; validasi unique code per warehouse; inactive location tidak bisa dipakai transaksi baru. |
| B1-04 | Rapikan product dan category master | API/UI/test | 1.0 hari | Developer A | Product punya SKU unik, kategori valid, status aktif, batch/expiry flags bila disetujui, dan tidak bisa dihapus keras bila sudah punya stok/mutasi. |
| B1-05 | Implement UOM dan conversion validation | API/test | 1.0 hari | Developer A | Storage unit, usage unit, dan conversion factor memakai Decimal; conversion factor > 0; preview conversion tersedia; perubahan conversion diaudit. |
| B1-06 | Mapping inventory item ke warehouse/location | DB/API/UI/test | 1.0 hari | Developer A | Inventory item dapat ditaruh di default warehouse/location; data lama `storageLocation` dibackfill atau dipetakan; branch scope tervalidasi. |
| B1-07 | Integrasi role/branch scope dengan endpoint master inventory | API/test | 1.0 hari | Developer A | Semua endpoint write master inventory memanggil permission/branch evaluator; test menolak akses branch lain dan role tidak berwenang. |
| B1-08 | Audit log master inventory | API/test | 0.75 hari | Developer A | Audit log aktif untuk create/update/deactivate/reactivate warehouse, location, product, UOM/conversion, dan inventory item mapping. |
| B1-09 | UI master data inventory | UI/test | 1.25 hari | Developer A | Halaman/form master product, warehouse, location, dan conversion memiliki loading/error/empty/success state serta menyembunyikan aksi sesuai permission. |
| B1-10 | Seed, baseline test, dan regression inventory | Test/docs | 1.0 hari | Developer A | Seed default warehouse/location/UOM tersedia; type-check/build/unit test relevan lulus; hasil dicatat di update sprint. |

Total estimasi: 10 hari.

---

## 5. Jadwal 10 Hari

| Hari | Fokus | Output harian |
|---:|---|---|
| 1 | Planning, contract review dengan Developer A, schema proposal | Proposal model dan endpoint disetujui |
| 2 | Warehouse model/API dan backfill default branch warehouse | Warehouse backend siap review |
| 3 | Stock location model/API dan validasi branch scope | Location backend siap review |
| 4 | Product/category hardening dan SKU rules | Product master siap dipakai |
| 5 | UOM/conversion service dan validation | Conversion API/test siap |
| 6 | Mapping inventory item ke warehouse/location | Data lama punya mapping default |
| 7 | Integrasi permission role sejajar dan branch scope | Negative access test tersedia |
| 8 | Audit log untuk aksi master data | Audit dapat difilter resource/branch |
| 9 | UI master data dan regression | UI siap QA internal |
| 10 | Test, demo, dokumentasi, retrospective | Sprint 1 sign-off |

---

## 6. Rekomendasi Model Data

Proposal awal ini perlu disetujui Developer A sebagai migration owner.

```prisma
model Warehouse {
  id          String   @id @default(cuid())
  branchId    String
  code        String
  name        String
  type        String   @default("BRANCH")
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  branch      Branch   @relation(fields: [branchId], references: [id])
  locations   StockLocation[]

  @@unique([branchId, code])
  @@index([branchId, isActive])
}

model StockLocation {
  id          String   @id @default(cuid())
  warehouseId String
  code        String
  name        String
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])

  @@unique([warehouseId, code])
  @@index([warehouseId, isActive])
}

model UnitOfMeasure {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  category  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Catatan:

- Jika MVP ingin konservatif, `ProductCategory` tetap enum dulu. Jika bisnis butuh kategori fleksibel, buat `ProductCategoryMaster` sebagai tabel baru dan migrasikan enum bertahap.
- `InventoryItem.storageLocation` jangan langsung dihapus. Backfill ke `StockLocation`, lalu deprecate field lama setelah flow utama hijau.
- `MasterProduct.baseUnit`, `usageUnit`, dan `conversionFactor` bisa dipakai dulu sambil menambah validasi UOM. Relasi formal ke `UnitOfMeasure` dapat dibuat bila Sprint 0 menyetujui tabel UOM.

---

## 7. API Contract Draft

| Method | Endpoint | Akses minimum | Audit |
|---|---|---|---|
| `GET` | `/api/v1/inventory/warehouses?branchId=` | Inventory read scoped | No |
| `POST` | `/api/v1/inventory/warehouses` | Inventory master manage | Yes |
| `PATCH` | `/api/v1/inventory/warehouses/:id` | Inventory master manage scoped | Yes |
| `DELETE` | `/api/v1/inventory/warehouses/:id` | Inventory master manage scoped | Yes, soft deactivate |
| `GET` | `/api/v1/inventory/stock-locations?warehouseId=` | Inventory read scoped | No |
| `POST` | `/api/v1/inventory/stock-locations` | Inventory master manage | Yes |
| `PATCH` | `/api/v1/inventory/stock-locations/:id` | Inventory master manage scoped | Yes |
| `DELETE` | `/api/v1/inventory/stock-locations/:id` | Inventory master manage scoped | Yes, soft deactivate |
| `GET` | `/api/v1/inventory/master-products` | Inventory read | No |
| `POST` | `/api/v1/inventory/master-products` | Product master manage | Yes |
| `PATCH` | `/api/v1/inventory/master-products/:id` | Product master manage | Yes |
| `POST` | `/api/v1/inventory/conversions/preview` | Inventory read | No |

Error code minimum:

| Code | Arti |
|---|---|
| `BRANCH_SCOPE_DENIED` | User tidak boleh mengakses branch target |
| `WAREHOUSE_NOT_FOUND` | Warehouse tidak ditemukan atau di luar scope |
| `STOCK_LOCATION_NOT_FOUND` | Location tidak ditemukan atau di luar scope |
| `DUPLICATE_WAREHOUSE_CODE` | Kode warehouse sudah dipakai di branch yang sama |
| `DUPLICATE_LOCATION_CODE` | Kode location sudah dipakai di warehouse yang sama |
| `DUPLICATE_PRODUCT_SKU` | SKU sudah dipakai product lain |
| `INVALID_UOM_CONVERSION` | Conversion factor kosong, nol, negatif, atau tidak valid |
| `MASTER_DATA_IN_USE` | Data master tidak boleh hard-delete karena sudah dipakai |

---

## 8. Role dan Permission Matrix

Matrix ini harus disinkronkan dengan pekerjaan IAM Developer A.

| Aksi | SUPER_ADMIN | ADMIN_MANAGER | ADMIN_LOGISTIK | ADMIN_CABANG | ADMIN_LAYANAN/DOCTOR/NURSE |
|---|---|---|---|---|---|
| Lihat product master | Ya | Ya | Ya | Ya | Read-only sesuai kebutuhan |
| Buat/update product master | Ya | Ya, jika diberi permission | Ya, jika diberi permission | Tidak, kecuali permission khusus | Tidak |
| Lihat warehouse/location | Ya | Branch dikelola | Branch logistik dikelola | Branch sendiri | Tidak |
| Buat/update warehouse/location | Ya | Branch dikelola + permission | Branch dikelola + permission | Branch sendiri + permission | Tidak |
| Mapping item ke branch/location | Ya | Branch dikelola | Branch dikelola | Branch sendiri | Tidak |
| Ubah UOM/conversion | Ya | Permission khusus | Permission khusus | Tidak | Tidak |
| Deactivate master data | Ya | Permission khusus | Permission khusus | Tidak | Tidak |

Acceptance role sejajar:

- Admin Cabang A tidak bisa melihat/mengubah warehouse, location, atau inventory item cabang B.
- Admin Manager hanya bisa mengelola branch yang ada di assignment-nya.
- Role yang sama tidak boleh memberi akses lebih tinggi ke dirinya sendiri lewat endpoint master inventory.
- Semua validasi dilakukan di server, bukan hanya UI.

---

## 9. Audit Log Contract

Setiap audit log master inventory minimal berisi:

```ts
type MasterInventoryAuditMeta = {
  module: "INVENTORY_MASTER";
  resource:
    | "Warehouse"
    | "StockLocation"
    | "MasterProduct"
    | "UnitOfMeasure"
    | "InventoryItemMapping";
  resourceId: string;
  branchId?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ACTIVATE" | "DEACTIVATE";
  beforeData?: unknown;
  afterData?: unknown;
  changedFields?: string[];
};
```

Audit wajib dibuat untuk:

- create/update/deactivate/reactivate warehouse;
- create/update/deactivate/reactivate stock location;
- create/update/deactivate/reactivate product;
- perubahan SKU, category, base unit, usage unit, conversion factor;
- mapping inventory item ke warehouse/location;
- perubahan default warehouse/location.

---

## 10. Test Plan

### Unit/API

- Warehouse code unique per branch.
- Stock location code unique per warehouse.
- Product SKU unique dan normalisasi input.
- Conversion factor memakai Decimal dan menolak nilai `0`, negatif, `NaN`, atau string invalid.
- Inactive warehouse/location/product tidak bisa dipakai untuk transaksi baru.
- Audit log memiliki before/after dan branch context.

### Access Control

- `ADMIN_CABANG` cabang A ditolak saat update location cabang B.
- `ADMIN_MANAGER` tanpa assignment branch ditolak.
- Role read-only ditolak untuk write endpoint.
- UI menyembunyikan aksi write, tetapi server tetap menjadi sumber kebenaran.

### Regression

- Stock request masih bisa memilih product.
- Shipment masih menampilkan item.
- Material usage masih bisa mengambil available inventory item.
- Homecare product list tidak rusak.

Command baseline:

```bash
npm run type-check:all
npm run build:api
npm run build:web
npm --prefix apps/api test -- --runInBand
npm --prefix apps/web test -- --runInBand
npm --prefix apps/web run e2e -- e2e/critical/inventory-flow.spec.ts
```

---

## 11. Definition of Done Sprint 1

Sprint 1 Developer B selesai jika:

- Branch type dipakai konsisten untuk aturan inventory dan filter UI/API.
- Setiap branch aktif punya default warehouse dan default stock location.
- Product, category, UOM, dan conversion siap dipakai transaksi Sprint 2.
- Data lama `InventoryItem.storageLocation` punya strategi backfill/deprecation yang jelas.
- Role sejajar bekerja sesuai branch scope dan permission yang disepakati.
- Semua write endpoint master inventory membuat audit log.
- Unit/API test access control dan audit log lulus.
- UI master data punya loading, empty, error, success, dan restricted state.
- Developer A menyetujui schema/migration dan kontrak permission.
- Tidak ada migration besar yang belum disetujui migration owner.

---

## 12. Demo Scenario

1. Super Admin membuat warehouse pusat dan stock location default.
2. Admin Manager membuat stock location untuk branch yang dikelola.
3. Admin Cabang mencoba mengubah stock location branch lain dan ditolak.
4. Admin Logistik membuat product dengan SKU, category, base unit, usage unit, dan conversion.
5. Admin Logistik mengubah conversion factor dan audit log menampilkan before/after.
6. Product baru muncul di stock request/material usage sesuai branch scope.
7. Audit log difilter berdasarkan resource `MasterProduct`, `Warehouse`, dan `StockLocation`.

---

## 13. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Migration warehouse/location bentrok dengan schema Sprint 1 Developer A | Delay dan konflik migration | Developer A menjadi migration owner; Developer B kirim schema proposal lebih dulu |
| `storageLocation` lama tidak bisa langsung dipetakan | Data branch kacau atau lokasi kosong | Buat default warehouse/location per branch dan simpan mapping legacy |
| UOM dibuat terlalu kompleks | Sprint 1 melebar | Pakai validasi UOM minimal dulu; tabel UOM formal hanya jika disetujui Sprint 0 |
| Permission Developer A belum selesai | Endpoint master inventory tidak aman | Gunakan role guard sementara plus branch scope server-side; sambungkan ke permission granular saat tersedia |
| Product category butuh fleksibel tetapi masih enum | Perubahan kategori lambat | Putuskan di Sprint 1 apakah tetap enum untuk MVP atau buat tabel kategori |
