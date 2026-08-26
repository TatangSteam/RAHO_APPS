# Pertanyaan Inti Integrasi ERP RAHO dengan Odoo

Gunakan dokumen ini saat meeting awal. Fokusnya hanya keputusan yang wajib
diketahui agar integrasi dapat dibuat dengan aman.

## A. Kondisi Odoo

1. Odoo menggunakan versi, edisi, dan jenis hosting apa?
2. Apakah tersedia Odoo testing yang terpisah dari production?
3. Apakah Odoo memiliki modul custom yang berkaitan dengan stok, pembelian,
   penjualan, atau Finance?
4. Siapa PIC bisnis dan PIC teknis/vendor Odoo?

## B. Tujuan dan sumber data

5. Data apa yang dikirim dari ERP RAHO ke Odoo?
6. Data apa yang perlu dibaca kembali dari Odoo ke ERP RAHO?
7. Apakah sinkronisasi harus real-time atau boleh tertunda?
8. Untuk setiap data berikut, sistem mana yang menjadi sumber utama?

| Data | ERP RAHO atau Odoo? |
|---|---|
| Produk, SKU, harga, dan diskon | |
| Customer/member dan vendor | |
| Cabang, gudang, dan persediaan | |
| Purchase Order dan Vendor Bill | |
| Invoice dan pembayaran | |
| Chart of Accounts, pajak, dan laporan resmi | |

9. Jika data berbeda, sistem mana yang dianggap benar dan siapa yang boleh
   mengoreksinya?

## C. API dan keamanan

10. Apakah instalasi Odoo mengizinkan API eksternal dan metode API apa yang
    tersedia?
11. Apakah dapat dibuat akun khusus integrasi dengan permission minimum?
12. Apa URL API testing dan production serta apakah ada persyaratan IP/VPN?
13. Apakah tersedia dokumentasi model, field, dan contoh response API?
14. Apakah ada rate limit, batas ukuran data, atau jadwal maintenance?
15. Bagaimana credential API disimpan, diganti, dan dicabut?

> Jangan menggunakan akun administrator pribadi untuk integrasi production.

## D. Mapping dan aturan transaksi

16. Satu cabang RAHO dipetakan menjadi company, branch, warehouse, atau
    analytic account apa di Odoo?
17. Bagaimana stok pusat, stok cabang, stok tim, dan barang dalam perjalanan
    dibedakan?
18. ID unik apa yang dipakai untuk mencocokkan produk, customer, vendor, dan
    transaksi agar tidak terjadi duplikasi?
19. Bagaimana UOM, kategori produk, akun, dan pajak dipetakan?
20. Dokumen serta status apa yang resmi menaikkan atau menurunkan stok?
21. Saat integrasi pertama, saldo existing mengikuti ERP RAHO atau Odoo?
22. Apakah Invoice dan Vendor Bill dibuat sebagai draft atau langsung posted?
23. Bagaimana pembatalan dilakukan: void, credit note, atau reversal?

## E. Kegagalan dan rekonsiliasi

24. Jika Odoo sedang tidak tersedia, apakah ERP RAHO tetap beroperasi dan
    transaksi disimpan dalam antrean?
25. Bagaimana retry dilakukan tanpa membuat produk atau transaksi ganda?
26. Error apa yang boleh otomatis diulang dan error apa yang harus diperiksa
    manusia?
27. Data apa yang dibandingkan secara rutin dan berapa toleransi selisih yang
    diterima Finance?
28. Siapa yang menerima notifikasi, melakukan retry, dan menyelesaikan selisih?

## F. Testing dan go-live

29. Skenario apa yang wajib lulus sebelum production dan siapa yang menyetujui
    hasil UAT?
30. Kapan cutover dilakukan, cabang mana yang menjadi pilot, dan bagaimana
    prosedur rollback?

## Pengujian minimum

| Pengujian | Hasil yang wajib |
|---|---|
| Koneksi API | Berhasil menggunakan akun integrasi khusus |
| Master data | Produk/customer/vendor tidak terbuat ganda |
| Stok masuk dan keluar | Quantity serta nilai berubah satu kali |
| Invoice dan pembayaran | Nominal serta status sesuai |
| Timeout dan retry | Tidak menghasilkan transaksi ganda |
| Odoo tidak tersedia | Operasional RAHO tetap berjalan |
| Pembatalan | Menggunakan reversal dan histori tetap ada |
| Rekonsiliasi | Selisih dalam tolerance Finance |

## Keputusan wajib sebelum coding

Coding belum dimulai sebelum hal berikut disepakati:

- versi dan environment testing Odoo;
- data yang disinkronkan dan sumber utamanya;
- akses serta autentikasi API;
- mapping cabang, gudang, produk, akun, UOM, dan pajak;
- transaksi yang mengubah stok dan jurnal;
- ID unik dan mekanisme anti-duplikasi;
- retry, rekonsiliasi, serta PIC penanganan masalah;
- UAT, cutover, pilot, dan rollback.
