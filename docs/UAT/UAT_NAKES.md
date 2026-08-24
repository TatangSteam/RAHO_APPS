# UAT Nakes / Perawat

Status: siap dipakai untuk UAT, belum berarti seluruh skenario sudah lulus  
Role sistem: `NURSE`  
Nama bisnis: **Nakes / Perawat**  
Pembaruan: 24 Agustus 2026

Dokumen ini terhubung dengan:

- [Pusat Dokumen UAT](./README.md)
- [UAT Super Admin](./UAT_SUPER_ADMIN.md)
- [UAT Admin Layanan / MSO](./UAT_ADMIN_LAYANAN_MSO.md)
- [UAT Dokter](./UAT_DOKTER.md)
- [UAT Admin Manager](./UAT_ADMIN_MANAGER.md)
- [UAT Finance](./UAT_FINANCE.md)

Jika ingin cepat, jalankan bagian **Cek Kilat 15 Menit** dan **UAT Terhubung
Tim Terapi** terlebih dahulu.

## 1. Ringkasan 30 detik

Nakes harus bisa:

- melihat member dan sesi yang boleh diakses;
- membuat sesi bila diperlukan dan otomatis menjadi Nakes yang di-assign;
- mengisi diagnosis/rencana terapi sesuai kewenangan klinis;
- mencatat vital sebelum/sesudah, infus, material, foto, keluhan, dan
  rekomendasi;
- menerima reminder pekerjaan operasional hanya untuk sesi yang di-assign;
- memilih **Stok Cabang** atau **Stok Tim** saat finalisasi;
- melihat Inventori Tim, Tas Homecare, dan Riwayat Penggunaan Barang;
- mengajukan pinjaman barang untuk timnya;
- mengajukan reimburse pribadi dengan foto bukti;
- menggunakan Notifikasi dan Chat.

Nakes tidak boleh:

- mengisi Evaluasi Dokter;
- menerima reminder ketika satu-satunya pekerjaan tersisa adalah Evaluasi
  Dokter;
- membuat/mengubah member, paket, atau pembayaran;
- menyetujui dan mengembalikan pinjaman atas nama admin tim;
- menyetujui atau membayar reimburse;
- melihat data di luar cabang/assignment yang diizinkan.

## 2. Credential login dari seeding

> **Hanya untuk local/test. Jangan gunakan credential ini di production.**

| Cabang utama | Email | Password | Staff code | Nama seed |
|---|---|---|---|---|
| Jakarta (`PST`) | `nakes@raho.id` | `Nakes@123` | `NR-20260413-SHARED1` | Siti Rahayu, Amd.Kep |
| Bandung (`BDG`) | `nakes2@raho.id` | `Nakes@123` | `NR-20260413-SHARED2` | Dewi Lestari, Amd.Kep |
| Surabaya (`SBY`) | `nakes3@raho.id` | `Nakes@123` | `NR-20260413-SHARED3` | Eko Prasetyo, Amd.Kep |

Credential pendamping Jakarta:

| Role | Email | Password |
|---|---|---|
| Admin Layanan / MSO | `adminlayanan.pst@raho.id` | `AdminLayanan@123` |
| Dokter | `dokter@raho.id` | `Dokter@123` |
| Admin Cabang | `admincabang.pst@raho.id` | `AdminCabang@123` |
| Finance | `finance@raho.id` | `Finance@123` |

Dokter dan Nakes dapat mempunyai assignment lebih dari satu cabang. Cabang
utama pada tabel berasal dari field `branchId`; akses cabang tambahan harus
mengikuti data `StaffBranch`, bukan diberikan hanya karena mengetahui URL.

Perintah seed dari root project:

```powershell
npm.cmd run db:seed --prefix apps/api
```

Jangan menjalankan seed testing pada database production.

## 3. Cara mencatat hasil

- `✅ PASS` — hasil sama dengan kolom **Harus Terjadi**.
- `❌ FAIL` — hasil berbeda atau ada celah akses.
- `⛔ BLOCKED` — data/prasyarat belum tersedia.
- `⬜ NOT TESTED` — belum dijalankan.

## 4. Persiapan singkat

Pastikan tersedia:

- member Jakarta dengan paket aktif dan sisa sesi;
- satu sesi `IN_PROGRESS` yang meng-assign MSO Jakarta, `nakes@raho.id`, dan
  `dokter@raho.id`;
- dua tim aktif dalam cabang yang sama dan masing-masing mempunyai tas;
- akun Nakes menjadi anggota aktif pada salah satu tim;
- stok cabang dan stok tim cukup untuk satu sesi;
- satu foto sesi dan satu foto reimburse, masing-masing kurang dari 5 MB;
- browser kedua/incognito untuk berpindah role tanpa logout berulang.

## 5. UAT Terhubung Tim Terapi

Gunakan **kode run yang sama** pada ketiga dokumen, misalnya `TTR-001`.

```text
MSO buat dan assign sesi
  ↓
Nakes menerima reminder operasional
  ↓
Nakes melengkapi tindakan
  ↓
Reminder Nakes/MSO berhenti
  ↓
Dokter menerima reminder Evaluasi Dokter
  ↓
Dokter mengisi evaluasi
  ↓
Reminder finalisasi kembali ke MSO/Nakes
  ↓
MSO atau Nakes memilih sumber stok dan finalisasi
```

| Shared ID | Pelaku | Lakukan | Bukti lulus | Hasil |
|---|---|---|---|---|
| TTR-01 | MSO | Buat sesi dan assign `nakes@raho.id` serta `dokter@raho.id`. | Catat session code dan ID; sesi `IN_PROGRESS`. | ⬜ |
| TTR-02 | Dokter | Login sebelum langkah operasional lengkap. | Dokter **tidak** mendapat reminder evaluasi. | ⬜ |
| TTR-03 | Nakes | Login/refresh. | Pop-up reminder menampilkan sesi TTR-01 beserta langkah operasional yang kurang. | ⬜ |
| TTR-04 | Nakes | Isi vital sebelum, infus, material, foto, vital sesudah, dan keluhan/rekomendasi. | Seluruh langkah tersimpan atas sesi yang sama. | ⬜ |
| TTR-05 | MSO + Nakes | Refresh setelah prasyarat lengkap tetapi evaluasi kosong. | Keduanya tidak mendapat reminder; status menunggu Dokter. | ⬜ |
| TTR-06 | Dokter | Login/refresh dan buka reminder. | Hanya Dokter yang di-assign menerima reminder Evaluasi Dokter. | ⬜ |
| TTR-07 | Dokter | Isi dan simpan Evaluasi Dokter. | Evaluasi tersimpan; reminder Dokter hilang. | ⬜ |
| TTR-08 | MSO + Nakes | Refresh setelah evaluasi tersimpan. | Reminder finalisasi muncul pada petugas operasional yang di-assign. | ⬜ |
| TTR-09 | Nakes | Pilih **Stok Tim**, lalu selesaikan sesi. | Sesi selesai; stok tim berkurang sekali dan stok cabang tidak terpotong untuk material yang sama. | ⬜ |
| TTR-10 | Semua | Refresh ketiga akun dan cek sesi/ledger. | Tidak ada reminder tersisa, voucher/stok hanya terposting sekali, dan data ketiga role konsisten. | ⬜ |

Untuk variasi kedua, buat sesi baru dengan kode run `TTR-002`; minta MSO
memilih **Stok Cabang** saat finalisasi. Jangan memakai sesi yang sama untuk
menguji dua sumber stok.

## 6. Cek Kilat 15 Menit

| No. | Lakukan | Harus Terjadi | Hasil |
|---:|---|---|---|
| 1 | Login sebagai `nakes@raho.id`. | Masuk sebagai Siti Rahayu dengan role Nakes. | ⬜ |
| 2 | Periksa sidebar. | Hanya Dashboard, Member, Sesi Terapi, Inventori Tim, Riwayat Penggunaan Barang, Tas Homecare, Reimburse, Notifikasi, dan Chat. | ⬜ |
| 3 | Buka Dashboard. | Ringkasan sesi, material, dan stok operasional tampil tanpa nominal pendapatan. | ⬜ |
| 4 | Buka member dan sesi yang di-assign. | Data yang relevan dapat dilihat; profil/paket tidak dapat diubah. | ⬜ |
| 5 | Sisakan satu langkah operasional pada sesi. | Reminder Nakes muncul setelah login/refresh. | ⬜ |
| 6 | Lengkapi seluruh langkah sebelum Evaluasi Dokter. | Reminder Nakes berhenti dan sesi menunggu Dokter. | ⬜ |
| 7 | Buka Evaluasi Dokter. | Read-only; Nakes tidak mempunyai tombol simpan/edit. | ⬜ |
| 8 | Setelah Dokter mengisi evaluasi, refresh. | Reminder finalisasi kembali muncul. | ⬜ |
| 9 | Finalisasi dengan Stok Tim atau Stok Cabang. | Hanya sumber yang dipilih berkurang tepat sekali. | ⬜ |
| 10 | Buat permintaan pinjaman tim. | Status Menunggu; Nakes tidak bisa menyetujui sendiri. | ⬜ |
| 11 | Buat reimburse dengan satu foto dan ajukan. | Status Menunggu Approval; tidak ada tombol approve/bayar. | ⬜ |
| 12 | Coba buka `/approvals` dan `/accounting`. | Akses ditolak/diarahkan dan data tidak terlihat. | ⬜ |

## 7. Test Case A — Login, menu, dan dashboard

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| NK-A01 | P0 | Login dengan credential Jakarta yang benar. | Login berhasil sebagai role `NURSE`. | ⬜ |
| NK-A02 | P1 | Login dengan password salah. | Login ditolak tanpa membocorkan detail akun. | ⬜ |
| NK-A03 | P0 | Periksa sidebar. | Tepat sembilan menu fokus Nakes tampil. | ⬜ |
| NK-A04 | P0 | Buka Dashboard Nakes. | Sesi hari ini, sesi aktif/mendatang, penggunaan material, dan ringkasan stok tampil sesuai scope. | ⬜ |
| NK-A05 | P0 | Periksa kartu/response Dashboard. | Nilai pendapatan, laba, kas, dan transaksi Finance tidak ditampilkan. | ⬜ |
| NK-A06 | P1 | Refresh halaman lalu logout. | Sesi tetap valid saat refresh dan terhapus setelah logout. | ⬜ |

## 8. Test Case B — Member dan data klinis

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| NK-B01 | P0 | Buka daftar dan detail member yang berada dalam scope cabang/assignment. | Data dapat dilihat sesuai kebutuhan terapi. | ⬜ |
| NK-B02 | P0 | Coba membuat member baru. | Tombol tidak tersedia dan API menolak dengan `403`. | ⬜ |
| NK-B03 | P0 | Coba mengubah profil, status hidup, paket, atau pembayaran member. | Aksi tidak tersedia dan API terlarang menolak. | ⬜ |
| NK-B04 | P1 | Coba export daftar member. | Aksi tidak tersedia/API menolak karena export bukan hak Nakes. | ⬜ |
| NK-B05 | P0 | Tambah atau perbarui diagnosis member sesuai kewenangan. | Diagnosis tersimpan dan histori tetap dapat ditelusuri. | ⬜ |
| NK-B06 | P0 | Buat/edit set Therapy Plan yang belum terkunci/dipakai. | Perubahan valid tersimpan sebagai set/versi yang benar. | ⬜ |
| NK-B07 | P0 | Coba mengubah Therapy Plan yang sudah dipakai/berhistori. | Sistem tidak menimpa histori; mengikuti versioning atau menolak dengan pesan jelas. | ⬜ |
| NK-B08 | P1 | Upload hasil lab valid, lalu coba menghapusnya. | Upload diizinkan; hapus hanya tersedia untuk role yang berwenang. | ⬜ |

## 9. Test Case C — Sesi dan reminder

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| NK-C01 | P0 | Buka daftar Sesi Terapi. | Sesi sesuai primary/additional branch atau assignment tampil. | ⬜ |
| NK-C02 | P0 | Dari detail member, buat sesi baru. | Sesi dapat dibuat dan akun otomatis/valid menjadi Nakes yang di-assign. | ⬜ |
| NK-C03 | P1 | Buat sesi tanpa paket/sisa sesi/data wajib. | Sistem menolak tanpa memotong voucher. | ⬜ |
| NK-C04 | P0 | Buka sesi yang tidak di-assign dan berada di luar cabang akses. | Akses ditolak tanpa membocorkan data klinis. | ⬜ |
| NK-C05 | P0 | Sisakan diagnosis/rencana terapi/vital/infus/material pada sesi assigned. | Reminder menampilkan hanya sesi dan langkah yang belum lengkap. | ⬜ |
| NK-C06 | P0 | Login sebagai Nakes yang tidak di-assign. | Reminder sesi tersebut tidak muncul. | ⬜ |
| NK-C07 | P0 | Isi vital sebelum dengan data valid. | Data tersimpan sebagai `SEBELUM`. | ⬜ |
| NK-C08 | P1 | Isi vital dengan nilai/format tidak valid. | Sistem menolak tanpa merusak data sebelumnya. | ⬜ |
| NK-C09 | P0 | Catat infus dan material aktual. | Data tersimpan pada sesi/cabang yang benar dan belum memotong stok dua kali. | ⬜ |
| NK-C10 | P0 | Upload foto utama/pendukung yang valid. | Foto dapat dilihat kembali oleh role yang berwenang. | ⬜ |
| NK-C11 | P0 | Isi vital sesudah serta keluhan/rekomendasi. | Data operasional tersimpan; progress berubah. | ⬜ |
| NK-C12 | P0 | Buka Evaluasi Dokter sebagai Nakes. | Evaluasi read-only; field SOAP tidak dapat disimpan. | ⬜ |
| NK-C13 | P0 | Panggil API Evaluasi Dokter dengan token Nakes. | API menolak field SOAP dengan `403 DOCTOR_EVALUATION_ROLE_REQUIRED`. | ⬜ |
| NK-C14 | P0 | Lengkapi prasyarat, tetapi biarkan evaluasi kosong. | Reminder Nakes hilang; tidak ada tugas Evaluasi Dokter untuk Nakes. | ⬜ |
| NK-C15 | P0 | Setelah Dokter menyimpan evaluasi, refresh. | Reminder finalisasi muncul untuk Nakes yang di-assign. | ⬜ |
| NK-C16 | P0 | Coba finalisasi tanpa memilih sumber stok. | Sistem meminta Stok Tim atau Stok Cabang. | ⬜ |
| NK-C17 | P0 | Pilih Stok Tim tanpa tim/tas aktif atau stok cukup. | Finalisasi ditolak; tidak diam-diam beralih ke Stok Cabang. | ⬜ |
| NK-C18 | P0 | Finalisasi valid dan klik berulang karena koneksi lambat. | Sesi, voucher, pemakaian, dan stok terposting tepat sekali. | ⬜ |
| NK-C19 | P0 | Coba membatalkan completion. | Aksi tidak tersedia/API menolak dengan `403`. | ⬜ |

## 10. Test Case D — Inventori Tim dan Tas Homecare

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| NK-D01 | P0 | Buka Inventori Tim. | Hanya tim/tas yang diikuti secara aktif dapat dilihat. | ⬜ |
| NK-D02 | P0 | Bandingkan stok tas dengan Riwayat Penggunaan Barang. | Saldo dan mutasi terkait sesi konsisten. | ⬜ |
| NK-D03 | P1 | Buka Tas Homecare. | Detail tas/stock yang boleh diakses tampil; tombol administrasi tim tidak tersedia. | ⬜ |
| NK-D04 | P0 | Ajukan pinjaman dari tim lain dalam cabang yang sama. | Permintaan PENDING dibuat dan stok belum berpindah. | ⬜ |
| NK-D05 | P1 | Ajukan jumlah melebihi stok atau ke tim cabang lain. | Permintaan ditolak tanpa mutasi stok. | ⬜ |
| NK-D06 | P0 | Coba menyetujui/menolak pinjaman sebagai Nakes. | Tombol tidak tersedia dan API menolak; review hanya admin tim pemberi. | ⬜ |
| NK-D07 | P0 | Setelah Admin Layanan pemberi menyetujui, refresh stok. | Stok barang masuk ke tas tim peminjam tepat sekali. | ⬜ |
| NK-D08 | P0 | Coba mencatat pengembalian sebagai Nakes. | Tombol tidak tersedia/API menolak; pengembalian dilakukan Admin Layanan tim peminjam. | ⬜ |
| NK-D09 | P1 | Buka tas/tim yang tidak diikuti dengan mengganti ID. | API menolak `BAG_TEAM_ACCESS_DENIED` atau respons aman yang setara. | ⬜ |
| NK-D10 | P1 | Export/filter riwayat penggunaan sesuai UI. | Hasil hanya memuat scope yang boleh dilihat. | ⬜ |

## 11. Test Case E — Reimburse pribadi

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| NK-E01 | P0 | Buat reimburse valid dengan satu foto. | Draft dibuat atas nama Nakes dan cabang yang diizinkan. | ⬜ |
| NK-E02 | P0 | Pilih transfer bank tanpa data rekening lengkap. | Sistem menolak sampai rekening lengkap. | ⬜ |
| NK-E03 | P1 | Pilih Tunai. | Draft dapat disimpan tanpa field rekening bank. | ⬜ |
| NK-E04 | P0 | Ajukan tanpa foto. | Sistem menolak karena minimal satu bukti wajib. | ⬜ |
| NK-E05 | P1 | Upload lebih dari lima foto, foto lebih dari 5 MB, atau file non-image. | File tidak valid ditolak. | ⬜ |
| NK-E06 | P1 | Gunakan foto bukti yang sama pada pengajuan aktif lain. | Sistem menolak penggunaan ulang bukti. | ⬜ |
| NK-E07 | P0 | Ajukan draft valid. | Status Menunggu Approval dan masuk Approval Inbox approver. | ⬜ |
| NK-E08 | P0 | Buka `/approvals` sebagai Nakes. | Akses ditolak; Nakes tidak dapat approve pengajuannya sendiri. | ⬜ |
| NK-E09 | P0 | Approver meminta revisi; Nakes memperbaiki dan mengajukan ulang. | Revisi menjadi draft baru dengan histori tetap terjaga. | ⬜ |
| NK-E10 | P0 | Coba melihat/mengubah reimburse pengguna lain. | Akses ditolak dan foto bukti tidak bocor. | ⬜ |
| NK-E11 | P1 | Batalkan draft milik sendiri. | Status Dibatalkan dan tidak masuk proses approval. | ⬜ |
| NK-E12 | P0 | Submit dua kali akibat koneksi lambat. | Hanya satu reimburse dan satu approval instance terbentuk. | ⬜ |

Lanjutkan nomor reimburse yang sama pada flow `MFA-02` sampai `MFA-06` di
[Pusat Dokumen UAT](./README.md#flow-bersama-2--approval-dan-pembayaran-mfa).

## 12. Test Case F — Notifikasi dan Chat

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| NK-F01 | P1 | Buka notifikasi assignment/reminder/keputusan pinjaman/reimburse. | Notifikasi membuka dokumen yang tepat. | ⬜ |
| NK-F02 | P1 | Tandai notifikasi dibaca dan refresh. | Status terbaca tetap tersimpan. | ⬜ |
| NK-F03 | P1 | Kirim pesan pada percakapan yang diizinkan. | Pesan terkirim sekali. | ⬜ |
| NK-F04 | P0 | Ganti ID percakapan ke ruang yang tidak boleh diakses. | API menolak dan isi pesan tidak bocor. | ⬜ |

## 13. Test Case G — Keamanan dan batas role

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| NK-G01 | P0 | Buka `/payments`, `/approvals`, `/accounting`, `/staff-performance`, `/branches`, dan `/admin/audit-logs`. | Halaman terlarang ditolak/diarahkan. | ⬜ |
| NK-G02 | P0 | Panggil API create/update member atau assign package. | API menolak dengan `403`. | ⬜ |
| NK-G03 | P0 | Panggil API Evaluasi Dokter. | API menolak field SOAP dengan `403`. | ⬜ |
| NK-G04 | P0 | Panggil API approve/pay reimbursement. | API menolak dengan `403`. | ⬜ |
| NK-G05 | P0 | Panggil API review/return team loan. | API menolak karena bukan Admin Layanan tim. | ⬜ |
| NK-G06 | P0 | Gunakan branch ID yang tidak di-assign. | Data lintas cabang tidak tampil. | ⬜ |
| NK-G07 | P1 | Ubah `writtenBy`, owner, status, nominal, atau branch pada request browser. | Server mengabaikan field terlarang atau menolak request. | ⬜ |
| NK-G08 | P1 | Buka URL foto sesi/reimburse setelah logout. | File tidak dapat diakses tanpa otorisasi. | ⬜ |

## 14. Template defect

```text
Test case : NK-... / TTR-...
Hasil     : FAIL / BLOCKED
Akun      : nakes...@raho.id
Cabang    : PST / BDG / SBY
Session   :
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
| A. Login, menu, dashboard | 0 | 0 | 0 | 6 |
| B. Member dan klinis | 0 | 0 | 0 | 8 |
| C. Sesi dan reminder | 0 | 0 | 0 | 19 |
| D. Inventori Tim | 0 | 0 | 0 | 10 |
| E. Reimburse | 0 | 0 | 0 | 12 |
| F. Notifikasi dan Chat | 0 | 0 | 0 | 4 |
| G. Keamanan | 0 | 0 | 0 | 8 |
| **Total** | **0** | **0** | **0** | **77** |

Keputusan:

- [ ] **LULUS** — seluruh P0 dan TTR PASS.
- [ ] **LULUS BERSYARAT** — hanya ada temuan nonkritis.
- [ ] **TIDAK LULUS** — ada kebocoran data, role bypass, atau posting ganda.

| Persetujuan | Nama | Tanggal | Status |
|---|---|---|---|
| Perwakilan Nakes |  |  |  |
| QA/UAT |  |  |  |
| Product Owner |  |  |  |
