# Test Checklist End-to-End RAHO Finance, Logistik, dan Zoho

Dokumen ini adalah daftar pengujian wajib dari startup, login, pembelian paket,
pembayaran, sesi terapi, inventory, purchasing, sampai integrasi Zoho.

## 1. Aturan environment lokal

Port lokal tidak boleh diubah:

| Service | Port |
|---|---:|
| Web | `3000` |
| API | `4000` |
| PostgreSQL proyek | `5432` |
| PostgreSQL Windows lain | `5434` — bukan database proyek dan tidak boleh dipakai |

Konfigurasi aman saat menguji ERP tanpa sinkronisasi Zoho:

```env
PORT=4000
ZOHO_SYNC_WORKER_ENABLED=false
ZOHO_SYNC_DRY_RUN=true
ZOHO_RECONCILIATION_ENABLED=false
```

## 2. Arti status

| Status | Arti |
|---|---|
| ✅ PASS | Sudah dijalankan dan hasil aktual sesuai |
| ❌ FAIL | Sudah dijalankan dan aplikasi/test tidak sesuai |
| ⚠️ TEST USANG | Test tidak sesuai flow aplikasi terbaru dan harus diperbarui |
| ⏳ PENDING | Belum dijalankan atau belum memiliki fixture yang cukup |
| ➖ N/A | Tidak berlaku untuk skenario tersebut |

## 3. Evidence terakhir — 29 Juli 2026

| Evidence | Hasil |
|---|---|
| Prisma migration status | ✅ 97 migration, database up-to-date |
| API health `GET /health` | ✅ HTTP 200, status `ok` |
| Halaman `/login` | ✅ HTTP 200 |
| API test lengkap | ✅ 101 suite / 555 test lulus, 25 test skip |
| Web unit test | ✅ 18 suite / 119 test lulus |
| Login Chromium semua role | ✅ 15/15 lulus |
| Daftar sesi terapi | ✅ 1/1 smoke test lulus |
| Assignment/pembelian paket | ✅ 1/1 E2E lulus |
| Polling worker Zoho saat lokal | ✅ 0 query setelah worker dimatikan |
| Manual invoice E2E lama | ⚠️ Test usang: invoice sekarang dibuat otomatis dari transaksi sumber |
| Suite E2E gabungan | ⚠️ Dihentikan setelah timeout; wajib dijalankan per fitur |

## 4. Startup dan infrastruktur

| ID | Skenario | Langkah ringkas | Hasil yang diharapkan | Status |
|---|---|---|---|---|
| ENV-001 | PostgreSQL proyek hidup | Jalankan Compose lalu cek health container | `raho-postgres` healthy di `5432` | ✅ PASS |
| ENV-002 | Migration lengkap | Jalankan `prisma migrate status` | Tidak ada pending migration | ✅ PASS |
| ENV-003 | API start tanpa Zoho | Kosongkan konfigurasi Zoho opsional, worker off | API tetap start | ✅ PASS |
| ENV-004 | API health | Akses `/health` | HTTP 200 dan `status=ok` | ✅ PASS |
| ENV-005 | Web start | Akses `/login` | HTTP 200 dan form login muncul | ✅ PASS |
| ENV-006 | Tidak ada polling Zoho lokal | Worker off, observasi log minimal 20 detik | Tidak ada query claim event Zoho | ✅ PASS |
| ENV-007 | Port tetap | Cek web/API/database | Tetap `3000/4000/5432` | ✅ PASS |
| ENV-008 | Zoho config kosong | Isi variabel Zoho opsional dengan string kosong | Dianggap belum dikonfigurasi, bukan startup error | ✅ PASS |

## 5. Login, logout, session, dan authorization

| ID | Role/skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| AUTH-001 | SUPER_ADMIN login | Masuk ke dashboard Super Admin | ✅ PASS |
| AUTH-002 | ADMIN_MANAGER login | Masuk ke dashboard Admin Manager | ✅ PASS |
| AUTH-003 | ADMIN_CABANG login | Masuk ke dashboard cabang | ✅ PASS |
| AUTH-004 | ADMIN_LAYANAN login | Masuk ke dashboard layanan | ✅ PASS |
| AUTH-005 | DOCTOR login | Masuk ke dashboard dokter | ✅ PASS |
| AUTH-006 | NURSE login | Masuk ke dashboard perawat | ✅ PASS |
| AUTH-007 | MEMBER login | Masuk ke portal member | ✅ PASS |
| AUTH-008 | Form login invalid | Username/password terlalu pendek menampilkan validasi | ✅ PASS |
| AUTH-009 | Password salah | API mengembalikan error aman tanpa membocorkan user | ⏳ PENDING |
| AUTH-010 | Refresh token | Access token diperbarui tanpa login ulang | ⏳ PENDING |
| AUTH-011 | Logout | Token dibersihkan dan halaman protected tidak dapat dibuka | ⏳ PENDING |
| AUTH-012 | Branch isolation | User cabang A tidak dapat membaca/mengubah cabang B | ⏳ PENDING |
| AUTH-013 | SUPER_ADMIN tetap penuh | Seluruh menu dan perubahan tetap dapat diakses | ⏳ PENDING |

## 6. Member dan pembelian paket

| ID | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| MEM-001 | Buat member | Member baru tersimpan dan muncul di daftar | ✅ PASS melalui regression/API; E2E tersedia |
| MEM-002 | Login member baru | Member dapat login menggunakan username | ⏳ PENDING ulang terarah |
| MEM-003 | Edit member | Perubahan tersimpan dan audit tercatat | ⏳ PENDING |
| MEM-004 | Username duplikat | Ditolak dengan pesan yang jelas | ⏳ PENDING |
| PKG-001 | Assign paket Basic | Paket tersimpan pada member | ✅ PASS |
| PKG-002 | Assign beberapa paket | Paket tidak saling menimpa | ⏳ PENDING |
| PKG-003 | Invoice otomatis | Assignment paket menghasilkan invoice sesuai paket | ✅ Terlihat pada flow lokal; wajib assertion E2E khusus |
| PKG-004 | Nominal per paket | Basic hanya memakai harga Basic, Booster hanya Booster | ⏳ PENDING |
| PKG-005 | Uang muka paket | Pembayaran menjadi deferred revenue, belum langsung omzet terapi | ⏳ PENDING |
| PKG-006 | Tanpa Zoho | Assignment paket dan invoice tetap sukses saat worker off | ⏳ PENDING E2E khusus |
| PKG-007 | Idempotency | Klik ulang/request ulang tidak membuat paket/invoice ganda | ⏳ PENDING |

## 7. Invoice dan pembayaran

Flow terbaru: invoice dibuat otomatis dari pembelian paket, add-on, produk
non-terapi, atau dokumen sumber resmi. Test manual `Buat Invoice` lama tidak
boleh dijadikan bukti flow produksi.

| ID | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| PAY-001 | Invoice dari paket | Invoice memiliki member, paket, dan nominal yang benar | ⏳ PENDING assertion E2E |
| PAY-002 | Bayar cash penuh | Payment tersimpan dan saldo invoice berkurang | ⏳ PENDING |
| PAY-003 | Bayar transfer penuh | Bukti/referensi wajib dan payment tersimpan | ⏳ PENDING |
| PAY-004 | Bayar QRIS penuh | Bukti/referensi wajib dan payment tersimpan | ⏳ PENDING |
| PAY-005 | Pembayaran sebagian | Status menjadi partial/debt dan sisa benar | ⏳ PENDING |
| PAY-006 | Pembayaran beberapa kali | Total pembayaran tidak melebihi invoice | ⏳ PENDING |
| PAY-007 | Maker-checker | Pembuat pembayaran tidak menyetujui pembayarannya sendiri | ⏳ PENDING |
| PAY-008 | Verifikasi payment | Hanya role berizin yang dapat memverifikasi | ⏳ PENDING |
| PAY-009 | Refund penuh | Kas/bank, invoice, journal, dan audit tereversal | ⏳ PENDING |
| PAY-010 | Refund sebagian | Nilai refund tidak melebihi nilai yang dapat direfund | ⏳ PENDING |
| PAY-011 | Tanpa Zoho | Payment tetap sukses saat worker off/Zoho outage | ⏳ PENDING |
| PAY-012 | Zoho asynchronous | Setelah worker aktif, payment dikirim tanpa mengulang transaksi lokal | ⏳ PENDING |

## 8. Sesi terapi dan pengakuan omzet

| ID | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| SES-001 | Daftar sesi | Halaman dan data sesi dapat dibuka | ✅ PASS |
| SES-002 | Buat sesi | Sesi baru terkait member dan paket yang benar | ⏳ PENDING — test UI lama masih `fixme` |
| SES-003 | Pilih paket | Hanya paket eligible milik member yang dapat dipilih | ⏳ PENDING |
| SES-004 | Therapy plan | Item terapi tersimpan sesuai urutan dan jumlah sesi | ⏳ PENDING |
| SES-005 | Vital sebelum/sesudah | Completion ditolak jika data wajib belum lengkap | ⏳ PENDING |
| SES-006 | Infus aktual | Jenis infus aktual tersimpan | ⏳ PENDING |
| SES-007 | Material usage | Bahan dan kuantitas aktual tersimpan | ⏳ PENDING |
| SES-008 | Selesaikan sesi | Sesi completed, stok/FIFO dan journal lokal terposting atomik | ⏳ PENDING E2E; regression service lulus |
| SES-009 | Revenue per produk | Booster mengurangi saldo Booster; Basic hanya saldo Basic | ⏳ PENDING |
| SES-010 | Uang muka berkurang | Deferred revenue berkurang sesuai produk yang digunakan | ⏳ PENDING |
| SES-011 | Omzet bertambah | Recognized revenue bertambah hanya saat sesi selesai | ⏳ PENDING |
| SES-012 | Completion idempotent | Request ulang tidak menggandakan revenue, HPP, atau stok | ⏳ PENDING |
| SES-013 | Cancellation | Reversal lokal lengkap tanpa menghapus evidence | ⏳ PENDING |
| SES-014 | Tanpa Zoho | Completion sukses ketika Zoho tidak terhubung | ⏳ PENDING E2E khusus |
| SES-015 | Partnership | Completion infus Partnership tidak mengirim omzet/HPP per infus ke Zoho | ⏳ PENDING |

## 9. Inventory dan logistik

| ID | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| INV-001 | Stock request | Request tersimpan pada cabang yang benar | ⏳ PENDING |
| INV-002 | Approval request | Maker-checker dan branch scope berlaku | ⏳ PENDING |
| INV-003 | Reservasi stok | Stok tidak dapat direservasi melebihi available | ⏳ PENDING |
| INV-004 | Shipment | Shipment hanya dari request approved | ⏳ PENDING |
| INV-005 | Dispatch | Status dan ledger transit konsisten | ⏳ PENDING |
| INV-006 | Receive shipment | Stok tujuan bertambah dan transit berkurang | ⏳ PENDING |
| INV-007 | Partial receipt | Selisih dan sisa shipment tercatat | ⏳ PENDING |
| INV-008 | Goods receipt | Barang supplier masuk dengan batch/expiry yang benar | ⏳ PENDING |
| INV-009 | FIFO | Pemakaian terapi memilih batch FIFO/FEFO sesuai aturan | ⏳ PENDING |
| INV-010 | Stock opname | Selisih, approval, ledger, dan journal konsisten | ⏳ PENDING |
| INV-011 | Adjustment | Adjustment tidak membuat stok negatif ilegal | ⏳ PENDING |
| INV-012 | Tanpa Zoho | Seluruh transaksi inventory tetap sukses saat worker off | ⏳ PENDING |
| INV-013 | Partnership shipment | Pengiriman Partnership menjadi penjualan barang, bukan internal transfer | ⏳ PENDING |

## 10. Purchasing dan Accounts Payable

| ID | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| PUR-001 | Buat PO | PO tersimpan dengan supplier, item, dan cabang benar | ⏳ PENDING |
| PUR-002 | Issue PO | PO issued hanya sekali dan memiliki audit | ⏳ PENDING |
| PUR-003 | Goods receipt PO | Received quantity tidak melebihi PO | ⏳ PENDING |
| PUR-004 | Supplier invoice | Bill lokal tidak melebihi kuantitas diterima | ⏳ PENDING |
| PUR-005 | Supplier payment | Saldo AP, kas/bank, dan journal konsisten | ⏳ PENDING |
| PUR-006 | Refund supplier | Refund tidak melebihi pembayaran yang tersedia | ⏳ PENDING |
| PUR-007 | Tanpa Zoho | PO/Bill/payment supplier tetap sukses saat worker off | ⏳ PENDING |
| PUR-008 | Partnership order | Order cabang Partnership menghasilkan omzet saat barang dipesan/dikirim | ⏳ PENDING |

## 11. Zoho offline, dry-run, canary, dan live

| ID | Skenario | Hasil yang diharapkan | Status |
|---|---|---|---|
| ZOH-001 | Tidak ada connection | Runtime `OFF`, ERP lokal tetap berjalan | ✅ PASS contract |
| ZOH-002 | Worker disabled | Tidak ada polling claim event | ✅ PASS aktual |
| ZOH-003 | Kredensial tidak lengkap | CANARY/LIVE ditolak dan runtime fail-closed | ✅ PASS contract |
| ZOH-004 | Token expired | Event retry/failed tanpa rollback transaksi ERP | ⏳ PENDING sandbox |
| ZOH-005 | Rate-limit | Retry memakai backoff dan tidak membuat duplikat | ⏳ PENDING sandbox |
| ZOH-006 | DRY_RUN | Tidak ada write Zoho | ✅ PASS policy/worker test |
| ZOH-007 | Promosi setelah DRY_RUN | Event rehearsal kembali `PENDING` sebelum CANARY/LIVE | ✅ PASS contract |
| ZOH-008 | CANARY branch scope | Hanya cabang canary yang diproses | ✅ PASS contract |
| ZOH-009 | Reconciliation gate | Menggunakan organization/koneksi aktif | ✅ PASS contract |
| ZOH-010 | Lima hari kerja | Tidak bisa diklik dua kali sehari atau saat akhir pekan | ✅ PASS unit test |
| ZOH-011 | Rollback | Mode menjadi `OFF`, transaksi lokal tidak dibatalkan | ✅ PASS contract |
| ZOH-012 | Webhook duplicate | Payload/delivery sama hanya diproses sekali | ✅ PASS unit test |
| ZOH-013 | Webhook invalid | Secret/signature salah ditolak | ✅ PASS unit test |

## 12. Regression dan release gate

Sebelum merge/deploy:

```text
[ ] Prisma schema valid
[ ] Migration status up-to-date
[ ] API type-check lulus
[ ] Web type-check lulus
[ ] API build lulus
[ ] Web build lulus
[ ] Seluruh unit/contract test lulus
[ ] Seluruh database integration test lulus
[ ] Login E2E semua role lulus
[ ] Paket → invoice → payment E2E lulus
[ ] Sesi → stok → revenue E2E lulus
[ ] Purchasing → receipt → bill → payment E2E lulus
[ ] Zoho OFF tidak menghambat ERP
[ ] Zoho DRY_RUN tidak melakukan write
[ ] CANARY dan rollback diuji
[ ] Tidak ada secret dalam log, screenshot, atau artifact
```

## 13. Perintah pengujian

### Infrastruktur dan migration

```powershell
docker compose -f docker-compose.dev.yml up -d postgres
npm.cmd run db:migrate:prod --workspace apps/api
npm.cmd exec prisma migrate status --workspace apps/api
```

### API dan web

```powershell
npm.cmd run dev:api
npm.cmd run dev:web
```

### Unit, database, dan build

```powershell
npm.cmd test --workspace apps/api -- --runInBand
npm.cmd test --workspace apps/web -- --runInBand
npm.cmd run type-check --workspace apps/api
npm.cmd run type-check --workspace apps/web
npm.cmd run build --workspace apps/api
npm.cmd run build --workspace apps/web
```

### E2E terarah

```powershell
npm.cmd run e2e --workspace apps/web -- e2e/auth/login.smoke.spec.ts
npm.cmd run e2e --workspace apps/web -- e2e/critical/member-crud.spec.ts --project=chromium --no-deps
npm.cmd run e2e --workspace apps/web -- e2e/flows/session-therapy.spec.ts --project=chromium --no-deps
npm.cmd run e2e --workspace apps/web -- e2e/critical/inventory-flow.spec.ts --project=chromium --no-deps
npm.cmd run e2e --workspace apps/web -- e2e/critical/goods-receipt.spec.ts --project=chromium --no-deps
```

Jalankan E2E per file atau per `--grep`, bukan seluruh flow sekaligus, sampai
test lama yang masih `fixme` dan test manual invoice sudah diperbarui mengikuti
flow invoice otomatis.
## Regression compatibility: data terapi lama vs data baru

- [x] Paket yang sudah ada sebelum migration `20260729180000` memiliki `revenueFlowVersion = 1` (140 paket lokal terverifikasi).
- [x] Paket yang dibuat setelah migration otomatis memiliki `revenueFlowVersion = 2`.
- [x] Posting finance sesi dari paket legacy berbayar tanpa kontrak deferred revenue tetap berhasil.
- [x] Penyelesaian finance legacy tanpa kontrak tidak membuat omzet/deferred revenue fiktif; hanya HPP material yang diposting bila ada.
- [x] Paket legacy yang sudah memiliki kontrak tetap menjalankan revenue recognition normal.
- [x] Paket baru berbayar tanpa kontrak tetap ditolak dengan `TREATMENT_REVENUE_CONTRACT_MISSING`.
- [x] Paket baru gratis tidak diwajibkan mempunyai kontrak deferred revenue.
- [x] Edit/penggantian paket mempertahankan `revenueFlowVersion` paket sumber.
- [x] Import historis selalu ditandai sebagai flow legacy.
- [x] Pemanggilan ulang completion sesi legacy yang sudah selesai tidak gagal hanya karena event finance baru belum ada.

Evidence 29 Juli 2026:

- Prisma schema valid dan migration berhasil diterapkan.
- TypeScript API type-check lulus.
- Unit/regression API: 102 suite dan 558 test lulus; 26 test conditional ter-skip.
- Database integration completion: 2/2 lulus, termasuk perbandingan legacy vs current.
- API health setelah restart: HTTP 200 pada port 4000.
