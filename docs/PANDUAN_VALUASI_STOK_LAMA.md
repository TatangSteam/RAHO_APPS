# Panduan Singkat: Isi HPP Stok Lama

Gunakan panduan ini jika Dashboard Logistik menampilkan **Belum dinilai** atau **Pending valuation**, atau transaksi ditolak karena stok belum mempunyai HPP. Stoknya sudah ada; yang belum dicatat adalah nilainya.

## Langkah penggunaan

1. Masuk sebagai **Super Admin** dan buka **Inventori → Dashboard Logistik → Nilai Stok**.
2. Pilih cabang. Tab **Belum dinilai** menampilkan produk yang masih membutuhkan HPP. Cari nama atau SKU jika perlu.
3. Cocokkan jumlah stok dan siapkan bukti HPP, misalnya invoice, PO, goods receipt, atau dokumen saldo awal.
4. Klik **Isi HPP** pada produk. Isi **HPP per unit dasar produk**, nomor dokumen, dan catatan sumber harga. Periksa perkiraan nilai yang tampil, lalu klik **Simpan HPP**.
5. Pastikan angka **Stok perlu HPP** berkurang atau status pencarian SKU berubah menjadi **Stok bernilai siap jual**. Produk yang sudah dinilai dapat dilihat pada **Semua stok**. Jika sebelumnya gagal dijual, coba transaksi lagi setelah laporan dimuat ulang.

Tindakan ini **tidak menambah atau mengurangi jumlah stok**. Sistem mencatat nilai persediaan, jurnal saldo awal, dan audit. Jangan membuat penerimaan barang atau opening stock baru untuk stok lama yang sudah ada, karena jumlahnya akan tergandakan. **Harga jual bukan HPP**; gunakan harga pokok dari dokumen.

Jika tombol **Isi HPP** tidak muncul, minta bantuan Super Admin. Jika tombol tidak aktif karena **Jumlah tidak cocok**, rekonsiliasi saldo sebelum mencatat nilai. Jika laporan tetap menampilkan **Perlu perbaikan data**, minta pemeriksaan data cost layer sebelum mengulang.

## Jika SKU tidak muncul

Menu yang dahulu disebut **Valuation** sekarang bernama **Nilai Stok**. Pilih **cabang transaksi**, lalu ketik SKU pada **Cari produk** (pencarian berjalan otomatis atau dengan tombol **Cari**). Untuk Air Nano Biru 600 ml per dus, SKU jual `PRD-ANN-BRU-003` memakai stok botol `PRD-ANN-BRU-001`—cari SKU botolnya.

Kotak diagnosis SKU menjelaskan mengapa baris tidak muncul:

- **Belum ada di cabang**: periksa cabang transaksi dan pengaturan produk inventori.
- **Stok ada, cost layer belum ada** atau **stok belum tercatat di ledger**: Super Admin dapat klik **Isi HPP tanpa menambah stok** setelah cocokkan jumlah dan menyiapkan dokumen HPP.
- **Stok ada di lokasi lain** atau **jumlah tidak cocok**: selesaikan mutasi/rekonsiliasi dahulu; jangan menambah stok baru hanya untuk membuat SKU muncul.
