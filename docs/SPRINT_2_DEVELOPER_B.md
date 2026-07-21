# Sprint 2 Developer B - Inventory Ledger Foundation

**Versi:** 1.0  
**Tanggal rencana:** 21 Juli 2026  
**Durasi:** 2 minggu / 10 hari kerja  
**Owner:** Developer B  
**Reviewer utama:** Developer A  
**Migration owner sprint:** Developer B  
**Requirement utama:** FR-INV-001-008  
**Sumber:** `docs/DEVELOPMENT_UPDATE_PLAN_2_DEVELOPERS.md`

Sprint 2 Developer B membangun sumber kebenaran stok yang dapat diaudit: inventory balance per product-location-batch, batch, cost layer, stock mutation append-only, quantity buckets, serta movement reason/reference. Output integrasi sprint adalah kontrak posting bersama dengan Developer A dan traceability dari source document ke inventory ledger, branch, cost center, dan calon journal entry.

---

## 1. Tujuan Sprint

1. Mengganti pola perubahan langsung `InventoryItem.stock` dengan satu inventory posting engine.
2. Menyimpan saldo per product, warehouse, stock location, dan batch.
3. Memisahkan quantity bucket `onHand`, `reserved`, `quarantine`, dan `inTransit`; `available` dihitung dari bucket sumber.
4. Membuat stock mutation yang append-only, idempotent, dapat direkonsiliasi, dan dapat dibalik dengan reversal.
5. Menyiapkan batch dan cost layer untuk FIFO allocation pada Sprint 3.
6. Menjaga kompatibilitas flow lama selama migrasi tanpa menjadikan dua sumber kebenaran.
7. Menyepakati kontrak posting inventory-to-accounting dengan Developer A.

---

## 2. Scope dan Batas Sprint

| Area | Target Sprint 2 | Catatan Repo Saat Ini |
|---|---|---|
| Inventory balance | Saldo per branch, product, warehouse, location, dan batch | `InventoryItem.stock` masih agregat per product-branch |
| Batch | Batch number, manufacture/expiry date, status, dan traceability | Belum ada model batch eksplisit |
| Cost layer | Layer masuk dengan original/remaining quantity, unit cost, dan source | Belum ada cost layer |
| Stock mutation | Ledger append-only dengan before/after bucket, reason, reference, dan reversal | `StockMutation` sudah ada tetapi masih tiga tipe dan terikat saldo agregat |
| Quantity buckets | `onHand`, `reserved`, `quarantine`, `inTransit`, dan derived `available` | Belum tersedia |
| Movement reason/reference | Reason code terstruktur dan source document polymorphic | Saat ini `referenceType`, `referenceId`, dan notes masih longgar |
| Posting contract | Event inventory memiliki branch/cost-center context dan nilai stok | Belum ada kontrak lintas ledger formal |
| Reconciliation | Balance sama dengan agregasi mutation dan cost layer | Belum ada tool rekonsiliasi |

Batas implementasi:

- Sprint 2 membuat struktur dan posting engine; pemilihan dan konsumsi FIFO lengkap dikerjakan pada Sprint 3.
- Bucket reservation sudah tersedia, tetapi workflow stock request reserve/release dikerjakan pada Sprint 4.
- Bucket in-transit sudah tersedia, tetapi shipment/receiving transfer end-to-end dikerjakan pada Sprint 5.
- Opening stock bernilai dan jurnal opening balance dikerjakan bersama pada Sprint 4. Data legacy tanpa harga harus ditandai `PENDING_VALUATION`, bukan diam-diam dianggap bernilai nol.

---

## 3. Output Integrasi

| Output | Kondisi Lulus |
|---|---|
| Kontrak posting bersama | Developer A dan B menyetujui idempotency key, source document, event type, branch, cost center, occurredAt, quantity, unit cost, total cost, reversal reference, dan error contract. |
| Traceability ledger | Dari mutation dapat ditelusuri ke source document, actor, balance, batch, cost layer, branch/location, dan event posting; dari source document dapat ditelusuri kembali ke mutation. |
| Quantity konsisten | Semua bucket non-negatif, formula `available = onHand - reserved - quarantine` konsisten, dan agregat balance cocok dengan ledger. |
| Batch/cost siap FIFO | Inbound stock dapat membentuk batch dan cost layer; layer memiliki remaining quantity yang dapat dipakai allocator Sprint 3. |
| Audit aktif | Posting, reversal, perubahan metadata batch, dan hasil rekonsiliasi sensitif tercatat; mutation posted tidak dapat diedit atau dihapus. |

---

## 4. Ticket Sprint 2

| ID | Ticket | Scope | Estimasi | Reviewer | Acceptance Criteria |
|---|---|---|---:|---|---|
| B2-01 | Finalisasi ERD, posting contract, dan migration plan | DB/API/docs | 1.0 hari | Developer A | Model, invariant, index, source reference, idempotency, backfill, rollback, dan kontrak event disetujui sebelum migration dibuat. |
| B2-02 | Implement schema balance, batch, cost layer, dan mutation baru | DB/test | 1.25 hari | Developer A | Migration additive berhasil; unique/index/foreign key tersedia; schema Prisma tervalidasi; tidak menghapus kolom legacy. |
| B2-03 | Implement inventory posting engine | API/service/test | 1.5 hari | Developer A | Semua perubahan quantity melewati satu service dan satu DB transaction; retry key yang sama tidak menggandakan posting; posted mutation immutable. |
| B2-04 | Implement quantity bucket dan invariant | API/service/test | 1.0 hari | Developer A | Update bucket atomik; available dihitung konsisten; saldo/bucket negatif ditolak; before/after tersimpan. |
| B2-05 | Implement batch lifecycle | API/UI/test | 0.75 hari | Developer A | Batch number unik sesuai product; expiry/manufacture date tervalidasi; expired/blocked batch tidak dapat dipilih untuk transaksi keluar baru. |
| B2-06 | Implement inbound cost layer foundation | API/service/test | 1.0 hari | Developer A | Inbound normal wajib memiliki unit cost; original dan remaining quantity sama saat dibuat; currency dan source tersimpan; legacy tanpa cost berstatus pending valuation. |
| B2-07 | Implement balance, stock card, batch, dan cost-layer read API | API/test | 0.75 hari | Developer A | Filter branch/product/location/batch/date tersedia dan server-side scope aktif; response memakai Decimal string. |
| B2-08 | Integrasi posting contract, audit, dan source trace | API/test/docs | 0.75 hari | Developer A | Event dapat dipakai accounting adapter; movement memiliki branch/cost-center context; audit dan reverse reference lengkap. |
| B2-09 | Implement UI stock balance dan stock card minimum | UI/test | 0.75 hari | Developer A | User dapat melihat bucket, batch/expiry, layer/value status, dan source reference sesuai permission dengan loading/error/empty state. |
| B2-10 | Backfill, reconciliation, concurrency, dan regression | DB/test/docs | 1.25 hari | Developer A | Data legacy dipetakan ke default location; mismatch report nol atau terdokumentasi; duplicate posting dan competing update diuji; flow lama tetap lulus. |

Total estimasi: 10 hari.

---

## 5. Jadwal 10 Hari

| Hari | Fokus | Output harian |
|---:|---|---|
| 1 | Contract review, ERD, invariant, dan migration rehearsal plan | Schema dan posting contract disetujui |
| 2 | Migration batch, balance, quantity bucket, dan index | Schema baru siap review |
| 3 | Stock mutation header/line dan posting engine | Posting dasar idempotent |
| 4 | Bucket transition, validation, dan balance update atomik | Invariant quantity lulus unit test |
| 5 | Batch lifecycle dan expiry validation | Batch siap dipakai inbound/outbound |
| 6 | Cost layer inbound dan valuation status | Layer siap untuk FIFO Sprint 3 |
| 7 | Read API balance, stock card, batch, layer, dan trace | Query ledger siap UI/integrasi |
| 8 | Backfill legacy dan compatibility read model | Flow lama membaca agregat baru |
| 9 | Integrasi Developer A, UI minimum, reconciliation, dan concurrency test | Kontrak lintas ledger tervalidasi |
| 10 | Regression, demo, dokumentasi, dan retrospective | Sprint 2 sign-off |

---

## 6. Rekomendasi Model Data

Nama final model dapat disesuaikan dengan hasil Sprint 1. Proposal ini mengasumsikan `Warehouse` dan `StockLocation` sudah tersedia.

```prisma
enum InventoryBucket {
  ON_HAND
  RESERVED
  QUARANTINE
  IN_TRANSIT
}

enum InventoryMovementType {
  OPENING
  RECEIPT
  ISSUE
  RESERVE
  RELEASE
  QUARANTINE
  UNQUARANTINE
  TRANSFER_OUT
  TRANSFER_IN
  ADJUSTMENT_IN
  ADJUSTMENT_OUT
  REVERSAL
}

enum ValuationStatus {
  VALUED
  PENDING_VALUATION
}

model InventoryBatch {
  id                  String    @id @default(cuid())
  masterProductId     String
  batchNumber         String
  manufactureDate     DateTime?
  expiryDate          DateTime?
  isBlocked           Boolean   @default(false)
  isLegacyPlaceholder Boolean   @default(false)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  masterProduct MasterProduct @relation(fields: [masterProductId], references: [id])

  @@unique([masterProductId, batchNumber])
  @@index([masterProductId, expiryDate])
}

model InventoryBalance {
  id              String   @id @default(cuid())
  branchId        String
  masterProductId String
  warehouseId     String
  stockLocationId String
  batchId         String?
  onHandQty       Decimal  @default(0) @db.Decimal(18, 4)
  reservedQty     Decimal  @default(0) @db.Decimal(18, 4)
  quarantineQty   Decimal  @default(0) @db.Decimal(18, 4)
  inTransitQty    Decimal  @default(0) @db.Decimal(18, 4)
  version         Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([branchId, masterProductId, warehouseId, stockLocationId, batchId])
  @@index([branchId, masterProductId])
  @@index([stockLocationId, masterProductId])
  @@index([batchId])
}

model InventoryPosting {
  id                String                @id @default(cuid())
  postingNumber     String                @unique
  idempotencyKey    String                @unique
  movementType      InventoryMovementType
  reasonCode        String
  sourceType        String
  sourceId          String
  branchId          String
  costCenterId      String?
  reversalOfId      String?               @unique
  occurredAt        DateTime
  postedBy          String
  postedAt          DateTime              @default(now())

  @@index([sourceType, sourceId])
  @@index([branchId, occurredAt])
}

model StockMutation {
  id                 String          @id @default(cuid())
  postingId          String
  inventoryBalanceId String
  bucket             InventoryBucket
  quantityDelta      Decimal         @db.Decimal(18, 4)
  quantityBefore     Decimal         @db.Decimal(18, 4)
  quantityAfter      Decimal         @db.Decimal(18, 4)
  createdAt          DateTime        @default(now())

  @@index([postingId])
  @@index([inventoryBalanceId, createdAt])
}

model InventoryCostLayer {
  id                 String          @id @default(cuid())
  inventoryBalanceId String
  batchId             String?
  sourceType          String
  sourceId            String
  originalQty         Decimal         @db.Decimal(18, 4)
  remainingQty        Decimal         @db.Decimal(18, 4)
  unitCost            Decimal?        @db.Decimal(18, 4)
  currency            String          @default("IDR")
  valuationStatus     ValuationStatus @default(VALUED)
  receivedAt          DateTime
  createdAt           DateTime        @default(now())

  @@index([inventoryBalanceId, receivedAt])
  @@index([batchId, receivedAt])
  @@index([sourceType, sourceId])
}
```

Catatan desain:

- `availableQty` tidak disimpan sebagai angka yang dapat diedit. Nilainya dihitung dengan `onHandQty - reservedQty - quarantineQty` agar tidak drift.
- Untuk product tanpa batch tracking, `batchId` boleh `null`. Product yang wajib batch harus memiliki batch pada inbound dan outbound.
- Precision quantity dinaikkan ke `Decimal(18,4)` agar agregasi ledger lebih aman. Nominal cost juga memakai Decimal.
- `InventoryPosting` adalah header business event; `StockMutation` adalah baris perubahan bucket.
- Reason code sebaiknya master terkontrol atau enum terstruktur, bukan free text. Notes boleh tetap menjadi keterangan tambahan.
- Cost layer posted tidak diedit. Koreksi dilakukan lewat reversal dan replacement posting.

---

## 7. Invariant Quantity dan Posting Rules

Invariant setelah setiap posting:

```text
onHandQty >= 0
reservedQty >= 0
quarantineQty >= 0
inTransitQty >= 0
reservedQty + quarantineQty <= onHandQty
availableQty = onHandQty - reservedQty - quarantineQty
```

Aturan posting:

1. Semua quantity dan cost diterima sebagai decimal string pada API, lalu diproses sebagai `Prisma.Decimal`.
2. Satu business event menghasilkan satu `InventoryPosting` dan satu atau lebih `StockMutation` dalam satu DB transaction.
3. `idempotencyKey` yang sama dengan payload yang sama mengembalikan hasil sebelumnya; payload berbeda ditolak dengan conflict.
4. Balance dikunci atau diperbarui secara kondisional memakai `version`; retry dilakukan terbatas saat terjadi conflict.
5. Posted mutation, balance history, dan cost layer tidak dapat di-update/delete melalui endpoint umum.
6. Koreksi memakai posting `REVERSAL` yang menunjuk posting asal dan membuat delta kebalikan.
7. Inbound normal yang membentuk nilai inventory wajib memiliki unit cost dan currency.
8. Outbound batch-managed wajib menunjuk batch valid; implementasi auto-select FIFO ditunda ke Sprint 3.
9. Movement lintas branch/location harus menghasilkan pasangan mutation yang dapat direkonsiliasi, bukan mengubah dua saldo tanpa header bersama.

---

## 8. Posting Contract dengan Developer A

Draft command internal:

```ts
type InventoryPostingCommand = {
  idempotencyKey: string;
  movementType: InventoryMovementType;
  reasonCode: string;
  source: {
    type: string;
    id: string;
    number?: string;
  };
  branchId: string;
  costCenterId?: string;
  occurredAt: string;
  actorUserId: string;
  lines: Array<{
    masterProductId: string;
    warehouseId: string;
    stockLocationId: string;
    batchId?: string;
    bucket: InventoryBucket;
    quantityDelta: string;
    unitCost?: string;
    currency?: "IDR";
  }>;
};
```

Hasil posting yang dapat dipakai accounting adapter:

```ts
type InventoryPostedResult = {
  postingId: string;
  postingNumber: string;
  sourceType: string;
  sourceId: string;
  branchId: string;
  costCenterId?: string;
  occurredAt: string;
  totalInventoryValue?: string;
  reversalOfId?: string;
  lines: Array<{
    masterProductId: string;
    batchId?: string;
    quantityDelta: string;
    unitCost?: string;
    totalCost?: string;
  }>;
};
```

Kesepakatan dengan Developer A:

- Developer B menjadi owner quantity, batch, cost layer, stock mutation, dan inventory value calculation.
- Developer A menjadi owner account mapping, balanced journal, accounting period, dan journal posting.
- `postingId` dan source document disimpan pada kedua ledger agar trace dua arah tersedia.
- Kegagalan journal pada business event atomik harus menggagalkan posting stok bila policy event mewajibkan jurnal pada transaction yang sama.
- Event yang belum berdampak jurnal, seperti reserve/release, tetap tercatat pada inventory ledger tetapi tidak membentuk journal.

---

## 9. API Contract Draft

| Method | Endpoint | Kegunaan | Akses minimum |
|---|---|---|---|
| `GET` | `/api/v1/inventory/balances` | Saldo dan bucket per product/location/batch | Inventory read scoped |
| `GET` | `/api/v1/inventory/stock-card` | Mutation chronology dan running balance | Inventory read scoped |
| `GET` | `/api/v1/inventory/batches` | Batch dan expiry status | Inventory read scoped |
| `GET` | `/api/v1/inventory/cost-layers` | Layer dan remaining quantity/value | Inventory valuation read scoped |
| `GET` | `/api/v1/inventory/postings/:id` | Detail posting dan source trace | Inventory read scoped |
| `POST` | `/api/v1/inventory/postings/:id/reverse` | Reversal posting | Inventory reverse permission |
| `GET` | `/api/v1/inventory/reconciliation` | Hasil rekonsiliasi quantity/layer | Inventory audit permission |

`POST /inventory/postings` tidak menjadi endpoint generik untuk UI. Business module memanggil posting engine internal agar user tidak dapat membuat mutasi bebas tanpa source document dan permission flow.

Error code minimum:

| Code | Arti |
|---|---|
| `INVENTORY_SCOPE_DENIED` | Branch/location target di luar scope user |
| `INVALID_QUANTITY` | Quantity nol/tidak valid untuk movement terkait |
| `INSUFFICIENT_AVAILABLE_STOCK` | Available quantity tidak mencukupi |
| `INVALID_BUCKET_TRANSITION` | Perpindahan bucket tidak diizinkan |
| `BATCH_REQUIRED` | Product wajib batch tetapi batch tidak diisi |
| `BATCH_BLOCKED` | Batch diblokir atau tidak boleh digunakan |
| `BATCH_EXPIRED` | Batch expired tidak boleh digunakan untuk issue baru |
| `UNIT_COST_REQUIRED` | Inbound bernilai tidak memiliki unit cost |
| `IDEMPOTENCY_CONFLICT` | Key pernah dipakai dengan payload berbeda |
| `POSTING_IMMUTABLE` | Posting posted tidak dapat diedit/dihapus |
| `POSTING_ALREADY_REVERSED` | Posting asal sudah memiliki reversal |
| `INVENTORY_CONCURRENCY_CONFLICT` | Saldo berubah oleh transaction lain |
| `INVENTORY_RECONCILIATION_FAILED` | Balance, mutation, atau layer tidak cocok |

---

## 10. Migration dan Backfill Strategy

Urutan migration:

1. Tambahkan enum/tabel baru secara additive dan pertahankan `InventoryItem.stock` serta `StockMutation` legacy.
2. Pastikan setiap branch memiliki default warehouse dan stock location dari Sprint 1.
3. Buat `InventoryBalance` dari setiap `InventoryItem` dengan saldo awal pada `onHandQty`.
4. Product batch-managed dengan stok lama mendapat placeholder batch `LEGACY-UNKNOWN`; tandai `isLegacyPlaceholder=true` dan masukkan ke data-quality report.
5. Buat opening posting `LEGACY_MIGRATION` per balance agar saldo baru memiliki ledger origin yang dapat diaudit.
6. Buat provisional cost layer untuk quantity legacy dengan `unitCost=null` dan `valuationStatus=PENDING_VALUATION`; jangan ikutkan ke valuation final sebelum dilengkapi.
7. Refactor seluruh writer lama agar memanggil posting engine. Selama transisi, `InventoryItem.stock` hanya compatibility mirror yang diperbarui dalam transaction yang sama.
8. Ubah read API bertahap untuk mengambil agregat dari `InventoryBalance`; bandingkan dengan mirror legacy melalui reconciliation job.
9. Kolom/model legacy baru boleh dideprecate setelah seluruh writer terinventarisasi, regression hijau, dan dua kali rehearsal data berhasil.

Rollback Sprint 2 bersifat forward-fix: disable feature flag ledger baru dan kembalikan read ke compatibility mirror. Migration yang sudah dipakai tidak diedit atau dihapus.

---

## 11. Audit, Permission, dan Immutability

Audit wajib dibuat untuk:

- inventory posting berhasil/gagal pada endpoint sensitif;
- reversal beserta posting asal dan alasan;
- create/update/block/unblock batch metadata;
- perubahan expiry date atau batch number dengan before/after;
- perubahan valuation status data legacy;
- eksekusi reconciliation dan daftar mismatch;
- usaha edit/delete posted mutation yang ditolak.

Permission minimum:

| Aksi | Scope |
|---|---|
| Lihat balance dan stock card | Branch assignment user |
| Lihat cost layer/value | Permission inventory valuation + branch scope |
| Kelola batch metadata | Inventory master permission + branch/product scope |
| Posting melalui business flow | Permission source document + inventory posting policy |
| Reverse posting | Permission khusus, reason wajib, tidak boleh maker yang sama bila maker-checker aktif |
| Jalankan reconciliation | Inventory audit permission |

Semua pemeriksaan dilakukan server-side. Filter UI hanya membantu pengalaman pengguna dan bukan kontrol keamanan.

---

## 12. Test Plan

### Unit

- Formula available untuk kombinasi on-hand, reserved, dan quarantine.
- Semua invariant menolak saldo negatif dan reserved/quarantine melebihi on-hand.
- Decimal quantity/cost tidak melewati konversi JavaScript floating point.
- Validasi batch required, blocked, manufacture date, dan expiry date.
- Cost layer inbound memiliki original/remaining quantity dan nilai yang benar.
- Reversal menghasilkan delta kebalikan tanpa mengubah mutation asal.

### Integration

- Inbound membuat posting, mutation, balance, batch, dan cost layer dalam satu transaction.
- Error pada salah satu baris menggagalkan seluruh posting.
- Retry idempotency key yang sama hanya menghasilkan satu posting.
- Source document dapat menelusuri posting dan sebaliknya.
- Branch scope menolak pembacaan/posting ke branch lain.
- Compatibility mirror cocok dengan agregat balance baru.

### Concurrency dan Data

- Dua update pada balance/version yang sama tidak menyebabkan lost update.
- Competing issue tidak membuat saldo negatif.
- Reconciliation membandingkan balance dengan sum mutation per bucket.
- Sum remaining cost layer tidak melebihi quantity bernilai yang tersedia.
- Backfill dapat dijalankan ulang dengan aman dan tidak menggandakan opening posting.

### Regression

- Inventory list dan stock mutation lama tetap dapat dibuka.
- Stock request, shipment receive, material usage, dan homecare tidak kehilangan saldo.
- Export stock mutation tetap bekerja atau dialihkan ke stock-card API baru.

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

## 13. Definition of Done Sprint 2

Sprint 2 Developer B selesai jika:

- Inventory balance tersedia per branch, product, warehouse, location, dan batch.
- Batch dan expiry dapat ditelusuri dari saldo hingga source document.
- Quantity bucket dan derived available memenuhi invariant pada semua posting.
- Stock mutation dan cost layer bersifat append-only; koreksi memakai reversal.
- Posting engine idempotent dan menjadi satu-satunya jalur write inventory baru.
- Data legacy berhasil dibackfill tanpa kehilangan quantity; data tanpa cost ditandai pending valuation.
- Balance, mutation, compatibility mirror, dan cost layer lulus reconciliation.
- Kontrak Developer A/B untuk source, branch, cost center, inventory value, journal link, idempotency, dan reversal disetujui.
- Unit, integration, access-control, migration, dan concurrency test relevan lulus.
- Seluruh write memiliki audit trail dan branch scope server-side.
- Migration rehearsal serta rollback/forward-fix procedure terdokumentasi.

---

## 14. Demo Scenario

1. Admin Logistik menerima product batch-managed ke warehouse pusat dengan batch, expiry, quantity, dan unit cost.
2. Sistem membuat satu posting, on-hand balance, stock mutation, batch record, dan cost layer.
3. User membuka stock card dan menelusuri source reference, actor, branch, location, batch, dan running balance.
4. Retry request dengan idempotency key yang sama tidak menambah saldo atau layer.
5. User branch lain mencoba membaca posting tersebut dan ditolak.
6. Posting dibalik dengan reason dan menghasilkan reversal terpisah; mutation asal tetap tidak berubah.
7. Reconciliation menunjukkan balance cocok dengan mutation dan compatibility mirror.
8. Data legacy tanpa harga terlihat sebagai `PENDING_VALUATION`, bukan dihitung sebagai nilai nol final.

---

## 15. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Banyak service masih menulis `InventoryItem.stock` langsung | Ledger baru drift dari saldo lama | Inventarisasi seluruh writer dengan `rg`; wajib lewat posting engine; reconciliation menjadi quality gate |
| Nullable `batchId` pada unique key PostgreSQL dapat menghasilkan duplicate null row | Balance product non-batch ganda | Gunakan partial unique index/coalesced key pada migration SQL atau sentinel batch non-tracked yang disepakati |
| Legacy stock tidak memiliki unit cost | Valuation salah | Tandai `PENDING_VALUATION`; laporkan sebagai data gap; lengkapi melalui opening balance Sprint 4 |
| Mutation schema lama dipakai banyak flow | Regression shipment/material usage | Migration additive, compatibility adapter, feature flag, dan refactor writer bertahap |
| Concurrent posting menyebabkan lost update/negative stock | Saldo tidak akurat | Conditional update/version, transaction, retry terbatas, idempotency, dan concurrency test |
| Posting inventory dan journal tidak atomik | Quantity dan finance berbeda | Sepakati transaction boundary/outbox policy dengan Developer A sebelum adapter produksi |
| Cost layer terlalu cepat mengimplementasikan FIFO | Scope Sprint 2 melebar | Sprint 2 hanya inbound layer dan invariant; selector/consumption FIFO diselesaikan Sprint 3 |
