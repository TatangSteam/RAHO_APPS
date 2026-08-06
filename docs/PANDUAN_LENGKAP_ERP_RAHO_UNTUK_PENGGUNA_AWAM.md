# Panduan Lengkap ERP RAHO untuk Pengguna Awam

| Informasi | Keterangan |
|---|---|
| Nama sistem | ERP RAHO |
| Jenis dokumen | Guide book operasional pengguna |
| Sasaran pembaca | Pengguna yang belum terbiasa menggunakan aplikasi atau ERP |
| Versi panduan | 1.0 |
| Tanggal pembaruan | 5 Agustus 2026 |
| Cakupan | Member, paket, pembayaran, terapi, inventori, logistik, finance, approval, laporan, dan Zoho Books |

> **Tujuan panduan ini**  
> Membantu pengguna menjalankan pekerjaan di ERP RAHO dengan aman tanpa harus
> memahami istilah teknologi. Ikuti urutan langkah, baca pesan pada layar, dan
> jangan menebak bila menemukan data yang meragukan.

> **Catatan penting**  
> Tampilan menu setiap orang dapat berbeda. Sistem hanya menampilkan menu dan
> tombol sesuai peran, izin, serta cabang pengguna. Menu yang tidak terlihat
> belum tentu rusak.

## Daftar Isi Cepat

Gunakan `Ctrl + F` pada komputer lalu ketik nomor atau nama bab.

| Bagian | Isi |
|---|---|
| 1–4 | Pengenalan, keamanan, login, dan cara memakai layar |
| 5–7 | Peran, urutan setup, dan master data |
| 8–11 | Member, paket, pembayaran, diagnosis, Therapy Plan, dan sesi terapi |
| 12–16 | Inventori, request, shipment, purchasing, opname, dan Tas Homecare |
| 17–20 | Finance, Partnership, Zoho Books, portal, laporan, dan audit |
| 21–23 | Tugas per peran, kamus status, dan checklist |
| 24–27 | Troubleshooting, larangan, eskalasi, dan latihan |
| 28–30 | Glosarium, ringkasan satu halaman, dan pemeliharaan panduan |
| Lampiran A–B | Daftar menu per role dan keterbatasan versi saat ini |

---

## 1. Apa Itu ERP RAHO?

ERP RAHO adalah aplikasi utama untuk mencatat dan menghubungkan pekerjaan
klinik, member, terapi, stok, logistik, pembayaran, akuntansi, dan laporan.

Gambaran sederhananya:

```text
Member datang
  -> data member diperiksa
  -> paket Basic dipilih
  -> Booster ditambahkan bila dipakai
  -> pembayaran dicatat dan diverifikasi
  -> sesi terapi dijalankan
  -> material aktual dicatat berdasarkan jumlah
  -> sesi diselesaikan
  -> stok, omzet, jurnal, dan laporan diperbarui
  -> data bisnis yang sudah final masuk antrean Zoho Books
```

### 1.1 ERP RAHO adalah sumber data utama

Data operasional harus dibuat dan diselesaikan di ERP RAHO terlebih dahulu.
Zoho Books bukan tempat menjalankan terapi atau mengubah data operasional ERP.

Data yang menjadi milik ERP RAHO antara lain:

- member dan akun member;
- paket Basic dan Booster milik member;
- invoice dan verifikasi pembayaran;
- diagnosis, therapy plan, tanda vital, infus, evaluasi, dan sesi terapi;
- pemakaian material;
- stok, batch, expiry, reservasi, shipment, dan stock opname;
- purchasing, expense, Accounts Payable, serta jurnal lokal;
- approval, audit, dan antrean integrasi.

### 1.2 Fungsi Zoho Books

Zoho Books adalah tujuan integrasi untuk dokumen bisnis dan pencatatan eksternal,
bukan pengganti ERP RAHO. Pengiriman data berjalan satu arah dari ERP ke Zoho
Books setelah transaksi ERP valid.

Zoho Books dapat menerima, sesuai konfigurasi:

- customer/member dan vendor;
- item barang dan item layanan paket;
- invoice, pembayaran, retainer, dan pengakuan omzet;
- expense;
- Purchase Order, Bill, dan vendor payment;
- penjualan barang ke cabang Partnership;
- jurnal terkontrol.

Data klinis seperti diagnosis, hasil evaluasi, foto, dan catatan dokter tidak
dikirim ke Zoho Books.

### 1.3 Lima aturan emas

1. **Periksa cabang sebelum mengisi data.**
2. **Cari data sebelum membuat data baru.** Ini mencegah member, item, dan
   transaksi ganda.
3. **Jangan klik tombol aksi berkali-kali.** Klik sekali lalu tunggu proses
   selesai.
4. **Dokumen yang sudah posted tidak diedit langsung.** Gunakan reversal,
   refund, pembatalan, atau koreksi resmi.
5. **Jangan mengabaikan pesan merah.** Salin pesan atau ambil screenshot lalu
   ikuti bagian penanganan masalah pada panduan ini.

---

## 2. Cara Membaca Panduan Ini

Panduan menggunakan tanda berikut:

| Tanda | Arti |
|---|---|
| ✅ | Kondisi benar atau aman dilanjutkan |
| ⚠️ | Harus diperiksa sebelum melanjutkan |
| ⛔ | Jangan dilakukan |
| **Teks tebal** | Nama menu, tombol, atau bagian layar |
| `HURUF_BESAR` | Status yang disimpan sistem |
| `Menu -> Submenu` | Urutan menu yang perlu dibuka |

Contoh:

```text
Member -> pilih member -> Paket -> Assign Paket
```

Artinya buka menu **Member**, buka satu member, pilih tab **Paket**, lalu klik
**Assign Paket**.

Jika nama tombol pada layar sedikit berbeda, lihat fungsi dan statusnya. Jangan
memilih tombol hanya berdasarkan warna.

---

## 3. Persiapan Sebelum Menggunakan Aplikasi

### 3.1 Yang perlu disiapkan pengguna

- perangkat yang dapat membuka aplikasi;
- koneksi internet yang stabil;
- username atau email dari administrator;
- password pribadi;
- nama cabang tempat bekerja;
- dokumen atau bukti yang akan diunggah, bila diperlukan.

### 3.2 Keamanan akun

⛔ Jangan pernah:

- memberikan password kepada rekan kerja;
- mengirim password, OTP, atau token melalui chat;
- memakai akun orang lain;
- menyimpan password pada komputer umum tanpa izin;
- meninggalkan aplikasi dalam keadaan login di perangkat bersama;
- memasukkan data asli pada lingkungan latihan.

✅ Lakukan:

- gunakan akun sendiri;
- logout setelah selesai;
- laporkan bila akun dipakai orang lain;
- minta administrator melakukan reset password bila lupa;
- samarkan data pribadi ketika mengirim screenshot untuk bantuan.

### 3.3 Dokumen yang biasa diperlukan

| Pekerjaan | Dokumen yang mungkin diperlukan |
|---|---|
| Pendaftaran member | Identitas, data kontak, persetujuan, atau dokumen pendukung |
| Pembayaran | Bukti transfer atau bukti pembayaran lain |
| Expense | Nota, invoice, kuitansi, atau PDF pendukung |
| Goods Receipt | PO, surat jalan, batch, expiry, dan catatan kondisi barang |
| Shipment | Nomor request, daftar barang, bukti pengiriman, dan catatan penerimaan |
| Stock Opname | Hasil hitung fisik dan penjelasan selisih |

Gunakan file yang jelas, tidak terpotong, dan ukurannya sesuai batas aplikasi.

### 3.4 Kerahasiaan data

- buka data member hanya untuk pekerjaan yang menjadi tanggung jawab;
- jangan memotret layar dengan perangkat pribadi tanpa kebutuhan resmi;
- jangan mengirim diagnosis, evaluasi, identitas, atau laporan ke grup umum;
- simpan hasil export pada folder kerja yang diizinkan;
- hapus salinan lokal sesuai kebijakan retensi setelah tidak diperlukan;
- segera kunci layar bila meninggalkan perangkat.

---

## 4. Mengenal Tampilan Dasar

### 4.1 Login

1. Buka alamat aplikasi ERP RAHO.
2. Isi username/email.
3. Isi password.
4. Periksa kembali penulisan huruf besar dan kecil.
5. Klik **Masuk** satu kali.
6. Tunggu sampai dashboard terbuka.

Jika gagal login:

- periksa koneksi internet;
- periksa username/email;
- ketik ulang password secara perlahan;
- pastikan tombol `Caps Lock` tidak aktif tanpa sengaja;
- hubungi administrator bila tetap gagal.

> 📷 **Tempat screenshot guide book:** halaman Login dan contoh posisi tombol
> **Masuk**.

### 4.2 Menu samping

Pada komputer, menu utama berada di sisi kiri. Pada telepon atau layar kecil,
tekan ikon tiga garis untuk membuka menu.

Kelompok menu utama:

- **Klinik**;
- **Inventori**;
- **Komunikasi**;
- **Manajemen**;
- **Finance**;
- **Manajemen Sistem**.

Menu disesuaikan dengan peran. Jangan meminta akses tambahan hanya karena menu
rekan kerja lebih banyak; akses harus mengikuti tugas.

### 4.3 Memilih cabang

Pengguna yang menangani lebih dari satu cabang harus memeriksa cabang aktif di
bagian atas aplikasi.

Sebelum membuat transaksi, tanyakan:

- Apakah ini cabang yang benar?
- Apakah member terdaftar atau memiliki akses di cabang ini?
- Apakah stok dan rekening yang dipilih milik cabang ini?

Kesalahan cabang dapat membuat laporan, stok, dan approval masuk ke tempat yang
salah.

### 4.4 Tombol yang sering digunakan

| Tombol | Fungsi sederhana |
|---|---|
| **Tambah/Buat** | Membuka formulir data baru |
| **Simpan Draft** | Menyimpan pekerjaan yang belum final |
| **Simpan** | Menyimpan perubahan |
| **Ajukan/Submit** | Mengirim dokumen untuk diperiksa |
| **Setujui/Approve** | Menyetujui dokumen yang diajukan |
| **Tolak/Reject** | Menolak dengan alasan |
| **Posting** | Menjadikan transaksi resmi dan memperbarui ledger/jurnal |
| **Verifikasi** | Menyatakan bukti atau pembayaran valid |
| **Batalkan/Cancel** | Menghentikan dokumen sesuai aturan |
| **Reversal/Refund** | Membalik transaksi tanpa menghapus sejarah |
| **Muat Ulang** | Mengambil data terbaru dari server |
| **Export** | Mengunduh laporan/data |

⚠️ Tombol **Posting**, **Verifikasi**, **Selesaikan**, **Refund**, dan
**Reversal** mempunyai dampak besar. Periksa data sebelum menekan tombol.

### 4.5 Cara mengisi formulir

1. Baca judul formulir.
2. Isi dari atas ke bawah.
3. Pilih data dari daftar bila tersedia; jangan mengetik variasi nama baru.
4. Periksa tanggal, cabang, jumlah, dan nominal.
5. Isi alasan atau catatan dengan jelas.
6. Unggah bukti bila diminta.
7. Periksa ringkasan.
8. Klik tombol simpan satu kali.
9. Tunggu notifikasi berhasil atau pesan error.

### 4.6 Warna notifikasi

Secara umum:

- hijau berarti berhasil;
- kuning berarti perlu perhatian;
- merah berarti gagal atau ditolak;
- biru berarti informasi.

Warna membantu, tetapi isi pesannya tetap harus dibaca.

### 4.7 Mencari dan memfilter daftar

1. Ketik kata kunci pada kotak **Cari**.
2. Tunggu hasil berubah; tidak perlu menekan Enter berkali-kali.
3. Pilih cabang, tanggal, atau status bila tersedia.
4. Jika data seolah hilang, tekan **Reset Filter/Hapus Filter**.
5. Gunakan tombol halaman berikutnya bila hasil lebih dari satu halaman.

Filter hanya mengubah tampilan, bukan menghapus data.

### 4.8 Mengunggah file

1. Klik **Pilih File/Unggah**.
2. Cari file pada perangkat.
3. Pilih satu file yang benar.
4. Tunggu nama file atau preview muncul.
5. Klik **Simpan/Kirim** satu kali.

Jika unggah gagal, periksa jenis file, ukuran, koneksi, dan apakah file sedang
terbuka atau rusak. Jangan mengganti nama ekstensi file hanya agar diterima.

### 4.9 Logout

1. Klik profil atau tombol **Keluar**.
2. Tunggu sampai kembali ke halaman login.
3. Tutup browser bila menggunakan perangkat bersama.

---

## 5. Peran Pengguna dan Tanggung Jawab

| Peran | Pekerjaan utama |
|---|---|
| Super Admin | Cabang, user, role, permission, master produk, harga paket, konfigurasi sistem, audit, dan integrasi |
| Admin Manager | Pengawasan beberapa cabang, approval, laporan, finance, dan logistik sesuai scope |
| Admin Cabang | Operasional cabang, member, staf, request/penerimaan stok, kas/bank cabang, dan laporan |
| Admin Layanan | Pendaftaran member, paket, invoice/pembayaran, dokumen, dan administrasi sesi |
| Admin Logistik | Master inventori, stok, request, reservasi, shipment, receipt, adjustment, opname, dan purchasing |
| Finance & Logistics Controller | Kontrol Finance–Logistik, approval, rekonsiliasi, audit, antrean Zoho, dan go-live |
| Dokter | Diagnosis, therapy plan, keputusan klinis, dan evaluasi |
| Perawat/Nakes | Tanda vital, pelaksanaan infus, material aktual, dokumentasi, dan bantuan proses sesi |
| Member | Melihat dashboard, paket/voucher, sesi, invoice, dan profil pribadi |

> **Finance bukan base role terpisah pada sistem saat ini.** Sebutan Finance
> biasanya berasal dari template permission atau penugasan staf. Menu tetap
> mengikuti base role, permission, dan branch scope akun tersebut.

### 5.1 Mengapa menu seseorang bisa berbeda?

Akses ditentukan oleh:

- peran utama;
- template permission;
- izin khusus `ALLOW` atau `DENY`;
- cabang yang ditugaskan;
- status aktif akun.

Jika menu atau tombol tidak ada:

1. pastikan login memakai akun sendiri;
2. periksa cabang aktif;
3. muat ulang halaman;
4. bila tetap tidak ada, minta atasan atau administrator memeriksa permission;
5. jangan meminjam akun orang lain.

---

## 6. Urutan Menyiapkan ERP Sebelum Operasional

Semua master dan aturan harus disiapkan di ERP sebelum transaksi dikirim ke
Zoho Books.

```text
Cabang
  -> User, peran, permission, dan scope
  -> Kategori, UOM, dan master produk
  -> Harga paket Basic dan Booster
  -> Treatment BOM
  -> Supplier
  -> Chart of Accounts dan periode
  -> Rekening kas/bank
  -> Opening balance dan opening stock
  -> Mapping Zoho Books
  -> Uji transaksi
  -> Rekonsiliasi
  -> Operasional
```

### 6.1 Checklist kesiapan minimum

- [ ] Cabang dan tipe cabang benar: Pusat, Premier, atau Partnership.
- [ ] User aktif dan memakai peran yang tepat.
- [ ] Scope cabang setiap user sudah benar.
- [ ] Master produk memiliki nama, SKU, satuan, dan konversi yang benar.
- [ ] Harga paket Basic dan Booster aktif sesuai cabang.
- [ ] Treatment BOM aktif untuk paket yang memerlukannya.
- [ ] Stok fisik tersedia di cabang.
- [ ] Supplier aktif untuk proses purchasing.
- [ ] Chart of Accounts dan rekening kas/bank siap.
- [ ] Periode akuntansi yang dipakai berstatus `OPEN`.
- [ ] Saldo awal hanya dimasukkan sekali sesuai tanggal cutover.
- [ ] Mapping dan penanda asal data Zoho sudah diperiksa.
- [ ] Uji alur dilakukan pada data latihan sebelum produksi.

⛔ Jangan mulai operasional produksi bila master masih berubah-ubah atau saldo
awal belum disetujui.

---

## 7. Mengelola Master Data

Master data adalah daftar dasar yang dipakai berulang kali. Kesalahan master
akan berulang pada banyak transaksi.

### 7.1 Cabang

Tipe cabang:

| Tipe | Arti operasional |
|---|---|
| `PUSAT` | Kantor atau logistik pusat |
| `PREMIER` | Cabang internal RAHO |
| `PARTNERSHIP` | Mitra yang diperlakukan sebagai customer untuk penjualan barang pusat |

Sebelum menyimpan cabang, periksa kode, nama, tipe, alamat, dan status aktif.

### 7.2 User, role, permission, dan scope

- satu orang memakai satu akun pribadi;
- pilih peran sesuai pekerjaan nyata;
- berikan cabang yang memang ditangani;
- gunakan permission tambahan hanya bila disetujui;
- nonaktifkan akun staf yang sudah tidak bekerja;
- jangan menghapus audit aktivitas lama.

### 7.3 Master produk dan satuan

Menu umum: **Master Produk** atau **Master Inventori**.

Periksa:

- SKU unik;
- nama produk konsisten;
- kategori barang benar;
- satuan dasar dan satuan penggunaan;
- faktor konversi;
- kebutuhan batch atau expiry;
- status aktif.

Contoh konversi:

```text
1 box = 20 piece
```

Jika konversi salah, stok dan pemakaian dapat menjadi salah walaupun angka yang
diketik terlihat benar.

### 7.4 Harga paket

Menu: **Manajemen -> Harga Paket**.

Aturan utama:

- Basic adalah paket utama sesi;
- Booster adalah paket tambahan opsional;
- harga sesi tidak dihitung dari harga setiap material;
- perubahan harga master tidak boleh mengubah transaksi member lama yang sudah
  memiliki snapshot harga;
- aktifkan harga pada cabang yang benar.

### 7.5 Treatment BOM

Menu: **Inventori -> Treatment BOM**.

Treatment BOM adalah rekomendasi material untuk sebuah paket atau terapi.

- BOM membantu staf memilih material;
- penggunaan aktual tetap harus dicatat;
- jumlah aktual boleh berbeda bila secara klinis diperlukan;
- perbedaan material wajib disertai alasan deviasi;
- BOM tidak menentukan harga sesi;
- versi baru digunakan untuk perubahan; jangan mengubah sejarah BOM aktif lama.

### 7.6 Master Finance

Siapkan:

- Chart of Accounts;
- periode akuntansi;
- rekening kas dan bank;
- akun beban, pendapatan, deferred revenue, piutang, utang, dan persediaan;
- aturan posting serta approval.

Hanya akun aktif dan diizinkan untuk posting yang boleh dipakai.

### 7.7 Opening balance dan opening stock

Opening balance dipakai untuk memulai saldo pada tanggal cutover, bukan untuk
transaksi harian.

Alur:

```text
DRAFT -> SUBMITTED -> POSTED
                  -> REJECTED -> diperbaiki -> SUBMITTED
```

Sebelum posting:

- debit harus sama dengan kredit;
- tanggal cutover harus disetujui;
- quantity dan nilai stok harus cocok dengan sumber;
- saldo kas/bank harus direkonsiliasi;
- data historis yang sudah ada di Zoho jangan dikirim ulang sebagai transaksi
  baru.

---

## 8. Mengelola Member

Menu utama: **Klinik -> Member**.

### 8.1 Selalu cari sebelum mendaftarkan

Sebelum menekan **Tambah Member**, cari menggunakan beberapa data berikut:

- nama lengkap;
- nomor identitas;
- nomor telepon;
- tanggal lahir;
- username.

Gunakan data yang sudah ada bila orangnya sama. Jangan membuat member kedua
untuk memperbaiki salah ketik pada data pertama.

### 8.2 Mendaftarkan member baru

1. Buka **Member**.
2. Klik **Tambah Member**.
3. Isi nama minimal 3 karakter.
4. Pilih jenis identitas.
5. Jika memakai NIK, isi 16 angka.
6. Isi tanggal lahir, jenis kelamin, dan alamat.
7. Buat username sepanjang 4–30 karakter.
8. Buat password awal minimal 8 karakter dan berikan melalui jalur yang aman.
9. Isi telepon, email, referral, foto, atau dokumen persetujuan bila tersedia.
10. Periksa kembali lalu klik **Simpan** satu kali.

Sistem dapat menolak pendaftaran bila username atau identitas sudah digunakan,
atau bila kombinasi nama dan tanggal lahir sudah terdaftar. Jika itu terjadi,
cari kembali member lama dan minta administrator memperbaikinya.

> Formulir dapat menyimpan teks sebagai draft. Berkas yang belum diunggah
> biasanya harus dipilih ulang setelah halaman ditutup.

### 8.3 Bagian pada detail member

| Tab | Kegunaan |
|---|---|
| Profil | Identitas dan kontak member |
| Paket | Basic, Booster, kuota, masa berlaku, dan pembayaran |
| Diagnosis | Diagnosis yang dibuat dokter |
| Therapy Plan | Rencana terapi aktif dan riwayat versinya |
| Sesi Terapi | Jadwal, sesi berjalan, dan sesi selesai |
| Hasil Lab | Dokumen atau hasil pemeriksaan laboratorium |

### 8.4 Mengubah data member

- ubah hanya data yang memang salah atau sudah berubah;
- jangan mengganti identitas seseorang dengan identitas orang lain;
- jangan menghapus riwayat paket atau terapi untuk merapikan tampilan;
- perubahan sensitif harus dapat dijelaskan melalui Audit Log.

> **Tempat screenshot guide book:** daftar Member, kolom pencarian, tombol
> **Tambah Member**, dan tab pada detail member.

---

## 9. Paket, Invoice, dan Pembayaran Member

### 9.1 Aturan harga sesi

Aturan ini wajib dipahami semua petugas:

```text
Harga sesi = harga paket Basic
           + harga Booster bila Booster benar-benar digunakan
```

**Harga sesi bukan jumlah harga barang atau material yang dipakai.** Dokter,
nakes, dan admin layanan tidak perlu mengisi harga pokok setiap barang ketika
menjalankan terapi.

### 9.2 Member mengambil paket

Menu: **Member -> pilih member -> Paket -> Assign Paket**.

1. Pilih paket **Basic** sebagai paket utama.
2. Pastikan cabang, jumlah sesi, harga, dan masa berlaku benar.
3. Tambahkan **Booster** hanya bila memang dibeli atau akan digunakan.
4. Pilih cara pembayaran: lunas atau cicilan.
5. Periksa ringkasan.
6. Simpan untuk membuat paket dan tagihan.

Pembayaran cicilan dapat diatur 2–24 kali sesuai kebijakan yang tersedia pada
layar. Jangan membuat paket baru hanya karena cicilan belum lunas.

### 9.3 Arti status paket

| Status | Arti dan tindakan |
|---|---|
| `PENDING_PAYMENT` | Menunggu pembayaran atau bukti yang benar |
| `WAITING_VERIFICATION` | Bukti sudah diunggah dan menunggu pemeriksaan |
| `ACTIVE` | Pembayaran yang disyaratkan sudah diverifikasi; paket dapat digunakan |
| `EXPIRED` | Masa berlaku berakhir |
| `CANCELLED` | Paket dibatalkan sesuai kewenangan |

### 9.4 Mencatat dan memverifikasi pembayaran

Alur normal:

```text
Invoice dibuat
  -> pembayaran dicatat
  -> bukti pembayaran diunggah
  -> status menunggu verifikasi
  -> petugas berwenang memeriksa
  -> VERIFIKASI atau TOLAK dengan alasan
```

Pemeriksa wajib mencocokkan:

- nama member dan nomor invoice;
- rekening tujuan;
- tanggal pembayaran;
- nominal pada bukti;
- sisa tagihan;
- apakah bukti sudah pernah dipakai.

Jika bukti ditolak, transaksi kembali menunggu perbaikan. Pembayaran yang
ditolak tidak membuat jurnal penerimaan kas dan tidak dikirim sebagai pembayaran
ke Zoho Books.

Pembayaran sebagian mengurangi sisa tagihan, tetapi invoice belum dianggap
lunas sampai kewajiban yang disyaratkan terpenuhi.

### 9.5 Arti uang paket bagi Finance

Ketika pembayaran paket diverifikasi, uang belum langsung seluruhnya menjadi
omzet sesi.

```text
Debit  Kas/Bank
Kredit Pendapatan Ditangguhkan
```

Omzet Basic dan Booster baru diakui sesuai pemakaian saat sesi selesai.

### 9.6 Koreksi pembayaran atau paket

- paket belum dibayar dapat dibatalkan sesuai izin;
- paket aktif yang perlu pengembalian dana harus memakai proses refund;
- transaksi terposting jangan dihapus;
- paket yang sudah dipakai jangan diedit untuk mengubah sejarah;
- sertakan alasan dan bukti pada setiap koreksi.

> **Tempat screenshot guide book:** form Assign Paket, ringkasan invoice,
> unggah bukti pembayaran, dan tombol **Verifikasi/Tolak**.

---

## 10. Diagnosis dan Therapy Plan

### 10.1 Diagnosis

Sebelum sesi dibuat, member harus memiliki diagnosis yang sesuai.

1. Buka detail member.
2. Pilih tab **Diagnosis**.
3. Dokter membuat atau memperbarui diagnosis sesuai kewenangan.
4. Simpan dan pastikan diagnosis muncul pada daftar.

Diagnosis adalah data klinis dan tidak dikirim ke Zoho Books.

### 10.2 Therapy Plan

1. Buka tab **Therapy Plan**.
2. Klik **Buat Set**.
3. Pilih IFA 250 atau IFA 500 sesuai keputusan klinis.
4. Isi dosis. Setiap plan harus memiliki minimal satu dosis positif.
5. Simpan dan pastikan plan berstatus aktif.

Satu Therapy Plan hanya dapat dipakai satu kali. Bila sudah digunakan atau telah
digantikan versi baru, pilih atau buat plan aktif lain. Langkah Therapy Plan di
dalam sesi adalah pemeriksaan acuan, bukan tempat normal membuat plan baru.

---

## 11. Menjalankan Sesi Terapi

### 11.1 Pemeriksaan sebelum membuat sesi

Pastikan:

- member dan paket berada pada cabang yang sama;
- paket Basic masih memiliki kuota;
- Booster, bila digunakan, aktif dan masih memiliki kuota;
- diagnosis tersedia;
- Therapy Plan aktif dan belum digunakan;
- dokter, nakes, dan admin yang dipilih sesuai;
- komponen infus dan material wajib tersedia secara fisik;
- pembayaran atau cicilan pertama telah diverifikasi bila disyaratkan.

Basic dapat memiliki pemakaian utang secara terbatas sesuai aturan sistem,
dengan batas maksimal dua sesi outstanding. Booster tidak dapat dipakai sebagai
utang. Jika batas tercapai, selesaikan verifikasi pembayaran terlebih dahulu.

### 11.2 Membuat sesi

Menu umum: **Member -> detail member -> Sesi Terapi -> Buat Sesi Baru**.

1. Pilih cabang dan jadwal.
2. Pilih paket Basic.
3. Aktifkan dan pilih Booster hanya bila digunakan.
4. Pilih diagnosis dan Therapy Plan aktif.
5. Pilih petugas sesuai form.
6. Periksa ringkasan lalu simpan.

Saat sesi dibuat, kuota Basic dan Booster yang dipilih dicadangkan. Bila sesi
yang belum selesai dihapus secara sah, kuota tersebut dikembalikan.

### 11.3 Sembilan langkah sesi

| No. | Langkah | Wajib? | Diisi oleh/fungsi |
|---:|---|:---:|---|
| 1 | Diagnosis | Ya | Memastikan acuan diagnosis |
| 2 | Therapy Plan | Ya | Memastikan rencana aktif |
| 3 | Vital sebelum | Ya | Kondisi awal member |
| 4 | Infus aktual | Ya | Tindakan infus yang benar-benar dilakukan |
| 5 | Material Usage | Ya | Jumlah material yang benar-benar dipakai |
| 6 | Upload foto | Tidak | Dokumentasi bila diperlukan |
| 7 | Vital sesudah | Ya | Kondisi setelah tindakan |
| 8 | Keluhan dan rekomendasi | Tidak | Catatan tambahan |
| 9 | Evaluasi dokter/SOAP | Ya | Minimal satu bagian evaluasi terisi |

Tombol **Selesaikan Sesi** muncul atau dapat digunakan setelah semua langkah
wajib lengkap.

### 11.4 Mengisi material terapi

Material Usage dapat memuat:

- komponen kit;
- rekomendasi Treatment BOM Basic;
- rekomendasi Treatment BOM Booster bila Booster digunakan;
- material lain yang benar-benar dipakai.

Isi **jumlah aktual**, bukan harga per barang. Bila jumlah berbeda dari
rekomendasi atau menggunakan material di luar rekomendasi, pilih alasan deviasi.
Jika memilih alasan lain/`OTHER`, isi catatan yang jelas.

### 11.5 Harga pokok FIFO tidak boleh menghambat terapi

Untuk pemakaian material pada sesi:

- harga FIFO per barang tidak wajib diisi oleh petugas terapi;
- barang tanpa nilai FIFO tetap boleh dikurangi kuantitasnya;
- sistem dapat menandai nilainya untuk rekonsiliasi Finance di belakang layar;
- yang wajib tersedia adalah **jumlah stok fisik**;
- nilai sesi tetap berasal dari **Basic + Booster opsional**.

Dengan implementasi saat ini, pesan seperti berikut tidak seharusnya muncul lagi
ketika menyimpan evaluasi atau menyelesaikan sesi:

```text
Barang belum memiliki harga pokok FIFO
```

Jika pesan lama tersebut masih muncul, jangan mengisi harga pokok secara asal.
Ambil screenshot, catat nomor sesi, waktu, cabang, serta barang yang disebut,
lalu laporkan sebagai indikasi versi aplikasi lama atau service yang belum
diperbarui.

### 11.6 Bedakan Simpan Evaluasi dan Selesaikan Sesi

| Tombol | Apa yang dilakukan | Apa yang tidak dilakukan |
|---|---|---|
| **Simpan Evaluasi** | Menyimpan SOAP/evaluasi dokter | Tidak memeriksa FIFO, tidak mengurangi stok, dan tidak memposting omzet/jurnal |
| **Selesaikan Sesi** | Memeriksa seluruh langkah, mengonsumsi kuantitas material, memakai kuota, mengakui pendapatan paket, dan membuat event integrasi | Tidak menghitung harga sesi dari material |

Error FIFO tidak semestinya terjadi saat **Simpan Evaluasi**. Hambatan yang
masih mungkin pada evaluasi adalah evaluasi kosong, sesi tidak ditemukan, atau
evaluasi sudah ada sehingga harus memakai tindakan edit.

### 11.7 Apa yang diperiksa saat Selesaikan Sesi

Sistem masih dapat menolak penyelesaian bila:

- langkah wajib belum lengkap;
- material wajib belum dicatat;
- stok fisik tidak cukup;
- alasan deviasi belum diisi;
- kontrak pendapatan ditangguhkan belum tersedia;
- saldo pendapatan ditangguhkan paket tidak cukup;
- tanggal berada pada periode akuntansi yang ditutup.

Tiga kondisi Finance terakhir terjadi pada **Selesaikan Sesi**, bukan pada
**Simpan Evaluasi**. Bila terjadi, pelayanan klinis jangan diulang atau dibuat
sebagai sesi baru. Hubungi Finance untuk memperbaiki pendanaan/periode, lalu
coba selesaikan sesi yang sama.

> Saat penyelesaian gagal, posting akhir dibatalkan sebagai satu kesatuan. Setelah
> penyebab diperbaiki, klik **Selesaikan Sesi** pada sesi yang sama satu kali.

### 11.8 Setelah sesi selesai

Sistem akan:

- mengubah sesi menjadi `COMPLETED`;
- mengubah Material Usage dari `DRAFT` menjadi `CONSUMED`;
- mengurangi kuantitas stok aktual;
- memakai kuota Basic dan Booster yang dipilih;
- mengakui omzet Basic dan Booster yang digunakan;
- mengurangi pendapatan ditangguhkan;
- mencatat jurnal lokal;
- membuat event antrean Zoho Books.

Jika biaya material tersedia, sistem dapat membuat nilai HPP/persediaan. Bila
biaya belum tersedia, kuantitas tetap dapat diproses dan valuasinya ditangani
Finance/Logistik tanpa mengganggu sesi.

### 11.9 Pembatalan dan reversal sesi

- sesi belum selesai dapat dihapus hanya oleh petugas berwenang;
- penghapusan sesi belum selesai mengembalikan kuota yang dicadangkan;
- sesi `COMPLETED` tidak boleh dihapus;
- gunakan **Batalkan Penyelesaian/Reversal** untuk sesi yang sudah selesai;
- tulis alasan dan periksa bahwa stok, kuota, deferred revenue, dan jurnal
  benar-benar kembali.

Untuk reversal sesi yang memakai Basic dan Booster sekaligus, sistem
mengembalikan kuota kedua paket. Tetap periksa hasil reversal melalui riwayat
paket dan jangan mengubah kuota secara manual.

> **Tempat screenshot guide book:** halaman sesi, indikator 9 langkah, form
> Material Usage, tombol **Simpan Evaluasi**, dan tombol **Selesaikan Sesi**.

---

## 12. Dasar Inventori dan Logistik

### 12.1 Istilah stok yang perlu dipahami

| Istilah | Arti sederhana |
|---|---|
| On hand | Jumlah fisik yang tercatat berada di lokasi |
| Reserved | Jumlah yang sudah dialokasikan untuk kebutuhan tertentu |
| Quarantine | Barang ditahan karena rusak, salah, atau perlu pemeriksaan |
| Available | Jumlah yang masih boleh digunakan: on hand dikurangi reserved dan quarantine |
| Batch | Kelompok produksi barang |
| Expiry | Tanggal kedaluwarsa |
| Bin/rak | Posisi penyimpanan fisik |
| Ledger stok | Riwayat resmi setiap penambahan dan pengurangan |
| Cost layer/FIFO | Lapisan nilai barang untuk Finance, bukan input petugas terapi |

### 12.2 Menu inventori

| Menu | Kegunaan |
|---|---|
| Master Inventori | Produk, satuan/UOM, konversi, batch, dan expiry |
| Master Produk | Katalog global, penempatan produk, batas minimum, dan stok lintas cabang |
| Dashboard Logistik | Ringkasan arus barang dan pekerjaan yang perlu perhatian |
| Stok | Melihat saldo stok per cabang |
| Ledger Stok | Melihat riwayat posting, valuasi, dan reversal |
| Mutasi Stok | Menelusuri perpindahan barang |
| Request Stok | Permintaan barang dari cabang |
| Reservasi Stok | Alokasi barang untuk request yang disetujui |
| Pengiriman | Persiapan, pengiriman, dan penerimaan barang |
| Goods Receipt | Penerimaan barang dari supplier berdasarkan PO |
| Adjustment & Opname | Koreksi dan pencocokan hitung fisik |
| Stock Opname | Ringkasan dan approval dokumen opname |
| Treatment BOM | Rekomendasi material per terapi/paket |
| Riwayat Penggunaan Barang | Material yang telah digunakan pada sesi |
| Tas Homecare | Stok yang dibawa tim layanan luar klinik |
| Laporan Pengiriman | Rekap shipment internal dan Partnership |

> **Inventori Tim** pada versi saat panduan ini dibuat masih berstatus
> **Coming Soon**. Gunakan menu inventori operasional lain yang sudah aktif.

### 12.3 Aturan aman stok

1. Jangan mengubah angka stok langsung untuk menyamakan dengan fisik.
2. Penerimaan supplier harus melalui Goods Receipt.
3. Perpindahan antarlokasi harus melalui request/shipment/receipt yang benar.
4. Selisih harus memakai Adjustment atau Stock Opname dengan alasan.
5. Gunakan batch yang benar dan utamakan expiry terdekat sesuai aturan.
6. Jangan memakai barang quarantine atau kedaluwarsa.
7. Jangan menghapus ledger; gunakan reversal.

---

## 13. Request, Reservasi, Pengiriman, dan Penerimaan Stok

### 13.1 Alur umum

```text
Cabang membuat Request Stok
  -> reviewer memeriksa
  -> disetujui penuh/sebagian atau ditolak
  -> stok yang disetujui direservasi
  -> pembayaran bila berlaku
  -> shipment disiapkan
  -> barang dikirim
  -> cabang mencatat penerimaan aktual
  -> selesai atau diselesaikan sebagai bermasalah
```

Sistem dapat menolak request baru jika request atau pengiriman sebelumnya masih
belum selesai. Selesaikan dokumen lama lebih dahulu, jangan membuat permintaan
pengganti untuk barang yang sama.

### 13.2 Membuat Request Stok

1. Buka **Inventori -> Request Stok**.
2. Pilih cabang tujuan yang benar.
3. Tambahkan produk dan jumlah yang dibutuhkan.
4. Periksa satuan.
5. Isi alasan kebutuhan dan tanggal bila diminta.
6. Simpan/ajukan.

Status yang mungkin terlihat:

| Status | Arti |
|---|---|
| `PENDING` | Menunggu pemeriksaan |
| `PARTIALLY_APPROVED` | Hanya sebagian jumlah disetujui |
| `APPROVED` | Jumlah disetujui |
| `WAITING_PAYMENT` | Menunggu pembayaran bila transaksi mewajibkan |
| `PAYMENT_UPLOADED` | Bukti sudah diunggah |
| `PAYMENT_CONFIRMED` | Pembayaran disetujui |
| `REJECTED` | Ditolak; baca alasannya |
| `SHIPPED` | Barang telah dikirim |
| `COMPLETED` | Diterima dan selesai tanpa masalah |
| `COMPLETED_WITH_ISSUE` | Selesai dengan selisih/masalah yang tercatat |
| `RESERVATION_RELEASED` | Alokasi stok dilepas |

### 13.3 Review dan reservasi

Reviewer harus memeriksa:

- kebutuhan cabang;
- saldo available sumber;
- jumlah yang masih dalam perjalanan;
- batch dan expiry;
- request lain yang sudah disetujui;
- harga dan pembayaran khusus Partnership.

Persetujuan tidak selalu harus penuh. Gunakan persetujuan sebagian bila stok
tidak cukup, dan tulis alasan. Reservasi mencegah jumlah yang sama dijanjikan ke
dua request.

### 13.4 Menyiapkan dan mengirim shipment

1. Buka request yang telah siap.
2. Buat atau buka shipment `PREPARING`.
3. Cocokkan produk, batch, expiry, dan jumlah fisik.
4. Periksa alamat dan cabang tujuan.
5. Tambahkan bukti/nomor pengiriman bila diminta.
6. Klik **Kirim/SHIPPED** satu kali setelah barang benar-benar diserahkan.

Jangan menandai `SHIPPED` saat barang masih berada di gudang.

### 13.5 Menerima barang

Cabang penerima mencatat keadaan sebenarnya, bukan menyalin jumlah surat jalan.

1. Buka shipment yang diterima.
2. Hitung fisik setiap produk.
3. Periksa batch, expiry, dan kondisi.
4. Isi jumlah diterima aktual.
5. Catat kurang, lebih, salah barang, atau rusak.
6. Unggah bukti bila diperlukan.
7. Simpan penerimaan.

Barang bermasalah dapat masuk quarantine. Discrepancy diselesaikan dengan
keputusan yang sah: release, retur, write-off, atau keputusan tanpa perubahan
stok. Jangan menutup masalah tanpa catatan.

### 13.6 Transfer internal dan Partnership berbeda

| Jenis tujuan | Perlakuan |
|---|---|
| Pusat/Premier internal | Transfer persediaan; bukan omzet |
| Partnership | Penjualan barang kepada customer Partnership |

Jurnal ringkas transfer internal:

```text
Saat dikirim:
Debit  Persediaan Dalam Perjalanan
Kredit Persediaan Sumber

Saat diterima:
Debit  Persediaan Tujuan
Kredit Persediaan Dalam Perjalanan
```

> **Tempat screenshot guide book:** daftar Request Stok, halaman review,
> Reservasi, form Shipment, dan form Penerimaan/Discrepancy.

---

## 14. Purchasing dan Accounts Payable

Menu: **Finance -> Purchasing & AP**.

### 14.1 Alur pembelian supplier

```text
Supplier aktif
  -> Purchase Request (PR)
  -> persetujuan
  -> Purchase Order (PO) ISSUED
  -> Goods Receipt
  -> Supplier Invoice/Bill
  -> pembayaran supplier
```

### 14.2 Supplier

Sebelum membeli, pastikan supplier aktif dan datanya benar:

- nama resmi;
- kontak dan alamat;
- data pajak bila diperlukan;
- rekening pembayaran;
- kode atau external key unik;
- penanda asal/mapping Zoho.

Cari supplier dahulu untuk mencegah data ganda.

### 14.3 Purchase Request

```text
DRAFT -> SUBMITTED -> APPROVED -> CONVERTED
                   -> REJECTED
```

PR menjelaskan kebutuhan internal. PR belum menjadi pesanan ke supplier dan
tidak dikirim ke Zoho Books.

Pembuat mengisi produk, jumlah, cabang/lokasi, kebutuhan, dan bukti pendukung.
Penyetuju memeriksa kebutuhan, anggaran, stok yang ada, dan wewenang nominal.

### 14.4 Purchase Order

Setelah PR disetujui, buat PO dan periksa supplier, produk, harga, pajak, lokasi,
serta syarat pembayaran. Status `ISSUED` berarti pesanan resmi dan dapat masuk
antrean Zoho Books.

PO hanya boleh dibatalkan sebelum ada penerimaan atau Bill. Pembatalan dilakukan
dengan status pembatalan, bukan menghapus dokumen.

### 14.5 Goods Receipt

Goods Receipt mencatat barang yang benar-benar tiba.

1. Pilih PO.
2. Isi tanggal terima.
3. Hitung quantity aktual.
4. Isi batch dan expiry untuk barang yang dilacak.
5. Catat kondisi baik/rusak/salah.
6. Simpan penerimaan sebagian atau final.

Goods Receipt menambah kuantitas dan lapisan nilai stok ERP.

```text
Debit  Persediaan
Kredit GRNI
```

### 14.6 Supplier Invoice/Bill

Supplier Invoice hanya boleh menagih barang yang sudah diterima dan belum pernah
ditagihkan. Cocokkan tiga dokumen:

```text
PO <-> Goods Receipt <-> Invoice supplier
```

Posting lokal:

```text
Debit  GRNI
Kredit Utang Usaha
```

Dokumen ini dikirim ke Zoho Books sebagai Bill setelah final.

### 14.7 Pembayaran supplier dan refund

Periksa supplier, Bill, rekening sumber, tanggal, nominal, dan bukti. Pembayaran
yang diposting mengurangi utang:

```text
Debit  Utang Usaha
Kredit Kas/Bank
```

Jika pembayaran perlu dikembalikan, gunakan refund/reversal yang menunjuk
pembayaran asli. Jangan menghapus pembayaran supplier yang sudah posted.

> **Tempat screenshot guide book:** tab Supplier, PR, PO, Goods Receipt,
> Supplier Invoice/Bill, dan Supplier Payment.

---

## 15. Adjustment dan Stock Opname

Gunakan koreksi resmi bila stok sistem berbeda dengan stok fisik. Jangan
mengubah saldo langsung dan jangan membuat transaksi terapi palsu.

### 15.1 Adjustment

Adjustment digunakan untuk koreksi yang penyebabnya sudah diketahui, misalnya
barang rusak, kehilangan yang disetujui, atau koreksi pencatatan.

```text
DRAFT
  -> PENDING_APPROVAL
  -> APPROVED
  -> POSTED
```

Dokumen juga dapat menjadi `REJECTED`, `CANCELLED`, atau dikembalikan untuk
perbaikan sesuai izin.

Langkah umum:

1. Buka **Adjustment & Opname**.
2. Pilih cabang dan lokasi.
3. Pilih produk, batch, serta arah koreksi.
4. Isi jumlah dan reason code.
5. Lampirkan bukti bila diwajibkan.
6. Ajukan.
7. Penyetuju yang berbeda memeriksa.
8. Posting setelah disetujui.

### 15.2 Stock Opname

Stock opname digunakan untuk mencocokkan seluruh atau sebagian stok sistem
dengan hasil hitung fisik.

```text
DRAFT -> COUNTING -> SUBMITTED/PENDING_APPROVAL -> APPROVED -> POSTED
                                                   -> REJECTED
```

Saat menghitung:

- jangan melihat angka sistem bila prosedur meminta blind count;
- hitung per lokasi, produk, batch, dan expiry;
- tandai barang rusak atau kedaluwarsa;
- jangan memindahkan barang saat hitung berlangsung;
- lakukan hitung ulang untuk selisih besar;
- sertakan penjelasan dan bukti.

### 15.3 Maker-checker

Pembuat dokumen normalnya tidak boleh menyetujui dokumennya sendiri. Prinsip ini
mengurangi kesalahan dan penyalahgunaan. Jika tombol approval tidak muncul,
periksa role, permission, branch scope, dan ambang nominal—jangan meminjam akun
penyetuju.

### 15.4 Kapan nilai barang tetap diperlukan?

| Kegiatan | Apakah nilai/HPP diperlukan? |
|---|---|
| Pemakaian material terapi | Tidak boleh menghambat; quantity fisik yang utama |
| Adjustment masuk/keluar terposting | Ya, untuk valuasi dan jurnal yang benar |
| Opening stock | Ya |
| Goods Receipt | Ya, berasal dari pembelian |
| Penjualan barang Partnership | Ya, untuk HPP penjualan barang |

Perbedaan ini penting: kebijakan **tidak wajib FIFO** hanya melindungi alur sesi
terapi. Kebijakan tersebut bukan izin membuat nilai inventori Finance menjadi
sembarang.

---

## 16. Tas Homecare

Tas Homecare adalah lokasi stok bergerak yang dibawa tim saat pelayanan di luar
klinik. Isi tas tetap harus dapat ditelusuri.

Alur umum:

```text
Tas/tim disiapkan
  -> kebutuhan diajukan
  -> stok diisi atau dikirim ke tas
  -> material dipakai di lapangan
  -> sisa dikembalikan
  -> tas dihitung/opname
  -> selisih diselesaikan resmi
```

Aturan:

- satu tas harus memiliki penanggung jawab;
- setiap pengisian dan pengeluaran harus tercatat;
- batch dan expiry tetap diperiksa;
- penggunaan di sesi dicatat pada sesi yang benar;
- stok tidak boleh dibiarkan menggantung pada tas staf yang sudah tidak aktif;
- lakukan opname berkala dan saat pergantian penanggung jawab.

---

## 17. Finance dan Accounting

Finance di ERP bukan hanya laporan. Finance menerima hasil transaksi operasional,
memeriksa bukti, menjaga periode, dan memastikan jurnal seimbang.

### 17.1 Menu Finance

| Menu | Kegunaan |
|---|---|
| Accounting | Chart of Accounts, periode, jurnal manual, dan reversal |
| Finance Reports | P&L, Trial Balance, General Ledger, Kas/Bank, deferred revenue, dan rekonsiliasi |
| Kas & Bank | Master rekening dan arus penerimaan/pengeluaran |
| Opening Balance | Saldo awal pada saat cutover |
| Expense | Beban operasional dan pembayarannya |
| Purchasing & AP | Supplier, PR, PO, receipt, Bill, dan pembayaran supplier |
| Deferred Revenue | Uang paket yang belum diakui sebagai omzet |
| Approval Inbox | Dokumen lintas modul yang menunggu keputusan |

### 17.2 Periode akuntansi

| Status | Arti |
|---|---|
| `OPEN` | Transaksi yang sah dapat diposting pada tanggal tersebut |
| `CLOSED` | Posting normal tidak boleh dilakukan |
| `LOCKED` | Dikunci lebih ketat dan hanya dapat ditangani dengan kewenangan khusus |

Jangan membuka periode lama hanya agar error hilang. Periksa tanggal transaksi,
alasan koreksi, dan persetujuan Finance terlebih dahulu.

### 17.3 Chart of Accounts dan jurnal

Jurnal hanya boleh diposting bila:

- total debit sama dengan total kredit;
- akun aktif dan boleh menerima posting;
- cabang benar;
- tanggal berada pada periode `OPEN`;
- deskripsi dan referensi dapat ditelusuri;
- bukti tersedia bila diwajibkan.

Jurnal otomatis berasal dari transaksi operasional. Jurnal manual dipakai hanya
untuk kebutuhan yang benar-benar tidak memiliki alur modul. Jangan memakai jurnal
manual untuk menutupi kesalahan invoice, pembayaran, stok, atau supplier.

### 17.4 Kas dan bank

Setiap rekening harus memiliki nama, jenis, cabang, mata uang, serta akun GL yang
benar. Saat memilih rekening pada pembayaran, periksa pemilik dan cabangnya.

Lakukan rekonsiliasi rutin:

```text
Saldo ERP
  dibandingkan dengan mutasi bank/kas nyata
  -> tandai transaksi belum cocok
  -> cari penyebab
  -> koreksi melalui alur sumber
```

### 17.5 Expense

```text
DRAFT -> SUBMITTED -> APPROVED -> PAID
                   -> REJECTED
```

Pembuat mengisi tanggal, cabang, jenis beban, nilai, penerima, rekening, dan
bukti. Penyetuju memeriksa keperluan, anggaran, bukti, duplikasi, serta ambang
otorisasi.

Saat `PAID`:

```text
Debit  Beban
Kredit Kas/Bank
```

Expense yang sudah dibayar dapat masuk antrean Zoho Books. Koreksi memakai
reversal, bukan penghapusan.

### 17.6 Deferred Revenue

Deferred Revenue adalah uang paket yang telah diterima, tetapi belum menjadi
omzet karena sesi belum dilaksanakan.

```text
Pembayaran diverifikasi:
Debit  Kas/Bank
Kredit Pendapatan Ditangguhkan

Sesi selesai:
Debit  Pendapatan Ditangguhkan
Kredit Pendapatan Sesi Basic
Kredit Pendapatan Sesi Booster, bila digunakan
```

Finance perlu memeriksa kesesuaian antara:

- paket dan kuota;
- pembayaran yang sudah verified;
- saldo deferred per paket;
- sesi yang selesai atau direversal;
- omzet yang diakui.

### 17.7 Approval Inbox

Approval Inbox menyatukan dokumen yang menunggu keputusan sesuai role, cabang,
tahap, dan nominal. Untuk setiap approval:

1. buka detail, jangan menyetujui hanya dari judul;
2. periksa pembuat dan cabang;
3. periksa nilai, quantity, rekening, serta bukti;
4. periksa apakah ada transaksi serupa;
5. pilih **Approve** atau **Reject**;
6. tulis alasan yang dapat dipahami.

### 17.8 Laporan Finance

| Laporan | Pertanyaan yang dijawab |
|---|---|
| Profit & Loss | Berapa pendapatan dan beban pada periode ini? |
| Trial Balance | Apakah saldo debit dan kredit seimbang? |
| General Ledger | Transaksi apa yang membentuk saldo suatu akun? |
| Kas & Bank | Dari mana uang masuk dan ke mana uang keluar? |
| Deferred Revenue | Berapa uang paket yang belum menjadi omzet? |
| AR/Invoice | Tagihan member/customer mana yang belum selesai? |
| AP | Tagihan supplier mana yang belum dibayar? |
| Reconciliation | Data mana yang tidak cocok antarledger atau dengan Zoho? |

Selalu periksa cabang, rentang tanggal, status posting, dan zona waktu sebelum
mengekspor laporan.

### 17.9 Aturan koreksi Finance

- invoice final dibatalkan/di-void sesuai alur;
- pembayaran salah direfund atau direversal;
- jurnal posted dibalik dengan reversal;
- Bill/PO dibatalkan sesuai status yang diizinkan;
- perbaiki transaksi sumber, bukan hanya angka laporan;
- jangan menghapus audit atau external key.

> **Tempat screenshot guide book:** Accounting Period, Journal, Kas & Bank,
> Expense, Deferred Revenue, Approval Inbox, dan filter Finance Reports.

---

## 18. Operasional Cabang Partnership

Cabang Partnership diperlakukan sebagai customer untuk barang yang dikirim dari
pusat. Ini berbeda dengan perpindahan stok ke cabang internal Pusat/Premier.

### 18.1 Alur penjualan barang Partnership

```text
Partnership membuat Stock Request
  -> jumlah dan harga direview
  -> invoice/pembayaran atau customer advance bila berlaku
  -> shipment disiapkan
  -> status SHIPPED
  -> penjualan barang dan HPP dicatat
  -> invoice dikirim ke Zoho Books
```

Omzet barang Partnership muncul saat shipment benar-benar `SHIPPED`, bukan saat
request dibuat. Pembayaran sebelum shipment diperlakukan sebagai uang muka
customer.

### 18.2 Terapi pada Partnership

- sesi terapi tetap dicatat lengkap di ERP;
- harga sesi tetap Basic + Booster bila digunakan;
- pemakaian material tetap dicatat berdasarkan quantity;
- sesi Partnership tidak boleh membuat omzet/HPP terapi kedua kali di Zoho
  pusat;
- stok pusat sudah berkurang dan HPP penjualan barang sudah dicatat saat barang
  dikirim kepada Partnership.

Aturan ini mencegah pendapatan dan HPP dihitung dua kali.

### 18.3 Pemisahan tugas

Petugas yang mengunggah bukti pembayaran Partnership tidak boleh sekaligus
memverifikasi bukti yang sama. Controller tetap mengikuti maker-checker dan
branch scope.

---

## 19. Integrasi ERP ke Zoho Books

### 19.1 Prinsip satu arah

```text
Setup dan transaksi dibuat di ERP
  -> divalidasi dan difinalisasi di ERP
  -> masuk antrean integrasi
  -> dikirim ke Zoho Books
  -> hasil dipantau dan direkonsiliasi
```

Tidak ada alur bisnis yang menarik master atau transaksi Zoho untuk dijadikan
data baru di ERP. Pembacaan Zoho hanya boleh untuk:

- menemukan organization dan konfigurasi;
- mencocokkan ID secara tepat;
- mendeteksi nomor atau data yang bertabrakan;
- menampilkan bukti rekonsiliasi.

Zoho Books tidak digunakan untuk diagnosis, evaluasi, kuota paket, batch,
expiry, rak, reservasi, atau detail operasional terapi.

### 19.2 Data yang harus siap lebih dahulu di ERP

Urutan dependensi yang aman:

```text
Cabang dan user
  -> COA, pajak, metode pembayaran, serta kas/bank
  -> UOM dan lokasi stok
  -> customer/member, supplier, dan Partnership
  -> produk barang dan item layanan paket
  -> invoice/retainer/PO
  -> pembayaran/Bill/vendor payment
  -> rekonsiliasi
```

Jangan mengaktifkan LIVE selama master ERP masih sering berubah atau mapping
masih berstatus perlu review.

### 19.3 Penanda asal data

Setiap record yang dibuat ERP menggunakan external key, contohnya:

```text
RAHO:INVOICE:<id>
RAHO:PO:<id>
RAHO:EXPENSE:<id>
```

Dokumen di Zoho juga diberi marker:

```text
[RAHO ERP] <external-key>
```

Label asal dan pengelolaan:

| Label | Arti |
|---|---|
| `DARI ERP` | Dibuat dan dikelola oleh ERP RAHO |
| `INPUT MANUAL ZOHO` | Dibuat langsung oleh pengguna di Zoho |
| `ASAL BELUM DIVERIFIKASI` | Asalnya belum dapat dipastikan; perlu review |
| `ERP_MANAGED` | Worker ERP boleh memperbarui mapping ini |
| `MANUAL_ONLY` | ERP tidak boleh menimpa data manual tersebut |
| `REVIEW_REQUIRED` | Pengiriman ditahan sampai diperiksa |

Pengguna Zoho tidak boleh memakai awalan `RAHO:` untuk dokumen manual.

### 19.4 Benturan atau overlap data

Jika ERP menemukan nomor/referensi yang sama di Zoho tetapi tidak memiliki
marker ERP, sistem harus:

1. tidak menimpa data Zoho;
2. menahan event;
3. membuat exception `ZOHO_MANUAL_DATA_OVERLAP`;
4. meminta operator membandingkan kedua record;
5. menyelesaikan mapping atau koreksi sesuai bukti.

Jangan menggabungkan dua data hanya karena nama terlihat sama. Cocokkan external
key, nomor dokumen, jenis record, cabang, tanggal, nominal, dan pihak terkait.

### 19.5 Transaksi yang dapat masuk antrean Zoho

- contact member, supplier, dan Partnership;
- master produk, harga paket, cabang, dan lokasi;
- invoice final dan pembatalannya;
- pembayaran verified dan refund;
- sesi selesai dan pembatalannya;
- expense paid;
- pembayaran serta shipment Partnership;
- PO issued dan cancelled;
- Supplier Invoice/Bill;
- vendor payment dan refund;
- pemakaian/reversal inventori, adjustment, dan opname melalui jalur yang
  tersedia.

Gagal Zoho tidak membatalkan transaksi ERP yang sudah sah. Event tetap berada
di outbox dan diperbaiki atau dicoba ulang oleh operator.

### 19.6 Status antrean

| Status | Arti | Tindakan pengguna |
|---|---|---|
| `PENDING` | Menunggu giliran | Tunggu dan pantau |
| `PROCESSING` | Sedang diproses | Jangan klik retry |
| `PROCESSED` | Berhasil | Tidak perlu tindakan |
| `DRY_RUN` | Simulasi berhasil; Zoho tidak ditulis | Periksa hasil simulasi |
| `FAILED` | Percobaan gagal | Perbaiki data/mapping, lalu retry terkontrol |
| `DEAD_LETTER` | Batas percobaan habis | Operator wajib menyelidiki |
| `IGNORED` | Sengaja tidak dikirim | Baca alasan; tidak selalu error |

### 19.7 Mode go-live

| Mode | Dampak |
|---|---|
| `OFF` | Tidak ada event yang dikirim |
| `DRY_RUN` | Payload divalidasi, tetapi tidak menulis ke Zoho |
| `CANARY` | Hanya cabang uji yang dikirim |
| `LIVE` | Seluruh cabang yang diizinkan dikirim |
| Rollback ke `OFF` | Pengiriman dihentikan; operasional ERP tetap berjalan |

Syarat minimum menuju `CANARY`:

- approval Finance dan Logistik sudah ada;
- minimal satu cabang canary dipilih;
- full reconciliation benar-benar memeriksa data dan tidak kosong;
- tidak ada exception `HIGH`/`CRITICAL` yang belum selesai;
- tidak ada dead-letter.

Untuk menuju `LIVE`, diperlukan lima hari kerja canary tanpa mismatch sesuai
gate sistem.

### 19.8 Status aktual saat panduan ini dibuat

Snapshot pemeriksaan 5 Agustus 2026:

| Kontrol | Kondisi |
|---|---|
| Koneksi | Aktif ke organization **Ether**, scope version 12 |
| Mode | `DRY_RUN` |
| Master frozen | Belum |
| Cabang canary | Satu cabang dipilih |
| Approval Finance | Belum ada |
| Approval Logistik | Belum ada |
| Hari canary bebas mismatch | 0 |
| Full reconciliation terakhir | Selesai tetapi `totalChecked=0` |
| Event yang tercatat | 185 `DRY_RUN` dan 137 `IGNORED` pada saat pemeriksaan |
| Mapping konfigurasi | 27 mapping, seluruhnya berasal dari data manual Zoho dan berstatus `MANUAL_ONLY` |

Kesimpulan: pada snapshot ini integrasi **belum boleh** dinaikkan ke `CANARY`
atau `LIVE`. Tidak ada penulisan transaksi nyata ke Zoho selama mode tetap
`DRY_RUN`. Karena status dapat berubah, selalu jadikan halaman **Integrasi
Zoho** sebagai pemeriksaan terbaru sebelum mengambil keputusan.

Worker dapat terlihat aktif dan event dapat selesai sebagai `DRY_RUN`, tetapi
itu baru membuktikan simulasi payload berjalan—bukan berarti record nyata sudah
dibuat di Zoho. Status `IGNORED` juga dapat merupakan keputusan sengaja sesuai
aturan, bukan selalu kegagalan.

### 19.9 Keterbatasan Zoho Books untuk inventori

Integrasi menggunakan Zoho Books saja, bukan Zoho Inventory. Endpoint Books v3
yang digunakan belum menyediakan posting detail inventory adjustment untuk:

- konsumsi atau reversal material terapi;
- adjustment stok manual;
- stock opname.

Event tersebut dapat menghasilkan:

```text
ZOHO_BOOKS_INVENTORY_EXPORT_REQUIRED
```

Ini berarti operator perlu memakai CSV ekspor terkontrol dari ERP. CSV membawa
external key dan marker `[RAHO ERP]`. Jangan menekan retry berulang seolah-olah
endpoint akan muncul. Ledger quantity, batch, expiry, lokasi, dan reservasi di
ERP tetap menjadi catatan final.

PO, Bill, invoice, expense, dan pembayaran tetap dapat dikirim melalui API
Zoho Books yang tersedia.

### 19.10 Menangani kegagalan Zoho

1. Buka **Integrasi Zoho -> Event/Exception**.
2. Cari berdasarkan external key atau nomor dokumen.
3. Baca status dan pesan lengkap.
4. Periksa mapping dan asal data.
5. Perbaiki master/transaksi sumber di ERP bila masih boleh dikoreksi.
6. Jalankan retry hanya setelah penyebab selesai.
7. Lakukan rekonsiliasi dan pastikan tidak membuat duplikat.

Jangan:

- membuat record manual pengganti di Zoho hanya karena event lambat;
- mengubah marker `[RAHO ERP]`;
- mengganti external key;
- menimpa data `MANUAL_ONLY`;
- menaikkan mode untuk melewati error.

> **Tempat screenshot guide book:** halaman Connection, Event Queue, Mapping,
> Exception, Reconciliation, serta Go-live Control.

---

## 20. Portal Member, Notifikasi, Laporan, dan Audit

### 20.1 Portal Member

Member menggunakan portal terpisah untuk melihat data miliknya:

| Menu | Fungsi |
|---|---|
| Dashboard | Ringkasan akun dan aktivitas |
| Sesi Terapi | Jadwal dan riwayat sesi |
| Paket & Voucher | Paket, kuota, dan informasi terkait |
| Invoice | Tagihan dan status pembayaran |
| Profil Saya | Identitas dan informasi akun |

Portal member bersifat terbatas. Member tidak boleh melihat data member lain,
stok internal, jurnal, atau konfigurasi sistem.

### 20.2 Notifikasi dan Chat

Notifikasi membantu pengguna melihat pekerjaan seperti request stok, bukti
pembayaran, dan shipment bermasalah sesuai role. Notifikasi bukan pengganti
pemeriksaan daftar transaksi harian.

Pada versi saat panduan ini dibuat, menu **Chat** belum aktif dan mengarahkan
pengguna ke Notifikasi.

### 20.3 Laporan operasional

Sebelum menggunakan atau mengekspor laporan:

1. pilih cabang;
2. pilih tanggal mulai dan akhir;
3. pilih status yang relevan;
4. tekan filter satu kali;
5. periksa jumlah baris dan total;
6. ekspor hanya bila hasil sudah benar;
7. simpan file pada lokasi aman.

Data medis dan identitas member tidak boleh dibagikan kepada pihak yang tidak
berwenang.

### 20.4 Audit Log

Audit Log menjawab:

- siapa yang melakukan tindakan;
- kapan tindakan terjadi;
- pada data apa;
- nilai sebelum dan sesudah;
- cabang dan referensi terkait.

Gunakan Audit Log saat terjadi perubahan tidak dikenal, approval meragukan,
atau perbedaan data. Jangan mengubah atau menghapus jejak audit.

---

## 21. Panduan Kerja Berdasarkan Peran

### 21.1 Super Admin

Fokus:

- menjaga cabang, user, role, permission, dan branch scope;
- mengelola master kritis;
- memantau audit dan keamanan;
- mengatur koneksi serta kontrol go-live Zoho;
- melakukan rollback integrasi bila diperlukan.

Hindari mengerjakan transaksi harian memakai hak Super Admin bila tersedia akun
operasional yang lebih sesuai.

### 21.2 Admin Manager

Fokus:

- memantau beberapa cabang sesuai scope;
- meninjau pembayaran, request, shipment issue, serta laporan;
- melakukan approval sesuai nominal;
- memantau kinerja staf dan kualitas master cabang.

Admin Manager dengan batas `MEMBER_VIEW_ONLY` hanya boleh melihat data member
dan profil sendiri; halaman staf lain akan dibatasi.

### 21.3 Admin Cabang

Fokus harian:

- memastikan cabang aktif benar;
- memantau member, paket, pembayaran, dan sesi;
- memeriksa saldo stok dan membuat request;
- menerima shipment sesuai jumlah aktual;
- mencatat expense/kas cabang sesuai akses;
- mengelola staf cabang bila diberi kewenangan.

### 21.4 Admin Layanan

Fokus harian:

- mencari atau mendaftarkan member;
- membantu assign paket Basic dan Booster opsional;
- membuat invoice dan mencatat bukti pembayaran;
- menyiapkan administrasi sesi;
- memastikan data member dan jadwal lengkap.

Admin Layanan tidak mengisi harga pokok material terapi.

### 21.5 Admin Logistik

Fokus harian:

- memeriksa stok available, batch, dan expiry;
- meninjau request serta reservasi;
- menyiapkan dan mengirim shipment;
- menerima barang supplier melalui Goods Receipt;
- menangani discrepancy, adjustment, dan opname;
- memelihara UOM, Treatment BOM, dan data inventori;
- mendukung purchasing sesuai akses.

### 21.6 Finance & Logistics Controller

Fokus:

- pengawasan lintas Finance dan Logistik sesuai scope;
- approval dan maker-checker;
- pengecekan jurnal, ledger, dan laporan;
- monitoring mapping, event, exception, serta rekonsiliasi Zoho;
- memastikan gate sebelum perubahan mode integrasi.

### 21.7 Dokter

Fokus:

- membuat diagnosis;
- membuat atau memilih Therapy Plan;
- mengambil keputusan klinis;
- mengisi evaluasi/SOAP;
- memastikan sesi klinis lengkap.

Dokter tidak perlu menetapkan harga material atau mengatasi FIFO.

### 21.8 Perawat/Nakes

Fokus:

- mencatat vital sebelum dan sesudah;
- mencatat infus aktual;
- mencatat jumlah material aktual;
- mengisi alasan deviasi;
- melengkapi dokumentasi layanan;
- mendukung stok Tas Homecare sesuai kewenangan.

### 21.9 Member

Member hanya memakai portal pribadinya untuk melihat sesi, paket/voucher,
invoice, dan profil. Masalah data disampaikan kepada petugas; member tidak
mengubah transaksi internal.

---

## 22. Kamus Status Transaksi

### 22.1 Pola status yang paling umum

| Status | Makna umum |
|---|---|
| `DRAFT` | Masih disusun dan belum resmi |
| `SUBMITTED` | Sudah diajukan untuk pemeriksaan |
| `PENDING_APPROVAL` | Menunggu penyetuju |
| `APPROVED` | Disetujui, tetapi belum tentu sudah diposting/dijalankan |
| `REJECTED` | Ditolak; baca alasan dan perbaiki bila boleh |
| `POSTED` | Sudah masuk ledger/jurnal resmi |
| `CANCELLED` | Dibatalkan sesuai prosedur |
| `COMPLETED` | Proses selesai |

`APPROVED` dan `POSTED` tidak selalu sama. Dokumen yang disetujui mungkin masih
menunggu tindakan posting, pengiriman, penerimaan, atau pembayaran.

### 22.2 Status khusus penting

| Objek | Status utama |
|---|---|
| Invoice | `DRAFT`, `PENDING_PAYMENT`, `PAID`, `DEBT`, `OVERDUE`, `CANCELLED` |
| Verifikasi pembayaran | `PENDING`, `VERIFIED`, `REJECTED` |
| Paket | `PENDING_PAYMENT`, `WAITING_VERIFICATION`, `ACTIVE`, `EXPIRED`, `CANCELLED` |
| Sesi | `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| Material Usage | `DRAFT`, `CONSUMED`, `REVERSED` |
| Treatment BOM | `DRAFT`, `ACTIVE`, `SUPERSEDED`, `ARCHIVED` |
| Shipment | `PREPARING`, `SHIPPED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `RECEIVED_WITH_ISSUE`, `APPROVED` |
| Expense | `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `PAID` |
| PO | `ISSUED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CLOSED`, `CANCELLED` |
| Supplier Invoice | `POSTED`, `PARTIALLY_PAID`, `PAID` |
| Accounting Period | `OPEN`, `CLOSED`, `LOCKED` |
| Zoho event | `PENDING`, `PROCESSING`, `PROCESSED`, `DRY_RUN`, `FAILED`, `DEAD_LETTER`, `IGNORED` |

Jika status tidak berubah, jangan langsung membuat dokumen baru. Muat ulang,
periksa notifikasi/audit, lalu cari penyebab status lama.

---

## 23. Checklist Operasional

### 23.1 Awal hari — semua staf

- [ ] Login menggunakan akun sendiri.
- [ ] Periksa cabang aktif.
- [ ] Baca Notifikasi dan pekerjaan pending.
- [ ] Pastikan tanggal pada perangkat benar.
- [ ] Jangan lanjut bila layar menunjukkan lingkungan latihan tetapi akan
      memasukkan data produksi, atau sebaliknya.

### 23.2 Awal hari — layanan klinik

- [ ] Jadwal member hari ini diperiksa.
- [ ] Basic aktif dan kuotanya tersedia.
- [ ] Booster aktif bila akan digunakan.
- [ ] Diagnosis dan Therapy Plan siap.
- [ ] Pembayaran/cicilan yang disyaratkan verified.
- [ ] Stok fisik material wajib cukup.
- [ ] Petugas sesi sudah ditentukan.

### 23.3 Awal hari — Logistik

- [ ] Request dan shipment pending diperiksa.
- [ ] Stok minimum dan stok available diperiksa.
- [ ] Batch mendekati expiry diperiksa.
- [ ] Barang quarantine ditindaklanjuti.
- [ ] Goods Receipt yang belum selesai diperiksa.
- [ ] Tas Homecare yang keluar memiliki penanggung jawab.

### 23.4 Awal hari — Finance

- [ ] Bukti pembayaran pending diperiksa.
- [ ] Approval Inbox diperiksa.
- [ ] Periode transaksi hari ini `OPEN`.
- [ ] Rekening kas/bank aktif dan mapping-nya benar.
- [ ] Expense/AP jatuh tempo diperiksa.
- [ ] Exception serta event Zoho gagal diperiksa.

### 23.5 Akhir hari

- [ ] Sesi hari ini tidak tertinggal tanpa status yang jelas.
- [ ] Evaluasi tersimpan dan sesi yang lengkap sudah diselesaikan.
- [ ] Material aktual tercatat.
- [ ] Pembayaran dan bukti sudah masuk antrean verifikasi.
- [ ] Shipment yang benar-benar dikirim sudah ditandai `SHIPPED`.
- [ ] Penerimaan aktual dan discrepancy sudah dicatat.
- [ ] Kas/bank serta transaksi besar diperiksa.
- [ ] Event `FAILED`/`DEAD_LETTER` dicatat untuk tindak lanjut.
- [ ] Logout dari perangkat bersama.

### 23.6 Mingguan

- [ ] Rekonsiliasi stok, shipment, dan barang quarantine.
- [ ] Rekonsiliasi invoice, pembayaran, deferred revenue, serta sesi.
- [ ] Periksa PR/PO/Bill/AP yang lama tidak bergerak.
- [ ] Periksa akun user yang tidak lagi aktif.
- [ ] Periksa exception dan mapping Zoho `REVIEW_REQUIRED`.
- [ ] Simpan laporan sesuai kebijakan retensi.

### 23.7 Bulanan

- [ ] Stock opname sesuai jadwal.
- [ ] Rekonsiliasi kas/bank.
- [ ] Trial Balance dan General Ledger ditinjau.
- [ ] Deferred Revenue direkonsiliasi dengan paket/sesi.
- [ ] Cut-off Goods Receipt, GRNI, Bill, expense, dan shipment diperiksa.
- [ ] Periode ditutup hanya setelah semua pengecekan selesai.
- [ ] Audit transaksi koreksi dan reversal ditinjau.

---

## 24. Penanganan Masalah

### 24.1 Urutan aman ketika terjadi error

1. Berhenti menekan tombol.
2. Baca seluruh pesan, termasuk kode error.
3. Catat menu, nomor dokumen/sesi, cabang, dan waktu.
4. Ambil screenshot setelah menyamarkan data sensitif bila dikirim keluar tim
   berwenang.
5. Muat ulang satu kali untuk memastikan status terbaru.
6. Periksa apakah transaksi sebenarnya sudah tersimpan.
7. Ikuti tabel berikut atau eskalasikan.

### 24.2 Tabel masalah umum

| Masalah/pesan | Penyebab yang mungkin | Tindakan aman |
|---|---|---|
| Tidak bisa login | Username/password salah, akun tidak aktif, koneksi | Ketik ulang, periksa internet, minta reset/aktivasi |
| Menu tidak terlihat | Role, permission, atau branch scope tidak mengizinkan | Periksa akun/cabang; minta admin memeriksa izin |
| Tombol aksi tidak ada | Status belum memenuhi atau izin tindakan tidak ada | Baca status dan permission; jangan pinjam akun |
| Data member ganda | Pengguna tidak mencari terlebih dahulu | Jangan membuat lagi; laporkan untuk penyatuan/koreksi resmi |
| Username/NIK sudah dipakai | Member sudah terdaftar | Cari dan gunakan record yang ada |
| Diagnosis belum tersedia | Belum dibuat atau cabang/member salah | Dokter membuat diagnosis pada member yang benar |
| Therapy Plan sudah digunakan | Satu plan hanya boleh satu kali | Buat/pilih plan aktif yang baru |
| Basic tidak ada/habis | Paket belum aktif atau kuota habis | Assign/aktifkan Basic yang sah; jangan pakai Booster sebagai Basic |
| Booster tidak aktif/habis | Booster salah atau kuota habis | Pilih Booster aktif atau jalankan tanpa Booster bila memang tidak digunakan |
| Batas utang sesi tercapai | Pembayaran yang disyaratkan belum verified | Finance memverifikasi pembayaran sah |
| Evaluasi tidak bisa disimpan | Evaluasi kosong, sesi tidak ditemukan, atau harus edit | Isi minimal satu SOAP; pastikan sesi; gunakan Edit bila sudah ada |
| “Belum memiliki harga pokok FIFO” saat evaluasi | Versi aplikasi/service lama atau salah jalur | Jangan isi HPP asal; catat sesi dan laporkan ke admin aplikasi |
| `INSUFFICIENT_AVAILABLE_STOCK` | Quantity available tidak cukup | Receipt/transfer/koreksi stok sah; harga FIFO bukan solusinya |
| Material wajib belum dicatat | Rekomendasi wajib belum diterapkan | Isi quantity aktual semua material wajib |
| Deviasi belum diberi alasan | Actual berbeda dari rekomendasi | Pilih reason; isi catatan bila `OTHER` |
| Deferred revenue tidak tersedia/cukup | Pembayaran belum verified atau kontrak/saldo paket bermasalah | Finance perbaiki pendanaan paket, lalu selesaikan sesi yang sama |
| `ACCOUNTING_PERIOD_CLOSED` | Tanggal berada pada periode tertutup | Finance periksa tanggal dan periode yang sah |
| `PAYMENT_EVIDENCE_REQUIRED` | Bukti belum dilampirkan | Unggah bukti yang jelas |
| `PAYMENT_EXCEEDS_BALANCE` | Nominal melebihi sisa tagihan | Periksa invoice dan masukkan nominal benar |
| Maker-checker menolak | Pembuat mencoba menyetujui sendiri | Minta penyetuju berwenang yang berbeda |
| Request baru ditolak | Request/shipment lama belum selesai | Selesaikan dokumen lama, bukan membuat duplikat |
| Shipment berbeda dengan fisik | Kurang, rusak, salah, atau batch beda | Catat actual dan discrepancy; quarantine bila perlu |
| Jurnal tidak seimbang | Debit dan kredit berbeda atau akun salah | Periksa sumber, akun, dan nilai; jangan paksa posting |
| Missing mapping | Master pendukung Zoho belum dipasangkan | Periksa mapping dan setujui berdasarkan bukti |
| Duplicate SKU | Lebih dari satu produk memakai kode sama | Hentikan sync; rapikan master ERP secara resmi |
| `ZOHO_MANUAL_DATA_OVERLAP` | Referensi sama sudah dibuat manual di Zoho | Bandingkan record; jangan overwrite atau retry sebelum review |
| `ZOHO_MAPPING_REVIEW_REQUIRED` | Kepemilikan mapping belum disetujui | Tetapkan origin/management mode setelah verifikasi |
| `ZOHO_BOOKS_INVENTORY_EXPORT_REQUIRED` | Books tidak mendukung adjustment detail tersebut | Gunakan CSV terkontrol; jangan retry berulang |
| Event `FAILED` | Data, mapping, koneksi, atau validasi gagal | Perbaiki akar masalah, baru retry satu kali |
| Event `DEAD_LETTER` | Batas retry habis | Eskalasi ke operator integrasi |
| Klik Simpan tetapi layar diam | Koneksi lambat atau proses masih berjalan | Tunggu; muat ulang lalu cek status sebelum klik lagi |

### 24.3 Salah memilih cabang atau salah memasukkan data

Jangan membuat transaksi lawan tanpa instruksi. Catat:

- record yang salah;
- cabang seharusnya;
- apakah status masih draft atau sudah posted;
- apakah sudah memengaruhi stok, uang, kuota, atau Zoho.

Jika masih draft, perbaiki sesuai izin. Jika sudah final/posted, gunakan
pembatalan, refund, reversal, atau discrepancy resmi.

---

## 25. Yang Boleh dan Tidak Boleh Dilakukan

### 25.1 Lakukan

- cari sebelum membuat data;
- periksa cabang, tanggal, status, quantity, dan nominal;
- masukkan keadaan aktual, bukan angka yang diharapkan;
- gunakan alasan dan evidence yang jelas;
- gunakan approval dan maker-checker;
- gunakan reversal/refund/cancellation untuk koreksi;
- pantau transaksi sampai status akhir;
- laporkan hambatan dengan nomor referensi lengkap.

### 25.2 Jangan lakukan

- berbagi akun, password, OTP, atau token;
- membuat member, supplier, produk, atau invoice duplikat;
- mengisi HPP barang agar sesi terapi bisa lewat;
- menghitung harga sesi dari material;
- memilih Booster sebagai pengganti Basic;
- mengedit stok atau ledger secara langsung;
- menandai barang dikirim/diterima sebelum kejadian nyata;
- menghapus dokumen posted atau audit;
- membuat transaksi Zoho manual untuk menggantikan event ERP yang lambat;
- menimpa data `MANUAL_ONLY`;
- menaikkan mode Zoho untuk melewati gate;
- menekan tombol Simpan, Bayar, Kirim, Selesaikan, atau Retry berulang kali.

---

## 26. Cara Meminta Bantuan

Kirim laporan singkat tetapi lengkap menggunakan format berikut:

```text
Judul masalah:
Nama menu:
Nomor member/sesi/invoice/request/PO/event:
Cabang:
Tanggal dan jam kejadian:
Status sebelum tindakan:
Tombol yang ditekan:
Pesan error lengkap:
Apakah data sudah tersimpan:
Screenshot terlampir: Ya/Tidak
Tindakan yang sudah dicoba:
Dampak operasional:
```

Jangan mengirim password, OTP, token, seluruh nomor identitas, atau informasi
medis yang tidak diperlukan.

Tingkat eskalasi yang disarankan:

| Dampak | Contoh | Tindakan |
|---|---|---|
| Rendah | Salah filter, pertanyaan penggunaan | Tanyakan ke PIC/atasan saat jam kerja |
| Sedang | Satu dokumen tidak dapat dilanjutkan | Laporkan dengan nomor referensi dan screenshot |
| Tinggi | Banyak user/cabang terhambat, saldo/stok berisiko salah | Hentikan aksi terkait dan segera hubungi administrator/controller |
| Kritis | Kebocoran akun, transaksi ganda massal, data klinis berisiko, integrasi salah kirim | Hentikan proses terkait, amankan akses, dan eskalasi darurat |

---

## 27. Latihan untuk Pengguna Baru

Gunakan lingkungan latihan dan data latihan. Jangan memakai identitas, rekening,
atau bukti pembayaran asli.

### Skenario 1 — Member sampai sesi

- [ ] Cari member latihan.
- [ ] Daftarkan hanya bila belum ada.
- [ ] Buat diagnosis dan Therapy Plan.
- [ ] Assign Basic dan Booster latihan.
- [ ] Buat invoice dan unggah bukti latihan.
- [ ] Pengguna lain memverifikasi pembayaran.
- [ ] Buat sesi dan lengkapi sembilan langkah.
- [ ] Catat quantity material tanpa harga per barang.
- [ ] Simpan evaluasi.
- [ ] Selesaikan sesi.
- [ ] Periksa kuota, stok, deferred revenue, dan status event.

### Skenario 2 — Request sampai receipt

- [ ] Buat Request Stok.
- [ ] Setujui sebagian.
- [ ] Periksa reservation.
- [ ] Buat dan kirim shipment.
- [ ] Terima dengan satu selisih latihan.
- [ ] Selesaikan discrepancy.
- [ ] Periksa Ledger Stok.

### Skenario 3 — Purchasing sampai AP

- [ ] Buat PR dan ajukan.
- [ ] Lakukan approval dengan akun lain.
- [ ] Terbitkan PO.
- [ ] Buat Goods Receipt sebagian.
- [ ] Posting Supplier Invoice sesuai quantity diterima.
- [ ] Bayar sebagian dan periksa sisa AP.

### Skenario 4 — Zoho DRY_RUN

- [ ] Pastikan mode `DRY_RUN`.
- [ ] Finalisasi transaksi latihan.
- [ ] Cari event berdasarkan external key.
- [ ] Periksa payload, origin, mapping, dan status.
- [ ] Jalankan reconciliation latihan.
- [ ] Simulasikan overlap dan pastikan record manual tidak ditimpa.

Pengguna dinyatakan siap bila dapat menjelaskan mengapa Basic wajib, Booster
opsional, quantity material tetap dicatat, dan HPP per barang tidak boleh
menghambat sesi.

---

## 28. Glosarium Bahasa Sederhana

| Istilah | Arti |
|---|---|
| ERP | Aplikasi utama yang menghubungkan pekerjaan klinik, stok, dan Finance |
| Master data | Data dasar yang dipakai berulang kali |
| Role | Jabatan pengguna di aplikasi |
| Permission | Izin untuk melihat atau melakukan tindakan |
| Branch scope | Cabang yang boleh diakses pengguna |
| Basic | Paket utama dan wajib untuk nilai sesi |
| Booster | Tambahan opsional bila digunakan |
| Material Usage | Jumlah barang yang benar-benar dipakai pada sesi |
| Treatment BOM | Rekomendasi jumlah material terapi |
| FIFO | Cara menentukan nilai barang dari lapisan yang lebih dahulu masuk |
| Pending valuation | Quantity sudah tercatat, tetapi nilai Finance masih perlu diselesaikan |
| UOM | Satuan barang, misalnya box, botol, piece, atau ml |
| SKU | Kode unik produk |
| Batch | Kelompok produksi |
| Expiry | Tanggal kedaluwarsa |
| Ledger | Riwayat resmi transaksi |
| Reservation | Stok yang sudah dialokasikan |
| Quarantine | Barang yang ditahan untuk pemeriksaan |
| Shipment | Dokumen pengiriman barang |
| Discrepancy | Perbedaan antara dokumen dan keadaan aktual |
| Goods Receipt | Catatan penerimaan barang dari supplier |
| Adjustment | Koreksi stok dengan alasan dan approval |
| Stock opname | Pencocokan hitung fisik dengan sistem |
| PR | Permintaan pembelian internal |
| PO | Pesanan resmi kepada supplier |
| GRNI | Barang sudah diterima tetapi invoice supplier belum selesai |
| AP | Utang kepada supplier |
| AR | Tagihan kepada member/customer |
| COA | Daftar akun akuntansi |
| Deferred Revenue | Uang paket yang belum menjadi omzet |
| Posted | Sudah masuk catatan resmi |
| Reversal | Transaksi pembalik yang menjaga riwayat |
| Maker-checker | Pembuat dan penyetuju adalah orang berbeda |
| Evidence | Bukti berupa file, foto, atau dokumen |
| External key | Kode unik penghubung record ERP dan Zoho |
| Mapping | Pasangan record ERP dengan record Zoho |
| Outbox/event | Antrean pengiriman transaksi final |
| DRY_RUN | Simulasi tanpa menulis ke Zoho |
| CANARY | Pengiriman nyata terbatas pada cabang uji |
| LIVE | Pengiriman nyata untuk seluruh scope aktif |
| Reconciliation | Membandingkan dua catatan untuk mencari selisih |

---

## 29. Ringkasan Satu Halaman

### Alur klinik

```text
Cari Member
  -> Basic wajib
  -> Booster opsional
  -> Invoice dan pembayaran verified
  -> Diagnosis + Therapy Plan
  -> Sesi 9 langkah
  -> Material dicatat quantity saja
  -> Evaluasi disimpan
  -> Sesi diselesaikan
```

### Alur logistik

```text
Master + opening stock
  -> Request
  -> Approval
  -> Reservation
  -> Shipment
  -> Receipt aktual
  -> Discrepancy/Opname bila ada selisih
```

### Alur purchasing

```text
Supplier -> PR -> Approval -> PO -> Goods Receipt -> Bill -> Payment
```

### Alur Finance

```text
Transaksi operasional
  -> bukti dan approval
  -> posting jurnal
  -> kas/bank, AR/AP, deferred revenue
  -> laporan dan rekonsiliasi
```

### Alur Zoho Books

```text
ERP final -> Outbox -> Validasi/Mapping -> Zoho Books -> Reconciliation
```

Ingat:

1. ERP adalah sumber utama.
2. Zoho Books menerima data final; tidak memasok data bisnis ke ERP.
3. Harga sesi = Basic + Booster bila digunakan.
4. Harga pokok material tidak boleh menghambat evaluasi atau sesi terapi.
5. Stok fisik tetap harus cukup.
6. Koreksi memakai reversal/refund/cancellation, bukan delete.
7. Data ERP dan manual Zoho harus diberi penanda agar tidak overlap.

---

## 30. Pemeliharaan Guide Book

Pemilik proses perlu meninjau panduan bila terjadi:

- perubahan menu atau role;
- perubahan aturan paket atau sesi;
- perubahan status transaksi;
- perubahan jurnal atau approval;
- penambahan endpoint Zoho Books;
- perubahan gate `DRY_RUN`, `CANARY`, atau `LIVE`;
- perbaikan bug yang memengaruhi langkah pengguna.

Untuk setiap pembaruan:

1. ubah versi dan tanggal di bagian atas;
2. cocokkan panduan dengan aplikasi yang berjalan;
3. perbarui screenshot;
4. uji langkah pada lingkungan latihan;
5. minta pemilik Klinik, Logistik, dan Finance meninjau;
6. arsipkan versi lama sesuai kebijakan dokumen.

### Dokumen teknis pendamping

Guide book ini adalah panduan pengguna. Detail implementasi dan keputusan
integrasi dapat ditelusuri pada dokumentasi teknis, terutama:

- [Flow ERP ke Zoho Books](updatelogisticnFinnance/FLOW_ERP_TO_ZOHO_BOOKS.md);
- dokumentasi Finance dan Logistik pada folder `docs/`;
- kode aplikasi serta Audit Log sebagai sumber perilaku aktual.

Jika dokumen lama menyebut **Basic atau Booster**, mewajibkan FIFO material
untuk terapi, atau mengajarkan import transaksi Zoho menjadi data ERP, gunakan
aturan dalam guide book ini dan verifikasi pada versi aplikasi terbaru.

---

## Lampiran A. Daftar Menu Menurut Role

Daftar ini mencerminkan sidebar saat panduan dibuat. Permission dan branch scope
tetap dapat menyembunyikan tombol atau menolak tindakan di dalam halaman.

### A.1 Super Admin

- **Utama:** Master Inventori, Ledger Stok, Stock Opname, Dashboard Super Admin.
- **Klinik:** Sesi Terapi, Pembayaran.
- **Inventori:** Inventori Tim, Dashboard Logistik, Stok, Mutasi Stok,
  Adjustment & Opname, Riwayat Penggunaan Barang, Request Stok, Reservasi Stok,
  Pengiriman, Goods Receipt, Treatment BOM, Laporan Pengiriman, Tas Homecare.
- **Komunikasi:** Notifikasi, Chat.
- **Manajemen:** Pengaturan Cabang, Kinerja Staff, Laporan, Harga Paket,
  Import Data.
- **Finance:** Accounting, Finance Reports, Kas & Bank, Opening Balance,
  Expense, Purchasing & AP, Deferred Revenue, Approval Inbox.
- **Sistem:** Admin Managers, Master Produk, Permission & Role, Audit Log,
  Integrasi Zoho.

Pada sidebar saat ini, menu **Member** tidak tercantum untuk Super Admin. Ini
adalah kondisi tampilan saat panduan dibuat, bukan alasan membuat akun bersama.

### A.2 Admin Manager — akses penuh

- **Utama:** Master Inventori, Ledger Stok, Stock Opname, Dashboard.
- **Klinik:** Member, Sesi Terapi, Pembayaran.
- **Inventori:** Inventori Tim, Dashboard Logistik, Mutasi Stok, Adjustment &
  Opname, Riwayat Penggunaan Barang, Request Stok, Reservasi Stok, Pengiriman,
  Goods Receipt, Treatment BOM, Laporan Pengiriman, Tas Homecare.
- **Komunikasi:** Notifikasi, Chat.
- **Manajemen:** Pengaturan Cabang, Kinerja Staff, Laporan, Kode Referral,
  Harga Paket, Import Data.
- **Finance:** Accounting, Finance Reports, Kas & Bank, Opening Balance,
  Expense, Purchasing & AP, Deferred Revenue, Approval Inbox.
- **Sistem:** Audit Log.

Admin Manager dengan pembatasan `MEMBER_VIEW_ONLY` hanya melihat **Member**,
**Profil Saya**, dan **Keluar**.

### A.3 Admin Cabang

- **Utama/Klinik:** Ledger Stok, Dashboard, Member, Sesi Terapi, Pembayaran.
- **Inventori:** Inventori Tim, Dashboard Logistik, Stok, Mutasi Stok,
  Adjustment & Opname, Riwayat Penggunaan Barang, Request Stok, Pengiriman,
  Goods Receipt, Treatment BOM, Tas Homecare.
- **Komunikasi:** Notifikasi, Chat.
- **Manajemen:** Pengaturan Cabang, Kelola Staff, Kinerja Staff, Laporan,
  Kode Referral, Harga Paket.
- **Finance:** Kas & Bank, Expense, Purchasing & AP.

### A.4 Admin Layanan

- Dashboard;
- Member;
- Sesi Terapi;
- Pembayaran;
- Inventori Tim;
- Notifikasi;
- Chat.

### A.5 Admin Logistik

- **Utama:** Master Inventori, Ledger Stok, Stock Opname, Dashboard.
- **Klinik:** Member, Sesi Terapi.
- **Inventori:** Dashboard Logistik, Mutasi Stok, Adjustment & Opname, Riwayat
  Penggunaan Barang, Request Stok, Reservasi Stok, Pengiriman, Goods Receipt,
  Treatment BOM, Laporan Pengiriman, Tas Homecare.
- **Komunikasi:** Notifikasi, Chat.
- **Finance/Sistem:** Purchasing & AP, Approval Inbox, Audit Log.

### A.6 Finance & Logistics Controller

- **Utama:** Master Inventori, Ledger Stok, Stock Opname, Dashboard Logistik.
- **Logistik:** Adjustment & Opname, Request Stok, Reservasi Stok, Pengiriman,
  Laporan Pengiriman.
- **Finance:** Accounting, Finance Reports, Kas & Bank, Expense, Purchasing &
  AP, Deferred Revenue, Approval Inbox.
- **Sistem:** Audit Log, Integrasi Zoho.

Pada sidebar saat ini role ini tidak mendapat menu umum Notifikasi, Chat, Mutasi
Stok, Riwayat Penggunaan Barang, Goods Receipt, Treatment BOM, atau Tas
Homecare. Laporkan bila pekerjaan nyata membutuhkan izin/menu tersebut.

### A.7 Dokter

- Dashboard;
- Member;
- Sesi Terapi;
- Notifikasi;
- Chat.

### A.8 Perawat/Nakes

- Dashboard;
- Member;
- Sesi Terapi;
- Inventori Tim;
- Riwayat Penggunaan Barang;
- Tas Homecare;
- Notifikasi;
- Chat.

### A.9 Member

- Dashboard;
- Sesi Terapi;
- Paket & Voucher;
- Invoice;
- Profil Saya.

Semua staf juga memiliki **Profil Saya** melalui kartu nama dan tombol
**Keluar**.

---

## Lampiran B. Catatan Versi dan Keterbatasan Saat Ini

Catatan ini mencegah pengguna mengira semua keadaan berikut adalah kesalahan
cara pakai:

1. **Chat belum aktif.** Halamannya mengarahkan pengguna ke Notifikasi.
2. **Inventori Tim masih Coming Soon.** Gunakan menu inventori lain yang aktif.
3. **Ada dua tampilan opname.** **Stock Opname** berfokus pada ringkasan/approval;
   **Adjustment & Opname** memuat flow operasional lebih lengkap.
4. **Master Inventori dan Master Produk berbeda.** Master Inventori berfokus
   pada UOM, konversi, batch, dan expiry; Master Produk pada katalog global dan
   penempatan lintas cabang.
5. **Simpan Evaluasi dan Selesaikan Sesi berbeda.** Evaluasi tidak memeriksa
   FIFO, stok, atau jurnal. Penyelesaian melakukan finalisasi lintas modul.
6. **Finance lokal masih menjadi bagian finalisasi sesi.** Kontrak deferred
   revenue yang hilang, saldo kurang, atau periode tertutup masih dapat menahan
   tombol Selesaikan; kondisi tersebut ditangani Finance tanpa membuat sesi
   baru.
7. **Zoho Books-only memiliki batas inventory adjustment.** Gunakan controlled
   CSV saat muncul `ZOHO_BOOKS_INVENTORY_EXPORT_REQUIRED`.
8. **Status integrasi dapat berubah.** Snapshot dalam Bab 19 bukan pengganti
   pemeriksaan halaman Integrasi Zoho terbaru.
9. **Arah Dashboard Admin Logistik berbeda.** Login normal diarahkan ke
    Dashboard Logistik, sedangkan tautan Dashboard umum dapat mengarah ke Master
    Inventori pada versi saat ini.

Pemilik aplikasi harus memperbarui lampiran ini setelah keterbatasan diperbaiki
agar pengguna tidak mengikuti workaround yang sudah tidak diperlukan.
