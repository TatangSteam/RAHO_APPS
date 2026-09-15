# Panduan Singkat: Isi HPP Stok Lama

Gunakan panduan ini jika Dashboard Logistik menampilkan **Belum dinilai** atau **Pending valuation**, atau transaksi ditolak karena stok belum mempunyai HPP. Stoknya sudah ada; yang belum dicatat adalah nilainya.

## Langkah penggunaan

1. Masuk sebagai **Super Admin** dan buka **Inventori → Dashboard Logistik → Nilai Stok**.
2. Pilih cabang. Tab **Belum dinilai** menampilkan produk yang masih membutuhkan HPP. Cari nama atau SKU jika perlu.
3. Cocokkan jumlah stok dan siapkan bukti HPP, misalnya invoice, PO, goods receipt, atau dokumen saldo awal.
4. Klik **Isi HPP** pada produk. Isi **HPP per unit dasar produk**, nomor dokumen, dan catatan sumber harga. Periksa perkiraan nilai yang tampil, lalu klik **Simpan HPP**.
5. Pastikan angka **Stok belum dinilai** berkurang dan produk muncul sebagai **Sudah dinilai** di tab **Semua stok**. Jika produk tersebut sebelumnya gagal dijual, coba transaksi lagi setelah laporan dimuat ulang.

Tindakan ini **tidak menambah atau mengurangi jumlah stok**. Sistem mencatat nilai persediaan, jurnal saldo awal, dan audit. Jangan membuat penerimaan barang atau opening stock baru untuk stok lama yang sudah ada, karena jumlahnya akan tergandakan. **Harga jual bukan HPP**; gunakan harga pokok dari dokumen.

Jika tombol **Isi HPP** tidak muncul, minta bantuan Super Admin. Jika tombol tidak aktif karena **Jumlah tidak cocok**, rekonsiliasi saldo sebelum mencatat nilai. Jika laporan tetap menampilkan **Perlu perbaikan data**, minta pemeriksaan data cost layer sebelum mengulang.
