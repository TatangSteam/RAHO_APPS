# UAT Regresi Finance, Logistik, dan Sesi Terapi

Status: regresi lengkap setelah UAT per role  
Sumber akun: `apps/api/prisma/seeds/users.seed.ts` dan `members-multibranch.seed.ts`  
Pembaruan: 24 Agustus 2026

Mulai dari [Pusat Dokumen UAT](./README.md). Untuk skenario harian yang lebih
ringkas gunakan [UAT Finance](./UAT_FINANCE.md) dan
[UAT Admin Manager](./UAT_ADMIN_MANAGER.md).

## 1. Batas keamanan

- Jalankan hanya pada database development, staging, atau database UAT.
- Jangan menjalankan complete/testing seed pada production.
- Ambil backup sebelum UAT jika lingkungan berisi data yang masih diperlukan.
- Gunakan nomor dokumen, catatan, dan bukti dengan awalan `UAT-` agar mudah ditelusuri.
- Jangan menghapus journal atau ledger melalui database.
- Koreksi transaksi yang sudah diposting melalui reject, refund, cancellation, reversal, adjustment, atau opname.
- Password di bawah adalah password seed dan wajib diganti jika akun dipakai di luar lingkungan test.

## 2. Menyiapkan data UAT

Jalankan migration dan testing seed pada database test yang benar:

```powershell
npm.cmd run db:generate --prefix apps/api
npm.cmd run db:migrate:prod --prefix apps/api
npm.cmd run db:seed:testing --prefix apps/api
```

Sebelum menjalankan seed, periksa bahwa `DATABASE_URL` benar-benar menunjuk ke database UAT, bukan production.

## 3. Credential dari seed

| Pengguna | Email | Password | Scope/kegunaan |
|---|---|---|---|
| Super Admin | `superadmin@raho.id` | `SuP3r4Dm1n` | Setup, pemeriksaan lintas cabang, dan audit |
| Admin Manager 1 | `manager1@raho.id` | `Manager@123` | Jakarta dan Bandung; checker/approver |
| Admin Manager 2 | `manager2@raho.id` | `Manager@123` | Surabaya dan Jakarta; checker/approver |
| Finance & Logistik | `finance@raho.id` | `Finance@123` | Template `FINANCE_LOGISTICS_CONTROLLER_DEFAULT`; semua cabang seed |
| Admin Layanan Jakarta | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | Membuat dan mengelola sesi Jakarta |
| Admin Cabang Jakarta | `admincabang.pst@raho.id` | `AdminCabang@123` | Operasional cabang Jakarta |
| Dokter Jakarta | `dokter@raho.id` | `Dokter@123` | Diagnosis dan evaluasi dokter |
| Dokter tambahan | `dokter2@raho.id` | `Dokter@123` | Uji assignment dokter tambahan |
| Nakes Jakarta | `nakes@raho.id` | `Nakes@123` | Vital, infus, dan material sesi |
| Member Jakarta | `budi.pst@example.com` | `member123` | Portal member dan data paket seed |

Akun Bandung dan Surabaya juga tersedia dengan pola berikut:

- `adminlayanan.bdg@raho.id` / `AdminLayanan@123`
- `adminlayanan.sby@raho.id` / `AdminLayanan@123`
- `dokter3@raho.id` / `Dokter@123`
- `nakes2@raho.id` dan `nakes3@raho.id` / `Nakes@123`

Seed aktif sudah membuat `finance@raho.id` dengan template
`FINANCE_LOGISTICS_CONTROLLER_DEFAULT` dan role dasar kompatibilitas
`ADMIN_MANAGER`. Akun legacy `adminlogistik@raho.id` dinonaktifkan; seluruh
skenario Finance dan Logistik baru harus menggunakan akun Finance tersebut.

## 4. Format pencatatan hasil

Untuk setiap skenario, catat:

| ID | Tester | Waktu | Data/dokumen | Hasil | Bukti | Catatan |
|---|---|---|---|---|---|---|
| contoh | Nama tester | tanggal/jam | nomor transaksi | PASS/FAIL/BLOCKED | screenshot/link | penjelasan |

Skenario dinyatakan `PASS` hanya jika hasil layar, status dokumen, ledger, journal, saldo, dan audit trail semuanya sesuai.

## 5. UAT login dan permission

### UAT-AUTH-01 — Login seluruh role

1. Login menggunakan Finance & Logistik, Manager, Admin Layanan, Dokter, dan Nakes.
2. Pastikan nama dan role yang tampil sesuai.
3. Logout sebelum berpindah akun.

Hasil yang diharapkan:

- seluruh credential seed dapat login;
- menu mengikuti role;
- akun tidak melihat data cabang di luar scope;
- logout menghapus sesi login.

### UAT-AUTH-02 — Pembatasan Finance dan Logistik

1. Login sebagai Finance dan coba mengubah data klinis yang tidak diizinkan.
2. Coba menerima shipment tujuan; template Finance hanya boleh dispatch.
3. Akses URL secara langsung, bukan hanya melalui menu.

Hasil yang diharapkan: backend mengembalikan `403` untuk aksi tanpa permission; menyembunyikan menu saja tidak dianggap cukup.

## 6. UAT Finance

### UAT-FIN-01 — Invoice dan pembayaran terverifikasi

1. Login Finance dan pilih satu invoice seed yang belum lunas.
2. Catat outstanding awal.
3. Submit payment dengan referensi `UAT-FIN-01`.
4. Verifikasi payment sesuai flow.
5. Buka kas/bank, journal, invoice, dan audit trail.

Hasil yang diharapkan:

- payment berstatus `VERIFIED`;
- outstanding invoice berkurang tepat satu kali;
- cash/bank bertambah sesuai nominal;
- journal seimbang antara debit dan kredit;
- source ID mengarah ke payment yang sama;
- refresh atau submit ulang tidak membuat posting ganda.

### UAT-FIN-02 — Payment ditolak

1. Submit payment lain dengan catatan `UAT-FIN-02-REJECT`.
2. Reject menggunakan akun checker yang diizinkan.

Hasil yang diharapkan: status `REJECTED`, outstanding tidak berubah, serta tidak terbentuk cash transaction atau journal.

### UAT-FIN-03 — Refund

1. Pilih payment UAT yang sudah verified.
2. Jalankan refund dengan alasan yang jelas.
3. Periksa invoice, kas/bank, journal, dan audit.

Hasil yang diharapkan: refund hanya sekali, saldo dan outstanding direversal sesuai nominal, journal seimbang, dan histori payment lama tidak dihapus.

### UAT-FIN-04 — Expense maker-checker

1. Finance membuat expense `UAT-FIN-04`, melampirkan evidence, lalu submit.
2. Pastikan pembuat tidak dapat menyetujui transaksinya sendiri jika maker-checker aktif.
3. Manager menyetujui expense.
4. Finance membayar expense dari akun kas/bank test.

Hasil yang diharapkan: status bergerak berurutan sampai `PAID`, evidence dapat dibuka oleh role berizin, kas berkurang, dan journal expense seimbang.

### UAT-FIN-05 — Periode tertutup

1. Gunakan periode UAT yang aman untuk ditutup.
2. Tutup periode dengan akun berizin.
3. Coba posting journal atau payment bertanggal pada periode tersebut.

Hasil yang diharapkan: posting ditolak tanpa membentuk journal parsial. Buka kembali hanya melalui flow resmi bila memang diizinkan.

### UAT-FIN-06 — Purchase-to-pay dan AP

1. Buat Purchase Request bertanda `UAT-FIN-06`.
2. Approve dengan akun checker.
3. Buat Purchase Order.
4. Lanjutkan Goods Receipt melalui skenario Logistik.
5. Finance posting supplier invoice berdasarkan PO dan receipt.
6. Bayar sebagian, lalu lunasi.

Hasil yang diharapkan: three-way match sesuai, AP bergerak `POSTED -> PARTIALLY_PAID -> PAID`, cash/bank dan journal sesuai, dan retry tidak menggandakan pembayaran.

### UAT-FIN-07 — Laporan Finance

1. Buka Trial Balance, General Ledger, Profit & Loss, AP, deferred revenue, dan revenue recognition.
2. Cari seluruh transaksi `UAT-FIN-*`.

Hasil yang diharapkan: total debit sama dengan kredit, transaksi dapat ditelusuri ke dokumen sumber, serta laporan sesuai dengan ledger.

## 7. UAT Logistik

### UAT-LOG-01 — Master dan konversi UOM

1. Login Finance & Logistik menggunakan `finance@raho.id`.
2. Buat produk test `UAT-SKU-01` dengan base unit dan usage unit.
3. Tambahkan konversi dan jalankan preview.

Hasil yang diharapkan: SKU unik, hasil konversi benar, dan perubahan memiliki audit trail.

### UAT-LOG-02 — Request, approval, dan reservation

1. Buat request stok Jakarta bertanda `UAT-LOG-02`.
2. Catat available stock sumber.
3. Manager approve sebagian dari quantity request.
4. Bentuk atau approve reservation.

Hasil yang diharapkan: quantity approval tidak melebihi request, available stock memperhitungkan reservation, tetapi nilai inventory belum berpindah.

### UAT-LOG-03 — Shipment dan penerimaan parsial

1. Buat shipment dari reservation `UAT-LOG-02`.
2. Dispatch satu kali dan coba ulangi aksi yang sama.
3. Terima sebagian di tujuan, lalu selesaikan sisanya.

Hasil yang diharapkan:

- stok sumber berkurang sekali;
- inventory in-transit terbentuk;
- retry dispatch tidak membuat posting kedua;
- receipt parsial hanya menambah quantity aktual;
- setelah selesai, nilai in-transit berpindah ke inventory tujuan.

### UAT-LOG-04 — Discrepancy

1. Pada shipment test, terima quantity lebih kecil dan pilih alasan shortage/damage.
2. Selesaikan discrepancy melalui flow resmi.

Hasil yang diharapkan: selisih tidak hilang, status menunjukkan issue, dan adjustment/reversal memiliki referensi serta audit.

### UAT-LOG-05 — Goods Receipt dan FIFO

1. Terima PO `UAT-FIN-06` dalam dua batch dengan unit cost berbeda.
2. Isi UOM, batch, expiry, condition, lokasi, dan actual quantity.
3. Periksa balance, mutation, FIFO layer, dan source link.

Hasil yang diharapkan: stok dan valuation bertambah sesuai receipt aktual; barang damaged/expired tidak langsung dianggap available.

### UAT-LOG-06 — Adjustment dan opname

1. Buat adjustment, submit, dan approve dengan checker berbeda.
2. Buat stock opname, ambil snapshot, isi physical quantity berbeda, submit, approve, dan post.

Hasil yang diharapkan: variance diposting satu kali, mutation dan journal terbentuk sesuai policy, scope opname terkunci selama penghitungan, serta pembuat tidak menjadi checker.

### UAT-LOG-07 — Tim dan tas homecare

1. Buat tim dengan Admin Layanan tetapi tanpa Nakes, lalu simpan.
2. Buat tim dengan Nakes tetapi tanpa Admin Layanan, lalu simpan.
3. Lengkapi minimal satu Nakes dan satu Admin Layanan.
4. Buat tas, request isi, approve, shipment, dan receive.

Hasil yang diharapkan: dua percobaan tidak lengkap ditolak; tim lengkap dapat dibuat dan seluruh pergerakan isi tas masuk ledger.

## 8. UAT end-to-end sesi terapi

### UAT-SES-01 — Sesi paket Basic dan Booster

1. Catat saldo voucher Basic, Booster, dan stok material member test.
2. Admin Layanan membuat sesi dengan Basic dan Booster.
3. Dokter mengisi diagnosis/evaluasi; Nakes mengisi vital, infusion, dan material aktual.
4. Selesaikan sesi satu kali, lalu coba ulangi completion.
5. Finance memeriksa deferred revenue, recognition, HPP, gross profit, dan journal.
6. Logistik memeriksa mutation, FIFO allocation, dan stok akhir.

Hasil yang diharapkan: voucher berkurang sesuai penggunaan, stok berkurang sekali, revenue/HPP/journal terbentuk sekali, dan completion kedua menjadi idempotent.

### UAT-SES-02 — Sesi tanpa paket

1. Buat sesi dengan pilihan tanpa paket dan tanpa Booster.
2. Isi seluruh material dan selesaikan sesi.

Hasil yang diharapkan: voucher Basic/Booster tidak berkurang, stok material tetap berkurang, HPP terbentuk, dan tidak ada revenue paket atau pelepasan deferred revenue.

### UAT-SES-03 — Diagnosis menyusul

1. Pilih member tanpa diagnosis.
2. Pastikan pembuatan sesi ditolak jika `Diagnosis menyusul` belum dicentang.
3. Centang pilihan tersebut dan assign dokter utama serta dokter tambahan.
4. Login sebagai kedua dokter dan periksa notification.
5. Salah satu dokter melengkapi diagnosis.

Hasil yang diharapkan: sesi dapat dibuat hanya setelah pilihan eksplisit; dokter menerima reminder bertaut ke sesi; setelah diagnosis terisi, flag tertunda selesai dan reminder ditandai selesai/dibaca.

### UAT-SES-04 — Hapus sesi belum selesai

1. Buat sesi UAT dan catat voucher/stok sebelum sesi.
2. Catat material, tetapi jangan selesaikan sesi.
3. Hapus sesi melalui UI.

Hasil yang diharapkan: voucher Basic/Booster dan net stock dikembalikan tepat satu kali, file terkait dibersihkan sesuai policy, reminder diagnosis dihapus, dan audit penghapusan tersedia.

### UAT-SES-05 — Perlindungan sesi selesai

1. Pilih sesi UAT yang sudah completed.
2. Coba menghapus atau mengubah komponen finansial/material yang immutable.

Hasil yang diharapkan: operasi ditolak; gunakan cancellation/reversal completion untuk koreksi dan histori lama tetap tersedia.

### UAT-SES-06 — Regresi sesi lama

1. Pilih minimal tiga sesi yang dibuat sebelum migration `diagnosisDeferred`.
2. Catat status, voucher, stok, revenue, HPP, dan journal.
3. Buka detail, pindah section, refresh, dan jalankan laporan tanpa melakukan edit.
4. Bandingkan angka sebelum dan sesudah.

Hasil yang diharapkan:

- sesi lama terbaca normal dengan `diagnosisDeferred = false`;
- berpindah section tidak menciptakan request mutation atau posting baru;
- voucher, stok, revenue, HPP, dan journal tidak berubah;
- tidak muncul reminder diagnosis baru untuk sesi lama;
- tidak ada event atau journal duplikat.

## 9. Rekonsiliasi akhir UAT

Finance & Logistik dan Manager bersama-sama memastikan:

- Trial Balance seimbang;
- saldo inventory sama dengan ledger quantity;
- inventory valuation sama dengan akun persediaan;
- inventory in-transit hanya berisi shipment yang memang belum selesai;
- kas/bank sama dengan transaksi verified/paid/refunded;
- AP sama dengan supplier invoice dikurangi payment;
- deferred revenue dan recognition sesuai sesi selesai;
- tidak ada stok negatif tanpa exception yang disetujui;
- tidak ada journal, posting inventory, payment, atau completion ganda;
- seluruh transaksi `UAT-` mempunyai source reference dan audit trail.

## 10. Kriteria keputusan

- `PASS`: semua hasil sesuai dan bukti lengkap.
- `FAIL`: angka/status/permission salah, terjadi duplikasi, atau ledger tidak seimbang.
- `BLOCKED`: data master, permission, atau lingkungan UAT belum tersedia.

Go-live hanya boleh disetujui jika seluruh skenario kritis `UAT-AUTH`, `UAT-FIN-01`, `UAT-FIN-06`, `UAT-LOG-02` sampai `UAT-LOG-06`, dan `UAT-SES-01` sampai `UAT-SES-06` berstatus `PASS` tanpa defect kritis/tinggi.
