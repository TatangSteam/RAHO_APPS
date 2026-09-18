# Mengubah Admin Manager menjadi Logistik atau Finance & Logistik

Fitur ini hanya dapat digunakan oleh **Super Admin**. Pengguna lain tidak bisa mengubah peran melalui endpoint ini.

1. Login sebagai Super Admin.
2. Buka **Dashboard**, lalu tab **Admin Managers**.
3. Cari nama Admin Manager yang ingin diubah.
4. Pilih salah satu tombol pada kolom **Aksi**:
   - **Set Logistik**: mengganti peran menjadi Admin Logistik, tanpa peran Finance.
   - **Set Finance & Logistik**: mengganti peran menjadi Finance & Logistics Controller, dengan assignment seluruh cabang aktif selain cabang `EXT`.
5. Baca konfirmasi dengan teliti, kemudian pilih OK hanya jika akun dan peran sudah benar.
6. Tunggu pesan berhasil. Akun akan keluar dari daftar Admin Managers karena perannya sudah berubah. Akun dapat dicari kembali melalui **Kelola User**.
7. Minta pengguna keluar lalu login ulang supaya menu web sesuai peran barunya.

Ini **pergantian peran, bukan multi-role**: akses dan assignment Admin Manager lama diganti. User ID, profil, serta histori transaksi tidak dihapus. Tidak ada akun yang berubah otomatis; Super Admin harus memilih dan mengonfirmasi.

Jika tombol tidak aktif, akun kemungkinan nonaktif atau ada perubahan peran yang sedang diproses. Jika muncul pesan template role tidak tersedia/aktif, minta administrator sistem memeriksa template IAM `ADMIN_LOGISTIK_DEFAULT` atau `FINANCE_LOGISTICS_CONTROLLER_DEFAULT`; jangan melakukan reset database. Opsi **Detail → Ubah Peran** tetap dapat digunakan.

## Mencabut akses

1. Buka **Dashboard → Admin Managers** sebagai Super Admin.
2. Pada filter **Peran**, pilih **Finance & Logistik** atau **Admin Logistik** sesuai peran akun saat ini.
3. Cari akun, lalu klik **Cabut Akses**.
4. Baca konfirmasi dan pilih OK. Akun kembali menjadi **Admin Manager** dengan template default, tanpa assignment cabang. Semua izin tambahan berjenis **ALLOW** juga dicabut agar akses global tidak tertinggal; aturan **DENY** tetap disimpan.
5. Ubah filter **Peran** ke **Admin Manager** untuk menemukan akun tersebut. Buka **Detail** dan tentukan kembali cabang serta scope yang memang dibutuhkan. Assignment sebelum pemberian Finance/Logistik tidak dikembalikan otomatis.
6. Minta pengguna keluar lalu login ulang agar menu web mengikuti perannya. Backend membaca peran terkini dari database pada setiap request, termasuk jika token lama masih dipakai.

Pencabutan tidak menghapus atau menonaktifkan akun, profil, maupun histori transaksi. Akun nonaktif juga dapat dicabut perannya tanpa mengaktifkannya. Ini mencabut peran khusus dan akses lintas cabang, bukan menghilangkan seluruh kewenangan dasar Admin Manager; pilih scope **Member only** saat mengatur cabang jika hanya akses baca member yang diperlukan.
