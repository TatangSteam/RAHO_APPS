# Register Fitur ERP RAHO Lengkap dan Timeline Implementasi

Status dokumen: master feature register untuk dokumentasi dan laporan  
Snapshot source: 24 Agustus 2026  
Project: RAHO ERP / Clinic Management System  
Rentang implementasi yang tercatat: 22 April–21 Agustus 2026

## 1. Ringkasan eksekutif

RAHO bermula sebagai sistem operasional klinik untuk cabang, member, paket,
pembayaran, sesi terapi, inventori dasar, notifikasi, chat, dan audit. Sejak
Juli 2026, sistem berkembang menjadi ERP yang juga mencakup Finance,
Accounting, Purchasing/AP, inventory ledger FIFO, approval, reconciliation,
serta integrasi asynchronous ke Zoho Books.

Angka snapshot repository:

| Metrik | Jumlah | Catatan |
|---|---:|---|
| Entri fitur terdokumentasi | 175 | ID unik dalam tujuh domain register |
| Entri berlabel fitur baru | 22 | Implementasi/perluasan 18–21 Agustus 2026 |
| Halaman aplikasi | 77 | Staff, member portal, login, dan halaman administrasi |
| Modul API | 30 | Modul pada `apps/api/src/modules` |
| Model database | 147 | Model aktif pada Prisma schema |
| Enum database | 96 | Status dan tipe transaksi |
| Migration database | 123 | Sampai fitur 21 Agustus 2026 |
| Permission granular | 105 | Permission pada katalog IAM |
| Test case UAT per role | 316 | MSO, Nakes, Dokter, Admin Manager, dan Finance |

Tonggak utama:

```text
22 Apr 2026  Aplikasi RAHO pertama tercatat di repository
27 Apr 2026  Schema inti klinik, member, inventory, komunikasi, dan audit
21–29 Jul   Fondasi ERP Finance, Logistik, Approval, dan Zoho Books
18–21 Agu   Reminder sesi, Inventori Tim, pinjaman tim, Finance–Logistik,
            pilihan sumber stok, dan reimburse
24 Agu 2026 Dokumentasi UAT per role dan register fitur diperbarui
```

## 2. Cara membaca tanggal dan status

Kolom **Dibuat** adalah tanggal bukti implementasi paling awal yang dapat
ditelusuri pada repository, bukan tanggal deploy production.

- `≤ 22 Apr 2026`: fitur sudah ada ketika initial commit dibuat; tanggal
  historis sebelum itu tidak tersedia di Git.
- Tanggal lain berasal dari migration bernama tanggal atau commit implementasi.
- Jika migration dan commit berbeda, tanggal implementasi paling awal yang
  dapat dibuktikan dipakai dan catatan penguatan ditulis terpisah.

Status:

| Status | Arti |
|---|---|
| **Tersedia** | Halaman/API/schema atau service sudah ditemukan pada source |
| **Baru** | Dibuat atau diperluas pada 18–21 Agustus 2026 |
| **Terkontrol** | Tersedia, tetapi aktivasi membutuhkan permission, mode, approval, atau konfigurasi |
| **Perlu UAT** | Source tersedia, tetapi belum boleh dianggap lulus produksi tanpa UAT/sign-off |
| **Legacy nonaktif** | Data/akun lama dipertahankan untuk audit tetapi tidak dipakai operasional baru |

> Semua fitur berstatus Tersedia tetap membutuhkan migration yang berhasil,
> seed/configuration yang benar, UAT, dan deployment untuk dapat digunakan di
> environment tertentu.

## 3. Fitur terbaru

Bagian ini dapat langsung disalin ke weekly/monthly report.

| Tanggal | Fitur baru | Ringkasan | Status |
|---|---|---|---|
| 18 Agu 2026 | Reminder diagnosis/evaluasi dokter tertunda | Dokter assigned baru diingatkan setelah prasyaratnya siap; MSO/Nakes tidak diingatkan ketika hanya evaluasi dokter yang tersisa | **Baru, perlu UAT** |
| 18 Agu 2026 | Akses sesi belum selesai | Admin Layanan, Admin Cabang, dan Nakes assigned dapat melihat pekerjaan sesi yang belum lengkap | **Baru, perlu UAT** |
| 18 Agu 2026 | Monitoring sesi belum lengkap | Kinerja Staff dan export mencatat sesi incomplete berdasarkan cabang dan assignment | **Baru, perlu UAT** |
| 18 Agu 2026 | Admin Manager edit sesi | Manager dapat melakukan koreksi terkontrol pada sesi sesuai branch scope | **Baru, perlu UAT** |
| 19 Agu 2026 | Inventori Tim | Tim layanan, anggota, stok/tas, usage history, dan filter akses tim tersedia | **Baru, perlu UAT** |
| 19 Agu 2026 | Edit aman sesi terposting | Koreksi sesi selesai memakai guard, audit, dan reversal yang sesuai | **Baru, perlu UAT** |
| 20 Agu 2026 | Finance & Logistik terpadu | `finance@raho.id` menjadi controller aktif semua cabang; akun Admin Logistik lama dinonaktifkan | **Baru, perlu UAT** |
| 20 Agu 2026 | Shipment dispatch-only Finance | Finance & Logistik dapat dispatch; receipt tetap dilakukan petugas cabang tujuan | **Baru, perlu UAT** |
| 20 Agu 2026 | Manager completion reversal | Admin Manager dapat melakukan reversal penyelesaian sesi secara terkontrol | **Baru, perlu UAT** |
| 21 Agu 2026 | Pilihan sumber stok sesi | Saat finalisasi, petugas memilih Stok Cabang atau Stok Tim; hanya satu sumber dipotong | **Baru, perlu UAT** |
| 21 Agu 2026 | Pinjaman barang antartim | Request, review, pemindahan, outstanding, pengembalian, dan histori pinjaman tim | **Baru, perlu UAT** |
| 21 Agu 2026 | Reimburse berfoto | Draft, bukti JPG/PNG/WebP, submit, revisi, reject, approve, nominal besar, dan pembayaran | **Baru, perlu UAT** |
| 21 Agu 2026 | Reimburse ke Approval Inbox | Verifikasi Cabang → Persetujuan Finance → high approval untuk nominal ≥ Rp10 juta | **Baru, perlu UAT** |
| 21 Agu 2026 | Posting pembayaran reimburse | Pembayaran membentuk jurnal dan transaksi kas/bank secara idempotent | **Baru, perlu UAT** |
| 24 Agu 2026 | UAT lintas role | Dokumen MSO, Nakes, Dokter, Admin Manager, dan Finance dihubungkan melalui flow `TTR` dan `MFA` | **Dokumentasi baru** |

## 4. Register lengkap — platform, keamanan, dan akses

| ID | Fitur | Cakupan | Dibuat | Status |
|---|---|---|---|---|
| PLT-001 | Login dan autentikasi | Login, access/refresh token, logout, profil pengguna | ≤ 22 Apr 2026 | Tersedia |
| PLT-002 | Role dasar | Super Admin, Admin Manager, Admin Cabang, Admin Layanan, Dokter, Nakes, Member | 27 Apr 2026 | Tersedia |
| PLT-003 | Multi-branch staff | Satu staff dapat mempunyai cabang utama dan assignment tambahan | 27 Apr 2026 | Tersedia |
| PLT-004 | Branch scope Manager | Manager 1/2 mengakses cabang yang ditugaskan melalui `ManagerBranch` | 27 Apr 2026 | Tersedia |
| PLT-005 | Tipe cabang | Klinik/Homecare/Premier/Partnership dan pembatasan tipe yang valid | 27 Apr 2026; diperkuat 19 Jun | Tersedia |
| PLT-006 | Dashboard per role | Dashboard Super Admin, Manager, Admin Layanan, Dokter, dan Nakes | 4 Mei 2026 | Tersedia |
| PLT-007 | Sidebar berbasis role | Menu disaring menurut role dan fokus pekerjaan | 4 Mei 2026; diperluas Jul–Agu | Tersedia |
| PLT-008 | Audit login/logout | Login/logout dan actor tercatat pada Audit Log | 4 Mei 2026 | Tersedia |
| PLT-009 | Audit branch | Audit menyimpan konteks cabang | 4 Mei 2026 | Tersedia |
| PLT-010 | File access authorization | PSP, foto, lab, bukti pembayaran/reimburse tidak public langsung | 13 Mei 2026 | Tersedia |
| PLT-011 | Audit trail lengkap | Before/after, entity code, source, dan tindakan tambahan | 30 Jun 2026 | Tersedia |
| PLT-012 | Admin Manager access scope | Mode akses penuh atau `MEMBER_VIEW_ONLY` | 14 Jul 2026 | Tersedia |
| PLT-013 | Granular permission | Permission katalog, role template, dan user override | 21 Jul 2026 | Tersedia |
| PLT-014 | Branch permission guard | Middleware permission + validasi branch pada API | 21 Jul 2026 | Tersedia |
| PLT-015 | Maker-checker | Pembuat tidak boleh menyetujui dokumen sendiri | 22 Jul 2026 | Tersedia |
| PLT-016 | Approval engine generik | Rule nominal/kategori/cabang, multi-step, inbox, keputusan, audit | 22 Jul 2026 | Tersedia |
| PLT-017 | Audit akses ditolak | Percobaan akses tanpa izin dapat dicatat | 24 Jul 2026 | Tersedia |
| PLT-018 | Finance & Logistics Controller | Template gabungan Finance, Manager, dan Logistik | 28 Jul 2026; digabung 20 Agu | **Baru** |
| PLT-019 | Notifikasi | Inbox, unread/read, deep-link dokumen, reminder | 27 Apr 2026; diperluas 18–21 Agu | Tersedia |
| PLT-020 | Chat | Room dan pesan antar pengguna yang berizin | 27 Apr 2026 | Tersedia |
| PLT-021 | Import data | Dry-run dan execute import account/member dengan validasi | 13 Jul 2026 | Tersedia |
| PLT-022 | Export data | Member, sesi, kinerja, referral, inventory, dan laporan | 20–22 Mei 2026; diperluas 18 Agu | Tersedia |
| PLT-023 | Rate limit dan security header | API limiter, Helmet, payload limit, CORS, dan error sanitization | ≤ 1 Mei 2026 | Tersedia |

## 5. Register lengkap — cabang, staff, member, dan paket

| ID | Fitur | Cakupan | Dibuat | Status |
|---|---|---|---|---|
| CRM-001 | Master cabang | Buat, lihat, ubah, nonaktif/hapus terkontrol, branch code/type | ≤ 22 Apr 2026 | Tersedia |
| CRM-002 | Kelola staff | Buat staff, assign role/cabang, edit, deactivate, reset password | 4–19 Mei 2026 | Tersedia |
| CRM-003 | Admin Manager regional | Manager mengelola beberapa cabang dan Admin Cabang | 18 Mei 2026 | Tersedia |
| CRM-004 | Direktori staff klinis | Daftar Dokter/Nakes untuk assignment tanpa membuka data sensitif | 22 Jul 2026 | Tersedia |
| CRM-005 | Kinerja Staff | Jumlah sesi sebagai Dokter, Nakes, Admin, total, incomplete, detail | 22 Mei 2026; diperkuat 18 Agu | Tersedia |
| CRM-006 | Filter/export Kinerja Staff | Filter cabang/tanggal/staff dan export Excel | 7–10 Agu 2026 | Tersedia |
| CRM-007 | Registrasi member | Nomor member, identitas, kontak, alamat, referral, cabang | ≤ 22 Apr 2026 | Tersedia |
| CRM-008 | Pencarian/filter member | Nama, nomor, telepon, status, cabang, dan lookup cepat | 15 Jul 2026 | Tersedia |
| CRM-009 | Edit dan soft delete member | Koreksi profil dan proteksi relasi transaksi | 23 Jun 2026 | Tersedia |
| CRM-010 | Member multi-cabang | Cabang utama dan akses cabang tambahan | 27 Apr 2026 | Tersedia |
| CRM-011 | Data agama | Field agama pada profil member | 29 Mei 2026 | Tersedia |
| CRM-012 | Status member meninggal | Status deceased untuk perlindungan workflow | 18 Jun 2026 | Tersedia |
| CRM-013 | Dokumen PSP dan foto profil | Upload, preview, akses aman, dan penggantian dokumen | 9 Mei–13 Jun 2026 | Tersedia |
| CRM-014 | Hasil laboratorium | Upload, daftar, unduh aman, dan hapus sesuai izin | 12 Jun 2026 | Tersedia |
| CRM-015 | Referral code | Master kode, referrer, status aktif, dan penggunaan | 29 Apr 2026 | Tersedia |
| CRM-016 | Insentif referral | Record insentif per member/referrer dan export | 29 Apr 2026 | Tersedia |
| CRM-017 | Harga paket | Harga per layanan/paket/cabang, diskon, dan histori | ≤ 22 Apr 2026; diperluas 15–18 Mei | Tersedia |
| CRM-018 | Assign paket member | Basic, Booster, bundle, benefit, voucher, dan status paket | ≤ 22 Apr 2026 | Tersedia |
| CRM-019 | Paket cicilan | Payment plan, termin, outstanding, dan aktivasi sesuai pembayaran | 20 Jun 2026 | Tersedia |
| CRM-020 | Paket complimentary Rp0 | Paket gratis tanpa pembayaran semu atau bukti palsu | 31 Jul 2026 | Tersedia |
| CRM-021 | Rank Member | Rank berdasarkan diskon pembelian paket terakhir | 30 Jul 2026 | Tersedia |
| CRM-022 | Add-on member | Air Nano, Rokok Kenkou, dan add-on lain pada pembelian member | 27 Apr 2026; diperluas 5 Mei | Tersedia |
| CRM-023 | Produk non-terapi | Pembelian barang di luar sesi terapi | 27 Apr 2026 | Tersedia |
| CRM-024 | Portal Member | Dashboard, profil, invoice, sesi, dan voucher milik sendiri | ≤ 22 Apr 2026 | Tersedia |
| CRM-025 | Credential member | Lihat/reset credential secara terkontrol dan update email/username | ≤ 22 Apr 2026; diperluas Jun | Tersedia |

## 6. Register lengkap — klinis dan sesi terapi

| ID | Fitur | Cakupan | Dibuat | Status |
|---|---|---|---|---|
| CLN-001 | Encounter dan sesi terapi | On-site/Homecare, nomor sesi, status ongoing/closed | ≤ 22 Apr 2026 | Tersedia |
| CLN-002 | Multi Dokter/Nakes per sesi | Assignment lebih dari satu Dokter dan Nakes | 28 Apr 2026 | Tersedia |
| CLN-003 | Nomor sesi per cabang | Sequence sesi konsisten per cabang | 6 Jul 2026 | Tersedia |
| CLN-004 | Diagnosis | Kategori, catatan, multiple diagnosis, dan source link | ≤ 22 Apr 2026; diperluas 17–19 Jun | Tersedia |
| CLN-005 | Diagnosis kategori lengkap | Hipertensi, neurologi, diabetes, onkologi, dan kategori lain | 17 Jun 2026 | Tersedia |
| CLN-006 | Diagnosis menyusul | Sesi dapat dibuat dengan flag diagnosis tertunda dan reminder | 15 Agu 2026; dirilis 18 Agu | **Baru** |
| CLN-007 | Therapy Plan | Layanan, booster, dosis, rencana sesi, dan status | ≤ 22 Apr 2026 | Tersedia |
| CLN-008 | Therapy Plan versioning | Set/version, history, bulk create/edit, delete unused set | 13–18 Jun 2026 | Tersedia |
| CLN-009 | IFA dan HHO | Substance, nomor IFA, HHO konsentrat, dosis minimum | 17 Jun–16 Jul 2026 | Tersedia |
| CLN-010 | Vital sign | Sebelum/sesudah: sistol, diastol, HR, saturasi, PI | ≤ 22 Apr 2026 | Tersedia |
| CLN-011 | Pelaksanaan infus | Jenis botol, waktu, petugas, dan kit infus | ≤ 22 Apr 2026 | Tersedia |
| CLN-012 | Kit infus versioned/virtual | Komponen kit terversi dan kit virtual untuk kompatibilitas stok | 4–11 Agu 2026 | Tersedia |
| CLN-013 | Material usage | Bahan aktual, quantity, batch/cost, deviasi, dan actor | ≤ 22 Apr 2026; diperluas 8 Jun/22 Jul | Tersedia |
| CLN-014 | Foto sesi | Dokumentasi foto sesi dan supporting photos | ≤ 22 Apr 2026; diperluas 20 Jun | Tersedia |
| CLN-015 | Keluhan/rekomendasi | Catatan operasional setelah terapi | 19 Jun 2026 | Tersedia |
| CLN-016 | Evaluasi Dokter | SOAP/evaluasi, written-by, history, dan assignment guard | ≤ 22 Apr 2026 | Tersedia |
| CLN-017 | Reminder Evaluasi Dokter | Baru muncul setelah tahap pra-evaluasi lengkap dan hanya untuk Dokter assigned | 18 Agu 2026 | **Baru, perlu UAT** |
| CLN-018 | Reminder pekerjaan sesi | Pop-up sesi incomplete untuk MSO/Admin Cabang/Nakes assigned | 18 Agu 2026 | **Baru, perlu UAT** |
| CLN-019 | Suppression reminder | MSO/Nakes tidak diingatkan ketika hanya Evaluasi Dokter yang tersisa | 18 Agu 2026 | **Baru, perlu UAT** |
| CLN-020 | Penyelesaian sesi atomic | Completion, voucher, stok, HPP, revenue, audit dalam transaksi terkontrol | 22 Jul 2026 | Tersedia |
| CLN-021 | Anti-double completion | Posting key/guard mencegah completion dan konsumsi stok ganda | 22 Jul 2026 | Tersedia |
| CLN-022 | Sesi tanpa paket | Terapi tanpa member package tetap dapat mencatat inventory consumption | 13–14 Agu 2026 | Tersedia |
| CLN-023 | Edit sesi oleh Manager | Admin Manager dapat mengoreksi data sesi dalam scope | 18 Agu 2026 | **Baru, perlu UAT** |
| CLN-024 | Edit sesi terposting | Koreksi aman tanpa menghapus histori posting | 19 Agu 2026 | **Baru, perlu UAT** |
| CLN-025 | Reversal completion | Reversal terkontrol dengan source link dan audit | 22 Jul 2026; Manager 20 Agu | **Baru, perlu UAT** |
| CLN-026 | Pilihan sumber stok | Finalisasi memakai Stok Cabang atau Stok Tim | 21 Agu 2026 | **Baru, perlu UAT** |
| CLN-027 | Histori penggunaan material | Filter item, staff, sesi, cabang, tim, dan export | 8 Jun 2026; diperluas 19 Agu | Tersedia |
| CLN-028 | Laporan sesi incomplete | Rekap sesi belum lengkap pada Kinerja Staff/export | 18 Agu 2026 | **Baru, perlu UAT** |

## 7. Register lengkap — inventori dan logistik

| ID | Fitur | Cakupan | Dibuat | Status |
|---|---|---|---|---|
| INV-001 | Master produk | Produk, kategori, SKU, deskripsi, status, auto-use | 27 Apr 2026; SKU 20 Mei | Tersedia |
| INV-002 | UOM dan konversi | Satuan dasar, conversion factor, precision, canonical unit | 21 Jul 2026; diperkuat 20 Agu | Tersedia |
| INV-003 | Warehouse dan stock location | Gudang, lokasi, tipe lokasi, default storage per cabang | 21–23 Jul 2026 | Tersedia |
| INV-004 | Stok cabang | On-hand, reserved, available, dan nilai stok | 27 Apr 2026; ledger baru 21 Jul | Tersedia |
| INV-005 | Mutasi stok | Received, used, adjustment, transfer, source document | 27 Apr 2026 | Tersedia |
| INV-006 | Inventory ledger | Posting, balance, mutation, hash/reference, dan audit | 21 Jul 2026 | Tersedia |
| INV-007 | Batch dan expiry | Batch penerimaan, expiry, condition, dan traceability | 21 Jul 2026 | Tersedia |
| INV-008 | FIFO cost layer | Layer biaya, allocation, remaining quantity/value, pending valuation | 21 Jul 2026 | Tersedia |
| INV-009 | Inventory valuation | Quantity/value per item/location dan status valuasi | 21 Jul 2026; diperbaiki 21 Agu | Tersedia |
| INV-010 | Opening inventory | Opening quantity/rate per item/location dengan guard satu kali | 21 Jul 2026 | Terkontrol |
| INV-011 | Request stok | Draft/request, item, quantity, alasan, status, dan requester recap | 20 Mei 2026; diperluas 21 Jul | Tersedia |
| INV-012 | Partnership stock request | Flow permintaan khusus cabang Partnership | 20 Mei 2026 | Tersedia |
| INV-013 | Approval parsial/penuh | Review request, partial approve, reject, dan audit | 21 Jul 2026 | Tersedia |
| INV-014 | Reservasi stok | Reserve/release quantity terhadap request approved | 21 Jul 2026 | Tersedia |
| INV-015 | Shipment internal | Preparing, dispatch, in-transit, receive, complete | 27 Apr 2026; diperkuat 21 Jul | Tersedia |
| INV-016 | Partial receiving idempotent | Penerimaan parsial dan replay tanpa quantity ganda | 21 Jul 2026 | Tersedia |
| INV-017 | Shipment discrepancy | Shortage/damage/selisih, evidence, resolution, dan audit | 21–22 Jul 2026 | Tersedia |
| INV-018 | Shipment report | Filter, status, quantity, discrepancy, dan export | 22 Jul 2026 | Tersedia |
| INV-019 | Finance dispatch-only | Controller Finance mengirim; petugas tujuan menerima | 20 Agu 2026 | **Baru, perlu UAT** |
| INV-020 | Overstock | Deteksi, status, dan pemakaian stok berlebih | 21 Mei 2026 | Tersedia |
| INV-021 | Supplier | Master supplier, status, rekening/kontak, dan mapping | 21 Jul 2026 | Tersedia |
| INV-022 | Purchase Request | Maker-checker, approval, item, quantity, dan harga | 21 Jul 2026 | Tersedia |
| INV-023 | Purchase Order | PO dari PR approved dan supplier | 21 Jul 2026 | Tersedia |
| INV-024 | Goods Receipt | Partial receipt, batch, expiry, kondisi, FIFO layer | 21 Jul 2026 | Tersedia |
| INV-025 | Treatment BOM | BOM per treatment, item, quantity, UOM, dan version/status | 22 Jul 2026 | Tersedia |
| INV-026 | Konsumsi material FIFO | Sesi mengonsumsi stok dan nilai FIFO secara atomic | 22 Jul 2026 | Tersedia |
| INV-027 | Inventory adjustment | Increase/decrease, reason, evidence, approval, post/reversal | 22 Jul 2026 | Tersedia |
| INV-028 | Stock opname | Count, variance, approval, posting, dan resolution | 22 Jul 2026 | Tersedia |
| INV-029 | Dashboard Logistik | Ringkasan stok, request, shipment, valuation, dan warning | 22 Jul 2026 | Tersedia |
| INV-030 | Tas Homecare | Bag, stock, request, shipment, usage, return, opname | 8 Jul 2026; diperluas Jul | Tersedia |
| INV-031 | Multi-bag completion | Sesi Homecare dapat memakai lebih dari satu bag terkontrol | 22 Jul 2026 | Tersedia |
| INV-032 | Inventori Tim | Team, member, admin, stok/tas, scope, dan usage history | 19 Agu 2026 | **Baru, perlu UAT** |
| INV-033 | Pilihan Stok Cabang/Tim | Pengguna memilih satu sumber pada sesi; tidak double-post | 21 Agu 2026 | **Baru, perlu UAT** |
| INV-034 | Pinjaman antartim | PENDING → ACTIVE/REJECTED → RETURNED, item dan outstanding | 21 Agu 2026 | **Baru, perlu UAT** |
| INV-035 | Add-on inventory lifecycle | Reservasi, konsumsi, dan reversal stok untuk add-on | 3 Agu 2026 | Tersedia |
| INV-036 | Rekonsiliasi inventory | Perbandingan balance, ledger, cost layer, dan sumber transaksi | 21–22 Jul 2026 | Terkontrol |

## 8. Register lengkap — Finance, Accounting, dan approval

| ID | Fitur | Cakupan | Dibuat | Status |
|---|---|---|---|---|
| FIN-001 | Invoice member | Draft/finalize/cancel, line item, snapshot, source reference | 27 Apr 2026 | Tersedia |
| FIN-002 | Pembayaran invoice | Cash/transfer/debit/credit/QRIS, partial/full, evidence | 27 Apr 2026; diperluas 2 Jun | Tersedia |
| FIN-003 | Verifikasi pembayaran | Waiting verification, verify, reject, reason, actor | 2 Jun 2026 | Tersedia |
| FIN-004 | Refund pembayaran | Refund amount/reason/evidence dan histori | 13 Mei 2026 | Tersedia |
| FIN-005 | Chart of Accounts | Account code/type/normal balance, parent, posting flag | 21 Jul 2026 | Tersedia |
| FIN-006 | Accounting period | Open/close/lock dan validasi tanggal posting | 21 Jul 2026 | Tersedia |
| FIN-007 | Journal | Draft/posted/reversed, lines, debit-credit validation | 21 Jul 2026 | Tersedia |
| FIN-008 | General Ledger/source link | Journal dapat ditelusuri ke dokumen sumber | 21 Jul 2026 | Tersedia |
| FIN-009 | Kas & Bank | Akun kas/bank, receipt/payment/refund, saldo, reference | 21 Jul 2026 | Tersedia |
| FIN-010 | Opening Balance | Draft, line, review, post, opening stock, dan audit | 21 Jul 2026 | Terkontrol |
| FIN-011 | Expense | Evidence, draft, submit, approve/reject, pay, journal | 21 Jul 2026 | Tersedia |
| FIN-012 | Finance autonomous expense | Finance dapat auto-approve sesuai policy; audit tetap dibuat | 23 Jul 2026 | Terkontrol |
| FIN-013 | Accounts Payable | Supplier invoice/Bill, status, posting hutang, dan payment | 21 Jul 2026 | Tersedia |
| FIN-014 | Supplier invoice lines | Detail item/account/tax pada invoice supplier | 29 Jul 2026 | Tersedia |
| FIN-015 | Supplier payment refund | Refund pembayaran supplier dan reversal terkait | 29 Jul 2026 | Tersedia |
| FIN-016 | Stock request invoice | Tagihan request Partnership, debt status, partial payments | 22–23 Jun 2026 | Tersedia |
| FIN-017 | Deferred revenue | Contract, movement, remaining liability, policy | 22 Jul 2026 | Tersedia |
| FIN-018 | Revenue recognition | Pengakuan per sesi, idempotency, journal, dan audit | 22 Jul 2026 | Tersedia |
| FIN-019 | Treatment revenue source | Sumber revenue paket/sesi dan versioned flow | 28–29 Jul 2026 | Tersedia |
| FIN-020 | Basic + Booster revenue | Alokasi benefit/revenue paket gabungan | 5 Agu 2026 | Tersedia |
| FIN-021 | Legacy revenue preservation | Data lama tanpa reference baru tidak dihapus/dipaksa | 11–13 Agu 2026 | Tersedia |
| FIN-022 | Approval Inbox | Dokumen sesuai tahap aktif, scope, permission, dan nominal | 22 Jul 2026 | Tersedia |
| FIN-023 | Approval audit | Submit, step advance, approve, reject, return revision | 22 Jul 2026; diperluas 21 Agu | Tersedia |
| FIN-024 | Finance Reports | Profit & Loss, Trial Balance, General Ledger, cash/bank | 21–22 Jul 2026 | Tersedia |
| FIN-025 | Reimburse pribadi | Draft, category, amount, method, rekening, foto, cancel | 21 Agu 2026 | **Baru, perlu UAT** |
| FIN-026 | Validasi bukti reimburse | Maksimum file, tipe/ukuran, checksum, anti-reuse evidence | 21 Agu 2026 | **Baru, perlu UAT** |
| FIN-027 | Approval reimburse standar | Verifikasi Cabang → Persetujuan Finance | 21 Agu 2026 | **Baru, perlu UAT** |
| FIN-028 | Approval reimburse besar | Tambahan High Approval untuk nominal ≥ Rp10 juta | 21 Agu 2026 | **Baru, perlu UAT** |
| FIN-029 | Revisi/reject reimburse | Alasan wajib, notifikasi pengaju, histori approval tetap | 21 Agu 2026 | **Baru, perlu UAT** |
| FIN-030 | Pembayaran reimburse | Account beban + kas/bank, journal, cash transaction, idempotency | 21 Agu 2026 | **Baru, perlu UAT** |

## 9. Register lengkap — Zoho Books dan integrasi

| ID | Fitur | Cakupan | Dibuat | Status |
|---|---|---|---|---|
| ZHO-001 | OAuth Zoho Books | Connect, callback, refresh token terenkripsi, organization | 27 Jul 2026 | Terkontrol |
| ZHO-002 | Health/capability discovery | Deteksi organisasi, API domain, resource, edition/capability | 28 Jul 2026 | Terkontrol |
| ZHO-003 | Connection lifecycle | Connected/degraded/revoked, reconnect, suspend invalid connection | 27 Jul–4 Agu 2026 | Terkontrol |
| ZHO-004 | Entity mapping | Account, location, contact, item, document, source hash | 28 Jul 2026 | Terkontrol |
| ZHO-005 | Mapping review | Ambiguous/missing mapping, manual resolution, audit | 28 Jul 2026 | Terkontrol |
| ZHO-006 | Contact/customer/vendor sync | Mapping dan review customer/vendor | 28 Jul 2026 | Terkontrol |
| ZHO-007 | Item/location sync | Inventory item, UOM, account, location, opening capability | 28 Jul 2026 | Terkontrol |
| ZHO-008 | Sales invoice sync | Invoice member ke Zoho Books | 28 Jul 2026 | Terkontrol |
| ZHO-009 | Customer payment sync | Pembayaran member ke Customer Payment | 28 Jul 2026 | Terkontrol |
| ZHO-010 | Expense sync | Expense approved/paid ke Books sesuai mapping | 28–29 Jul 2026 | Terkontrol |
| ZHO-011 | Purchase Order/Bill sync | PO dan supplier invoice ke Zoho Books | 28–29 Jul 2026 | Terkontrol |
| ZHO-012 | Vendor payment/refund sync | Payment supplier dan refund dengan source reference | 29 Jul 2026 | Terkontrol |
| ZHO-013 | Inventory adjustment capability | Discovery dan jalur quantity/value adjustment Books | 29 Jul 2026 | Terkontrol, perlu contract test |
| ZHO-014 | Transactional outbox | Event lokal disimpan sebelum worker mengirim ke Zoho | 28 Jul 2026 | Tersedia |
| ZHO-015 | Retry/idempotency | Attempt, backoff, replay lookup, external reference | 28 Jul 2026 | Tersedia |
| ZHO-016 | Webhook inbox | Inbox, correlation, organization validation, replay guard | 28–29 Jul 2026 | Terkontrol |
| ZHO-017 | Reconciliation | Run/result, quantity/value/finance difference, resolution | 28–29 Jul 2026 | Terkontrol |
| ZHO-018 | Go-live control | `OFF`, `DRY_RUN`, `CANARY`, `LIVE`, readiness gate, rollback | 29 Jul 2026 | Terkontrol |
| ZHO-019 | Data origin | Penanda RAHO/Zoho/legacy dan aturan ownership | 5 Agu 2026 | Tersedia |
| ZHO-020 | Zoho Books only guard | Menolak penggunaan endpoint Zoho Inventory `/inventory/v1` | 5 Agu 2026 | Tersedia |
| ZHO-021 | Asynchronous resilience | Gangguan Zoho tidak memblok transaksi operasional RAHO | 28 Jul 2026 | Tersedia |

## 10. Register lengkap — laporan, monitoring, dan operasional

| ID | Fitur | Cakupan | Dibuat | Status |
|---|---|---|---|---|
| RPT-001 | Dashboard operasional | Member, sesi, pembayaran, cabang, dan tugas per role | 4 Mei 2026 | Tersedia |
| RPT-002 | Laporan member/sesi | Filter, ringkasan, detail, dan export | 20 Mei 2026 | Tersedia |
| RPT-003 | Kinerja Staff | Kontribusi Dokter/Nakes/Admin, incomplete, detail sesi | 22 Mei 2026; diperluas 18 Agu | Tersedia |
| RPT-004 | Laporan referral | Incentive per referral/member dan export Excel/PDF | 29 Apr 2026 | Tersedia |
| RPT-005 | Laporan inventory | Ledger, valuation, movement, usage, opname, adjustment | 21–22 Jul 2026 | Tersedia |
| RPT-006 | Laporan shipment | Pengiriman, receipt, discrepancy, status, dan export | 22 Jul 2026 | Tersedia |
| RPT-007 | Finance report | P&L, TB, GL, kas/bank, deferred revenue | 21–22 Jul 2026 | Tersedia |
| RPT-008 | Audit Log | Filter module/actor/cabang/action/entity dan export | 4 Mei 2026; diperluas 30 Jun | Tersedia |
| RPT-009 | Approval monitoring | Pending step, nominal, actor, keputusan, audit | 22 Jul 2026 | Tersedia |
| RPT-010 | Zoho monitoring | Connection, queue, attempts, mapping, reconciliation, go-live | 28–29 Jul 2026 | Terkontrol |
| RPT-011 | Reminder sesi incomplete | Pop-up dan daftar tugas staff assigned | 18 Agu 2026 | **Baru, perlu UAT** |
| RPT-012 | Reimburse monitoring | Status draft sampai paid, bukti, approval, payment reference | 21 Agu 2026 | **Baru, perlu UAT** |

## 11. Timeline kronologis untuk laporan

| Periode | Perubahan utama |
|---|---|
| 22–30 Apr 2026 | Initial application; schema cabang, user, member, paket, invoice/payment, sesi klinis, inventory dasar, notification/chat/audit; multi-branch; referral |
| 1–31 Mei 2026 | Deployment, dashboard Super Admin, kelola user/master product, package flow, refund, file security, staff/cabang, export, stock request, Kinerja Staff, overstock |
| 1–30 Jun 2026 | Payment verification, material history, PSP/foto, hasil lab, Therapy Plan versioning, diagnosis baru, supporting photos, cicilan, invoice request stok, shipment receipt, audit trail |
| 1–20 Jul 2026 | Nomor sesi cabang, Tas Homecare, import member, scope Manager, pencarian/filter, koreksi UOM dan Therapy Plan |
| 21–24 Jul 2026 | Permission granular, accounting, kas/bank, opening balance, expense, inventory FIFO, reservation, transfer, shipment, purchasing/AP, deferred revenue, BOM, atomic completion, approval, opname/adjustment, reporting |
| 27–31 Jul 2026 | Finance autonomous, koneksi dan fondasi Zoho Books, controller Finance–Logistik, mapping/sync/reconciliation/go-live, supplier refund, UI sesi mobile |
| 1–14 Agu 2026 | Add-on inventory lifecycle, hardening Zoho/data origin/Books-only, kit infus, revenue Basic+Booster, Kinerja Staff export, legacy revenue, sesi tanpa paket |
| 15–18 Agu 2026 | Diagnosis tertunda, reminder Dokter, akses sesi incomplete, koreksi Kinerja Staff, edit sesi oleh Manager |
| 19–21 Agu 2026 | Inventori Tim, usage history, edit aman sesi posted, Finance–Logistik terpadu, dispatch-only, pilihan sumber stok, pinjaman antartim, reimburse |
| 24 Agu 2026 | UAT per role disatukan dan master feature register diterbitkan |

## 12. Pemetaan role ke kelompok fitur

| Role | Kelompok utama |
|---|---|
| Super Admin | Semua konfigurasi sistem, user/role, master product, audit, integrasi |
| Admin Manager | Multi-cabang, member/staff/sesi, logistik, approval, Finance, laporan |
| Admin Cabang | Operasional cabang, staff/member, stok, verifikasi, monitoring |
| Admin Layanan / MSO | Member, paket/payment, sesi, Inventori Tim, reimburse, komunikasi |
| Finance & Logistik | Accounting, Finance, approval/payment, inventory/logistik, Zoho |
| Dokter | Member assigned, diagnosis/Therapy Plan, Evaluasi Dokter, reimburse |
| Nakes | Pelaksanaan sesi, vital/infus/material/foto, sumber stok, Inventori Tim, reimburse |
| Member | Profil, invoice, voucher, dan histori sesi milik sendiri |

Detail menu dan alur per role tersedia pada
[Daftar Fitur per Role dan Flow](./DAFTAR_FITUR_PER_ROLE_DAN_FLOW.md).

## 13. Status operasional dan batasan

Hal yang sudah ditemukan di source tetapi tetap harus dibuktikan:

- migration berhasil diterapkan tanpa status failed;
- akun seed/production memperoleh role template dan branch scope yang benar;
- seluruh skenario P0 pada UAT lulus;
- opening balance dan inventory baseline ditandatangani Finance;
- jalur Inventory Adjustment Zoho Books lulus contract test organisasi;
- mode Zoho tetap `OFF`/`DRY_RUN` sampai readiness gate dan approval selesai;
- tidak ada double-posting pada stock, journal, payment, atau retry;
- laporan dan audit sesuai data transaksi production.

Keterbatasan penting:

- RAHO menyimpan detail operasional batch, expiry, reservation, team inventory,
  dan FIFO; Zoho Books hanya menerima ringkasan sesuai capability organisasi.
- Akun `adminlogistik@raho.id` adalah legacy nonaktif sejak 20 Agustus 2026;
  operasional baru menggunakan `finance@raho.id`.
- Tanggal pada register ini adalah tanggal implementasi repository, bukan bukti
  tanggal go-live production.
- Label **Tersedia** tidak sama dengan **Lulus UAT**.

## 14. Evidence dan dokumen pendamping

Sumber audit tanggal dan keberadaan fitur:

- migration: `apps/api/prisma/migrations/`;
- schema: `apps/api/prisma/schema.prisma`;
- menu: `apps/web/src/components/layout/Sidebar.tsx`;
- halaman: `apps/web/src/app/`;
- modul API: `apps/api/src/modules/`;
- permission: `apps/api/src/modules/iam/permission-catalog.ts`;
- riwayat: `git log --date=short`.

Dokumen pendamping:

- [Pusat Dokumen UAT](./UAT/README.md)
- [Daftar Fitur per Role dan Flow](./DAFTAR_FITUR_PER_ROLE_DAN_FLOW.md)
- [Flow Penggunaan Aplikasi](./FLOW_PENGGUNAAN_APLIKASI.md)
- [Panduan Lengkap ERP RAHO](./PANDUAN_LENGKAP_ERP_RAHO_UNTUK_PENGGUNA_AWAM.md)
- [Guideline Finance dan Logistik](./GUIDELINE_ADMIN_FINANCE_DAN_LOGISTIK.md)
- [Implementation Plan Zoho Books Only](./IMPLEMENTATION_PLAN_ZOHO_BOOKS_ONLY.md)

## 15. Template pembaruan report berikutnya

Saat ada fitur baru, tambahkan minimal:

| Field | Isi wajib |
|---|---|
| ID fitur | Kode domain + nomor berurutan |
| Nama fitur | Nama yang dipahami pengguna |
| Tanggal dibuat | Tanggal migration/commit pertama |
| Tanggal diperbarui | Jika ada perubahan material |
| Role | Pengguna yang memakai/menyetujui |
| Dampak | Data, stok, uang, klinis, atau integrasi |
| Status | Tersedia/Baru/Terkontrol/Perlu UAT/Legacy |
| Evidence | Migration, endpoint, halaman, test, dan nomor UAT |

Jangan mengubah tanggal dibuat ketika fitur hanya diperbaiki. Tambahkan tanggal
penguatan pada kolom cakupan atau riwayat agar umur fitur tetap dapat diaudit.
