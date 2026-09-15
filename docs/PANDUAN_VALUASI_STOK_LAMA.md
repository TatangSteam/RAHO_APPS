# Panduan Singkat: Isi HPP Stok Lama

Gunakan panduan ini jika Dashboard Logistik menampilkan **Belum dinilai** atau **Pending valuation**, atau transaksi ditolak karena stok belum mempunyai HPP. Stoknya sudah ada; yang belum dicatat adalah nilainya.

## Langkah penggunaan

1. Masuk sebagai **Super Admin** dan buka **Inventori → Dashboard Logistik → Nilai Stok**.
2. Pilih cabang transaksi dan cari SKU atau nama produk. Daftar **Belum dinilai** menampilkan stok yang perlu HPP.
3. Siapkan dokumen sumber harga pokok (invoice, PO, atau dokumen stok awal). Cocokkan jumlah stok yang tampil.
4. Klik **Isi HPP**, masukkan **HPP per unit** dan **nomor dokumen**, lalu klik **Simpan HPP**.
5. Pastikan **Stok perlu HPP** berkurang atau status SKU menjadi **Stok siap dijual**. Coba transaksi lagi bila sebelumnya gagal.

Tindakan ini **tidak menambah atau mengurangi jumlah stok**. Sistem mencatat nilai persediaan, jurnal saldo awal, dan audit. Jangan membuat penerimaan barang atau opening stock baru untuk stok lama yang sudah ada, karena jumlahnya akan tergandakan. **Harga jual bukan HPP**; gunakan harga pokok dari dokumen.

Jika tombol **Isi HPP** tidak muncul, minta bantuan Super Admin. Jika layar meminta **Periksa data stok**, minta Admin mencocokkan data stok dahulu; jangan menambah stok baru untuk menutup selisih.

## Jika SKU tidak muncul

Menu yang dahulu disebut **Valuation** sekarang bernama **Nilai Stok**. Pilih **cabang transaksi**, lalu ketik SKU pada **Cari produk** (pencarian berjalan otomatis atau dengan tombol **Cari**). Untuk Air Nano Biru 600 ml per dus, SKU jual `PRD-ANN-BRU-003` memakai stok botol `PRD-ANN-BRU-001`—cari SKU botolnya.

Status SKU di atas daftar menjelaskan langkah berikutnya:

- **Belum ada di cabang**: periksa cabang transaksi dan pengaturan produk inventori.
- **Stok perlu HPP**: Super Admin klik **Isi HPP** pada produk atau pada hasil pencarian jika barisnya belum ada.
- **Stok ada di lokasi lain** atau **data stok perlu diperiksa**: minta Admin memperbaiki lokasi/data stok lebih dulu. Jangan menambah stok baru hanya untuk membuat SKU muncul.
