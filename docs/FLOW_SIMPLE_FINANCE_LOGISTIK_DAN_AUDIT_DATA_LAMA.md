# Flow Simple Finance dan Logistik serta Audit Data Lama

**Tanggal audit:** 12 Agustus 2026

**Sumber:** implementasi API, skema Prisma, migration, dan test otomatis di repository

## 1. Kesimpulan Singkat

Flow Finance dan Logistik **sudah kuat pada level mesin transaksi dan kontrol
internal aplikasi**, tetapi **belum dapat dinyatakan sebagai sistem pelaporan
keuangan lengkap yang patuh SAK**. Transaksi utama sudah memakai status,
approval, idempotency, transaction boundary, ledger, jurnal, dan reversal.

Setelah repair 12 Agustus 2026, status keamanan data lama saat ini adalah:

> **BLOCKED: backup/restore aman dan 11/14 gate lulus, tetapi tiga nilai opening
> data lama masih memerlukan dokumen dan persetujuan Finance/Logistik.**

Regresi repository terbaru meluluskan **127 test suite / 702 test**; 13 suite / 28
test PostgreSQL dilewati oleh guard karena runner umum tidak boleh memakai
database aplikasi. Suite database terpisah dan restore rehearsal juga sudah
lulus. Namun go-live audit masih menemukan tiga blocker rekonsiliasi pada data
sumber.

Jangan deploy atau mengaktifkan transaksi Finance/Logistik production sebelum
seluruh blocker pada bagian 7 menjadi `PASS`.

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

## 5. Kesesuaian dengan Standar Keuangan

Referensi audit ini adalah SAK Indonesia yang efektif dan prinsip yang
konvergen dengan IFRS. Pengakuan pendapatan mengacu pada model kewajiban
pelaksanaan PSAK 115/IFRS 15; persediaan mengacu pada prinsip biaya dan nilai
realisasi neto IAS 2/PSAK Persediaan.

| Area standar | Penerapan RAHO | Kesimpulan |
|---|---|---|
| Basis akrual dan double-entry | Jurnal debit/kredit, periode, posting, source link, reversal | Sesuai pada level mesin transaksi |
| Pendapatan paket | Pembayaran masuk deferred; omzet dilepas ketika sesi/benefit dipenuhi | Secara konsep selaras PSAK 115, policy alokasi tetap perlu sign-off Finance |
| Persediaan/HPP | Quantity ledger, FIFO layer, HPP saat material dipakai, transfer mempertahankan nilai | Secara konsep selaras cost-flow persediaan |
| Persediaan pada nilai terendah cost/NRV | Belum ditemukan workflow formal uji NRV dan write-down | Belum lengkap |
| Laporan keuangan | Ada P&L, posisi keuangan, perubahan ekuitas, Trial Balance, General Ledger, kas/bank, deferred, rekonsiliasi | Belum ada arus kas dan catatan laporan keuangan |
| Rekonsiliasi bank | Ada pembandingan GL dengan subledger internal | Belum sama dengan rekonsiliasi terhadap rekening koran eksternal |
| Pajak invoice | Field historis dipertahankan; create/update dan payment berpajak sekarang fail-closed | Aman sampai desain akun liabilitas pajak disetujui dan diuji |
| AP/AR aging | Aging bucket formal tersedia dari current operational subledger | Lengkap untuk snapshot saat ini; bukan rekonstruksi saldo historis |

RAHO saat ini tepat diposisikan sebagai **operational ERP/subledger**. Zoho Books
dirancang sebagai general ledger dan reporting resmi, tetapi status integrasi
per 12 Agustus 2026 masih `CANARY`, bukan `LIVE`: cabang canary PST,
`mismatchFreeBusinessDays = 0`, 23 event tertahan di luar canary, 0 dead letter,
dan rekonsiliasi terakhir 162/162 matched tanpa exception. Karena itu sign-off
laporan resmi belum boleh hanya bergantung pada hasil audit kode ini.

## 6. Perlindungan Data Lama yang Sudah Ada

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

## 7. Hasil Safety Rehearsal dan Blocker Production

### 7.1 Pemeriksaan teknis yang sudah lulus

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
- Backup terbaru setelah diagnosis berhasil direstore dengan SHA-256
  `a8da57cf85708f75f547a0a84957c6375ea7ca4099299d7f9b8deca3ac634f2e`.
- Dua permission yang hilang, `INVENTORY.OPNAME.CREATE` dan
  `WORKFLOW.RULE.MANAGE`, diperbaiki melalui migration idempotent
  `20260812100000_repair_missing_finance_logistics_permissions`.
- Database integration test sekarang wajib memakai `TEST_DATABASE_URL` yang
  terpisah dan bernama test/restore/rehearsal; runner menolak database aplikasi.
- Cabang integration-test Sprint 9 dikarantina sebagai nonaktif dan dua jurnal
  berlabel ganda `UAT:`/source `UAT` dibersihkan melalui migration terjaga.
- Sembilan cabang dan 21 akun fixture approval/payment/reservation/shipment lama
  dikarantina tanpa delete. Tidak ada event fixture yang masih bisa diproses.
- Cabang virtual `EXT` tidak dapat dipilih sebagai canary Zoho dan tidak lagi
  masuk hitungan periode maupun transfer internal pada go-live audit.
- Laporan Finance sekarang memasukkan jurnal asli berstatus `REVERSED` bersama
  jurnal pembaliknya, sehingga efek bersih reversal tetap nol dan histori asli
  tetap terlihat.
- Laporan posisi keuangan, perubahan ekuitas, AR aging, dan AP aging sudah
  tersedia dengan branch scope dan permission server-side. Aging diberi label
  current snapshot agar tidak disalahartikan sebagai rekonstruksi historis.
- Laporan posisi keuangan membedakan `balanced` dari `dataQuality.complete`.
  Opening Balance yang belum posted dan pending valuation tetap muncul sebagai
  peringatan meskipun persamaan debit/kredit seimbang.
- Pajak invoice nonnol diblokir sebelum create/update dan sebelum payment
  posting, karena akun liabilitas pajaknya belum dikonfigurasi. Pemeriksaan
  database membuktikan tidak ada invoice lama dengan tax amount nonnol.
- Tab dan filter Finance Report disimpan lokal sehingga tetap kembali ke state
  terakhir setelah pengguna pindah section.
- Audit inventory hanya mencakup cabang operasional aktif, mengecualikan cabang
  virtual `EXT`, dan memulai mutation chain baru dari checkpoint migration
  legacy. `FIN-002`, `INV-001`, `INV-004`, `INV-005`, dan `SEC-001` kini lulus.
- Delapan PostgreSQL integration suite untuk payment, opening balance,
  purchasing/AP, goods receipt, FIFO concurrency, reservation, shipment, dan
  session completion legacy/current lulus 21/21 test.
- Tujuh suite go-live database juga dibuktikan pada database disposable baru
  yang hanya berisi migration: seluruh test lulus. Fixture payment sekarang
  membuat dan membersihkan role/permission test sendiri, tanpa bergantung pada
  seed maupun data aplikasi lama.
- Opening Balance sekarang selalu memakai **maker-checker berbeda**. Maker,
  termasuk akun Finance, tidak dapat mem-posting atau menolak dokumennya sendiri.
- Valuasi stok legacy dipisahkan dari adjustment operasional. Valuasi hanya
  berjalan ketika adjustment `0`, `unitCost` diberikan eksplisit, referensi
  invoice/PO/GR/dokumen opening stock diisi, dan reason
  `LEGACY_OPENING_VALUATION` digunakan. Jurnal lawannya masuk akun ekuitas
  `3100`, bukan gain operasional `4300`.
- Dari 268 item yang masih pending valuation, hanya 8 mempunyai kandidat harga
  dari PO dan 260 tidak mempunyai bukti harga di database. Kandidat tersebut
  tetap tidak diposting otomatis: Finance/Logistik wajib mencocokkannya dengan
  dokumen sumber.
- Runtime tidak lagi menebak paket legacy dari status `ACTIVE`; hanya versi flow
  eksplisit yang boleh melewati deferred-revenue contract.

Evidence lokal terbaru:

- `backups/finance-logistics-standard-audit/raho-raho-db-20260812T074209Z.dump`
- SHA-256:
  `a8da57cf85708f75f547a0a84957c6375ea7ca4099299d7f9b8deca3ac634f2e`
- restore evidence berstatus `PASS`.

### 7.2 Blocker data yang masih gagal

| Gate | Temuan | Tindakan wajib |
|---|---|---|
| `FIN-003` | 49 funding legacy Rp151.400.000 belum memiliki opening journal: PST Rp121.000.000, SBY Rp18.250.000, BDG Rp12.150.000 | Finance memverifikasi saldo terhadap dokumen pembayaran lalu mem-posting Opening Balance resmi; jangan membuat jurnal tebakan |
| `OPEN-001` | Belum ada Opening Balance posted | Finance menyiapkan, maker submit, checker menyetujui, lalu sistem mem-posting jurnal dan subledger |
| `INV-003` | 268 layer legacy / 295.306,5 unit belum memiliki cost: masing-masing 67 layer pada HQ, PST, SBY, dan BDG | Finance/Logistik mengisi unit cost berdasarkan invoice/PO/GR atau dokumen opening stock melalui flow valuasi yang tersedia |

Hal yang sudah lulus pada audit database:

- seluruh jurnal posted operasional balanced;
- 4/4 cabang operasional aktif memiliki accounting period terbuka;
- tidak ada balance quantity negatif;
- permission catalog lengkap setelah repair migration;
- role template tersedia;
- tidak ada domain event `FAILED`.

Angka blocker tidak boleh diperbaiki otomatis karena sistem tidak dapat
menentukan unit cost, saldo awal, atau sumber kas yang benar tanpa dokumen dan
persetujuan Finance/Logistik.

## 8. Status Akhir dan Gate Deployment

| Pemeriksaan | Hasil 12 Agustus 2026 |
|---|---|
| Audit flow dari source code | Lulus |
| Regression repository | 127 suite / 702 test lulus; 13 suite / 28 test database dilewati oleh guard runner umum |
| PostgreSQL integration | 8 suite / 21 test lulus |
| Integration pada database migration-only | 7 suite / 12 test lulus; termasuk maker-checker Opening Balance; database disposable sudah dihapus |
| Guard legacy package/session | Lulus |
| Idempotency dan atomicity contract | Lulus |
| Prisma validate dan TypeScript | Lulus |
| Restore database development | PASS; 38 tabel dan 28 control total identik |
| Upgrade backup lama ke schema terbaru | Lulus |
| Permission catalog | Lulus setelah repair migration |
| Go-live audit | **BLOCKED: 3 blocker data; 11/14 gate lulus** |
| Zoho Books | Terkoneksi; rekonsiliasi terakhir 162/162 matched; masih CANARY dan belum memenuhi 5 hari bebas mismatch |
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
