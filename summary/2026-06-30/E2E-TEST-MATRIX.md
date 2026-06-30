# E2E Test Plan / Matrix ERP Klinik

Tanggal: 2026-06-30

## Tujuan

Dokumen ini menjadi blueprint Phase 1 untuk implementasi end-to-end testing aplikasi ERP klinik. Fokusnya adalah memastikan alur kritikal lintas role berjalan dari UI sampai API/database: login, member, paket terapi, pembayaran, sesi terapi, inventori, cabang, referral, notifikasi, dan audit log.

## Role Test Account

| Role | Kode | Cakupan Minimum |
| --- | --- | --- |
| Super Admin | SA | Semua cabang, manajemen sistem, audit log global |
| Admin Manager | AM | Beberapa cabang yang dikelola |
| Admin Cabang | AC | Satu cabang aktif |
| Admin Layanan | AL | Operasional layanan/member/sesi |
| Dokter | DR | Diagnosis, evaluasi, therapy plan |
| Nakes | NK | Sesi, tindakan, material usage |
| Member | MB | Portal member: dashboard, invoice, sesi, voucher, profil |

## Seed Data Minimum

| Data | Kebutuhan |
| --- | --- |
| Cabang | 1 pusat, 2 cabang managed AM, 1 cabang di luar AM |
| Staff | 1 user aktif per role, 1 user inactive |
| Member | Member baru, member dengan paket aktif, member dengan invoice pending |
| Paket | Paket terapi utama, paket installment, harga paket aktif |
| Inventory | Master product, stok cukup, stok rendah, item expiring/overstock |
| Request stok | Draft/request pending, approved, menunggu pembayaran, paid, preparing |
| Shipment | Preparing, shipped, received, issue/shortage |
| Dokumen | File PDF/JPG dummy untuk upload bukti bayar, tanda terima, lab result |

## Prioritas

| Level | Makna |
| --- | --- |
| P0 | Smoke/critical, wajib jalan di setiap CI |
| P1 | Regression utama, wajib sebelum release |
| P2 | Edge case dan coverage tambahan |

## Matrix Skenario

| ID | Prioritas | Area | Role | Skenario | Ekspektasi |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | P0 | Auth | Semua staff | Login dengan credential valid | Masuk dashboard sesuai role, token tersimpan |
| AUTH-002 | P0 | Auth | MB | Login member valid | Masuk `/me/dashboard` |
| AUTH-003 | P0 | Auth | Semua | Logout | Session bersih dan kembali ke login |
| AUTH-004 | P1 | Auth | Semua | Login password salah | Muncul error, tidak masuk sistem, audit `LOGIN_FAILED` tercatat |
| AUTH-005 | P1 | Auth | Semua | User inactive login | Ditolak dengan pesan valid |
| AUTH-006 | P1 | Auth | Semua | Akses route protected tanpa token | Redirect login |
| AUTH-007 | P1 | Auth | Semua | Token expired/invalid | Logout otomatis/redirect login |
| ACCESS-001 | P0 | Authorization | SA | Akses halaman Super Admin | Semua menu sistem terlihat |
| ACCESS-002 | P0 | Authorization | AM | Akses cabang managed saja | Data cabang luar AM tidak terlihat/ditolak |
| ACCESS-003 | P0 | Authorization | AC | Tidak bisa akses audit log/manajer | Redirect/forbidden |
| ACCESS-004 | P1 | Authorization | DR/NK | Tidak bisa akses manajemen sistem | Redirect/forbidden |
| DASH-001 | P0 | Dashboard | SA | Buka dashboard super admin | KPI sistem tampil tanpa error |
| DASH-002 | P0 | Dashboard | AM | Buka dashboard admin manager | KPI cabang managed tampil |
| DASH-003 | P1 | Dashboard | AC/AL/DR/NK | Buka dashboard role | Widget sesuai role tampil |
| MEMBER-001 | P0 | Member | AM/AC/AL | List member | Table muncul, search/filter bekerja |
| MEMBER-002 | P0 | Member | AC/AL | Buat member baru | Member tersimpan, nomor member muncul |
| MEMBER-003 | P1 | Member | AC/AL | Validasi field wajib member | Error form muncul |
| MEMBER-004 | P0 | Member | AM/AC/AL/DR/NK | Detail member | Profil, paket, sesi, dokumen tampil |
| MEMBER-005 | P1 | Member | AC/AL | Edit profil member | Perubahan tersimpan dan audit tercatat |
| MEMBER-006 | P1 | Member | AC/AL | Upload dokumen member PDF/JPG | File tersimpan dan bisa dilihat |
| MEMBER-007 | P1 | Member | AC/AL | Export member | File export terunduh |
| MEMBER-008 | P2 | Member | AM | Akses member cabang luar managed | Ditolak/tidak muncul |
| PACKAGE-001 | P0 | Paket Terapi | AC/AL | Assign paket terapi ke member | Paket muncul di detail member |
| PACKAGE-002 | P0 | Paket Terapi | AC/AL | Assign paket tanpa add-ons | Berhasil tanpa section add-ons |
| PACKAGE-003 | P1 | Paket Terapi | AC/AL | Upload bukti pembayaran paket | Status menunggu verifikasi |
| PACKAGE-004 | P0 | Pembayaran | AC/AM | Verifikasi pembayaran | Paket aktif, invoice paid, audit `VERIFY_PAYMENT` |
| PACKAGE-005 | P1 | Pembayaran | AC/AM | Tolak pembayaran | Status kembali pending, alasan tersimpan, audit `REJECT_PAYMENT` |
| PACKAGE-006 | P1 | Paket Terapi | AC/AL | Edit paket member | Perubahan tersimpan |
| PACKAGE-007 | P1 | Paket Terapi | AC/AL | Cancel/refund paket | Status berubah dan audit tercatat |
| PACKAGE-008 | P1 | Harga Paket | SA/AM/AC | List/filter harga paket | Data tampil sesuai akses |
| PACKAGE-009 | P1 | Harga Paket | SA/AM/AC | Create/edit/delete harga paket | CRUD berhasil dan validasi berjalan |
| SESSION-001 | P0 | Sesi Terapi | SA/AM/AC/AL | Buat sesi untuk member | Sesi tercatat dengan jadwal/cabang benar |
| SESSION-002 | P0 | Sesi Terapi | DR/NK/AL | List dan filter sesi | Sesi sesuai role/cabang tampil |
| SESSION-003 | P0 | Sesi Terapi | DR | Input diagnosis/evaluasi dokter | Data tersimpan dan tampil di detail sesi |
| SESSION-004 | P0 | Therapy Plan | DR | Buat/edit therapy plan | Plan tersimpan pada member/sesi |
| SESSION-005 | P1 | Sesi Terapi | NK | Input vital sign | Data tersimpan |
| SESSION-006 | P1 | Sesi Terapi | NK | Input infusion/booster/tindakan | Data tindakan tersimpan |
| SESSION-007 | P1 | Material Usage | NK | Catat pemakaian material | Stok berkurang, history usage tercatat |
| SESSION-008 | P1 | Sesi Terapi | DR/NK | Upload supporting photo | File tampil di detail sesi |
| SESSION-009 | P0 | Sesi Terapi | DR/NK/AL | Complete session | Status selesai, audit tercatat |
| SESSION-010 | P1 | Sesi Terapi | SA/AM/AC | Export sesi | File export terunduh |
| INVENTORY-001 | P0 | Stok | AC/AL/DR/NK | List stok cabang | Data stok tampil sesuai cabang |
| INVENTORY-002 | P1 | Stok | AC/AL | Tambah item stok | Stok bertambah dan audit tercatat |
| INVENTORY-003 | P1 | Stok | AC/AL | Edit item stok | Perubahan tampil |
| INVENTORY-004 | P1 | Stok | AC/AL | Hapus/nonaktif item stok | Item tidak muncul sebagai aktif |
| INVENTORY-005 | P1 | Mutasi Stok | Semua staff | Lihat mutasi stok | History mutasi tampil |
| INVENTORY-006 | P1 | Material Usage | Semua staff | Lihat riwayat penggunaan barang | Filter tanggal/cabang bekerja |
| STOCKREQ-001 | P0 | Request Stok | AC | Buat request stok | Request status awal tercatat |
| STOCKREQ-002 | P1 | Request Stok | AC | Edit request sebelum final | Item/qty berubah |
| STOCKREQ-003 | P0 | Request Stok | AM | Review/approve request | Status berubah dan invoice dibuat bila perlu |
| STOCKREQ-004 | P1 | Request Stok | AM | Reject/request revisi | Status dan catatan tampil |
| STOCKREQ-005 | P1 | Request Stok | AC | Upload bukti pembayaran request stok | Bukti tersimpan |
| STOCKREQ-006 | P1 | Request Stok | AM | Verifikasi pembayaran request stok | Status lanjut preparing |
| STOCKREQ-007 | P1 | Request Stok | AM/AC | Download invoice request stok | PDF terunduh |
| SHIP-001 | P0 | Pengiriman | AM | Buat/siapkan shipment dari request | Shipment status preparing |
| SHIP-002 | P0 | Pengiriman | AM | Kirim barang + upload foto | Status shipped, data pengirim tersimpan |
| SHIP-003 | P0 | Penerimaan Barang | AC | Terima barang + upload tanda terima PDF/JPG | Status received, receipt tersimpan |
| SHIP-004 | P1 | Pengiriman Bermasalah | AC | Laporkan shortage/issue | Status issue dan notifikasi AM muncul |
| SHIP-005 | P1 | Pengiriman | AM/AC | Detail/edit notes shipment | Notes tersimpan |
| SHIP-006 | P2 | Upload | AC | Upload tanda terima format invalid | Ditolak dengan pesan valid |
| OVERSTOCK-001 | P1 | Overstock | AM/AC | List overstock | Data tampil sesuai cabang |
| MASTER-001 | P0 | Master Produk | SA | List master produk | Data tampil |
| MASTER-002 | P1 | Master Produk | SA | Create/edit/delete master produk | CRUD berhasil |
| MASTER-003 | P1 | Master Types | SA | Create/edit/delete booster/service type | CRUD berhasil |
| BRANCH-001 | P0 | Cabang | SA/AM | List cabang | SA semua, AM hanya managed |
| BRANCH-002 | P1 | Cabang | SA | Create/edit cabang | Data tersimpan |
| BRANCH-003 | P1 | Cabang | SA | Delete/force delete cabang | Validasi dependency berjalan |
| BRANCH-004 | P1 | Cabang Detail | SA/AM | Lihat member/staff/stock/sessions cabang | Tab memuat data |
| STAFF-001 | P1 | Staff | AC | Kelola staff cabang | Create/edit/aktif-nonaktif berhasil |
| STAFF-002 | P1 | Staff Branch | SA/AM/AC | Assign staff ke cabang | Assignment tersimpan |
| STAFF-003 | P1 | Kinerja Staff | SA/AM/AC | Lihat performance staff | Filter dan detail tampil |
| MANAGER-001 | P0 | Admin Manager | SA | List admin manager | Data tampil |
| MANAGER-002 | P1 | Admin Manager | SA | Create/edit/delete admin manager | CRUD berhasil |
| MANAGER-003 | P1 | Admin Manager | SA | Assign/unassign cabang ke manager | Hak akses berubah sesuai assignment |
| IMPERSONATE-001 | P1 | Impersonation | SA/AM | Start impersonation user valid | Masuk sebagai user target |
| IMPERSONATE-002 | P1 | Impersonation | SA/AM | Stop impersonation | Kembali ke user asli |
| REF-001 | P1 | Referral | AM/AC | List referral code | Data tampil sesuai cabang |
| REF-002 | P1 | Referral | AM/AC | Create/edit/delete referral code | CRUD berhasil |
| REF-003 | P1 | Referral | AM/AC | Detail referral dan incentive | Statistik tampil |
| REF-004 | P2 | Referral | AM/AC | Export referral | File terunduh |
| NOTIF-001 | P0 | Notifikasi | AM | Ada request stok/pengiriman bermasalah | Badge sidebar/header muncul |
| NOTIF-002 | P1 | Notifikasi | AM | Klik notifikasi | Mengarah ke halaman terkait |
| NOTIF-003 | P1 | Notifikasi | Semua staff | Halaman notifikasi kosong/berisi | Render sesuai role |
| CHAT-001 | P2 | Chat | Semua staff | Buka chat | Room/list tampil |
| CHAT-002 | P2 | Chat | Semua staff | Kirim pesan | Pesan muncul di room |
| AUDIT-001 | P0 | Audit Log | SA | List audit log global | Semua cabang terlihat |
| AUDIT-002 | P0 | Audit Log | AM | List audit log managed branch | Cabang luar managed tidak terlihat |
| AUDIT-003 | P1 | Audit Log | SA/AM | Filter action/module/role/cabang/tanggal | Hasil sesuai filter |
| AUDIT-004 | P1 | Audit Log | SA/AM | Detail audit log | Metadata, actor, branch, changedFields tampil |
| AUDIT-005 | P1 | Audit Log | SA/AM | Export CSV audit log | CSV terunduh |
| AUDIT-006 | P1 | Audit Log | AC/AL/DR/NK | Akses audit log | Ditolak/redirect |
| MEMBERPORTAL-001 | P0 | Member Portal | MB | Dashboard member | Ringkasan paket/sesi/invoice tampil |
| MEMBERPORTAL-002 | P1 | Member Portal | MB | Lihat invoice | Invoice tampil dan detail bisa dibuka |
| MEMBERPORTAL-003 | P1 | Member Portal | MB | Lihat sesi | Sesi member tampil |
| MEMBERPORTAL-004 | P1 | Member Portal | MB | Detail sesi | Detail terapi tampil |
| MEMBERPORTAL-005 | P1 | Member Portal | MB | Profil member | Data profil tampil |
| MEMBERPORTAL-006 | P1 | Member Portal | MB | Voucher | Voucher aktif/riwayat tampil |
| FILE-001 | P1 | File Serving | Semua valid | Buka file upload yang valid | File bisa diakses sesuai permission |
| FILE-002 | P1 | File Serving | Unauthorized | Akses file tanpa izin | Ditolak |
| WILAYAH-001 | P2 | Wilayah API | Form cabang/member | Load provinsi/kabupaten | Dropdown terisi |

## Negative / Edge Case Global

| ID | Prioritas | Skenario | Ekspektasi |
| --- | --- | --- | --- |
| NEG-001 | P1 | Form submit dengan field wajib kosong | Error validasi tampil, tidak ada data baru |
| NEG-002 | P1 | Upload file terlalu besar | Ditolak dengan pesan valid |
| NEG-003 | P1 | Upload tipe file tidak didukung | Ditolak |
| NEG-004 | P1 | Akses data cabang lain via URL langsung | 403/redirect, data tidak bocor |
| NEG-005 | P1 | Double submit tombol simpan | Hanya satu data dibuat |
| NEG-006 | P2 | Search/filter tanpa hasil | Empty state tampil |
| NEG-007 | P2 | Pagination halaman terakhir | Tidak error dan tombol disabled benar |

## Smoke Suite P0 Rekomendasi CI

1. Login/logout: SA, AM, AC, AL, DR, NK, MB.
2. Dashboard per role utama render tanpa error.
3. Create member baru.
4. Assign paket terapi tanpa add-ons.
5. Upload dan verifikasi pembayaran paket.
6. Buat sesi, isi diagnosis/vital/material usage, complete sesi.
7. Buat request stok, approve, upload pembayaran, proses shipment, receive dengan PDF/JPG.
8. Notifikasi AM muncul untuk request stok/pengiriman bermasalah.
9. Audit log mencatat login, create/update, verify payment, shipment receive.
10. Authorization: AM tidak melihat cabang luar managed, AC tidak bisa buka audit log.

## Struktur Implementasi Playwright yang Disarankan

```text
apps/web/e2e/
  auth.spec.ts
  access-control.spec.ts
  member.spec.ts
  package-payment.spec.ts
  sessions.spec.ts
  inventory-stock-request.spec.ts
  shipments.spec.ts
  branch-staff-manager.spec.ts
  referral.spec.ts
  audit-log.spec.ts
  member-portal.spec.ts
  fixtures/
    users.ts
    files/
      receipt.pdf
      receipt.jpg
      payment-proof.jpg
  helpers/
    auth.ts
    api.ts
    test-data.ts
```

## Catatan Eksekusi Phase 2

- Gunakan Playwright project per role atau helper `loginAs(role)`.
- Simpan authenticated storage state per role untuk mempercepat test.
- Jalankan test dengan database khusus E2E, bukan database development harian.
- Seed E2E harus idempotent dan bisa reset data.
- Prioritaskan P0 dahulu sebelum menulis P1/P2.
