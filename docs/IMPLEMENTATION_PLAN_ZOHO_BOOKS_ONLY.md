# Panduan Implementasi Integrasi Logistik RAHO ke Zoho Books

Status: rancangan implementasi final sebelum coding  
Tanggal pembaruan: 27 Juli 2026  
Target: Zoho Books saja, tanpa Zoho Inventory

Panduan khusus untuk organisasi Zoho yang sudah mempunyai item, saldo,
customer, uang muka, dan Invoice tersedia di
[Panduan Sinkronisasi Data Existing Zoho Books](./PANDUAN_SINKRONISASI_DATA_EXISTING_ZOHO_BOOKS.md).

## 1. Tujuan dan hasil akhir

Integrasi ini mengirim master barang dan persediaan Logistik ERP RAHO ke
**Items** dan fitur inventory tracking di Zoho Books.

Setelah implementasi selesai:

1. Produk aktif RAHO dibuat sebagai inventory item di Zoho Books.
2. SKU, nama, satuan, harga, akun, dan reorder level tersinkron.
3. Saldo yang sudah ada di Zoho Books menjadi baseline awal saat koneksi
   pertama.
4. RAHO mengadopsi baseline Zoho melalui opening balance terkontrol; sistem
   tidak menimpa atau menambahkan saldo awal ke Zoho.
5. Pembelian, penjualan, pemakaian terapi, kerusakan, dan stock opname
   memperbarui persediaan Zoho Books melalui transaksi yang tepat.
6. Quantity dan nilai per item/location direkonsiliasi dengan RAHO.
7. Pengguna dapat melihat koneksi, antrean, mapping, kegagalan, dan selisih.
8. RAHO tetap berjalan ketika Zoho tidak tersedia.
9. Retry tidak menghasilkan item, dokumen, adjustment, atau jurnal ganda.

Arsitektur final:

```text
RAHO Logistik ERP
├── master produk, SKU, UOM, kategori
├── gudang, lokasi internal, batch, expiry
├── mutasi quantity dan reservasi
├── FIFO dan nilai persediaan
└── source document serta audit trail
              │
              ▼
Zoho Books
├── Items dengan item_type=inventory
├── stock on hand per Books location
├── opening stock pada cutover
├── Purchase Order dan Bill
├── Invoice
├── Inventory Adjustment bila didukung jalur integrasi
├── akun Persediaan dan HPP
└── laporan finansial dan inventory Books
```

## 2. Batasan solusi

### 2.1 Yang digunakan

- Zoho Books OAuth 2.0.
- Zoho Books API `/books/v3`.
- Zoho Books Items.
- Zoho Books Locations jika tersedia pada paket/edisi organisasi.
- Zoho Books Contacts, Purchase Orders, Bills, Invoices, Payments, Expenses,
  Journals, dan laporan.
- Inventory tracking bawaan Zoho Books.
- Quantity Adjustment dan Value Adjustment pada Zoho Books.

### 2.2 Yang tidak digunakan

- Akun atau add-on Zoho Inventory.
- Endpoint `/inventory/v1`.
- Warehouse, package, shipment, purchase receive, batch, dan serial number
  milik Zoho Inventory.
- Sinkronisasi langsung dari browser.

### 2.3 Batas detail persediaan

RAHO tetap menyimpan detail operasional yang lebih lengkap:

- batch dan tanggal kedaluwarsa;
- rak/bin/location internal;
- kondisi barang;
- reservation;
- in-transit;
- FIFO cost layer;
- evidence dan approval.

Zoho Books menerima ringkasan inventory per item dan Books location. Detail
batch, expiry, dan reservation tidak dipaksakan masuk ke Zoho Books.

## 3. Prinsip sumber data

| Data | Sumber utama | Salinan/tujuan |
|---|---|---|
| Master produk dan SKU | RAHO | Zoho Books Items |
| UOM dasar | RAHO | Zoho Books Items |
| Batch, expiry, reservation | RAHO | Tidak dikirim |
| Quantity operasional | RAHO | Zoho Books stock on hand |
| FIFO cost layer | RAHO | Ringkasan nilai ke Zoho Books |
| Saldo quantity dan nilai initial connection | Zoho Books | Opening balance RAHO |
| Saldo item baru setelah cutover | RAHO | Zoho Books |
| Vendor | RAHO pada fase awal | Zoho Books Contacts |
| Purchase Order | RAHO | Zoho Books Purchase Order |
| Supplier invoice | RAHO | Zoho Books Bill |
| Sales invoice | RAHO | Zoho Books Invoice |
| Pembayaran | RAHO | Zoho Books Payments |
| Chart of Accounts | Zoho Books | Mapping/cache di RAHO |
| Laporan resmi finansial | Zoho Books | Status/rekonsiliasi di RAHO |

Perubahan master harian dilakukan di RAHO. Perubahan item langsung di Zoho
dibatasi untuk Finance/Admin integrasi agar tidak terjadi konflik dua arah.

Khusus initial connection, saldo persediaan Zoho yang sudah ada adalah baseline
cutover. Setelah baseline diimpor, disetujui, dan dikunci di RAHO, RAHO menjadi
sumber event operasional baru dan Zoho menerima transaksi lanjutan.

## 4. Aturan penting persediaan

1. Barang RAHO dibuat dengan `product_type: goods`.
2. Barang yang dilacak stok dibuat dengan `item_type: inventory`.
3. `inventory_account_id` wajib menunjuk akun Persediaan.
4. `purchase_account_id` wajib menunjuk akun HPP/COGS.
5. `account_id` menunjuk akun pendapatan jika item dapat dijual.
6. `initial_stock` hanya boleh digunakan untuk item Zoho yang benar-benar baru
   dan belum mempunyai saldo atau transaksi.
7. Item Zoho yang sudah memiliki saldo tidak menerima `initial_stock` ulang.
   Sistem membaca saldo Zoho dan mengadopsinya sebagai opening balance RAHO.
   Selisih terhadap data pra-cutover RAHO ditampilkan untuk approval, bukan
   langsung dikoreksi ke Zoho.
8. Setelah baseline, quantity tidak diubah melalui update master item.
9. Quantity berubah melalui Bill, Invoice, atau Inventory Adjustment.
10. Jurnal biasa mengubah nilai akun, tetapi tidak otomatis mengubah stock on
   hand item. Karena itu jurnal tidak boleh menggantikan quantity adjustment
   jika targetnya quantity Zoho harus sama.
11. Satu kejadian bisnis hanya boleh mempunyai satu jalur dampak persediaan.

Contoh anti-double-posting:

```text
Goods Receipt + Supplier Invoice RAHO
          │
          └── Zoho Bill menaikkan inventory

Jangan:
Zoho Bill + Quantity Adjustment positif untuk penerimaan yang sama
```

## 5. Prasyarat Zoho Books

### 5.1 Paket dan fitur

Administrator harus memastikan organisasi Zoho Books:

- menggunakan paket/edisi yang mendukung inventory tracking;
- mengaktifkan inventory tracking pada Preferences > Items;
- tidak mengaktifkan Zoho Inventory add-on;
- mendukung Locations bila persediaan perlu dipisah per cabang;
- memiliki base currency, timezone, dan fiscal year yang benar.

Kemampuan API dan field dapat berbeda menurut country edition dan paket.
Lakukan proof of concept pada test organization sebelum coding penuh.

### 5.2 Chart of Accounts

Finance menyiapkan minimum:

| Fungsi | Contoh akun |
|---|---|
| Inventory asset | Persediaan Barang |
| COGS | Harga Pokok Penjualan |
| Treatment usage | Pemakaian Bahan Terapi |
| Inventory loss | Selisih/Kerugian Persediaan |
| Inventory gain | Keuntungan Penyesuaian Persediaan |
| Sales | Pendapatan Penjualan |
| Accounts payable | Hutang Usaha |
| Accounts receivable | Piutang Usaha |
| Cash/bank | Kas dan Bank |

### 5.3 Custom field dan reference

Buat custom field unik bila modul mendukung:

```text
RAHO_ITEM_ID
RAHO_VENDOR_ID
RAHO_CUSTOMER_ID
RAHO_PO_ID
RAHO_BILL_ID
RAHO_INVOICE_ID
RAHO_PAYMENT_ID
RAHO_INVENTORY_EVENT_ID
RAHO_JOURNAL_ID
```

Reference tersebut dipakai untuk pencarian replay dan rekonsiliasi.

## 6. Validasi data RAHO sebelum integrasi

Semua produk aktif wajib mempunyai:

- ID internal stabil;
- SKU unik dan tidak kosong;
- nama maksimal sesuai batas Zoho;
- UOM dasar;
- tipe `goods` atau `service`;
- status inventory tracked;
- harga beli dan/atau harga jual;
- mapping akun;
- reorder level bila digunakan.

Validasi cutover:

```text
available quantity = on_hand - reserved - quarantined sesuai kebijakan
inventory value    = jumlah remaining value seluruh FIFO layer
average cutover rate = inventory value / opening quantity
```

Jika quantity nol, opening rate tidak boleh menghasilkan nilai persediaan.
Jika nilai negatif, item diblok dari cutover dan masuk daftar tindakan.

## 7. Mapping item RAHO ke Zoho Books

| RAHO | Zoho Books |
|---|---|
| `MasterProduct.id` | custom field `RAHO_ITEM_ID` |
| SKU/kode produk | `sku` |
| nama | `name` |
| deskripsi | `description` |
| deskripsi pembelian | `purchase_description` |
| UOM dasar | `unit` |
| harga jual | `rate` |
| harga beli default | `purchase_rate` |
| barang | `product_type: goods` |
| dilacak persediaan | `item_type: inventory` |
| akun pendapatan | `account_id` |
| akun HPP | `purchase_account_id` |
| akun persediaan | `inventory_account_id` |
| reorder point | `reorder_level` |
| supplier utama | `vendor_id` |
| saldo cutover | `locations[].initial_stock` |
| harga saldo cutover | `locations[].initial_stock_rate` |

Contoh create inventory item:

```json
{
  "name": "Sarung Tangan Medis M",
  "sku": "GLV-M-001",
  "unit": "pcs",
  "description": "Sarung tangan medis ukuran M",
  "purchase_description": "Pembelian sarung tangan medis ukuran M",
  "product_type": "goods",
  "item_type": "inventory",
  "rate": "75000",
  "purchase_rate": "60000",
  "account_id": "ZOHO_SALES_ACCOUNT_ID",
  "purchase_account_id": "ZOHO_COGS_ACCOUNT_ID",
  "inventory_account_id": "ZOHO_INVENTORY_ACCOUNT_ID",
  "reorder_level": "20",
  "custom_fields": [
    {
      "customfield_id": "ZOHO_RAHO_ITEM_FIELD_ID",
      "value": "RAHO_PRODUCT_ID"
    }
  ]
}
```

## 8. Fase implementasi

```text
Fase 0  Proof of concept dan keputusan
Fase 1  Database integrasi
Fase 2  OAuth dan Books client
Fase 3  Worker dan transactional outbox
Fase 4  Mapping COA, location, contact, dan item
Fase 5  Initial item sync dan opening inventory
Fase 6  Purchasing dan stok masuk
Fase 7  Invoice, pemakaian, dan stok keluar
Fase 8  Adjustment, reversal, dan correction
Fase 9  UI, monitoring, dan rekonsiliasi
Fase 10 Testing, cutover, dan rollback
```

## 9. Fase 0 — proof of concept

Sebelum membuat seluruh modul, lakukan pengujian pada organisasi test:

1. Buat satu inventory item melalui Books API.
2. Pastikan item muncul di Items sebagai inventory tracked.
3. Verifikasi akun Persediaan dan HPP terpasang.
4. Buat opening stock pada satu atau dua location.
5. Buat Bill dan pastikan quantity/nilai bertambah.
6. Buat Invoice dan pastikan quantity/nilai berkurang.
7. Uji pembuatan Quantity Adjustment melalui kemampuan integrasi yang tersedia.
8. Ambil item kembali dan baca stock on hand per location.
9. Dokumentasikan endpoint, scope, payload, dan response aktual organisasi.

### Gate wajib

Otomasi pemakaian terapi dan stock opname tidak boleh dilanjutkan sebelum jalur
otomatis Inventory Adjustment Zoho Books terbukti tersedia untuk organisasi.
Dokumentasi publik Books tidak boleh diasumsikan mempunyai endpoint yang sama
dengan Zoho Inventory.

Jika adjustment tidak tersedia melalui Books API:

- initial item, opening stock, Bill, dan Invoice tetap dapat diotomatisasi;
- adjustment dibuat melalui UI Zoho Books dari antrean/reconciliation RAHO; atau
- quantity untuk kejadian adjustment tetap di RAHO dan Finance menerima jurnal
  nilai, dengan status eksplisit bahwa quantity Zoho tidak real-time.

Keputusan fallback harus disetujui Product Owner dan Finance.

## 10. Fase 1 — database integrasi

Tambahkan enum:

```text
ZohoConnectionStatus
  DISCONNECTED
  CONNECTING
  CONNECTED
  DEGRADED
  REVOKED

ZohoSyncStatus
  PENDING
  PROCESSING
  RETRY_SCHEDULED
  ACTION_REQUIRED
  PROCESSED
  FAILED
  CANCELLED

ZohoEntityType
  ACCOUNT
  LOCATION
  CONTACT_CUSTOMER
  CONTACT_VENDOR
  ITEM
  PURCHASE_ORDER
  BILL
  INVOICE
  CUSTOMER_PAYMENT
  VENDOR_PAYMENT
  INVENTORY_ADJUSTMENT
  JOURNAL
```

### 10.1 `ZohoConnection`

Simpan:

- organization ID dan name;
- data center, accounts domain, dan API domain;
- refresh token terenkripsi;
- granted scopes;
- status;
- connected by/at;
- last health check dan safe error.

Access token tidak perlu disimpan permanen dan tidak boleh dikirim ke browser.

### 10.2 `ZohoEntityMapping`

Simpan:

- organization ID;
- entity type;
- RAHO entity ID;
- Zoho entity ID;
- external reference;
- branch/location context;
- source hash dan last synced hash;
- last synced at dan status.

Unique constraint:

```text
(organizationId, entityType, rahoEntityId)
(organizationId, entityType, zohoEntityId)
```

### 10.3 `ZohoSyncJob` dan `ZohoSyncAttempt`

Job menyimpan:

- integration event ID;
- operation dan entity type;
- aggregate ID;
- dependency key;
- attempts dan next attempt;
- lock owner/expiry;
- request hash;
- response status dan Zoho error code;
- safe error message;
- external ID.

Attempt menyimpan histori aman tanpa token atau data medis.

### 10.4 `ZohoInventorySnapshot`

Simpan hasil rekonsiliasi:

- date/time;
- item mapping ID;
- RAHO location dan Zoho location;
- RAHO quantity/value;
- Zoho quantity/value;
- quantity/value difference;
- status dan resolution.

## 11. Fase 2 — OAuth dan Books client

Environment:

```env
ZOHO_ENABLED=false
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REDIRECT_URI=
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_TOKEN_ENCRYPTION_KEY=
ZOHO_WORKER_ENABLED=false
ZOHO_SYNC_MODE=shadow
```

Jangan hard-code API domain. Gunakan `api_domain` dari token response.

Endpoint backend:

```text
GET  /api/integrations/zoho/connect
GET  /api/integrations/zoho/callback
GET  /api/integrations/zoho/status
POST /api/integrations/zoho/disconnect
POST /api/integrations/zoho/health-check
```

OAuth:

1. Backend membuat state acak sekali pakai.
2. Admin diarahkan ke Zoho consent.
3. Gunakan `access_type=offline` dan `prompt=consent`.
4. Callback memvalidasi state.
5. Authorization code ditukar menjadi token di backend.
6. Refresh token dienkripsi.
7. Backend memanggil `GET /books/v3/organizations`.
8. Admin memilih organisasi yang benar.

Scope minimum untuk item:

```text
ZohoBooks.settings.READ
ZohoBooks.settings.CREATE
ZohoBooks.settings.UPDATE
```

Tambahkan scope granular Contacts, Purchase Orders, Bills, Invoices, Payments,
Journals, dan modul lain sesuai hasil proof of concept. Jangan meminta delete
scope jika reversal/void sudah cukup.

HTTP client wajib menangani:

- authorization header `Zoho-oauthtoken`;
- query `organization_id`;
- refresh token single-flight;
- timeout;
- HTTP 401, 429, dan 5xx;
- correlation ID;
- sanitasi request/response log.

## 12. Fase 3 — outbox dan worker

Pemanggilan Zoho tidak dilakukan di transaksi bisnis utama.

```text
Transaksi RAHO
→ simpan perubahan bisnis
→ simpan IntegrationEvent dalam transaksi database yang sama
→ commit
→ dispatcher membuat ZohoSyncJob
→ worker memproses job
→ mapping/status diperbarui
```

Worker dijalankan sebagai proses terpisah. Job diklaim dengan locking database
agar dua worker tidak memproses job yang sama.

Retry:

| Kondisi | Tindakan |
|---|---|
| 401 | refresh access token, ulangi sekali |
| 429 | ikuti `Retry-After` atau backoff |
| timeout/5xx | exponential backoff + jitter |
| invalid mapping | `ACTION_REQUIRED` |
| duplicate reference | cari dan link external ID |
| closed period | `ACTION_REQUIRED`, jangan ubah tanggal |
| validation error | gagal permanen sampai data diperbaiki |

## 13. Fase 4 — master mapping

Urutan dependency:

```text
Connection
→ Organization
→ Chart of Accounts
→ Locations
→ Contacts/Vendors
→ Items
→ Opening stock
→ Transactions
```

### 13.1 Chart of Accounts

Ambil COA Zoho dan petakan akun Persediaan, HPP, Pendapatan, Adjustment, AR,
AP, dan Kas/Bank. Blok item sync jika akun wajib belum dipetakan.

### 13.2 Locations

Petakan cabang/gudang RAHO ke Books location. Jika Books hanya memakai satu
location, gabungkan quantity seluruh gudang sesuai keputusan cutover dan
pertahankan detail gudang di RAHO.

### 13.3 Items

Pencarian aman:

1. Cari mapping lokal berdasarkan RAHO product ID.
2. Jika belum ada, cari custom field unik `RAHO_ITEM_ID`.
3. Jika belum ada, cari SKU persis.
4. Jika satu hasil, link mapping.
5. Jika lebih dari satu hasil, `ACTION_REQUIRED`.
6. Hanya create jika seluruh pencarian gagal.

Nama tidak boleh menjadi satu-satunya kunci pencocokan.

## 14. Fase 5 — initial sync dan penyelarasan saldo

### 14.1 Preflight

Hasil preflight harus menampilkan:

- total item aktif;
- SKU kosong/duplikat;
- UOM tidak didukung;
- akun belum terpetakan;
- location belum terpetakan;
- quantity/value negatif;
- item yang sudah ada di Zoho;
- estimasi jumlah API call.

Tidak ada write ke Zoho saat preflight.

### 14.2 Initial item sync

Untuk setiap produk:

1. Upsert inventory item.
2. Simpan `zoho_item_id`.
3. Verifikasi hasil dengan GET item.
4. Jangan kirim opening stock dulu jika masih mode dry-run/shadow.

### 14.3 Baca saldo Zoho sebelum menulis

Pada cutover, tetapkan waktu freeze lalu:

1. Hentikan sementara posting mutasi RAHO.
2. Tunggu transaksi in-flight selesai.
3. Ambil snapshot quantity dan nilai RAHO per item/location.
4. Ambil item, stock on hand, dan nilai yang sudah ada di Zoho.
5. Cocokkan item berdasarkan mapping, `RAHO_ITEM_ID`, lalu SKU persis.
6. Kelompokkan hasil menjadi:
   - item baru di Zoho dan saldo Zoho nol;
   - item sudah ada dan saldo sama;
   - item sudah ada dan saldo berbeda;
   - item ambigu/tidak dapat dipetakan.
7. Jangan mengubah saldo Zoho atau opening RAHO sebelum Finance menyetujui
   laporan baseline dan selisih.

Rumus baseline:

```text
quantity difference = RAHO pre-cutover quantity - Zoho baseline quantity
value difference    = RAHO pre-cutover value - Zoho baseline value
```

Contoh:

```text
RAHO pra-cutover = 100 pcs
Zoho baseline    = 70 pcs
Opening RAHO     = 70 pcs
Selisih 30 pcs masuk laporan investigasi

RAHO pra-cutover = 80 pcs
Zoho baseline    = 100 pcs
Opening RAHO     = 100 pcs
Selisih -20 pcs masuk laporan investigasi
```

### 14.4 Strategi per kondisi

| Kondisi | Tindakan |
|---|---|
| Item belum ada di Zoho tetapi ada di RAHO | Buat item; opening stock dari RAHO setelah approval |
| Item ada, saldo Zoho nol | Opening RAHO nol; perbedaan diinvestigasi |
| Item ada, saldo sama | Simpan baseline `MATCHED`; tidak membuat transaksi |
| Item ada, saldo berbeda | Adopsi saldo Zoho sebagai opening RAHO; selisih masuk laporan |
| Item hanya ada di Zoho | Buat/link master RAHO setelah review mapping |
| Item/mapping ambigu | `ACTION_REQUIRED`; jangan menulis ke Zoho |
| Nilai berbeda, quantity sama | Adopsi nilai Zoho atau buat keputusan koreksi formal oleh Finance |

Contoh create untuk item baru:

```json
{
  "locations": [
    {
      "location_id": "ZOHO_LOCATION_PUSAT",
      "initial_stock": "70",
      "initial_stock_rate": "60000"
    },
    {
      "location_id": "ZOHO_LOCATION_CABANG_A",
      "initial_stock": "30",
      "initial_stock_rate": "60000"
    }
  ]
}
```

`initial_stock_rate` adalah ringkasan nilai unit pada cutover dan hanya untuk
item baru/bersaldo nol yang lolos validasi. FIFO layer rinci tetap di RAHO.

Tambahkan marker permanen:

```text
baselineReconciledAt
baselineSnapshotHash
baselineApprovedBy
baselineRahoQuantity
baselineZohoQuantity
baselineQuantityDifference
baselineRahoValue
baselineZohoValue
baselineValueDifference
baselineResolutionType
```

Worker menolak `initial_stock` kedua. Perubahan setelah baseline selalu memakai
transaksi/adjustment dengan reference unik.

### 14.5 Eksekusi penyelarasan

Setelah approval Finance:

1. Untuk item existing, impor saldo Zoho sebagai opening balance RAHO.
2. Buat/link master RAHO untuk item yang hanya ada di Zoho setelah review.
3. Buat item Zoho baru beserta opening stock hanya untuk produk RAHO yang belum
   ada di Zoho dan telah disetujui.
4. Simpan snapshot ID, timestamp, sumber, approver, dan hash baseline.
5. Ambil kembali saldo kedua sistem.
6. Tandai `BASELINE_ADOPTED` jika opening RAHO sama dengan baseline Zoho.
7. Selisih data pra-cutover tetap disimpan sebagai audit/reconciliation issue.
8. Item gagal tetap diblok dari mode LIVE.
9. Setelah seluruh item kritis adopted, buka posting dan aktifkan event baru.

## 15. Fase 6 — purchasing dan stok masuk

### 15.1 Purchase Order

Event `PO_ISSUED` membuat Purchase Order Zoho Books menggunakan vendor dan
`zoho_item_id`. PO sendiri tidak boleh dianggap menambah stock on hand sebelum
perilaku organisasi dikonfirmasi.

### 15.2 Goods Receipt dan supplier Bill

RAHO tetap mencatat penerimaan fisik, batch, expiry, quantity, dan FIFO.
Supplier Bill Zoho dibuat ketika supplier invoice tervalidasi.

Sebelum go-live, contract test harus membuktikan kapan quantity Zoho bertambah
pada workflow Books yang digunakan. Jangan mengasumsikan PO menaikkan stok.

Kebijakan satu dampak:

```text
Jika Zoho Bill menaikkan inventory:
  jangan kirim quantity adjustment penerimaan.

Jika penerimaan terjadi jauh sebelum Bill dan bisnis menuntut quantity real-time:
  gunakan adjustment hanya jika jalur Books tervalidasi,
  lalu Bill tidak boleh menambah quantity yang sama dua kali.
```

Setiap desain interim harus merekonsiliasi akun barang diterima belum ditagih.

## 16. Fase 7 — stok keluar

### 16.1 Penjualan

Invoice Zoho menggunakan `item_id`, quantity, rate, tax, dan location. Contract
test memastikan posting Invoice mengurangi stock on hand dan membentuk dampak
akuntansi sesuai konfigurasi organisasi.

### 16.2 Pemakaian bahan terapi

Event `TREATMENT_COMPLETED` membawa payload minimum:

```text
session reference
posting date
branch/location
item ID
actual quantity
FIFO value summary
inventory posting ID
```

Tidak boleh mengirim diagnosis, catatan medis, atau data klinis lain.

Target Zoho:

```text
Quantity Adjustment negatif
Reason: Pemakaian Bahan Terapi
Reference: RAHO-TREATMENT-{inventoryPostingId}
Account: Pemakaian Bahan Terapi/HPP
```

Jika adjustment API tidak tersedia, job menjadi `ACTION_REQUIRED` atau memakai
fallback yang telah disetujui pada Fase 0. Jurnal nilai saja tidak boleh diberi
label "quantity synchronized".

### 16.3 Transfer internal

Jika dua gudang dipetakan ke dua Books location, transfer harus mengurangi
location asal dan menambah location tujuan tanpa menciptakan pendapatan/beban.
Jika kemampuan Books tidak mendukung otomasi transfer, pertahankan transfer
detail di RAHO dan gunakan rekonsiliasi/location adjustment yang disetujui.

## 17. Fase 8 — adjustment, reversal, dan koreksi

| Event RAHO | Target Zoho |
|---|---|
| Barang rusak/kedaluwarsa | Quantity Adjustment negatif |
| Selisih kurang opname | Quantity Adjustment negatif |
| Selisih lebih opname | Quantity Adjustment positif |
| Koreksi nilai | Value Adjustment |
| Pembatalan pemakaian | Adjustment reversal |
| Pembatalan invoice | Void/credit note sesuai status |
| Pembatalan Bill | Void/vendor credit sesuai status |

Transaksi posted tidak dihapus. Reversal harus:

- menunjuk external ID transaksi asli;
- memakai reference baru yang unik;
- mempunyai quantity/value berlawanan;
- tercatat di audit log;
- tidak mengubah tanggal untuk melewati period lock.

## 18. Idempotency

Setiap operasi mempunyai reference unik:

```text
ITEM:{masterProductId}
OPENING:{snapshotId}:{itemId}:{locationId}
PO:{purchaseOrderId}
BILL:{supplierInvoiceId}
INVOICE:{invoiceId}
USAGE:{inventoryPostingId}
ADJUSTMENT:{inventoryAdjustmentId}
REVERSAL:{originalPostingId}:{reversalId}
```

Sebelum create:

1. Periksa mapping lokal.
2. Cari reference/custom field di Zoho.
3. Jika ditemukan, link dan anggap replay.
4. Create hanya bila keduanya tidak ditemukan.
5. Simpan external ID sebelum menandai job selesai.

## 19. UI Integrasi Zoho

Tambahkan menu **Integrasi Zoho Books**:

1. Ringkasan.
2. Koneksi.
3. Antrean Sinkronisasi.
4. Mapping.
5. Cutover Persediaan.
6. Rekonsiliasi.

### 19.1 Ringkasan

Tampilkan:

- status OAuth dan Books API;
- jumlah item mapped;
- job pending/failed/action required;
- tanggal sukses terakhir;
- selisih quantity dan nilai;
- mode `OFF`, `SHADOW`, `PILOT`, atau `LIVE`.

### 19.2 Cutover Persediaan

Sediakan:

- preflight read-only;
- export snapshot;
- approval Finance;
- progress initial sync;
- progress opening stock;
- hasil rekonsiliasi;
- tombol retry item gagal;
- proteksi agar opening tidak dikirim dua kali.

### 19.3 Rekonsiliasi

Kolom minimum:

```text
SKU
Item
RAHO location
Zoho location
RAHO quantity
Zoho quantity
Quantity difference
RAHO value
Zoho value
Value difference
Last sync
Resolution status
```

## 20. Rekonsiliasi

### 20.1 Master item

```text
produk aktif RAHO = produk mapped ke inventory item Zoho
SKU duplikat = 0
item mapping ambigu = 0
```

### 20.2 Quantity

Bandingkan per item/location:

```text
RAHO quantity kebijakan cutover
versus
Zoho Books stock on hand
```

Gunakan field stock per location dari respons Items yang tersedia pada
organisasi, misalnya `location_stock_on_hand`.

Sinkronisasi tidak berarti menyalin total saldo berulang kali. Pada setiap run:

```text
expected Zoho quantity
= baseline matched quantity
+ seluruh event RAHO yang sudah diproses setelah baseline

reconciliation difference
= current RAHO quantity - current Zoho quantity
```

Jika terdapat selisih, sistem lebih dulu mencari event yang hilang atau ganda.
Adjustment rekonsiliasi hanya dibuat setelah penyebab diketahui dan disetujui.

### 20.3 Nilai

Bandingkan:

```text
total remaining FIFO value RAHO
versus
nilai inventory/report atau saldo akun Persediaan Zoho
```

Perbedaan rounding harus menggunakan tolerance yang disetujui Finance.

### 20.4 Penyelesaian selisih

Jangan overwrite saldo tanpa investigasi. Cari:

- event belum terkirim;
- mapping location salah;
- Bill/Invoice ganda;
- adjustment manual Zoho;
- tanggal/periode berbeda;
- UOM conversion salah;
- rounding/currency.

## 21. Security dan audit

- OAuth state acak, sekali pakai, dan mempunyai expiry.
- Refresh token dienkripsi dengan key di secret manager.
- Token tidak masuk log, browser, analytics, atau error response.
- Permission terpisah untuk connect, disconnect, mapping, retry, cutover,
  approve opening, dan resolve reconciliation.
- Semua perubahan mapping dan retry manual diaudit.
- Callback OAuth menggunakan HTTPS di production.
- Webhook, jika digunakan, diverifikasi signature/secret dan replay protection.
- Payload Zoho tidak berisi data medis.

## 22. Testing

### 22.1 Unit test

- mapper inventory item;
- UOM dan decimal conversion;
- opening rate calculation;
- source hash;
- idempotency key;
- token encryption;
- retry classification;
- dependency resolver.

### 22.2 Contract test Zoho test organization

- create/update/disable inventory item;
- duplicate SKU;
- opening stock per location;
- GET stock on hand;
- PO behavior;
- Bill stock/value behavior;
- Invoice stock/value behavior;
- quantity/value adjustment capability;
- void/reversal;
- closed period;
- 401 refresh dan 429 retry.

### 22.3 Integration test database

- transaksi bisnis dan outbox atomik;
- concurrent worker locking;
- unique mapping;
- crash setelah Zoho sukses tetapi sebelum DB update;
- replay menemukan entity yang sudah dibuat;
- opening stock kedua ditolak.

### 22.4 UAT

| ID | Skenario |
|---|---|
| ZB-01 | OAuth dan health check |
| ZB-02 | Initial sync seluruh item |
| ZB-03 | Opening quantity/value per location |
| ZB-04 | Pembelian dan Bill menambah persediaan sekali |
| ZB-05 | Invoice mengurangi persediaan sekali |
| ZB-06 | Pemakaian terapi mengurangi quantity dan nilai |
| ZB-07 | Barang rusak dan stock opname |
| ZB-08 | Reversal tidak membuat saldo ganda |
| ZB-09 | Zoho down tidak memblok operasi RAHO |
| ZB-10 | Rekonsiliasi quantity/value tanpa selisih |

## 23. Deployment dan cutover

### 23.1 Mode

```text
OFF    tidak membuat job
SHADOW membuat payload dan validasi tanpa write
PILOT  write hanya item/location terpilih
LIVE   seluruh event yang diaktifkan ditulis ke Zoho
```

### 23.2 Urutan production

1. Deploy database, OAuth, client, worker, UI dengan mode OFF.
2. Hubungkan test organization.
3. Jalankan contract test dan proof of concept adjustment.
4. Hubungkan production organization.
5. Sinkronkan COA, location, contact, dan item dalam SHADOW.
6. Perbaiki seluruh preflight error.
7. Pilot beberapa item/cabang.
8. Tetapkan cutover dan freeze window.
9. Ambil serta approve snapshot.
10. Sinkronkan master dan opening inventory.
11. Rekonsiliasi hingga nol/tolerance.
12. Aktifkan event transaksi ke LIVE.
13. Monitor intensif minimal dua siklus operasional.

## 24. Rollback

Rollback aplikasi:

- ubah mode ke OFF;
- hentikan claim job baru;
- biarkan transaksi RAHO tetap berjalan;
- jangan menghapus mapping atau histori.

Rollback cutover:

- jangan menghapus item/transaksi massal;
- hentikan worker;
- identifikasi item dan opening yang sudah sukses;
- lakukan reversal/koreksi formal di Zoho;
- simpan bukti dan approval Finance;
- ulangi cutover hanya dengan snapshot baru.

## 25. Struktur kode yang disarankan

```text
apps/api/src/modules/integrations/zoho/
├── zoho.routes.ts
├── zoho.controller.ts
├── zoho-oauth.service.ts
├── zoho-token.service.ts
├── zoho-books.client.ts
├── zoho-item.mapper.ts
├── zoho-purchasing.mapper.ts
├── zoho-sales.mapper.ts
├── zoho-inventory-event.mapper.ts
├── zoho-sync.service.ts
├── zoho-worker.ts
├── zoho-reconciliation.service.ts
└── __tests__/
```

Frontend:

```text
apps/web/src/pages/integrations/zoho/
├── ZohoOverviewPage.tsx
├── ZohoConnectionPage.tsx
├── ZohoQueuePage.tsx
├── ZohoMappingPage.tsx
├── ZohoInventoryCutoverPage.tsx
└── ZohoReconciliationPage.tsx
```

## 26. Definition of done

Integrasi dianggap selesai jika:

1. Tidak ada pemanggilan Zoho Inventory API.
2. Seluruh produk aktif mapped ke Zoho Books Items.
3. Barang inventory memakai `product_type=goods` dan `item_type=inventory`.
4. Akun Persediaan dan HPP terpasang pada setiap inventory item.
5. Saldo Zoho existing dibaca dan diadopsi sebagai opening balance RAHO;
   `initial_stock` Zoho hanya dipakai untuk item baru yang belum ada di Zoho.
6. Pembelian, penjualan, pemakaian, adjustment, dan reversal tidak menciptakan
   dampak ganda.
7. Quantity dan nilai RAHO versus Zoho berada dalam tolerance yang disetujui.
8. Retry aman dan idempotent.
9. Kegagalan Zoho tidak menghentikan transaksi RAHO.
10. Token aman dan seluruh tindakan administratif tercatat.
11. UAT ZB-01 sampai ZB-10 lulus.
12. Finance dan Product Owner menandatangani hasil cutover.

## 27. Referensi resmi

- [Zoho Books OAuth](https://www.zoho.com/books/api/v3/oauth/)
- [Zoho Books API Introduction](https://www.zoho.com/books/api/v3/introduction/)
- [Zoho Books Organizations API](https://www.zoho.com/books/api/v3/organizations/)
- [Zoho Books Items API](https://www.zoho.com/books/api/v3/items/)
- [Zoho Books Inventory Adjustments Help](https://www.zoho.com/us/books/help/items/item-adjustments.html)
- [Zoho Books Purchase Orders API](https://www.zoho.com/books/api/v3/purchase-order/)
- [Zoho Books Inventory Reports](https://www.zoho.com/in/books/help/reports/inventory.html)
