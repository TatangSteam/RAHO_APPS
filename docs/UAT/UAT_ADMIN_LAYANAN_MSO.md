# UAT Admin Layanan / MSO

Status: siap dipakai untuk UAT, belum berarti seluruh skenario sudah lulus  
Role sistem: `ADMIN_LAYANAN`  
Nama bisnis: **Admin Layanan / MSO**  
Pembaruan: 24 Agustus 2026

Dokumen ini sengaja dibuat pendek per langkah. Jika tidak ingin membaca semua,
jalankan bagian **Cek Kilat 15 Menit** dan **UAT Terhubung Tim Terapi**
terlebih dahulu.

Dokumen terkait:

- [Pusat Dokumen UAT](./README.md)
- [UAT Super Admin](./UAT_SUPER_ADMIN.md)
- [UAT Nakes / Perawat](./UAT_NAKES.md)
- [UAT Dokter](./UAT_DOKTER.md)
- [UAT Admin Manager](./UAT_ADMIN_MANAGER.md)
- [UAT Finance](./UAT_FINANCE.md)

## 1. Ringkasan 30 detik

Admin Layanan / MSO harus bisa:

- mengelola member di cabangnya;
- mengelola pembayaran dan sesi terapi;
- menerima reminder sesi yang menjadi tugasnya;
- mengerjakan bagian operasional, tetapi **tidak mengisi Evaluasi Dokter**;
- memilih **Stok Cabang** atau **Stok Tim** saat menyelesaikan sesi;
- meminjam barang dari tim lain melalui Inventori Tim;
- mengajukan reimburse dengan bukti foto;
- menerima notifikasi dan menggunakan chat.

Admin Layanan / MSO tidak boleh:

- melihat data cabang lain;
- mengisi Evaluasi Dokter;
- membuka Approval Inbox atau menu Finance sensitif;
- menyetujui atau membayar reimburse sendiri;
- melihat atau mengubah pengajuan reimburse milik orang lain tanpa izin.

## 2. Credential login dari seeding

> **Hanya untuk local/test. Jangan gunakan credential ini di production.**

| Cabang | Email | Password | Staff code |
|---|---|---|---|
| RAHO Premier Jakarta (`PST`) | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | `AL-20260413-PST1` |
| RAHO Partnership Bandung (`BDG`) | `adminlayanan.bdg@raho.id` | `AdminLayanan@123` | `AL-20260413-BDG1` |
| RAHO Premier Surabaya (`SBY`) | `adminlayanan.sby@raho.id` | `AdminLayanan@123` | `AL-20260413-SBY1` |

Credential pendamping untuk menguji alur lintas role:

| Kebutuhan | Jakarta | Bandung | Surabaya | Password |
|---|---|---|---|---|
| Admin Cabang | `admincabang.pst@raho.id` | `admincabang.bdg@raho.id` | `admincabang.sby@raho.id` | `AdminCabang@123` |
| Dokter | `dokter@raho.id` | `dokter2@raho.id` | `dokter3@raho.id` | `Dokter@123` |
| Nakes | `nakes@raho.id` | `nakes2@raho.id` | `nakes3@raho.id` | `Nakes@123` |
| Finance | `finance@raho.id` | - | - | `Finance@123` |

Sumber credential aktif:

- `apps/api/prisma/seeds/users.seed.ts`
- `apps/api/prisma/seeds/branches.seed.ts`

Untuk membuat data dummy lengkap dari root project:

```powershell
npm.cmd run db:seed --prefix apps/api
```

Atau hanya data testing:

```powershell
npm.cmd run db:seed:testing --prefix apps/api
```

Jangan jalankan seed testing pada database production. Untuk production gunakan
seed essential sesuai prosedur deployment.

## 3. Cara mencatat hasil

Gunakan satu tanda pada setiap test case:

- `✅ PASS` — hasil sama dengan kolom **Harus Terjadi**.
- `❌ FAIL` — hasil berbeda atau ada celah akses.
- `⛔ BLOCKED` — data/prasyarat belum tersedia.
- `⬜ NOT TESTED` — belum dijalankan.

Jika gagal, simpan screenshot, waktu kejadian, akun, cabang, URL, dan pesan
error. Jangan hanya menulis “tidak bisa”.

## 4. Persiapan sekali saja

Sebelum UAT, pastikan:

- aplikasi web, API, PostgreSQL, dan object storage berjalan;
- migration berhasil dan seed testing sudah dijalankan;
- tersedia member dengan paket aktif dan sisa sesi;
- tersedia satu sesi `IN_PROGRESS` yang di-assign ke Admin Layanan, Dokter, dan
  Nakes cabang yang sama;
- tersedia dua tim aktif dalam cabang yang sama, masing-masing mempunyai tas;
- tim pemberi mempunyai stok yang cukup untuk dipinjam;
- Admin Layanan peminjam dan pemberi sudah menjadi anggota/admin timnya;
- tersedia foto bukti JPG/PNG/WebP berukuran kurang dari 5 MB;
- tersedia browser kedua atau mode incognito untuk akun Dokter, Admin Cabang,
  dan Finance.

## 4A. UAT Terhubung Tim Terapi

Gunakan **kode run yang sama** pada UAT MSO, Nakes, dan Dokter, misalnya
`TTR-001`. Catat satu `sessionCode` dan `sessionId` yang sama pada ketiga
dokumen.

```text
MSO membuat dan meng-assign sesi
  ↓
Nakes menerima reminder dan melengkapi tindakan
  ↓
MSO/Nakes berhenti menerima reminder saat menunggu Dokter
  ↓
Dokter menerima reminder dan mengisi Evaluasi Dokter
  ↓
Reminder finalisasi kembali ke MSO/Nakes
  ↓
MSO/Nakes memilih sumber stok dan menyelesaikan sesi
```

| Shared ID | Pelaku | Lakukan | Bukti lulus | Hasil |
|---|---|---|---|---|
| TTR-01 | MSO | Buat sesi member Jakarta dan assign `nakes@raho.id` serta `dokter@raho.id`. | Catat session code/ID; status `IN_PROGRESS` dan ketiga assignment benar. | ⬜ |
| TTR-02 | Dokter | Login sebelum langkah operasional lengkap. | Dokter tidak mendapat reminder Evaluasi Dokter. | ⬜ |
| TTR-03 | Nakes | Login/refresh. | Reminder operasional menampilkan sesi TTR-01 dan langkah yang belum lengkap. | ⬜ |
| TTR-04 | Nakes | Lengkapi diagnosis/rencana yang diperlukan, vital, infus, material, foto, serta vital sesudah. | Semua prasyarat Evaluasi Dokter lengkap pada sesi yang sama. | ⬜ |
| TTR-05 | MSO + Nakes | Refresh ketika evaluasi masih kosong. | Keduanya tidak mendapat reminder; sesi menunggu Dokter. | ⬜ |
| TTR-06 | Dokter | Login/refresh dan klik reminder. | Hanya Dokter assigned menerima reminder Evaluasi Dokter. | ⬜ |
| TTR-07 | Dokter | Isi dan simpan Evaluasi Dokter. | Evaluasi tersimpan; reminder Dokter hilang. | ⬜ |
| TTR-08 | MSO + Nakes | Refresh setelah evaluasi tersimpan. | Reminder finalisasi kembali kepada petugas operasional assigned. | ⬜ |
| TTR-09 | MSO/Nakes | Pilih satu sumber stok dan finalisasi. | Sesi selesai dan hanya sumber terpilih berkurang tepat sekali. | ⬜ |
| TTR-10 | Semua | Refresh sesi, reminder, voucher, dan ledger. | Data konsisten pada tiga role; tidak ada reminder atau posting ganda. | ⬜ |

Jalankan dua variasi dengan **dua sesi berbeda**:

- `TTR-001`: Nakes finalisasi menggunakan **Stok Tim**.
- `TTR-002`: MSO finalisasi menggunakan **Stok Cabang**.

Jangan mencoba dua sumber stok pada sesi yang sama.

## 5. Cek Kilat 15 Menit

Gunakan akun Jakarta agar contoh berikut mudah diikuti.

| No. | Lakukan | Harus Terjadi | Hasil |
|---:|---|---|---|
| 1 | Login dengan `adminlayanan.pst@raho.id`. | Masuk sebagai Admin Layanan Pusat. | ⬜ |
| 2 | Lihat sidebar. | Hanya ada Dashboard, Member, Sesi Terapi, Pembayaran, Inventori Tim, Reimburse, Notifikasi, dan Chat. | ⬜ |
| 3 | Cari member Jakarta, lalu buka detailnya. | Data dapat dibuka; member Bandung/Surabaya tidak terlihat. | ⬜ |
| 4 | Buka sesi yang di-assign ke akun ini. | Detail dan pekerjaan operasional dapat diakses. | ⬜ |
| 5 | Sisakan satu pekerjaan operasional. Login ulang/refresh. | Pop-up reminder sesi belum selesai muncul. | ⬜ |
| 6 | Lengkapi seluruh pekerjaan sebelum Evaluasi Dokter. | Reminder Admin Layanan berhenti; sesi menunggu Dokter. | ⬜ |
| 7 | Buka bagian Evaluasi Dokter. | Hanya dapat melihat; tidak ada aksi simpan/edit untuk MSO. | ⬜ |
| 8 | Setelah Dokter mengisi evaluasi, login kembali sebagai MSO. | Reminder finalisasi sesi muncul. | ⬜ |
| 9 | Finalisasi satu sesi dan pilih sumber stok. | Wajib memilih Stok Cabang atau Stok Tim; stok berkurang hanya dari sumber terpilih. | ⬜ |
| 10 | Dari Inventori Tim, ajukan pinjaman ke tim lain. | Permintaan muncul pada tim pemberi dan belum memindahkan stok sebelum disetujui. | ⬜ |
| 11 | Buat reimburse dengan nominal dan satu foto, lalu ajukan. | Status berubah dari Draft menjadi Diajukan dan masuk Approval Inbox approver. | ⬜ |
| 12 | Coba buka `/approvals`. | Ditolak/diarahkan; data approval tidak terlihat. | ⬜ |

Jika salah satu nomor 1, 3, 7, 9, 11, atau 12 gagal, jangan lanjut go-live role
Admin Layanan sebelum masalah diperbaiki.

## 6. Flow harian Admin Layanan / MSO

```text
Login
  ↓
Cek reminder sesi belum selesai
  ↓
Pilih pekerjaan
  ├─ Member/Pembayaran
  ├─ Sesi terapi operasional
  ├─ Inventori Tim/Pinjaman
  └─ Reimburse
  ↓
Simpan atau ajukan
  ↓
Cek Notifikasi
  ↓
Selesai
```

## 7. Test Case A — Login dan menu

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| AL-A01 | P0 | Login memakai email dan password Jakarta yang benar. | Login berhasil dan cabang aktif adalah Jakarta/PST. | ⬜ |
| AL-A02 | P1 | Login memakai password salah. | Login ditolak tanpa membocorkan detail akun. | ⬜ |
| AL-A03 | P0 | Periksa sidebar setelah login. | Tepat delapan menu fokus tampil: Dashboard, Member, Sesi Terapi, Pembayaran, Inventori Tim, Reimburse, Notifikasi, Chat. | ⬜ |
| AL-A04 | P1 | Refresh browser pada halaman internal. | Sesi login tetap valid dan role/cabang tidak berubah. | ⬜ |
| AL-A05 | P0 | Klik Keluar, lalu buka kembali halaman internal. | Token/sesi dihapus dan pengguna kembali ke halaman login. | ⬜ |

## 8. Test Case B — Member dan pembayaran

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| AL-B01 | P0 | Buka daftar Member sebagai akun Jakarta. | Hanya member dalam scope Jakarta yang tampil. | ⬜ |
| AL-B02 | P0 | Cari nama, kode, nomor telepon, atau email member. | Hasil pencarian relevan dan tetap dibatasi cabang. | ⬜ |
| AL-B03 | P0 | Buat member baru dengan data wajib yang valid. | Member tersimpan di cabang akun dan muncul di daftar. | ⬜ |
| AL-B04 | P1 | Buat member dengan identitas unik yang sudah dipakai. | Sistem menolak duplikasi dengan pesan yang mudah dipahami. | ⬜ |
| AL-B05 | P0 | Ubah data non-sensitif member cabang sendiri. | Perubahan tersimpan dan tercatat pada audit yang berlaku. | ⬜ |
| AL-B06 | P1 | Export daftar member. | File berhasil diunduh dan hanya memuat data yang boleh dilihat akun. | ⬜ |
| AL-B07 | P0 | Buka paket/member aktif dan buat transaksi sesuai alur. | Paket, sisa sesi, invoice, dan nominal tampil konsisten. | ⬜ |
| AL-B08 | P0 | Buka Pembayaran dan unggah bukti pembayaran valid. | Bukti tersimpan dan status pembayaran mengikuti alur yang berlaku. | ⬜ |
| AL-B09 | P1 | Unggah bukti pembayaran dengan format/ukuran tidak valid. | Upload ditolak dan tidak membuat pembayaran palsu/ganda. | ⬜ |
| AL-B10 | P0 | Ulangi submit pembayaran yang sama setelah koneksi lambat. | Tidak terbentuk invoice atau pembayaran ganda. | ⬜ |

## 9. Test Case C — Sesi terapi dan reminder

### Flow reminder

```text
Ada pekerjaan operasional belum selesai
  → Reminder Admin Layanan yang di-assign

Pekerjaan operasional lengkap, Evaluasi Dokter kosong
  → Tidak ada reminder untuk Admin Layanan
  → Reminder hanya untuk Dokter yang di-assign

Evaluasi Dokter sudah diisi, sesi belum difinalisasi
  → Reminder kembali ke petugas operasional
```

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| AL-C01 | P0 | Buka daftar Sesi Terapi. | Sesi yang dapat diakses sesuai assignment dan scope cabang tampil. | ⬜ |
| AL-C02 | P0 | Buat sesi baru menggunakan member dengan paket/sisa sesi valid. | Sesi dibuat dengan cabang, member, jadwal, Dokter, Nakes, dan Admin Layanan yang benar. | ⬜ |
| AL-C03 | P1 | Buat sesi tanpa data wajib atau tanpa hak terhadap member. | Sistem menolak dan tidak mengurangi voucher/sisa sesi. | ⬜ |
| AL-C04 | P0 | Sisakan satu langkah operasional pada sesi yang di-assign ke akun MSO, lalu login/refresh. | Pop-up reminder menampilkan sesi dan pekerjaan yang belum lengkap. | ⬜ |
| AL-C05 | P0 | Buka reminder, lalu klik sesi. | Pengguna diarahkan ke sesi yang tepat, bukan hanya ke daftar umum. | ⬜ |
| AL-C06 | P0 | Gunakan akun Admin Layanan lain yang tidak di-assign. | Reminder sesi tersebut tidak muncul. | ⬜ |
| AL-C07 | P0 | Lengkapi vital, infus, material, foto, keluhan/rekomendasi, atau langkah operasional lain sesuai assignment. | Data tersimpan dan progress berubah tanpa mengisi Evaluasi Dokter. | ⬜ |
| AL-C08 | P0 | Setelah semua prasyarat operasional lengkap tetapi Evaluasi Dokter kosong, login ulang sebagai MSO. | Tidak ada reminder untuk MSO; sesi berstatus menunggu Dokter. | ⬜ |
| AL-C09 | P0 | Pada kondisi AL-C08, login sebagai Dokter yang di-assign. | Dokter menerima reminder Evaluasi Dokter. | ⬜ |
| AL-C10 | P0 | Buka bagian Evaluasi Dokter sebagai MSO. | Bagian tampil read-only; tombol simpan/edit Evaluasi Dokter tidak tersedia. | ⬜ |
| AL-C11 | P0 | Setelah Dokter mengisi evaluasi, login/refresh sebagai MSO yang di-assign. | Reminder finalisasi muncul untuk MSO. | ⬜ |
| AL-C12 | P0 | Coba selesaikan sesi tanpa memilih sumber stok. | Sistem meminta pilihan Stok Cabang atau Stok Tim. | ⬜ |
| AL-C13 | P0 | Pilih Stok Cabang dan selesaikan sesi. | Stok cabang berkurang sekali; stok tim tidak berubah. | ⬜ |
| AL-C14 | P0 | Pilih Stok Tim yang valid dan selesaikan sesi. | Stok tim/tas berkurang sekali; stok cabang tidak ikut berkurang untuk material yang sama. | ⬜ |
| AL-C15 | P0 | Pilih Stok Tim ketika tidak ada tim/tas aktif yang di-assign. | Finalisasi ditolak dengan pesan jelas; sistem tidak diam-diam memakai Stok Cabang. | ⬜ |
| AL-C16 | P0 | Coba selesaikan sesi ketika Evaluasi Dokter belum diisi. | Finalisasi ditolak dan tidak ada pemotongan stok/voucher parsial. | ⬜ |
| AL-C17 | P1 | Klik finalisasi berulang karena koneksi lambat. | Sesi selesai sekali; stok, voucher, dan posting tidak terpotong ganda. | ⬜ |
| AL-C18 | P0 | Coba membatalkan completion sebagai Admin Layanan. | Aksi tidak tersedia atau API menolak dengan `403`. | ⬜ |

## 10. Test Case D — Inventori Tim dan pinjaman antartim

### Flow pinjaman yang harus terasa sederhana

```text
Tim peminjam pilih barang + jumlah + tim pemberi
  ↓
Kirim permintaan
  ↓
Admin tim pemberi Setujui / Tolak
  ├─ Tolak    → selesai, stok tidak berubah
  └─ Setujui  → stok pindah ke tim peminjam
                    ↓
                 Dipakai
                    ↓
              Peminjam kembalikan
                    ↓
                   Selesai
```

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| AL-D01 | P0 | Buka Inventori Tim. | Hanya tim/tas yang dapat diakses akun tampil lengkap dengan stoknya. | ⬜ |
| AL-D02 | P0 | Pilih fitur Pinjam Barang. | Daftar tim pemberi hanya berasal dari cabang yang sama dan bukan tim sendiri. | ⬜ |
| AL-D03 | P0 | Pilih tim pemberi, barang, jumlah valid, dan alasan; kirim permintaan. | Status menjadi Menunggu Persetujuan dan stok belum berubah. | ⬜ |
| AL-D04 | P1 | Ajukan jumlah melebihi stok tersedia. | Permintaan ditolak dengan pesan stok tidak cukup. | ⬜ |
| AL-D05 | P1 | Ajukan ke tim sendiri atau tim cabang lain melalui UI/API. | Sistem menolak tanpa membuat mutasi stok. | ⬜ |
| AL-D06 | P0 | Login sebagai Admin Layanan tim pemberi, lalu buka permintaan. | Detail peminjam, barang, jumlah, alasan, dan stok tersedia terlihat. | ⬜ |
| AL-D07 | P0 | Setujui permintaan sebagai admin tim pemberi. | Status disetujui; stok tim pemberi berkurang dan stok tim peminjam bertambah tepat sekali. | ⬜ |
| AL-D08 | P0 | Buat permintaan lain, lalu tolak dengan alasan. | Status ditolak, alasan tersimpan, dan kedua stok tidak berubah. | ⬜ |
| AL-D09 | P0 | Login sebagai admin tim peminjam dan catat pengembalian. | Status selesai/dikembalikan; stok kembali secara konsisten. | ⬜ |
| AL-D10 | P1 | Ulangi klik setujui atau kembalikan. | Tidak terjadi mutasi ganda. | ⬜ |
| AL-D11 | P0 | Gunakan Admin Layanan yang bukan anggota/admin kedua tim. | Detail sensitif dan aksi persetujuan/pengembalian ditolak. | ⬜ |
| AL-D12 | P1 | Nonaktifkan tim atau tas sebelum proses berikutnya. | Proses ditolak aman dan memberi alasan tindakan yang dibutuhkan. | ⬜ |

## 11. Test Case E — Reimburse

### Flow reimburse

```text
Admin Layanan buat Draft
  → Isi keperluan + nominal + metode pencairan
  → Upload 1–5 foto bukti
  → Ajukan
  → Admin Cabang verifikasi
  → Approver menyetujui/menolak
  → Finance membayar
  → Pengaju melihat status akhir
```

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| AL-E01 | P0 | Buat reimburse dengan kategori, tanggal, keperluan, nominal, metode pencairan, dan satu foto valid. | Draft tersimpan atas nama pengaju dan cabangnya. | ⬜ |
| AL-E02 | P0 | Pilih transfer bank tanpa mengisi data rekening wajib. | Sistem menolak sampai data rekening lengkap. | ⬜ |
| AL-E03 | P1 | Pilih metode tunai dengan data yang valid. | Draft dapat disimpan tanpa memaksa field rekening bank. | ⬜ |
| AL-E04 | P0 | Simpan atau ajukan reimburse tanpa foto. | Sistem menolak pengajuan karena bukti wajib. | ⬜ |
| AL-E05 | P1 | Upload lebih dari lima foto. | Foto ke-6 ditolak; lima foto yang valid tetap aman. | ⬜ |
| AL-E06 | P1 | Upload satu foto lebih dari 5 MB. | Upload ditolak dengan pesan ukuran file. | ⬜ |
| AL-E07 | P1 | Upload PDF/EXE/file yang bukan JPG, PNG, atau WebP melalui UI/API. | File ditolak dan tidak dapat diakses sebagai bukti. | ⬜ |
| AL-E08 | P0 | Buka preview bukti sebelum mengajukan. | Foto yang benar tampil dan tidak tertukar dengan pengajuan lain. | ⬜ |
| AL-E09 | P0 | Klik Ajukan pada draft valid. | Status berubah menjadi Diajukan/Submitted dan pengajuan masuk ke Approval Inbox approver. | ⬜ |
| AL-E10 | P0 | Login sebagai Admin Cabang/Finance dan buka Approval Inbox. | Nominal, pengaju, cabang, keperluan, serta foto bukti dapat diperiksa sesuai tahap approval. | ⬜ |
| AL-E11 | P0 | Login kembali sebagai Admin Layanan dan buka `/approvals`. | Akses ditolak/diarahkan; Admin Layanan tidak dapat approve pengajuan sendiri. | ⬜ |
| AL-E12 | P0 | Coba edit reimburse yang sudah masuk proses approval. | Perubahan ditolak kecuali status dikembalikan menjadi Perlu Revisi sesuai aturan. | ⬜ |
| AL-E13 | P0 | Approver kembalikan pengajuan untuk revisi, lalu pengaju memperbaiki dan mengajukan ulang. | Revisi tersimpan, histori tetap ada, dan approval dimulai kembali sesuai rule. | ⬜ |
| AL-E14 | P1 | Batalkan draft milik sendiri. | Draft dibatalkan dan tidak masuk Approval Inbox. | ⬜ |
| AL-E15 | P0 | Coba membuka/mengubah reimburse milik pengguna lain dengan mengganti ID pada URL/API. | Sistem menolak dan tidak membocorkan bukti foto. | ⬜ |
| AL-E16 | P0 | Submit dua kali karena koneksi lambat. | Hanya satu reimbursement dan satu alur approval yang terbentuk. | ⬜ |
| AL-E17 | P1 | Setelah Finance membayar, buka pengajuan sebagai MSO. | Status pembayaran, tanggal, dan referensi yang diizinkan tampil read-only. | ⬜ |

Gunakan nomor reimburse yang sama untuk melanjutkan `MFA-02` sampai `MFA-06`
pada [Pusat Dokumen UAT](./README.md#flow-bersama-2--approval-dan-pembayaran-mfa).

## 12. Test Case F — Notifikasi dan chat

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| AL-F01 | P1 | Buka Notifikasi setelah ada assignment sesi, keputusan pinjaman, atau perubahan reimburse. | Notifikasi yang relevan muncul dan membuka dokumen yang benar. | ⬜ |
| AL-F02 | P1 | Tandai notifikasi sebagai sudah dibaca, lalu refresh. | Status terbaca tetap tersimpan dan badge berkurang. | ⬜ |
| AL-F03 | P1 | Buka Chat dan kirim pesan ke pengguna yang diizinkan. | Pesan terkirim sekali dan tampil pada percakapan yang benar. | ⬜ |
| AL-F04 | P1 | Coba membuka percakapan yang tidak boleh diakses dengan mengganti ID. | Akses ditolak dan isi pesan tidak bocor. | ⬜ |

## 13. Test Case G — Keamanan dan batas role

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| AL-G01 | P0 | Buka URL Approval Inbox, Accounting, Audit Log, Pengaturan Cabang, Kinerja Staff, Master Produk, dan Integrasi Zoho secara manual. | Seluruh halaman terlarang ditolak/diarahkan; data tidak sempat tampil. | ⬜ |
| AL-G02 | P0 | Sebagai akun Jakarta, ubah ID/query menjadi cabang Bandung atau Surabaya. | API menolak atau mengembalikan data kosong sesuai kontrak; tidak ada data lintas cabang. | ⬜ |
| AL-G03 | P0 | Panggil API create/update Evaluasi Dokter memakai token Admin Layanan. | API wajib menolak dengan `403 Forbidden`. | ⬜ |
| AL-G04 | P0 | Panggil API approve/pay reimbursement memakai token Admin Layanan. | API wajib menolak dengan `403 Forbidden`. | ⬜ |
| AL-G05 | P0 | Panggil API mutasi stok tim yang tidak diikuti akun. | API wajib menolak dan ledger tidak berubah. | ⬜ |
| AL-G06 | P1 | Ubah nominal/status/owner pada request browser sebelum submit. | Server mengabaikan field terlarang atau menolak request. | ⬜ |
| AL-G07 | P1 | Gunakan URL bukti reimburse dari akun lain atau setelah logout. | File tidak dapat diakses tanpa otorisasi yang benar. | ⬜ |

> **Gate keamanan wajib:** `AL-G03` tidak boleh hanya diuji dari tampilan.
> Walaupun tombol Evaluasi Dokter disembunyikan dari MSO, endpoint backend juga
> harus mengembalikan `403`. Jika request berhasil, catat sebagai defect P0.

## 14. Data minimum yang dicatat saat defect

Salin template singkat ini:

```text
Test case : AL-...
Hasil     : FAIL / BLOCKED
Akun      : adminlayanan....@raho.id
Cabang    : PST / BDG / SBY
Waktu     : YYYY-MM-DD HH:mm WIB
Langkah   :
1.
2.
Hasil aktual:
Harusnya:
Error/API status:
Screenshot/video:
```

## 15. Ringkasan hasil UAT

| Kelompok | PASS | FAIL | BLOCKED | NOT TESTED |
|---|---:|---:|---:|---:|
| UAT Terhubung Tim Terapi | 0 | 0 | 0 | 10 |
| A. Login dan menu | 0 | 0 | 0 | 5 |
| B. Member dan pembayaran | 0 | 0 | 0 | 10 |
| C. Sesi dan reminder | 0 | 0 | 0 | 18 |
| D. Inventori Tim dan pinjaman | 0 | 0 | 0 | 12 |
| E. Reimburse | 0 | 0 | 0 | 17 |
| F. Notifikasi dan chat | 0 | 0 | 0 | 4 |
| G. Keamanan dan batas role | 0 | 0 | 0 | 7 |
| **Total** | **0** | **0** | **0** | **83** |

Keputusan akhir:

- [ ] **LULUS** — seluruh P0 PASS dan tidak ada defect kritis.
- [ ] **LULUS BERSYARAT** — hanya ada temuan nonkritis dengan rencana perbaikan.
- [ ] **TIDAK LULUS** — ada P0 FAIL, kebocoran data, atau stok/uang terposting ganda.

| Persetujuan | Nama | Tanggal | Tanda tangan/status |
|---|---|---|---|
| Perwakilan Admin Layanan/MSO |  |  |  |
| QA/UAT |  |  |  |
| Product Owner |  |  |  |

## 16. Acuan fitur

- [Pusat Dokumen UAT](./README.md)
- [Daftar Fitur per Role dan Flow](../DAFTAR_FITUR_PER_ROLE_DAN_FLOW.md)
- [UAT Nakes / Perawat](./UAT_NAKES.md)
- [UAT Dokter](./UAT_DOKTER.md)
- [UAT Admin Manager](./UAT_ADMIN_MANAGER.md)
- [UAT Finance](./UAT_FINANCE.md)
- [Panduan Implementasi Zoho Books](../IMPLEMENTATION_PLAN_ZOHO_BOOKS_ONLY.md)
