# UAT Admin Manager

Status: siap dipakai untuk UAT, belum berarti seluruh skenario sudah lulus  
Role sistem: `ADMIN_MANAGER`  
Pembaruan: 24 Agustus 2026

> Lagi buru-buru? Jalankan **Cek Kilat 15 Menit** lalu flow `MFA`.

Dokumen terkait:

- [Pusat Dokumen UAT](./README.md)
- [UAT Super Admin](./UAT_SUPER_ADMIN.md)
- [UAT Finance](./UAT_FINANCE.md)
- [UAT Admin Layanan / MSO](./UAT_ADMIN_LAYANAN_MSO.md)
- [UAT Nakes](./UAT_NAKES.md)
- [UAT Dokter](./UAT_DOKTER.md)

## 1. Ringkasan 30 detik

Admin Manager harus bisa mengawasi cabang yang ditugaskan, melihat operasional
member/sesi/staff, mengelola logistik dan Finance sesuai permission, memproses
approval, serta memeriksa laporan dan audit.

Admin Manager tidak boleh melihat cabang di luar assignment, menyetujui dokumen
buatannya sendiri, mengelola Super Admin/Permission & Role, atau membuka
Integrasi Zoho yang khusus Super Admin/Finance Controller.

## 2. Credential dari seeding

> Hanya untuk local/test. Jangan gunakan di production.

| Akun | Email | Password | Staff code | Scope |
|---|---|---|---|---|
| Manager 1 | `manager1@raho.id` | `Manager@123` | `AM-20260413-REG1` | Jakarta + Bandung |
| Manager 2 | `manager2@raho.id` | `Manager@123` | `AM-20260413-REG2` | Surabaya + Jakarta |

Credential pendamping:

| Role | Email | Password | Kegunaan |
|---|---|---|---|
| Finance | `finance@raho.id` | `Finance@123` | Approve/pay dan posting |
| MSO Jakarta | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | Maker expense/reimburse dan sesi |
| Admin Cabang Jakarta | `admincabang.pst@raho.id` | `AdminCabang@123` | Verifikasi reimburse |
| Nakes Jakarta | `nakes@raho.id` | `Nakes@123` | Operasional sesi/reimburse |
| Dokter Jakarta | `dokter@raho.id` | `Dokter@123` | Evaluasi/reimburse |

Sumber: `apps/api/prisma/seeds/users.seed.ts`.

## 3. Cek Kilat 15 Menit

| No | Lakukan | Harus terjadi | Hasil |
|---:|---|---|---|
| 1 | Login `manager1@raho.id`. | Role Admin Manager; Jakarta dan Bandung tersedia. | ⬜ |
| 2 | Cari data Surabaya. | Tidak tampil/ditolak. | ⬜ |
| 3 | Buka Dashboard, Member, Kinerja Staff, Laporan, Approval Inbox, dan Audit Log. | Semua halaman sesuai scope dapat dibuka. | ⬜ |
| 4 | Buka output sesi `TTR-001`. | Sesi selesai dan kontribusi staff terlihat tanpa mengubah catatan klinis. | ⬜ |
| 5 | Approve expense buatan MSO Jakarta. | Expense menjadi `APPROVED`. | ⬜ |
| 6 | Minta Finance membayar expense. | Menjadi `PAID`; jurnal/kas-bank terbentuk sekali. | ⬜ |
| 7 | High approve reimburse >= Rp10 juta setelah Finance approval. | Reimburse menjadi `APPROVED`. | ⬜ |
| 8 | Ulangi approval yang sama. | Ditolak/idempotent; tidak ada keputusan ganda. | ⬜ |

Jika nomor 2, 5, 6, 7, atau 8 gagal: **STOP dan catat defect P0**.

## 4. Flow harian

```text
Pantau cabang -> cek antrean -> periksa bukti/nominal
-> approve/reject/revisi -> pantau pembayaran Finance
-> cek laporan + audit -> tindak lanjuti selisih
```

Untuk flow lintas role lengkap, jalankan `MFA-01` sampai `MFA-12` pada
[Pusat Dokumen UAT](./README.md#flow-bersama-2--approval-dan-pembayaran-mfa).

## 5. Test Case A — Login, menu, dan scope

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| AM-A01 | P0 | Login Manager 1 dengan credential benar. | Login berhasil sebagai `ADMIN_MANAGER`. | ⬜ |
| AM-A02 | P1 | Login dengan password salah. | Ditolak tanpa membocorkan detail akun. | ⬜ |
| AM-A03 | P0 | Lihat filter cabang Manager 1. | Hanya PST dan BDG. | ⬜ |
| AM-A04 | P0 | Lihat filter cabang Manager 2. | Hanya SBY dan PST. | ⬜ |
| AM-A05 | P0 | Manager 1 akses ID/URL data SBY. | UI/API menolak dan data tidak bocor. | ⬜ |
| AM-A06 | P0 | Manager 2 akses ID/URL data BDG. | UI/API menolak dan data tidak bocor. | ⬜ |
| AM-A07 | P1 | Logout lalu gunakan tombol Back. | Sesi lama tidak dapat dipakai. | ⬜ |
| AM-A08 | P0 | Buka `/admin/managers`, `/admin/permissions`, `/admin/master-products`, dan Integrasi Zoho. | Menu/aksi khusus Super Admin atau Finance ditolak. | ⬜ |

## 6. Test Case B — Cabang, member, staff, dan sesi

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| AM-B01 | P0 | Buka Pengaturan Cabang PST/BDG. | Data dalam scope tampil. | ⬜ |
| AM-B02 | P0 | Buka daftar member PST lalu BDG. | Filter benar dan tidak tercampur SBY. | ⬜ |
| AM-B03 | P1 | Export member/laporan salah satu cabang. | File hanya berisi cabang terpilih. | ⬜ |
| AM-B04 | P0 | Buka Kinerja Staff dan filter tanggal/cabang. | Angka mengikuti data sesi dalam scope. | ⬜ |
| AM-B05 | P0 | Buka sesi `TTR-001` dari UAT MSO-Nakes-Dokter. | Assignment, status, dan langkah selesai konsisten. | ⬜ |
| AM-B06 | P0 | Periksa siapa mengisi Evaluasi Dokter. | Hanya dokter assigned yang tercatat. | ⬜ |
| AM-B07 | P0 | Periksa finalisasi `TTR-001`. | Pelaku MSO/Nakes; sumber stok terpilih terpotong sekali. | ⬜ |
| AM-B08 | P1 | Periksa reminder sesi selesai. | Tidak ada reminder pekerjaan tersisa. | ⬜ |
| AM-B09 | P0 | Ubah `branchId`, staff, atau owner lewat request browser. | Server memvalidasi scope dan identitas actor. | ⬜ |
| AM-B10 | P1 | Buka Laporan setelah membuat sesi baru. | Angka berubah konsisten tanpa duplikasi. | ⬜ |

## 7. Test Case C — Inventori dan logistik

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| AM-C01 | P0 | Buka Dashboard Logistik dan Ledger PST. | Quantity/nilai tampil sesuai cabang. | ⬜ |
| AM-C02 | P0 | Buka request stok dalam scope. | Dokumen dan status dapat ditelusuri. | ⬜ |
| AM-C03 | P0 | Approve/reject request sesuai tahap aktif. | Keputusan satu kali dan audit tercatat. | ⬜ |
| AM-C04 | P0 | Coba approve request buatan sendiri. | Ditolak oleh maker-checker. | ⬜ |
| AM-C05 | P0 | Pantau reservasi dan pengiriman. | Reserved/in-transit/on-hand konsisten. | ⬜ |
| AM-C06 | P0 | Terima shipment pada cabang tujuan yang diizinkan. | Stok tujuan bertambah tepat sekali. | ⬜ |
| AM-C07 | P0 | Buka Stock Opname/Adjustment. | Perubahan wajib mengikuti status/approval. | ⬜ |
| AM-C08 | P0 | Cek Inventori Tim dan pinjaman antartim. | Owner, borrower, outstanding, dan histori benar. | ⬜ |
| AM-C09 | P0 | Cek `TTR-001` pada ledger. | Hanya Stok Cabang atau Stok Tim yang terpotong. | ⬜ |
| AM-C10 | P0 | Ulangi receive/approve/adjust request yang sama. | Tidak ada mutasi stok ganda. | ⬜ |

## 8. Test Case D — Approval, reimburse, expense, dan Finance

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| AM-D01 | P0 | Buka Approval Inbox. | Hanya tahap aktif dan dokumen dalam scope. | ⬜ |
| AM-D02 | P0 | Buka foto reimburse. | URL aman, sementara, dan hanya untuk dokumen berizin. | ⬜ |
| AM-D03 | P0 | Jalankan `MFA-01` sampai `MFA-03` untuk nominal standar. | Manager dapat memantau; Finance menjadi approver Finance. | ⬜ |
| AM-D04 | P0 | Jalankan nominal >= Rp10.000.000. | Setelah Finance approve, tahap High Approval muncul. | ⬜ |
| AM-D05 | P0 | Manager sesuai scope high approve. | Reimburse menjadi `APPROVED`. | ⬜ |
| AM-D06 | P0 | Manager di luar scope high approve. | Ditolak `403`/scope error. | ⬜ |
| AM-D07 | P0 | Approver yang sama mencoba dua tahap. | Ditolak; satu actor tidak memutus dua tahap workflow yang sama. | ⬜ |
| AM-D08 | P0 | MSO buat expense dan Submit; Manager approve. | Expense `APPROVED` dan audit lengkap. | ⬜ |
| AM-D09 | P0 | Manager yang membuat expense mencoba approve sendiri. | Ditolak oleh maker-checker. | ⬜ |
| AM-D10 | P0 | Finance membayar expense/reimburse approved. | Status `PAID`; manager dapat melihat hasil. | ⬜ |
| AM-D11 | P0 | Reject/Return for Revision tanpa alasan. | Ditolak; alasan wajib. | ⬜ |
| AM-D12 | P0 | Klik keputusan/pembayaran ulang. | Tidak ada approval, jurnal, atau kas-bank ganda. | ⬜ |

## 9. Test Case E — Accounting, laporan, audit, dan keamanan

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| AM-E01 | P0 | Buka Accounting dan jurnal transaksi `MFA-001`. | Dokumen sumber dapat ditelusuri. | ⬜ |
| AM-E02 | P0 | Cek Kas & Bank setelah pembayaran. | Saldo turun sesuai nominal satu kali. | ⬜ |
| AM-E03 | P0 | Cek Trial Balance/General Ledger. | Total debit = total kredit. | ⬜ |
| AM-E04 | P1 | Cek Finance Reports dengan filter cabang/periode. | Angka konsisten dengan ledger. | ⬜ |
| AM-E05 | P0 | Posting pada periode tertutup. | Ditolak; tanggal tidak digeser diam-diam. | ⬜ |
| AM-E06 | P0 | Buka Audit Log untuk approval/perubahan mapping. | Actor, waktu, before/after, dan dokumen tercatat. | ⬜ |
| AM-E07 | P0 | Manipulasi nominal/status/actor lewat request. | Field sensitif diabaikan atau request ditolak. | ⬜ |
| AM-E08 | P0 | Buka URL bukti setelah logout. | File tidak dapat diakses. | ⬜ |

## 10. Ringkasan hasil

| Kelompok | PASS | FAIL | BLOCKED | NOT TESTED |
|---|---:|---:|---:|---:|
| A. Login/menu/scope | 0 | 0 | 0 | 8 |
| B. Cabang/member/staff/sesi | 0 | 0 | 0 | 10 |
| C. Inventori/logistik | 0 | 0 | 0 | 10 |
| D. Approval/Finance | 0 | 0 | 0 | 12 |
| E. Accounting/laporan/keamanan | 0 | 0 | 0 | 8 |
| **Total** | **0** | **0** | **0** | **48** |

- [ ] **LULUS** — seluruh P0 PASS.
- [ ] **LULUS BERSYARAT** — hanya temuan nonkritis.
- [ ] **TIDAK LULUS** — ada bypass role/scope, kebocoran bukti, atau posting ganda.

| Persetujuan | Nama | Tanggal | Status |
|---|---|---|---|
| Perwakilan Admin Manager |  |  |  |
| QA/UAT |  |  |  |
| Product Owner |  |  |  |
