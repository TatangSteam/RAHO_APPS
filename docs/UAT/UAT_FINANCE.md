# UAT Finance & Logistik

Status: siap dipakai untuk UAT, belum berarti seluruh skenario sudah lulus  
Template: `FINANCE_LOGISTICS_CONTROLLER_DEFAULT`  
Pembaruan: 24 Agustus 2026

> Lagi buru-buru? Jalankan **Cek Kilat 15 Menit** lalu flow `MFA`.

Dokumen terkait:

- [Pusat Dokumen UAT](./README.md)
- [UAT Admin Manager](./UAT_ADMIN_MANAGER.md)
- [UAT Admin Layanan / MSO](./UAT_ADMIN_LAYANAN_MSO.md)
- [UAT Nakes](./UAT_NAKES.md)
- [UAT Dokter](./UAT_DOKTER.md)
- [Regresi lengkap Finance, Logistik, dan Sesi](./UAT_FINANCE_LOGISTIK_DAN_SESI_TERAPI.md)

## 1. Ringkasan 30 detik

Finance harus bisa:

- memproses approval dan pembayaran reimburse;
- mengelola invoice/payment, expense, kas-bank, jurnal, periode, dan laporan;
- menjalankan purchasing/AP dan deferred revenue;
- memantau inventory lintas cabang;
- men-dispatch shipment, tetapi **tidak menerima shipment tujuan**;
- mengelola sinkronisasi/rekonsiliasi Zoho sesuai permission;
- melihat audit sesuai scope.

Finance tidak boleh menjadi maker sekaligus approver workflow yang sama, memilih
cabang di luar assignment, menerima shipment tujuan, atau mengubah data klinis.

## 2. Credential dari seeding

> Hanya untuk local/test. Jangan gunakan di production.

| Email | Password | Staff code | Role dasar | Template | Scope |
|---|---|---|---|---|---|
| `finance@raho.id` | `Finance@123` | `FN-20260723-RAHO` | `ADMIN_MANAGER` | Finance & Logistics Controller | PST + BDG + SBY |

Role dasar `ADMIN_MANAGER` dipertahankan untuk kompatibilitas. Otorisasi bisnis
harus mengikuti template dan permission, bukan label role dasar saja.

Credential pendamping:

| Role | Email | Password | Kegunaan |
|---|---|---|---|
| Manager 1 | `manager1@raho.id` | `Manager@123` | High approval PST/BDG dan checker |
| Manager 2 | `manager2@raho.id` | `Manager@123` | High approval SBY/PST dan checker |
| Admin Cabang PST | `admincabang.pst@raho.id` | `AdminCabang@123` | Verifikasi reimburse |
| MSO PST | `adminlayanan.pst@raho.id` | `AdminLayanan@123` | Maker expense/reimburse |
| Nakes PST | `nakes@raho.id` | `Nakes@123` | Maker reimburse/output sesi |
| Dokter PST | `dokter@raho.id` | `Dokter@123` | Maker reimburse/evaluasi |

`adminlogistik@raho.id` adalah akun legacy yang dinonaktifkan. Jangan dipakai.

## 3. Cek Kilat 15 Menit

| No | Lakukan | Harus terjadi | Hasil |
|---:|---|---|---|
| 1 | Login `finance@raho.id`. | Nama/template Finance & Logistik tampil. | ⬜ |
| 2 | Buka Approval Inbox. | Hanya dokumen pada tahap yang boleh diputus Finance. | ⬜ |
| 3 | Approve reimburse setelah verifikasi Admin Cabang. | Standar approved; nominal besar maju ke High Approval. | ⬜ |
| 4 | Bayar reimburse approved. | `PAID`, jurnal, dan kas/bank terbentuk sekali. | ⬜ |
| 5 | Bayar expense yang telah di-approve Manager. | `PAID`; debit = kredit. | ⬜ |
| 6 | Dispatch shipment yang siap. | Berhasil satu kali. | ⬜ |
| 7 | Coba Receive shipment tujuan. | Ditolak; penerimaan milik staff tujuan. | ⬜ |
| 8 | Buka Finance Reports dan Audit Log. | Angka/source link/actor konsisten. | ⬜ |

Jika nomor 2, 4, 5, 6, atau 7 gagal: **STOP dan catat defect P0**.

## 4. Flow utama

```text
Dokumen masuk -> cek branch + bukti + nominal
-> approve/reject/revisi -> bayar hanya jika approved
-> jurnal + kas/bank -> laporan -> rekonsiliasi -> audit
```

Jalankan `MFA-01` sampai `MFA-12` pada
[Pusat Dokumen UAT](./README.md#flow-bersama-2--approval-dan-pembayaran-mfa).

## 5. Test Case A — Login, menu, permission, dan scope

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| FN-A01 | P0 | Login credential benar. | Login berhasil sebagai Finance & Logistik. | ⬜ |
| FN-A02 | P1 | Login password salah. | Ditolak tanpa membocorkan detail akun. | ⬜ |
| FN-A03 | P0 | Lihat scope cabang. | PST, BDG, dan SBY tersedia. | ⬜ |
| FN-A04 | P0 | Buka Finance, Approval, Logistik, Audit, dan Integrasi Zoho. | Menu sesuai permission tersedia. | ⬜ |
| FN-A05 | P0 | Coba ubah diagnosis, vital, infus, atau Evaluasi Dokter. | UI/API menolak. | ⬜ |
| FN-A06 | P0 | Ubah actor/branch/nominal/status lewat request browser. | Server menolak atau memakai identitas token. | ⬜ |
| FN-A07 | P1 | Logout lalu Back/refresh. | Sesi lama tidak dapat dipakai. | ⬜ |
| FN-A08 | P0 | Buka bukti foto tanpa login atau di luar izin. | Akses ditolak. | ⬜ |

## 6. Test Case B — Approval dan reimburse

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| FN-B01 | P0 | MSO/Nakes/Dokter submit reimburse + foto. | Belum muncul pada tahap Finance sebelum Verifikasi Cabang selesai. | ⬜ |
| FN-B02 | P0 | Admin Cabang verify. | Dokumen muncul di Approval Inbox Finance. | ⬜ |
| FN-B03 | P0 | Buka detail dan semua bukti. | Pengaju, cabang, tanggal, kategori, nominal, metode, rekening, dan foto lengkap. | ⬜ |
| FN-B04 | P0 | Approve reimburse < Rp10 juta. | Status `APPROVED`. | ⬜ |
| FN-B05 | P0 | Approve reimburse >= Rp10 juta. | Maju ke High Approval, belum dapat dibayar. | ⬜ |
| FN-B06 | P0 | Manager sesuai scope high approve. | Status `APPROVED`. | ⬜ |
| FN-B07 | P0 | Finance mencoba memutus dua tahap approval yang sama. | Ditolak oleh aturan satu approver satu keputusan. | ⬜ |
| FN-B08 | P0 | Return for Revision dengan alasan. | Pengaju mendapat notifikasi dan dapat memperbaiki. | ⬜ |
| FN-B09 | P0 | Reject tanpa alasan. | Ditolak; alasan wajib. | ⬜ |
| FN-B10 | P0 | Bayar sebelum approved. | Ditolak. | ⬜ |
| FN-B11 | P0 | Bayar approved dengan akun beban dan kas/bank cabang benar. | `PAID`; jurnal dan transaksi kas/bank terbentuk. | ⬜ |
| FN-B12 | P0 | Pilih kas/bank cabang lain atau akun non-postable. | Ditolak. | ⬜ |
| FN-B13 | P0 | Rekening yang mewajibkan referensi, tetapi referensi kosong. | Ditolak. | ⬜ |
| FN-B14 | P0 | Klik Bayar dua kali/concurrent. | Satu pembayaran; replay idempotent. | ⬜ |
| FN-B15 | P0 | Cocokkan notifikasi pengaju dan Audit Log. | Status, actor, waktu, dan referensi sama. | ⬜ |

## 7. Test Case C — Expense, kas-bank, dan accounting

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| FN-C01 | P0 | MSO/Admin Cabang membuat expense + evidence lalu Submit. | Expense masuk Approval Inbox Manager. | ⬜ |
| FN-C02 | P0 | Manager sesuai scope approve. | Expense menjadi `APPROVED`. | ⬜ |
| FN-C03 | P0 | Manager di luar scope approve. | Ditolak. | ⬜ |
| FN-C04 | P0 | Finance bayar expense approved. | Expense `PAID`; jurnal dan kas-bank satu kali. | ⬜ |
| FN-C05 | P0 | Finance membuat expense sendiri lalu Submit. | Mengikuti kebijakan Finance autonomous dan audit mencatat auto-approval. | ⬜ |
| FN-C06 | P0 | Bayar expense yang belum approved/rejected. | Ditolak. | ⬜ |
| FN-C07 | P0 | Bayar expense sama dua kali. | Replay aman; tidak ada jurnal ganda. | ⬜ |
| FN-C08 | P0 | Verifikasi journal source link. | Menunjuk nomor expense yang tepat. | ⬜ |
| FN-C09 | P0 | Cek Kas & Bank. | Saldo berkurang tepat sebesar pembayaran. | ⬜ |
| FN-C10 | P0 | Posting jurnal tidak seimbang. | Ditolak. | ⬜ |
| FN-C11 | P0 | Posting pada periode tertutup. | Ditolak tanpa mengubah tanggal. | ⬜ |
| FN-C12 | P1 | Export GL/Trial Balance. | Debit = kredit dan filter cabang/periode benar. | ⬜ |

## 8. Test Case D — Purchasing, AP, dan deferred revenue

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| FN-D01 | P0 | Buat purchase request valid. | Draft/submit tersimpan dengan branch dan maker benar. | ⬜ |
| FN-D02 | P0 | Maker mencoba approve request sendiri. | Ditolak. | ⬜ |
| FN-D03 | P0 | Approver lain approve request. | Status maju sekali. | ⬜ |
| FN-D04 | P0 | Buat PO dari request approved. | Supplier, item, quantity, harga, dan referensi benar. | ⬜ |
| FN-D05 | P0 | Baca Goods Receipt. | Quantity penerimaan dan discrepancy terlihat. | ⬜ |
| FN-D06 | P0 | Post supplier invoice/AP. | Hutang dan persediaan/beban terposting seimbang. | ⬜ |
| FN-D07 | P0 | Bayar AP. | Hutang berkurang dan kas/bank berkurang sekali. | ⬜ |
| FN-D08 | P0 | Ulangi posting invoice/payment. | Tidak ada AP atau jurnal ganda. | ⬜ |
| FN-D09 | P0 | Jalankan recognition pada data valid. | Deferred revenue berkurang, revenue bertambah seimbang. | ⬜ |
| FN-D10 | P0 | Jalankan recognition ulang untuk periode sama. | Idempotent/ditolak tanpa jurnal ganda. | ⬜ |

## 9. Test Case E — Inventory dan logistik

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| FN-E01 | P0 | Buka Dashboard/ledger/valuation semua cabang. | Data mengikuti filter dan dapat direkonsiliasi. | ⬜ |
| FN-E02 | P0 | Cek output sesi `TTR-001`. | Quantity/value keluar sekali dari sumber stok terpilih. | ⬜ |
| FN-E03 | P0 | Buka request dan reservation. | Status serta quantity reserved konsisten. | ⬜ |
| FN-E04 | P0 | Dispatch shipment siap. | Status dispatched/in-transit; asal berkurang sesuai aturan. | ⬜ |
| FN-E05 | P0 | Dispatch ulang shipment sama. | Ditolak/idempotent tanpa mutasi ganda. | ⬜ |
| FN-E06 | P0 | Finance mencoba Receive shipment. | Ditolak karena template dispatch-only. | ⬜ |
| FN-E07 | P0 | Staff cabang tujuan Receive. | Tujuan bertambah dan in-transit selesai tepat sekali. | ⬜ |
| FN-E08 | P0 | Cek discrepancy shipment. | Selisih harus punya alasan/evidence dan audit. | ⬜ |
| FN-E09 | P0 | Cek opname/adjustment approved. | Quantity dan value berubah satu kali. | ⬜ |
| FN-E10 | P0 | Cek pinjaman tim/Tas Homecare. | Tidak bercampur dengan stock cabang tanpa transfer sah. | ⬜ |

## 10. Test Case F — Reports, Zoho, audit, dan keamanan

| ID | Pri | Lakukan | Harus terjadi | Hasil |
|---|---|---|---|---|
| FN-F01 | P0 | Cek P&L, Trial Balance, GL, inventory valuation. | Semua dapat ditelusuri ke source document. | ⬜ |
| FN-F02 | P0 | Bandingkan total reimburse/expense paid dengan kas-bank. | Selisih nol/tolerance resmi. | ⬜ |
| FN-F03 | P0 | Buka status koneksi dan health check Zoho. | Hanya metadata aman; token tidak tampil. | ⬜ |
| FN-F04 | P0 | Buka queue/mapping/reconciliation Zoho. | Data bisa dibaca sesuai permission. | ⬜ |
| FN-F05 | P0 | Retry job gagal yang retryable. | Sukses/retry terjadwal tanpa dokumen ganda. | ⬜ |
| FN-F06 | P0 | Coba go-live/cutover tanpa prasyarat/approval. | Diblok. | ⬜ |
| FN-F07 | P0 | Buka Audit Log approval, payment, shipment, Zoho. | Actor, waktu, before/after, correlation/source ID lengkap. | ⬜ |
| FN-F08 | P0 | Pastikan token dan data medis tidak ada di log. | Tidak ada secret/diagnosis/catatan klinis. | ⬜ |
| FN-F09 | P0 | Manipulasi posting key dengan payload berbeda. | Konflik, bukan membuat transaksi baru. | ⬜ |
| FN-F10 | P0 | Simulasikan koneksi gagal/retry. | Operasi RAHO tetap berjalan; retry aman. | ⬜ |

## 11. Ringkasan hasil

| Kelompok | PASS | FAIL | BLOCKED | NOT TESTED |
|---|---:|---:|---:|---:|
| A. Login/menu/scope | 0 | 0 | 0 | 8 |
| B. Approval/reimburse | 0 | 0 | 0 | 15 |
| C. Expense/accounting | 0 | 0 | 0 | 12 |
| D. Purchasing/AP/revenue | 0 | 0 | 0 | 10 |
| E. Inventory/logistik | 0 | 0 | 0 | 10 |
| F. Reports/Zoho/audit | 0 | 0 | 0 | 10 |
| **Total** | **0** | **0** | **0** | **65** |

- [ ] **LULUS** — seluruh P0 PASS.
- [ ] **LULUS BERSYARAT** — hanya temuan nonkritis.
- [ ] **TIDAK LULUS** — ada bypass approval/scope, ledger tidak seimbang, atau posting ganda.

| Persetujuan | Nama | Tanggal | Status |
|---|---|---|---|
| Perwakilan Finance |  |  |  |
| Perwakilan Admin Manager |  |  |  |
| QA/UAT |  |  |  |
| Product Owner |  |  |  |

