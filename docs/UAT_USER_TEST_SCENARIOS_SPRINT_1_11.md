# User Acceptance Test Scenarios Sprint 1-11

## Document Metadata

| Field | Value |
|---|---|
| Document ID | `RAHO-UAT-P0-S01-S11` |
| Version | `1.0` |
| Prepared date | 23 Juli 2026 (Asia/Jakarta) |
| Scope | Seluruh fitur P0 dan integrasi AC-001 sampai AC-006 dari Sprint 1 sampai Sprint 11 |
| Audience | UAT Coordinator, Product Owner, Finance, Logistics, Operations, Developer A, Developer B, dan GPT/test automation agent |
| Execution status | `NOT_RUN`, `PASS`, `FAIL`, atau `BLOCKED` |
| Business sign-off | Wajib diberikan manusia yang berwenang; hasil otomatis tidak boleh dianggap sebagai tanda tangan |

## 1. Tujuan dan Aturan Penggunaan

Dokumen ini adalah sumber skenario UAT yang dapat dijalankan oleh pengguna bisnis,
tester manual, atau diterjemahkan GPT menjadi test case otomatis. Setiap skenario
memiliki ID stabil, aktor, channel, prasyarat, data, langkah, hasil yang diharapkan,
dan evidence.

Aturan eksekusi:

1. Jalankan skenario berurutan berdasarkan sprint karena data sprint berikutnya
   bergantung pada master dan transaksi sprint sebelumnya.
2. Gunakan database UAT disposable, bukan database produksi.
3. Jangan mengubah transaksi `POSTED`; gunakan reversal atau cancellation flow.
4. Untuk skenario negatif, test dinyatakan `PASS` jika sistem menolak aksi dan
   tidak mengubah data.
5. Untuk skenario idempotency, test dinyatakan `PASS` jika retry mengembalikan
   hasil transaksi yang sama tanpa membuat posting kedua.
6. Untuk setiap perubahan quantity atau nilai, verifikasi layar operasional dan
   ledger terkait. Toast sukses saja tidak cukup.
7. Simpan screenshot, nomor dokumen, response/error code, journal number, dan
   timestamp sebagai evidence.

## 2. Kontrak Struktur untuk GPT

GPT atau automation agent harus membaca setiap skenario sebagai objek berikut:

```yaml
scenario:
  id: stable_unique_id
  sprint: 1_to_11
  priority: P0
  actors: [role_or_test_user]
  channel: ui_or_api_or_cli
  preconditions: [required_state]
  test_data: [deterministic_values]
  steps:
    - action: user_or_system_action
      expected: observable_result
  invariants: [data_integrity_rules]
  evidence: [required_artifacts]
  mappings: [feature_or_acceptance_criterion]
```

GPT tidak boleh menandai skenario `PASS` hanya dari dokumen ini. Status hanya
boleh berubah setelah langkah dijalankan dan evidence tersedia.

## 3. Aktor UAT

| Actor ID | Role/permission | Scope |
|---|---|---|
| `USR-SA` | `SUPER_ADMIN` | Semua cabang dan konfigurasi sistem |
| `USR-AM-A` | `ADMIN_MANAGER`, full access | Cabang Pusat dan Cabang A |
| `USR-AM-B` | `ADMIN_MANAGER`, full access | Cabang B saja; role sejajar dengan `USR-AM-A` |
| `USR-AC-A` | `ADMIN_CABANG` | Cabang A |
| `USR-AC-B` | `ADMIN_CABANG` | Cabang B |
| `USR-LOG-MAKER` | `ADMIN_LOGISTIK` | Membuat/posting transaksi logistik sesuai permission |
| `USR-LOG-APPROVER` | User dengan permission approval inventory | Approver; harus berbeda dari maker |
| `USR-FIN-MAKER` | User finance maker | Membuat journal, opening, expense, invoice, atau AP |
| `USR-FIN-APPROVER` | User finance checker/approver | Posting/approval; harus berbeda dari maker |
| `USR-AL-A` | `ADMIN_LAYANAN` | Cabang A |
| `USR-DOC-A` | `DOCTOR` | Cabang A |
| `USR-NURSE-A` | `NURSE` | Cabang A/homecare |
| `USR-MEMBER-A` | `MEMBER` | Member untuk paket dan treatment |

Permission, bukan nama role saja, adalah sumber otorisasi. Bila environment UAT
memakai assignment berbeda, catat user aktual pada execution record.

## 4. Data Uji Standar

### 4.1 Organization dan master

| Data ID | Nilai |
|---|---|
| `BR-PUSAT` | Branch type `PUSAT`, kode `UAT-PST` |
| `BR-A` | Branch type `PREMIER`, kode `UAT-A` |
| `BR-B` | Branch type `PARTNERSHIP`, kode `UAT-B` |
| `WH-PUSAT` | Warehouse default Pusat, kode `WH-UAT-PST` |
| `WH-A` | Warehouse default Cabang A, kode `WH-UAT-A` |
| `LOC-PST-GOOD` | Lokasi stok baik di Pusat |
| `LOC-A-GOOD` | Lokasi stok baik di Cabang A |
| `LOC-A-QUAR` | Lokasi quarantine Cabang A |
| `UOM-VIAL` | Base UOM `VIAL`, precision 4 |
| `UOM-BOX` | UOM `BOX`, 1 BOX = 10 VIAL untuk produk uji |
| `PRD-VITC` | SKU `UAT-VITC`, category `MEDICINE`, batch dan expiry wajib |
| `PRD-SET` | SKU `UAT-INF-SET`, category `CONSUMABLE`, tanpa expiry |

### 4.2 Batch dan nilai

| Data ID | Quantity | Unit cost | Kondisi |
|---|---:|---:|---|
| `BAT-OLD` | 10 VIAL | 100.00 | Valid, received paling awal |
| `BAT-NEW` | 10 VIAL | 150.00 | Valid, received setelah `BAT-OLD` |
| `BAT-EXP` | 5 VIAL | 80.00 | Expired pada tanggal transaksi |
| `BAT-DMG` | 3 VIAL | 90.00 | Quarantine/damaged |

### 4.3 Finance, purchasing, dan treatment

| Data ID | Nilai |
|---|---|
| `INV-PKG-01` | Invoice paket member sebesar 1,000.00 |
| `PAY-01` | Pembayaran pertama 600.00 |
| `PAY-02` | Pembayaran kedua 400.00 |
| `EXP-01` | Expense operasional 300.00 |
| `SUP-01` | Supplier aktif `UAT Supplier Medis` |
| `PR-01` | Purchase Request 10 VIAL `PRD-VITC` |
| `PO-01` | Purchase Order 10 VIAL x 120.00 = 1,200.00 |
| `GR-01A` | Partial receipt 6 VIAL dari `PO-01` |
| `GR-01B` | Final receipt 4 VIAL dari `PO-01` |
| `BOM-01` | BOM aktif membutuhkan 2 VIAL `PRD-VITC` dan 1 `PRD-SET` |
| `SES-01` | Session treatment member `USR-MEMBER-A` di Cabang A |

## 5. Global Acceptance Invariants

Invariants berikut berlaku pada seluruh skenario:

- `AUTH-01`: user hanya melihat cabang dan aksi sesuai role serta permission efektif.
- `AUD-01`: create, update, approve, reject, post, reverse, login, dan aksi sensitif
  memiliki audit actor, timestamp, resource, serta before/after yang relevan.
- `FIN-01`: journal posted selalu total debit sama dengan total credit.
- `FIN-02`: transaksi pada period `CLOSED` atau `LOCKED` ditolak.
- `INV-01`: on-hand tidak pernah negatif.
- `INV-02`: `onHand = available + reserved + quarantine` sesuai model bucket yang berlaku.
- `INV-03`: mutation bersifat append-only dan memiliki source reference.
- `INV-04`: remaining quantity cost layer tidak negatif.
- `IDEM-01`: key/payload sama menghasilkan replay; key sama dengan payload berbeda ditolak.
- `MCK-01`: maker tidak boleh menyetujui transaksi yang membutuhkan checker berbeda.
- `BR-01`: akses horizontal ke cabang di luar scope ditolak dan tidak membocorkan data.

## 6. Sprint 1 - IAM, Organization, dan Master Dasar

### UAT-S01-01 - Role sejajar dan branch isolation

| Field | Value |
|---|---|
| Actors | `USR-SA`, `USR-AM-A`, `USR-AM-B` |
| Channel | UI `/admin/managers`, `/admin/permissions`, lalu halaman bercabang |
| Preconditions | Kedua Admin Manager aktif dan memiliki role sama dengan branch assignment berbeda |
| Mapping | AC-005, `AUTH-01`, `BR-01` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Login sebagai `USR-AM-A` dan buka daftar cabang/data Cabang A. | Cabang A tersedia dan dapat dibaca sesuai permission. |
| 2 | Coba buka resource Cabang B melalui URL langsung atau request API dengan `branchId=BR-B`. | Sistem mengembalikan `403`/not-found terproteksi; data Cabang B tidak tampil. |
| 3 | Login sebagai `USR-AM-B` dan ulangi terhadap Cabang A. | Akses ditolak dengan hasil setara; role sejajar tidak mewarisi scope user lain. |
| 4 | Login `USR-SA` dan buka kedua cabang. | Keduanya dapat diakses karena scope global. |

Evidence: screenshot menu setiap user, response akses horizontal, dan audit login.

### UAT-S01-02 - Permission template, override deny, dan anti-self-escalation

| Field | Value |
|---|---|
| Actors | `USR-SA`, `USR-AM-A` |
| Channel | UI `/admin/permissions` |
| Preconditions | Role template Admin Manager aktif; siapkan satu permission uji, misalnya `INVENTORY.MASTER.MANAGE` |
| Mapping | IAM granular permission, AC-005 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Sebagai `USR-SA`, pastikan template memberikan permission uji kepada Admin Manager. | `USR-AM-A` dapat melihat dan menjalankan aksi terkait. |
| 2 | Tambahkan user override `DENY` untuk permission tersebut pada `USR-AM-A`. | Aksi create/update master hilang atau request ditolak server. |
| 3 | Hapus override deny atau buat override allow sesuai policy. | Permission efektif kembali sesuai konfigurasi. |
| 4 | Sebagai `USR-AM-A`, coba menaikkan permission/role milik sendiri. | Sistem menolak self-escalation dan mencatat audit keamanan. |

Evidence: permission efektif sebelum/sesudah override, response self-escalation, audit log.

### UAT-S01-03 - Branch dan branch type

| Field | Value |
|---|---|
| Actors | `USR-SA` |
| Channel | UI `/branches` |
| Preconditions | Kode `UAT-PST`, `UAT-A`, dan `UAT-B` belum digunakan |
| Mapping | Branch type `PUSAT`, `PREMIER`, `PARTNERSHIP` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat `BR-PUSAT`, `BR-A`, dan `BR-B` dengan branch type masing-masing. | Ketiga cabang tersimpan aktif dan kodenya unik. |
| 2 | Coba buat cabang lain dengan kode `UAT-A`. | Sistem menolak duplikasi tanpa membuat record kedua. |
| 3 | Ubah nama Cabang A. | Nama berubah, kode dan type tetap konsisten, audit before/after tersedia. |
| 4 | Nonaktifkan cabang yang tidak memiliki transaksi uji. | Cabang tidak muncul sebagai pilihan transaksi baru, tetapi riwayat tetap dapat diaudit. |

Evidence: daftar cabang, pesan duplikasi, dan audit create/update/deactivate.

### UAT-S01-04 - Warehouse dan stock location

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-AC-A` |
| Channel | UI `/inventory/master-data`, tab `Warehouse & Lokasi` |
| Preconditions | `BR-PUSAT` dan `BR-A` aktif |
| Mapping | Inventory master, `AUTH-01`, `BR-01` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat `WH-PUSAT` sebagai warehouse default `BR-PUSAT`. | Warehouse aktif, terikat ke Pusat, dan ditandai default. |
| 2 | Buat `WH-A`, `LOC-A-GOOD`, dan `LOC-A-QUAR` untuk Cabang A. | Lokasi tampil di bawah warehouse yang benar. |
| 3 | Coba membuat lokasi Cabang A di warehouse Pusat. | Server menolak cross-branch relationship. |
| 4 | Login `USR-AC-A` dan lihat master. | Hanya master dalam scope yang dapat digunakan untuk transaksi Cabang A. |
| 5 | Coba nonaktifkan warehouse default yang masih dipakai. | Sistem menolak atau meminta penggantian default; referensi transaksi tidak rusak. |

Evidence: struktur warehouse-location, response cross-branch, dan audit.

### UAT-S01-05 - Product, category, batch/expiry flags

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | UI `/inventory/master-data`, tab `Produk` |
| Preconditions | `UOM-VIAL` tersedia |
| Mapping | Product/category/UOM master |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat `PRD-VITC` category `MEDICINE`, base UOM VIAL, `tracksBatch=true`, `tracksExpiry=true`. | Produk tersimpan aktif dengan SKU unik dan flags benar. |
| 2 | Buat `PRD-SET` category `CONSUMABLE` tanpa expiry. | Produk tersimpan dan tidak mewajibkan expiry pada receipt. |
| 3 | Coba membuat produk dengan SKU `UAT-VITC` lagi. | Duplikasi SKU ditolak. |
| 4 | Nonaktifkan produk yang belum dipakai, lalu coba gunakan pada transaksi baru. | Produk tidak dapat dipilih/diposting, tetapi master historis tetap ada. |

Evidence: detail dua produk, error SKU duplicate, dan status nonaktif.

### UAT-S01-06 - UOM dan conversion preview

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-NURSE-A` |
| Channel | UI `/inventory/master-data`, tab `UOM`; API conversion preview bila tombol tidak tersedia |
| Preconditions | `PRD-VITC`, `UOM-VIAL`, dan `UOM-BOX` aktif |
| Mapping | Unit conversion dan precision |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat UOM VIAL precision 4 dan BOX precision 0. | Kedua UOM tersimpan dengan precision yang benar. |
| 2 | Set conversion produk: 1 BOX = 10 VIAL. | Conversion aktif dan terikat ke produk yang benar. |
| 3 | Preview 2 BOX ke base UOM. | Hasil tepat 20 VIAL. |
| 4 | Preview 15 VIAL ke BOX jika arah konversi didukung. | Hasil 1.5 BOX atau ditampilkan sesuai precision/rule yang dikonfigurasi. |
| 5 | Masukkan faktor nol/negatif. | Validasi menolak faktor tidak valid tanpa menyimpan perubahan. |

Evidence: konfigurasi conversion, response preview, dan error faktor.

### UAT-S01-07 - Audit log untuk aksi sensitif

| Field | Value |
|---|---|
| Actors | `USR-SA`, seluruh maker Sprint 1 |
| Channel | UI `/admin/audit-logs` |
| Preconditions | Skenario `UAT-S01-01` sampai `UAT-S01-06` sudah dijalankan |
| Mapping | `AUD-01` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Filter audit berdasarkan actor, module, resource, dan tanggal UAT. | Log terkait dapat ditemukan tanpa melihat data cabang di luar scope. |
| 2 | Buka log create/update/deactivate master. | Actor, timestamp, resource ID, action, dan before/after relevan tersedia. |
| 3 | Buka log penolakan self-escalation atau akses terlarang. | Security event dapat ditelusuri sesuai policy logging. |
| 4 | Coba mengubah atau menghapus audit melalui UI/API umum. | Tidak ada fungsi update/delete atau request ditolak. |

Evidence: export/screenshot filter audit dan response immutable audit.

## 7. Sprint 2 - Accounting Foundation dan Inventory Ledger

### UAT-S02-01 - Chart of Accounts dan account posting policy

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER`, `USR-FIN-APPROVER` |
| Channel | UI `/accounting` |
| Preconditions | Permission `ACCOUNT.READ/MANAGE` tersedia |
| Mapping | Accounting foundation |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat account header/non-posting dan account detail/posting untuk asset, liability, revenue, dan expense. | Type, normal balance, parent, dan `allowPosting` tersimpan. |
| 2 | Coba post journal ke account header/non-posting. | Posting ditolak. |
| 3 | Coba mengubah type account yang sudah memiliki journal. | Perubahan berisiko ditolak atau dibatasi sesuai policy. |
| 4 | Nonaktifkan account detail lalu coba gunakan pada transaksi baru. | Account tidak dapat dipakai untuk posting baru; histori tetap terbaca. |

Evidence: account tree, error account non-posting/nonaktif, audit perubahan.

### UAT-S02-02 - Accounting period lifecycle

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER` |
| Channel | UI `/accounting`, bagian Period |
| Preconditions | Satu period UAT untuk bulan transaksi belum ada |
| Mapping | `FIN-02` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat period `OPEN` untuk bulan UAT dan branch/scope yang diuji. | Period aktif dan rentang tanggal tidak ambigu. |
| 2 | Post journal valid dalam period tersebut. | Posting berhasil. |
| 3 | Ubah period menjadi `CLOSED`, lalu coba post transaksi bertanggal di period itu. | Transaksi ditolak dan tidak ada journal/stock posting parsial. |
| 4 | Ubah menjadi `LOCKED` sesuai kewenangan dan periksa metadata. | `closedBy/closedAt` atau metadata lock terisi dan audit tersedia. |

Evidence: status period, journal valid, error closed period, audit status change.

### UAT-S02-03 - Manual journal balanced dan source traceability

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER` |
| Channel | UI `/accounting` |
| Preconditions | Period `OPEN`; dua account posting aktif |
| Mapping | `FIN-01`, source-document link |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat manual journal debit 500.00 dan credit 500.00. | Journal `POSTED`, nomor unik, total debit=credit. |
| 2 | Buka detail journal. | Branch, tanggal, actor, description, dan semua lines tampil. |
| 3 | Coba journal debit 500.00 dan credit 499.99. | Ditolak; tidak ada header journal yatim. |
| 4 | Cari journal berdasarkan source type/source ID yang tersedia. | Journal dapat ditelusuri kembali ke dokumen sumber. |

Evidence: journal number, lines balanced, response unbalanced, source link.

### UAT-S02-04 - Opening stock membentuk balance, mutation, dan cost layer

| Field | Value |
|---|---|
| Actors | `USR-LOG-APPROVER` |
| Channel | UI `/inventory/ledger` atau API opening stock |
| Preconditions | Master `PRD-VITC`, `LOC-PST-GOOD`, `BAT-OLD`; period `OPEN` |
| Test data | 10 VIAL x 100.00 |
| Mapping | Inventory ledger foundation, `INV-01` sampai `INV-04` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Post opening stock 10 VIAL pada `BAT-OLD`. | Posting `OPENING` berhasil dan mempunyai source reference. |
| 2 | Buka balance produk-lokasi-batch. | On-hand dan available bertambah 10; reserved/quarantine sesuai nol. |
| 3 | Buka mutation dan cost layer. | Mutation `RECEIVED`/opening mencatat before 0 after 10; layer original=remaining=10, unit cost 100.00. |
| 4 | Retry dengan idempotency key dan payload sama. | Record yang sama dikembalikan; tidak ada quantity/layer kedua. |
| 5 | Gunakan key sama dengan quantity berbeda. | Ditolak sebagai key reused dengan payload berbeda. |

Evidence: posting ID, mutation, balance, layer, dan jumlah record sebelum/sesudah retry.

### UAT-S02-05 - Batch, quantity buckets, dan reconciliation

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/master-data`, `/inventory/ledger` |
| Preconditions | Opening `BAT-OLD` selesai; `BAT-NEW`, `BAT-EXP`, dan `BAT-DMG` dibuat |
| Mapping | Batch/expiry, bucket, reconciliation |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Tambahkan receipt untuk `BAT-NEW`, `BAT-EXP`, dan stok quarantine `BAT-DMG`. | Setiap balance dipisahkan berdasarkan location/batch key. |
| 2 | Buka total produk. | Total on-hand sama dengan jumlah semua balance aktif. |
| 3 | Periksa available, reserved, dan quarantine. | Bucket tidak negatif dan persamaan bucket sesuai `INV-02`. |
| 4 | Jalankan reconciliation ledger. | Compatibility stock, balance, dan cost layer dilaporkan konsisten. |
| 5 | Coba mengedit mutation posted secara langsung melalui fungsi umum. | Tidak tersedia atau ditolak; koreksi harus reversal. |

Evidence: daftar batch/balance, hasil reconciliation, response immutability.

## 8. Sprint 3 - Invoice, Payment, Cash/Bank, dan FIFO

### UAT-S03-01 - Finalisasi invoice dan pembayaran parsial/penuh

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER`, `USR-MEMBER-A` |
| Channel | UI `/payments`; member UI `/me/invoices` |
| Preconditions | `INV-PKG-01` draft sebesar 1,000.00 |
| Mapping | Invoice snapshot, partial/full payment |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Finalize invoice. | Snapshot line/amount terkunci dan status siap dibayar. |
| 2 | Catat `PAY-01` 600.00 dengan bukti bayar. | Outstanding menjadi 400.00; status partial/pending verification sesuai flow. |
| 3 | Dari akun member, buka invoice. | Nilai invoice, payment, dan outstanding sama dengan layar staff. |
| 4 | Setelah `PAY-01` verified, catat `PAY-02` 400.00. | Outstanding nol dan invoice menjadi paid setelah verifikasi. |
| 5 | Coba ubah line invoice yang sudah finalized/paid. | Ditolak; snapshot tetap tidak berubah. |

Evidence: invoice snapshot, dua payment ID, outstanding per tahap.

### UAT-S03-02 - Verifikasi payment membentuk cash/bank dan journal

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER` |
| Channel | UI `/payments`, `/cash-bank`, `/accounting` |
| Preconditions | Payment 600.00 berstatus menunggu verifikasi; account kas/bank aktif |
| Mapping | Payment posting, AC-001, `FIN-01` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buka protected payment proof sebagai approver. | File dapat dilihat; URL/object tidak public. |
| 2 | Verifikasi payment ke cash/bank account yang dipilih. | Payment verified satu kali. |
| 3 | Buka cash/bank ledger. | Ada receipt 600.00 dengan source payment yang sama. |
| 4 | Buka journal dari source payment. | Journal posted, debit/credit balanced, branch dan period benar. |
| 5 | Ulangi verify pada payment sama. | Tidak membuat cash transaction atau journal kedua. |

Evidence: payment proof access, cash transaction ID, journal number, count sebelum/sesudah retry.

### UAT-S03-03 - Reject payment dan duplicate protection

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER`, `USR-FIN-MAKER` |
| Channel | UI `/payments` |
| Preconditions | Payment baru dengan bukti tidak valid |
| Mapping | Payment rejection, AC-006 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Reject payment dengan alasan wajib. | Status rejected, alasan terlihat, invoice outstanding tidak berkurang. |
| 2 | Periksa cash/bank dan journal. | Tidak ada posting finansial untuk payment rejected. |
| 3 | Submit ulang bukti sesuai flow yang tersedia. | Payment kembali dapat direview tanpa menghapus histori reject. |
| 4 | Kirim dua request verify bersamaan. | Maksimal satu posting; request lain replay/conflict yang aman. |

Evidence: rejection reason, ketiadaan journal, dan hasil dua request bersamaan.

### UAT-S03-04 - FIFO memilih valid layer tertua

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | UI `/inventory/ledger` atau flow issue API |
| Preconditions | `BAT-OLD` 10 @100 dan `BAT-NEW` 10 @150 tersedia pada location yang sama |
| Test data | Issue 12 VIAL |
| Mapping | FIFO allocation |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Post issue 12 VIAL untuk source uji. | Posting berhasil. |
| 2 | Buka allocations. | 10 diambil dari `BAT-OLD`, 2 dari `BAT-NEW`. |
| 3 | Periksa biaya aktual. | Total cost = 10x100 + 2x150 = 1,300.00. |
| 4 | Periksa remaining layer. | `BAT-OLD` nol, `BAT-NEW` delapan, tidak ada nilai negatif. |
| 5 | Periksa mutation. | Before/after sesuai pengurangan 12 dan source reference lengkap. |

Evidence: allocation rows, total cost, remaining layers, mutation.

### UAT-S03-05 - Invalid layer dan scope location tidak boleh dikonsumsi

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | API issue/FIFO melalui flow inventory |
| Preconditions | `BAT-EXP` expired, `BAT-DMG` quarantine, stok valid tersedia di location lain |
| Mapping | Valid-layer selection, branch/location scope |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Issue dari location yang hanya memiliki expired/quarantine layer. | Ditolak sebagai stok valid tidak mencukupi. |
| 2 | Periksa layer expired/quarantine. | Remaining quantity tidak berubah. |
| 3 | Pastikan stok valid ada di warehouse/location lain, lalu retry tanpa memilih location itu. | Sistem tidak diam-diam mengambil stok dari location lain. |
| 4 | Jalankan issue dengan location valid yang eksplisit. | Berhasil dan hanya layer scope tersebut yang berubah. |

Evidence: error insufficient valid layer dan allocations location valid.

### UAT-S03-06 - Negative stock prevention, concurrency, dan reversal

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-LOG-APPROVER` |
| Channel | API concurrency lalu UI `/inventory/ledger` |
| Preconditions | Available stock tepat 5 VIAL |
| Test data | Dua issue bersamaan, masing-masing 4 VIAL |
| Mapping | AC-006, `INV-01`, stock locking |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Jalankan dua issue 4 VIAL secara bersamaan. | Hanya satu berhasil; yang lain ditolak/retry aman karena stok tersisa 1. |
| 2 | Periksa balance dan layers. | On-hand/remaining tidak negatif dan hanya berkurang 4. |
| 3 | Reverse posting yang berhasil sebagai approver. | Reversal posting/mutation baru dibuat; original berstatus reversed. |
| 4 | Periksa cost layer setelah reversal. | Quantity dan nilai dipulihkan sesuai allocation asli. |
| 5 | Retry reversal. | Tidak membuat reversal kedua. |

Evidence: dua response concurrency, saldo akhir, original/reversal posting IDs.

## 9. Sprint 4 - Opening Balance, Expense, Stock Request, dan Reservation

### UAT-S04-01 - Opening balance balanced dengan maker-checker

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER`, `USR-FIN-APPROVER` |
| Channel | UI `/opening-balances` |
| Preconditions | Period cutover `OPEN`; account mapping tersedia |
| Mapping | Opening cash/bank, inventory, AR, AP, deposit, deferred; `MCK-01` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Maker membuat opening dengan total debit 5,000.00 dan credit 5,000.00 menggunakan beberapa line type. | Status `DRAFT`; source line tersimpan. |
| 2 | Maker submit. | Status `SUBMITTED`; submitted actor/time tercatat. |
| 3 | Maker mencoba post dokumen sendiri. | Ditolak oleh maker-checker. |
| 4 | Approver berbeda memeriksa dan post. | Status `POSTED`; journal balanced dan source links tersedia. |
| 5 | Buka cash/bank serta inventory line terkait. | Subledger yang relevan terbentuk satu kali sesuai opening. |

Evidence: opening number, maker/checker IDs, journal, subledger references.

### UAT-S04-02 - Opening tidak balanced, reject, dan resubmit

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER`, `USR-FIN-APPROVER` |
| Channel | UI `/opening-balances` |
| Preconditions | Opening draft baru |
| Mapping | `FIN-01`, opening rejection |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Masukkan debit 1,000.00 dan credit 999.00. | Submit/post ditolak karena tidak balanced. |
| 2 | Koreksi menjadi balanced dan submit. | Status `SUBMITTED`. |
| 3 | Approver reject dengan alasan. | Status `REJECTED`, alasan dan reviewer tersimpan. |
| 4 | Maker memperbaiki lalu submit ulang. | Status kembali `SUBMITTED`; histori reject tetap tersedia. |
| 5 | Post dua kali. | Posting kedua menjadi replay/tidak membuat journal kedua. |

Evidence: error imbalance, rejection reason, status history, journal count.

### UAT-S04-03 - Expense approval dan payment journal

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER`, `USR-FIN-APPROVER` |
| Channel | UI `/expenses`, `/approvals`, `/cash-bank` |
| Preconditions | `EXP-01` 300.00; evidence file valid; cash account aktif |
| Mapping | Expense workflow dan accounting |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Maker membuat expense dengan category, branch, amount, date, dan evidence. | Status `DRAFT`; evidence private. |
| 2 | Submit expense. | Status `SUBMITTED`; muncul pada approver sesuai rule. |
| 3 | Maker mencoba approve. | Ditolak maker-checker. |
| 4 | Approver menyetujui. | Status `APPROVED`, approval audit lengkap. |
| 5 | User berwenang membayar dari cash/bank. | Status `PAID`; cash payment dan journal balanced terbentuk satu kali. |

Evidence: expense ID, protected evidence, approval, cash transaction, journal.

### UAT-S04-04 - Membuat stock request

| Field | Value |
|---|---|
| Actors | `USR-AC-A` |
| Channel | UI `/inventory/stock-requests` |
| Preconditions | Cabang A aktif; central available `PRD-VITC` minimal 10 |
| Test data | Request 8 VIAL |
| Mapping | Stock request create dan branch scope |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat request dari Cabang A untuk 8 VIAL beserta catatan kebutuhan. | Request bernomor unik, status `PENDING`, branch asal benar. |
| 2 | Buka detail request. | Product, requested quantity/UOM, creator, timestamp, dan notes tampil. |
| 3 | Login `USR-AC-B` dan coba membuka request Cabang A. | Ditolak/tidak terlihat. |
| 4 | Coba membuat quantity nol/negatif atau product duplikat. | Validasi menolak tanpa membuat request invalid. |

Evidence: request number, detail, response cross-branch, error validation.

### UAT-S04-05 - Full dan partial approval membentuk reservation

| Field | Value |
|---|---|
| Actors | `USR-AM-A`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/stock-requests`, `/inventory/stock-reservations` |
| Preconditions | Dua request `PENDING`; central available cukup |
| Mapping | Full/partial approval, quantity buckets |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Approve penuh request 8 VIAL. | Status `APPROVED`; reservation `ACTIVE` 8 VIAL dibuat. |
| 2 | Periksa source balance. | Available turun 8, reserved naik 8, on-hand tetap. |
| 3 | Buat request kedua 8 VIAL, lalu approve hanya 5. | Status `PARTIALLY_APPROVED`; reservation aktif 5. |
| 4 | Coba approved quantity melebihi requested/available. | Ditolak; bucket tidak berubah. |
| 5 | Retry approval key/payload sama. | Reservation tidak terduplikasi. |

Evidence: request statuses, reservation IDs, bucket before/after.

### UAT-S04-06 - Reject/release reservation tidak mengubah nilai aset

| Field | Value |
|---|---|
| Actors | `USR-LOG-APPROVER` |
| Channel | UI `/inventory/stock-requests`, `/inventory/stock-reservations`, `/inventory/ledger` |
| Preconditions | Satu request `PENDING`, satu reservation `ACTIVE` |
| Mapping | Reservation release, asset invariant |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Reject request pending dengan alasan. | Status `REJECTED`; tidak ada reservation/shipment. |
| 2 | Catat valuation dan total remaining layer sebelum release. | Nilai baseline tersimpan sebagai evidence. |
| 3 | Release reservation aktif. | Reservation `RELEASED`; reserved turun dan available naik dengan quantity sama. |
| 4 | Bandingkan on-hand, layer, dan inventory valuation. | Semuanya tidak berubah; tidak ada journal aset. |
| 5 | Retry release. | Tidak ada perubahan bucket kedua. |

Evidence: rejection reason, bucket before/after, layer/valuation/journal comparison.

## 10. Sprint 5 - Shipment, Receiving, dan Internal Transfer

### UAT-S05-01 - Dispatch shipment idempotent

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | UI `/inventory/shipments` |
| Preconditions | Request approved dengan reservation aktif 8 VIAL |
| Mapping | Shipment dispatch, AC-006 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buka shipment `PREPARING`, isi quantity kirim 8 dan evidence/catatan. | Data siap dikirim dan tidak melebihi reservation. |
| 2 | Klik `Kirim Pengiriman`. | Status `SHIPPED`; reservation menjadi consumed; transfer-out tercatat. |
| 3 | Klik ulang atau kirim request yang sama. | Hasil replay; tidak ada transfer-out, mutation, atau journal kedua. |
| 4 | Gunakan key sama dengan quantity berbeda. | Ditolak sebagai payload conflict. |

Evidence: shipment ID, posting/mutation, reservation status, duplicate count.

### UAT-S05-02 - In-transit menjaga nilai aset dan tidak membuat P&L

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-FIN-APPROVER` |
| Channel | UI `/inventory/ledger`, `/accounting` |
| Preconditions | Shipment 8 VIAL telah dikirim dari Pusat |
| Mapping | AC-004, internal transfer accounting |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Catat nilai inventory total sebelum dispatch. | Baseline source + destination + in-transit tersedia. |
| 2 | Buka internal transfer ledger setelah dispatch. | Status `IN_TRANSIT`, quantity/value sesuai FIFO source. |
| 3 | Buka journal dispatch. | Reklasifikasi inventory ke in-transit balanced. |
| 4 | Pastikan tidak ada account revenue atau expense pada journal transfer. | Hanya account asset sesuai posting policy. |
| 5 | Bandingkan total nilai aset sebelum/sesudah. | Total tidak berubah. |

Evidence: valuation baseline/result, transfer ledger, journal lines.

### UAT-S05-03 - Partial receiving

| Field | Value |
|---|---|
| Actors | `USR-AC-A` |
| Channel | UI `/inventory/shipments`, modal `Terima Pengiriman` |
| Preconditions | Shipment 8 VIAL berstatus `SHIPPED` |
| Test data | Receipt pertama 5 VIAL |
| Mapping | Partial receiving |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Input diterima 5 VIAL dan upload tanda terima. | Penerimaan parsial dapat disimpan. |
| 2 | Submit partial receipt. | Shipment `PARTIALLY_RECEIVED`; received=5, outstanding=3. |
| 3 | Periksa destination balance/layer. | Bertambah 5 dengan unit cost/source transfer asli. |
| 4 | Periksa in-transit. | Tersisa quantity/value untuk 3 VIAL. |
| 5 | Retry receipt yang sama. | Tidak menambah stok kedua kali. |

Evidence: receipt ID/file, status/quantities, destination layer, in-transit remainder.

### UAT-S05-04 - Final receiving tanpa discrepancy

| Field | Value |
|---|---|
| Actors | `USR-AC-A` |
| Channel | UI `/inventory/shipments` |
| Preconditions | Shipment outstanding 3 VIAL |
| Mapping | Final receiving, AC-004 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Terima sisa 3 VIAL. | Shipment `RECEIVED`/complete. |
| 2 | Periksa destination stock. | Total received menjadi 8; layer mempertahankan cost transfer. |
| 3 | Periksa internal transfer ledger. | Status `RECEIVED`; in-transit nol untuk shipment. |
| 4 | Bandingkan total source + destination + in-transit value. | Sama dengan nilai sebelum transfer. |
| 5 | Coba menerima lagi. | Ditolak/replay tanpa perubahan. |

Evidence: final receipt, balances, transfer status, valuation comparison.

### UAT-S05-05 - Shortage/damage discrepancy dan quarantine

| Field | Value |
|---|---|
| Actors | `USR-AC-A`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/shipments` |
| Preconditions | Shipment uji lain mengirim 5 VIAL |
| Test data | 3 good, 1 damaged, 1 shortage |
| Mapping | Discrepancy, quarantine, evidence |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Receive dengan rincian 3 good, 1 damaged, 1 shortage dan upload evidence. | Shipment `RECEIVED_WITH_ISSUE`; discrepancy `OPEN`. |
| 2 | Periksa stock Cabang A. | 3 masuk available, 1 masuk quarantine, shortage tidak masuk on-hand. |
| 3 | Periksa discrepancy. | Type/quantity, source shipment, evidence, reporter, dan timestamp lengkap. |
| 4 | Periksa in-transit/transfer status. | Status `DISCREPANCY`; unresolved value dapat ditelusuri. |
| 5 | Coba melihat evidence tanpa login atau dari branch tanpa scope. | Akses ditolak. |

Evidence: receipt detail, bucket, discrepancy ID, protected evidence response.

### UAT-S05-06 - Discrepancy resolution

| Field | Value |
|---|---|
| Actors | `USR-LOG-APPROVER` |
| Channel | UI `/inventory/controls` atau shipment issue review |
| Preconditions | Discrepancy `OPEN` dari `UAT-S05-05` |
| Mapping | Release/return/write-off resolution |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Resolve damaged item dengan action yang disepakati, misalnya `WRITE_OFF` atau `RETURN_TO_SENDER`. | Mutation/journal dibuat sesuai action dan status discrepancy `RESOLVED`. |
| 2 | Resolve shortage dengan `NO_STOCK_ACTION` atau follow-up shipment. | Tidak ada stok fiktif; resolution reason tersimpan. |
| 3 | Periksa quantity dan valuation setelah resolution. | Bucket/layer/journal konsisten dengan action. |
| 4 | Retry resolution. | Tidak ada mutation/journal kedua. |
| 5 | Coba mengubah discrepancy resolved. | Ditolak sebagai immutable/final. |

Evidence: resolution action/reason, mutation, journal, final status.

## 11. Sprint 6 - Purchasing, Accounts Payable, dan Goods Receipt

### UAT-S06-01 - Supplier master dan status

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER` |
| Channel | UI `/purchasing`, tab Supplier |
| Preconditions | Permission `SUPPLIER.READ/MANAGE` |
| Mapping | Supplier master |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat `SUP-01` dengan code, name, contact, tax ID, dan payment terms. | Supplier `ACTIVE` dan code unik. |
| 2 | Coba membuat supplier dengan code yang sama. | Duplikasi ditolak tanpa record kedua. |
| 3 | Ubah contact/payment terms. | Data berubah dan audit before/after tersedia. |
| 4 | Set supplier `BLOCKED`/inactive, lalu coba membuat PO baru. | Supplier tidak dapat dipakai untuk transaksi baru. |
| 5 | Buka transaksi historis supplier. | Histori tetap dapat dibaca. |

Evidence: supplier ID, duplicate response, audit update, blocked transaction response.

### UAT-S06-02 - Purchase Request submit, approve, reject, dan maker-checker

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER`, `USR-FIN-APPROVER` |
| Channel | UI `/purchasing`, bagian Purchase Request; `/approvals` |
| Preconditions | `SUP-01` aktif; product dan branch aktif |
| Test data | `PR-01`, 10 VIAL dengan estimated unit cost |
| Mapping | Purchasing approval, generic approval |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Maker membuat PR dan submit. | Status berubah `DRAFT` ke `SUBMITTED`; payload snapshot tersedia. |
| 2 | Maker mencoba approve PR sendiri. | Ditolak oleh maker-checker/rule approval. |
| 3 | Approver menyetujui approved quantity 10. | Status `APPROVED`, decision dan note tersimpan. |
| 4 | Pada PR kedua, approve quantity melebihi requested. | Ditolak; status/quantity tidak berubah. |
| 5 | Pada PR ketiga, reject dengan alasan. | Status `REJECTED`; alasan terlihat dan PR dapat diperbaiki/resubmit sesuai flow. |

Evidence: tiga PR IDs, approval decisions, maker-checker response, audit.

### UAT-S06-03 - Konversi PR menjadi Purchase Order

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER` |
| Channel | UI `/purchasing`, bagian Purchase Order |
| Preconditions | `PR-01` `APPROVED`; `SUP-01` aktif |
| Test data | `PO-01`, 10 VIAL x 120.00 |
| Mapping | PR-to-PO traceability |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat PO dari approved lines PR. | PO `ISSUED`, total 1,200.00, supplier/branch benar. |
| 2 | Buka `PR-01`. | Status `CONVERTED` dan link PO tersedia. |
| 3 | Buka PO. | Source PR, ordered quantity, unit price, total, dan creator tampil. |
| 4 | Coba membuat PO kedua dari PR yang sama. | Ditolak atau replay sesuai posting key; tidak ada komitmen ganda. |
| 5 | Coba memasukkan product/quantity yang tidak disetujui. | Ditolak oleh contract PR/PO. |

Evidence: PR/PO numbers, source links, total calculation, duplicate response.

### UAT-S06-04 - Partial Goods Receipt dengan batch, expiry, condition, dan location

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | UI `/inventory/goods-receipts` atau `/purchasing` |
| Preconditions | `PO-01` `ISSUED`; `LOC-PST-GOOD` aktif; period `OPEN` |
| Test data | `GR-01A`, 6 VIAL, batch `GR-BAT-01`, valid expiry, condition `GOOD` |
| Mapping | Goods Receipt partial dan purchase cost layer |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Pilih PO dan input partial receipt 6 VIAL, location, batch, expiry, dan condition. | Validasi menerima data lengkap. |
| 2 | Post receipt. | Receipt `POSTED`; PO menjadi `PARTIALLY_RECEIVED`. |
| 3 | Periksa inventory. | On-hand bertambah 6 pada batch/location yang benar. |
| 4 | Periksa cost layer. | Original/remaining 6, unit cost 120.00, source goods receipt. |
| 5 | Periksa journal. | Inventory/GRNI posting balanced sesuai policy; source link tersedia. |

Evidence: GR number, PO status, balance/layer, journal number.

### UAT-S06-05 - Final receipt, over-receipt, expiry validation, dan idempotency

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | UI `/inventory/goods-receipts` |
| Preconditions | PO telah menerima 6 dari 10 |
| Test data | `GR-01B` 4 VIAL |
| Mapping | Goods Receipt completion, AC-003, AC-006 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Post receipt sisa 4 VIAL dengan batch valid. | PO menjadi `RECEIVED`; total received tepat 10. |
| 2 | Coba receipt tambahan 1 VIAL. | Ditolak `quantity exceeded`; inventory/journal tidak berubah. |
| 3 | Untuk product tracks expiry, kosongkan expiry atau gunakan expiry sebelum receipt date. | Ditolak sesuai validation policy. |
| 4 | Retry `GR-01B` dengan idempotency key dan payload sama. | Replay receipt yang sama; layer/journal tidak bertambah. |
| 5 | Kirim dua receipt sisa yang sama secara concurrent. | Hanya satu berhasil; PO received tidak melebihi ordered. |

Evidence: final PO quantity, validation responses, receipt/layer/journal counts.

### UAT-S06-06 - Supplier invoice, AP, dan partial/full supplier payment

| Field | Value |
|---|---|
| Actors | `USR-FIN-MAKER`, `USR-FIN-APPROVER` |
| Channel | UI `/purchasing`, `/cash-bank`, `/accounting` |
| Preconditions | Goods Receipt total 1,200.00; supplier invoice belum ada |
| Mapping | AC-003, AP dan supplier payment |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Post supplier invoice 1,200.00 dengan due date. | AP status `POSTED`, balance 1,200.00; GRNI direklasifikasi ke AP. |
| 2 | Coba invoice 1,200.01 atau invoice kedua yang membuat total melebihi receipt. | Ditolak; AP/journal tidak bertambah. |
| 3 | Bayar supplier 700.00 dari bank. | Status `PARTIALLY_PAID`, balance 500.00; cash transaction dan journal terbentuk. |
| 4 | Bayar sisa 500.00. | Status `PAID`, balance nol. |
| 5 | Retry payment terakhir atau jalankan dua payment terakhir bersamaan. | Hanya satu payment/journal; overpayment ditolak. |
| 6 | Telusuri PO ke GR, supplier invoice, payment, cash ledger, dan journal. | Seluruh source link konsisten dan amount balanced. |

Evidence: AP number/status per tahap, payments, cash transactions, journals, concurrency result.

## 12. Sprint 7 - Package, Deferred Revenue, Treatment BOM, dan Material Usage

### UAT-S07-01 - Revenue policy dan package benefit valuation

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER` |
| Channel | UI `/revenue-recognition`, `/admin/package-pricing` |
| Preconditions | Package type dan treatment service aktif |
| Mapping | Revenue policy per session |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Konfigurasikan nilai benefit/revenue per session untuk paket uji. | Policy version tersimpan dan efektif pada periode yang benar. |
| 2 | Buat/aktifkan paket member berdasarkan policy tersebut. | Revenue contract merekam nilai kontrak dan jumlah benefit. |
| 3 | Ubah policy untuk transaksi masa depan. | Kontrak lama mempertahankan snapshot; kontrak baru memakai version baru. |
| 4 | Coba policy dengan total allocation tidak valid. | Sistem menolak dan tidak mengaktifkan policy invalid. |

Evidence: policy versions, old/new contract snapshots, validation response.

### UAT-S07-02 - Package payment menjadi deferred, belum menjadi revenue

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER` |
| Channel | UI `/payments`, `/revenue-recognition`, `/finance-reports` |
| Preconditions | `INV-PKG-01` dan pembayaran penuh telah verified; belum ada treatment completed |
| Mapping | AC-001 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buka revenue contract setelah pembayaran paket. | Contract funded/active dan deferred balance bertambah. |
| 2 | Buka journal payment. | Kas/bank bertambah dan liability/deferred bertambah sesuai policy. |
| 3 | Buka Profit & Loss pada tanggal payment. | Belum ada revenue treatment dari paket tersebut. |
| 4 | Buka deferred revenue report. | Nilai paket tampil sebagai kewajiban yang belum diakui. |
| 5 | Retry funding event. | Tidak ada deferred movement/journal kedua. |

Evidence: contract, deferred movement, payment journal, P&L/deferred comparison.

### UAT-S07-03 - Membuat, mengubah, dan mengaktifkan Treatment BOM

| Field | Value |
|---|---|
| Actors | `USR-LOG-APPROVER` |
| Channel | UI `/inventory/treatment-boms` |
| Preconditions | Product `PRD-VITC` dan `PRD-SET` aktif |
| Mapping | BOM versioning |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat `BOM-01` draft dengan 2 VIAL dan 1 set. | BOM `DRAFT`, version dan items tersimpan. |
| 2 | Edit quantity/item saat masih draft. | Perubahan diizinkan dan audit tersedia. |
| 3 | Aktifkan BOM. | Status `ACTIVE`; hanya satu version aktif untuk scope/effective date yang sama. |
| 4 | Buat version baru dan aktifkan. | Version lama menjadi `SUPERSEDED`; session lama tetap menunjuk snapshot/version lama. |
| 5 | Coba mengedit BOM active secara destruktif. | Ditolak; perubahan harus version baru. |

Evidence: BOM versions/statuses/items, audit activation, session snapshot reference.

### UAT-S07-04 - Material recommendation, actual usage, dan deviation reason

| Field | Value |
|---|---|
| Actors | `USR-NURSE-A`, `USR-DOC-A` |
| Channel | UI `/sessions/SES-01` |
| Preconditions | `BOM-01` active; session belum completed |
| Mapping | Material actual dan deviation |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buka bagian material session. | Rekomendasi 2 VIAL + 1 set muncul dari BOM aktif. |
| 2 | Simpan actual usage sama dengan rekomendasi. | Material usage `DRAFT`; deviation reason tidak diperlukan. |
| 3 | Ubah actual VIAL menjadi 3 tanpa alasan. | Sistem meminta deviation reason. |
| 4 | Pilih reason, misalnya `CLINICAL_ADJUSTMENT`, dan isi note bila `OTHER`. | Actual usage tersimpan dengan actor, reason, dan timestamp. |
| 5 | Coba product/quantity tidak valid. | Ditolak tanpa mengubah usage sebelumnya. |

Evidence: BOM recommendation, actual usage, deviation reason/note, validation response.

### UAT-S07-05 - FIFO material consumption dan actual cost

| Field | Value |
|---|---|
| Actors | `USR-NURSE-A` |
| Channel | UI session dan `/inventory/material-usage-history` |
| Preconditions | Valid layer lama dan baru tersedia di Cabang A |
| Test data | Consume 2 VIAL sesuai BOM |
| Mapping | FIFO treatment usage dan `TREATMENT_COMPLETED` readiness |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Jalankan consume/material posting sesuai flow sebelum/ketika completion. | Allocation memakai valid layer tertua. |
| 2 | Periksa material usage. | Quantity, unit, actual cost, batch/layer allocations, dan status tersedia. |
| 3 | Buka material usage history. | Session, member, staff, branch, product, quantity, dan cost dapat difilter. |
| 4 | Pastikan event completion belum diproses dua kali. | Event key/aggregate unik disiapkan untuk session. |
| 5 | Coba consume di atas available. | Ditolak dan session/stock tetap pada state sebelum aksi. |

Evidence: allocation/cost, usage history row, event reference atau error insufficient stock.

## 13. Sprint 8 - Atomic Treatment Completion dan Profitability

### UAT-S08-01 - Atomic completion: session, revenue, stock, HPP, dan journal

| Field | Value |
|---|---|
| Actors | `USR-NURSE-A` atau user dengan completion permission |
| Channel | UI `/sessions/SES-01`, lalu ledger/report terkait |
| Preconditions | Session valid, material draft valid, revenue contract funded, period `OPEN`, stok cukup |
| Mapping | AC-002 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Catat state awal session, deferred balance, inventory, layer, dan journal count. | Baseline evidence tersimpan. |
| 2 | Klik selesaikan session. | Session completed dan response sukses satu kali. |
| 3 | Periksa material/stock. | Usage `CONSUMED`; mutation dan FIFO allocation mengurangi stock/layer. |
| 4 | Periksa revenue/deferred. | Revenue recognition `POSTED`; deferred release sesuai benefit session. |
| 5 | Periksa journal. | Revenue dan HPP/inventory lines balanced dalam transaksi completion. |
| 6 | Periksa domain event. | `TREATMENT_COMPLETED` unique dan processed/pending sesuai worker contract. |

Evidence: before/after snapshot, session ID, usage/posting IDs, recognition, journal, event.

### UAT-S08-02 - Duplicate completion protection

| Field | Value |
|---|---|
| Actors | `USR-NURSE-A` |
| Channel | UI double-click dan/atau dua API requests concurrent |
| Preconditions | Session siap completed |
| Mapping | AC-006 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Kirim dua request completion dengan session/key sama secara bersamaan. | Satu commit; request lain replay/conflict yang aman. |
| 2 | Hitung session completion, usage, mutation, allocations, recognition, event, dan journal. | Masing-masing business posting hanya satu. |
| 3 | Klik completion lagi setelah status completed. | Ditolak `already completed` atau mengembalikan replay tanpa side effect. |

Evidence: dua responses dan count seluruh tabel/business records.

### UAT-S08-03 - Insufficient stock menggagalkan seluruh completion

| Field | Value |
|---|---|
| Actors | `USR-NURSE-A` |
| Channel | UI `/sessions/{id}` |
| Preconditions | Session membutuhkan 2 VIAL; available valid hanya 1 |
| Mapping | Atomic rollback, `INV-01` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Coba complete session. | Ditolak dengan pesan stok tidak cukup. |
| 2 | Periksa session dan material usage. | Session belum completed; usage tidak `CONSUMED`. |
| 3 | Periksa inventory/layers. | Tidak ada mutation/allocation parsial dan quantity tidak berubah. |
| 4 | Periksa revenue/journal/event. | Tidak ada recognition/journal/event processed parsial. |

Evidence: error response dan perbandingan seluruh state sebelum/sesudah.

### UAT-S08-04 - Closed period menggagalkan seluruh completion

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER`, `USR-NURSE-A` |
| Channel | UI `/accounting`, `/sessions/{id}` |
| Preconditions | Stok cukup; period tanggal session diubah `CLOSED` |
| Mapping | `FIN-02`, atomic rollback |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Complete session pada period closed. | Ditolak `ACCOUNTING_PERIOD_CLOSED` atau equivalent. |
| 2 | Periksa session, stock, deferred, revenue, HPP, event, dan journal. | Tidak ada komponen yang berubah. |
| 3 | Buka period sesuai prosedur berwenang dan retry sekali. | Completion berhasil atomik. |

Evidence: error closed period, unchanged snapshot, successful retry after authorized reopen.

### UAT-S08-05 - Cancellation/reversal dan profitability

| Field | Value |
|---|---|
| Actors | User dengan `TREATMENT.COMPLETION.REVERSE`, `USR-FIN-APPROVER` |
| Channel | UI session/revenue reports |
| Preconditions | Session completed dari `UAT-S08-01` |
| Mapping | Reversal, profitability |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Batalkan session dengan reason dan idempotency key. | Session `CANCELLED`; reversal references original completion. |
| 2 | Periksa stock/layers. | Quantity dan cost allocations dipulihkan melalui reversal, bukan edit original. |
| 3 | Periksa material/revenue. | Usage dan recognition `REVERSED`; deferred balance dipulihkan. |
| 4 | Periksa journal. | Reversal journal balanced dan menetralkan revenue/HPP original. |
| 5 | Buka profitability sebelum dan setelah cancellation. | Revenue, HPP, dan gross profit berubah konsisten. |
| 6 | Retry cancellation. | Tidak ada reversal kedua. |

Evidence: cancellation reason, original/reversal links, restored layers, profitability comparison.

## 14. Sprint 9 - Approval, Adjustment, Opname, Discrepancy, dan Homecare

### UAT-S09-01 - Approval rule lintas modul dan multi-step maker-checker

| Field | Value |
|---|---|
| Actors | `USR-SA`, maker dan approver finance/logistics |
| Channel | UI `/approvals` |
| Preconditions | Permission workflow rule; siapkan rule berdasarkan module, branch, category/type, dan amount threshold |
| Mapping | Generic approval engine |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat rule dua langkah untuk transaksi di atas threshold. | Rule aktif dengan urutan approver yang benar. |
| 2 | Submit expense/PR/adjustment yang memenuhi rule. | Approval instance `PENDING` dan muncul di inbox approver langkah 1. |
| 3 | Approver langkah 2 mencoba approve sebelum langkah 1. | Ditolak; urutan tidak dilompati. |
| 4 | Langkah 1 approve, lalu langkah 2 approve. | Instance `APPROVED`; source transaction ikut berubah sesuai domain. |
| 5 | Maker mencoba menjadi approver pada source sendiri. | Ditolak `MCK-01`. |
| 6 | Reject pada salah satu langkah. | Instance/source rejected dan langkah berikutnya tidak dapat approve. |

Evidence: rule, approval instance/steps, inbox, decision audit, maker-checker response.

### UAT-S09-02 - Adjustment IN dengan reason, evidence, approval, dan journal

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/controls` |
| Preconditions | Reason code adjustment aktif; period `OPEN` |
| Test data | Adjustment IN 2 VIAL dengan unit cost 120.00 |
| Mapping | Inventory adjustment |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Maker membuat adjustment IN dengan branch/location/batch/reason/evidence. | Status `DRAFT`, total value terhitung. |
| 2 | Submit adjustment. | `PENDING_APPROVAL` atau langsung `APPROVED` sesuai rule; maker tidak auto-approve jika checker wajib. |
| 3 | Approver menyetujui lalu poster mem-posting. | Status `POSTED`; balance, mutation, layer, dan journal bertambah. |
| 4 | Periksa source traceability. | Semua ledger mengacu ke adjustment number/reason. |
| 5 | Retry post. | Tidak ada stock/journal kedua. |

Evidence: adjustment ID/status, approval, evidence, mutation/layer/journal.

### UAT-S09-03 - Adjustment OUT dan negative-stock prevention

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/controls` |
| Preconditions | Available valid 3 VIAL |
| Test data | Adjustment OUT 4 VIAL |
| Mapping | FIFO adjustment, `INV-01` |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat, submit, dan approve adjustment OUT 4. | Approval dapat tercatat, tetapi posting harus memvalidasi stock terkini. |
| 2 | Coba post. | Ditolak karena insufficient stock; status/posting tidak menjadi parsial. |
| 3 | Ubah transaksi melalui flow yang diizinkan menjadi 2 atau buat dokumen koreksi baru. | Posting 2 berhasil. |
| 4 | Periksa FIFO cost dan journal. | Valid layer tertua dikurangi; journal balanced sesuai actual cost. |

Evidence: insufficient response, successful corrected posting, allocations/journal.

### UAT-S09-04 - Stock opname lock, snapshot, dan counting

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | UI `/inventory/controls` atau `/inventory/stock-opnames` |
| Preconditions | `LOC-A-GOOD` berisi beberapa product/batch |
| Mapping | Stock opname snapshot dan lock |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Mulai opname pada `LOC-A-GOOD`. | Status `COUNTING`; system quantity snapshot tersimpan. |
| 2 | Coba mulai opname aktif kedua pada location sama. | Ditolak karena lock. |
| 3 | Coba posting movement stock normal pada location yang dikunci. | Ditolak atau mengikuti policy lock yang terdokumentasi. |
| 4 | Input physical count untuk semua lines. | Difference dihitung otomatis dan tidak mengubah stock sebelum post. |
| 5 | Refresh halaman. | Snapshot system quantity tetap; count yang tersimpan tidak berubah. |

Evidence: opname ID/status, lock response, snapshot/count/difference.

### UAT-S09-05 - Opname submit, discrepancy resolution, approval, dan posting

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/controls` |
| Preconditions | Opname counting dengan satu surplus dan satu shortage |
| Mapping | Opname mutation/journal |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Pilih resolution tiap line: `ADJUST`, `RECOUNT`, atau `ACCEPTED` sesuai kebijakan. | Resolution tersimpan; unresolved line mencegah finalization. |
| 2 | Submit opname lengkap. | Status `PENDING_APPROVAL`/submitted dan linked adjustment dibuat bila ada difference. |
| 3 | Maker mencoba approve/post. | Ditolak jika maker-checker berlaku. |
| 4 | Approver menyetujui lalu poster mem-posting. | Status `POSTED`; mutation IN/OUT dan journal terbentuk untuk difference. |
| 5 | Periksa lock. | Lock dilepas setelah posted/cancelled; transaksi normal dapat berjalan lagi. |
| 6 | Coba mengubah opname posted. | Ditolak immutable. |

Evidence: resolutions, linked adjustment, approval, mutations, journal, lock release.

### UAT-S09-06 - Homecare team, bag, request, dan shipment

| Field | Value |
|---|---|
| Actors | `USR-SA`, `USR-LOG-MAKER`, `USR-NURSE-A` |
| Channel | UI `/inventory/homecare-bags` |
| Preconditions | Homecare staff aktif; central stock cukup |
| Mapping | Homecare team/bag logistics |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat homecare team dan tambahkan nurse/doctor/driver sesuai role. | Team aktif dengan member unik dan branch scope benar. |
| 2 | Buat/assign dua bag aktif ke team. | Bag memiliki code unik dan tidak terassign ganda secara invalid. |
| 3 | Buat bag stock request untuk beberapa items. | Status `PENDING`; source bag/team tercatat. |
| 4 | Approve penuh/parsial sebagai manager. | Status/approved quantity benar dan shipment bag dibuat. |
| 5 | Ship lalu receive bag shipment. | Central dan bag stock berubah melalui mutation; status shipment final benar. |
| 6 | Coba user dari team/branch lain membuka atau menerima shipment. | Ditolak oleh scope. |

Evidence: team/members, bags, request/approval, shipment, stock movements, scope response.

### UAT-S09-07 - Multi-bag usage, return, dan bag opname

| Field | Value |
|---|---|
| Actors | `USR-NURSE-A`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/homecare-bags` |
| Preconditions | Dua bag memiliki stok untuk satu homecare session |
| Mapping | Multi-bag homecare finalization |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Complete usage yang mengambil material dari bag 1 dan bag 2 dalam satu event. | Usage `COMPLETED`; setiap bag stock berkurang sesuai line, tanpa negative stock. |
| 2 | Retry multi-bag completion. | Tidak ada usage/mutation kedua. |
| 3 | Return sisa material dari bag ke central/location tujuan. | Return tercatat; source/destination mutation seimbang sesuai quantity. |
| 4 | Jalankan opname masing-masing bag. | Expected vs physical dan difference tersedia. |
| 5 | Pilih create adjustment untuk difference dan finalisasi. | Adjustment/mutation dibuat sesuai reason; bag stock cocok dengan physical. |
| 6 | Periksa riwayat seluruh bag. | Request, shipment, usage, return, dan opname dapat ditelusuri kronologis. |

Evidence: multi-bag usage ID, mutations per bag, return, opname/adjustment, history.

## 15. Sprint 10 - Dashboard, Reporting, Notification, dan Evidence

### UAT-S10-01 - Logistics dashboard dan filter konsisten

| Field | Value |
|---|---|
| Actors | `USR-AM-A`, `USR-LOG-APPROVER` |
| Channel | UI `/inventory/dashboard` |
| Preconditions | Data Sprint 2-9 tersedia pada dua branch dan beberapa tanggal |
| Mapping | Logistics dashboard |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buka dashboard tanpa filter khusus. | KPI stock, movement, shipment, discrepancy, opname, dan usage termuat. |
| 2 | Filter Cabang A dan rentang tanggal UAT. | Semua KPI/chart/table menggunakan filter yang sama. |
| 3 | Catat satu KPI lalu drill-down/cek source report. | Nilai sama dengan agregasi ledger sumber. |
| 4 | Login user Cabang B dan coba filter Cabang A. | Cabang A tidak tersedia atau request ditolak. |
| 5 | Pilih rentang tanpa data. | Dashboard menampilkan zero/empty state, bukan error atau data lama. |

Evidence: screenshots filter, source reconciliation, horizontal access response.

### UAT-S10-02 - Stock card dan export

| Field | Value |
|---|---|
| Actors | `USR-LOG-MAKER` |
| Channel | UI `/inventory/ledger` atau `/inventory/stock-mutations` |
| Preconditions | `PRD-VITC` memiliki opening, receipt, transfer, usage, adjustment, dan reversal |
| Mapping | Stock card |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Filter stock card by branch/product/location/batch/date. | Opening, in, out, dan running balance tampil kronologis. |
| 2 | Cocokkan running balance terakhir dengan current balance. | Nilai sama. |
| 3 | Buka satu row. | Source document, actor, reason, mutation/posting ID tersedia. |
| 4 | Export CSV/Excel. | File mengikuti filter dan totalnya sama dengan layar. |
| 5 | Filter product tanpa movement. | Empty state valid; tidak ada row product lain. |

Evidence: stock card, manual calculation, source detail, export file.

### UAT-S10-03 - Inventory valuation dan reconciliation

| Field | Value |
|---|---|
| Actors | `USR-LOG-APPROVER`, `USR-FIN-APPROVER` |
| Channel | UI `/inventory/dashboard`, `/inventory/ledger`, `/finance-reports` |
| Preconditions | Valid layers dan in-transit transfer tersedia |
| Mapping | FIFO valuation dan control ledger |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buka valuation per branch/product/location/batch. | Quantity x unit cost menghasilkan layer value yang benar. |
| 2 | Jumlahkan active FIFO layers. | Sama dengan on-hand valued stock, dengan pending valuation dilaporkan terpisah. |
| 3 | Tambahkan nilai in-transit terbuka. | Subledger inventory total terbentuk. |
| 4 | Bandingkan dengan inventory control accounts pada GL. | Difference nol atau exception teridentifikasi dengan detail. |
| 5 | Pastikan expired/quarantine tetap dinilai sesuai policy tetapi tidak available untuk consumption. | Quantity bucket dan valuation tidak tercampur. |

Evidence: valuation export, layer calculation, in-transit, GL control balance, difference.

### UAT-S10-04 - Finance reports dan ledger drill-down

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER`, read-only finance user |
| Channel | UI `/finance-reports` |
| Preconditions | Payment, expense, purchasing, transfer, treatment, dan reversal data tersedia |
| Mapping | Dashboard, P&L, GL, Trial Balance, cash/bank, deferred |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Jalankan Trial Balance untuk period UAT. | Total debit sama dengan total credit. |
| 2 | Buka P&L. | Revenue treatment dan HPP/expense sesuai posted journals; package payment sebelum treatment tidak menjadi revenue. |
| 3 | Buka General Ledger account lalu drill-down source. | Running balance dan journal/source detail konsisten. |
| 4 | Buka cash/bank report. | Opening + receipts - payments = closing balance. |
| 5 | Buka deferred revenue report. | Funding, recognition, reversal, dan ending liability cocok dengan contracts. |
| 6 | Login read-only user dan coba melakukan posting. | Report dapat dibaca tetapi aksi write ditolak. |

Evidence: report exports/screenshots, reconciliation calculations, read-only response.

### UAT-S10-05 - Notification dan protected evidence

| Field | Value |
|---|---|
| Actors | Maker, approver, user branch lain |
| Channel | UI `/notifications`, expense/payment/shipment detail |
| Preconditions | Trigger approval, rejection payment, shipment issue, dan expense evidence |
| Mapping | Notification dan private file |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Trigger transaksi yang membutuhkan approval. | Approver yang tepat menerima notification/inbox item. |
| 2 | Reject payment atau approval dengan alasan. | Maker menerima notification berisi reference dan status, tanpa data sensitif berlebihan. |
| 3 | Tandai satu notification read dan kemudian read-all. | Status/count badge berubah konsisten. |
| 4 | Buka evidence sebagai user berwenang. | File dapat di-stream melalui authenticated route. |
| 5 | Buka URL tanpa token atau sebagai user di luar branch scope. | `401/403`; object storage path tidak public. |
| 6 | Pastikan upload/view tercatat di audit jika diwajibkan policy. | Actor, file reference, dan timestamp tersedia. |

Evidence: notification records/count, protected file responses, audit.

## 16. Sprint 11 - Hardening, Reconciliation, Backup/Restore, dan UAT

### UAT-S11-01 - Full role and permission walkthrough

| Field | Value |
|---|---|
| Actors | Semua actor pada bagian 3 |
| Channel | UI seluruh menu P0 |
| Preconditions | Permission matrix final sudah dimuat |
| Mapping | AC-005, go-live security gate |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Login satu per satu sebagai setiap role. | Default route, menu, dan actions sesuai permission efektif. |
| 2 | Uji read/write pada branch sendiri. | Aksi yang diizinkan berhasil. |
| 3 | Uji URL/API branch lain. | Akses horizontal ditolak tanpa data leakage. |
| 4 | Uji user inactive dan token expired/invalid. | Ditolak `401`; tidak ada session access. |
| 5 | Uji impersonation Super Admin ke Admin Manager lalu Admin Cabang. | Effective role/scope mengikuti target terdalam; banner/chain terlihat. |
| 6 | Stop nested impersonation satu tingkat lalu seluruhnya. | Kembali ke user sebelumnya dengan token/store/cookie konsisten. |

Evidence: role matrix bertanda PASS/FAIL, screenshots menu, forbidden responses, impersonation chain.

### UAT-S11-02 - Full AC-001 sampai AC-006 business flow

| Field | Value |
|---|---|
| Actors | Finance, Logistics, Operations, Product Owner |
| Channel | UI end-to-end dan ledger reports |
| Preconditions | Seluruh skenario dasar Sprint 1-10 lulus |
| Mapping | AC-001 sampai AC-006 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Jalankan payment package sampai deferred funding. | AC-001: kas/deferred terbentuk, belum revenue. |
| 2 | Jalankan treatment completion dan cancellation. | AC-002: session, revenue, stock, HPP, journal atomik dan reversal benar. |
| 3 | Jalankan PR, PO, GR, supplier invoice, dan supplier payment. | AC-003: inventory/AP/cash/journal terhubung. |
| 4 | Jalankan internal transfer dispatch sampai receipt. | AC-004: total nilai aset tetap dan tidak ada P&L. |
| 5 | Jalankan role sejajar dan cross-branch denial. | AC-005: scope horizontal aman. |
| 6 | Retry/double-submit payment, shipment, receipt, AP, FIFO, dan treatment. | AC-006: tidak ada duplicate posting. |

Evidence: checklist AC, source IDs, journal/posting links, approver initials.

### UAT-S11-03 - Concurrency dan race-condition gate

| Field | Value |
|---|---|
| Actors | Developer B/test engineer dengan observer bisnis |
| Channel | CLI/API pada PostgreSQL UAT |
| Preconditions | Database UAT disposable; data concurrency terisolasi |
| Mapping | AC-006 |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Jalankan dua payment verification concurrent. | Satu financial posting. |
| 2 | Jalankan dua supplier payments yang menghabiskan balance sama. | Tidak ada overpayment; satu commit atau serializable retry aman. |
| 3 | Jalankan dua shipment dispatch/receipts untuk source sama. | Mutation/journal/receipt tidak duplikat. |
| 4 | Jalankan competing FIFO consumption. | Layer dan stock tidak negatif; total allocation tidak melebihi remaining. |
| 5 | Jalankan dua treatment completions. | Satu completion/revenue/HPP/event. |
| 6 | Jalankan command `npm --prefix apps/api run test:go-live:database`. | Seluruh PostgreSQL integration/concurrency suite lulus. |

Evidence: command output, request IDs, database counts, failed/replay response.

### UAT-S11-04 - Go-live audit dan stock/finance reconciliation

| Field | Value |
|---|---|
| Actors | `USR-FIN-APPROVER`, `USR-LOG-APPROVER`, UAT Coordinator |
| Channel | CLI `npm --prefix apps/api run go-live:audit` dan reports |
| Preconditions | Snapshot data UAT final, seluruh posting selesai |
| Mapping | `INV-001` sampai `INV-005`, finance/opening gate |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Jalankan go-live audit pada cutover date yang benar. | Output JSON tersimpan dan status dapat dihitung deterministik. |
| 2 | Periksa journal/opening/period checks. | Journal balanced, source links valid, maker-checker valid, locked period memiliki metadata. |
| 3 | Periksa `INV-001` sampai `INV-003`. | Compatibility stock, balance bucket, layer quantity, dan valuation status konsisten. |
| 4 | Periksa `INV-004`. | Mutation chain continuity dan latest stock sesuai. |
| 5 | Periksa `INV-005`. | Active FIFO layer + in-transit = inventory control ledger. |
| 6 | Bila ada mismatch, tandai `BLOCKED` dan simpan detail; jangan mengubah output audit. | Release tidak boleh lanjut sampai akar masalah selesai dan audit ulang `READY`. |

Evidence: raw audit JSON, report reconciliation, issue IDs, final `READY` output.

### UAT-S11-05 - Migration dan database backup/restore rehearsal

| Field | Value |
|---|---|
| Actors | DevOps/Developer, UAT Coordinator |
| Channel | CLI/Docker pada database disposable |
| Preconditions | Backup location aman; source dan restore database berbeda |
| Mapping | Migration, RPO/RTO, database recovery |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Buat database kosong disposable dan jalankan seluruh migration. | Seluruh migration selesai tanpa failed migration. |
| 2 | Jalankan smoke/integration database suite pada database baru. | Gate database lulus. |
| 3 | Jalankan `db:backup:rehearse` dengan source UAT dan target bernama `restore/rehearsal/test`. | Dump custom dibuat dan SHA-256 tercatat. |
| 4 | Restore ke target disposable. | `pg_restore --exit-on-error` selesai. |
| 5 | Bandingkan critical row counts dan migration state. | Counts identik dan tidak ada unresolved migration. |
| 6 | Catat dump size, checksum, duration, RPO, dan RTO. | Evidence lengkap dan file sensitif tidak masuk Git. |

Evidence: migration output, dump/checksum, restore evidence JSON, timing.

### UAT-S11-06 - Object storage backup/restore rehearsal

| Field | Value |
|---|---|
| Actors | DevOps/Developer, UAT Coordinator |
| Channel | CLI/Docker MinIO |
| Preconditions | Source dan restore bucket berbeda; restore bucket bernama `restore/rehearsal/test` |
| Mapping | Protected evidence recovery |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Jalankan `storage:backup:rehearse`. | Seluruh object source dimirror ke backup lokal. |
| 2 | Buat manifest path, size, dan SHA-256 per object. | Manifest dan checksum manifest tersimpan. |
| 3 | Restore ke bucket disposable. | Seluruh object berhasil dimirror. |
| 4 | Download ulang object hasil restore dan hitung SHA-256. | Path, size, dan SHA-256 setiap object identik dengan backup. |
| 5 | Uji akses satu evidence melalui aplikasi. | Authenticated user dapat melihat; unauthorized user tetap ditolak. |
| 6 | Catat object count, bytes, checksum, dan duration. | Evidence lengkap dan secret tidak dicetak/disimpan di Git. |

Evidence: manifest, manifest checksum, restore report, access test.

### UAT-S11-07 - Runbook, rollback decision, dan UAT sign-off

| Field | Value |
|---|---|
| Actors | Incident Commander, Product Owner, Finance, Logistics, UAT Coordinator |
| Channel | `docs/SPRINT_11_GO_LIVE_RUNBOOK.md` dan `docs/UAT_SIGN_OFF_MVP.md` |
| Preconditions | Semua technical gate selesai; release candidate SHA dibekukan |
| Mapping | Go-live readiness |

| Step | Action | Expected result |
|---:|---|---|
| 1 | Isi owner, contact, release SHA, maintenance window, RPO, dan RTO. | Tidak ada placeholder kritis yang kosong. |
| 2 | Walkthrough backup, deploy, migration, smoke test, monitoring, dan rollback. | Setiap langkah memiliki owner dan evidence location. |
| 3 | Simulasikan kondisi rollback: failed migration, journal imbalance, stock mismatch, atau Sev-1. | Incident Commander dapat menentukan stop-write, restore, audit, dan reopen decision. |
| 4 | Pastikan defect Severity 1/2 terbuka berjumlah nol. | Jika tidak nol, status `BLOCKED`. |
| 5 | Finance menandatangani finance/opening/revenue/AP evidence. | Signature manusia dan timestamp tercatat. |
| 6 | Logistics menandatangani quantity/FIFO/valuation/shipment/opname evidence. | Signature manusia dan timestamp tercatat. |
| 7 | Product Owner dan Incident Commander memberi keputusan akhir. | Dokumen hanya menjadi `SIGNED/GO` setelah semua approver manusia setuju. |

Evidence: runbook terisi, rollback exercise note, defect list, approval links/signatures.

## 17. Coverage Matrix Sprint dan Acceptance Criteria

| Sprint | Area utama | Scenario IDs | AC/P0 mapping |
|---:|---|---|---|
| 1 | IAM, organization, master inventory, audit | `UAT-S01-01` sampai `UAT-S01-07` | AC-005, P0 IAM/master |
| 2 | Accounting foundation dan inventory ledger | `UAT-S02-01` sampai `UAT-S02-05` | P0 accounting/inventory |
| 3 | Invoice, payment, cash/bank, FIFO | `UAT-S03-01` sampai `UAT-S03-06` | AC-001, AC-006 |
| 4 | Opening, expense, request, reservation | `UAT-S04-01` sampai `UAT-S04-06` | P0 opening/workflow/request |
| 5 | Shipment, receiving, transfer, discrepancy | `UAT-S05-01` sampai `UAT-S05-06` | AC-004, AC-006 |
| 6 | Purchasing, Goods Receipt, AP | `UAT-S06-01` sampai `UAT-S06-06` | AC-003, AC-006 |
| 7 | Deferred revenue, BOM, material actual | `UAT-S07-01` sampai `UAT-S07-05` | AC-001, P0 BOM/revenue |
| 8 | Atomic treatment completion | `UAT-S08-01` sampai `UAT-S08-05` | AC-002, AC-006 |
| 9 | Approval, adjustment, opname, homecare | `UAT-S09-01` sampai `UAT-S09-07` | P0 workflow/inventory/homecare |
| 10 | Dashboard, reports, notification, evidence | `UAT-S10-01` sampai `UAT-S10-05` | P0 reporting/security |
| 11 | Security, concurrency, reconciliation, recovery | `UAT-S11-01` sampai `UAT-S11-07` | AC-001 sampai AC-006, go-live |

Total skenario: **65**.

## 18. Execution Record Template

Salin satu row untuk setiap scenario ID. Jangan menghapus failed run; tambahkan
rerun sebagai row baru agar histori tetap utuh.

Status awal seluruh scenario adalah `NOT_RUN`. Technical automated evidence yang
sudah ada dapat dilampirkan sebagai bukti pendukung, tetapi tidak menggantikan
eksekusi UAT pengguna dan business acceptance.

| Run ID | Scenario ID | Date/time WIB | Environment/build SHA | Tester | Status | Evidence link/path | Defect ID | Notes |
|---|---|---|---|---|---|---|---|---|
| `RUN-001` | `UAT-S01-01` |  |  |  | `NOT_RUN` |  |  |  |

## 19. Defect Severity dan Exit Criteria

| Severity | Definition | UAT decision |
|---|---|---|
| `SEV-1` | Data integrity/security loss, journal/stock corruption, outage flow utama | Go-live blocked |
| `SEV-2` | Flow P0 tidak dapat diselesaikan tanpa workaround aman | Go-live blocked |
| `SEV-3` | Fungsi berjalan dengan workaround terbatas, tidak merusak data | Product Owner decides |
| `SEV-4` | Cosmetic/usability minor | Dapat dijadwalkan setelah go-live |

Exit criteria:

- Semua 65 scenario memiliki execution record.
- Semua scenario P0/AC berstatus `PASS`.
- Tidak ada `SEV-1` atau `SEV-2` terbuka.
- Go-live audit snapshot final berstatus `READY`.
- Trial Balance balanced dan inventory valuation cocok dengan control ledger.
- Database dan object storage restore rehearsal `PASS`.
- Product Owner, Finance, Logistics, UAT Coordinator, dan Incident Commander
  menandatangani dokumen UAT.
