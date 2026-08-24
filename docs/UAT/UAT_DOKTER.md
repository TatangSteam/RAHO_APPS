# UAT Dokter

Status: siap dipakai untuk UAT, belum berarti seluruh skenario sudah lulus  
Role sistem: `DOCTOR`  
Nama bisnis: **Dokter**  
Pembaruan: 24 Agustus 2026

Dokumen ini terhubung dengan:

- [Pusat Dokumen UAT](./README.md)
- [UAT Admin Layanan / MSO](./UAT_ADMIN_LAYANAN_MSO.md)
- [UAT Nakes](./UAT_NAKES.md)
- [UAT Admin Manager](./UAT_ADMIN_MANAGER.md)
- [UAT Finance](./UAT_FINANCE.md)

Jika ingin cepat, jalankan bagian **Cek Kilat 15 Menit** dan **UAT Terhubung
Tim Terapi** terlebih dahulu.

## 1. Ringkasan 30 detik

Dokter harus bisa:

- melihat dashboard, member, dan sesi sesuai cabang/assignment;
- melihat dan memperbarui diagnosis serta Therapy Plan sesuai kewenangan medis;
- menerima reminder **hanya** ketika seluruh tahap sebelum Evaluasi Dokter
  sudah lengkap;
- mengisi Evaluasi Dokter hanya pada sesi yang di-assign;
- melihat Kinerja Staff pada cabang yang diizinkan;
- mengajukan reimburse pribadi;
- menggunakan Notifikasi dan Chat.

Dokter tidak boleh:

- membuat sesi baru;
- menerima reminder diagnosis, vital, infus, material, atau finalisasi;
- mengisi Evaluasi Dokter sebelum tahap sebelumnya lengkap;
- mengisi evaluasi sesi milik Dokter lain;
- mengisi keluhan/rekomendasi operasional atau melakukan finalisasi sesi;
- membuka Inventori Tim, Pembayaran, Approval Inbox, atau Finance;
- menyetujui/membayar reimburse.

## 2. Credential login dari seeding

> **Hanya untuk local/test. Jangan gunakan credential ini di production.**

| Cabang utama | Email | Password | Staff code | Nama seed |
|---|---|---|---|---|
| Jakarta (`PST`) | `dokter@raho.id` | `Dokter@123` | `DR-20260413-SHARED1` | dr. Ahmad Fauzi, SpPD |
| Bandung (`BDG`) | `dokter2@raho.id` | `Dokter@123` | `DR-20260413-SHARED2` | dr. Budi Santoso, SpPD |
| Surabaya (`SBY`) | `dokter3@raho.id` | `Dokter@123` | `DR-20260413-SHARED3` | dr. Citra Wijaya, SpPD |

Credential pendamping Jakarta:

| Role | Email | Password |
|---|---|---|
| Admin Layanan / MSO | `adminlayanan.pst@raho.id` | `AdminLayanan@123` |
| Nakes | `nakes@raho.id` | `Nakes@123` |
| Admin Cabang | `admincabang.pst@raho.id` | `AdminCabang@123` |
| Finance | `finance@raho.id` | `Finance@123` |

Dokter dapat mempunyai assignment cabang tambahan melalui `StaffBranch`.
Cabang utama pada tabel bukan izin otomatis untuk seluruh cabang.

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

- member dengan paket aktif;
- satu sesi `IN_PROGRESS` yang meng-assign `dokter@raho.id`, `nakes@raho.id`,
  dan MSO Jakarta;
- sesi kedua yang di-assign kepada `dokter2@raho.id` untuk tes akses negatif;
- satu sesi dengan tahap operasional belum lengkap;
- satu sesi dengan seluruh tahap sebelum evaluasi sudah lengkap;
- satu foto reimburse kurang dari 5 MB;
- browser kedua/incognito untuk akun MSO dan Nakes.

## 5. UAT Terhubung Tim Terapi

Gunakan **kode run yang sama** pada ketiga dokumen, misalnya `TTR-001`.

```text
MSO membuat sesi
  ↓
Nakes melengkapi pekerjaan operasional
  ↓
Dokter baru menerima reminder
  ↓
Dokter mengisi Evaluasi Dokter
  ↓
Dokter selesai — tidak melakukan finalisasi
  ↓
MSO/Nakes menerima reminder finalisasi dan memilih sumber stok
```

| Shared ID | Pelaku | Lakukan | Bukti lulus | Hasil |
|---|---|---|---|---|
| TTR-01 | MSO | Buat sesi dan assign `dokter@raho.id` serta `nakes@raho.id`. | Catat session code dan ID; sesi `IN_PROGRESS`. | ⬜ |
| TTR-02 | Dokter | Login sebelum tahap operasional lengkap. | Tidak ada reminder Evaluasi Dokter. | ⬜ |
| TTR-03 | Nakes | Login dan buka reminder. | Reminder pekerjaan operasional muncul hanya untuk sesi assigned. | ⬜ |
| TTR-04 | Nakes | Lengkapi diagnosis/rencana yang diperlukan, vital, infus, material, foto, dan vital sesudah. | Seluruh prasyarat evaluasi lengkap. | ⬜ |
| TTR-05 | MSO + Nakes | Refresh saat evaluasi masih kosong. | Tidak ada reminder bagi keduanya; status menunggu Dokter. | ⬜ |
| TTR-06 | Dokter | Refresh dan buka reminder. | Reminder Evaluasi Dokter muncul dan membuka sesi TTR-01. | ⬜ |
| TTR-07 | Dokter | Isi minimal satu field SOAP dan simpan. | Evaluasi tersimpan atas Dokter yang di-assign; reminder Dokter hilang. | ⬜ |
| TTR-08 | Dokter | Tetap berada pada halaman sesi. | Tidak ada tugas finalisasi untuk Dokter. | ⬜ |
| TTR-09 | MSO/Nakes | Refresh, pilih sumber stok, lalu finalisasi. | Sesi selesai dan stok sumber terpilih berkurang sekali. | ⬜ |
| TTR-10 | Semua | Cek ulang sesi dan reminder. | Data konsisten, tidak ada reminder tersisa, dan tidak ada posting ganda. | ⬜ |

## 6. Cek Kilat 15 Menit

| No. | Lakukan | Harus Terjadi | Hasil |
|---:|---|---|---|
| 1 | Login sebagai `dokter@raho.id`. | Masuk sebagai dr. Ahmad Fauzi dengan role Dokter. | ⬜ |
| 2 | Periksa sidebar. | Hanya Dashboard, Member, Sesi Terapi, Kinerja Staff, Reimburse, Notifikasi, dan Chat. | ⬜ |
| 3 | Buka Dashboard Dokter. | Jadwal/sesi Dokter dan pasien terbaru tampil tanpa nominal Finance. | ⬜ |
| 4 | Buka member dan sesi assigned. | Data klinis dapat dilihat; profil, paket, dan pembayaran tidak dapat diubah. | ⬜ |
| 5 | Buka sesi ketika tahap operasional belum lengkap. | Tidak ada reminder dan Evaluasi Dokter belum dapat diisi. | ⬜ |
| 6 | Setelah Nakes melengkapi tahap operasional, refresh. | Reminder Evaluasi Dokter muncul. | ⬜ |
| 7 | Isi Evaluasi Dokter. | Evaluasi tersimpan dan reminder hilang. | ⬜ |
| 8 | Coba mengisi evaluasi sesi Dokter lain. | Ditolak dengan `403`. | ⬜ |
| 9 | Setelah evaluasi selesai, periksa aksi sesi. | Dokter tidak menerima reminder/tugas finalisasi. | ⬜ |
| 10 | Buka Kinerja Staff. | Data hanya untuk cabang yang di-assign; export massal tidak tersedia. | ⬜ |
| 11 | Buat reimburse dengan satu foto dan ajukan. | Menunggu Approval; tidak ada tombol approve/bayar. | ⬜ |
| 12 | Coba buka `/inventory/team`, `/approvals`, dan `/accounting`. | Akses ditolak/diarahkan dan data tidak terlihat. | ⬜ |

## 7. Test Case A — Login, menu, dan dashboard

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| DR-A01 | P0 | Login dengan credential Jakarta yang benar. | Login berhasil sebagai role `DOCTOR`. | ⬜ |
| DR-A02 | P1 | Login dengan password salah. | Login ditolak tanpa membocorkan detail akun. | ⬜ |
| DR-A03 | P0 | Periksa sidebar. | Tepat tujuh menu fokus Dokter tampil. | ⬜ |
| DR-A04 | P0 | Buka Dashboard Dokter. | Jadwal hari ini, status sesi, statistik bulanan, dan pasien terbaru sesuai Dokter/cabang. | ⬜ |
| DR-A05 | P0 | Periksa response Dashboard. | Nominal pendapatan, kas, laba, dan transaksi Finance tidak ditampilkan. | ⬜ |
| DR-A06 | P1 | Refresh lalu logout. | Sesi tetap valid saat refresh dan terhapus setelah logout. | ⬜ |

## 8. Test Case B — Member dan keputusan klinis

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| DR-B01 | P0 | Buka daftar/detail member dalam scope cabang/assignment. | Data yang diperlukan untuk pelayanan dapat dilihat. | ⬜ |
| DR-B02 | P0 | Coba membuat atau mengubah profil member. | Tombol tidak tersedia dan API menolak. | ⬜ |
| DR-B03 | P0 | Coba assign/edit paket atau pembayaran. | Aksi tidak tersedia dan API terlarang menolak. | ⬜ |
| DR-B04 | P0 | Tambah/perbarui diagnosis member sesuai kewenangan. | Diagnosis tersimpan dan histori tetap ada. | ⬜ |
| DR-B05 | P0 | Buat/edit Therapy Plan yang belum terkunci. | Plan tersimpan dengan set/versi yang benar. | ⬜ |
| DR-B06 | P0 | Coba menimpa Therapy Plan yang sudah dipakai. | Histori tidak tertimpa; sistem melakukan versioning atau menolak. | ⬜ |
| DR-B07 | P1 | Upload hasil lab valid, lalu coba menghapusnya. | Upload diizinkan; hapus hanya untuk role yang berwenang. | ⬜ |
| DR-B08 | P1 | Coba export seluruh member. | Aksi tidak tersedia/API menolak. | ⬜ |

## 9. Test Case C — Sesi, reminder, dan Evaluasi Dokter

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| DR-C01 | P0 | Buka daftar sesi. | Sesi sesuai cabang/assignment Dokter tampil. | ⬜ |
| DR-C02 | P0 | Coba membuat sesi baru dari detail member/API. | Tombol tidak tersedia dan API menolak dengan `403`. | ⬜ |
| DR-C03 | P0 | Buka sesi di luar cabang dan bukan assignment. | Akses ditolak tanpa membocorkan data klinis. | ⬜ |
| DR-C04 | P0 | Buka sesi assigned yang diagnosis/rencana/vital/infus/materialnya belum lengkap. | Detail dapat dilihat, tetapi tidak ada reminder Evaluasi Dokter. | ⬜ |
| DR-C05 | P0 | Coba menyimpan SOAP sebelum seluruh prasyarat lengkap. | API menolak `409 DOCTOR_EVALUATION_NOT_READY`. | ⬜ |
| DR-C06 | P0 | Setelah prasyarat lengkap, login/refresh. | Pop-up reminder Evaluasi Dokter muncul. | ⬜ |
| DR-C07 | P0 | Klik reminder. | Dibuka sesi dan bagian Evaluasi Dokter yang benar. | ⬜ |
| DR-C08 | P0 | Isi satu atau lebih field SOAP valid dan simpan. | Evaluasi tersimpan; `writtenBy` berasal dari akun login, bukan input palsu. | ⬜ |
| DR-C09 | P1 | Simpan seluruh field SOAP kosong. | Sistem menolak dengan pesan minimal satu field wajib. | ⬜ |
| DR-C10 | P0 | Perbarui evaluasi sendiri pada sesi assigned yang belum posted. | Perubahan tersimpan dan histori/audit tersedia sesuai desain. | ⬜ |
| DR-C11 | P0 | Gunakan `dokter2@raho.id` untuk menulis evaluasi sesi milik `dokter@raho.id`. | API menolak `403 DOCTOR_NOT_ASSIGNED`. | ⬜ |
| DR-C12 | P0 | Sebagai MSO/Nakes, coba menulis field SOAP sesi yang sama. | API menolak `403 DOCTOR_EVALUATION_ROLE_REQUIRED`. | ⬜ |
| DR-C13 | P0 | Setelah evaluasi tersimpan, refresh sebagai Dokter. | Reminder Dokter hilang. | ⬜ |
| DR-C14 | P0 | Setelah evaluasi tersimpan, login MSO/Nakes assigned. | Reminder finalisasi muncul pada petugas operasional. | ⬜ |
| DR-C15 | P0 | Periksa Keluhan & Rekomendasi operasional sebagai Dokter. | Read-only; Dokter tidak menggantikan catatan pelaksana. | ⬜ |
| DR-C16 | P0 | Coba memanggil API complete/finalisasi sesi sebagai Dokter. | API wajib menolak dengan `403`; finalisasi adalah tugas MSO/Admin Cabang/Nakes. | ⬜ |
| DR-C17 | P0 | Coba membatalkan completion. | Aksi tidak tersedia/API menolak dengan `403`. | ⬜ |
| DR-C18 | P1 | Refresh/kirim ulang update evaluasi identik akibat koneksi lambat. | Tidak terbentuk dua evaluasi untuk satu sesi. | ⬜ |

> **Gate role wajib:** `DR-C16` harus diuji lewat API langsung. Menyembunyikan
> tombol finalisasi saja belum cukup. Jika Dokter berhasil mem-posting sesi,
> catat defect P0.

## 10. Test Case D — Kinerja Staff

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| DR-D01 | P0 | Buka Kinerja Staff. | Ringkasan tampil untuk cabang yang ditugaskan kepada Dokter. | ⬜ |
| DR-D02 | P0 | Pilih cabang tambahan yang memang di-assign. | Data cabang tersebut dapat dibuka. | ⬜ |
| DR-D03 | P0 | Masukkan branch ID yang tidak di-assign. | API menolak akses. | ⬜ |
| DR-D04 | P1 | Buka detail staff dan filter tanggal. | Angka ringkasan/detail mengikuti filter yang sama. | ⬜ |
| DR-D05 | P0 | Coba memilih “Semua Cabang”. | Sistem menolak; Dokter tidak boleh melihat agregat global. | ⬜ |
| DR-D06 | P1 | Coba export rekap massal. | Tombol tidak tersedia/API menolak jika permission export tidak dimiliki. | ⬜ |

## 11. Test Case E — Reimburse pribadi

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| DR-E01 | P0 | Buat reimburse valid dengan satu foto. | Draft dibuat atas nama Dokter dan cabang yang diizinkan. | ⬜ |
| DR-E02 | P0 | Pilih transfer bank tanpa data rekening lengkap. | Sistem menolak sampai rekening lengkap. | ⬜ |
| DR-E03 | P1 | Pilih Tunai. | Draft dapat disimpan tanpa field rekening bank. | ⬜ |
| DR-E04 | P0 | Ajukan tanpa foto. | Sistem menolak karena bukti wajib. | ⬜ |
| DR-E05 | P1 | Upload lebih dari lima foto, file di atas 5 MB, atau non-image. | File tidak valid ditolak. | ⬜ |
| DR-E06 | P1 | Pakai ulang foto bukti dari pengajuan aktif lain. | Sistem menolak bukti duplikat. | ⬜ |
| DR-E07 | P0 | Ajukan draft valid. | Status Menunggu Approval dan masuk Approval Inbox approver. | ⬜ |
| DR-E08 | P0 | Coba membuka Approval Inbox atau approve sendiri. | Akses ditolak. | ⬜ |
| DR-E09 | P0 | Perbaiki pengajuan berstatus Perlu Revisi lalu ajukan ulang. | Revisi tersimpan dan histori approval tetap ada. | ⬜ |
| DR-E10 | P0 | Coba melihat/mengubah reimburse pengguna lain. | Akses dan foto bukti ditolak. | ⬜ |
| DR-E11 | P1 | Batalkan draft sendiri. | Status Dibatalkan dan tidak diproses approver. | ⬜ |
| DR-E12 | P0 | Submit dua kali akibat koneksi lambat. | Hanya satu reimburse dan satu approval instance terbentuk. | ⬜ |

Lanjutkan nomor reimburse yang sama pada flow `MFA-02` sampai `MFA-06` di
[Pusat Dokumen UAT](./README.md#flow-bersama-2--approval-dan-pembayaran-mfa).

## 12. Test Case F — Notifikasi dan Chat

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| DR-F01 | P1 | Buka notifikasi assignment dan reminder evaluasi. | Notifikasi membuka sesi yang benar. | ⬜ |
| DR-F02 | P1 | Tandai notifikasi dibaca dan refresh. | Status terbaca tetap tersimpan. | ⬜ |
| DR-F03 | P1 | Kirim pesan pada percakapan yang diizinkan. | Pesan terkirim sekali. | ⬜ |
| DR-F04 | P0 | Ganti ID percakapan ke ruang yang tidak boleh diakses. | API menolak dan isi pesan tidak bocor. | ⬜ |

## 13. Test Case G — Keamanan dan batas role

| ID | Prioritas | Lakukan | Harus Terjadi | Hasil |
|---|---|---|---|---|
| DR-G01 | P0 | Buka `/payments`, `/inventory/team`, `/inventory/homecare-bags`, `/approvals`, dan `/accounting`. | Halaman terlarang ditolak/diarahkan. | ⬜ |
| DR-G02 | P0 | Panggil API create session. | API menolak dengan `403`. | ⬜ |
| DR-G03 | P0 | Panggil API complete session. | API menolak dengan `403`. | ⬜ |
| DR-G04 | P0 | Panggil API Evaluasi Dokter sebelum ready atau pada sesi non-assigned. | API menolak dengan `409` atau `403` sesuai kondisi. | ⬜ |
| DR-G05 | P0 | Panggil API approve/pay reimbursement. | API menolak dengan `403`. | ⬜ |
| DR-G06 | P0 | Gunakan member/session/branch ID yang tidak diizinkan. | Data tidak tampil. | ⬜ |
| DR-G07 | P1 | Ubah `writtenBy`, doctor ID, status, atau branch pada request. | Server memakai identitas token atau menolak request. | ⬜ |
| DR-G08 | P1 | Buka URL foto sesi/reimburse setelah logout. | File tidak dapat diakses tanpa otorisasi. | ⬜ |
| DR-G09 | P0 | Coba membuat pinjaman/mutasi Inventori Tim lewat API. | API menolak karena fitur operasional tim tidak diberikan kepada Dokter. | ⬜ |

## 14. Template defect

```text
Test case : DR-... / TTR-...
Hasil     : FAIL / BLOCKED
Akun      : dokter...@raho.id
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
| C. Sesi dan evaluasi | 0 | 0 | 0 | 18 |
| D. Kinerja Staff | 0 | 0 | 0 | 6 |
| E. Reimburse | 0 | 0 | 0 | 12 |
| F. Notifikasi dan Chat | 0 | 0 | 0 | 4 |
| G. Keamanan | 0 | 0 | 0 | 9 |
| **Total** | **0** | **0** | **0** | **73** |

Keputusan:

- [ ] **LULUS** — seluruh P0 dan TTR PASS.
- [ ] **LULUS BERSYARAT** — hanya ada temuan nonkritis.
- [ ] **TIDAK LULUS** — ada role bypass, kebocoran data klinis, atau posting ganda.

| Persetujuan | Nama | Tanggal | Status |
|---|---|---|---|
| Perwakilan Dokter |  |  |  |
| QA/UAT |  |  |  |
| Product Owner |  |  |  |
