# Laporan Update ERP RAHO — 24 Agustus 2026

Waktu laporan dibuat: **24 Agustus 2026, 16.19 WIB**  
Zona waktu: **Asia/Jakarta (UTC+7)**  
Sumber waktu: timestamp commit Git pada branch aktif

> **Versi singkat:** hari ini ada pembaruan deployment workflow, Program
> Sosial Rp500.000, perbaikan test Approval Inbox, pembuatan/konversi Admin
> Logistik dan Finance & Logistik, serta UAT Super Admin yang terhubung dengan
> seluruh role.

## 1. Commit yang Anda lakukan hari ini

Author Git Anda: **Etherlyvan (`jovanku1@gmail.com`)**.

| Jam WIB | Commit yang Anda lakukan | Dampak singkat | Hash |
|---:|---|---|---|
| 14.12.25 | `feat(social-program): add approved Rp500k therapy and free booster flow` | Menambahkan Program Sosial Rp500.000, booster gratis dengan approval, API, UI, migration, test, dokumentasi, dan UAT per role. | `ccaf524` |
| 14.12.51 | `Merge branch 'main' of https://github.com/TatangSteam/RAHO_APPS` | Menggabungkan pembaruan branch `main` ke pekerjaan lokal. Ini commit integrasi, bukan fitur baru tersendiri. | `9c29bcc` |
| 14.59.14 | `test(approvals): update decision button contract assertions` | Menyesuaikan contract test Approval Inbox dan menambahkan report aplikasi untuk PowerPoint non-IT. | `3f2994d` |
| 15.55.30 | `feat(iam): add logistics and finance admin creation and conversion` | Menambahkan pembuatan Admin Logistik/Finance & Logistik serta konversi Admin Manager tanpa memutus histori user. | `cb0fda2` |
| 15.57.42 | `docs(uat): add connected super admin UAT scenarios` | Menambahkan 56 test case Super Admin dan tautan ke seluruh UAT role terkait. | `a72f73d` |

Total commit Anda pada 24 Agustus 2026 sampai pukul 16.19 WIB: **5 commit**.

### Commit author lain yang ikut terlihat pada riwayat hari ini

Kedua commit berikut dibuat oleh **DawudRizky (`dawud.091002@gmail.com`)**,
bukan oleh author Git Anda:

| Jam WIB | Commit | Hash |
|---:|---|---|
| 09.07.02 | `chore(actions): rename file and specify runner` | `fee9131` |
| 09.22.08 | `fix(actions): file name change` | `f10f36c` |

Laporan ini dibuat pukul **16.19 WIB** dan masih belum di-commit pada saat
pemeriksaan.

## 2. Detail perubahan yang dirasakan pengguna

### A. Program Sosial

Mulai pukul **14.12 WIB**, tersedia flow Program Sosial dengan ketentuan:

- produk sosial menggunakan kode `SRV-TNB-TRP-PS-001`;
- harga Terapi Nano Bubble Basic sosial Rp500.000 per sesi;
- booster dapat diberikan gratis jika disetujui;
- pengajuan mempunyai alasan, jumlah sesi, nilai subsidi, dan approval;
- detail Program Sosial tampil di Approval Inbox;
- perubahan paket, pembatalan, refund, dan saldo voucher mengikuti perlindungan
  Program Sosial;
- histori keputusan dan subsidi dapat diaudit.

Perubahan ini membawa migration database
`20260824120000_add_social_treatment_program` dan perlu masuk dalam prosedur
deployment database.

### B. Approval Inbox dan report non-IT

Mulai pukul **14.59 WIB**:

- contract test Approval Inbox mengikuti aksi keputusan yang aktual;
- tombol tetap mendukung **Setujui**, **Tolak**, dan **Minta Perbaikan** sesuai
  jenis dokumen;
- report aplikasi untuk bahan presentasi non-IT ditambahkan pada
  `docs/REPORT_APLIKASI_RAHO_UNTUK_POWERPOINT_NON_IT.md`.

### C. Admin Logistik dan Finance & Logistik

Mulai pukul **15.55 WIB**, Super Admin mempunyai dua jalur:

```text
Kelola User → Tambah User
├── Admin Logistik
└── Finance & Logistik

Admin Managers → Detail Manager
├── Jadikan Admin Logistik
└── Jadikan Finance & Logistik
```

Aturan keamanannya:

- hanya Super Admin yang dapat melakukan konversi;
- user ID, email, dan histori bisnis tetap menggunakan akun yang sama;
- perubahan dilakukan secara atomik;
- Admin Logistik menjadi akun logistik global;
- Finance & Logistik mendapat template yang sesuai dan assignment seluruh
  cabang aktif;
- akun hasil konversi berpindah dari daftar Admin Managers ke Kelola User;
- perubahan role dan scope dicatat dalam Audit Log;
- akun perlu login ulang agar token memakai hak akses terbaru.

Pembaruan ini **tidak menambah migration database baru** karena enum role dan
template IAM sudah tersedia dari migration sebelumnya.

### D. UAT Super Admin

Mulai pukul **15.57 WIB**, tersedia dokumen UAT Super Admin yang berisi:

- credential sesuai seeding;
- Cek Kilat 20 Menit;
- 56 test case lengkap;
- pembuatan akun dan konversi role;
- impersonation dan pembatasan scope;
- checkpoint sesi terapi `SA-TTR`;
- checkpoint reimburse/expense `SA-MFA`;
- pemeriksaan master, Finance, Logistik, Zoho, dan Audit Log;
- format defect dan lembar persetujuan.

Dokumen: [UAT Super Admin](./UAT/UAT_SUPER_ADMIN.md).

## 3. Hubungan dengan fitur yang dibuat sebelumnya

Dua update tanggal **21 Agustus 2026** menjadi fondasi flow hari ini:

| Tanggal dan jam WIB | Fitur | Commit |
|---|---|---|
| 21 Agustus 2026, 15.04 | Pilihan Stok Cabang atau Stok Tim serta peminjaman barang antartim. | `37d6f44` |
| 21 Agustus 2026, 17.28 | Pengajuan reimburse, bukti foto, approval berjenjang, dan pembayaran. | `31c89b9` |

Hubungan flow lengkapnya:

```text
Super Admin menyiapkan akun + scope
        ↓
MSO/Nakes/Dokter menjalankan sesi TTR
        ↓
Pilih Stok Cabang atau Stok Tim
        ↓
Pengaju membuat reimburse + foto
        ↓
Admin Cabang → Finance → Manager → Finance bayar
        ↓
Super Admin memeriksa laporan dan audit
```

## 4. Dokumentasi yang ditambahkan atau diperbarui

- `docs/UAT/UAT_SUPER_ADMIN.md`
- `docs/UAT/README.md`
- `docs/UAT/UAT_ADMIN_MANAGER.md`
- `docs/UAT/UAT_ADMIN_LAYANAN_MSO.md`
- `docs/UAT/UAT_NAKES.md`
- `docs/UAT/UAT_DOKTER.md`
- `docs/UAT/UAT_FINANCE.md`
- `docs/UAT/UAT_FINANCE_LOGISTIK_DAN_SESI_TERAPI.md`
- `docs/REPORT_APLIKASI_RAHO_UNTUK_POWERPOINT_NON_IT.md`
- `docs/DEPLOYMENT_PROGRAM_SOSIAL.md`
- `docs/REGISTER_FITUR_ERP_LENGKAP_DAN_TIMELINE.md`

## 5. Status verifikasi pada saat laporan dibuat

| Pemeriksaan | Status |
|---|---|
| Working tree tepat sebelum laporan ini dibuat | Bersih |
| File laporan ini | Baru, belum di-commit saat pukul 16.19 WIB |
| Commit terbaru | `a72f73d` — 15.57 WIB |
| Type-check API untuk fitur IAM terbaru | Lulus |
| Build API untuk fitur IAM terbaru | Lulus |
| Type-check Web untuk fitur IAM terbaru | Lulus |
| Lint API dan Web untuk fitur IAM terbaru | Lulus |
| Targeted test IAM/API/Web terbaru | Lulus |
| Link lokal seluruh UAT Super Admin | Lulus |

## 6. Catatan penting tentang waktu

- Jam pada laporan ini adalah **waktu commit Git**, bukan otomatis waktu
  deployment production.
- Commit yang sudah ada belum membuktikan server production sudah menjalankan
  versi tersebut.
- Waktu deployment harus diambil dari GitHub Actions atau log deployment
  server dan dicatat terpisah.
- Jangan menulis status **Sudah Production** sebelum migration, build, restart,
  health check, dan smoke test production benar-benar selesai.

## 7. Kolom pencatatan deployment

Isi bagian ini setelah proses deployment dijalankan:

| Tahap | Tanggal/Jam WIB | Pelaksana | Hasil/Bukti |
|---|---|---|---|
| Backup sebelum deployment |  |  |  |
| Migration database |  |  |  |
| Deploy API |  |  |  |
| Deploy Web |  |  |  |
| Restart service |  |  |  |
| Health check |  |  |  |
| Smoke test Super Admin |  |  |  |
| Smoke test Program Sosial |  |  |  |
| Smoke test Finance & Logistik |  |  |  |
| Persetujuan go-live |  |  |  |
