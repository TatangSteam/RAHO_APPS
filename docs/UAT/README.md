# Pusat Dokumen UAT RAHO

Status: panduan UAT development/staging  
Pembaruan: 24 Agustus 2026

> Mulai dari halaman ini. Semua dokumen UAT berada dalam folder `docs/UAT`.
> Credential di bawah hanya untuk database local/test hasil seeding.

## Pilih dokumen sesuai role

| Saya menguji sebagai | Buka ini | Mulai dari |
|---|---|---|
| Admin Layanan / MSO | [UAT Admin Layanan / MSO](./UAT_ADMIN_LAYANAN_MSO.md) | Cek Kilat + `TTR` |
| Nakes / Perawat | [UAT Nakes](./UAT_NAKES.md) | Cek Kilat + `TTR` |
| Dokter | [UAT Dokter](./UAT_DOKTER.md) | Cek Kilat + `TTR` |
| Admin Manager | [UAT Admin Manager](./UAT_ADMIN_MANAGER.md) | Cek Kilat + `MFA` |
| Finance & Logistik | [UAT Finance](./UAT_FINANCE.md) | Cek Kilat + `MFA` |
| QA regresi penuh | [Regresi Finance, Logistik, dan Sesi](./UAT_FINANCE_LOGISTIK_DAN_SESI_TERAPI.md) | Jalankan setelah UAT per role |

## Credential cepat dari seed

> Jangan memakai credential seed di production.

| Role | Email | Password | Scope utama |
|---|---|---|---|
| Admin Manager 1 | `manager1@raho.id` | `Manager@123` | Jakarta (`PST`) + Bandung (`BDG`) |
| Admin Manager 2 | `manager2@raho.id` | `Manager@123` | Surabaya (`SBY`) + Jakarta (`PST`) |
| Finance & Logistik | `finance@raho.id` | `Finance@123` | Semua cabang seed |
| MSO Jakarta | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | Jakarta |
| MSO Bandung | `adminlayanan.bdg@raho.id` | `AdminLayanan@123` | Bandung |
| MSO Surabaya | `adminlayanan.sby@raho.id` | `AdminLayanan@123` | Surabaya |
| Admin Cabang Jakarta | `admincabang.pst@raho.id` | `AdminCabang@123` | Jakarta |
| Admin Cabang Bandung | `admincabang.bdg@raho.id` | `AdminCabang@123` | Bandung |
| Admin Cabang Surabaya | `admincabang.sby@raho.id` | `AdminCabang@123` | Surabaya |
| Nakes Jakarta/Bandung/Surabaya | `nakes@raho.id`, `nakes2@raho.id`, `nakes3@raho.id` | `Nakes@123` | Sesuai cabang/assignment |
| Dokter Jakarta/Bandung/Surabaya | `dokter@raho.id`, `dokter2@raho.id`, `dokter3@raho.id` | `Dokter@123` | Sesuai cabang/assignment |
| Super Admin (setup saja) | `superadmin@raho.id` | `SuP3r4Dm1n` | Global |

Catatan penting:

- `finance@raho.id` adalah akun Finance & Logistik aktif dengan template
  `FINANCE_LOGISTICS_CONTROLLER_DEFAULT` dan role dasar kompatibilitas
  `ADMIN_MANAGER`.
- `adminlogistik@raho.id` adalah akun lama yang dinonaktifkan oleh seed. Jangan
  menggunakannya untuk UAT baru.
- Scope berasal dari `ManagerBranch`/`StaffBranch`, bukan dari pilihan URL.

Sumber: `apps/api/prisma/seeds/users.seed.ts`.

## Urutan tercepat

```text
1. Seed database test
2. TTR: MSO -> Nakes -> Dokter -> MSO/Nakes
3. MFA: Pengaju -> Admin Cabang -> Finance -> Manager -> Finance
4. Manager cek laporan/audit
5. Finance cek jurnal, kas/bank, dan rekonsiliasi
```

Perintah seed dari root project:

```powershell
npm.cmd run db:seed --prefix apps/api
```

Jangan menjalankan seed testing/complete pada database production.

## Flow bersama 1 — sesi terapi (`TTR`)

Gunakan satu kode, misalnya `TTR-001`, pada UAT MSO, Nakes, dan Dokter.

```text
MSO buat sesi + assign
        -> Nakes isi pekerjaan operasional
        -> Dokter baru menerima reminder Evaluasi Dokter
        -> Dokter isi evaluasi
        -> MSO/Nakes pilih Stok Cabang atau Stok Tim
        -> finalisasi satu kali
        -> Manager pantau kinerja
        -> Finance cek ledger/nilai bila diperlukan
```

Aturan kunci: Dokter tidak menerima reminder sebelum prasyarat evaluasi lengkap.

## Flow bersama 2 — approval dan pembayaran (`MFA`)

Gunakan kode run, misalnya `MFA-001`. Satu nomor reimburse/expense yang sama
harus dicatat pada seluruh dokumen terkait.

| ID | Pelaku | Aksi singkat | Harus terjadi |
|---|---|---|---|
| MFA-01 | MSO/Nakes/Dokter | Buat reimburse valid + foto, lalu Ajukan. | Status `PENDING_APPROVAL`; satu approval terbentuk. |
| MFA-02 | Admin Cabang | Buka Approval Inbox dan verifikasi cabang. | Berpindah ke tahap Persetujuan Finance. |
| MFA-03 | Finance | Periksa nominal, foto, rekening, dan cabang; Approve. | Reimburse standar `APPROVED`; nominal besar maju ke tahap berikut. |
| MFA-04 | Admin Manager | Untuk nominal >= Rp10.000.000, lakukan high approval memakai manager sesuai scope. | Status menjadi `APPROVED`; manager di luar scope ditolak. |
| MFA-05 | Finance | Pilih akun beban + kas/bank, lalu Bayar. | Status `PAID`; jurnal dan transaksi kas/bank terbentuk sekali. |
| MFA-06 | Pengaju | Buka notifikasi/daftar reimburse. | Status pembayaran dan referensi tampil, tetapi jurnal sensitif tidak bocor. |
| MFA-07 | MSO/Admin Cabang | Buat expense dengan evidence dan Submit. | Masuk Approval Inbox Manager; maker tidak dapat approve sendiri. |
| MFA-08 | Admin Manager | Approve expense dalam scope. | Expense `APPROVED`; keputusan dan audit tercatat. |
| MFA-09 | Finance | Bayar expense yang sudah approved. | Expense `PAID`; debit beban = kredit kas/bank. |
| MFA-10 | Manager + Finance | Klik approve/pay ulang atau ulangi request yang sama. | Tidak ada keputusan, jurnal, atau pembayaran ganda. |
| MFA-11 | Manager + Finance | Uji `RETURN_FOR_REVISION`/reject dengan alasan. | Pengaju mendapat notifikasi; histori lama tetap ada. |
| MFA-12 | Semua | Coba ID cabang/dokumen di luar scope. | UI dan API menolak tanpa membocorkan foto/data. |

Pembagian tanggung jawab:

- MSO/Nakes/Dokter: membuat klaim milik sendiri.
- Admin Cabang: verifikasi operasional cabang.
- Finance: persetujuan Finance dan pembayaran.
- Admin Manager: high approval, approval expense, monitoring, dan audit.

## Aturan lulus yang tidak boleh ditawar

- Semua test P0 harus `PASS`.
- Tidak ada akses lintas cabang tanpa assignment.
- Maker tidak boleh memutuskan dokumennya sendiri.
- Foto klinis/reimburse tidak bisa dibuka tanpa otorisasi.
- Satu aksi bisnis hanya membentuk satu mutasi stok atau satu posting uang.
- Total debit harus sama dengan total kredit.
- Jika salah satu aturan ini gagal, hasil UAT adalah **TIDAK LULUS**.

