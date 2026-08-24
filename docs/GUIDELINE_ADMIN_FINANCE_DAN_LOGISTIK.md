# Guideline Admin Finance dan Admin Logistik

Status: panduan operasional sesuai implementasi aplikasi per 14 Agustus 2026  
Audiens: Finance, Admin Logistik, Finance & Logistics Controller, Admin Manager, dan Super Admin  
Sumber kebenaran: transaksi dan ledger RAHO ERP; Zoho hanya sistem integrasi sekunder

## 1. Tujuan

Panduan ini menjelaskan seluruh fitur, kewenangan, alur kerja, kontrol, dan
rutinitas untuk petugas Finance dan Admin Logistik. Gunakan panduan ini untuk:

- pelatihan staf baru;
- pembagian tugas maker dan checker;
- pemeriksaan transaksi harian;
- rekonsiliasi dan penutupan periode;
- penanganan kesalahan tanpa menghapus histori;
- persiapan integrasi Zoho.

## 2. Profil role yang tersedia

### 2.1 Finance

Saat ini database belum memiliki enum `ADMIN_FINANCE`. Akun Finance
diimplementasikan sebagai template permission `FINANCE_DUMMY` dengan nama
tampilan **Finance**, menggunakan base role `ADMIN_MANAGER`.

Template ini memiliki permission Finance, tetapi masih diberi deskripsi
development/UAT di seed. Untuk production, Super Admin wajib memastikan akun
Finance memakai template permission yang benar dan tidak menerima permission
Admin Manager di luar tugasnya.

### 2.2 Admin Logistik

Role resmi: `ADMIN_LOGISTIK`.

Admin Logistik bekerja lintas cabang dan bertanggung jawab atas master
inventory, request, reservasi, pengiriman, penerimaan, kontrol stok, dan bagian
operasional purchasing.

### 2.3 Finance & Logistics Controller

Role resmi: `FINANCE_LOGISTICS_CONTROLLER`.

Role ini berfungsi sebagai controller dan reviewer lintas Finance–Logistik.
Fokusnya membaca ledger, valuation, approval, reconciliation, audit, dan
integrasi Zoho. Role ini tidak otomatis menjadi maker untuk semua transaksi.

## 3. Prinsip kerja wajib

1. Jangan mengubah angka langsung melalui database.
2. Jangan menghapus transaksi yang sudah diposting.
3. Koreksi menggunakan reject, cancel, reversal, refund, atau adjustment resmi.
4. Maker tidak boleh menjadi checker atas transaksinya sendiri jika policy
   maker-checker aktif.
5. Bukti transaksi harus sesuai nominal, tanggal, pihak, dan akun.
6. Periksa cabang dan scope stok sebelum menyimpan transaksi.
7. Jangan mengulangi submit hanya karena layar lambat; periksa status dahulu.
8. ERP adalah sumber data utama. Kegagalan Zoho tidak boleh membuat transaksi
   ERP dimasukkan ulang.
9. Tutup periode hanya setelah semua subledger direkonsiliasi.
10. Jangan pernah menggunakan database production untuk integration test.

## 4. Ringkasan pembagian tanggung jawab

| Area | Finance | Admin Logistik | Controller |
|---|---|---|---|
| Invoice member | Buat, finalisasi, baca | Tidak | Review sesuai permission |
| Payment member | Submit, verify, reject, refund | Tidak | Review |
| Kas dan bank | Baca dan kelola | Tidak | Baca |
| Chart of Accounts | Baca dan kelola | Tidak | Baca |
| Journal | Baca dan posting | Tidak | Baca |
| Accounting period | Baca dan kelola | Tidak | Baca |
| Opening balance | Buat, kelola, posting | Tidak | Review sesuai permission |
| Expense | Buat, approve, bayar | Tidak | Baca/review |
| Deferred revenue | Baca, policy, recognition | Tidak | Baca |
| Supplier | Baca dan kelola | Baca/operasional | Baca |
| Purchase Request | Buat dan approve | Buat/operasional | Baca/review |
| Purchase Order | Buat dan baca | Baca/operasional | Baca |
| Goods Receipt | Baca | Posting dan baca | Baca |
| Supplier invoice/AP | Posting dan bayar | Baca terbatas | Baca |
| Master inventory | Baca valuation | Kelola | Baca |
| Request/reservation stok | Baca/review | Kelola | Review |
| Shipment | Baca | Siapkan dan dispatch | Review/dispatch sesuai permission |
| Adjustment/opname | Baca valuation | Buat, hitung, submit/post sesuai permission | Review |
| Audit log | Baca/export | Baca | Baca/export |
| Zoho | Bukan operator default | Bukan operator default | Monitor/retry/reconcile |

Kewenangan akhir selalu mengikuti permission akun di backend, bukan hanya menu
yang terlihat di sidebar.

## 5. Fitur Admin Finance

### 5.1 Invoice member

Fitur:

- melihat invoice;
- membuat dan memperbarui draft invoice;
- memfinalisasi invoice;
- membatalkan invoice sesuai guard;
- melihat bukti pembayaran;
- memeriksa outstanding dan status pembayaran.

Status umum:

```text
DRAFT -> PENDING_PAYMENT -> PAID
                         -> DEBT / OVERDUE
      -> CANCELLED jika masih memenuhi syarat pembatalan
```

Pemeriksaan sebelum finalisasi:

- member dan cabang benar;
- item/paket dan quantity benar;
- diskon mempunyai dasar;
- subtotal, pajak, dan total benar;
- tidak ada invoice duplikat untuk sumber yang sama.

### 5.2 Pembayaran member

Fitur:

- mencatat payment;
- submit payment untuk verifikasi;
- verify atau reject bukti pembayaran;
- refund melalui flow resmi;
- memperbarui outstanding invoice;
- membentuk transaksi kas/bank dan journal setelah verifikasi.

Status:

```text
PENDING -> VERIFIED
        -> REJECTED -> kirim payment baru/koreksi resmi
```

Saat verify, periksa:

- nama pemilik rekening;
- tanggal dan nilai transaksi;
- rekening tujuan;
- payment method;
- invoice yang dibayar;
- kemungkinan bukti yang sudah pernah dipakai.

Payment rejected tidak boleh membuat cash transaction atau journal.

### 5.3 Kas dan bank

Fitur:

- melihat daftar akun kas/bank;
- membuat akun kas/bank sesuai permission;
- melihat transaksi masuk dan keluar;
- menelusuri transaksi ke source document dan journal;
- merekonsiliasi saldo operasional dengan rekening/uang fisik.

Aturan:

- jangan membuat transaksi kas manual untuk menggantikan transaksi dari
  payment, expense, atau AP;
- satu source document hanya boleh menghasilkan posting yang idempotent;
- koreksi menggunakan reversal/refund, bukan edit saldo.

### 5.4 Chart of Accounts

Fitur:

- melihat akun;
- membuat dan memperbarui akun;
- menonaktifkan/menghapus hanya jika belum melanggar referensi transaksi;
- memetakan akun untuk cash, inventory, AP, deferred revenue, revenue, HPP,
  dan expense.

Sebelum membuat akun baru, pastikan kode dan fungsi akun belum tersedia.

### 5.5 Journal dan General Ledger

Fitur:

- melihat journal berdasarkan periode, cabang, source type, dan source ID;
- membuka journal detail;
- posting manual journal sesuai permission;
- reversal manual journal;
- menelusuri debit dan kredit sampai dokumen asal.

Aturan journal:

- total debit harus sama dengan total kredit;
- periode harus terbuka;
- journal manual wajib mempunyai alasan dan evidence;
- jangan membuat journal manual untuk memperbaiki subledger yang salah sebelum
  source document dikoreksi.

### 5.6 Accounting period

Fitur:

- melihat periode;
- membuat periode;
- mengubah status periode;
- mengunci/menutup periode setelah reconciliation;
- mencegah posting ke periode tertutup.

Urutan akhir bulan:

```text
Pastikan dokumen selesai
-> rekonsiliasi subledger
-> review Trial Balance
-> selesaikan selisih
-> backup
-> tutup periode
```

### 5.7 Opening Balance

Fitur:

- melihat opening balance;
- membuat dan memperbarui draft;
- submit;
- reject;
- posting;
- memasukkan saldo akun umum, kas/bank, inventory, dan akun lain sesuai policy.

Opening balance bukan transaksi operasional harian. Gunakan hanya saat cut-off,
migrasi data, atau koreksi awal yang disetujui.

### 5.8 Expense

Fitur:

- membuat expense dan mengunggah evidence;
- memperbarui draft;
- submit;
- approve/reject;
- membayar expense;
- melihat evidence secara terautentikasi.

Flow:

```text
DRAFT -> SUBMITTED/PENDING_APPROVAL -> APPROVED -> PAID
                                  -> REJECTED
```

Efek pembayaran umum:

```text
Debit  Expense
Kredit Kas/Bank
```

### 5.9 Supplier dan purchasing

Fitur Finance:

- melihat dan mengelola supplier;
- membuat Purchase Request;
- submit, approve, atau reject PR sesuai maker-checker;
- membuat Purchase Order dari PR yang disetujui;
- membatalkan PO yang masih memenuhi syarat;
- membaca Goods Receipt;
- mencocokkan PO, receipt, dan supplier invoice.

Flow:

```text
Supplier
-> Purchase Request
-> Approval
-> Purchase Order
-> Goods Receipt
-> Supplier Invoice
-> Accounts Payable
-> Payment
```

### 5.10 Accounts Payable

Fitur:

- melihat AP;
- posting supplier invoice;
- membayar sebagian atau penuh;
- refund supplier payment melalui flow khusus;
- memantau outstanding dan jatuh tempo.

Kontrol three-way match:

- supplier invoice sesuai PO;
- quantity/tagihan sesuai Goods Receipt;
- harga, pajak, dan total sesuai dokumen supplier.

### 5.11 Deferred revenue dan pengakuan omzet

Fitur:

- melihat policy revenue;
- mengelola policy sesuai permission;
- melihat contract deferred revenue;
- melihat event treatment;
- melihat recognition dan profitability;
- menjalankan recognition melalui flow yang diizinkan.

Flow paket:

```text
Payment verified
-> deferred revenue funded
-> sesi terapi completed
-> deferred revenue dilepas
-> revenue diakui per sesi
```

Sesi tanpa paket tidak membentuk deferred revenue. Material tetap menghasilkan
HPP dan pengurangan inventory saat completion.

### 5.12 Finance Reports

Fitur laporan yang digunakan:

- Profit & Loss;
- Trial Balance;
- General Ledger;
- cash/bank activity;
- expense;
- AP dan supplier payment;
- deferred revenue dan recognition;
- revenue, HPP, dan gross profit;
- reconciliation dan exception.

Laporan hanya untuk membaca dan menganalisis. Koreksi dilakukan pada source
document, bukan pada hasil laporan.

### 5.13 Approval Inbox dan audit

Fitur:

- melihat pekerjaan approval;
- approve/reject sesuai permission dan tahap;
- memberikan alasan keputusan;
- membaca audit trail;
- export audit sesuai permission.

## 6. Fitur Admin Logistik

### 6.1 Dashboard Logistik

Fitur:

- ringkasan stok dan nilai inventory;
- stok minimum;
- pergerakan harian;
- request menunggu review;
- reservation aktif;
- shipment belum selesai;
- discrepancy;
- goods receipt;
- adjustment dan opname;
- stock card dan valuation sesuai akses.

### 6.2 Master Inventori

Fitur:

- master product;
- SKU dan kategori;
- base unit dan usage unit;
- UOM;
- konversi unit dan preview;
- warehouse;
- stock location;
- batch dan expiry;
- minimum stock;
- hubungan item dengan cabang/lokasi;
- Treatment BOM.

Aturan:

- hindari SKU duplikat;
- jangan mengubah faktor konversi setelah transaksi tanpa analisis dampak;
- batch/expiry wajib untuk barang yang memerlukannya;
- master tidak aktif tidak boleh digunakan untuk transaksi baru.

### 6.3 Ledger Stok

Fitur:

- melihat inventory balance;
- melihat posting inventory;
- melihat source reference;
- opening stock sesuai permission;
- receipt dan issue;
- reversal posting;
- reconciliation quantity dan value;
- FIFO cost layer dan allocation.

Ledger adalah sumber kebenaran stok. Angka kartu stok tidak boleh diperbaiki
dengan edit langsung.

### 6.4 Mutasi stok

Fitur:

- melihat mutasi per item, cabang, lokasi, tanggal, dan reference;
- membaca stock before dan stock after;
- export mutasi;
- menelusuri mutasi ke session, shipment, receipt, adjustment, atau opname.

### 6.5 Request stok

Fitur:

- melihat seluruh request sesuai scope;
- membuat/memperbarui request sesuai permission;
- melihat pending review;
- approve penuh atau sebagian;
- reject dengan alasan;
- menangani flow Premier dan Partnership;
- invoice/payment flow untuk request Partnership jika diperlukan.

Flow:

```text
PENDING
-> PARTIALLY_APPROVED / APPROVED
-> reservation
-> shipment
-> received/completed

PENDING -> REJECTED
```

Approver boleh mengurangi quantity, tetapi tidak boleh menaikkan di atas
quantity request.

### 6.6 Reservasi stok

Fitur:

- membuat reservasi dari approval;
- approve reservation;
- release reservation;
- melihat active, consumed, dan released reservation;
- mencegah stok yang sama dialokasikan ke dua transaksi.

Reservation tidak memindahkan nilai inventory. Nilai bergerak saat posting
shipment/issue.

### 6.7 Pengiriman internal

Fitur:

- melihat dan membuat shipment dari request/reservation;
- memperbarui shipment sebelum dispatch;
- approve sesuai policy;
- dispatch;
- penerimaan penuh atau sebagian;
- bukti penerimaan;
- menangani issue dan discrepancy;
- laporan pengiriman.

Flow:

```text
PREPARING
-> SHIPPED
-> PARTIALLY_RECEIVED
-> RECEIVED / COMPLETED
-> RECEIVED_WITH_ISSUE jika ada selisih
```

Saat dispatch:

- stok available sumber berkurang;
- nilai masuk inventory in-transit;
- reservation berubah menjadi consumed;
- retry tidak membuat posting kedua.

Saat receive:

- catat quantity aktual;
- stok tujuan bertambah;
- nilai in-transit dipindahkan ke inventory tujuan;
- selisih dicatat sebagai discrepancy.

Jenis discrepancy:

- shortage;
- damage;
- wrong item;
- other.

### 6.8 Goods Receipt

Fitur:

- melihat Purchase Order yang siap diterima;
- posting penerimaan sebagian/penuh;
- mencatat quantity, UOM, batch, expiry, condition, lokasi, dan unit cost;
- membentuk inventory balance, mutation, FIFO cost layer, dan source link;
- menjaga idempotensi penerimaan.

Condition umum:

- `GOOD`;
- `DAMAGED`;
- `EXPIRED`;
- `OTHER`.

Barang rusak/expired tidak boleh langsung dianggap available.

### 6.9 Adjustment

Fitur:

- membuat adjustment;
- memilih reason code;
- submit;
- approve/reject sesuai permission;
- posting;
- membentuk mutation, valuation, journal, dan audit.

Reason umum:

- expired;
- damaged;
- lost;
- stock opname;
- other.

### 6.10 Stock opname

Fitur:

- membuat opname;
- mengambil snapshot system quantity;
- mengunci scope yang sedang dihitung;
- mencatat physical quantity;
- menghitung variance;
- submit;
- approve/reject;
- posting variance;
- recount setelah rejection sesuai flow.

Flow:

```text
DRAFT -> COUNTING -> PENDING_APPROVAL -> APPROVED -> POSTED
                                   -> REJECTED -> recount
```

### 6.11 Treatment BOM dan penggunaan material

Fitur:

- melihat/mengelola BOM sesuai permission;
- menentukan rekomendasi material per treatment;
- memantau material draft dan actual;
- membaca riwayat penggunaan barang;
- memastikan deviasi dari BOM memiliki alasan.

Saat sesi selesai:

- actual material diposting;
- stok berkurang dengan FIFO;
- HPP terbentuk;
- retry completion tidak mengurangi stok dua kali.

Sesi tanpa paket tetap mengurangi stok, tetapi tidak mengurangi voucher Basic
atau Booster dan tidak mengakui revenue paket.

### 6.12 Tas Homecare dan tim

Fitur:

- membuat tim homecare;
- tim harus memiliki minimal satu Nakes dan satu Admin Layanan;
- membuat dan assign tas;
- request isi tas;
- approve/reject request;
- shipment dan receive tas;
- mencatat penggunaan;
- return barang;
- opname tas;
- multi-bag usage untuk satu tindakan.

### 6.13 Laporan logistik

Fitur:

- logistics dashboard;
- stock card;
- inventory valuation;
- laporan shipment;
- mutasi stok;
- penggunaan material;
- stok minimum;
- batch/expiry;
- in-transit dan discrepancy.

### 6.14 Approval Inbox dan audit

Admin Logistik dapat melihat approval dan melakukan keputusan hanya jika
permission serta tahap approval mengizinkan. Audit approval bersifat immutable.

## 7. Fitur Finance & Logistics Controller

Fitur utama:

- membaca akun, journal, kas/bank, expense;
- membaca inventory dan valuation;
- inventory reconciliation;
- membaca dan mereview request/reservation/shipment;
- dispatch atau resolve sesuai permission;
- membaca supplier, PR, PO, receipt, AP, dan deferred revenue;
- Approval Inbox;
- audit log;
- memonitor Zoho sync;
- retry event Zoho;
- menjalankan reconciliation Zoho.

Controller tidak boleh mengambil alih maker secara rutin. Tugasnya memastikan
angka Finance dan Logistik konsisten serta exception diselesaikan dengan bukti.

## 8. Flow data end-to-end

### 8.1 Transfer stok antar scope

```text
Request cabang
-> approval
-> reservation
-> shipment
-> dispatch
-> inventory in-transit
-> penerimaan aktual
-> stok tujuan
-> discrepancy resolution jika perlu
-> laporan dan reconciliation
```

### 8.2 Procure-to-pay

```text
Supplier
-> Purchase Request
-> approval
-> Purchase Order
-> Goods Receipt
-> FIFO inventory
-> Supplier Invoice
-> Accounts Payable
-> Payment/refund
-> kas/bank dan journal
```

### 8.3 Member-to-cash

```text
Invoice member
-> payment submitted
-> Finance verify
-> kas/bank
-> journal
-> outstanding turun
-> deferred revenue funded
-> sesi selesai
-> revenue recognition dan HPP
```

## 9. Status yang wajib dipahami

| Area | Status penting |
|---|---|
| Payment | PENDING, VERIFIED, REJECTED |
| Stock request | PENDING, PARTIALLY_APPROVED, APPROVED, REJECTED |
| Reservation | ACTIVE, CONSUMED, RELEASED |
| Shipment | PREPARING, SHIPPED, PARTIALLY_RECEIVED, RECEIVED_WITH_ISSUE, COMPLETED |
| Purchase Request | DRAFT, SUBMITTED, APPROVED, REJECTED, CONVERTED |
| Purchase Order | ISSUED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED |
| Supplier invoice/AP | POSTED, PARTIALLY_PAID, PAID |
| Expense | DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PAID |
| Adjustment | DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, POSTED, CANCELLED |
| Opname | DRAFT, COUNTING, PENDING_APPROVAL, APPROVED, REJECTED, POSTED |
| Zoho event | PENDING, PROCESSING, PROCESSED, FAILED, DEAD_LETTER, DRY_RUN, IGNORED |

## 10. Checklist harian Finance

- [ ] Periksa payment `PENDING`.
- [ ] Verify/reject bukti pembayaran.
- [ ] Periksa transaksi kas/bank tanpa source atau journal.
- [ ] Periksa invoice outstanding dan payment parsial.
- [ ] Periksa expense menunggu approval/pembayaran.
- [ ] Periksa AP jatuh tempo.
- [ ] Periksa supplier invoice dan three-way match.
- [ ] Periksa deferred revenue dan recognition gagal.
- [ ] Periksa Approval Inbox.
- [ ] Periksa periode akuntansi aktif.
- [ ] Rekonsiliasi exception prioritas tinggi.

## 11. Checklist harian Admin Logistik

- [ ] Periksa stok minimum dan stok negatif.
- [ ] Periksa request menunggu review.
- [ ] Periksa reservation aktif terlalu lama.
- [ ] Siapkan shipment berdasarkan reservation.
- [ ] Periksa shipment belum diterima.
- [ ] Selesaikan discrepancy.
- [ ] Periksa Goods Receipt dan kondisi barang.
- [ ] Periksa batch mendekati expiry.
- [ ] Periksa adjustment/opname menunggu tindakan.
- [ ] Periksa material usage draft atau gagal posting.
- [ ] Periksa tas dan tim homecare.
- [ ] Periksa Approval Inbox dan audit exception.

## 12. Checklist akhir bulan bersama

- [ ] Semua payment, expense, AP, receipt, shipment, dan adjustment sudah final.
- [ ] Tidak ada shipment in-transit tanpa penjelasan.
- [ ] Stock opname material selesai.
- [ ] Quantity inventory cocok dengan ledger.
- [ ] Inventory valuation cocok dengan akun persediaan.
- [ ] Kas/bank direkonsiliasi.
- [ ] AP dan outstanding direkonsiliasi.
- [ ] Deferred revenue dan recognized revenue direkonsiliasi.
- [ ] Revenue, HPP, dan gross profit direview.
- [ ] Trial Balance seimbang.
- [ ] Exception didokumentasikan.
- [ ] Backup database dan object storage tersedia.
- [ ] Periode ditutup setelah approval.

## 13. Penanganan kesalahan

| Masalah | Tindakan |
|---|---|
| Payment salah | Reject sebelum verify; refund/reversal setelah verify |
| Journal salah | Koreksi source atau journal reversal |
| Request quantity salah | Edit sebelum approval atau reject dan ajukan ulang |
| Shipment belum dispatch | Koreksi dokumen sesuai guard |
| Shipment sudah dispatch | Gunakan receipt/discrepancy/return, jangan edit ledger |
| Goods Receipt salah | Gunakan reversal/koreksi resmi sesuai status |
| Stok fisik berbeda | Stock opname atau adjustment dengan approval |
| Sesi mengurangi stok salah | Koreksi material sebelum completion; cancel completion/reversal setelah posting |
| Zoho gagal | Perbaiki mapping, reconcile, retry event yang sama |
| Data terlihat ganda | Periksa source ID dan idempotency key sebelum membuat transaksi baru |

## 14. Larangan

- Dilarang berbagi akun.
- Dilarang approve transaksi sendiri jika maker-checker berlaku.
- Dilarang menggunakan bukti pembayaran yang sama dua kali.
- Dilarang mengedit saldo melalui SQL.
- Dilarang menghapus journal, audit log, atau posting inventory.
- Dilarang menerima barang berdasarkan quantity PO tanpa menghitung fisik.
- Dilarang menambah stok melalui adjustment untuk menggantikan Goods Receipt.
- Dilarang memaksa periode tertutup menerima posting.
- Dilarang mengaktifkan Zoho `LIVE` tanpa mapping, reconciliation, dan approval.
- Dilarang mengirim data medis ke Zoho.

## 15. Zoho

Mode aman:

```text
OFF -> DRY_RUN -> CANARY -> LIVE
```

Admin Finance dan Admin Logistik bukan operator koneksi Zoho default. Aktivitas
connection/mapping berada pada Super Admin dan Controller sesuai permission.

Jika Zoho gagal:

1. jangan ulang transaksi di ERP;
2. periksa event dan sync attempt;
3. perbaiki mapping/capability;
4. jalankan reconciliation;
5. retry event yang sama;
6. rollback mode ke `OFF` bila diperlukan.

## 16. Kriteria siap operasional

- [ ] Akun memakai role/template yang benar.
- [ ] Branch scope benar.
- [ ] Maker dan checker adalah orang berbeda.
- [ ] Opening balance dan inventory awal sudah direkonsiliasi.
- [ ] Accounting period aktif tersedia.
- [ ] Warehouse dan stock location tersedia.
- [ ] UOM, conversion, batch, dan Treatment BOM sudah benar.
- [ ] Kas/bank dan Chart of Accounts sudah benar.
- [ ] Supplier dan payment method sudah benar.
- [ ] Database backup berhasil diuji.
- [ ] Concurrency dan go-live database test lulus.
- [ ] UAT Finance & Logistik dan Admin Manager lulus.

## 17. Catatan implementasi penting

1. Profil Finance saat ini masih bernama internal `FINANCE_DUMMY`. Sebelum
   production penuh, sebaiknya dibuat role/template Finance system yang permanen
   dan tidak menggunakan penamaan dummy.
2. Menu frontend berbasis base role, sedangkan aksi backend berbasis permission.
   Jika menu terlihat tetapi backend menolak, periksa role template akun; jangan
   menambah permission tanpa persetujuan.
3. `FINANCE_LOGISTICS_CONTROLLER` adalah controller, bukan pengganti Admin
   Finance atau Admin Logistik untuk semua tugas maker.
4. Zoho dapat tetap `OFF`; transaksi Finance dan Logistik ERP tetap berjalan.

## 18. Referensi

- [Flow Finance dan Logistik Terbaru](./FLOW_FINANCE_DAN_LOGISTIK_TERBARU.md)
- [Flow Penggunaan Aplikasi](./FLOW_PENGGUNAAN_APLIKASI.md)
- [Panduan Lengkap ERP RAHO untuk Pengguna Awam](./PANDUAN_LENGKAP_ERP_RAHO_UNTUK_PENGGUNA_AWAM.md)
- [Panduan Fitur Finance dan Flow](./PANDUAN_FITUR_FINANCE_DAN_FLOW.md)
- [Checklist E2E Finance, Logistik, dan Zoho](./updatelogisticnFinnance/TEST_CHECKLIST_END_TO_END_FINANCE_LOGISTIK_ZOHO.md)
- [Pusat Dokumen UAT](./UAT/README.md)
- [UAT Finance](./UAT/UAT_FINANCE.md)
- [UAT Admin Manager](./UAT/UAT_ADMIN_MANAGER.md)
- [Regresi Finance, Logistik, dan Sesi Terapi](./UAT/UAT_FINANCE_LOGISTIK_DAN_SESI_TERAPI.md)
