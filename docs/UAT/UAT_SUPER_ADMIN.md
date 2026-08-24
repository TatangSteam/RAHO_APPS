# UAT Super Admin

Status: siap dipakai untuk UAT, belum berarti seluruh skenario sudah lulus  
Role sistem: `SUPER_ADMIN`  
Pembaruan: 24 Agustus 2026

> Lagi buru-buru? Jalankan **Cek Kilat 20 Menit**, lalu checkpoint `SA-TTR`
> dan `SA-MFA`. Jangan mulai dari tabel panjang.

Dokumen yang terhubung:

- [Pusat Dokumen UAT](./README.md)
- [UAT Admin Manager](./UAT_ADMIN_MANAGER.md)
- [UAT Admin Layanan / MSO](./UAT_ADMIN_LAYANAN_MSO.md)
- [UAT Nakes](./UAT_NAKES.md)
- [UAT Dokter](./UAT_DOKTER.md)
- [UAT Finance & Logistik](./UAT_FINANCE.md)
- [Regresi Finance, Logistik, dan Sesi](./UAT_FINANCE_LOGISTIK_DAN_SESI_TERAPI.md)

## 1. Ringkasan 30 detik

Super Admin adalah pengendali setup, akses, monitoring, dan audit seluruh ERP.

Super Admin harus bisa:

- melihat seluruh cabang tanpa mencampur data saat filter dipilih;
- membuat dan mengelola Admin Manager serta assignment cabangnya;
- membuat Admin Logistik dan Finance & Logistik;
- mengubah Admin Manager menjadi Admin Logistik atau Finance & Logistik tanpa
  memutus histori user;
- mengelola role, permission, cabang, master produk, dan konfigurasi penting;
- memantau alur sesi terapi `TTR` tanpa mengambil alih pekerjaan klinis;
- memantau alur reimburse/expense `MFA` sampai jurnal dan kas-bank;
- melihat audit lintas modul dan melakukan impersonation secara aman;
- mengelola Integrasi Zoho sesuai gate, permission, dan audit.

Super Admin tetap tidak boleh:

- membagikan password seed ke production;
- mengubah actor, status, atau nominal hanya melalui manipulasi request;
- membuat approval, pembayaran, jurnal, atau mutasi stok ganda;
- membocorkan foto, token, atau data klinis melalui URL/log;
- menghapus histori bisnis hanya untuk memperbaiki kesalahan.

## 2. Credential login dari seeding

> Hanya untuk local/test. Jangan gunakan credential ini di production.

| Akun | Email | Password | Staff code | Scope |
|---|---|---|---|---|
| Super Admin | `superadmin@raho.id` | `SuP3r4Dm1n` | `SA-20260413-RAHO` | Global |

Credential pendamping untuk flow lintas role:

| Role | Email | Password | Kegunaan |
|---|---|---|---|
| Admin Manager 1 | `manager1@raho.id` | `Manager@123` | Checker PST + BDG |
| Admin Manager 2 | `manager2@raho.id` | `Manager@123` | Checker SBY + PST |
| Finance & Logistik | `finance@raho.id` | `Finance@123` | Approval, payment, accounting, logistik |
| Admin Cabang PST | `admincabang.pst@raho.id` | `AdminCabang@123` | Verifikasi cabang |
| MSO PST | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | Member, sesi, expense/reimburse |
| Nakes PST | `nakes@raho.id` | `Nakes@123` | Operasional sesi dan inventori tim |
| Dokter PST | `dokter@raho.id` | `Dokter@123` | Evaluasi Dokter |

Sumber credential: `apps/api/prisma/seeds/users.seed.ts`.

Catatan:

- Akun seed `finance@raho.id` memakai template
  `FINANCE_LOGISTICS_CONTROLLER_DEFAULT` dengan role dasar kompatibilitas
  `ADMIN_MANAGER`.
- Akun Finance & Logistik baru dari menu **Tambah User** memakai role
  `FINANCE_LOGISTICS_CONTROLLER`.
- `adminlogistik@raho.id` adalah akun legacy nonaktif. Jangan dipakai untuk UAT.

## 3. Cek Kilat 20 Menit

| No | Lakukan | Harus terjadi | Hasil |
|---:|---|---|---|
| 1 | Login sebagai Super Admin. | Dashboard tampil dengan akses global. | ⬜ |
| 2 | Buka Cabang, Kelola User, Admin Managers, Permission & Role, Master Produk, Audit Log, dan Integrasi Zoho. | Seluruh menu administratif tampil. | ⬜ |
| 3 | Buka Manager 1. | Hanya assignment PST dan BDG tercatat. | ⬜ |
| 4 | Tambah user percobaan dengan role Admin Logistik. | Berhasil tanpa memilih cabang; tampil di Kelola User. | ⬜ |
| 5 | Tambah user percobaan dengan role Finance & Logistik. | Berhasil; seluruh cabang aktif otomatis ter-assign. | ⬜ |
| 6 | Buat Admin Manager percobaan lalu pilih **Jadikan Admin Logistik**. | Role berubah; user ID/histori tetap; manager berpindah ke daftar user. | ⬜ |
| 7 | Buat Admin Manager kedua lalu pilih **Jadikan Finance & Logistik**. | Role/template berubah dan seluruh cabang aktif ter-assign. | ⬜ |
| 8 | Impersonate Manager 1 lalu buka data SBY. | Ditolak sesuai scope Manager, walaupun asalnya Super Admin. | ⬜ |
| 9 | Stop impersonation. | Kembali ke Super Admin; token impersonation lama tidak bisa dipakai. | ⬜ |
| 10 | Buka Audit Log untuk langkah 4-9. | Actor, target user, role lama/baru, waktu, dan hasil tercatat. | ⬜ |
| 11 | Buka hasil flow `TTR-001`. | Assignment, reminder, finalisasi, serta stok konsisten. | ⬜ |
| 12 | Buka hasil flow `MFA-001`. | Approval, payment, jurnal, kas-bank, dan bukti dapat ditelusuri. | ⬜ |

Jika nomor 4, 5, 6, 7, 8, 9, 10, atau 12 gagal: **STOP dan catat defect P0**.

## 4. Peta hubungan antar-UAT

```text
Super Admin menyiapkan cabang, akun, role, permission, dan approval
                         │
        ┌────────────────┼──────────────────┐
        ▼                ▼                  ▼
 Admin Manager      Tim Terapi          Finance & Logistik
 scope + checker    MSO → Nakes → Dokter approval + payment
        │                │                  │
        └────────────────┼──────────────────┘
                         ▼
             laporan + ledger + audit
                         ▼
              Super Admin verifikasi
```

| Kode bersama | Dikerjakan di | Peran Super Admin |
|---|---|---|
| `TTR-001` | UAT MSO + Nakes + Dokter | Setup akun/scope lalu memeriksa hasil sesi, reminder, stok, dan kinerja. |
| `TTR-002` | UAT MSO + Nakes + Dokter | Memastikan pilihan Stok Cabang tidak tercampur Stok Tim. |
| `MFA-001` | UAT MSO/Nakes/Dokter + Admin Cabang + Finance + Manager | Memeriksa urutan approval, payment, jurnal, dan audit. |
| `MFA-002` | UAT role yang sama, nominal besar | Memastikan High Approval hanya muncul setelah Finance dan mengikuti scope Manager. |

## 5. Persiapan sekali saja

- Jalankan migration dan seed pada database khusus UAT.
- Gunakan browser utama untuk Super Admin dan incognito/profil lain untuk role
  pendamping.
- Siapkan suffix run unik, misalnya `UAT-20260824-A`.
- Siapkan dua email manager sementara dan dua email user sementara; jangan
  memakai akun produksi.
- Siapkan member dengan paket aktif, stok cabang, stok tim, dan foto bukti
  reimburse kurang dari 5 MB.
- Catat `userId`, `sessionId`, nomor reimburse, nomor expense, journal ID, dan
  correlation ID yang dipakai bersama.
- Setelah selesai, **nonaktifkan** akun percobaan. Jangan menghapus histori UAT
  yang masih diperlukan untuk audit.

Perintah seed dari root project:

```powershell
npm.cmd run db:seed --prefix apps/api
```

Jangan menjalankan seed testing/complete pada database production.

## 6. Test Case A — Login, akses global, dan keamanan sesi

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| SA-A01 | P0 | Login dengan credential benar. | Login berhasil sebagai `SUPER_ADMIN`. | ⬜ |
| SA-A02 | P1 | Login dengan password salah. | Ditolak tanpa membocorkan keberadaan/detail akun. | ⬜ |
| SA-A03 | P0 | Buka seluruh cabang dan ganti filter PST/BDG/SBY. | Semua dapat dipilih; data mengikuti filter. | ⬜ |
| SA-A04 | P0 | Buka menu sistem, Finance, Logistik, Approval, dan Audit. | Menu sesuai permission Super Admin dapat dibuka. | ⬜ |
| SA-A05 | P0 | Logout lalu gunakan Back/refresh. | Sesi lama tidak dapat dipakai. | ⬜ |
| SA-A06 | P0 | Ubah `userId`, role, atau branch pada request biasa. | Server memakai actor token dan menolak field ilegal. | ⬜ |
| SA-A07 | P0 | Buka URL foto bukti tanpa login. | Akses ditolak. | ⬜ |
| SA-A08 | P0 | Periksa response/log browser. | Password, access token, refresh token, dan secret tidak tampil. | ⬜ |
| SA-A09 | P0 | Jalankan aksi sensitif lalu cek Audit Log. | Actor, IP/user-agent bila tersedia, target, dan perubahan tercatat. | ⬜ |
| SA-A10 | P0 | Kirim aksi yang sama dengan idempotency key sama tetapi payload berbeda. | Konflik; tidak membuat data kedua. | ⬜ |

## 7. Test Case B — Cabang, akun, role, dan permission

Gunakan akun sementara dengan suffix run. Jangan mengubah akun seed utama.

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| SA-B01 | P0 | Buat Admin Manager sementara dengan assignment PST + BDG. | Akun aktif dan hanya dua cabang tercatat. | ⬜ |
| SA-B02 | P0 | Login/impersonate manager tersebut dan akses SBY. | UI/API menolak. | ⬜ |
| SA-B03 | P0 | Tambah/hapus satu assignment cabang Manager. | Scope langsung mengikuti assignment dan audit tercatat. | ⬜ |
| SA-B04 | P0 | Buat Admin Logistik dari **Kelola User → Tambah User**. | Cabang tidak wajib; template Admin Logistik terpasang. | ⬜ |
| SA-B05 | P0 | Buat Finance & Logistik dari menu yang sama. | Cabang tidak wajib di form; cabang aktif ter-assign otomatis. | ⬜ |
| SA-B06 | P0 | Konversi Manager sementara menjadi Admin Logistik. | User ID/email/histori tetap; assignment Manager dilepas. | ⬜ |
| SA-B07 | P0 | Konversi Manager sementara kedua menjadi Finance & Logistik. | Template benar dan semua cabang aktif ter-assign. | ⬜ |
| SA-B08 | P0 | Refresh daftar Admin Managers dan Kelola User. | Akun hasil konversi hilang dari Managers dan tampil pada Kelola User. | ⬜ |
| SA-B09 | P0 | Login akun hasil konversi setelah login ulang. | Menu dan API mengikuti role/template baru, bukan token lama. | ⬜ |
| SA-B10 | P0 | Coba konversi target yang bukan `ADMIN_MANAGER`. | Ditolak tanpa mengubah akun. | ⬜ |
| SA-B11 | P0 | Ubah template/permission sensitif lalu cek audit. | Before/after dan actor tercatat; perubahan tidak diam-diam. | ⬜ |
| SA-B12 | P0 | Nonaktifkan akun percobaan lalu coba login. | Login ditolak; histori user tetap dapat diaudit. | ⬜ |

## 8. Test Case C — Checkpoint sesi terapi terhubung (`SA-TTR`)

Jalankan `TTR-001` dan `TTR-002` pada UAT MSO, Nakes, dan Dokter terlebih
dahulu. Super Admin hanya menyiapkan serta memeriksa; jangan mengisi catatan
klinis atas nama petugas.

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| SA-TTR-01 | P0 | Pastikan akun MSO, Nakes, dan Dokter aktif pada cabang yang sama. | Assignment dapat dipakai membuat sesi. | ⬜ |
| SA-TTR-02 | P0 | Periksa sesi setelah `TTR-01`. | MSO, Nakes, dan Dokter yang di-assign sesuai. | ⬜ |
| SA-TTR-03 | P0 | Periksa audit saat Dokter login terlalu awal. | Tidak ada reminder Evaluasi Dokter sebelum prasyarat lengkap. | ⬜ |
| SA-TTR-04 | P0 | Periksa pekerjaan Nakes sebelum evaluasi. | Reminder hanya menuju petugas operasional assigned. | ⬜ |
| SA-TTR-05 | P0 | Periksa fase menunggu Dokter. | Reminder MSO/Nakes berhenti; hanya Dokter assigned diingatkan. | ⬜ |
| SA-TTR-06 | P0 | Periksa Evaluasi Dokter. | Actor adalah Dokter assigned dan tersimpan satu kali. | ⬜ |
| SA-TTR-07 | P0 | Periksa finalisasi oleh MSO/Nakes. | Sesi selesai satu kali setelah evaluasi tersedia. | ⬜ |
| SA-TTR-08 | P0 | Bandingkan `TTR-001` dan `TTR-002` pada ledger. | Satu memakai Stok Tim; satu memakai Stok Cabang; tidak terpotong ganda. | ⬜ |
| SA-TTR-09 | P1 | Buka Kinerja Staff dan laporan sesi. | Kontribusi ketiga role dan jumlah sesi konsisten. | ⬜ |
| SA-TTR-10 | P0 | Coba akses bukti/catatan dengan user di luar assignment. | Ditolak tanpa kebocoran data. | ⬜ |

## 9. Test Case D — Checkpoint approval dan pembayaran (`SA-MFA`)

Jalankan `MFA-001` dan `MFA-002` menggunakan nomor dokumen yang sama pada UAT
pengaju, Finance, dan Admin Manager.

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| SA-MFA-01 | P0 | Periksa reimburse setelah pengaju submit. | Maker, cabang, nominal, dan foto benar; satu approval terbentuk. | ⬜ |
| SA-MFA-02 | P0 | Periksa setelah Verifikasi Cabang. | Tahap aktif berpindah ke Finance, bukan langsung dibayar. | ⬜ |
| SA-MFA-03 | P0 | Periksa approval Finance untuk nominal standar. | Status menjadi `APPROVED`. | ⬜ |
| SA-MFA-04 | P0 | Periksa nominal besar. | High Approval muncul setelah Finance approve. | ⬜ |
| SA-MFA-05 | P0 | Manager di luar scope mencoba high approve. | Ditolak dan audit access-denied tercatat. | ⬜ |
| SA-MFA-06 | P0 | Manager sesuai scope high approve. | Status menjadi `APPROVED` satu kali. | ⬜ |
| SA-MFA-07 | P0 | Finance membayar reimburse approved. | `PAID`; jurnal dan kas-bank terbentuk tepat sekali. | ⬜ |
| SA-MFA-08 | P0 | Periksa expense buatan MSO/Admin Cabang. | Manager approve lalu Finance bayar sesuai urutan. | ⬜ |
| SA-MFA-09 | P0 | Periksa maker-checker. | Maker tidak memutus dokumennya sendiri/dua tahap yang sama. | ⬜ |
| SA-MFA-10 | P0 | Ulangi approve/pay secara cepat atau concurrent. | Tidak ada keputusan, payment, atau jurnal ganda. | ⬜ |
| SA-MFA-11 | P0 | Jalankan reject/return dengan alasan. | Notifikasi pengaju dan histori keputusan konsisten. | ⬜ |
| SA-MFA-12 | P0 | Telusuri source document sampai GL dan Audit Log. | Nomor dokumen, actor, amount, debit, dan kredit cocok. | ⬜ |

## 10. Test Case E — Master, Finance, Logistik, Zoho, dan audit

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| SA-E01 | P0 | Buat/ubah cabang percobaan lalu cek audit. | Data valid dan perubahan tercatat. | ⬜ |
| SA-E02 | P0 | Buat/ubah master produk percobaan. | SKU unik, akun/UOM valid, dan perubahan dapat ditelusuri. | ⬜ |
| SA-E03 | P0 | Jalankan import dalam mode dry-run. | Validasi tampil tanpa menulis data. | ⬜ |
| SA-E04 | P0 | Periksa request, reservation, shipment, opname, dan adjustment. | Status dan quantity mengikuti ledger; tidak ada mutasi ganda. | ⬜ |
| SA-E05 | P0 | Periksa Inventori Tim dan pinjaman antartim. | Owner, borrower, outstanding, dan histori konsisten. | ⬜ |
| SA-E06 | P0 | Periksa Finance Reports, GL, dan Trial Balance. | Source link tersedia dan debit = kredit. | ⬜ |
| SA-E07 | P0 | Coba posting ke periode tertutup. | Ditolak tanpa menggeser tanggal. | ⬜ |
| SA-E08 | P0 | Buka status/health Integrasi Zoho. | Metadata tampil; OAuth token/secret tidak tampil. | ⬜ |
| SA-E09 | P0 | Jalankan retry job Zoho yang retryable. | Retry aman dan tidak membuat dokumen ganda. | ⬜ |
| SA-E10 | P0 | Coba cutover/go-live tanpa gate lengkap. | Diblok sampai prasyarat/approval terpenuhi. | ⬜ |
| SA-E11 | P0 | Impersonate setiap role utama dan cek menu/scope. | Akses menyempit sesuai target role, bukan tetap Super Admin. | ⬜ |
| SA-E12 | P0 | Stop impersonation dan periksa Audit Log. | Kembali aman ke Super Admin; start/stop dan target tercatat. | ⬜ |

## 11. Ringkasan hasil

| Kelompok | PASS | FAIL | BLOCKED | NOT TESTED |
|---|---:|---:|---:|---:|
| A. Login/akses/keamanan | 0 | 0 | 0 | 10 |
| B. Cabang/akun/role | 0 | 0 | 0 | 12 |
| C. Checkpoint sesi `SA-TTR` | 0 | 0 | 0 | 10 |
| D. Checkpoint approval `SA-MFA` | 0 | 0 | 0 | 12 |
| E. Master/Finance/Logistik/Zoho | 0 | 0 | 0 | 12 |
| **Total** | **0** | **0** | **0** | **56** |

- [ ] **LULUS** — seluruh P0 PASS dan tidak ada data bocor/posting ganda.
- [ ] **LULUS BERSYARAT** — hanya temuan nonkritis dengan rencana perbaikan.
- [ ] **TIDAK LULUS** — ada bypass role/scope, histori putus, data bocor,
  ledger tidak seimbang, atau posting ganda.

| Persetujuan | Nama | Tanggal | Status |
|---|---|---|---|
| Perwakilan Super Admin |  |  |  |
| Perwakilan Admin Manager |  |  |  |
| Perwakilan Finance & Logistik |  |  |  |
| QA/UAT |  |  |  |
| Product Owner |  |  |  |

## 12. Format defect singkat

```text
ID UAT        : SA-...
Run           : UAT-YYYYMMDD-X / TTR-... / MFA-...
Akun/role     :
Cabang        :
Waktu         :
Langkah       :
Hasil aktual  :
Harusnya      :
ID dokumen    :
Screenshot/log:
Severity      : P0 / P1 / P2
```
