# Requirements Finance dan Logistik RAHO–Zoho Books

Status: baseline requirement untuk development  
Versi: 1.1  
Tanggal: 28 Juli 2026  
Target awal: Zoho Books tanpa Zoho Inventory

## 1. Tujuan

Membangun integrasi yang:

- mempertahankan RAHO sebagai sumber utama proses operasional;
- menjadikan Zoho Books sebagai ledger/laporan finansial eksternal;
- mengirim transaksi tanpa menghambat operasi RAHO;
- tidak membuat dokumen, omzet, pembayaran, atau stok ganda;
- memisahkan omzet Basic dan Booster secara tegas;
- mencatat omzet Partnership dari penjualan barang pusat, bukan dari keuntungan
  per infus;
- tidak mengirim data klinis ke Zoho.

## 2. Kondisi awal

Sudah tersedia:

- OAuth, pemilihan organisasi, refresh token, dan health check Zoho;
- `ZohoConnection`;
- invoice, payment, expense, purchasing, AP, inventory posting, FIFO, dan
  accounting lokal;
- deferred revenue dan revenue recognition lokal;
- atomic treatment completion;
- `TREATMENT_COMPLETED` integration event versi 2.

Belum selesai:

- mapping seluruh entity RAHO–Zoho;
- outbox worker dan adapter transaksi Zoho;
- reconciliation dan exception dashboard;
- pemilihan sumber omzet Basic/Booster yang eksklusif;
- event versi 3 dengan rincian recognition per service item;
- routing khusus `Branch.type=PARTNERSHIP`;
- role gabungan `FINANCE_LOGISTICS_CONTROLLER`.

## 3. Batas sistem

### 3.1 Sumber utama RAHO

Data berikut tidak dipindahkan kepemilikannya ke Zoho:

- member package, booking, encounter, dan treatment session;
- pemilihan sumber omzet Basic atau Booster;
- Treatment BOM dan material usage;
- batch, expiry, rak/bin, reservation, dan FIFO layer;
- diagnosis, keluhan, catatan medis, tenaga medis, hasil pemeriksaan, dan foto;
- workflow approval, audit, idempotency, retry, dan integration event.

### 3.2 Data yang dikirim ke Zoho Books

- customer dan vendor contact;
- goods item;
- service item Basic dan service item Booster;
- retainer invoice/payment;
- invoice sesi dan aplikasi retainer;
- invoice/payment penjualan biasa;
- expense;
- purchase order, Bill, dan vendor payment;
- Partnership branch sebagai customer, stock request invoice, payment, dan
  shipment sale;
- jurnal terkontrol;
- inventory adjustment yang didukung organisasi;
- data agregat untuk reconciliation.

### 3.3 Di luar scope awal

- memindahkan EMR ke Zoho;
- mengelola batch, expiry, bin, atau reservation di Zoho Books;
- sinkronisasi dua arah yang membolehkan Zoho mengubah transaksi final RAHO;
- Zoho Inventory;
- sinkronisasi payroll.

## 4. Istilah

| Istilah | Arti |
|---|---|
| Basic | Paket utama yang berada pada `Encounter.memberPackageId` |
| Booster | Paket tambahan opsional pada `TreatmentSession.boosterPackageId` |
| Revenue source | Tepat satu paket yang dibebankan ketika sesi selesai |
| Deferred revenue | Uang muka yang belum menjadi omzet |
| Recognition | Pelepasan deferred revenue menjadi omzet |
| Document mode | Invoice sesi + apply retainer di Zoho |
| Journal mode | Jurnal manual sebagai fallback, tanpa invoice sesi |
| Outbox | `IntegrationEvent` yang menunggu diproses worker |
| Partnership sale | Penjualan barang pusat kepada cabang `PARTNERSHIP` |
| Finance Logistics Controller | Role gabungan pengendali Finance, Logistik, dan integrasi Zoho |

## 5. Business requirements

### BR-01 — RAHO sebagai sumber operasi

Transaksi operasional dibuat dan difinalkan di RAHO. Zoho tidak boleh
mengubah status klinis, jumlah pemakaian material, atau pilihan paket.

### BR-02 — Master terapi tidak memposting uang

Create/update PackagePricing Basic atau Booster hanya menyinkronkan service
item. Aktivitas ini tidak boleh:

- mengurangi retainer;
- menambah omzet;
- mengurangi stok;
- membuat journal.

### BR-03 — Uang muka bukan omzet

Pembayaran paket yang sudah verified:

```text
Debit  Kas/Bank
Kredit Deferred Revenue
```

Di Zoho, transaksi direpresentasikan sebagai retainer invoice dan retainer
payment. Pembayaran pending/rejected tidak dikirim.

### BR-04 — Satu sesi, satu sumber omzet

Setiap treatment session harus memilih tepat satu:

```text
BASIC
atau
BOOSTER
```

Tidak boleh kosong dan tidak boleh keduanya.

Validasi:

```text
BASIC   -> revenuePackageId = Encounter.memberPackageId
BOOSTER -> revenuePackageId = TreatmentSession.boosterPackageId
```

Booster tanpa `boosterPackageId` harus ditolak sebelum completion.

### BR-05 — Recognition memakai snapshot

Nilai omzet memakai `PackageBenefitValuation` milik kontrak saat pembelian.
Perubahan harga master sesudah pembelian tidak mengubah recognition kontrak
yang sedang berjalan.

### BR-06 — Completion adalah trigger finansial

Booking, reschedule, dan session in progress tidak memposting revenue.
Recognition hanya terjadi ketika completion berubah menjadi `COMPLETED`.

Untuk sesi Basic:

```text
Deferred Basic turun
Omzet Basic naik
Deferred dan omzet Booster tetap
```

Untuk sesi Booster:

```text
Deferred Booster turun
Omzet Booster naik
Deferred dan omzet Basic tetap
```

### BR-07 — Completion juga mengonsumsi material

Completion:

- mengambil material snapshot;
- mengurangi inventory berdasarkan FIFO;
- mencatat HPP aktual;
- menghitung gross profit;
- membuat integration event.

```text
Debit  HPP Terapi
Kredit Persediaan
```

### BR-08 — Atomic local transaction

Perubahan berikut harus commit atau rollback bersama:

- session status;
- used session paket terpilih;
- RevenueRecognition;
- DeferredRevenueMovement;
- JournalEntry;
- MaterialUsage;
- InventoryPosting/FIFO;
- IntegrationEvent.

### BR-09 — Document mode sebagai default

Ketika completion berhasil, Zoho worker:

1. memilih service item berdasarkan revenue source;
2. membuat invoice sesi sebesar recognition amount;
3. menerapkan retainer paket yang sama;
4. menyimpan semua external ID.

Basic tidak boleh memakai retainer Booster dan sebaliknya.

### BR-10 — Journal mode tidak boleh bersamaan

Journal mode hanya fallback dengan feature flag. Jika document mode sudah
memposting invoice/apply-retainer, baris deferred/revenue dari jurnal lokal
tidak boleh dikirim ke Zoho.

### BR-11 — Cancellation menggunakan reversal

Cancellation completion harus membalik:

- RevenueRecognition dan deferred movement;
- invoice sesi/retainer application atau jurnal;
- HPP dan inventory posting;
- used session paket yang dipilih.

Dokumen asli tidak dihapus.

### BR-12 — Zoho tidak boleh menghambat ERP

Jika Zoho timeout/down:

- transaksi lokal tetap berhasil;
- event tetap `PENDING`;
- worker melakukan retry;
- retry tidak mengulangi posting lokal.

### BR-13 — Data klinis dilarang

Payload keluar ke Zoho tidak boleh mengandung:

- nama atau identitas pasien;
- diagnosis dan keluhan;
- catatan dokter/perawat;
- hasil lab;
- foto;
- detail pelaksanaan klinis.

### BR-14 — Partnership tidak memakai omzet per infus di Zoho

Untuk `Branch.type=PARTNERSHIP`, completion infus tidak boleh membuat invoice
sesi, apply retainer, jurnal revenue infus, atau gross profit per infus pada
Zoho pusat.

RAHO boleh mempertahankan session dan material usage untuk operasional lokal.
Finance consumer dan inventory consumer treatment ke Zoho harus melewati
transaksi Partnership.

### BR-15 — Omzet Partnership berasal dari penjualan barang

Omzet pusat untuk Partnership berasal dari `StockRequestInvoiceItem`, bukan
dari treatment session. Trigger final adalah shipment berstatus `SHIPPED`
setelah invoice/payment memenuhi aturan.

```text
PARTNERSHIP membuat StockRequest
-> Admin Manager review harga dan invoice
-> Payment diverifikasi jika diwajibkan
-> Admin Logistik menyiapkan Shipment
-> Shipment SHIPPED
-> Omzet penjualan barang dan HPP diposting ke Zoho
```

Membuat request saja belum menjadi omzet.

### BR-16 — Partnership adalah customer, bukan location internal

Cabang Partnership dipetakan sebagai customer Zoho. Pengiriman dari pusat ke
Partnership adalah penjualan barang. Pengiriman antara Pusat dan Premier tetap
transfer internal dan tidak membentuk omzet.

### BR-17 — Posting penjualan Partnership

Pada shipment:

```text
Dr Piutang Partnership / Customer Advance
Cr Pendapatan Penjualan Barang Partnership

Dr HPP Penjualan Partnership
Cr Persediaan Pusat
```

Omzet, HPP, dan gross profit direkonsiliasi per stock request invoice/shipment,
bukan per sesi infus.

### BR-18 — Tidak boleh mengurangi persediaan Zoho dua kali

Setelah barang Partnership dijual/dikirim:

- inventory pusat dan HPP Zoho sudah diposting pada shipment;
- pemakaian barang pada infus Partnership tidak boleh kembali mengurangi
  inventory atau menambah HPP pada Zoho pusat;
- konsumsi infus tetap boleh mengurangi stok operasional Partnership di RAHO.

### BR-19 — Discrepancy, return, dan cancellation

Shortage, damage, return, atau pembatalan shipment harus menghasilkan credit
note/reversal atau adjustment yang menunjuk penjualan asli. Dokumen yang sudah
diposting tidak dihapus.

### BR-20 — Role Finance Logistics Controller

Tambahkan role:

```text
FINANCE_LOGISTICS_CONTROLLER
```

Role ini mengendalikan:

- dashboard Finance dan Logistik lintas cabang yang ditugaskan;
- stock request, shipment, discrepancy, opname, adjustment, dan valuation;
- invoice/payment, expense, AP/AR, journal, dan accounting period;
- mapping, event retry, reconciliation, serta exception Zoho;
- laporan Partnership order revenue dan gross profit.

Role tidak mendapat akses ke diagnosis, EMR, foto medis, atau tindakan klinis.

### BR-21 — Segregation of duties role gabungan

Role gabungan tetap dilarang:

- menyetujui transaksi yang dibuatnya sendiri;
- memverifikasi payment yang diunggahnya sendiri;
- memposting adjustment yang dibuatnya sendiri;
- mengubah atau menghapus audit log;
- melihat token Zoho dalam bentuk plaintext.

Tindakan berisiko tinggi membutuhkan second approver atau Super Admin.

## 6. Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Sistem menyediakan mapping Contact customer/vendor |
| FR-02 | Sistem menyediakan mapping goods item dan service item |
| FR-03 | Basic dan Booster mempunyai mapping/external key berbeda |
| FR-04 | Sistem menolak duplicate product code dalam scope mapping |
| FR-05 | Sistem membuat retainer hanya dari payment paket verified |
| FR-06 | Sistem menyimpan `revenueSourceType` dan `revenuePackageId` per session |
| FR-07 | Sistem memvalidasi kecocokan source type dan package ID |
| FR-08 | Completion membuat tepat satu recognition line |
| FR-09 | Event v3 membawa recognition line dan material snapshot |
| FR-10 | Finance worker membuat invoice sesi dengan service item yang tepat |
| FR-11 | Finance worker menerapkan retainer dari paket yang tepat |
| FR-12 | Inventory worker memproses material tanpa mengulang finance |
| FR-13 | Worker menggunakan external key/idempotency key stabil |
| FR-14 | Worker mencari dokumen existing setelah timeout ambigu |
| FR-15 | Cancellation menautkan reversal ke dokumen asli |
| FR-16 | Dashboard menampilkan pending, retry, failed, needs-action, dan dead-letter |
| FR-17 | Operator berizin dapat retry/ignore setelah memberikan alasan |
| FR-18 | Reconciliation tersedia per Basic, Booster, AR, AP, dan inventory |
| FR-19 | Feature flag tersedia per consumer dan cabang |
| FR-20 | Audit mencatat actor, event key, external ID, waktu, dan hasil |
| FR-21 | Sistem mendeteksi `Branch.type=PARTNERSHIP` pada stock request dan treatment |
| FR-22 | Partnership branch mempunyai mapping customer Zoho, bukan location transfer |
| FR-23 | Stock request approved membuat draft sales document tanpa omzet final |
| FR-24 | Shipment `SHIPPED` membuat satu event `PARTNERSHIP_GOODS_SHIPPED` |
| FR-25 | Worker membuat/finalize invoice barang Partnership dari shipment snapshot |
| FR-26 | Worker memposting HPP berdasarkan FIFO shipment pusat |
| FR-27 | Treatment completion Partnership tidak dirutekan ke Zoho |
| FR-28 | Discrepancy/return membuat reversal yang mengacu dokumen asli |
| FR-29 | Sistem menyediakan role `FINANCE_LOGISTICS_CONTROLLER` |
| FR-30 | Permission role gabungan dibatasi branch scope dan maker-checker |

## 7. Data requirements

### 7.1 Target pemilihan revenue source

Tambahkan model atau struktur ekuivalen:

```text
TreatmentRevenueSource
id
treatmentSessionId       unique
memberPackageId
packagePricingId
revenueRecognitionId     unique nullable sampai completion
sourceType               BASIC | BOOSTER
productCodeSnapshot
serviceNameSnapshot
selectedAt
selectedBy
createdAt
updatedAt
```

Constraint:

```text
unique(treatmentSessionId)
unique(revenueRecognitionId)
```

Validasi bisnis tetap dilakukan di service karena kecocokan Basic/Booster
melibatkan Encounter dan TreatmentSession.

### 7.2 Entity mapping

`ZohoEntityMapping.entityType` minimum:

```text
CUSTOMER
VENDOR
GOODS_ITEM
SERVICE_ITEM_BASIC
SERVICE_ITEM_BOOSTER
PARTNERSHIP_BRANCH_CUSTOMER
LOCATION
ACCOUNT
TAX
PAYMENT_METHOD
INVOICE
PAYMENT
RETAINER_INVOICE
RETAINER_PAYMENT
RETAINER_APPLICATION
JOURNAL
EXPENSE
PURCHASE_ORDER
BILL
VENDOR_PAYMENT
INVENTORY_ADJUSTMENT
PARTNERSHIP_SALES_INVOICE
PARTNERSHIP_PAYMENT
PARTNERSHIP_SHIPMENT
```

### 7.3 Event contract version 3

Contoh aman:

```json
{
  "eventType": "TREATMENT_COMPLETED",
  "eventVersion": 3,
  "aggregateType": "TreatmentSession",
  "aggregateId": "session-id",
  "occurredAt": "2026-07-28T10:00:00.000Z",
  "finance": {
    "recognitions": [
      {
        "sourceType": "BOOSTER",
        "memberPackageId": "package-id",
        "packagePricingId": "pricing-id",
        "productCode": "BST-001",
        "serviceName": "Booster Vitamin",
        "amount": "250000.00"
      }
    ],
    "recognizedRevenue": "250000.00",
    "materialCost": "100000.00",
    "grossProfit": "150000.00",
    "journalEntryId": "journal-id"
  },
  "inventory": {
    "postingId": "posting-id",
    "totalActualMaterialCost": "100000.00",
    "materials": [
      {
        "masterProductId": "product-id",
        "quantity": "1.0000",
        "unitCost": "100000.00"
      }
    ]
  }
}
```

Rules:

- `finance.recognitions.length = 1`;
- jumlah recognition sama dengan `recognizedRevenue`;
- product code wajib mapped sebelum worker melakukan write;
- compatibility reader boleh membaca event v2 lama, tetapi tidak boleh menebak
  Basic/Booster untuk transaksi baru;
- data klinis tidak masuk event outbound.

### 7.4 Event penjualan Partnership

```json
{
  "eventType": "PARTNERSHIP_GOODS_SHIPPED",
  "eventVersion": 1,
  "aggregateType": "Shipment",
  "aggregateId": "shipment-id",
  "partnershipBranchId": "branch-id",
  "stockRequestId": "request-id",
  "stockRequestInvoiceId": "invoice-id",
  "shipmentCode": "SHP-001",
  "invoiceNumber": "INV-PARTNER-001",
  "revenueAmount": "5000000.00",
  "costAmount": "3000000.00",
  "grossProfit": "2000000.00",
  "items": [
    {
      "masterProductId": "product-id",
      "sku": "VIT-C",
      "quantity": "10.0000",
      "unitPrice": "500000.00",
      "unitCost": "300000.00"
    }
  ]
}
```

Event dibuat atomik dengan dispatch posting. Harga memakai snapshot
`StockRequestInvoiceItem`; cost memakai FIFO shipment.

### 7.5 Perubahan role

Tambahkan nilai enum/role template:

```text
FINANCE_LOGISTICS_CONTROLLER
```

Role menggunakan branch assignment yang sudah tersedia. Permission minimum:

```text
ACCOUNT.READ
JOURNAL.READ
CASH_BANK.READ
EXPENSE.READ
INVENTORY.READ
INVENTORY.VALUATION.READ
INVENTORY.RECONCILE
INVENTORY.REQUEST.READ
INVENTORY.REQUEST.APPROVE
INVENTORY.SHIPMENT.READ
INVENTORY.SHIPMENT.DISPATCH
INVENTORY.DISCREPANCY.READ
INVENTORY.OPNAME.READ
INVENTORY.ADJUSTMENT.READ
AP.READ
DEFERRED_REVENUE.READ
WORKFLOW.APPROVAL.READ
ZOHO.SYNC.READ
ZOHO.SYNC.RETRY
ZOHO.RECONCILE.RUN
```

Permission create/approve/post diberikan melalui role template dan harus
mematuhi maker-checker.

## 8. Accounting requirements

### 8.1 Payment paket

```text
Dr Kas/Bank
Cr Deferred Revenue — Basic atau Booster
```

### 8.2 Completion

```text
Dr Deferred Revenue — sumber terpilih
Cr Revenue — service item sumber terpilih

Dr HPP
Cr Inventory
```

### 8.3 Cancellation

```text
Dr Revenue — sumber terpilih
Cr Deferred Revenue — sumber terpilih

Dr Inventory
Cr HPP
```

### 8.4 Larangan double-posting

- retainer + invoice sesi + apply retainer adalah satu jalur;
- journal mode adalah jalur alternatif;
- Bill dan positive inventory adjustment tidak boleh menambah penerimaan yang
  sama dua kali;
- satu event tidak boleh menghasilkan lebih dari satu mapping untuk entity yang
  sama.

### 8.5 Partnership payment dan shipment

Jika pembayaran diterima sebelum shipment:

```text
Dr Kas/Bank
Cr Customer Advance Partnership
```

Ketika shipment:

```text
Dr Customer Advance / Piutang Partnership
Cr Pendapatan Penjualan Barang Partnership

Dr HPP Penjualan Partnership
Cr Persediaan Pusat
```

Treatment completion pada Partnership tidak membuat jurnal Zoho.

## 9. Reconciliation requirements

Minimum reconciliation:

| Jenis | Pembanding |
|---|---|
| Retainer Basic | Remaining deferred Basic vs available retainer Basic |
| Retainer Booster | Remaining deferred Booster vs available retainer Booster |
| Revenue Basic | Recognition Basic RAHO vs invoice/journal Basic Zoho |
| Revenue Booster | Recognition Booster RAHO vs invoice/journal Booster Zoho |
| AR/AP | Balance dan status dokumen |
| Inventory quantity | On-hand mapped item/location |
| Inventory value | FIFO/posted value vs Zoho value |
| Cash/bank | Verified payment vs Zoho payment |
| Partnership order revenue | StockRequestInvoice/Shipment vs Zoho sales invoice |
| Partnership order HPP | FIFO shipment pusat vs HPP Zoho |

Status:

```text
MATCHED
MAPPING_MISSING
MISSING_IN_RAHO
MISSING_IN_ZOHO
AMOUNT_MISMATCH
STATUS_MISMATCH
SOURCE_MISMATCH
BRANCH_REVENUE_MODE_MISMATCH
```

`SOURCE_MISMATCH` wajib muncul jika transaksi Basic ditemukan pada service item
Booster atau sebaliknya.

`BRANCH_REVENUE_MODE_MISMATCH` wajib muncul jika treatment revenue Partnership
ditemukan di Zoho atau shipment Partnership diperlakukan sebagai transfer
internal.

## 10. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Token disimpan terenkripsi dan tidak muncul di log |
| NFR-02 | Semua write memakai idempotency/external reference |
| NFR-03 | Worker memakai timeout, retry backoff, dan dead-letter |
| NFR-04 | Dua worker tidak boleh memproses event yang sama bersamaan |
| NFR-05 | Zoho down tidak menurunkan availability transaksi RAHO |
| NFR-06 | Payload/log menjalani privacy allowlist |
| NFR-07 | Permission mengikuti branch dan tindakan penting |
| NFR-08 | Metric dan alert tersedia untuk pending/failure/mismatch |
| NFR-09 | Event contract mempunyai version dan compatibility policy |
| NFR-10 | Semua nilai uang memakai pembulatan dan currency policy yang sama |
| NFR-11 | Route Partnership ditentukan dari branch snapshot pada event |
| NFR-12 | Role gabungan memakai branch scope dan maker-checker |

## 11. Acceptance criteria utama

1. Membuat terapi Basic/Booster tidak mengubah uang muka atau omzet.
2. Payment verified menambah retainer paket yang benar.
3. Completion Basic hanya menurunkan deferred Basic.
4. Completion Booster hanya menurunkan deferred Booster.
5. Event v3 memiliki tepat satu recognition line.
6. Zoho invoice memakai service item yang sesuai.
7. Retry 10 kali tidak mengubah hasil.
8. Kegagalan inventory worker tidak menggandakan finance.
9. Kegagalan finance worker tidak menggandakan inventory.
10. Cancellation mengembalikan retainer dan stok melalui reversal.
11. Reconciliation normal menghasilkan `MATCHED`.
12. Tidak ada data medis atau secret di Zoho/log.
13. Treatment completion Partnership tidak membuat omzet/HPP infus di Zoho.
14. Shipment Partnership membuat satu omzet barang dan satu HPP.
15. Shipment Premier/Pusat tetap transfer internal tanpa omzet.
16. Role `FINANCE_LOGISTICS_CONTROLLER` hanya melihat cabang yang ditugaskan.
17. Role gabungan tidak dapat menyetujui transaksi buatannya sendiri.

## 12. Migration dan rollout

1. Tambahkan schema revenue source.
2. Backfill session yang belum completed dari konteks Basic/Booster.
3. Session ambigu masuk exception dan harus dipilih manusia.
4. Jangan mengubah recognition yang sudah posted tanpa prosedur koreksi Finance.
5. Tambahkan writer event v3 dan compatibility reader v2.
6. Jalankan dry-run mapping.
7. UAT Basic dan Booster secara terpisah.
8. Aktifkan canary satu cabang.
9. Aktifkan finance consumer sebelum inventory consumer hanya jika atomic local
   posting dan reconciliation sudah lulus.
10. Rollout cabang berikutnya setelah lima hari kerja tanpa mismatch material.
11. Backfill mapping Partnership branch sebagai customer.
12. UAT satu shipment Partnership lengkap dari request sampai received.
13. Aktifkan route Partnership setelah tidak ada treatment revenue pada dry-run.
14. Buat role template Controller dengan permission matrix dan maker-checker.

## 13. Traceability sprint

| Requirement | Sprint |
|---|---|
| OAuth, worker, idempotency, audit | 1–2 |
| Contact mapping | 3 |
| Goods/service item dan location | 4 |
| Invoice biasa | 5 |
| Customer payment dan AR | 6 |
| Revenue source, retainer, event v3, treatment revenue | 7 |
| Expense | 8 |
| Partnership stock request, invoice, shipment sale, dan role Controller | 9 |
| Purchase Order supplier | 10 |
| Goods Receipt, Bill, GRNI | 11 |
| Vendor payment dan AP | 12 |
| Treatment material dan inventory adjustment | 13 |
| Reconciliation, cutover, go-live | 14 |
