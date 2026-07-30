# Laporan Bulanan Development RAHO

**Periode:** 1–30 Juli 2026, sampai pukul 15.51 WIB  
**Jenis laporan:** Month-to-date  
**Project:** RAHO ERP / Clinic Management System  
**Repository:** `RAHO_APPS`  
**Baseline awal:** `c0a334e` — 30 Juni 2026  
**Baseline akhir yang diaudit:** `b9d3285` — 30 Juli 2026  
**Audiens:** Tim IT, Product Owner, operasional klinik, Finance, dan Logistik

---

## 1. Executive Summary

Pengembangan Juli 2026 mengubah RAHO dari aplikasi operasional klinik yang
berfokus pada member dan sesi terapi menjadi sistem yang juga memiliki fondasi
Finance, Inventory, Logistik, Purchasing, Approval, dan integrasi Zoho Books.

Perubahan utama bulan ini:

- stabilisasi alur member, paket, pembayaran, therapy plan, dan sesi terapi;
- dukungan data lama pada edit pembelian paket agar referensi historis tidak
  rusak;
- kategori Rank Member berdasarkan diskon pembelian paket terakhir;
- tampilan dan navigasi yang lebih sederhana untuk Admin Layanan, Dokter, dan
  Tenaga Kesehatan;
- halaman **Inventori Tim Layanan** berstatus **Coming Soon**, tanpa mengubah
  flow stok lama;
- fondasi accounting, kas/bank, opening balance, expense, purchasing/AP,
  deferred revenue, dan laporan keuangan;
- inventory ledger, FIFO, batch/expiry, reservation, stock request, shipment,
  goods receipt, treatment BOM, opname, dan audit;
- permission granular, branch scope, maker-checker, approval engine, serta
  audit akses ditolak;
- integrasi Zoho Books berbasis antrean asynchronous, mapping, reconciliation,
  webhook, exception handling, dan tahapan `OFF` → `DRY_RUN` → `CANARY` →
  `LIVE`;
- perbaikan build Docker agar proses API dan Web tidak saling berebut memori.

Kesimpulan untuk IT: fungsi inti klinik tetap menjadi sumber transaksi utama.
Zoho diposisikan sebagai adapter Finance/Logistik dan tidak boleh menghambat
pembelian paket, pembayaran, sesi terapi, maupun pergerakan stok lokal.

---

## 2. Ringkasan Angka Perubahan

| Metrik | Nilai | Catatan |
|---|---:|---|
| Commit | 157 | Termasuk merge, dokumentasi, feature, fix, dan test |
| Kontributor | 4 | 128, 23, 4, dan 2 commit per kontributor |
| File berubah | 938 | Termasuk source, test, migration, dokumentasi, dan arsip summary |
| Penambahan baris | 103.715 | Berdasarkan `git diff --shortstat` |
| Penghapusan baris | 88.441 | Termasuk penghapusan/penyegaran dokumen lama |
| Migration database baru | 54 | Harus diterapkan berurutan dan diuji di staging |
| File test berubah | 142 | 107 API, 18 Web E2E, dan 17 Web unit/component |
| Halaman staff baru | 22 | Terutama Finance, Inventory, Permission, Import, dan Zoho |

Catatan: angka churn tinggi tidak seluruhnya berarti perubahan business logic.
Sebagian berasal dari penghapusan dokumentasi lama, arsip summary, perubahan
format, serta penambahan modul besar Finance/Logistik/Zoho.

Definisi status pada laporan ini:

- **Selesai** berarti implementasi tersedia pada baseline source
  `b9d3285`.
- **Selesai** tidak otomatis berarti sudah dipromosikan ke production.
- Status deployment production, penerapan migration, dan aktivasi Zoho harus
  dikonfirmasi terpisah oleh IT/DevOps.

---

## 3. Status Implementasi per Area

### 3.1 Member, paket, pembayaran, dan kompatibilitas data lama

| Perubahan | Implementasi | Dampak operasional | Status |
|---|---|---|---|
| Pencarian dan filter member | Pencarian nama, nomor member, telepon, cabang, status, serta konfigurasi kolom | Admin Layanan lebih cepat menemukan member | Selesai |
| Tampilan member lebih bersih | Ringkasan, indikator kelengkapan data, tombol aksi, dan detail per tab | Mengurangi perpindahan menu dan kebingungan pengguna | Selesai |
| Import data historis | Import member/account lama, validasi nomor member/telepon, dan ekspor data yang dilewati | Migrasi data lama lebih terkontrol | Selesai, tetap perlu rehearsal dengan salinan production |
| Edit paket lama | Paket yang tidak mempunyai `packagePricingId` atau `productCode` dapat dicocokkan kembali tanpa mengganti ID historis | Mengatasi error **“Referensi data tidak valid”** dan menjaga foreign key lama | Selesai |
| Proteksi submit ganda | Request edit paket tidak dikirim dua kali saat tombol diklik berulang | Mengurangi duplikasi transaksi | Selesai |
| Rank Member | Rank dihitung dari diskon pembelian paket non-cancelled terakhir | Segmentasi member terlihat langsung di daftar dan detail | Selesai |
| Kolom Rank wajib | Preferensi kolom browser lama dinormalisasi; Rank tidak dapat disembunyikan | UI konsisten untuk semua admin | Selesai |

Aturan Rank Member:

| Rank | Diskon pembelian paket terakhir |
|---|---:|
| A | 0–20% |
| B | lebih dari 20% sampai 50% |
| C | lebih dari 50% sampai 100% |

Ketentuan teknis:

- pembelian bundle dihitung sebagai satu kelompok pembelian;
- paket berstatus `CANCELLED` tidak dipakai;
- `discountAmount` dihitung terhadap nilai sebelum diskon;
- `discountPercent` lama tetap menjadi fallback;
- member tanpa pembelian valid menampilkan **Belum ada rank**, bukan error.

### 3.2 Sesi terapi dan workflow klinis

| Perubahan | Implementasi | Dampak operasional | Status |
|---|---|---|---|
| Penomoran sesi per cabang | Nomor sesi melanjutkan urutan cabang dan tidak kembali ke 1 | Nomor dokumen lebih konsisten | Selesai |
| Therapy plan | Perbaikan edit, delete untuk plan yang belum digunakan, dosis minimum, parsing nilai, dan HHO Konsentrat | Dokter lebih aman mengoreksi rencana terapi | Selesai |
| Edit sesi | Perbaikan edit plan/booster dan konteks cabang | Data sesi lebih konsisten | Selesai |
| UI sesi | Tahapan dikelompokkan menjadi Persiapan, Pelaksanaan, Setelah Terapi, dan Evaluasi | Dokter/Nakes lebih mudah mengetahui posisi proses | Selesai |
| Material usage | BOM, rekomendasi material, pencatatan aktual, FIFO, batch, dan alasan deviasi | Pemakaian bahan dapat diaudit | Selesai |
| Penyelesaian atomic | Completion sesi, konsumsi stok, HPP, dan revenue diproses dengan guard anti-duplikasi | Mengurangi kondisi sesi selesai tetapi stok/finance gagal setengah jalan | Selesai |
| Data lama deferred flow | Versi flow package revenue dan treatment completion dicatat | Data historis tidak dipaksa mengikuti asumsi transaksi baru | Selesai, perlu monitoring production |

### 3.3 UI dan navigasi berdasarkan peran

| Peran | Perubahan |
|---|---|
| Admin Layanan | Dashboard tugas harian, shortcut ke Sesi dan Member, halaman Member yang lebih ringkas, serta akses Inventori Tim |
| Dokter | Dashboard fokus sesi aktif dan pencarian pasien; detail sesi menunjukkan fase kerja |
| Tenaga Kesehatan | Dashboard fokus sesi yang perlu dilanjutkan dan shortcut Inventori Tim |
| Admin/Manager | Sidebar dikelompokkan menjadi Klinik, Inventory, Finance, Sistem, dan komunikasi sesuai permission |

Komponen workspace per peran dibuat reusable sehingga label, CTA, dan empty
state lebih konsisten.

### 3.4 Inventori dan Logistik

| Kapabilitas | Ringkasan implementasi | Status |
|---|---|---|
| Master inventory | Produk, kategori, UOM, konversi, branch type, warehouse, dan stock location | Selesai |
| Ledger dan valuasi | Inventory balance, mutation ledger, batch, expiry, cost layer, dan FIFO | Selesai |
| Request stok | Request, full/partial approval, reservation, release, dan rekap requester | Selesai |
| Internal transfer | Shipment, partial receipt idempotent, in-transit posting, dan quantity guard | Selesai |
| Purchasing receipt | Goods receipt partial, kondisi barang, batch/expiry, dan cost layer pembelian | Selesai |
| Treatment material | Treatment BOM dan konsumsi FIFO pada sesi | Selesai |
| Kontrol stok | Adjustment, stock opname, approval, journal, dan laporan valuasi | Selesai |
| Homecare | Multi-bag, serah terima, penggunaan, dan riwayat tas | Selesai |
| Laporan logistik | Dashboard, shipment report, inventory valuation, dan penggunaan material | Selesai |
| Inventori Tim Layanan | Petunjuk kerja Admin Layanan/Nakes dan shortcut ke flow lama | **Coming Soon** |

Halaman Inventori Tim saat ini sengaja bersifat read-only/panduan. Halaman
tersebut tidak mengubah saldo stok dan mengarahkan pengguna ke sesi terapi,
stok cabang, riwayat material, atau tas homecare yang sudah tersedia.

### 3.5 Finance dan Accounting

| Kapabilitas | Ringkasan implementasi | Status |
|---|---|---|
| Accounting foundation | Chart of Accounts, journal entry/line, balance validation, accounting period, source link, reversal | Selesai |
| Invoice dan payment | Snapshot invoice, partial/full payment, verification, evidence, dan posting kas/bank | Selesai |
| Opening balance | Draft, review, posting, inventory opening stock, audit, dan koreksi flow | Selesai |
| Expense | Evidence, approval, paid-through account, dan posting | Selesai |
| Purchasing/AP | Supplier, PR, PO, goods receipt, supplier invoice, bill/AP, payment, dan refund | Selesai |
| Deferred revenue | Benefit valuation, retainer/deferred revenue, revenue per sesi, HPP, dan anti-double recognition | Selesai |
| Approval engine | Multi-step approver, maker-checker, approval inbox, dan audit keputusan | Selesai |
| Finance reports | P&L, GL, Trial Balance, cash/bank, deferred revenue, reconciliation, dan period lock | Selesai |

Finance lokal harus tetap dapat beroperasi saat Zoho tidak tersedia.

### 3.6 Permission, keamanan, dan audit

- Permission granular dan role template.
- User override dengan guard anti-self-escalation.
- Scope akses cabang untuk Admin Manager dan role terkait.
- Middleware `requirePermission` dan validasi branch access.
- Approval maker-checker untuk transaksi sensitif.
- Audit akses ditolak dan audit perubahan lintas modul.
- Debug logging request paket yang berpotensi memuat data sensitif telah
  dibersihkan dari controller.
- Webhook Zoho memakai secret/signature dan memvalidasi organization.
- Tombol retry, mapping, reconciliation, dan go-live dibatasi permission.

### 3.7 Zoho Books untuk Finance dan Logistik

Integrasi yang dibangun mencakup:

- OAuth connection dan pemilihan organization;
- discovery capability dan scope;
- contact/customer/vendor mapping;
- item, location, account, UOM, dan tax mapping;
- sales invoice dan customer payment;
- retainer/deferred revenue dan pengakuan omzet terapi;
- expense;
- partnership sale;
- purchase order;
- supplier invoice ke Zoho Bill;
- supplier payment ke Vendor Payment;
- inventory adjustment;
- outbox event, retry, dead-letter, preview, dan audit attempt;
- webhook inbox dan correlation;
- reconciliation serta exception resolution;
- kontrol go-live `OFF`, `DRY_RUN`, `CANARY`, dan `LIVE`;
- rollback ke `OFF` tanpa menghapus transaksi lokal.

Boundary keselamatan:

```text
Transaksi operasional dibuat di RAHO
              ↓
Outbox lokal disimpan
              ↓
Worker Zoho memproses asynchronous
              ↓
Zoho gagal/outage → RAHO tetap berjalan, event dapat diulang
```

Tidak ada controller/service pembelian paket, pembayaran, sesi terapi,
inventory, shipment, atau purchasing yang bergantung pada network call Zoho
untuk menyelesaikan transaksi lokal.

Default deployment harus tetap:

```env
ZOHO_SYNC_WORKER_ENABLED=false
ZOHO_SYNC_DRY_RUN=true
ZOHO_RECONCILIATION_ENABLED=false
```

Mode `LIVE` baru boleh dipilih setelah mapping selesai, reconciliation bersih,
approval Finance dan Logistik tersedia, serta CANARY melewati masa observasi.

---

## 4. Infrastruktur dan Deployment

Perubahan penting:

- heap build API diatur default 3.072 MB;
- heap build Web diatur default 2.048 MB;
- nilai dapat dioverride melalui `API_BUILD_MEMORY_MB` dan
  `WEB_BUILD_MEMORY_MB`;
- image API dan Web dibangun secara berurutan pada deployment runner;
- jika build utama gagal, retry dilakukan dengan `--no-cache`;
- perubahan `.dockerignore` ikut memicu workflow deployment;
- konfigurasi Zoho dibuat opsional agar API tetap start saat kredensial belum
  tersedia;
- migration tetap dijalankan sebelum service production dinaikkan.

Perubahan ini menangani error:

```text
FATAL ERROR: Reached heap limit
Allocation failed - JavaScript heap out of memory
```

Catatan IT: penambahan heap menyelesaikan batas V8, tetapi host CI tetap harus
memiliki RAM dan swap yang cukup. Build sequential mengurangi puncak pemakaian
memori dibanding membangun API dan Web bersamaan.

---

## 5. Kompatibilitas Data Lama

Guard yang telah ditambahkan:

1. Paket lama tanpa `packagePricingId` atau `productCode` dicocokkan dengan
   pricing aktif berdasarkan atribut yang tersedia.
2. Record lama diperbarui dengan mempertahankan ID stabil sehingga invoice,
   encounter, finance record, dan foreign key lain tidak putus.
3. Paket yang sudah digunakan tidak diperlakukan sama dengan paket kosong.
4. UI menahan submit ganda saat edit paket.
5. Rank menggunakan fallback `discountPercent` lama dan aman terhadap nilai
   kosong/non-numeric.
6. Member tanpa riwayat paket valid mendapatkan rank `null`, bukan exception.
7. Flow version ditambahkan untuk package revenue dan treatment completion
   agar transaksi historis dapat dibedakan dari flow terbaru.
8. Historical member import menyediakan validasi dan daftar record yang
   dilewati.

Yang tetap perlu dilakukan sebelum deployment production:

- backup database;
- restore backup ke staging;
- jalankan seluruh 54 migration pada salinan tersebut;
- uji sampel paket lama, invoice lama, member tanpa telepon/consent, sesi lama,
  saldo stok lama, dan opening balance;
- bandingkan jumlah record dan total nominal sebelum/sesudah migration;
- jangan melakukan koreksi massal langsung di production.

---

## 6. Evidence Pengujian

### 6.1 Pemeriksaan saat laporan dibuat

| Pemeriksaan | Hasil |
|---|---|
| Type-check API | Lulus |
| Type-check Web | Lulus |
| Type-check gabungan | Lulus |
| Unit test Rank Member | 13/13 lulus |
| Playwright edit paket lama + Rank UI | 1/1 lulus |

Skenario Playwright terakhir membuktikan:

- Admin Layanan dapat membuka halaman Member;
- kolom **Rank Member** tetap muncul walaupun local storage lama menyimpannya
  sebagai hidden;
- badge **Rank C · 60%** tampil;
- Rank tampil pada detail member;
- paket lama dengan `packagePricingId = null` dan `productCode = null` dapat
  diedit;
- klik simpan ganda hanya menghasilkan satu request.

### 6.2 Coverage yang ditambahkan/diubah bulan ini

Area test mencakup:

- authentication, permission, branch scope, impersonation, dan audit;
- member registration/update/import/rank;
- package invoice generation dan legacy package edit;
- session creation, therapy plan, booster, material usage, dan atomic
  completion;
- inventory ledger, FIFO, concurrency, shipment, reservation, goods receipt,
  opname, dan valuation;
- accounting posting, payment concurrency, opening balance, expense,
  purchasing/AP, revenue recognition, dan approval;
- Zoho contact/item/invoice/payment/retainer/expense/PO/bill/vendor payment,
  webhook, reconciliation, go-live, dan worker;
- E2E login, member CRUD, payment, session therapy, inventory, reports,
  notifications, navigation, dan local core tanpa Zoho.

### 6.3 Batas klaim pengujian

Laporan ini tidak menyatakan seluruh 142 file test dijalankan ulang dalam satu
full regression pada saat kompilasi laporan. Sebelum release production, IT
tetap perlu menjalankan regression suite, database integration test, backup
rehearsal, dan smoke test pada image Docker final.

---

## 7. Urutan Presentasi yang Disarankan

Durasi ideal: 20–30 menit. Gunakan data dummy atau data yang sudah disamarkan.

| Urutan | Audiens/peran | Menu dan page | Bagian yang ditunjukkan | Pesan utama |
|---:|---|---|---|---|
| 1 | Semua | Login lalu `/dashboard/admin-layanan`, `/dashboard/doctor`, `/dashboard/nurse` | Workspace per peran, tugas utama, dan tombol cepat | Sistem lebih sederhana karena setiap peran langsung melihat pekerjaan yang relevan |
| 2 | Admin Layanan | **Member** → `/members` | Pencarian, filter, indikator data kosong, kolom Rank, status, dan Lihat Detail | Pencarian member dan identifikasi data bermasalah lebih cepat |
| 3 | Admin Layanan/IT | `/members/{memberId}` | Kartu Rank, tab Profil, Paket, Sesi, Diagnosis, Therapy Plan, dan Hasil Lab | Seluruh konteks member berada dalam satu halaman |
| 4 | Admin Layanan/IT | `/members/{memberId}` → tab **Paket** | Edit paket historis yang referensinya lama; klik simpan sekali | Data lama tetap dapat dipakai tanpa mengganti ID historis |
| 5 | Admin Layanan/Manager | **Pembayaran** → `/payments` | Status invoice/payment, bukti, verification, dan reject/resubmit | Aktivasi paket mengikuti pembayaran terverifikasi |
| 6 | Dokter/Nakes | **Sesi Terapi** → `/sessions` lalu `/sessions/{sessionId}` | Fase Persiapan, Pelaksanaan, Setelah Terapi, Evaluasi; progress 9 langkah | Pengguna selalu mengetahui langkah saat ini dan langkah berikutnya |
| 7 | Dokter/Nakes/IT | `/sessions/{sessionId}` | Therapy plan, infus aktual, material usage, deviasi, dan completion | Penyelesaian sesi terhubung ke pemakaian stok, HPP, dan revenue secara atomic |
| 8 | Admin Layanan/Nakes | **Inventori Tim** → `/inventory/team` | Badge **Coming Soon**, empat langkah kerja, pembagian tanggung jawab, dan shortcut flow lama | Fitur masa depan sudah disiapkan tanpa mengganggu stok yang berjalan |
| 9 | Logistik | `/inventory/dashboard` dan `/inventory/master-data` | KPI stok, produk, UOM, lokasi, batch, dan expiry | Master dan visibilitas stok sudah terstruktur |
| 10 | Logistik | `/inventory/stock-requests` → `/inventory/shipments` → `/inventory/goods-receipts` | Request, approval, reservation, partial shipment, dan receipt | Pergerakan fisik memiliki jejak dan status yang jelas |
| 11 | Logistik/Nakes | `/inventory/treatment-boms` dan `/inventory/material-usage-history` | Rekomendasi bahan dan realisasi penggunaan per terapi | Hubungan treatment dengan inventory dapat diaudit |
| 12 | Finance | `/accounting`, `/cash-bank`, `/opening-balances`, `/expenses` | COA, journal, rekening, saldo awal, expense, evidence, dan posting | Fondasi pembukuan lokal tidak bergantung pada Zoho |
| 13 | Finance/Procurement | `/purchasing` dan `/approvals` | Supplier → PR → PO → receipt → bill/AP → payment serta maker-checker | Purchasing dan pembayaran mengikuti kontrol persetujuan |
| 14 | Finance/Management | `/revenue-recognition` dan `/finance-reports` | Deferred revenue, release per sesi, P&L, GL, Trial Balance, dan reconciliation | Pendapatan paket tidak langsung diakui seluruhnya sebelum layanan diberikan |
| 15 | IT/Finance/Logistik | **Integrasi Zoho** → `/admin/integrations/zoho` | Connection status, discovery, mapping, antrean, preview, reconciliation, dan exception | Zoho hanya menerima transaksi yang sudah dikontrol dan dapat diaudit |
| 16 | IT/Management | `/admin/integrations/zoho` → tab **Go-live & Exception** | Mode `OFF`, `DRY_RUN`, `CANARY`, `LIVE`, approval, observation, dan rollback | Go-live dilakukan bertahap; kegagalan Zoho tidak menghentikan RAHO |
| 17 | IT/Security | `/admin/permissions` dan `/admin/audit-logs` | Role template, permission, branch scope, denied access, dan audit trail | Akses sensitif dibatasi dan dapat ditelusuri |

### 7.1 Bagian wajib untuk presentasi singkat 10 menit

Jika waktu terbatas, tunjukkan lima bagian berikut:

1. `/members` — tampilan bersih, kelengkapan data, dan Rank Member.
2. `/members/{memberId}` — detail terpadu dan edit paket lama.
3. `/sessions/{sessionId}` — fase proses serta penyelesaian sesi.
4. `/inventory/team` — Coming Soon dan bukti flow lama tetap aktif.
5. `/admin/integrations/zoho` — antrean asynchronous serta mode
   `OFF/DRY_RUN/CANARY/LIVE`.

### 7.2 Hal yang tidak boleh dilakukan saat presentasi

- Jangan menampilkan OAuth token, client secret, webhook secret, `.env`, NIK,
  nomor telepon, rekam medis, atau bukti pembayaran asli.
- Jangan menekan **LIVE** menggunakan organization production.
- Jangan menjalankan retry massal, reconciliation write, stock adjustment,
  posting opening balance, atau payment verification dengan data production.
- Jangan mengubah mapping Zoho hanya untuk kebutuhan demo.
- Gunakan Zoho sandbox/test organization dan mulai dari mode `OFF` atau
  `DRY_RUN`.
- Untuk demonstrasi aksi write, siapkan tenant dan database demo yang dapat
  di-reset.

---

## 8. Checklist Persiapan Demo untuk IT

### H-1

- [ ] Tentukan commit/image yang akan didemokan.
- [ ] Backup database dan object storage demo.
- [ ] Pastikan migration sudah selesai.
- [ ] Jalankan `npm run type-check:all`.
- [ ] Build image API dan Web secara sequential.
- [ ] Jalankan test kritis member, package, payment, session, inventory, dan
      local-core-without-Zoho.
- [ ] Pastikan mode Zoho `OFF` atau `DRY_RUN`.
- [ ] Siapkan user peran Admin Layanan, Dokter, Nakes, Finance, Logistik, dan
      Super Admin.

### Data demo

- [ ] Satu member dengan Rank A.
- [ ] Satu member dengan Rank B.
- [ ] Satu member dengan Rank C.
- [ ] Satu member tanpa pembelian untuk menunjukkan **Belum ada rank**.
- [ ] Satu paket lama tanpa `packagePricingId`/`productCode`.
- [ ] Satu invoice menunggu pembayaran.
- [ ] Satu sesi terapi aktif dengan therapy plan dan BOM.
- [ ] Stok demo yang memiliki batch dan expiry.
- [ ] Satu stock request dan shipment partial.
- [ ] Satu purchase order dan supplier invoice.
- [ ] Beberapa event Zoho berstatus `PENDING`, `DRY_RUN`, atau exception dummy.

### Tepat sebelum presentasi

- [ ] Buka page sesuai urutan presentasi dalam tab terpisah.
- [ ] Tutup developer tools dan file konfigurasi yang memuat secret.
- [ ] Aktifkan masking data atau gunakan akun dummy.
- [ ] Pastikan tidak ada toast error dari API.
- [ ] Pastikan queue/worker Zoho tidak berjalan dalam mode `LIVE`.

---

## 9. Risiko dan Tindak Lanjut

| Prioritas | Risiko/tindak lanjut | Pemilik yang disarankan |
|---|---|---|
| Tinggi | Jalankan seluruh migration pada restore production di staging dan rekonsiliasi jumlah/nominal | IT/DBA |
| Tinggi | Full regression dan smoke test image Docker final belum dicatat sebagai satu run pada laporan ini | QA/IT |
| Tinggi | Mode Zoho harus tetap `OFF` sampai credentials, scope, mapping, reconciliation, approval, dan canary selesai | IT + Finance + Logistik |
| Tinggi | Verifikasi seluruh transaksi historis package/payment/session menggunakan sampel production yang disamarkan | QA + Operasional |
| Sedang | Dokumen `PANDUAN_SINGKAT_FLOW_ZOHO_BOOKS.md` masih memiliki bagian “Belum ada” yang tidak lagi sesuai dengan implementasi terbaru | IT/Documentation |
| Sedang | Tetapkan definisi bisnis apakah Rank menggunakan diskon efektif bundle atau diskon input jika keduanya berbeda; kode saat ini mengambil nilai terbesar | Product Owner + IT |
| Sedang | Buat monitoring untuk dead-letter Zoho, mismatch reconciliation, payment posting, negative stock, dan failed session completion | DevOps |
| Sedang | Tentukan scope rilis nyata untuk Inventori Tim; page saat ini hanya Coming Soon/panduan | Product Owner |
| Rendah | Rapikan penamaan commit agar changelog bulan berikutnya lebih mudah diaudit | Engineering |

---

## 10. Kronologi Perubahan Juli 2026

| Tanggal | Commit | Ringkasan perubahan |
|---|---:|---|
| 2 Juli | 3 | Stabilisasi E2E fase 7–8, 13–14, dan 16 |
| 3 Juli | 4 | Perbaikan batch E2E, laporan staff, dan flow branch |
| 5 Juli | 1 | Penyempurnaan branch code |
| 6 Juli | 5 | Dokumentasi, penomoran sesi per cabang, dan kelanjutan sequence |
| 7 Juli | 2 | Edit sesi terapi dan perbaikan parsing angka therapy plan |
| 8 Juli | 4 | Logistics/homecare bag, import, dan edit therapy plan |
| 9 Juli | 6 | Edit/delete therapy plan dengan guard penggunaan |
| 10 Juli | 10 | Kinerja staff, aksesibilitas/UI, booster, NB/HHO, serta edit/delete data sesi |
| 11 Juli | 1 | Lanjutan perbaikan edit sesi terapi |
| 13 Juli | 13 | Import member historis, validasi, skipped export, dan edit sesi global |
| 14 Juli | 13 | Admin Manager, filter member, dashboard, request stock, import, dan branch scope |
| 15 Juli | 9 | Pencarian member, tim/tugas, rekap requester, dan nomor member |
| 16 Juli | 2 | Minimum therapy plan |
| 17 Juli | 2 | Navigasi artikel dan dokumentasi BPM |
| 20 Juli | 2 | Dokumentasi dan perbaikan pergantian cabang Admin Manager |
| 21 Juli | 18 | Permission granular, accounting, payment, inventory master/ledger, stock request, transfer, shipment, purchasing, dan AP |
| 22 Juli | 17 | Goods receipt, deferred revenue, treatment BOM, atomic completion, approval, reporting, reconciliation, dan release gate |
| 23 Juli | 10 | UAT, seeding, UI theme, role template, master inventory, type-check, dan finance flow |
| 24 Juli | 6 | Accounting correction, nominal/source reference, opening stock, dan FIFO traceability |
| 25 Juli | 1 | Hardening inventory, request barang, dan transfer flow |
| 27 Juli | 4 | Hardening Finance dan Opening Balance |
| 28 Juli | 9 | Connection serta fondasi sinkronisasi Finance/Logistik ke Zoho |
| 29 Juli | 11 | Deployment/permission stok, material default, payment completion, Finance sprint, Zoho controls, dan versioning flow historis |
| 30 Juli | 4 | Atomic session flow version, UI role/member/session, build OOM, legacy package edit, dan Rank Member |

---

## 11. Page Baru yang Ditambahkan Bulan Ini

### Admin dan kontrol

- `/admin/integrations/zoho`
- `/admin/member-import`
- `/admin/permissions`
- `/approvals`

### Finance

- `/accounting`
- `/cash-bank`
- `/opening-balances`
- `/expenses`
- `/purchasing`
- `/revenue-recognition`
- `/finance-reports`

### Inventory dan Logistik

- `/inventory/dashboard`
- `/inventory/master-data`
- `/inventory/ledger`
- `/inventory/controls`
- `/inventory/stock-opnames`
- `/inventory/stock-reservations`
- `/inventory/goods-receipts`
- `/inventory/treatment-boms`
- `/inventory/shipment-report`
- `/inventory/homecare-bags`
- `/inventory/team`

---

## 12. Referensi Teknis

- [Flow penggunaan aplikasi](./FLOW_PENGGUNAAN_APLIKASI.md)
- [Panduan Finance dan flow](./PANDUAN_FITUR_FINANCE_DAN_FLOW.md)
- [Panduan singkat Zoho Books](./PANDUAN_SINGKAT_FLOW_ZOHO_BOOKS.md)
- [Panduan sinkronisasi data existing Zoho](./PANDUAN_SINKRONISASI_DATA_EXISTING_ZOHO_BOOKS.md)
- [Blueprint integrasi Zoho](./BLUEPRINT_INTEGRASI_ZOHO_FINANCE.md)
- [Runbook Zoho Go-live](./updatelogisticnFinnance/RUNBOOK_SPRINT14_ZOHO_GO_LIVE.md)
- [Checklist E2E Finance, Logistik, dan Zoho](./updatelogisticnFinnance/TEST_CHECKLIST_END_TO_END_FINANCE_LOGISTIK_ZOHO.md)

Source penting:

- `apps/api/src/modules/members/services/member-rank.ts`
- `apps/api/src/modules/packages/services/package-edit.service.ts`
- `apps/api/src/modules/sessions/services/session-completion.service.ts`
- `apps/api/src/modules/inventory/`
- `apps/api/src/modules/accounting/`
- `apps/api/src/modules/zoho/`
- `apps/web/src/app/(staff)/members/`
- `apps/web/src/app/(staff)/sessions/`
- `apps/web/src/app/(staff)/inventory/`
- `apps/web/src/app/(staff)/admin/integrations/zoho/`

---

## 13. Kesimpulan

Juli 2026 merupakan periode ekspansi besar sekaligus hardening. Alur inti
member → paket → pembayaran → sesi terapi tetap dipertahankan, sementara
inventory, finance, dan Zoho ditambahkan dengan guard agar kegagalan sistem
eksternal tidak menghentikan pelayanan klinik.

Untuk presentasi, fokuskan narasi pada tiga hal:

1. UI per peran menjadi lebih mudah digunakan.
2. Data lama dan transaksi inti tetap aman serta dapat berjalan.
3. Finance/Logistik dan Zoho memiliki audit, approval, reconciliation, dan
   rollout bertahap.

Status akhir month-to-date: perubahan utama sudah tersedia di source code dan
type-check lulus. Production release tetap harus mengikuti backup, staging
migration rehearsal, full regression, smoke test Docker, serta cutover Zoho
secara bertahap.
