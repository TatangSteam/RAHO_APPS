# Menghubungkan Zoho dan mengimpor Excel

Fitur ada di **Integrasi Zoho → Koneksi / Impor Excel** (`/admin/integrations/zoho`). Input kredensial dan impor hanya untuk **Super Admin**. Tujuannya **Zoho Books**, bukan Zoho CRM atau Zoho Sheet.

## 1. Input kode API secara manual

1. Buka **Koneksi**, lalu klik **+ Input kode API Zoho**.
2. Pada Zoho API Console (`https://api-console.zoho.com/`), gunakan aplikasi OAuth server-based. Salin **Client ID** dan **Client Secret** ke kolom yang sesuai di ERP. Jangan mengirim secret melalui chat.
3. Isi **Nama API** agar koneksi mudah dikenali, misalnya `Zoho Books Botanica`.
4. **Authorized Redirect URI** diisi otomatis menggunakan alamat web saat ini, misalnya `https://erp.rahopremier.id/api/zoho/callback`. Daftarkan alamat yang **sama persis** di Zoho API Console. Jangan menggunakan localhost untuk web online.
5. Accounts URL dan API URL harus sesuai wilayah akun Zoho. Default tersedia untuk akun wilayah `.com`.
6. Klik **Simpan kode API Zoho**. Secret disimpan terenkripsi dan tidak ditampilkan kembali. Server tetap memerlukan kunci enkripsi integrasi.
7. Klik **Hubungkan / Hubungkan ulang**, login ke Zoho, lalu setujui izin. Menyimpan Client ID dan Secret saja belum menghubungkan akun.
8. Pilih **Organisasi Zoho aktif** yang benar dan gunakan tombol tes koneksi.

Untuk mengganti kredensial, tambahkan profil API baru atau pilih profil API yang sudah tersimpan, lalu hubungkan ulang organisasi yang ingin menggunakannya. Organisasi yang sudah terhubung tetap memakai profil API asal sampai diotorisasi ulang. **Tidak perlu mengganti Database aktif**: pengaturan itu memengaruhi database ERP, bukan sekadar akun Zoho.

### Setelah menekan Setujui di Zoho

1. Tunggu sampai kembali ke halaman **Integrasi Zoho Books** di ERP.
2. Baca kotak **Hasil koneksi Zoho**. Pesan kegagalan tidak hanya muncul sebagai notifikasi singkat; pesan tetap terlihat, termasuk setelah refresh untuk callback yang gagal.
3. Koneksi berhasil jika kartu menampilkan **Zoho Books terhubung** dan organisasi muncul. Tombol tidak hilang, tetapi berubah menjadi **Hubungkan ulang**. Tombol itu untuk mengulang izin, bukan tanda bahwa koneksi gagal.
4. Klik **Muat ulang status** bila tampilan belum diperbarui, lalu **Tes koneksi** jika sudah terhubung.
5. Jika pesan mengatakan penyiapan otomatis belum selesai, koneksinya tetap sudah terhubung. Klik **Siapkan otomatis**; tidak perlu mengulang login Zoho.
6. Jika masih gagal, ikuti pesan pada kotak hasil: periksa credential/data center, samakan Redirect URI, atau mulai otorisasi baru untuk kode kedaluwarsa. Jangan refresh URL callback atau menggunakan ulang kode otorisasi lama.

Status **terhubung** tidak otomatis mengaktifkan pengiriman LIVE. Mode aman dan pengaman pengiriman data tetap berlaku. Jangan membagikan Client Secret, token, atau URL callback yang berisi `code` dan `state`.

## 2. Data yang dapat diimpor

| Jenis | Kolom wajib | Kolom opsional |
|---|---|---|
| Kontak pelanggan | Nama | Email, telepon, alamat |
| Kontak vendor / supplier | Nama | Email, telepon, alamat |
| Produk tanpa stok | Nama, SKU / kode produk, harga jual, satuan | Tidak ada |

Ini menambah **master di Zoho Books saja**. Tidak membuat akun member ERP, mengubah inventory ERP, menambah stok, membuat HPP, saldo awal, invoice, pembayaran, atau sesi terapi. Produk dibuat sebagai item penjualan tanpa pengaturan tracking inventory. Impor ini **bukan solusi** untuk error Air Nano yang belum memiliki HPP.

File laporan seperti BOTANICA belum tentu bisa diunggah langsung: pilih sheet dan baris judul yang benar, lalu cocokkan kolom. Sheet laporan kas, neraca atau transaksi perlu format dan importer tersendiri; jangan memetakannya sebagai master produk/kontak. Sel yang berisi instruksi atau kolom lain tidak diperlakukan sebagai perintah.

## 3. Siapkan Excel

1. Buka **Impor Excel**, pilih jenis data, lalu klik **Unduh template Excel**.
2. Buka file template dengan Excel. Judul kolom sudah ada; isi data mulai baris kedua. Template tidak berisi data contoh yang akan terimpor tanpa sengaja.
3. Satu baris untuk satu kontak/produk. Jangan membuat nama kontak atau SKU yang sama dua kali dalam satu sheet.
4. Nomor telepon harus berupa **teks**, supaya `0812...` tidak menjadi `812...`. Template kontak sudah mengatur kolom telepon sebagai teks.
5. Harga jual harus berupa **angka Excel**, misalnya `35000`, bukan teks `Rp 35.000`. Format tampilan mata uang Excel boleh digunakan jika nilai selnya tetap angka.
6. Gunakan nilai biasa, bukan formula. Jika sumber memakai formula, salin lalu **Paste Special → Values**.
7. Simpan sebagai `.xlsx`, maksimal **5 MB**, **100 baris data per impor**, tanpa password, macro atau tautan ke workbook eksternal. Untuk data lebih banyak, pecah menjadi beberapa file.

## 4. Pilih sheet dan kolom

1. Klik **File Excel** dan pilih file.
2. Isi **Nomor baris judul kolom**. Biasanya `1`; jika judul `Nama / Email / ...` ada di baris kelima, isi `5`.
3. Klik **Baca sheet**.
4. Pilih **Sheet yang akan diimpor**. Hanya sheet tersebut yang diproses, bukan seluruh workbook.
5. Cocokkan setiap field dengan kolom Excel. Nama kolom umum otomatis disarankan, tetapi tetap periksa. Kolom opsional boleh dipilih **tidak dipakai**. Satu kolom tidak boleh dipakai untuk dua field.
6. Klik **Lihat pratinjau**. Sampai langkah ini belum ada data yang masuk antrean atau dikirim ke Zoho.

## 5. Periksa dan kirim

1. Periksa nama **organisasi tujuan**, isi seluruh baris, dan validasi.
2. Jika ada baris error, perbaiki Excel, pilih ulang file, baca sheet, lalu buat pratinjau lagi. Seluruh batch ditolak sampai semua baris valid; tidak ada impor sebagian secara diam-diam.
3. Pratinjau tetap bisa digunakan saat Zoho belum terhubung atau belum LIVE. Pengiriman nyata hanya tersedia saat koneksi dan worker siap, mode **LIVE**, dan perubahan master tidak sedang dibekukan. Pengaman/approval Go-live yang sudah ada tidak dilewati atau diaktifkan otomatis oleh fitur ini.
4. Centang konfirmasi bahwa data dan organisasi sudah benar, lalu klik **Kirim ke antrean Zoho**.
5. Pesan **masuk antrean** belum berarti tersimpan di Zoho. Klik **Lihat antrean impor** untuk memantau; filter **Hanya impor Excel** membantu memisahkan dari sinkronisasi biasa.
6. Buka **Detail** event untuk hasil terakhir:
   - `PENDING`: menunggu worker;
   - `PROCESSING`: sedang diproses;
   - `PROCESSED`, hasil `CREATED`: berhasil dibuat di Zoho;
   - `PROCESSED`, hasil `SKIPPED_EXISTING`: nama kontak / SKU sudah ada di Zoho; dilewati tanpa menimpa atau mengadopsi mapping ERP;
   - `FAILED` / `DEAD_LETTER`: periksa pesan error sebelum menekan **Ulang**.

Pengiriman ulang baris yang sama ke organisasi yang sama tidak membuat antrean baru. Identitas kontak memakai jenis dan nama; produk memakai SKU. Jangan mengganti nama/SKU untuk mengakali error atau membuat duplikat. Jika baris sudah diantrekan tetapi gagal, periksa event sebelumnya dan gunakan retry, bukan mengunggah berulang kali.

Pratinjau berlaku **15 menit**, terikat pada pengguna, database, organisasi dan isi data. Jika kedaluwarsa, organisasi berganti atau data berubah, buat pratinjau kembali.

## 6. Batasan

- Belum ada impor transaksi keuangan historis dari Excel.
- Tidak ada update atau penghapusan massal data Zoho melalui fitur ini.
- Nama kontak yang sama akan dilewati walaupun emailnya berbeda; periksa identitas kontak sebelum impor.
- Koneksi dan pengiriman nyata harus diuji menggunakan organisasi Zoho yang benar. Tes otomatis proyek menggunakan transport simulasi dan tidak membuktikan kredensial produksi aktif.

Referensi resmi: [OAuth Zoho Books](https://www.zoho.com/books/api/v3/oauth/), [Contacts API](https://www.zoho.com/books/api/v3/contacts/), [Items API](https://www.zoho.com/books/api/v3/items/).
