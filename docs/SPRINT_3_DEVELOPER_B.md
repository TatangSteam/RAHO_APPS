# Sprint 3 Developer B - FIFO, Stock Locking, dan Negative-Stock Prevention

**Versi:** 1.0  
**Tanggal rencana:** 21 Juli 2026  
**Durasi:** 2 minggu / 10 hari kerja  
**Owner:** Developer B  
**Reviewer utama:** Developer A  
**Migration owner sprint:** Developer A  
**Requirement utama:** FR-INV-003-010  
**Integrasi:** FR-SAL-001-008, FR-SAL-010-012, FR-CASH-001-002  
**Sumber:** `docs/DEVELOPMENT_UPDATE_PLAN_2_DEVELOPERS.md`

Sprint 3 Developer B menyelesaikan FIFO allocation, valid-layer selection, stock locking, negative-stock prevention, serta consumption/reversal cost layer. Output bersama dengan Developer A adalah payment verification yang membentuk cash/bank ledger dan jurnal, sementara FIFO lulus unit, integration, dan real-database concurrency test.

---

## 1. Tujuan Sprint

1. Mengalokasikan setiap stock issue ke cost layer tertua yang valid secara deterministik.
2. Menyimpan hubungan immutable antara outbound mutation dan layer yang dikonsumsi.
3. Mengunci inventory balance dan cost layer sebelum validasi serta pengurangan quantity.
4. Mencegah negative stock, over-allocation, lost update, duplicate posting, dan double reversal.
5. Mengembalikan quantity ke layer asal saat reversal tanpa menghitung ulang FIFO.
6. Menghasilkan actual inventory cost yang siap dikonsumsi accounting adapter.
7. Membuktikan keamanan concurrency menggunakan PostgreSQL nyata, bukan mock repository saja.
8. Menjaga integrasi sejajar dengan payment posting Developer A tanpa mencampur ownership domain.

---

## 2. Scope dan Batas Sprint

| Area | Target Sprint 3 | Fondasi Sprint 2 |
|---|---|---|
| FIFO allocator | Pure Decimal allocation lintas satu atau lebih layer | `InventoryCostLayer` sudah menyimpan original/remaining quantity |
| Valid-layer selector | Filter branch, product, location, batch, status, date, dan remaining quantity | Batch, balance, dan valuation status sudah tersedia |
| Consumption record | Snapshot quantity, unit cost, total cost, dan source layer | Posting/mutation sudah append-only |
| Reversal layer | Restore layer persis sesuai allocation asal | Posting reversal sudah memiliki referensi asal |
| Stock locking | Deterministic row lock dalam interactive transaction | Posting engine dan balance version tersedia |
| Negative prevention | Service invariant dan database constraint | Quantity buckets sudah tersedia |
| Cost result | Total actual cost per posting/product/batch | Posting contract dengan accounting sudah tersedia |
| Concurrency test | Competing issue, duplicate request, reversal, dan multi-product order | PostgreSQL dan Prisma transaction digunakan |

Batas implementasi:

- Sprint ini mengerjakan FIFO berdasarkan waktu penerimaan layer, bukan FEFO berdasarkan expiry date.
- Expired, blocked, future-dated, pending-valuation, dan empty layer tidak valid untuk issue normal.
- Reservation dari stock request baru diintegrasikan pada Sprint 4.
- Shipment/in-transit end-to-end baru diintegrasikan pada Sprint 5.
- Treatment material usage dan HPP journal end-to-end diselesaikan pada Sprint 7-8.
- Payment posting adalah ownership Developer A. Developer B hanya menjaga kontrak lintas ledger dan regression boundary.

---

## 3. Output Integrasi Sprint

| Output | Kondisi Lulus |
|---|---|
| Payment posting aktif | Verifikasi payment yang valid menghasilkan payment record, cash/bank ledger, journal balanced, source link, branch context, audit log, dan hasil idempotent. Owner: Developer A. |
| FIFO benar | Issue mengonsumsi layer valid berdasarkan `receivedAt ASC, id ASC`; hasil quantity dan total cost tepat dengan Decimal. Owner: Developer B. |
| Concurrency aman | Request bersamaan tidak dapat mengonsumsi layer yang sama melebihi remaining quantity dan tidak menghasilkan saldo negatif. |
| Reversal presisi | Reversal mengembalikan quantity ke layer yang sama sesuai allocation asal dan tidak mengubah record posted. |
| Traceability | Source document dapat ditelusuri ke posting, mutation, allocation, cost layer, branch/location/batch, dan calon journal/HPP reference. |
| Boundary bersih | Payment verification tidak membuat inventory mutation; stock issue tidak membuat cash/bank entry. |

---

## 4. Ticket Sprint 3

| ID | Ticket | Scope | Estimasi | Reviewer | Acceptance Criteria |
|---|---|---|---:|---|---|
| B3-01 | Finalisasi valid-layer, lock order, dan schema allocation | DB/API/docs | 0.75 hari | Developer A | Selector rules, tie-breaker, lock order, retry policy, reversal, index, dan migration proposal disetujui migration owner. |
| B3-02 | Implement pure FIFO allocator | Service/unit test | 1.0 hari | Developer A | Allocator memakai Decimal, mendukung split layer, tidak mengubah DB, dan menghasilkan allocation deterministik serta exact total cost. |
| B3-03 | Implement consumption/allocation persistence dan reversal | DB/service/test | 1.25 hari | Developer A | Outbound menyimpan immutable allocation; reversal restore layer asal; satu allocation tidak dapat direverse dua kali. |
| B3-04 | Implement valid-layer selector | DB/service/test | 1.0 hari | Developer A | Hanya layer sesuai scope dan status yang dipilih; urutan `receivedAt, id` stabil; explicit batch dihormati. |
| B3-05 | Implement stock dan layer locking | DB/service/test | 1.5 hari | Developer A | Balance dan layer dikunci dalam satu transaction dengan urutan deterministik; serialization/deadlock conflict diretry terbatas. |
| B3-06 | Implement negative-stock prevention berlapis | DB/service/test | 0.75 hari | Developer A | Validasi available, conditional update, dan DB check constraint mencegah seluruh bucket/layer menjadi negatif. |
| B3-07 | Integrasikan FIFO ke inventory posting engine | API/service/test | 1.0 hari | Developer A | Stock issue atomik membuat posting, mutation, allocation, update balance/layer, dan cost result; error menggagalkan semuanya. |
| B3-08 | Integrasi cost result dan payment-posting boundary | API/test/docs | 0.75 hari | Developer A | Actual cost contract disetujui; payment posting test tidak mengubah stock; inventory issue test tidak mengubah cash/bank. |
| B3-09 | Lengkapi FIFO unit dan integration test | Test | 0.75 hari | Developer A | Happy path, split, tie, invalid layer, precision, insufficient stock, idempotency, dan reversal lulus. |
| B3-10 | Real-DB concurrency, reconciliation, dan regression | Test/docs | 1.25 hari | Developer A | Competing issue, duplicate key, multi-product order, dan double reversal lulus berulang; reconciliation mismatch nol. |

Total estimasi: 10 hari.

---

## 5. Jadwal 10 Hari

| Hari | Fokus | Output harian |
|---:|---|---|
| 1 | Review contract, valid-layer rules, lock order, dan migration proposal | Technical contract disetujui |
| 2 | Pure FIFO allocator dan unit test | Allocation deterministik |
| 3 | Consumption record dan cost calculation | Allocation persisted |
| 4 | Valid-layer query dan batch/status rules | Selector siap integration |
| 5 | PostgreSQL row locking dan transaction retry | Competing issue aman |
| 6 | Negative constraint dan posting-engine integration | Issue atomik siap review |
| 7 | Reversal layer dan double-reversal prevention | Restore layer presisi |
| 8 | Integrasi contract dengan Developer A dan payment boundary test | Dua vertical slice terintegrasi |
| 9 | Concurrency suite, reconciliation, dan regression | Quality gate hijau |
| 10 | Demo, dokumentasi operasional, dan retrospective | Sprint 3 sign-off |

---

## 6. Definisi Valid Cost Layer

Sebuah layer hanya boleh dipakai untuk issue normal jika seluruh kondisi berikut benar:

```text
layer.branchId == command.branchId
layer.masterProductId == command.masterProductId
layer.stockLocationId berada pada consumption scope
layer.remainingQty > 0
layer.unitCost != null
layer.valuationStatus == VALUED
layer.receivedAt <= command.occurredAt
batch sesuai explicit batch request, bila diberikan
batch tidak blocked
batch belum expired pada occurredAt
layer belum dibatalkan/reversed
```

Urutan FIFO wajib stabil:

```text
ORDER BY receivedAt ASC, id ASC
```

Aturan tambahan:

- Layer dengan timestamp sama memakai `id` sebagai tie-breaker agar test dan retry memberi hasil identik.
- Layer `PENDING_VALUATION` tidak boleh diasumsikan memiliki harga nol.
- Layer dari branch atau product lain selalu ditolak meskipun ID dikirim client.
- Untuk product batch-managed, selector wajib mempertahankan batch traceability.
- Override expired/blocked stock bukan bagian endpoint issue normal dan memerlukan workflow adjustment khusus pada sprint berikutnya.
- Scope location harus ditentukan oleh source flow. FIFO tidak boleh diam-diam mengambil stok dari warehouse/location lain.

Error selector minimum:

| Code | Kondisi |
|---|---|
| `INSUFFICIENT_AVAILABLE_STOCK` | Physical available quantity tidak cukup |
| `INSUFFICIENT_VALUED_STOCK` | Quantity fisik ada tetapi valid valued layer tidak cukup |
| `NO_VALID_FIFO_LAYER` | Tidak ada layer yang memenuhi selector |
| `BATCH_REQUIRED` | Product wajib batch tetapi batch context tidak tersedia |
| `BATCH_BLOCKED` | Batch target diblokir |
| `BATCH_EXPIRED` | Batch target expired pada transaction date |
| `LAYER_SCOPE_MISMATCH` | Layer tidak sesuai branch/product/location |

---

## 7. FIFO Allocation Algorithm

Allocator dibuat sebagai fungsi murni agar mudah diuji dan tidak bergantung pada Prisma.

```ts
type FifoLayerInput = {
  id: string;
  receivedAt: string;
  remainingQty: Decimal;
  unitCost: Decimal;
};

type FifoAllocation = {
  layerId: string;
  quantity: Decimal;
  unitCost: Decimal;
  totalCost: Decimal;
};

function allocateFifo(
  requestedQty: Decimal,
  orderedLayers: FifoLayerInput[]
): FifoAllocation[] {
  // Validate positive request, consume oldest valid layer first,
  // and fail the complete request when total valid quantity is insufficient.
}
```

Pseudocode:

```text
assert requestedQty > 0
remainingRequest = requestedQty
allocations = []

for layer in orderedLayers:
  if remainingRequest == 0: break
  allocated = min(layer.remainingQty, remainingRequest)
  allocations.add(layer.id, allocated, layer.unitCost, allocated * layer.unitCost)
  remainingRequest -= allocated

if remainingRequest > 0:
  fail entire operation with INSUFFICIENT_VALUED_STOCK

return allocations
```

Contoh acceptance:

| Layer | Received | Remaining | Unit cost | Alokasi untuk issue 7 |
|---|---|---:|---:|---:|
| L1 | 1 Juli | 4 | 100 | 4 |
| L2 | 2 Juli | 6 | 110 | 3 |
| L3 | 3 Juli | 5 | 120 | 0 |

Hasil yang wajib:

```text
allocated quantity = 7
actual cost = (4 x 100) + (3 x 110) = 730
L1 remaining = 0
L2 remaining = 3
L3 remaining = 5
```

Semua operasi memakai `Prisma.Decimal` atau library Decimal yang sudah dipakai project. Dilarang mengubah quantity/cost menjadi JavaScript `number` selama perhitungan ledger.

---

## 8. Consumption dan Reversal Model

Proposal additive untuk migration owner Developer A:

```prisma
enum CostAllocationType {
  CONSUMPTION
  REVERSAL
}

model InventoryCostAllocation {
  id              String             @id @default(cuid())
  postingId       String
  stockMutationId String
  costLayerId     String
  type            CostAllocationType @default(CONSUMPTION)
  quantity        Decimal            @db.Decimal(18, 4)
  unitCost        Decimal            @db.Decimal(18, 4)
  totalCost       Decimal            @db.Decimal(18, 4)
  reversalOfId    String?            @unique
  createdAt       DateTime           @default(now())

  @@unique([postingId, stockMutationId, costLayerId, type])
  @@index([costLayerId, createdAt])
  @@index([stockMutationId])
}
```

Aturan consumption:

1. Allocation menyimpan snapshot `unitCost`; perubahan metadata source tidak mengubah historical cost.
2. Sum allocation quantity per outbound mutation harus sama dengan absolute issued quantity.
3. Sum allocation total cost menjadi `actualInventoryCost` posting.
4. Allocation posted tidak dapat diedit atau dihapus.
5. Satu outbound posting dapat mengambil beberapa layer, tetapi satu transaction harus berhasil atau gagal seluruhnya.

Aturan reversal:

1. Baca allocation posting asal, bukan menjalankan FIFO selector lagi.
2. Lock balance dan seluruh layer asal dengan urutan deterministik.
3. Tambahkan kembali `remainingQty` ke layer yang sama.
4. Buat allocation bertipe `REVERSAL` yang menunjuk allocation asal.
5. Buat quantity mutation kebalikan dan posting reversal terpisah.
6. Unique reversal reference dan idempotency key mencegah double reversal.
7. Total reversal cost harus sama dengan actual cost posting asal untuk quantity yang dibalik.

Partial reversal hanya boleh diaktifkan jika source-document contract mendukungnya. Default Sprint 3 adalah full reversal agar jejak dan invariant lebih sederhana.

---

## 9. Stock Locking Strategy

Masalah kode lama yang harus ditutup:

```text
read stock -> hitung stockAfter -> cek negatif -> update stock
```

Dua request dapat membaca saldo yang sama sebelum salah satunya commit. Pengecekan di aplikasi saja tidak cukup.

Strategi transaction:

1. Mulai Prisma interactive transaction dengan isolation `Serializable` bila kompatibel dengan seluruh flow.
2. Validasi idempotency record di dalam transaction.
3. Bentuk daftar balance key dan urutkan secara deterministik.
4. Lock seluruh `InventoryBalance` target memakai PostgreSQL `SELECT ... FOR UPDATE`.
5. Query dan lock valid cost layer memakai `ORDER BY received_at, id FOR UPDATE`.
6. Hitung ulang available quantity dan FIFO allocation setelah lock diperoleh.
7. Update balance serta layer dengan conditional predicate yang menolak nilai negatif.
8. Simpan posting, mutation, allocation, dan compatibility mirror dalam transaction yang sama.
9. Commit, lalu kembalikan result yang sudah tersimpan.

Urutan lock global:

```text
branchId -> masterProductId -> warehouseId -> stockLocationId -> batchId/balanceId
balance lebih dahulu -> cost layer berdasarkan receivedAt,id
```

Retry policy:

- Retry hanya untuk serialization failure/deadlock yang dikenali, misalnya PostgreSQL `40001`, `40P01`, atau Prisma conflict terkait.
- Maksimal 3 percobaan dengan bounded jitter.
- Business error seperti insufficient stock, invalid batch, atau permission denied tidak diretry.
- Semua retry memakai idempotency key yang sama.
- Setelah retry habis, kembalikan `INVENTORY_CONCURRENCY_CONFLICT`; jangan melakukan fallback write tanpa lock.

Contoh struktur service:

```ts
await prisma.$transaction(
  async (tx) => {
    await lockBalancesInStableOrder(tx, balanceKeys);
    const layers = await selectAndLockValidLayers(tx, selector);
    const allocations = allocateFifo(requestedQty, layers);
    return persistIssueAtomically(tx, command, allocations);
  },
  { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
);
```

Raw SQL harus memakai parameter binding. ID atau filter dari request tidak boleh dirangkai langsung ke string SQL.

---

## 10. Negative-Stock Prevention

Pencegahan dibuat berlapis:

### Service invariant

```text
availableQty >= requestedQty
onHandQty - issueQty >= 0
reservedQty >= 0
quarantineQty >= 0
inTransitQty >= 0
remainingLayerQty - allocationQty >= 0
```

### Conditional update

Update layer/balance hanya berhasil jika quantity saat ini masih mencukupi. Affected row count yang tidak sesuai dianggap concurrency conflict dan seluruh transaction di-rollback.

### Database check constraint

Migration proposal minimal:

```sql
CHECK (on_hand_qty >= 0)
CHECK (reserved_qty >= 0)
CHECK (quarantine_qty >= 0)
CHECK (in_transit_qty >= 0)
CHECK (reserved_qty + quarantine_qty <= on_hand_qty)
CHECK (remaining_qty >= 0)
CHECK (remaining_qty <= original_qty)
```

### Reconciliation invariant

```text
balance per bucket = opening mutation + sum mutation delta
valued outbound quantity = sum consumption allocation quantity
costed outbound value = sum allocation total cost
layer remaining = original + inbound correction - consumption + reversal
```

Database constraint bukan pengganti transaction lock. Ketiga lapisan wajib aktif karena masing-masing melindungi failure mode yang berbeda.

---

## 11. Cost Result Contract dengan Accounting

Developer B menghasilkan cost result berikut setelah issue berhasil:

```ts
type InventoryCostedResult = {
  inventoryPostingId: string;
  sourceType: string;
  sourceId: string;
  branchId: string;
  costCenterId?: string;
  occurredAt: string;
  quantity: string;
  actualInventoryCost: string;
  currency: "IDR";
  allocations: Array<{
    costLayerId: string;
    batchId?: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
  }>;
};
```

Kontrak integrasi:

- Developer B bertanggung jawab atas `actualInventoryCost` dan allocation trace.
- Developer A bertanggung jawab atas account mapping dan journal debit/credit.
- Accounting menyimpan source link ke `inventoryPostingId`; inventory tidak mengirim account code.
- Retry source event yang sama tidak boleh menghasilkan cost result atau journal ganda.
- Reversal menghasilkan nilai kebalikan dan referensi posting asal.
- Event reserve/release tidak memiliki inventory cost dan tidak membentuk journal.

---

## 12. Boundary dengan Payment Posting Developer A

| Event | Payment/Cash Ledger | Journal | Inventory/FIFO |
|---|---|---|---|
| Payment proof diunggah | Tidak | Tidak | Tidak |
| Payment ditolak | Tidak | Tidak | Tidak |
| Payment diverifikasi | Ya | Ya, balanced dan idempotent | Tidak |
| Stock issue | Tidak | Sesuai posting policy source | Ya |
| Stock issue reversal | Tidak | Reversal bila journal sudah dibuat | Restore allocation |

Quality gate bersama:

- Payment verification menghasilkan satu cash/bank posting dan satu balanced journal untuk satu idempotency key.
- Partial/full payment menghitung outstanding dengan Decimal dan mencegah overpayment sesuai policy Developer A.
- Payment journal memiliki branch dan source-document link.
- Payment retry atau double click tidak membentuk payment/journal ganda.
- Test payment menegaskan jumlah inventory posting tidak berubah.
- Test FIFO menegaskan jumlah payment/cash posting tidak berubah.
- Contract test menggunakan source identity dan branch context yang konsisten dari Sprint 2.

Catatan review untuk Developer A: service payment lama masih memiliki perhitungan berbasis `Number` dan beberapa write terpisah. Refactor payment transaction tetap berada di ownership Developer A, tetapi menjadi dependency quality gate Sprint 3.

---

## 13. Test Plan

### FIFO Unit Test

- Satu layer memenuhi seluruh request.
- Request terbagi ke dua atau lebih layer.
- Layer dengan `remainingQty=0` dilewati.
- Layer pending valuation, blocked, expired, future-dated, beda branch/product/location, atau cancelled dilewati/ditolak.
- Explicit batch hanya memilih layer batch tersebut.
- Timestamp sama memakai `id` sebagai tie-breaker.
- Quantity pecahan seperti `0.3333` dan unit cost desimal dihitung tanpa floating-point drift.
- Total valid layer kurang dari request menggagalkan seluruh allocation.
- Actual cost sama dengan sum `quantity * unitCost` setiap allocation.
- Input layer tidak dimutasi oleh pure allocator.

### Integration Test

- Issue membuat posting, stock mutation, cost allocation, balance update, dan layer update secara atomik.
- Failure saat menyimpan satu allocation me-rollback seluruh perubahan.
- Duplicate idempotency key dengan payload sama mengembalikan posting awal.
- Duplicate key dengan payload berbeda menghasilkan `IDEMPOTENCY_CONFLICT`.
- Reversal mengembalikan layer asal dan membuat record kompensasi.
- Double reversal ditolak.
- Reconciliation quantity dan cost menghasilkan mismatch nol.
- Branch scope dan permission diterapkan sebelum lock/write.

### Real PostgreSQL Concurrency Test

Concurrency test tidak boleh hanya memock Prisma transaction.

| Skenario | Setup | Hasil wajib |
|---|---|---|
| Competing unit issue | Available 10; 20 worker issue 1 | Tepat 10 sukses, 10 insufficient/conflict; final 0; tidak negatif |
| Competing large issue | Available 10; dua worker issue 7 | Tepat satu sukses; final 3; allocation total 7 |
| Duplicate request | Dua worker memakai key dan payload sama | Satu posting; kedua caller menerima identity hasil yang sama |
| Duplicate conflict | Dua payload berbeda memakai key sama | Satu posting; satu `IDEMPOTENCY_CONFLICT` |
| Multi-product inverse order | Dua worker meminta product A/B dengan input order terbalik | Service mengurutkan lock; tidak deadlock permanen |
| Double reversal | Dua worker reverse posting yang sama | Tepat satu reversal; layer restore satu kali |
| Layer boundary | Dua worker menarget layer tertua yang sama | Remaining layer tidak negatif dan allocation tidak melebihi original quantity |

Suite concurrency dijalankan berulang, minimal 20 iterasi pada CI/staging database terisolasi, untuk meningkatkan peluang menangkap race condition.

### Regression

- Payment flow E2E lulus dan tidak membuat stock mutation.
- Inventory list, stock card, shipment receive, material usage, dan homecare tetap dapat membaca saldo.
- Compatibility mirror sama dengan agregat balance baru.
- Export stock mutation menampilkan source dan actual cost sesuai permission.

Command baseline:

```bash
npm run type-check:all
npm run build:api
npm run build:web
npm --prefix apps/api test -- --runInBand
npm --prefix apps/web test -- --runInBand
npm --prefix apps/web run e2e -- e2e/flows/payment-flow.spec.ts
npm --prefix apps/web run e2e -- e2e/critical/inventory-flow.spec.ts
```

Tambahkan script khusus yang menggunakan database test terisolasi, misalnya:

```bash
npm --prefix apps/api run test:inventory-concurrency
```

Test dianggap gagal bila dilewati karena database tidak tersedia. CI wajib menyiapkan PostgreSQL test dan membersihkan data berdasarkan run ID, bukan memakai database development bersama.

---

## 14. Audit, Observability, dan Operasional

Audit wajib:

- stock issue dan reversal berhasil;
- issue ditolak karena insufficient/invalid layer;
- exhausted concurrency retry;
- override atau usaha memakai blocked/expired layer;
- mismatch reconciliation;
- usaha update/delete allocation atau layer history yang immutable.

Metric minimum:

| Metric | Tujuan |
|---|---|
| `inventory_fifo_allocation_duration_ms` | Memantau waktu selector dan allocation |
| `inventory_lock_wait_duration_ms` | Menemukan contention |
| `inventory_transaction_retry_total` | Memantau serialization/deadlock retry |
| `inventory_negative_stock_rejected_total` | Memantau insufficient stock |
| `inventory_reconciliation_mismatch_total` | Menjaga integritas ledger |
| `inventory_fifo_layers_per_issue` | Menemukan fragmentation layer berlebih |

Log terstruktur minimal berisi correlation ID, idempotency key hash/reference aman, posting ID, source type/ID, branch, product count, retry count, dan result code. Jangan mencatat payment proof URL bertanda tangan atau data sensitif ke log inventory.

---

## 15. Definition of Done Sprint 3

Sprint 3 Developer B selesai jika:

- FIFO memilih valid layer menggunakan `receivedAt ASC, id ASC` secara konsisten.
- Issue lintas layer menghasilkan exact quantity dan actual cost berbasis Decimal.
- Balance dan cost layer dikunci serta diperbarui dalam satu DB transaction.
- Negative stock dan negative remaining layer dicegah oleh service, conditional update, dan DB constraint.
- Consumption allocation immutable dan dapat ditelusuri hingga mutation/source document.
- Reversal mengembalikan layer asal satu kali tanpa menjalankan ulang FIFO.
- Duplicate posting dan concurrent issue tidak menghasilkan saldo, layer, atau allocation ganda.
- Unit, integration, dan real-PostgreSQL concurrency test lulus.
- Reconciliation quantity/value menghasilkan mismatch nol.
- Cost result contract dengan Developer A disetujui dan source link dua arah tersedia.
- Payment posting Developer A lulus journal/idempotency test dan tidak mengubah inventory.
- FIFO flow tidak mengubah cash/bank ledger.
- Migration additive direview dan dijalankan oleh Developer A sebagai migration owner.
- Audit, metric, runbook retry, dan troubleshooting lock tersedia.

---

## 16. Demo Scenario

1. Tersedia tiga cost layer valid: 4 unit @100, 6 unit @110, dan 5 unit @120.
2. User mem-posting issue 7 unit.
3. Sistem mengalokasikan 4 unit dari layer pertama dan 3 unit dari layer kedua dengan actual cost 730.
4. Stock card menunjukkan mutation, dua allocation, batch, source, dan running balance.
5. Dua puluh request bersamaan mencoba menghabiskan saldo 10 unit; hanya 10 unit total yang berhasil dikonsumsi.
6. Retry dengan idempotency key yang sama tidak membuat posting atau allocation baru.
7. Reversal mengembalikan 4 dan 3 unit ke layer asal; reversal kedua ditolak.
8. Reconciliation menunjukkan saldo, mutation, allocation, dan layer cocok.
9. Developer A memverifikasi payment dan menunjukkan cash/bank ledger serta balanced journal tanpa inventory mutation.

---

## 17. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Writer lama masih memakai pola read-calculate-update | Race condition tetap terbuka | Inventarisasi dan refactor seluruh direct stock writer ke posting engine sebelum gate Sprint 3 |
| Lock diambil dengan urutan berbeda | Deadlock saat multi-product issue | Sort balance key global dan layer `receivedAt,id`; test inverse input order |
| Retry membungkus business error | Request berulang sia-sia atau duplicate effect | Retry hanya SQL serialization/deadlock code yang dikenal dan pertahankan idempotency key |
| Layer fisik cukup tetapi valuation pending | Issue tidak bisa dihitung biayanya | Gunakan error khusus dan selesaikan data valuation, jangan memakai cost nol |
| Expiry disalahartikan sebagai FEFO | Hasil tidak sesuai kontrak FIFO | Selector mengecualikan expired, lalu mengurutkan layer valid berdasarkan received time |
| Reversal menjalankan FIFO ulang | Quantity kembali ke layer yang salah | Reversal wajib membaca allocation asal dan membuat compensating allocation |
| Raw SQL lock tidak parameterized | SQL injection atau lock target salah | Gunakan parameter binding dan helper lock yang teruji |
| Concurrency test memakai mock | Race condition produksi tidak terdeteksi | Jalankan suite terhadap PostgreSQL test nyata dan ulangi skenario |
| Migration allocation bentrok dengan schema payment Developer A | Merge conflict atau migration order rusak | Developer B kirim proposal; Developer A menggabungkan dan menjadi migration owner |
| Payment posting dan FIFO dianggap satu business event | Boundary domain kabur | Buat contract test bahwa payment tidak mengubah stok dan issue tidak mengubah cash/bank |
