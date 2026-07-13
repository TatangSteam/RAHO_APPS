# Import Member Excel - File dan Kolom

Dokumen ini merangkum file yang terlibat pada fitur import akun member dari Excel dan kolom yang harus ada di template.

## File yang Terlibat

| File | Area | Fungsi |
|---|---|---|
| `apps/api/src/modules/members/services/member-account-import.service.ts` | Backend service | Membaca Excel, validasi data, cek duplikat, membuat akun member baru, atau melengkapi data member existing jika cocok. |
| `apps/api/src/modules/members/members.controller.ts` | Backend controller | Endpoint handler untuk `dry-run` dan `execute` import Excel. |
| `apps/api/src/modules/members/members.routes.ts` | Backend route | Route import Excel dan pembatasan akses hanya untuk `SUPER_ADMIN` dan `ADMIN_MANAGER`. |
| `apps/api/src/middleware/upload.ts` | Backend upload | Middleware `uploadSpreadsheet` untuk menerima file `.xlsx`. |
| `apps/web/src/components/branches/MemberAccountImportPanel.tsx` | Frontend component | Tampilan upload Excel, tombol `Cek File`, tombol `Buat Akun`, tabel error lengkap per member, export data tidak lengkap, tabel preview, credential hasil import, dan panduan kolom. |
| `apps/web/src/app/(staff)/branches/[branchId]/page.tsx` | Frontend page | Menampilkan tombol `Import Excel` pada tab `Members` di halaman detail cabang. |
| `apps/web/src/app/(staff)/admin/branches/[branchId]/MemberAccountImportPanel.tsx` | Frontend compatibility | Re-export komponen import agar route lama tetap memakai logic yang sama. |
| `docs/MEMBER-ACCOUNT-IMPORT-TEMPLATE.md` | Dokumentasi | Template kolom Excel dan contoh isi sheet. |

## Kolom Excel

Gunakan file `.xlsx` dengan sheet bernama `Members`. Header kolom bisa berada di baris 1 sampai 10, tetapi disarankan di baris 1.

| Kolom Excel | Wajib | Contoh | Keterangan |
|---|---:|---|---|
| `nama_lengkap` | Ya | `Budi Santoso` | Nama lengkap member, minimal 3 karakter. |
| `tanggal_lahir` | Ya | `1990-05-21` | Format disarankan `YYYY-MM-DD`. |
| `no_hp` | Tidak | `081234567890` | Opsional. Jika diisi minimal 10 digit. |
| `username` | Tidak | `budi.santoso` | Jika kosong, sistem membuat username otomatis dari nama dan nomor unik. |
| `password` | Tidak | `RahoMember123` | Jika kosong, sistem membuat password otomatis. Jika diisi, minimal 8 karakter. |
| `nik` | Tidak | `3273010101900001` | Harus 16 digit dan unik jika diisi. |
| `tipe_identitas` | Tidak | `NIK` | Nilai: `NIK`, `PASSPORT`, `KITAS`, `VIP`, `SPECIAL`, `FOREIGN_AUTO`, `NO_NIK`. Default `NIK`. |
| `tempat_lahir` | Tidak | `Bandung` | Tempat lahir member. |
| `jenis_kelamin` | Tidak | `L` | Isi `L` / `P`, atau `Laki-laki` / `Perempuan`. |
| `agama` | Tidak | `Islam` | Agama member. |
| `email` | Tidak | `budi@example.com` | Data referensi saja; login member memakai `username`. |
| `alamat` | Tidak | `Jl. Merdeka No. 10` | Alamat member. |
| `pekerjaan` | Tidak | `Wiraswasta` | Pekerjaan member. |
| `status_nikah` | Tidak | `Menikah` | Status pernikahan. |
| `kontak_darurat` | Tidak | `Siti Santoso` | Nama kontak darurat. |
| `no_hp_kontak_darurat` | Tidak | `081298765432` | Nomor kontak darurat. |
| `sumber_info_raho` | Tidak | `Instagram` | Sumber informasi RAHO. |
| `kode_pos` | Tidak | `40111` | Kode pos. |
| `kode_referral` | Tidak | `REF-001` | Harus cocok dengan kode referral aktif jika diisi. |
| `consent_foto` | Tidak | `Ya` | Isi `Ya` / `Tidak`. Default `Ya`. |

## Validasi Import

| Validasi | Dampak Jika Gagal |
|---|---|
| File harus `.xlsx` valid | Import ditolak sebelum membaca row. |
| `nama_lengkap`, `tanggal_lahir` wajib ada | Row ditandai error saat `Cek File`. |
| Username duplikat di Excel atau database | Import ditolak. |
| NIK duplikat di Excel atau database | Import ditolak. |
| Nama + tanggal lahir sama di Excel | Import ditolak. |
| Nama + tanggal lahir sama di database cabang mana pun | Import ditolak. |
| Kode referral tidak aktif/tidak ditemukan | Import ditolak untuk row terkait. |
| NIK cocok dengan member existing | Row diproses sebagai update untuk melengkapi field yang masih kosong. |
| Nama + tanggal lahir cocok dengan member existing | Row diproses sebagai update untuk melengkapi field yang masih kosong. |
| NIK mengarah ke member A tetapi nama + tanggal lahir mengarah ke member B | Import ditolak karena data ambigu. |

## Import Ulang untuk Melengkapi Data

Jika file Excel diimport ulang dan sistem menemukan member existing berdasarkan `nik` atau kombinasi `nama_lengkap` + `tanggal_lahir`, sistem tidak membuat member baru. Sistem hanya mengisi field member yang masih kosong, misalnya `no_hp`, `alamat`, `pekerjaan`, `kontak_darurat`, dan data profil lain yang tersedia di Excel.

Jika `Cek File` menemukan data tidak valid, UI akan menampilkan nama member, NIK, tanggal lahir, nomor HP, dan masalahnya. Tombol `Export Data Tidak Lengkap` menghasilkan CSV agar data tersebut bisa diperbaiki lalu diimport ulang.
