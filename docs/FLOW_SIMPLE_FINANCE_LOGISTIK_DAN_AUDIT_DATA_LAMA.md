# Flow Simple Finance dan Logistik serta Audit Data Lama

**Tanggal audit:** 12 Agustus 2026

**Sumber:** implementasi API, skema Prisma, migration, dan test otomatis di repository

## 1. Kesimpulan Singkat

Flow Finance dan Logistik **sudah benar pada level desain dan logic aplikasi**.
Transaksi utama sudah memakai status, approval, idempotency, transaction
boundary, ledger, jurnal, dan reversal.

Namun status keamanan data lama saat ini adalah:

> **BLOCKED: backup/restore aman, tetapi data sumber belum lolos rekonsiliasi.**

Sebanyak **34 test suite / 125 test** Finance, invoice, payment, revenue,
purchasing, inventory, session completion, laporan, dan compatibility data lama
lulus pada 12 Agustus 2026. Restore dan migration rehearsal lokal juga berhasil,
tetapi go-live audit menemukan tujuh blocker rekonsiliasi pada data sumber.

Jangan deploy atau mengaktifkan transaksi Finance/Logistik production sebelum
seluruh blocker pada bagian 6 menjadi `PASS`.

## 2. Flow Finance Sederhana

### 2.1 Pembayaran member dan pengakuan omzet

```text
Paket dibuat
  -> Invoice dibuat/final
  -> Pembayaran dicatat
  -> Finance verifikasi
  -> Kas/Bank + jurnal ter-posting
  -> Dana paket masuk Deferred Revenue
  -> Sesi terapi selesai
  -> Voucher terpakai + stok material berkurang FIFO
  -> Revenue dan HPP diakui
  -> P&L, GL, Trial Balance, dan laporan diperbarui
```

Aturan penting:

- pembayaran `PENDING` belum mengubah kas atau mengaktifkan nilai finance;
- hanya pembayaran `VERIFIED` yang boleh diposting;
- partial payment memperbarui outstanding sesuai nominal aktual;
- satu payment hanya boleh membentuk satu cash transaction dan satu jurnal;
- paket berbayar baru wajib memiliki deferred-revenue contract;
- completion sesi baru harus atomic: jika stok atau finance gagal, seluruh proses
  batal dan tidak boleh ada posting sebagian;
- koreksi transaksi posted dilakukan dengan refund/reversal, bukan menghapus data.

### 2.2 Expense

```text
Expense dibuat
  -> Evidence dilampirkan
  -> Approval sesuai policy
  -> Pembayaran
  -> Kas/Bank + jurnal beban ter-posting
  -> Laporan Finance diperbarui
```

### 2.3 Purchasing dan utang supplier

```text
Purchase Request
  -> Approval
  -> Purchase Order
  -> Goods Receipt
  -> Stok + FIFO layer bertambah
  -> Supplier Invoice
  -> Accounts Payable bertambah
  -> Supplier Payment
  -> Kas/Bank berkurang dan AP berkurang
```

Goods Receipt dan Supplier Invoice adalah dua kejadian berbeda. Receipt
mengakui barang yang benar-benar diterima; invoice supplier mengakui tagihan.

## 3. Flow Logistik Sederhana

### 3.1 Distribusi stok Logistik Pusat ke cabang

```text
Cabang membuat Request Stok
  -> Logistik review
  -> Reject / approve sebagian / approve penuh
  -> Stok di-reserve
  -> Shipment disiapkan
  -> Dispatch: stok sumber keluar dan menjadi in-transit
  -> Cabang menerima jumlah aktual
  -> Stok tujuan masuk
  -> Selisih/rusak masuk discrepancy untuk diselesaikan
```

Aturan penting:

- quantity yang dikirim tidak boleh melebihi reservation;
- reservation mencegah stok yang sama dipakai transaksi lain;
- penerimaan memakai jumlah aktual, bukan otomatis jumlah kirim;
- partial receipt dan barang rusak tidak boleh dipaksa menjadi `COMPLETED`;
- pergerakan internal mempertahankan nilai FIFO dari sumber ke tujuan;
- retry dispatch/receipt tidak boleh membuat mutasi ganda.

### 3.2 Barang masuk dari supplier

```text
PO approved
  -> Goods Receipt parsial/final
  -> Validasi item, UOM, batch, expiry, kondisi, dan quantity
  -> Stok bertambah
  -> Cost layer FIFO terbentuk
  -> Barang bermasalah masuk quarantine
```

### 3.3 Pemakaian dan koreksi stok

```text
Sesi terapi selesai -> Material Usage -> Stok keluar FIFO
Stock Opname        -> Selisih fisik -> Approval -> Adjustment
Barang rusak/hilang -> Adjustment resmi -> Mutasi + jurnal
```

Ledger atau saldo stok tidak boleh diedit langsung untuk memperbaiki transaksi
posted. Gunakan reversal, opname, atau adjustment dengan alasan dan audit trail.

## 4. Hubungan Finance dan Logistik

| Kejadian | Dampak stok | Dampak Finance |
|---|---:|---:|
| Payment member verified | Tidak langsung | Kas naik, outstanding turun, deferred naik |
| Sesi terapi completed | Material turun FIFO | Deferred turun, revenue dan HPP diakui |
| Goods Receipt supplier | Stok dan FIFO naik | GRNI/inventory sesuai policy |
| Supplier Invoice posted | Tidak mengubah quantity | AP bertambah |
| Supplier Payment posted | Tidak mengubah quantity | Kas turun, AP turun |
| Shipment internal | Sumber turun, in-transit lalu tujuan naik | Nilai inventory tetap dapat ditelusuri |
| Stock Opname/Adjustment | Quantity dikoreksi | Gain/loss inventory dijurnal |
| Refund/Reversal | Sesuai source asli | Posting lawan, histori asli tetap ada |

Zoho Books adalah integrasi asynchronous. Transaksi lokal RAHO tetap menjadi
sumber operasional dan tidak boleh gagal hanya karena Zoho sedang tidak aktif.

## 5. Perlindungan Data Lama yang Sudah Ada

| Perlindungan | Penerapan | Status audit |
|---|---|---|
| Paket lama tidak dipaksa ke deferred flow baru | `revenueFlowVersion = 1`; paket baru memakai versi 2 | Benar |
| Sesi lama tidak dipaksa melalui kontrak completion baru | `completionFlowVersion = 1`; sesi baru memakai versi 2 | Benar |
| Paket lama tanpa invoice/contract tetap dapat dipakai secara aman | Hanya `revenueFlowVersion = 1` yang boleh masuk compatibility path | Benar, fail-closed |
| Kombinasi Basic/Booster legacy dan current | Hanya paket legacy yang dilewati; paket current tetap diposting normal | Benar |
| ID paket historis tidak putus saat edit | Update dilakukan in-place; penghapusan bundle menjadi soft-cancel | Benar |
| Payment lama memiliki kunci unik | Migration memberi `LEGACY:INVOICE_PAYMENT:<id>` | Benar secara kode |
| Lokasi stok lama belum terisi | Field lama diterima dan scope default ditentukan sistem | Benar |
| Saldo pada kolom stok lama belum masuk ledger baru | Compatibility reconciliation menjembatani selisih yang valid | Benar |
| Retry transaksi | Unique idempotency key, payload hash, row lock, dan serializable transaction | Benar |
| Koreksi posted | Refund/reversal menjaga dokumen asli dan audit trail | Benar |

Prinsip cut-off:

- data lama tetap memakai aturan lama;
- transaksi baru memakai aturan Finance/Logistik terbaru;
- jangan membuat jurnal, deferred revenue, atau cost layer historis berdasarkan
  tebakan;
- jangan mengubah ID, foreign key, nomor dokumen, atau status historis secara
  massal;
- transaksi historis Zoho tidak dikirim ulang sebagai transaksi baru.

## 6. Hasil Safety Rehearsal dan Blocker Production

### 6.1 Pemeriksaan teknis yang sudah lulus

- Backup Sprint 11 berhasil direstore dengan 78 migration applied.
- Seluruh migration lanjutan berhasil diterapkan hingga schema repository
  terbaru; `prisma migrate status` menyatakan schema up to date.
- Migration logistik historis
  `20260520074117_add_stock_request_partnership_flow` sudah berada di baseline
  backup tersebut, sehingga tidak dijalankan ulang terhadap tabel lama berisi
  data pada rehearsal ini.
- Backup/restore database development berisi 441 member, 154 paket, 115 invoice,
  339 inventory item, dan 9 sesi lulus.
- Rehearsal membandingkan **38 tabel kritis** memakai dua fingerprint isi per
  tabel dan **28 control total** nominal/quantity; seluruh hasil sumber dan
  restore identik.
- Dua permission yang hilang, `INVENTORY.OPNAME.CREATE` dan
  `WORKFLOW.RULE.MANAGE`, diperbaiki melalui migration idempotent
  `20260812100000_repair_missing_finance_logistics_permissions`.
- Delapan PostgreSQL integration suite untuk payment, opening balance,
  purchasing/AP, goods receipt, FIFO concurrency, reservation, shipment, dan
  session completion legacy/current lulus 21/21 test.
- Runtime tidak lagi menebak paket legacy dari status `ACTIVE`; hanya versi flow
  eksplisit yang boleh melewati deferred-revenue contract.

Evidence lokal:

- `backups/finance-logistics-safety/raho-raho-db-20260812T042459Z.dump`
- SHA-256:
  `ed8f68375ead81ac2ee347aab56ecc801e82548a80285cfa35d6a06d3f767336`
- restore evidence berstatus `PASS`.

### 6.2 Blocker data yang masih gagal

| Gate | Temuan | Tindakan wajib |
|---|---|---|
| `FIN-002` | Kas `KAS-SBY`: ledger Rp100.050.000, subledger Rp0 | Finance menetapkan saldo awal/source document, lalu posting Opening Balance resmi |
| `FIN-003` | Deferred ledger Rp5.950.000, subledger Rp157.350.000; selisih Rp151.400.000 | Rekonsiliasi invoice/payment/package contract per sumber; jangan membuat jurnal tebakan |
| `OPEN-001` | Belum ada Opening Balance posted | Finance menyiapkan dan menyetujui cutover balance |
| `INV-001` | 66 dari 339 item tidak cocok antara compatibility stock, balance, dan layer | Logistik melakukan stock opname/cutover reconciliation per item |
| `INV-003` | 268 cost layer aktif masih `PENDING_VALUATION` | Finance/Logistik mengisi unit cost berdasarkan dokumen sumber |
| `INV-004` | 74 mutation chain legacy tidak konsisten | Rekonstruksi hanya dari dokumen sumber atau opening stock resmi |
| `INV-005` | Nilai subledger Rp3.600, ledger -Rp1.400; selisih Rp5.000 | Posting koreksi resmi setelah valuation disetujui |

Hal yang sudah lulus pada audit database:

- 21 jurnal posted balanced;
- 19/19 cabang memiliki accounting period terbuka;
- tidak ada balance quantity negatif;
- permission catalog lengkap setelah repair migration;
- role template tersedia;
- tidak ada domain event `FAILED`.

Angka blocker tidak boleh diperbaiki otomatis karena sistem tidak dapat
menentukan unit cost, saldo awal, atau sumber kas yang benar tanpa dokumen dan
persetujuan Finance/Logistik.

## 7. Status Akhir dan Gate Deployment

| Pemeriksaan | Hasil 12 Agustus 2026 |
|---|---|
| Audit flow dari source code | Lulus |
| Regression terarah | 34 suite / 125 test lulus |
| PostgreSQL integration | 8 suite / 21 test lulus |
| Guard legacy package/session | Lulus |
| Idempotency dan atomicity contract | Lulus |
| Prisma validate dan TypeScript | Lulus |
| Restore database development | PASS; 38 tabel dan 28 control total identik |
| Upgrade backup lama ke schema terbaru | Lulus |
| Permission catalog | Lulus setelah repair migration |
| Go-live audit | **BLOCKED: 7 blocker data** |
| Restore backup production terbaru | Belum tersedia pada audit ini |
| Status deploy ke production | **DIBLOKIR** |

Deployment baru dinyatakan aman jika:

```text
Backup production berhasil direstore
  -> seluruh migration berhasil
  -> count dan total sebelum/sesudah cocok
  -> legacy sample test lulus
  -> go-live audit READY
  -> Finance dan Logistik menyetujui hasil rekonsiliasi
```

Dokumen lengkap: [Flow Finance dan Logistik RAHO Terbaru](./FLOW_FINANCE_DAN_LOGISTIK_TERBARU.md).
