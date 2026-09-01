# Development Flow — Penghapusan Member

Dokumen ini menjelaskan dua tindakan yang tersedia untuk Super Admin: **Nonaktifkan Member** dan **Destruction Member**. Keduanya sengaja dipisahkan karena tujuan dan risikonya berbeda.

## 1. Nonaktifkan Member

Gunakan ini untuk member operasional yang tidak boleh login atau muncul sebagai member aktif, tetapi riwayat klinis dan keuangannya tetap harus disimpan.

Alurnya:

1. Super Admin membuka detail member dan memilih **Nonaktifkan**.
2. Frontend meminta konfirmasi.
3. Backend menjalankan satu transaksi database.
4. `Member.isActive` dan `User.isActive` diubah menjadi `false` bersama-sama.
5. Diagnosis, sesi, paket, invoice, dokumen, dan audit lama tidak dihapus.
6. Perubahan dicatat sebagai audit `DEACTIVATE_MEMBER` dan status kontak diteruskan ke outbox integrasi Zoho.

Jika salah satu pembaruan gagal, transaksi dibatalkan sehingga status member dan akun login tidak mungkin berbeda.

Endpoint:

```text
DELETE /api/v1/members/:memberId
```

## 2. Destruction Member

Gunakan hanya untuk data dummy, salah input fatal, atau member yang belum memiliki transaksi final. Tindakan ini menghapus data secara permanen.

### Preview dan guard

1. Super Admin memilih **Destruction Member**.
2. Frontend memanggil endpoint preview.
3. Backend menghitung sesi, paket, invoice, diagnosis, therapy plan, hasil lab, dokumen, add-on, dan pembelian non-terapi.
4. Backend memeriksa blocker immutable.
5. Jika aman, Super Admin harus mengetik nomor member, frasa `DESTRUCTION MEMBER`, dan mencentang pernyataan pemahaman.

Endpoint preview:

```text
GET /api/v1/members/:memberId/destruction-preview
```

### Kondisi yang memblokir destruction

Destruction ditolak jika ditemukan salah satu kondisi berikut:

- akun member merupakan akun staff/employee;
- sesi sudah selesai atau sudah diposting;
- paket sudah dibayar, diverifikasi, atau direfund;
- invoice sudah final atau mempunyai payment;
- sudah terdapat deferred revenue atau revenue recognition;
- add-on sudah dibayar atau diposting ke inventory;
- pembelian non-terapi sudah dibayar/diverifikasi;
- sesi terhubung dengan pemakaian tas homecare.

Data final harus dibatalkan melalui workflow reversal yang sesuai. Riwayat pembukuan dan inventory tidak boleh dihapus langsung.

### Eksekusi destruction

1. Backend memvalidasi ulang frasa dan nomor member.
2. Semua sesi yang masih draft dihapus melalui service penghapusan sesi.
3. Dampak stok sesi draft dikembalikan dan pemakaian voucher paket dikoreksi.
4. Backend mengunci member dan memeriksa ulang bahwa tidak ada data immutable baru.
5. Reservasi stok add-on yang masih aktif dilepas.
6. Data klinis, paket, invoice draft, dokumen, komunikasi, akses cabang, chat, mapping integrasi, akun member, dan relasi lainnya dihapus sesuai urutan foreign key.
7. File MinIO dihapus setelah transaksi database berhasil agar kegagalan storage tidak membatalkan konsistensi database.
8. Audit `DESTRUCTION_MEMBER` disimpan dengan ringkasan data dan hasil pembersihan file.

Endpoint eksekusi:

```text
DELETE /api/v1/members/:memberId/destruction

{
  "confirmation": "DESTRUCTION MEMBER",
  "memberNo": "<nomor-member>"
}
```

## Ringkasan keputusan

```text
Perlu mempertahankan riwayat?
├─ Ya  → Nonaktifkan Member
└─ Tidak
   ├─ Ada data final/posted? → Batalkan/reversal terlebih dahulu
   └─ Hanya data draft?      → Destruction Member
```
