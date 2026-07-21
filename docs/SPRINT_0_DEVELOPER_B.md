# Sprint 0 Developer B - Inventory & Operations

**Versi:** 1.0  
**Tanggal rencana:** 21 Juli 2026  
**Durasi:** 2 minggu / 10 hari kerja  
**Owner:** Developer B  
**Reviewer utama:** Developer A  
**Sumber:** `docs/DEVELOPMENT_UPDATE_PLAN_2_DEVELOPERS.md`

Sprint 0 untuk Developer B berfokus pada audit sistem inventory dan operasional yang sudah ada, penetapan baseline kualitas, serta penyusunan kontrak data/API sebelum modul batch, FIFO, reservation, shipment, homecare, BOM, dan logistics report dikembangkan lebih jauh.

> Gate penting: jangan membuat migration besar sebelum ERD target, strategi data lama, daftar breaking change, dan kontrak event lintas finance-inventory disetujui bersama Developer A.

---

## 1. Tujuan Sprint

1. Mengklasifikasikan fitur inventory/operations lama sebagai `REUSE`, `REFACTOR`, `REPLACE`, atau `NEW`.
2. Mendokumentasikan gap P0 terhadap SRS untuk product/UOM, inventory ledger, FIFO, stock request, shipment, discrepancy, adjustment, opname, treatment usage, homecare, evidence, notification, dan logistics report.
3. Menetapkan baseline build, type-check, unit test, dan E2E inventory.
4. Menyusun target ERD inventory dan logistics tanpa langsung menjalankan migration besar.
5. Menyepakati kontrak event dengan Developer A untuk posting jurnal, HPP, persediaan in-transit, adjustment, opname, dan treatment completion.
6. Menyiapkan backlog Sprint 1 dan Sprint 2 untuk area Developer B.

---

## 2. Scope Audit Repository

### Backend

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/inventory`
- `apps/api/src/modules/sessions/services/material-usage.service.ts`
- `apps/api/src/modules/files`
- `apps/api/src/modules/dashboard`
- `apps/api/src/utils/auditLog.ts`
- `apps/api/src/middleware/authorize.ts`
- `apps/api/src/middleware/assertBranchAccess.ts`

### Frontend

- `apps/web/src/lib/api/inventoryApi.ts`
- `apps/web/src/app/(staff)/inventory`
- `apps/web/src/components/inventory`
- `apps/web/src/app/(staff)/sessions`
- `apps/web/src/components/sessions/Step6Materials.tsx`
- `apps/web/src/app/(staff)/notifications`
- `apps/web/src/app/(staff)/reports`

### Test

- `apps/api/src/modules/inventory/services/__tests__`
- `apps/api/src/modules/sessions/**/__tests__`
- `apps/web/e2e/critical/inventory-flow.spec.ts`
- `apps/web/e2e/pages/InventoryPage.ts`
- `apps/web/e2e/flows/notifications.spec.ts`
- `apps/web/e2e/flows/reports.spec.ts`

---

## 3. Output Sprint 0

| Output | Format | Owner |
|---|---|---|
| Gap matrix inventory & operations | Markdown/table backlog | Developer B |
| Daftar fitur `REUSE/REFACTOR/REPLACE/NEW` | Markdown/table backlog | Developer B |
| Baseline test/build | Log ringkasan command dan status | Developer B |
| Target ERD inventory/logistics | Mermaid/diagram + catatan relasi | Developer B |
| Kontrak event stok ke finance | Markdown bersama Developer A | Developer B + Developer A |
| API convention inventory | Markdown endpoint/status/error/idempotency | Developer B |
| Migration risk register | Markdown/table | Developer B |
| Backlog Sprint 1-2 Developer B | Ticket-ready list | Developer B |

---

## 4. Ticket Sprint 0

| ID | Ticket | Scope | Estimasi | Reviewer | Acceptance Criteria |
|---|---|---|---:|---|---|
| B0-01 | Audit schema product, UOM, inventory item, mutation, stock request, shipment, discrepancy, homecare, dan notification | DB/docs | 1.0 hari | Developer A | Semua model terkait dipetakan ke requirement; gap batch, expiry, warehouse, location, reservation, FIFO, cost layer, valuation, dan source document dicatat. |
| B0-02 | Audit inventory API, service boundary, permission, dan branch scope | API/docs | 1.0 hari | Developer A | Semua endpoint inventory punya catatan role, branch scope, state transition, audit log, dan risiko horizontal access. |
| B0-03 | Audit stock request, shipment, receiving, overstock, dan discrepancy | API/UI/docs | 1.0 hari | Developer A | Flow aktual tergambar dari request sampai receiving; gap partial approval, partial receiving, in-transit, quarantine, idempotency, dan double processing dicatat. |
| B0-04 | Audit homecare team, bag, request, shipment, usage, return, dan opname | API/UI/docs | 1.0 hari | Developer A | Flow homecare terpetakan; gap stock locking, evidence, opname finalization, adjustment, dan branch/team scope dicatat. |
| B0-05 | Audit material usage dan kesiapan BOM treatment | API/UI/docs | 0.75 hari | Developer A | Semua pemakaian material dari treatment dipetakan; gap BOM versioning, actual usage, deviation reason, FIFO, HPP, dan atomic completion dicatat. |
| B0-06 | Audit evidence, notification, audit log, dan protected file untuk operations | API/UI/docs | 0.75 hari | Developer A | Semua upload/bukti/foto operasional dicatat; kebutuhan signed URL, permission, dan retention policy diidentifikasi. |
| B0-07 | Jalankan baseline type-check, build, unit test, dan inventory E2E | Test/docs | 1.0 hari | Developer A | Command, hasil, failing/skipped/fixme test, dan rekomendasi test yang harus dihidupkan kembali terdokumentasi. |
| B0-08 | Susun target ERD inventory/logistics | DB/docs | 1.0 hari | Developer A | ERD target berisi minimal product/UOM, warehouse/location, batch, inventory balance, stock ledger, cost layer, reservation, shipment, discrepancy, homecare, dan source references. |
| B0-09 | Susun kontrak event dengan Developer A | Integration/docs | 1.0 hari | Developer A | Event dan payload minimum untuk receipt, shipment, adjustment, opname, treatment completed, dan reversal disetujui. |
| B0-10 | Finalisasi backlog Sprint 1-2 Developer B | Planning/docs | 0.75 hari | Developer A | Ticket Sprint 1 dan Sprint 2 siap masuk backlog dengan DoR, dependency, risk, dan estimate. |

Total estimasi: 9.25 hari. Sisa 0.75 hari dipakai untuk buffer, review, dan demo Sprint 0.

---

## 5. Jadwal 10 Hari

| Hari | Fokus | Output harian |
|---:|---|---|
| 1 | Kickoff, baca SRS/plan, petakan modul repo, sepakati format gap matrix | Daftar area audit dan template gap matrix |
| 2 | Audit Prisma schema inventory dan data lama | Draft mapping model + gap data |
| 3 | Audit inventory item, stock mutation, master product, UOM, dan branch scope | Catatan `REUSE/REFACTOR/REPLACE/NEW` awal |
| 4 | Audit stock request, approval, shipment, receiving, discrepancy, overstock | Diagram flow aktual dan gap AC-004/AC-006 |
| 5 | Audit homecare bag logistics | Diagram flow homecare dan gap opname/usage/return |
| 6 | Audit material usage, treatment integration, BOM readiness, notification/evidence | Gap BOM/FIFO/HPP/evidence |
| 7 | Jalankan baseline quality gate | Ringkasan type-check, build, unit test, dan E2E |
| 8 | Desain ERD target dan kontrak stock event | Draft ERD + event contract |
| 9 | Review lintas domain dengan Developer A | Keputusan integration dan breaking change |
| 10 | Finalisasi dokumen, backlog, demo Sprint 0 | Sign-off gate Sprint 0 |

---

## 6. Baseline Command

Jalankan dari root repo:

```bash
npm run type-check:all
npm run build:api
npm run build:web
npm --prefix apps/api test -- --runInBand
npm --prefix apps/web test -- --runInBand
npm --prefix apps/web run e2e -- e2e/critical/inventory-flow.spec.ts
```

Catat hasil dalam format berikut:

| Command | Status | Durasi | Catatan |
|---|---|---:|---|
| `npm run type-check:all` | PASS/FAIL |  |  |
| `npm run build:api` | PASS/FAIL |  |  |
| `npm run build:web` | PASS/FAIL |  |  |
| `npm --prefix apps/api test -- --runInBand` | PASS/FAIL |  |  |
| `npm --prefix apps/web test -- --runInBand` | PASS/FAIL |  |  |
| `npm --prefix apps/web run e2e -- e2e/critical/inventory-flow.spec.ts` | PASS/FAIL |  | Catat test aktif, `fixme`, dan flaky. |

---

## 7. Gap Matrix Template

| Area | Kondisi Saat Ini | Target MVP | Status | Risk | Keputusan Sprint 0 | Ticket Lanjutan |
|---|---|---|---|---|---|---|
| Product/UOM |  | Product, category, UOM, conversion, batch/expiry flags | REUSE/REFACTOR/REPLACE/NEW | Low/Med/High |  |  |
| Inventory balance |  | Balance per branch/warehouse/location/batch |  |  |  |  |
| Stock mutation/ledger |  | Immutable stock ledger dengan source document |  |  |  |  |
| FIFO cost layer |  | Cost layer auditable dan consumption FIFO |  |  |  |  |
| Reservation |  | Reserved/available/on-hand quantity |  |  |  |  |
| Shipment/receiving |  | In-transit, partial receiving, discrepancy/quarantine |  |  |  |  |
| Adjustment/opname |  | Approval, reason code, stock and journal event |  |  |  |  |
| Treatment usage/BOM |  | BOM version, actual usage, deviation reason, FIFO |  |  |  |  |
| Homecare bag |  | Request, shipment, usage, return, opname, audit trail |  |  |  |  |
| Evidence/file |  | Protected signed URL, branch scope, audit |  |  |  |  |
| Notification |  | Event-based notification for operations |  |  |  |  |
| Logistics report |  | Stock card, valuation, usage, shipment/opname metrics |  |  |  |  |

---

## 8. Target ERD Awal yang Perlu Diputuskan

Minimal ERD target Developer B harus menjawab kebutuhan model berikut:

| Model/konsep | Tujuan | Keputusan yang Dibutuhkan |
|---|---|---|
| `Product` / `MasterProduct` | Master barang dan snapshot SKU/nama | Reuse model lama atau pecah product vs variant |
| `Uom` / `UnitConversion` | Konversi storage unit dan usage unit | Tetap field sederhana atau jadikan tabel UOM |
| `Warehouse` | Gudang pusat/cabang | Apakah cabang selalu punya default warehouse |
| `StockLocation` | Rak/lokasi di warehouse/bag | Wajib untuk MVP atau opsional |
| `InventoryBatch` | Batch, expiry, lot number | Required untuk semua barang atau flag per product |
| `InventoryBalance` | On-hand, reserved, available per product/location/batch | Apakah menggantikan `InventoryItem.stock` |
| `StockLedger` | Mutasi immutable berbasis source document | Apakah menggantikan atau memperluas `StockMutation` |
| `CostLayer` | FIFO valuation dan HPP | Sumber unit cost dari opening balance/GR |
| `StockReservation` | Lock stok untuk request/treatment/shipment | Expiry reservation dan release policy |
| `ShipmentInTransit` | Nilai dan qty transfer internal | Kapan stok keluar/masuk diakui |
| `Discrepancy/Quarantine` | Selisih kirim-terima | Policy resolusi dan jurnal |
| `HomecareBagBalance` | Stok dalam tas homecare | Apakah memakai ledger sama atau ledger logistics terpisah |
| `OperationEvidence` | Foto/bukti protected | Relasi generic ke source document |

---

## 9. Kontrak Event dengan Developer A

Event minimal yang harus disepakati pada Sprint 0:

| Event | Pemicu | Owner data stok | Dampak finance | Idempotency key |
|---|---|---|---|---|
| `GOODS_RECEIPT_POSTED` | Barang supplier diterima | Developer B | Inventory asset/AP atau GRNI | `goods_receipt:{id}` |
| `INTERNAL_TRANSFER_SHIPPED` | Barang dikirim antar lokasi | Developer B | Inventory in-transit policy | `shipment:{id}:ship` |
| `INTERNAL_TRANSFER_RECEIVED` | Barang diterima cabang | Developer B | Clear in-transit/discrepancy | `shipment:{id}:receive` |
| `STOCK_ADJUSTMENT_POSTED` | Adjustment disetujui | Developer B | Gain/loss/expense account | `adjustment:{id}:post` |
| `OPNAME_FINALIZED` | Opname final | Developer B | Adjustment journal | `opname:{id}:finalize` |
| `TREATMENT_MATERIAL_CONSUMED` | Treatment selesai | Developer B | HPP journal | `treatment:{id}:materials` |
| `INVENTORY_REVERSAL_POSTED` | Koreksi transaksi posted | Developer B | Reversal journal | `source:{id}:reversal:{id}` |

Payload minimum setiap event:

```ts
type InventoryPostingEvent = {
  eventId: string;
  eventType: string;
  sourceType: string;
  sourceId: string;
  branchId: string;
  occurredAt: string;
  idempotencyKey: string;
  lines: Array<{
    productId: string;
    batchId?: string;
    locationId?: string;
    quantity: string;
    unit: string;
    unitCost?: string;
    totalCost?: string;
    movementReason: string;
  }>;
};
```

---

## 10. Keputusan yang Harus Dibawa ke Review Sprint 0

1. Apakah `InventoryItem.stock` tetap dipakai sebagai cache balance atau diganti oleh `InventoryBalance`.
2. Apakah `StockMutation` cukup diperluas menjadi immutable stock ledger atau perlu model baru.
3. Apakah semua produk wajib batch/expiry atau hanya produk dengan flag tertentu.
4. Apakah UOM tetap field `baseUnit`, `usageUnit`, `conversionFactor` atau dibuat master UOM.
5. Apakah transfer internal memakai akun inventory in-transit pada MVP.
6. Bagaimana partial receiving dan discrepancy mempengaruhi stock dan jurnal.
7. Apakah negative stock override dilarang total atau hanya role/lokasi tertentu.
8. Bagaimana stock reservation dibuat, dipakai, kedaluwarsa, dan direlease.
9. Bagaimana homecare bag masuk ke ledger utama agar stock card tetap utuh.
10. Data historis mana yang dimigrasikan: full mutation history atau opening balance saja.

---

## 11. Definition of Done Sprint 0

Sprint 0 Developer B selesai jika:

- Semua area scope audit punya status `REUSE`, `REFACTOR`, `REPLACE`, atau `NEW`.
- Gap matrix inventory/operations sudah direview Developer A.
- Baseline command dijalankan dan hasilnya terdokumentasi.
- Test inventory yang `fixme` atau gagal sudah dicatat dengan rekomendasi tindak lanjut.
- Target ERD inventory/logistics disetujui sebagai dasar proposal migration.
- Kontrak event stok-ke-finance disepakati minimal untuk Sprint 2-5.
- Daftar breaking change dan strategi data lama sudah jelas.
- Backlog Sprint 1 dan Sprint 2 Developer B sudah memenuhi Definition of Ready.

---

## 12. Backlog Awal Setelah Sprint 0

Ticket yang kemungkinan masuk Sprint 1:

- B1-01 Master warehouse dan stock location.
- B1-02 Product/category/UOM/unit conversion final.
- B1-03 Batch/expiry flags di product.
- B1-04 Branch inventory UI/API alignment.
- B1-05 Server-side branch scope hardening untuk inventory.

Ticket yang kemungkinan masuk Sprint 2:

- B2-01 Inventory balance per branch/location/batch.
- B2-02 Immutable stock ledger/source document.
- B2-03 Cost layer schema dan opening layer.
- B2-04 Quantity buckets: on-hand, reserved, available, in-transit.
- B2-05 Movement reason dan reference policy.
- B2-06 Unit/integration test inventory ledger.
