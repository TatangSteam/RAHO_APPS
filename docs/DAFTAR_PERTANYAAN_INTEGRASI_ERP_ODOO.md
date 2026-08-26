# Pertanyaan API Integrasi ERP RAHO dengan Odoo

Dokumen ini khusus untuk memastikan **API Odoo dapat dipakai oleh ERP RAHO**.
HR dapat membacakan pertanyaannya kepada vendor atau administrator Odoo dan
mencatat jawabannya. Keputusan proses bisnis dibahas pada pertemuan terpisah.

## Tujuan meeting

Pada akhir meeting, RAHO harus mendapatkan:

- akses ke Odoo testing;
- metode autentikasi API;
- dokumentasi model/endpoint;
- akun khusus integrasi;
- batas dan aturan penggunaan API;
- contoh request dan response;
- PIC teknis ketika API bermasalah.

## Kalimat pembuka untuk HR

> Kami ingin memastikan ERP RAHO dapat terhubung ke Odoo melalui API. Mohon
> bantu jawab pertanyaan teknis berikut dan berikan dokumentasi atau contoh yang
> dapat diteruskan kepada tim developer kami.

---

# 12 pertanyaan wajib tentang API

## 1. Odoo menggunakan versi, edisi, dan hosting apa?

**Mengapa ditanyakan:** Kemampuan API dapat berbeda menurut versi, Community
atau Enterprise, serta Odoo Online, Odoo.sh, atau server sendiri.

**Contoh jawaban:** `Odoo 17 Enterprise di Odoo.sh`.

**Catat:**

```text
Versi  :
Edisi  : Community / Enterprise
Hosting: Odoo Online / Odoo.sh / server sendiri
```

## 2. Apakah API eksternal diaktifkan untuk instalasi Odoo ini?

**Mengapa ditanyakan:** Tidak semua instalasi atau paket Odoo memberikan akses
API yang sama.

**Jawaban yang dibutuhkan:** `Ya` atau `Tidak`, disertai batasannya.

## 3. Metode API apa yang tersedia?

Minta vendor memilih dan menjelaskan yang digunakan:

- JSON-RPC;
- XML-RPC;
- REST API custom;
- metode lain.

**Mengapa ditanyakan:** Developer perlu mengetahui cara aplikasi mengirim dan
membaca data.

## 4. Bagaimana cara autentikasi API?

Tanyakan apakah menggunakan:

- API key;
- username dan password akun service;
- OAuth;
- token custom.

**Mengapa ditanyakan:** Developer perlu mengetahui cara login yang aman.

> Jangan meminta atau menulis password, API key, atau token di notulen. Cukup
> catat metodenya dan siapa yang akan menyerahkan credential melalui jalur aman.

## 5. Bisakah dibuat akun khusus integrasi?

**Mengapa ditanyakan:** ERP RAHO tidak boleh memakai akun pribadi atau akun
administrator utama.

**Akun yang dibutuhkan:**

- hanya dipakai ERP RAHO;
- memiliki permission minimum;
- dapat dinonaktifkan tanpa mengganggu pengguna Odoo;
- tersedia untuk testing dan production secara terpisah.

## 6. Apa alamat API testing dan production?

**Mengapa ditanyakan:** Developer membutuhkan alamat tujuan untuk pengujian dan
operasional asli.

**Catat tanpa credential:**

```text
Testing URL   :
Production URL:
Database name :
```

Jika belum ada Odoo testing, catat sebagai **blocker**. Jangan menguji create,
update, atau delete langsung di production.

## 7. Apakah koneksi membutuhkan VPN atau allowlist IP?

**Mengapa ditanyakan:** Server ERP RAHO mungkin ditolak sebelum IP atau jaringan
tertentu diizinkan.

**Catat:**

```text
VPN diperlukan       : Ya / Tidak
Allowlist IP diperlukan: Ya / Tidak
PIC konfigurasi      :
```

## 8. Model atau endpoint apa yang boleh diakses?

Minta daftar untuk kebutuhan yang akan diintegrasikan, misalnya:

- produk;
- customer dan vendor;
- gudang dan stok;
- Purchase Order;
- Vendor Bill;
- Invoice;
- pembayaran;
- jurnal.

**Mengapa ditanyakan:** Developer perlu mengetahui nama model, method, endpoint,
dan field yang benar.

**Bukti yang diminta:** Dokumentasi atau daftar model dan field, bukan hanya
penjelasan lisan.

## 9. Apakah terdapat modul atau field custom?

**Mengapa ditanyakan:** Field tambahan buatan vendor dapat membuat struktur data
Odoo berbeda dari dokumentasi standar.

**Minta vendor memberikan:**

- nama modul custom;
- nama model dan field custom;
- tipe data;
- field wajib;
- contoh nilainya.

## 10. Berapa batas penggunaan API?

Tanyakan:

- rate limit atau jumlah request yang diizinkan;
- batas jumlah record per request;
- batas ukuran payload/file;
- timeout yang disarankan;
- jadwal maintenance.

**Mengapa ditanyakan:** Agar ERP tidak mengirim terlalu banyak data dan ditolak
Odoo.

## 11. Bagaimana format response sukses dan error?

Minta contoh nyata yang sudah disamarkan untuk:

- login berhasil dan gagal;
- membaca data;
- membuat data;
- mengubah data;
- data tidak valid;
- akses ditolak;
- timeout atau server error.

**Mengapa ditanyakan:** Developer harus tahu kapan request berhasil, boleh
diulang, atau perlu diperbaiki manusia.

## 12. Siapa PIC jika API bermasalah?

**Mengapa ditanyakan:** Masalah API perlu jalur eskalasi yang jelas.

**Catat:**

```text
Nama PIC utama   :
Nama PIC cadangan:
Perusahaan/vendor:
Email/telepon    :
Jam dukungan     :
Target respons   :
```

---

# Bukti yang wajib diminta dari vendor Odoo

- [ ] Versi, edisi, dan jenis hosting Odoo.
- [ ] URL testing dan production.
- [ ] Metode autentikasi API.
- [ ] Akun khusus integrasi untuk testing.
- [ ] Dokumentasi model/endpoint dan field.
- [ ] Daftar modul atau field custom.
- [ ] Daftar permission akun integrasi.
- [ ] Informasi VPN atau allowlist IP.
- [ ] Informasi rate limit, timeout, dan maintenance.
- [ ] Contoh request dan response sukses serta gagal.
- [ ] Nama PIC teknis dan jalur eskalasi.

# Uji koneksi minimum oleh tim developer

Setelah jawaban dan akses diterima, tim developer RAHO melakukan pengujian ini
di Odoo testing:

1. Autentikasi menggunakan akun integrasi.
2. Membaca informasi user/company yang aktif.
3. Membaca satu produk.
4. Membuat satu data dummy yang disepakati.
5. Membaca kembali data dummy tersebut.
6. Mengubah data dummy tersebut.
7. Mengirim request tidak valid untuk melihat format error.
8. Mengulang request untuk memeriksa risiko data ganda.

Hasil uji dicatat seperti berikut:

```text
Tanggal pengujian :
Environment       : Testing
Versi Odoo        :
Metode API        :
Autentikasi       :
Model diuji       :
Hasil             : LULUS / GAGAL
Masalah           :
PIC tindak lanjut :
```

# Kapan API dinyatakan siap?

API belum dinyatakan siap jika salah satu kondisi berikut terjadi:

- tidak ada environment testing;
- tidak ada akun khusus integrasi;
- metode autentikasi belum jelas;
- model dan field belum didokumentasikan;
- permission belum diuji;
- contoh response error belum tersedia;
- koneksi dasar belum berhasil;
- PIC teknis belum ditentukan.

# Kamus sangat singkat untuk HR

| Istilah | Arti sederhana |
|---|---|
| API | Jalur resmi agar ERP RAHO dan Odoo dapat bertukar data |
| Endpoint | Alamat/fungsi API yang dituju |
| Model | Kelompok data di Odoo, misalnya produk atau invoice |
| Field | Kolom data, misalnya kode, nama, atau harga |
| Autentikasi | Cara sistem membuktikan bahwa ia boleh mengakses Odoo |
| API key/token | Kunci rahasia untuk mengakses API |
| Permission | Batas tindakan yang boleh dilakukan akun integrasi |
| Testing | Odoo percobaan yang terpisah dari data asli |
| Production | Odoo asli yang digunakan sehari-hari |
| Rate limit | Batas jumlah request dalam waktu tertentu |
| Payload | Data yang dikirim ke API |
| Timeout | Request dihentikan karena terlalu lama menunggu |
| Allowlist IP | Daftar alamat server yang diizinkan masuk |
| PIC | Orang yang bertanggung jawab |

# Ringkasan satu halaman untuk tim developer

```text
Versi/edisi Odoo :
Jenis hosting    :
Testing URL      :
Production URL   :
Metode API       :
Autentikasi      :
Service account  : Tersedia / Belum
VPN/allowlist IP :
Dokumentasi      :
Modul custom     :
Rate limit       :
Timeout          :
PIC teknis       :
Status API       : SIAP / BELUM SIAP
Blocker          :
```
