# Template Excel Import Akun Member Cabang

Gunakan file `.xlsx` dengan sheet bernama `Members`. Baris pertama berisi header berikut.

| Kolom Excel | Wajib | Contoh | Keterangan |
|---|---:|---|---|
| `nama_lengkap` | Ya | `Budi Santoso` | Nama lengkap member, minimal 3 karakter. |
| `tanggal_lahir` | Ya | `1990-05-21` | Format disarankan `YYYY-MM-DD`; format tanggal Excel juga didukung. |
| `no_hp` | Tidak | `081234567890` | Opsional. Jika diisi minimal 10 digit, disimpan ke profil user. |
| `username` | Tidak | `budi.santoso` | Jika kosong, sistem membuat username otomatis dari nama dan nomor unik. |
| `password` | Tidak | `RahoMember123` | Jika kosong, sistem membuat password otomatis. Jika diisi, minimal 8 karakter. |
| `nik` | Tidak | `3273010101900001` | Harus 16 digit dan unik jika diisi. |
| `tipe_identitas` | Tidak | `NIK` | Nilai yang didukung: `NIK`, `PASSPORT`, `KITAS`, `VIP`, `SPECIAL`, `FOREIGN_AUTO`, `NO_NIK`. Default `NIK`. |
| `tempat_lahir` | Tidak | `Bandung` | Tempat lahir member. |
| `jenis_kelamin` | Tidak | `L` | Isi `L` / `P`, atau `Laki-laki` / `Perempuan`. |
| `agama` | Tidak | `Islam` | Agama member. |
| `email` | Tidak | `budi@example.com` | Data referensi saja; login member memakai kolom `username`. |
| `alamat` | Tidak | `Jl. Merdeka No. 10` | Alamat member. |
| `pekerjaan` | Tidak | `Wiraswasta` | Pekerjaan member. |
| `status_nikah` | Tidak | `Menikah` | Status pernikahan. |
| `kontak_darurat` | Tidak | `Siti Santoso` | Nama kontak darurat. |
| `no_hp_kontak_darurat` | Tidak | `081298765432` | Nomor kontak darurat. |
| `sumber_info_raho` | Tidak | `Instagram` | Sumber informasi RAHO. |
| `kode_pos` | Tidak | `40111` | Kode pos. |
| `kode_referral` | Tidak | `REF-001` | Harus cocok dengan kode referral aktif jika diisi. |
| `consent_foto` | Tidak | `Ya` | Isi `Ya` / `Tidak`. Default `Ya`. |

## Contoh Isi Sheet

| nama_lengkap | tanggal_lahir | no_hp | username | password | nik | tipe_identitas | tempat_lahir | jenis_kelamin | agama | email | alamat | pekerjaan | status_nikah | kontak_darurat | no_hp_kontak_darurat | sumber_info_raho | kode_pos | kode_referral | consent_foto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Budi Santoso | 1990-05-21 | 081234567890 | budi.santoso | RahoMember123 | 3273010101900001 | NIK | Bandung | L | Islam | budi@example.com | Jl. Merdeka No. 10 | Wiraswasta | Menikah | Siti Santoso | 081298765432 | Instagram | 40111 | REF-001 | Ya |
| Maria Wijaya | 1988-11-03 | 082112223333 |  |  |  | NO_NIK | Jakarta | P | Katolik |  | Jl. Sudirman No. 5 | Karyawan | Belum Menikah | Andi Wijaya | 082144445555 | Teman | 10220 |  | Tidak |

## Flow Import

1. Buka halaman Cabang.
2. Pilih file Excel `.xlsx`.
3. Klik `Cek File` untuk validasi tanpa membuat data.
4. Jika valid, klik `Buat Akun`.
5. Sistem membuat `User` role `MEMBER`, data `Member`, akses cabang, nomor member, dan notifikasi welcome.
6. Username/password hasil import tampil setelah proses selesai, termasuk password otomatis untuk baris yang kolom password-nya kosong.
